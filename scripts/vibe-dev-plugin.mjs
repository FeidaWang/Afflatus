import { createHandler } from '../src/lib/vibeBridgeProxy.mjs';

const loopback = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1', 'localhost', '[::1]']);

/** Loopback-only local BFF. All auth/DTO/quotas run through the real handler.
 * No secret is sent to the browser. This plugin is never part of a deploy.
 */
export function vibeDevPlugin(env = process.env) {
  const calls = [];
  const handlers = { '/api/vibe-market': createHandler({ env, calls }), '/api/vibe-research': createHandler({ env, research: true, calls }) };
  function mount(server) {
    server.middlewares.use(async (req, res, next) => {
      const handler = handlers[req.url?.split('?')[0]];
      if (!handler) return next();
      const fail = code => {
        res.statusCode = 403;
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Cache-Control', 'private, no-store');
        res.end(JSON.stringify({ error: { code } }));
      };
      let url;
      try {
        url = new URL(req.url, `http://${req.headers.host}`);
        if (!loopback.has(url.hostname) || !loopback.has(req.socket.remoteAddress)) return fail('LOCAL_ONLY');
        if (req.headers.origin && req.headers.origin !== url.origin) return fail('ORIGIN_REJECTED');
        if (req.headers['sec-fetch-site'] && !['same-origin', 'none'].includes(req.headers['sec-fetch-site'])) return fail('ORIGIN_REJECTED');
      } catch { return fail('LOCAL_ONLY'); }
      const query = {};
      for (const [key, value] of url.searchParams) {
        if (Object.hasOwn(query, key)) query[key] = [].concat(query[key], value);
        else Object.defineProperty(query, key, { value, enumerable: true, writable: true });
      }
      // Explicit local operator opt-in; shared quota key is server-side only.
      const headers = { ...req.headers };
      if (env.VIBE_LOCAL_RESEARCH === 'true' && env.NODE_ENV !== 'production') headers['x-arena-key'] = env.ARENA_ADMIN_KEY;
      await handler({ method: req.method, query, headers }, {
        setHeader: (key, value) => res.setHeader(key, value),
        status(status) { res.statusCode = status; return this; },
        json(value) { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(value)); },
      });
    });
  }
  return { name: 'vibe-local-bff', configureServer: mount, configurePreviewServer: mount };
}
