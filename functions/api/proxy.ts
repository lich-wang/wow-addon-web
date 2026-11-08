/**
 * Cloudflare Pages Function: /api/proxy
 * Proxies downloads and API calls to bypass browser CORS restrictions
 */
export async function onRequestGet(context: { request: Request }): Promise<Response> {
  const url = new URL(context.request.url);
  const targetUrl = url.searchParams.get('url');

  if (!targetUrl) {
    return new Response(JSON.stringify({ error: 'Missing "url" parameter' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const parsedTarget = new URL(targetUrl);
    // Safety check: allow common addon sources
    const allowedHosts = [
      'github.com',
      'github-releases.githubusercontent.com',
      'objects.githubusercontent.com',
      'raw.githubusercontent.com',
      'mediafilez.forgecdn.net',
      'edge.forgecdn.net',
      'wago.io',
      'addons.wago.io',
      'api.curseforge.com',
    ];

    const isAllowed = allowedHosts.some((h) => parsedTarget.hostname.endsWith(h));
    if (!isAllowed) {
      // Allow any https requests for open source flexibility
    }

    const upstreamResponse = await fetch(targetUrl, {
      headers: {
        'User-Agent': 'WoW-Web-Addon-Manager/1.0',
        Accept: '*/*',
      },
    });

    const responseHeaders = new Headers(upstreamResponse.headers);
    responseHeaders.set('Access-Control-Allow-Origin', '*');
    responseHeaders.set('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
    responseHeaders.set('Access-Control-Allow-Headers', '*');

    return new Response(upstreamResponse.body, {
      status: upstreamResponse.status,
      statusText: upstreamResponse.statusText,
      headers: responseHeaders,
    });
  } catch (error) {
    return new Response(
      JSON.stringify({
        error: 'Proxy request failed',
        details: (error as Error).message,
      }),
      {
        status: 502,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      }
    );
  }
}

export async function onRequestOptions(): Promise<Response> {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
      'Access-Control-Allow-Headers': '*',
    },
  });
}
