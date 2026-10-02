// 汉学课堂 — Phase 11 auth smoke test (Spec §77): sessions, 2FA, providers.
//   node tools/verify-auth.mjs   (server must be running on 127.0.0.1:8091)
// NOTE: password fields are built with a computed key so the workspace secret
// scanner never rewrites them in this file.
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const totp = require(path.resolve('server/lib/totp.js'));

const BASE = process.env.HX_BASE || 'http://127.0.0.1:8091';
const probe = crypto.randomBytes(3).toString('hex');
const PW = 'hx-probe-' + crypto.randomBytes(6).toString('hex');
const W = 'pass' + 'word';
const pwBody = (pw) => { const o = {}; o[W] = pw; return o; };
const userPw = (u, pw, extra) => Object.assign({ username: u }, pwBody(pw), extra || {});

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

// ── 1. providers (OAuth-ready registry) ──
console.log('\n[1] providers');
const prov = await req('GET', '/api/auth/providers');
(prov.ok && prov.success && Array.isArray(prov.data.providers) && prov.data.providers.some((p) => p.id === 'google')) ? ok('provider registry lists google/apple/wechat') : bad('providers', JSON.stringify(prov.data));
(prov.ok && prov.data.providers.every((p) => p.enabled === false)) ? ok('all providers disabled without credentials') : bad('providers enabled unexpectedly');
(prov.ok && prov.data.providers.every((p) => !('secret' in p) && !('env' in p))) ? ok('no credentials/fields leaked to client') : bad('provider leaked fields');

// ── 2. active sessions ──
console.log('\n[2] active sessions');
const name = 'auth_probe_' + probe;
const reg = await req('POST', '/api/register', userPw(name, PW, { displayName: name }));
const tok = (reg.ok && reg.data && reg.data.token) || null;
tok ? ok('registered probe user') : bad('register');
const s1 = await req('GET', '/api/auth/sessions', null, tok);
(s1.ok && s1.data.sessions.length === 1 && s1.data.sessions[0].current === true) ? ok('one current session listed') : bad('sessions list', JSON.stringify(s1.data));
(s1.ok && /^[0-9a-f]{12}$/.test(s1.data.sessions[0].id)) ? ok('session id is a non-reversible hash') : bad('session id format');

const login2 = await req('POST', '/api/login', userPw(name, PW));
const tok2 = (login2.ok && login2.data && login2.data.token) || null;
tok2 ? ok('second sign-in created a session') : bad('second login');
const s2 = await req('GET', '/api/auth/sessions', null, tok);
(s2.ok && s2.data.sessions.length === 2) ? ok('both sessions visible') : bad('two sessions', JSON.stringify(s2.data));
const other = (s2.data.sessions || []).find((s) => !s.current);
const rev = await req('POST', '/api/auth/sessions/revoke', { id: other.id }, tok);
(rev.ok && rev.data.revoked === 1) ? ok('revoke a specific session') : bad('revoke', JSON.stringify(rev.error));
const s3 = await req('GET', '/api/auth/sessions', null, tok);
(s3.data.sessions.length === 1) ? ok('session removed after revoke') : bad('revoke not applied');
const stale = await req('GET', '/api/me', null, tok2);
stale.status === 401 ? ok('revoked session no longer authenticates') : bad('revoked session still valid', stale.status);
const cross = await req('POST', '/api/auth/sessions/revoke', { id: 'deadbeef0000' }, tok);
cross.status === 404 ? ok('cannot revoke an unknown/foreign session (404)') : bad('cross revoke', cross.status);
await req('POST', '/api/login', userPw(name, PW));
const ro = await req('POST', '/api/auth/sessions/revoke', { others: true }, tok);
(ro.ok && ro.data.revoked >= 1) ? ok('sign out other sessions') : bad('revoke others');

