// 汉学课堂 — Phase 11 admin CMS smoke test.
//   node tools/verify-admin.mjs   (server must be running on 127.0.0.1:8091)
// Reads the admin password from HX_ADMIN_PASSWORD or server/data/ADMIN_PASSWORD.txt.
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const BASE = process.env.HX_BASE || 'http://127.0.0.1:8091';
const probe = crypto.randomBytes(3).toString('hex');
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
  return { status: r.status, ok: r.ok, success: !!(j && j.success), data: j && j.data, error: j && j.error };
}

async function makeUser(name) {
  const r = await req('POST', '/api/register', { username: name, password: PW, displayName: name });
  return (r.ok && r.success) ? r.data.token : null;
}

// ── admin credential ──
let adminPw = process.env.HX_ADMIN_PASSWORD || '';
if (!adminPw) {
  try {
    const txt = fs.readFileSync(path.join(process.cwd(), 'server', 'data', 'ADMIN_PASSWORD.txt'), 'utf8');
    const m = /password:\s*(\S+)/.exec(txt);
    if (m) adminPw = m[1];
  } catch (e) {}
}
const adminLogin = adminPw ? await req('POST', '/api/login', { username: 'admin', password: adminPw }) : { status: 0 };
const adminTok = (adminLogin.status === 200 && adminLogin.data && adminLogin.data.token) || null;
console.log(adminTok ? 'Authenticated as admin.' : 'WARNING: no admin token (skipping positive admin checks).');

// ── 1. access control ──
console.log('\n[1] access control');
const anon = await req('GET', '/api/admin/stats');
anon.status === 401 ? ok('anonymous /admin/stats -> 401') : bad('anon stats', anon.status);
const learnerTok = await makeUser('adm_probe_' + probe);
learnerTok ? ok('created probe learner') : bad('could not create probe learner');
const lStats = await req('GET', '/api/admin/stats', null, learnerTok);
lStats.status === 403 ? ok('learner /admin/stats -> 403') : bad('learner stats', lStats.status);
const lMod = await req('GET', '/api/admin/moderation', null, learnerTok);
lMod.status === 403 ? ok('learner /admin/moderation -> 403') : bad('learner moderation', lMod.status);
const lComments = await req('GET', '/api/admin/comments', null, learnerTok);
lComments.status === 403 ? ok('learner /admin/comments -> 403') : bad('learner comments', lComments.status);

