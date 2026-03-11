// Cloudflare Worker — Notion API CORS Proxy
// Deploy: wrangler deploy docs/cloudflare-notion-proxy.js --name notion-proxy
//
// Usage: set the deployed Worker URL as "Notion Proxy URL" in Settings.

export default {
  async fetch(request) {
    const url = new URL(request.url);

    // Preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: corsHeaders(request),
      });
    }

    // Forward to Notion API
    const notionUrl = 'https://api.notion.com' + url.pathname + url.search;
    const headers = new Headers(request.headers);
    headers.delete('host');

    const res = await fetch(notionUrl, {
      method: request.method,
      headers,
      body: request.method !== 'GET' ? request.body : undefined,
    });

    const response = new Response(res.body, {
      status: res.status,
      statusText: res.statusText,
      headers: res.headers,
    });

    // Add CORS headers
    for (const [k, v] of Object.entries(corsHeaders(request))) {
      response.headers.set(k, v);
    }
    return response;
  },
};

function corsHeaders(request) {
  return {
    'Access-Control-Allow-Origin': request.headers.get('Origin') || '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type, Notion-Version',
    'Access-Control-Max-Age': '86400',
  };
}
