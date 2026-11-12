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

function unauthorized() {
  return new Response(JSON.stringify({ error: 'Unauthorized' }), {
    status: 401,
    headers: corsHeaders(),
  });
}

function checkAuth(request, env) {
  const secret = env.EMBED_API_SECRET;
  if (!secret) return false;
  const header = request.headers.get('Authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : header;
  return token && token === secret;
}

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: corsHeaders() });
}

export async function onRequestGet(context) {
  const { request, env } = context;
  if (!checkAuth(request, env)) return unauthorized();
  if (!env.EMBED_KV) {
    return new Response(JSON.stringify({ error: 'EMBED_KV not bound' }), {
      status: 500,
      headers: corsHeaders(),
    });
  }
  const raw = await env.EMBED_KV.get(KEY);
  const content = raw ? JSON.parse(raw) : EMPTY;
  return new Response(JSON.stringify(content), { headers: corsHeaders() });
}

export async function onRequestPut(context) {
  const { request, env } = context;
  if (!checkAuth(request, env)) return unauthorized();
  if (!env.EMBED_KV) {
    return new Response(JSON.stringify({ error: 'EMBED_KV not bound' }), {
      status: 500,
      headers: corsHeaders(),
    });
  }
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
