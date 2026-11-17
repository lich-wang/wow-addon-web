/**
 * Cloudflare Pages Function: /api/turn-credentials
 * Generates short-lived WebRTC TURN/STUN credentials via Cloudflare Realtime TURN API.
 * Falls back to public domestic-accessible STUN servers if TURN env vars are not configured.
 */

interface TurnEnv {
  CF_TURN_TOKEN_ID?: string;
  CF_TURN_API_TOKEN?: string;
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

export async function onRequestGet(context: { env: TurnEnv }): Promise<Response> {
  const tokenId = context.env.CF_TURN_TOKEN_ID?.trim();
  const apiToken = context.env.CF_TURN_API_TOKEN?.trim();

  if (!tokenId || !apiToken || !/^[a-zA-Z0-9_-]+$/.test(tokenId)) {
    return jsonResponse({
      iceServers: FALLBACK_STUN_SERVERS,
      turnConfigured: false,
    });
  }

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

    if (!response.ok) {
      return jsonResponse({
        iceServers: FALLBACK_STUN_SERVERS,
        turnConfigured: false,
      });
    }

    const data = (await response.json()) as CloudflareTurnResponse;
    if (!Array.isArray(data.iceServers) || data.iceServers.length === 0) {
      return jsonResponse({
        iceServers: FALLBACK_STUN_SERVERS,
        turnConfigured: false,
      });
    }

    return jsonResponse({
      iceServers: mergeWithFallbackStun(data.iceServers),
      turnConfigured: true,
    });
  } catch {
    return jsonResponse({
      iceServers: FALLBACK_STUN_SERVERS,
      turnConfigured: false,
    });
  }
}

export async function onRequestOptions(): Promise<Response> {
  return new Response(null, {
    status: 204,
    headers: CORS_HEADERS,
  });
}