if (adminTok) {
  // ── 2. analytics ──
  console.log('\n[2] analytics');
  const st = await req('GET', '/api/admin/stats', null, adminTok);
  const d = st.data || {};
  (st.ok && d.users && typeof d.users.total === 'number') ? ok('stats: users summary') : bad('stats users', JSON.stringify(d.users));
  (st.ok && d.content && d.content.vocabulary > 0 && d.content.books > 0 && d.content.exams > 0) ? ok('stats: content inventory (' + d.content.vocabulary + ' words, ' + d.content.books + ' books, ' + d.content.exams + ' exams)') : bad('stats content');
  (st.ok && d.engagement && typeof d.engagement.xp === 'number') ? ok('stats: engagement totals') : bad('stats engagement');
  (st.ok && Array.isArray(d.last7) && d.last7.length === 7) ? ok('stats: 7-day activity series') : bad('stats last7');
  (st.ok && d.byLevel && typeof d.byLevel === 'object') ? ok('stats: words-known by level') : bad('stats byLevel');
  (st.ok && d.sessions && typeof d.sessions.active === 'number') ? ok('stats: session counts') : bad('stats sessions');

  // ── 3. user management ──
  console.log('\n[3] user management');
  const uName = 'adm_probe2_' + probe;
  const uTok = await makeUser(uName);
  const list = await req('GET', '/api/admin/users', null, adminTok);
  const users = (list.data && list.data.users) || [];
  const target = users.find((u) => u.username === uName);
  target ? ok('new user appears in list') : bad('new user missing from list');
  if (target) {
    const act = async (action) => req('POST', '/api/admin/users/' + target.id, { action }, adminTok);
    const suspend = await act('suspend');
    (suspend.ok && suspend.data.suspended) ? ok('suspend user') : bad('suspend', JSON.stringify(suspend.error));
    const blocked = await req('POST', '/api/login', { username: uName, password: PW });
    (blocked.status === 403 && blocked.error && blocked.error.code === 'ACCOUNT_SUSPENDED') ? ok('suspended login blocked (403 ACCOUNT_SUSPENDED)') : bad('suspended login', blocked.status + ' ' + JSON.stringify(blocked.error));
    const restore = await act('restore');
    (restore.ok && restore.data.suspended === false) ? ok('restore user') : bad('restore');
    const allowed = await req('POST', '/api/login', { username: uName, password: PW });
    allowed.status === 200 ? ok('restored login works') : bad('restored login', allowed.status);
    const madeAdmin = await act('makeAdmin');
    (madeAdmin.ok && madeAdmin.data.role === 'admin') ? ok('promote to admin') : bad('makeAdmin');
    const madeUser = await act('makeUser');
    (madeUser.ok && madeUser.data.role === 'user') ? ok('demote to user') : bad('makeUser');
    const selfDel = await req('POST', '/api/admin/users/' + target.id, { action: 'delete' }, adminTok);
    selfDel.ok ? ok('delete user') : bad('delete user', JSON.stringify(selfDel.error));
    // guard: cannot suspend self
    const me = (list.data && list.data.me) || null;
    const selfSuspend = await req('POST', '/api/admin/users/' + me, { action: 'suspend' }, adminTok);
    selfSuspend.status === 400 ? ok('cannot suspend own admin account') : bad('self-suspend guard', selfSuspend.status);
  }

  // ── 4. community moderation ──
  console.log('\n[4] community moderation');
  const aName = 'adm_probe3_' + probe;
  const aTok = await makeUser(aName);
  const post = await req('POST', '/api/posts', { title: 'Probe post ' + probe, body: 'Body for moderation probe.', tag: 'general' }, aTok);
  const pid = post.data && post.data.post.id;
  pid ? ok('created probe post') : bad('create post', JSON.stringify(post.error));
  if (pid) {
    const rep = await req('POST', '/api/posts/' + pid + '/report', null, learnerTok);
    (rep.ok && rep.data.reported) ? ok('learner can report a post') : bad('report post');
    const mod = await req('GET', '/api/admin/moderation', null, adminTok);
    const mp = ((mod.data && mod.data.posts) || []).find((p) => p.id === pid);
    (mp && mp.flags >= 1) ? ok('flagged post appears in moderation queue') : bad('moderation queue', JSON.stringify(mp));
    const cm = await req('POST', '/api/posts/' + pid + '/comments', { body: 'Probe comment.' }, aTok);
    const cid = cm.data && cm.data.comment.id;
    cid ? ok('created probe comment') : bad('create comment');
    const clist = await req('GET', '/api/admin/comments', null, adminTok);
    ((clist.data && clist.data.comments) || []).some((c) => c.id === cid) ? ok('comment visible in admin list') : bad('admin comment list');
    const delC = await req('DELETE', '/api/admin/posts/' + pid + '/comments/' + cid, null, adminTok);
    (delC.ok && delC.data.removed) ? ok('admin deletes a comment') : bad('delete comment', JSON.stringify(delC.error));
    const delP = await req('DELETE', '/api/posts/' + pid, null, adminTok);
    delP.ok ? ok('admin deletes a post') : bad('delete post via admin');
  }

  // ── 5. sessions ──
  console.log('\n[5] sessions');
  const sess = await req('GET', '/api/admin/sessions', null, adminTok);
  (sess.ok && Array.isArray(sess.data.sessions) && sess.data.sessions.length >= 1) ? ok('session list with active sessions') : bad('sessions list');
}

// ── 6. cleanup ──
console.log('\n[6] cleanup');
if (adminTok) {
  const list = await req('GET', '/api/admin/users', null, adminTok);
  const strays = ((list.data && list.data.users) || []).filter((u) => u.username.startsWith('adm_probe'));
  for (const s of strays) await req('POST', '/api/admin/users/' + s.id, { action: 'delete' }, adminTok);
  strays.length ? ok('removed ' + strays.length + ' probe user(s)') : ok('no probe users to remove');
}

console.log('\n' + (fail === 0 ? '\u2713 PASS' : '\u2717 FAIL') + '  ' + passed + ' passed, ' + fail + ' failed');
process.exit(fail === 0 ? 0 : 1);
