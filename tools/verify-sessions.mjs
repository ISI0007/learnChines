// Session / persistence smoke test. Reads the admin password from disk so no secret
// passes through the shell. Generates its own throwaway user password.
import fs from 'fs';

const B = 'http://127.0.0.1:8091';
const adminPass = (fs.readFileSync('D:/chinese-learning/server/data/ADMIN_PASSWORD.txt', 'utf8').match(/password:\s*(\S+)/) || [])[1];

function show(label, obj) { console.log('\n### ' + label); console.log(typeof obj === 'string' ? obj : JSON.stringify(obj)); }

async function call(path, { method = 'GET', body, cookie, token } = {}) {
  const headers = {};
  if (body) headers['Content-Type'] = 'application/json';
  if (cookie) headers['Cookie'] = cookie;
  if (token) headers['X-Hanxue-Token'] = token;
  const r = await fetch(B + path, { method, headers, body: body ? JSON.stringify(body) : undefined });
  let j = null; try { j = await r.json(); } catch {}
  return { status: r.status, setCookie: r.headers.get('set-cookie'), json: j };
}

const user = 'probe_' + Math.random().toString(36).slice(2, 8);
const pass = 'Pw-' + Math.random().toString(36).slice(2, 12) + 'A';

// 1) register new user
const reg = await call('/api/register', { method: 'POST', body: { username: user, password: pass, displayName: 'Probe ' + user } });
show('register ' + user, { status: reg.status, tokenLen: reg.json?.data?.token?.length, cookieMaxAgeDays: (reg.setCookie?.match(/Max-Age=(\d+)/) || [])[1] / 86400 });

// 2) /api/me with cookie only
const meCookie = await call('/api/me', { cookie: reg.setCookie });
show('me via cookie', { status: meCookie.status, user: meCookie.json?.data?.user?.username });

// 3) simulate browser losing the cookie: /api/me with token header only
const meToken = await call('/api/me', { token: reg.json.data.token });
show('me via persistent token (cookie evicted)', { status: meToken.status, user: meToken.json?.data?.user?.username });

// 4) save progress for this user, then read it back with the token only
await call('/api/progress', { method: 'PUT', token: reg.json.data.token, body: { progress: { known: { 你好: true, 学习: true }, xp: 42, streak: { current: 1, longest: 1, lastDay: '2026-10-03' } } } });
const back = await call('/api/progress', { token: reg.json.data.token });
show('progress round-trip (token only)', { xp: back.json?.data?.progress?.xp, known: Object.keys(back.json?.data?.progress?.known || {}) });

// 5) admin: session list with ~3-year expiry
const adminLogin = await call('/api/login', { method: 'POST', body: { username: 'admin', password: adminPass } });
const sess = await call('/api/admin/sessions', { token: adminLogin.json.data.token });
const mine = (sess.json?.data?.sessions || []).filter((s) => s.username === user);
show('admin sees new session', mine.map((s) => ({ user: s.username, daysLeft: s.daysLeft, active: s.active })));

// 6) reload identity (register a second user, ensure data separated by name)
const u2 = 'probe2_' + Math.random().toString(36).slice(2, 6);
const reg2 = await call('/api/register', { method: 'POST', body: { username: u2, password: pass, displayName: 'Probe Two' } });
const p2 = await call('/api/progress', { token: reg2.json.data.token });
show('second user starts clean', { user: u2, xp: p2.json?.data?.progress?.xp, known: Object.keys(p2.json?.data?.progress?.known || {}).length });

console.log('\nALL SESSION CHECKS DONE');
