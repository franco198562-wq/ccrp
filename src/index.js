// Cloudflare Worker: serves the dashboard (static files) + /api/content API

const KEY = 'ccrp-embed-content';

const EMPTY = {
  version: 1,
  updatedAt: null,
  images: {},
  ourad: { text: '' },
  affiliates: {
    disclaimer:
      'Affiliations are handpicked by the Directive Board. Please refrain from opening a ticket to request for one, as it would be automatically denied.',
    entries: [],
  },
  templates: { accept: '', deny: '', partnership: '' },
};

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, PUT, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Content-Type': 'application/json',
  };
}

function checkAuth(request, env) {
  const secret = env.EMBED_API_SECRET;
  if (!secret) return false;
  const header = request.headers.get('Authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : header;
  return Boolean(token && token === secret);
}

async function handleApi(request, env) {
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders() });
  }

  if (!checkAuth(request, env)) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: corsHeaders(),
    });
  }

  if (!env.EMBED_KV) {
    return new Response(JSON.stringify({ error: 'EMBED_KV not bound' }), {
      status: 500,
      headers: corsHeaders(),
    });
  }

  if (request.method === 'GET') {
    const raw = await env.EMBED_KV.get(KEY);
    const content = raw ? JSON.parse(raw) : EMPTY;
    return new Response(JSON.stringify(content), { headers: corsHeaders() });
  }

  if (request.method === 'PUT') {
    let body;
    try {
      body = await request.json();
    } catch {
      return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
        status: 400,
        headers: corsHeaders(),
      });
    }
    const content = {
      ...EMPTY,
      ...body,
      version: 1,
      updatedAt: new Date().toISOString(),
    };
    await env.EMBED_KV.put(KEY, JSON.stringify(content));
    return new Response(JSON.stringify(content), { headers: corsHeaders() });
  }

  return new Response(JSON.stringify({ error: 'Method not allowed' }), {
    status: 405,
    headers: corsHeaders(),
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // API routes
    if (url.pathname === '/api/content' || url.pathname === '/api/content/') {
      return handleApi(request, env);
    }

    // Everything else → static files from /public
    if (env.ASSETS) {
      return env.ASSETS.fetch(request);
    }

    return new Response('Not found', { status: 404 });
  },
};