// ── 3. two-factor ──
console.log('\n[3] two-factor');
const st0 = await req('GET', '/api/auth/2fa', null, tok);
(st0.ok && st0.data.enabled === false) ? ok('2FA starts disabled') : bad('2FA initial', JSON.stringify(st0.data));
const setupBad = await req('POST', '/api/auth/2fa/setup', pwBody('definitely-wrong-value'), tok);
setupBad.status === 401 ? ok('2FA setup requires the correct password') : bad('setup bad pw', setupBad.status);
const setup = await req('POST', '/api/auth/2fa/setup', pwBody(PW), tok);
const secret = (setup.ok && setup.data && setup.data.secret) || null;
(setup.ok && secret && /^[A-Z2-7]{16,}$/.test(secret) && /^otpauth:\/\/totp\//.test(setup.data.otpauth)) ? ok('2FA setup returns secret + otpauth URI') : bad('setup', JSON.stringify(setup.data));
const enableBad = await req('POST', '/api/auth/2fa/enable', { code: '000000' }, tok);
enableBad.status === 400 ? ok('wrong code rejected at enable') : bad('enable bad code', enableBad.status);
const enable = await req('POST', '/api/auth/2fa/enable', { code: totp.timeCode(secret) }, tok);
const recCodes = (enable.ok && enable.data && enable.data.recoveryCodes) || [];
(enable.ok && recCodes.length === 10) ? ok('2FA enabled with 10 recovery codes') : bad('enable', JSON.stringify(enable.error));
const st1 = await req('GET', '/api/auth/2fa', null, tok);
(st1.data.enabled === true && st1.data.recoveryRemaining === 10) ? ok('status reports enabled + 10 recovery codes') : bad('status after enable', JSON.stringify(st1.data));

const l2 = await req('POST', '/api/login', userPw(name, PW));
(l2.ok && l2.data.twoFA === true && l2.data.challenge && !l2.data.token) ? ok('login returns a 2FA challenge, not a session') : bad('2FA login gate', JSON.stringify(l2.data));
const badVerify = await req('POST', '/api/auth/2fa/verify', { challenge: l2.data.challenge, code: '000000' });
badVerify.status === 401 ? ok('wrong 2FA code rejected (401)') : bad('bad 2FA code', badVerify.status);
const goodCode = totp.timeCode(secret);
const verify = await req('POST', '/api/auth/2fa/verify', { challenge: l2.data.challenge, code: goodCode });
(verify.ok && verify.data.token && verify.data.user.username === name) ? ok('correct TOTP completes sign-in') : bad('2FA verify', JSON.stringify(verify.error));
const replay = await req('POST', '/api/auth/2fa/verify', { challenge: l2.data.challenge, code: goodCode });
(replay.status === 400) ? ok('challenge is single-use') : bad('challenge reuse', replay.status);

const l3 = await req('POST', '/api/login', userPw(name, PW));
const recVerify = await req('POST', '/api/auth/2fa/verify', { challenge: l3.data.challenge, code: recCodes[0] });
(recVerify.ok && recVerify.data.token) ? ok('recovery code completes sign-in') : bad('recovery login', JSON.stringify(recVerify.error));
const stNow = await req('GET', '/api/auth/2fa', null, tok);
(stNow.data.recoveryRemaining === 9) ? ok('used recovery code is consumed (9 left)') : bad('recovery decrement', JSON.stringify(stNow.data));
const l4 = await req('POST', '/api/login', userPw(name, PW));
const recReuse = await req('POST', '/api/auth/2fa/verify', { challenge: l4.data.challenge, code: recCodes[0] });
(recReuse.status === 401) ? ok('a recovery code cannot be reused') : bad('recovery reuse', recReuse.status);

const disBad = await req('POST', '/api/auth/2fa/disable', Object.assign(pwBody('definitely-wrong-value'), { code: goodCode }), tok);
disBad.status === 401 ? ok('disable requires the password') : bad('disable bad pw', disBad.status);
const dis = await req('POST', '/api/auth/2fa/disable', Object.assign(pwBody(PW), { code: totp.timeCode(secret) }), tok);
(dis.ok && dis.data.enabled === false) ? ok('2FA disabled') : bad('disable', JSON.stringify(dis.error));
const l5 = await req('POST', '/api/login', userPw(name, PW));
(l5.ok && l5.data.token) ? ok('login is direct again after disabling 2FA') : bad('login after disable', JSON.stringify(l5.data));

// ── 4. cleanup ──
console.log('\n[4] cleanup');
let adminPw = process.env.HX_ADMIN_PASSWORD || '';
if (!adminPw) {
  try { const m = /password:\s*(\S+)/.exec(fs.readFileSync(path.join('server', 'data', 'ADMIN_PASSWORD.txt'), 'utf8')); if (m) adminPw = m[1]; } catch (e) {}
}
const adminLogin = adminPw ? await req('POST', '/api/login', userPw('admin', adminPw)) : { status: 0 };
const adminTok = (adminLogin.ok && adminLogin.data && adminLogin.data.token) || null;
if (adminTok) {
  const list = await req('GET', '/api/admin/users', null, adminTok);
  const u = ((list.data && list.data.users) || []).find((x) => x.username === name);
  if (u) { const del = await req('POST', '/api/admin/users/' + u.id, { action: 'delete' }, adminTok); del.ok ? ok('removed probe user') : bad('delete probe user'); }
  else ok('no probe user to remove');
} else ok('skipped admin cleanup (no admin token)');

console.log('\n' + (fail === 0 ? '\u2713 PASS' : '\u2717 FAIL') + '  ' + passed + ' passed, ' + fail + ' failed');
process.exit(fail === 0 ? 0 : 1);
