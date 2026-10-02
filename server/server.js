'use strict';
// 汉学课堂 — static file server + JSON API (auth, per-user progress, admin).
// Run: node server/server.js   (or  start-app.cmd)
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const cfg = require('./config');
const db = require('./lib/db');
const auth = require('./lib/auth');
const api = require('./lib/api');

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.webp': 'image/webp',
  '.ico': 'image/x-icon', '.pdf': 'application/pdf', '.mp3': 'audio/mpeg', '.m4a': 'audio/mp4', '.wav': 'audio/wav',
  '.ogg': 'audio/ogg', '.aac': 'audio/aac', '.flac': 'audio/flac', '.txt': 'text/plain; charset=utf-8',
  '.woff2': 'font/woff2', '.woff': 'font/woff', '.ttf': 'font/ttf',
};
const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'SAMEORIGIN',
  'Referrer-Policy': 'same-origin',
  'Content-Security-Policy': "default-src 'self'; img-src 'self' data:; media-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self'; object-src 'self'",
};

// ── rate limiting ──
const hits = new Map();
function rateLimit(key, max, windowMs) {
  const now = Date.now();
  let a = hits.get(key);
  if (!a || now > a.reset) { a = { n: 0, reset: now + windowMs }; hits.set(key, a); }
  a.n++;
  return a.n > max;
}

function parseCookies(header) {
  const out = {};
  if (!header) return out;
  header.split(';').forEach((p) => {
    const i = p.indexOf('=');
    if (i > 0) { const k = p.slice(0, i).trim(); const v = p.slice(i + 1).trim(); try { out[k] = decodeURIComponent(v); } catch (e) { out[k] = v; } }
  });
  return out;
}
function sameOrigin(req) {
  const o = req.headers.origin;
  if (!o) return true; // non-browser / same-origin navigations
  try { return new URL(o).host === req.headers.host; } catch (e) { return false; }
}
function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0; const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > cfg.MAX_BODY) { reject(Object.assign(new Error('too_large'), { code: 'TOO_LARGE' })); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => {
      const buf = Buffer.concat(chunks);
      if (!buf.length) return resolve({});
      try { resolve(JSON.parse(buf.toString('utf8'))); } catch (e) { reject(Object.assign(new Error('bad_json'), { code: 'BAD_JSON' })); }
    });
    req.on('error', reject);
  });
}

// ── static ──
function safePath(urlPath) {
  let p = decodeURIComponent(urlPath.split('?')[0]);
  if (p === '/' || p === '') p = '/index.html';
  const rel = path.normalize(p).replace(/^([/\\])+/, '');
  if (rel.startsWith('..') || path.isAbsolute(rel)) return null;
  const first = rel.split(/[/\\]/)[0];
  if (cfg.BLOCKED_DIRS.includes(first)) return null;
  if (rel.split(/[/\\]/).some((seg) => seg.startsWith('.'))) return null;
  const abs = path.join(cfg.ROOT, rel);
  if (!abs.startsWith(cfg.ROOT)) return null;
  return abs;
}
function serveStatic(req, res, urlPath) {
  const abs = safePath(urlPath);
  if (!abs) { res.writeHead(404, SECURITY_HEADERS); return res.end('Not found'); }
  let stat; try { stat = fs.statSync(abs); } catch (e) { res.writeHead(404, SECURITY_HEADERS); return res.end('Not found'); }
  if (stat.isDirectory()) return serveStatic(req, res, path.posix.join(urlPath, 'index.html'));
  const ext = path.extname(abs).toLowerCase();
  const headers = Object.assign({}, SECURITY_HEADERS, {
    'Content-Type': MIME[ext] || 'application/octet-stream',
    'Accept-Ranges': 'bytes',
    'Cache-Control': (ext === '.html' || ext === '.js' || ext === '.css') ? 'no-cache' : 'public, max-age=86400',
  });
  const range = req.headers.range;
  if (range) {
    const m = /bytes=(\d*)-(\d*)/.exec(range);
    if (m) {
      let start = m[1] ? parseInt(m[1], 10) : 0;
      let end = m[2] ? parseInt(m[2], 10) : stat.size - 1;
      if (isNaN(start)) start = 0;
      if (isNaN(end)) end = stat.size - 1;
      if (start > end || start >= stat.size) { res.writeHead(416, Object.assign({ 'Content-Range': 'bytes */' + stat.size }, SECURITY_HEADERS)); return res.end(); }
      end = Math.min(end, stat.size - 1);
      headers['Content-Range'] = 'bytes ' + start + '-' + end + '/' + stat.size;
      headers['Content-Length'] = end - start + 1;
      res.writeHead(206, headers);
      fs.createReadStream(abs, { start, end }).on('error', () => res.end()).pipe(res);
      return;
    }
  }
  headers['Content-Length'] = stat.size;
  if (req.method === 'HEAD') { res.writeHead(200, headers); return res.end(); }
  res.writeHead(200, headers);
  fs.createReadStream(abs).on('error', () => res.end()).pipe(res);
}

