/**
 * Cloudflare Worker + Durable Object signaling server for wow-addon-web voice chat.
 * Routes each voice room to a single Durable Object instance over standard port 443 (wss://).
 */

interface DurableObjectId {
  toString(): string;
}

interface DurableObjectStub {
  fetch(request: Request): Promise<Response>;
}

interface DurableObjectNamespace {
  idFromName(name: string): DurableObjectId;
  get(id: DurableObjectId): DurableObjectStub;
}

interface DurableObjectState {
  acceptWebSocket(ws: WebSocket): void;
  getWebSockets(): WebSocket[];
}

interface Env {
  VOICE_ROOM: DurableObjectNamespace;
}

interface PeerAttachment {
  peerId: string;
  authHash: string;
  meta: Record<string, unknown>;
}

type ClientMessage =
  | { type: 'join'; peerId: string; authHash: string; meta: Record<string, unknown> }
  | { type: 'meta'; meta: Record<string, unknown> }
  | { type: 'signal'; targetPeerId: string; payload: unknown }
  | { type: 'chat'; message: unknown }
  | { type: 'ping' };

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function safeSend(ws: WebSocket, data: unknown): void {
  try {
    ws.send(JSON.stringify(data));
  } catch {
    // Socket already closed or closing
  }
}

function getAttachment(ws: WebSocket): PeerAttachment | null {
  try {
    const raw = (ws as WebSocket & { deserializeAttachment(): unknown }).deserializeAttachment();
    if (!raw || typeof raw !== 'object') return null;
    const obj = raw as Record<string, unknown>;
    if (typeof obj.peerId !== 'string' || typeof obj.authHash !== 'string') return null;
    return {
      peerId: obj.peerId,
      authHash: obj.authHash,
      meta: (obj.meta && typeof obj.meta === 'object' ? obj.meta : {}) as Record<string, unknown>,
    };
  } catch {
    return null;
  }
}

function setAttachment(ws: WebSocket, attachment: PeerAttachment): void {
  (ws as WebSocket & { serializeAttachment(val: unknown): void }).serializeAttachment(attachment);
}

export class VoiceRoom {
  private ctx: DurableObjectState;

  constructor(ctx: DurableObjectState) {
    this.ctx = ctx;
  }

  async fetch(request: Request): Promise<Response> {
    if (request.headers.get('Upgrade')?.toLowerCase() !== 'websocket') {
      return new Response('Expected WebSocket upgrade', { status: 426 });
    }

    const pair = new WebSocketPair();
    const client = pair[0];
    const server = pair[1];

    this.ctx.acceptWebSocket(server);
    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(ws: WebSocket, rawMessage: string | ArrayBuffer): Promise<void> {
    if (typeof rawMessage !== 'string') return;

    let msg: ClientMessage;
    try {
      msg = JSON.parse(rawMessage) as ClientMessage;
    } catch {
      return;
    }

    if (!msg || typeof msg !== 'object') return;

    if (msg.type === 'ping') {
      safeSend(ws, { type: 'pong' });
      return;
    }

    if (msg.type === 'join') {
      if (typeof msg.peerId !== 'string' || typeof msg.authHash !== 'string' || !msg.peerId || !msg.authHash) {
        return;
      }
      const meta = msg.meta && typeof msg.meta === 'object' ? msg.meta : {};
      setAttachment(ws, { peerId: msg.peerId, authHash: msg.authHash, meta });

      const matchingPeers: Array<{ peerId: string; meta: Record<string, unknown> }> = [];
      let hasAuthMismatch = false;

      for (const other of this.ctx.getWebSockets()) {
        if (other === ws) continue;
        const otherAtt = getAttachment(other);
        if (!otherAtt) continue;
        if (otherAtt.authHash === msg.authHash) {
          matchingPeers.push({ peerId: otherAtt.peerId, meta: otherAtt.meta });
          safeSend(other, { type: 'peer-join', peerId: msg.peerId, meta });
        } else {
          hasAuthMismatch = true;
          safeSend(other, { type: 'auth-mismatch' });
        }
      }

      safeSend(ws, { type: 'joined', peerId: msg.peerId, peers: matchingPeers });
      if (hasAuthMismatch) {
        safeSend(ws, { type: 'auth-mismatch' });
      }
      return;
    }

    const sender = getAttachment(ws);
    if (!sender) return;

    if (msg.type === 'meta') {
      if (!msg.meta || typeof msg.meta !== 'object') return;
      sender.meta = msg.meta;
      setAttachment(ws, sender);
      for (const other of this.ctx.getWebSockets()) {
        if (other === ws) continue;
        const otherAtt = getAttachment(other);
        if (otherAtt && otherAtt.authHash === sender.authHash) {
          safeSend(other, { type: 'peer-meta', peerId: sender.peerId, meta: sender.meta });
        }
      }
      return;
    }

    if (msg.type === 'signal') {
      if (typeof msg.targetPeerId !== 'string') return;
      for (const other of this.ctx.getWebSockets()) {
        if (other === ws) continue;
        const otherAtt = getAttachment(other);
        if (otherAtt && otherAtt.peerId === msg.targetPeerId && otherAtt.authHash === sender.authHash) {
          safeSend(other, { type: 'signal', fromPeerId: sender.peerId, payload: msg.payload });
          break;
        }
      }
      return;
    }

    if (msg.type === 'chat') {
      for (const other of this.ctx.getWebSockets()) {
        if (other === ws) continue;
        const otherAtt = getAttachment(other);
        if (otherAtt && otherAtt.authHash === sender.authHash) {
          safeSend(other, { type: 'chat', peerId: sender.peerId, message: msg.message });
        }
      }
    }
  }

  async webSocketClose(ws: WebSocket, code: number, reason: string): Promise<void> {
    this.handleDisconnect(ws);
    try {
      const safeCode = code === 1000 || (code >= 3000 && code <= 4999) ? code : 1000;
      ws.close(safeCode, (reason || 'Closed').slice(0, 123));
    } catch {
      // Socket already closed
    }
  }

  async webSocketError(ws: WebSocket): Promise<void> {
    this.handleDisconnect(ws);
  }

  private handleDisconnect(ws: WebSocket): void {
    const sender = getAttachment(ws);
    if (!sender) return;
    for (const other of this.ctx.getWebSockets()) {
      if (other === ws) continue;
      const otherAtt = getAttachment(other);
      if (otherAtt && otherAtt.authHash === sender.authHash) {
        safeSend(other, { type: 'peer-leave', peerId: sender.peerId });
      }
    }
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    const url = new URL(request.url);
    if (url.pathname === '/health') {
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
      });
    }

    if (url.pathname === '/ws') {
      const room = url.searchParams.get('room')?.trim();
      if (!room || room.length > 64) {
        return new Response('Invalid room parameter', { status: 400, headers: CORS_HEADERS });
      }
      const id = env.VOICE_ROOM.idFromName(room);
      const stub = env.VOICE_ROOM.get(id);
      return stub.fetch(request);
    }

    return new Response('Not Found', { status: 404, headers: CORS_HEADERS });
  },
};
