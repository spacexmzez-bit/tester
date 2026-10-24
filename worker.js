/**
 * Google Play 12-Tester & Peer App Testing Sync - Cloudflare Worker
 * Lightweight JSON sync engine with KV backing and CORS support.
 * Syncs:
 *  - apps (My Apps 12-tester tracker)
 *  - peerApps (Testing Others' Apps - Mazen & Marwan)
 *  - archivedApps (Completed apps archive)
 *  - trashedApps (Trash bin with 14-day test period auto-expiry)
 *  - categories (Custom app categories)
 */

const memoryStore = new Map();

function corsHeaders(request) {
  const origin = request.headers.get('Origin') || '*';
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, x-sync-key, Authorization',
    'Access-Control-Max-Age': '86400',
  };
}

function jsonResponse(data, status = 200, request = null) {
  const headers = {
    'Content-Type': 'application/json',
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

    // Health check endpoint
    if (url.pathname === '/' || url.pathname === '/api/health') {
      return jsonResponse({
        status: 'ok',
        service: 'Google Play 12-Tester & Peer Testing Sync Worker',
        version: '2.0.0',
        kvBound: !!env.PLAY_TESTER_KV,
        timestamp: new Date().toISOString(),
      }, 200, request);
    }

    // Sync API endpoints
    if (url.pathname === '/api/sync') {
      const syncKey = request.headers.get('x-sync-key') || url.searchParams.get('key');
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
              data: null,
              message: 'No data found for this sync key. Ready to receive initial push.',
            }, 200, request);
          }

          return jsonResponse({
            success: true,
            exists: true,
            data: stored,
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
          const payload = await request.json();

          if (!payload || typeof payload !== 'object') {
            return jsonResponse({
              success: false,
              error: 'Invalid payload. Expected JSON object.',
            }, 400, request);
          }

          // Fetch existing data to safely merge partial updates
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
            clientVersion: payload.clientVersion || '2.0',
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
            message: 'Sync data saved successfully',
            updatedAt: dataToSave.updatedAt,
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
