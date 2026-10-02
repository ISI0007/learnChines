// 汉学课堂 — Phase 11 translation admin smoke test (Spec §79).
//   node tools/verify-translations.mjs   (server must be running on 127.0.0.1:8091)
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const BASE = process.env.HX_BASE || 'http://127.0.0.1:8091';
const probe = crypto.randomBytes(3).toString('hex');
const PW = 'hx-probe-' + crypto.randomBytes(6).toString('hex');
const TEST_HZ = '坚持测试' + probe; // unique hanzi-free-of-collision key for this run

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

// ── 1. public endpoint + access control ──
console.log('\n[1] access control');
const pub = await req('GET', '/api/translations?lang=ru');
(pub.status === 200 && pub.success && pub.data && typeof pub.data.translations === 'object') ? ok('public /api/translations works unauthenticated') : bad('public translations', pub.status);
const badLang = await req('GET', '/api/translations?lang=xx');
badLang.status === 400 ? ok('unsupported language rejected (400)') : bad('bad lang', badLang.status);
const learner = await req('POST', '/api/register', { username: 'tr_probe_' + probe, password: PW, displayName: 'tr probe' });
const learnerTok = (learner.ok && learner.data && learner.data.token) || null;
learnerTok ? ok('created probe learner') : bad('create probe learner');
const lStats = await req('GET', '/api/admin/translations/stats', null, learnerTok);
lStats.status === 403 ? ok('learner /admin/translations/stats -> 403') : bad('learner stats', lStats.status);
const lSearch = await req('GET', '/api/admin/translations?lang=ru', null, learnerTok);
lSearch.status === 403 ? ok('learner /admin/translations -> 403') : bad('learner search', lSearch.status);
const lSave = await req('POST', '/api/admin/translations', { lang: 'ru', hanzi: '你', meaning: 'x' }, learnerTok);
lSave.status === 403 ? ok('learner cannot save translations (403)') : bad('learner save', lSave.status);

if (adminTok) {
  // ── 2. stats + search ──
  console.log('\n[2] stats + search');
  const st = await req('GET', '/api/admin/translations/stats', null, adminTok);
  const d = st.data || {};
  (st.ok && d.vocabTotal === 2501) ? ok('stats: vocabTotal = 2501') : bad('vocabTotal', d.vocabTotal);
  (st.ok && Array.isArray(d.languages)) ? ok('stats: per-language coverage list') : bad('stats languages');
  const search = await req('GET', '/api/admin/translations?lang=en&q=' + encodeURIComponent('坚持'), null, adminTok);
  (search.ok && search.data.rows.some((r) => r.hanzi === '坚持' || r.traditional === '坚持')) ? ok('search finds 坚持') : bad('search', JSON.stringify(search.data && search.data.rows && search.data.rows[0]));
  const byLevel = await req('GET', '/api/admin/translations?lang=en&level=1&limit=5', null, adminTok);
  (byLevel.ok && byLevel.data.rows.length <= 5 && byLevel.data.rows.every((r) => r.level === '1')) ? ok('level filter returns HSK 1 rows only') : bad('level filter');

  // ── 3. save / publish / visibility ──
  console.log('\n[3] save + publish flow');
  const saveDraft = await req('POST', '/api/admin/translations', { lang: 'ru', hanzi: TEST_HZ, meaning: 'черновик', explanation: 'draft note', status: 'draft' }, adminTok);
  (saveDraft.ok && saveDraft.data.status === 'draft') ? ok('save draft works') : bad('save draft', JSON.stringify(saveDraft.error));
  const pubAfterDraft = await req('GET', '/api/translations?lang=ru');
  (pubAfterDraft.data.translations[TEST_HZ] === undefined) ? ok('draft is NOT publicly visible') : bad('draft leaked to public');
  const missing = await req('POST', '/api/admin/translations', { lang: 'ru', hanzi: '你好', meaning: '' }, adminTok);
  missing.status === 400 ? ok('empty meaning rejected (400)') : bad('empty meaning', missing.status);
  const savePub = await req('POST', '/api/admin/translations', { lang: 'ru', hanzi: TEST_HZ, meaning: 'опубликовано', status: 'published' }, adminTok);
  (savePub.ok && savePub.data.status === 'published') ? ok('publish works') : bad('publish');
  const pubAfter = await req('GET', '/api/translations?lang=ru');
  (pubAfter.data.translations[TEST_HZ] && pubAfter.data.translations[TEST_HZ].m === 'опубликовано') ? ok('published translation is publicly visible') : bad('published not visible', JSON.stringify(pubAfter.data.translations[TEST_HZ]));
  const wrongLang = await req('GET', '/api/translations?lang=en');
  (wrongLang.data.translations[TEST_HZ] === undefined) ? ok('translation is scoped to its language') : bad('cross-language leak');

  // ── 4. cleanup ──
  console.log('\n[4] cleanup');
  const del = await req('POST', '/api/admin/translations', { lang: 'ru', hanzi: TEST_HZ, delete: true }, adminTok);
  (del.ok && del.data.deleted) ? ok('delete works') : bad('delete');
  const stillThere = await req('GET', '/api/translations?lang=ru');
  (stillThere.data.translations[TEST_HZ] === undefined) ? ok('deleted translation gone from public') : bad('delete incomplete');
}

console.log('\n' + (fail === 0 ? '\u2713 PASS' : '\u2717 FAIL') + '  ' + passed + ' passed, ' + fail + ' failed');
process.exit(fail === 0 ? 0 : 1);