// ── routing ──
const AUTH_REQUIRED = new Set(['me', 'getProgress', 'putProgress', 'postActivity', 'changePassword', 'getSettings', 'putSettings', 'createPost', 'likePost', 'commentPost', 'deletePost', 'reportPost', 'adminUsers', 'adminUser', 'adminSessions', 'adminStats', 'adminUserAction', 'adminModeration', 'adminComments', 'adminDeleteComment', 'adminTranslationStats', 'adminTranslationSearch', 'adminTranslationSave']);

async function handleApi(req, res, url) {
  const p = url.pathname;
  const method = req.method.toUpperCase();
  const cookies = parseCookies(req.headers.cookie);
  let user = null;
  // Session token may arrive as the HttpOnly cookie or as a persistent-login header
  // (fallback for browsers that evict cookies before the 3-year session ends).
  const token = cookies.hanxue_sid || (req.headers['x-hanxue-token'] && String(req.headers['x-hanxue-token']).slice(0, 128)) || null;
  const sess = auth.getSession(token);
  if (sess) user = db.findUserById(sess.userId);

  const ctx = {
    req, res, url, method, body: {}, params: {}, query: url.searchParams, user, sessionToken: token, limits: cfg,
    setSession(t) { res.setHeader('Set-Cookie', 'hanxue_sid=' + t + '; HttpOnly; Path=/; SameSite=Lax; Max-Age=' + cfg.COOKIE_MAX_AGE); },
    clearSession() { res.setHeader('Set-Cookie', 'hanxue_sid=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0'); },
    rateLimit(k, max, win) { return rateLimit((req.socket.remoteAddress || '') + '|' + k, max, win); },
  };

  // read JSON body for mutating requests
  if (method === 'POST' || method === 'PUT' || method === 'PATCH') {
    if (!sameOrigin(req)) return void api.fail(res, 403, 'BAD_ORIGIN', 'Cross-origin request blocked');
    try { ctx.body = await readBody(req); }
    catch (e) { return void api.fail(res, e.code === 'TOO_LARGE' ? 413 : 400, 'BAD_REQUEST', 'Invalid request body'); }
  }

  let route = null;
  if (p === '/api/register' && method === 'POST') route = 'register';
  else if (p === '/api/login' && method === 'POST') route = 'login';
  else if (p === '/api/logout' && method === 'POST') route = 'logout';
  else if (p === '/api/me' && method === 'GET') route = 'me';
  else if (p === '/api/progress' && method === 'GET') route = 'getProgress';
  else if (p === '/api/progress' && method === 'PUT') route = 'putProgress';
  else if (p === '/api/activity' && method === 'POST') route = 'postActivity';
  else if (p === '/api/change-password' && method === 'POST') route = 'changePassword';
  else if (p === '/api/settings' && method === 'GET') route = 'getSettings';
  else if (p === '/api/settings' && method === 'PUT') route = 'putSettings';
  else if (p === '/api/posts' && method === 'GET') route = 'listPosts';
  else if (p === '/api/posts' && method === 'POST') route = 'createPost';
  else if (p === '/api/admin/users' && method === 'GET') route = 'adminUsers';
  else if (p === '/api/admin/sessions' && method === 'GET') route = 'adminSessions';
  else if (p === '/api/admin/stats' && method === 'GET') route = 'adminStats';
  else if (p === '/api/admin/moderation' && method === 'GET') route = 'adminModeration';
  else if (p === '/api/admin/comments' && method === 'GET') route = 'adminComments';
  else if (p === '/api/translations' && method === 'GET') route = 'publicTranslations';
  else if (p === '/api/admin/translations/stats' && method === 'GET') route = 'adminTranslationStats';
  else if (p === '/api/admin/translations' && method === 'GET') route = 'adminTranslationSearch';
  else if (p === '/api/admin/translations' && method === 'POST') route = 'adminTranslationSave';
  else {
    let pm = /^\/api\/posts\/([a-f0-9]{1,32})$/.exec(p);
    if (pm && method === 'GET') { route = 'getPost'; ctx.params.id = pm[1]; }
    else if (pm && method === 'DELETE') { route = 'deletePost'; ctx.params.id = pm[1]; }
    else if ((pm = /^\/api\/posts\/([a-f0-9]{1,32})\/like$/.exec(p)) && method === 'POST') { route = 'likePost'; ctx.params.id = pm[1]; }
    else if ((pm = /^\/api\/posts\/([a-f0-9]{1,32})\/comments$/.exec(p)) && method === 'POST') { route = 'commentPost'; ctx.params.id = pm[1]; }
    else if ((pm = /^\/api\/posts\/([a-f0-9]{1,32})\/report$/.exec(p)) && method === 'POST') { route = 'reportPost'; ctx.params.id = pm[1]; }
    else {
      const m = /^\/api\/admin\/users\/([A-Za-z0-9-]{1,64})$/.exec(p);
      if (m && method === 'GET') { route = 'adminUser'; ctx.params.id = m[1]; }
      else if (m && method === 'POST') { route = 'adminUserAction'; ctx.params.id = m[1]; }
      else {
        const mc = /^\/api\/admin\/posts\/([a-f0-9]{1,32})\/comments\/([a-f0-9]{1,32})$/.exec(p);
        if (mc && method === 'DELETE') { route = 'adminDeleteComment'; ctx.params.id = mc[1]; ctx.params.cid = mc[2]; }
      }
    }
  }

  if (!route) return void api.fail(res, 404, 'NO_ROUTE', 'Unknown endpoint');
  if (AUTH_REQUIRED.has(route) && !user) return void api.fail(res, 401, 'UNAUTHENTICATED', 'Please sign in');
  // Slide the session cookie forward on every authenticated request.
  if (sess && user) ctx.setSession(token);
  try { api[route](ctx); }
  catch (e) { console.error('[api] error', route, e && e.message); api.fail(res, 500, 'SERVER_ERROR', 'Something went wrong'); }
}

