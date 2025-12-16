/* teamcity-proxy.js
 *
 * This is a YouTrack App HTTP handler.
 * It runs on the YouTrack backend (GraalJS sandbox) and can call external services.
 *
 * Frontend usage:
 *   const host = await YTApp.register();
 *   const data = await host.fetchApp('teamcity-proxy/request', { method: 'POST', body: {...} });
 */

const http = require('@jetbrains/youtrack-scripting-api/http');

function normalizeBaseUrl(url) {
  if (!url) return '';
  return url.replace(/\/+$/, '');
}

function buildQueryString(queryObj) {
  if (!queryObj) return '';
  const parts = [];

  Object.keys(queryObj).forEach(key => {
    const value = queryObj[key];
    if (value === undefined || value === null) return;

    // Support arrays: {a:[1,2]} -> a=1&a=2
    if (Array.isArray(value)) {
      value.forEach(v => {
        if (v === undefined || v === null) return;
        parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(v))}`);
      });
      return;
    }

    parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`);
  });

  return parts.length ? `?${parts.join('&')}` : '';
}

function asTeamCityPath(apiPath, query) {
  // apiPath example: "projects"
  // final: "/app/rest/latest/projects?fields=..."
  const API_VER = 'latest';
  const clean = String(apiPath || '').replace(/^\/+/, '');
  const qs = buildQueryString(query);
  return `/app/rest/${API_VER}/${clean}${qs}`;
}

exports.httpHandler = {
  endpoints: [
    {
      scope: 'global',
      method: 'GET',
      path: 'ping',
      permissions: ['READ_USER'],
      handle: function (ctx) {
        ctx.response.json({ ok: true, handler: 'teamcity-proxy' });
      }
    },
    {
      scope: 'global',
      method: 'POST',
      path: 'request',
      permissions: ['READ_USER'],
      handle: function (ctx) {
        const body = ctx.request.json() || {};

        // Required
        const baseUrl = normalizeBaseUrl(body.baseUrl);
        const apiPath = body.apiPath;

        // Optional
        const query = body.query || null;
        const auth = body.auth || null; // "Bearer xxx" OR "Basic yyy" OR raw token (we'll treat as Bearer)

        if (!baseUrl) {
          ctx.response.code = 400;
          ctx.response.json({ error: 'Missing baseUrl' });
          return;
        }
        if (!apiPath) {
          ctx.response.code = 400;
          ctx.response.json({ error: 'Missing apiPath' });
          return;
        }

        const tcPath = asTeamCityPath(apiPath, query);

        try {
          const connection = new http.Connection(baseUrl);
          connection.addHeader('Accept', 'application/json');
          connection.addHeader('Content-Type', 'application/json');

          if (auth) {
            const authValue = String(auth);
            const headerValue =
              authValue.startsWith('Bearer ') || authValue.startsWith('Basic ')
                ? authValue
                : `Bearer ${authValue}`;

            connection.addHeader('Authorization', headerValue);
          }

          const resp = connection.getSync(tcPath);

          // Bubble TeamCity status codes up to the widget
          if (!resp) {
            ctx.response.code = 502;
            ctx.response.json({ error: 'No response from TeamCity' });
            return;
          }

          ctx.response.code = resp.code || 200;

          // Attempt JSON parse, otherwise return text
          const raw = resp.response;
          try {
            ctx.response.json(raw ? JSON.parse(raw) : null);
          } catch (e) {
            ctx.response.text(raw || '');
          }
        } catch (e) {
          ctx.response.code = 502;
          ctx.response.json({
            error: 'TeamCity proxy request failed',
            message: e && (e.message || e.toString())
          });
        }
      }
    }
  ]
};
