// 汉学课堂 — Phase 2/3 smoke test.
//   node tools/verify-phase23.mjs        (server must be running on 127.0.0.1:8091)
// Registers a throwaway probe account, exercises the settings + progress API,
// checks embedded data integrity, then removes the probe from the JSON store.
// The probe is only fully gone from server memory after the next restart.
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const BASE = process.env.HX_BASE || 'http://127.0.0.1:8091';
const DATA = path.join(process.cwd(), 'server', 'data');
const probe = 'phase23_probe_' + crypto.randomBytes(3).toString('hex');

let pass = 0, fail = 0;
const ok = (n) => { pass++; console.log('  \u2713 ' + n); };
const bad = (n, d) => { fail++; console.log('  \u2717 ' + n + (d ? '  -> ' + d : '')); };

async function req(method, p, body, token) {
  const headers = {};
  if (body) headers['Content-Type'] = 'application/json';
  if (token) headers['X-Hanxue-Token'] = token;
  const r = await fetch(BASE + p, { method, headers, body: body ? JSON.stringify(body) : undefined });
  let j = {}; try { j = await r.json(); } catch (e) {}
  return { status: r.status, ok: r.ok, j };
}

// ── 1. data integrity (client data.js) ──
console.log('\n[1] embedded data');
const src = fs.readFileSync(path.join('js', 'data.js'), 'utf8');
const w = {}; new Function('window', src)(w); // data.js assigns window.VOCAB/LIBRARY/EXAMS
const levels = Object.keys(w.VOCAB);
(levels.join(',') === '1,2,3,4,5') ? ok('VOCAB has HSK 1-5') : bad('VOCAB levels', levels.join(','));
const totalWords = levels.reduce((a, l) => a + w.VOCAB[l].length, 0);
totalWords > 2000 ? ok(totalWords + ' words embedded') : bad('word count low', totalWords);
const sample = w.VOCAB['1'][0];
(sample && sample.s && sample.p && sample.d) ? ok('word shape {s,t,p,pn,d}') : bad('word shape');
Array.isArray(w.LIBRARY.books) && w.LIBRARY.books.length ? ok(w.LIBRARY.books.length + ' books') : bad('books');
Array.isArray(w.EXAMS) && w.EXAMS.length ? ok(w.EXAMS.length + ' exam sets') : bad('exams');
const withAudio = w.EXAMS.filter((e) => e.listening).length;
withAudio ? ok(withAudio + ' exam sets with listening audio') : bad('exam audio');

// ── 2. unauthenticated guards ──
console.log('\n[2] unauthenticated guards');
for (const p of ['/api/me', '/api/settings', '/api/progress', '/api/admin/users', '/api/admin/sessions']) {
  const r = await req('GET', p);
  r.status === 401 ? ok('401 ' + p) : bad('expected 401 for ' + p, r.status);
}
for (const p of ['/server/config.js', '/_retired/REMOVED.txt', '/tools/import-hsk.mjs', '/../server/data/users.json']) {
  const r = await fetch(BASE + p);
  r.status === 404 ? ok('404 ' + p) : bad('expected 404 for ' + p, r.status);
}

// ── 3. register probe + settings round-trip ──
console.log('\n[3] auth + settings');
const reg = await req('POST', '/api/register', { username: probe, password: 'probe-pass-12345', displayName: 'Probe' });
if (reg.ok && reg.j.success && reg.j.data.token) ok('registered ' + probe); else { bad('register', JSON.stringify(reg.j)); }
const token = reg.j && reg.j.data && reg.j.data.token;
const uid = reg.j && reg.j.data && reg.j.data.user && reg.j.data.user.id;

if (token) {
  const me = await req('GET', '/api/me', null, token);
  (me.ok && me.j.data && me.j.data.settings) ? ok('GET /api/me returns settings') : bad('me.settings');
  (me.j.data.settings.uiLanguage === 'en') ? ok('default uiLanguage=en') : bad('default uiLanguage', JSON.stringify(me.j.data.settings));

  const put = await req('PUT', '/api/settings', { settings: { uiLanguage: 'zh-CN', characterPreference: 'traditional', pinyinPreference: 'click', dailyGoalMinutes: 45 } }, token);
  const s = put.j && put.j.data && put.j.data.settings;
  (put.ok && s && s.uiLanguage === 'zh-CN' && s.characterPreference === 'traditional' && s.dailyGoalMinutes === 45)
    ? ok('PUT /api/settings persists valid values') : bad('settings PUT', JSON.stringify(s));

  const bad2 = await req('PUT', '/api/settings', { settings: { uiLanguage: 'xx-NOPE', dailyGoalMinutes: 99999 } }, token);
  const s2 = bad2.j && bad2.j.data && bad2.j.data.settings;
  (s2 && s2.uiLanguage === 'en' && s2.dailyGoalMinutes === 600) ? ok('invalid settings sanitized') : bad('sanitize', JSON.stringify(s2));

  const put2 = await req('PUT', '/api/progress', { progress: { known: { '的': true, '是': true }, xp: 42 } }, token);
  (put2.ok && put2.j.data.progress.xp === 42 && Object.keys(put2.j.data.progress.known).length === 2)
    ? ok('PUT /api/progress round-trip') : bad('progress PUT', JSON.stringify(put2.j && put2.j.data));

  const act = await req('POST', '/api/activity', { type: 'quiz', detail: 'probe' }, token);
  act.ok ? ok('POST /api/activity') : bad('activity', act.status);

  const lo = await req('POST', '/api/logout');
  lo.ok ? ok('POST /api/logout') : bad('logout', lo.status);
} else { bad('no token, skipping authed tests'); }

// ── cleanup: remove probe from the JSON store ──
console.log('\n[4] cleanup');
try {
  const uf = path.join(DATA, 'users.json');
  const sf = path.join(DATA, 'sessions.json');
  const ud = JSON.parse(fs.readFileSync(uf, 'utf8'));
  const before = ud.users.length;
  ud.users = ud.users.filter((u) => u.username !== probe);
  fs.writeFileSync(uf, JSON.stringify(ud, null, 2));
  ok('removed probe user (' + before + ' -> ' + ud.users.length + ')');
  if (fs.existsSync(sf)) {
    const sd = JSON.parse(fs.readFileSync(sf, 'utf8'));
    let removed = 0;
    for (const k of Object.keys(sd.sessions || {})) { if (sd.sessions[k] && sd.sessions[k].userId === uid) { delete sd.sessions[k]; removed++; } }
    fs.writeFileSync(sf, JSON.stringify(sd, null, 2));
    ok('removed ' + removed + ' probe session(s)');
  }
  console.log('  (restart the server so memory reloads the cleaned store)');
} catch (e) { bad('cleanup', e.message); }

console.log('\n' + (fail ? '\u2717 FAIL' : '\u2713 PASS') + '  ' + pass + ' passed, ' + fail + ' failed\n');
process.exit(fail ? 1 : 0);
