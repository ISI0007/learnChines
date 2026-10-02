// 汉学课堂 — Phase 5/6 smoke test: community posts API (self-contained, no AI).
//   node tools/verify-phase56.mjs   (server must be running on 127.0.0.1:8091)
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const BASE = process.env.HX_BASE || 'http://127.0.0.1:8091';
const DATA = path.join(process.cwd(), 'server', 'data');
const probe = 'p56_probe_' + crypto.randomBytes(3).toString('hex');
const PW = 'hx-probe-' + crypto.randomBytes(6).toString('hex');

let passed = 0, fail = 0;
const ok = (n) => { passed++; console.log('  \u2713 ' + n); };
const bad = (n, d) => { fail++; console.log('  \u2717 ' + n + (d ? '  -> ' + d : '')); };

async function req(method, p, body, token) {
  const headers = {};
  if (body) headers['Content-Type'] = 'application/json';
  if (token) headers['X-Hanxue-Token'] = token;
  const r = await fetch(BASE + p, { method, headers, body: body ? JSON.stringify(body) : undefined });
  let j = {}; try { j = await r.json(); } catch (e) {}
  return { status: r.status, ok: r.ok, j };
}

// ── 1. no AI / offline study surface ──
console.log('\n[1] offline study surface');
const offline = [
  ['js/providers.js', (s) => !/[\u4e00-\u9fff]?AI provider/i.test(s) && !/MockAIProvider/.test(s)],
  ['index.html', (s) => !/js\/tutor\.js/.test(s) && !/ai-tutor/.test(s)],
  ['js/app.js', (s) => !/aiTutor|ai-tutor/.test(s)],
  ['js/views4.js', (s) => !/Tutor\.answer|window\.Tutor/.test(s)],
];
for (const [f, check] of offline) {
  const s = fs.readFileSync(path.join(process.cwd(), f), 'utf8');
  check(s) ? ok('no AI references in ' + f) : bad('AI reference still in ' + f);
}
(fs.existsSync(path.join(process.cwd(), 'js', 'tutor.js'))) ? bad('js/tutor.js still exists') : ok('js/tutor.js removed');

// ── 2. community guards ──
console.log('\n[2] community guards');
const pub = await req('GET', '/api/posts');
(pub.ok && pub.j.success && Array.isArray(pub.j.data.posts)) ? ok('GET /api/posts public') : bad('posts list', pub.status);
const noAuth = await req('POST', '/api/posts', { title: 'Hello there', body: 'body' });
(noAuth.status === 401) ? ok('401 creating post while signed out') : bad('post guard', noAuth.status);

// ── 3. full community flow ──
console.log('\n[3] community flow');
const reg = await req('POST', '/api/register', { username: probe, password: PW, displayName: 'Probe' });
if (!(reg.j && reg.j.data && reg.j.data.token)) { bad('register probe', JSON.stringify(reg.j)); }
const token = reg.j && reg.j.data ? reg.j.data.token : null;
const uid = reg.j && reg.j.data && reg.j.data.user ? reg.j.data.user.id : null;

let postId = null;
if (token) {
  const c = await req('POST', '/api/posts', { title: 'How to use 了?', body: 'Looking for examples.', tag: 'grammar' }, token);
  (c.status === 201 && c.j.data.post.id) ? ok('created post') : bad('create post', JSON.stringify(c.j));
  postId = c.j.data && c.j.data.post && c.j.data.post.id;

  const short = await req('POST', '/api/posts', { title: 'ab', body: 'x' }, token);
  (short.status === 400) ? ok('rejects short title') : bad('short title', short.status);

  const list = await req('GET', '/api/posts?sort=new');
  (list.ok && list.j.data.posts.some((p) => p.id === postId)) ? ok('post appears in feed') : bad('feed');

  const l1 = await req('POST', '/api/posts/' + postId + '/like', null, token);
  (l1.ok && l1.j.data.likes === 1 && l1.j.data.liked) ? ok('like toggles on (1)') : bad('like on', JSON.stringify(l1.j));
  const l2 = await req('POST', '/api/posts/' + postId + '/like', null, token);
  (l2.ok && l2.j.data.likes === 0 && !l2.j.data.liked) ? ok('like toggles off (0)') : bad('like off', JSON.stringify(l2.j));

  const cm = await req('POST', '/api/posts/' + postId + '/comments', { body: 'Great question!' }, token);
  (cm.ok && cm.j.data.comment.body === 'Great question!') ? ok('added comment') : bad('comment', JSON.stringify(cm.j));

  const one = await req('GET', '/api/posts/' + postId);
  (one.ok && one.j.data.post.comments.length === 1) ? ok('post detail returns 1 comment') : bad('detail', JSON.stringify(one.j));

  const del = await req('DELETE', '/api/posts/' + postId, null, token);
  (del.ok) ? ok('author can delete own post') : bad('delete', del.status);
  const gone = await req('GET', '/api/posts/' + postId);
  (gone.status === 404) ? ok('deleted post 404s') : bad('deleted still there', gone.status);
} else { bad('no token — skipping authed community tests'); }

// ── 4. admin sessions endpoint ──
console.log('\n[4] admin');
const adm = await req('GET', '/api/admin/sessions');
(adm.status === 401) ? ok('401 admin sessions unauthenticated') : bad('admin guard', adm.status);

// ── cleanup ──
console.log('\n[5] cleanup');
try {
  const uf = path.join(DATA, 'users.json');
  const ud = JSON.parse(fs.readFileSync(uf, 'utf8'));
  const before = ud.users.length;
  ud.users = ud.users.filter((u) => u.username !== probe);
  fs.writeFileSync(uf, JSON.stringify(ud, null, 2));
  ok('removed probe user (' + before + ' -> ' + ud.users.length + ')');
  const sf = path.join(DATA, 'sessions.json');
  if (fs.existsSync(sf)) {
    const sd = JSON.parse(fs.readFileSync(sf, 'utf8'));
    let n = 0;
    for (const k of Object.keys(sd.sessions || {})) { if (sd.sessions[k] && sd.sessions[k].userId === uid) { delete sd.sessions[k]; n++; } }
    fs.writeFileSync(sf, JSON.stringify(sd, null, 2));
    ok('removed ' + n + ' probe session(s)');
  }
  console.log('  (restart the server so memory reloads the cleaned store)');
} catch (e) { bad('cleanup', e.message); }

console.log('\n' + (fail ? '\u2717 FAIL' : '\u2713 PASS') + '  ' + passed + ' passed, ' + fail + ' failed\n');
await new Promise((r) => setTimeout(r, 200));
process.exit(fail ? 1 : 0);
