/**
 * Google Play 12-Tester & Peer App Testing Sync - Cloudflare Worker (v2.1)
 * Supports both root (/) and (/api/sync) endpoints for seamless compatibility,
 * and returns both wrapped { success, exists, kvBound, data } and top-level
 * fields so any client version can read and write without data loss.
 */

const memoryStore = new Map();

function corsHeaders(request) {
  const origin = request.headers.get('Origin') || '*';
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, x-sync-key, X-Sync-Key, Authorization',
    'Access-Control-Max-Age': '86400',
  };
}

function jsonResponse(data, status = 200, request = null) {
  const headers = {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store, no-cache, must-revalidate',
    ...(request ? corsHeaders(request) : { 'Access-Control-Allow-Origin': '*' }),
  };
  return new Response(JSON.stringify(data, null, 2), { status, headers });
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: corsHeaders(request),
      });
    }

    const syncKey =
      request.headers.get('x-sync-key') ||
      request.headers.get('X-Sync-Key') ||
      url.searchParams.get('key');

    // Dedicated health endpoint (or GET / without a sync key)
    if (url.pathname === '/api/health' || (url.pathname === '/' && request.method === 'GET' && !syncKey)) {
      return jsonResponse({
        status: 'ok',
        service: 'Google Play 12-Tester & Peer Testing Sync Worker',
        version: '2.1.0',
        kvBound: !!env.PLAY_TESTER_KV,
        timestamp: new Date().toISOString(),
      }, 200, request);
    }

    // Accept sync requests on BOTH '/api/sync' AND '/' (in case user enters root Worker URL)
    if (url.pathname === '/api/sync' || url.pathname === '/') {
      if (!syncKey || syncKey.trim().length === 0) {
        return jsonResponse({
          success: false,
          error: 'Missing sync key. Provide via x-sync-key header or ?key= query parameter.',
        }, 400, request);
      }

      const storageKey = `sync:${syncKey.trim()}`;

      // GET: Retrieve user data
      if (request.method === 'GET') {
        try {
          let stored = null;
          if (env.PLAY_TESTER_KV) {
            stored = await env.PLAY_TESTER_KV.get(storageKey, { type: 'json' });
          } else {
            stored = memoryStore.get(storageKey) || null;
          }

          if (!stored) {
            return jsonResponse({
              success: true,
              exists: false,
              kvBound: !!env.PLAY_TESTER_KV,
              data: null,
              message: 'No data found for this sync key. Ready to receive initial push.',
            }, 200, request);
          }

          return jsonResponse({
            success: true,
            exists: true,
            kvBound: !!env.PLAY_TESTER_KV,
            data: stored,
            // Also expose top-level keys for backwards/forwards compatibility
            apps: stored.apps || [],
            peerApps: stored.peerApps || [],
            archivedApps: stored.archivedApps || [],
            trashedApps: stored.trashedApps || [],
            categories: stored.categories || [],
            updatedAt: stored.updatedAt || null,
            retrievedAt: new Date().toISOString(),
          }, 200, request);
        } catch (err) {
          return jsonResponse({
            success: false,
            error: `Failed to read sync data: ${err.message}`,
          }, 500, request);
        }
      }

      // POST: Save user data
      if (request.method === 'POST') {
        try {
          const rawBody = await request.json();
          const payload = (rawBody && rawBody.data && typeof rawBody.data === 'object') ? rawBody.data : rawBody;

          if (!payload || typeof payload !== 'object') {
            return jsonResponse({
              success: false,
              error: 'Invalid payload. Expected JSON object.',
            }, 400, request);
          }

          let existingData = null;
          if (env.PLAY_TESTER_KV) {
            existingData = await env.PLAY_TESTER_KV.get(storageKey, { type: 'json' });
          } else {
            existingData = memoryStore.get(storageKey) || null;
          }

          const dataToSave = {
            apps: Array.isArray(payload.apps)
              ? payload.apps
              : (existingData?.apps || []),
            peerApps: Array.isArray(payload.peerApps)
              ? payload.peerApps
              : (existingData?.peerApps || []),
            archivedApps: Array.isArray(payload.archivedApps)
              ? payload.archivedApps
              : (existingData?.archivedApps || []),
            trashedApps: Array.isArray(payload.trashedApps)
              ? payload.trashedApps
              : (existingData?.trashedApps || []),
            categories: Array.isArray(payload.categories)
              ? payload.categories
              : (existingData?.categories || []),
            updatedAt: payload.updatedAt || new Date().toISOString(),
            clientVersion: '2.1',
          };

          const serialized = JSON.stringify(dataToSave);
          if (serialized.length > 5 * 1024 * 1024) {
            return jsonResponse({
              success: false,
              error: 'Payload exceeds 5MB limit.',
            }, 413, request);
          }

          if (env.PLAY_TESTER_KV) {
            await env.PLAY_TESTER_KV.put(storageKey, serialized);
          } else {
            memoryStore.set(storageKey, dataToSave);
          }

          return jsonResponse({
            success: true,
            kvBound: !!env.PLAY_TESTER_KV,
            message: 'Sync data saved successfully',
            updatedAt: dataToSave.updatedAt,
            data: dataToSave,
            counts: {
              apps: dataToSave.apps.length,
              peerApps: dataToSave.peerApps.length,
              archivedApps: dataToSave.archivedApps.length,
              trashedApps: dataToSave.trashedApps.length,
            },
          }, 200, request);
        } catch (err) {
          return jsonResponse({
            success: false,
            error: `Failed to store sync data: ${err.message}`,
          }, 500, request);
        }
      }

      return jsonResponse({ success: false, error: 'Method not allowed' }, 405, request);
    }

    return jsonResponse({ success: false, error: 'Not Found' }, 404, request);
  },
};
