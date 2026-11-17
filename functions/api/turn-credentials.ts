/**
 * Cloudflare Pages Function: /api/turn-credentials
 * Generates short-lived WebRTC TURN/STUN credentials.
 * Prefers self-hosted domestic coturn (HMAC-SHA1) when configured, with Cloudflare Realtime TURN as fallback.
 */

interface TurnEnv {
  CF_TURN_TOKEN_ID?: string;
  CF_TURN_API_TOKEN?: string;
  COTURN_HOST?: string;
  COTURN_STATIC_SECRET?: string;
}

interface IceServerEntry {
  urls: string | string[];
  username?: string;
  credential?: string;
}

interface CloudflareTurnResponse {
  iceServers?: IceServerEntry[];
}

const TURN_CREDENTIAL_TTL_SECONDS = 3600;
const UPSTREAM_TIMEOUT_MS = 5000;

const FALLBACK_STUN_SERVERS: IceServerEntry[] = [
  { urls: 'stun:stun.cloudflare.com:3478' },
  { urls: 'stun:stun.miwifi.com:3478' },
  { urls: 'stun:stun.qq.com:3478' },
];

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
      ...CORS_HEADERS,
    },
  });
}

function mergeWithFallbackStun(turnServers: IceServerEntry[]): IceServerEntry[] {
  const existingUrls = new Set<string>();
  for (const server of turnServers) {
    const urls = Array.isArray(server.urls) ? server.urls : [server.urls];
    for (const url of urls) {
      existingUrls.add(url);
    }
  }

  const extras = FALLBACK_STUN_SERVERS.filter((server) => {
    const urls = Array.isArray(server.urls) ? server.urls : [server.urls];
    return urls.some((url) => !existingUrls.has(url));
  });

  return [...turnServers, ...extras];
}

async function buildCoturnIceServers(host: string, secret: string): Promise<IceServerEntry[]> {
  const encoder = new TextEncoder();
  const expiresAt = Math.floor(Date.now() / 1000) + TURN_CREDENTIAL_TTL_SECONDS;
  const username = `${expiresAt}:wow`;
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-1' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(username));
  const credential = btoa(String.fromCharCode(...new Uint8Array(signature)));

  return [
    { urls: `stun:${host}:3478` },
    {
      urls: [`turn:${host}:3478?transport=udp`, `turn:${host}:3478?transport=tcp`],
      username,
      credential,
    },
  ];
}

async function fetchCloudflareTurnServers(tokenId: string, apiToken: string): Promise<IceServerEntry[]> {
  try {
    const response = await fetch(
      `https://rtc.live.cloudflare.com/v1/turn/keys/${tokenId}/credentials/generate-ice-servers`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ ttl: TURN_CREDENTIAL_TTL_SECONDS }),
        signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
      }
    );
    if (!response.ok) return [];
    const data = (await response.json()) as CloudflareTurnResponse;
    return Array.isArray(data.iceServers) ? data.iceServers : [];
  } catch {
    return [];
  }
}

export async function onRequestGet(context: { env: TurnEnv }): Promise<Response> {
  const coturnHost = context.env.COTURN_HOST?.trim();
  const coturnSecret = context.env.COTURN_STATIC_SECRET?.trim();
  const tokenId = context.env.CF_TURN_TOKEN_ID?.trim();
  const apiToken = context.env.CF_TURN_API_TOKEN?.trim();

  const [coturnServers, cfServers] = await Promise.all([
    coturnHost && coturnSecret && /^[a-zA-Z0-9.-]+$/.test(coturnHost)
      ? buildCoturnIceServers(coturnHost, coturnSecret).catch(() => [] as IceServerEntry[])
      : Promise.resolve([] as IceServerEntry[]),
    tokenId && apiToken && /^[a-zA-Z0-9_-]+$/.test(tokenId)
      ? fetchCloudflareTurnServers(tokenId, apiToken)
      : Promise.resolve([] as IceServerEntry[]),
  ]);

  const combined = [...coturnServers, ...cfServers];
  if (combined.length === 0) {
    return jsonResponse({
      iceServers: FALLBACK_STUN_SERVERS,
      turnConfigured: false,
    });
  }

  return jsonResponse({
    iceServers: mergeWithFallbackStun(combined),
    turnConfigured: true,
  });
}

export async function onRequestOptions(): Promise<Response> {
  return new Response(null, {
    status: 204,
    headers: CORS_HEADERS,
  });
}