const server = http.createServer((req, res) => {
  let url; try { url = new URL(req.url, 'http://' + (req.headers.host || 'localhost')); } catch (e) { res.writeHead(400); return res.end('Bad request'); }
  if (url.pathname.startsWith('/api/')) return void handleApi(req, res, url);
  if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405, SECURITY_HEADERS); return res.end('Method not allowed'); }
  serveStatic(req, res, url.pathname);
});

function seedAdmin() {
  if (db.state.users.some((u) => u.role === 'admin')) return;
  const username = cfg.ADMIN_USERNAME;
  let password = cfg.ADMIN_PASSWORD;
  const generated = !password;
  if (!password) password = crypto.randomBytes(12).toString('base64url');
  const u = db.createUser({ username, displayName: 'Administrator', role: 'admin' });
  auth.setPassword(u, password);
  db.saveUsers();
  if (generated) {
    try {
      db.ensureDir();
      fs.writeFileSync(path.join(cfg.DATA_DIR, 'ADMIN_PASSWORD.txt'),
        'username: ' + username + '\npassword: ' + password + '\nGenerated: ' + new Date().toISOString() +
        '\n\nSign in, change this password in Settings, then delete this file.\n');
    } catch (e) {}
    console.log('\n=== Admin account created ===');
    console.log('  username: ' + username);
    console.log('  password: ' + password);
    console.log('  (also saved to ' + path.join(cfg.DATA_DIR, 'ADMIN_PASSWORD.txt') + ')');
    console.log('  Change it after first sign-in, then delete that file.\n');
  } else {
    console.log('Admin account seeded from HANXUE_ADMIN_PASSWORD (username: ' + username + ').');
  }
}

db.load();
seedAdmin();
server.listen(cfg.PORT, cfg.HOST, () => {
  console.log('汉学课堂 server -> http://' + cfg.HOST + ':' + cfg.PORT + '/');
  console.log('Data dir: ' + cfg.DATA_DIR);
});
