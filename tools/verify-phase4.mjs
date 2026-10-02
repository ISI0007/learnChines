// 汉学课堂 — Phase 4 smoke test: spaced-repetition engine + study routes.
//   node tools/verify-phase4.mjs   (server should be running on 127.0.0.1:8091)
import fs from 'fs';
import path from 'path';

const BASE = process.env.HX_BASE || 'http://127.0.0.1:8091';
let pass = 0, fail = 0;
const ok = (n) => { pass++; console.log('  \u2713 ' + n); };
const bad = (n, d) => { fail++; console.log('  \u2717 ' + n + (d ? '  -> ' + d : '')); };

// ── build a browser-like sandbox for the client modules ──
const win = {};
function load(file) { new Function('window', 'document', fs.readFileSync(file, 'utf8'))(win, { documentElement: {}, dispatchEvent() {}, addEventListener() {} }); }
load(path.join('js', 'data.js'));                 // window.VOCAB
win.Store = { state: { progress: { known: {} }, user: { username: 'x' } } };
win.Settings = { surface: (w) => (w && w.s) || '' };
load(path.join('js', 'vocab.js'));                // window.Vocab
load(path.join('js', 'quiz.js'));                 // window.Quiz

console.log('\n[1] Quiz engine');
const Q = win.Quiz, V = win.VOCAB;
(V['1'].length === 150) ? ok('data loaded (150 HSK1 words)') : bad('vocab', V['1'].length);

const allSeen = Q.newCount(null);
allSeen === 2501 ? ok('newCount = 2501 (nothing seen yet)') : bad('newCount', allSeen);

let q = Q.queue(1, 5);
(q.length === 5) ? ok('queue(1,5) returns 5 cards') : bad('queue len', q.length);
(q.every((w) => w.s && w.p && w.d)) ? ok('queued cards are well-formed') : bad('card shape');

// grade a word correctly -> interval grows; wrong -> resets to 1 day
const w0 = V['1'][0];
let i1 = Q.grade(w0.s, 5);
let i2 = Q.grade(w0.s, 5);
let i3 = Q.grade(w0.s, 5);
(i1 === 1) ? ok('grade q5 -> first interval 1 day') : bad('first interval', i1);
(i2 === 6) ? ok('grade q5 -> second interval 6 days') : bad('second interval', i2);
(i3 > 6) ? ok('grade q5 -> third interval grows (' + i3 + ')') : bad('third interval', i3);

const r = Q.rec(w0.s);
Q.grade(w0.s, 1); // fail
const rAfter = Q.rec(w0.s);
(rAfter.i === 1) ? ok('fail resets interval to 1') : bad('fail reset', rAfter.i);
(rAfter.l >= 1) ? ok('fail increments lapses') : bad('lapses');

// dueCount: a word graded today should NOT be due now
Q.grade(w0.s, 4);
const due = Q.dueCount(1);
(due === 0) ? ok('dueCount=0 right after review') : bad('dueCount', due);

// newCount drops after grading a fresh word
const freshBefore = Q.newCount(1);
Q.grade(V['1'][1].s, 4);
(Q.newCount(1) === freshBefore - 1) ? ok('newCount decreases after learning a word') : bad('newCount decrease');

// pinyin tolerance
(Q.pinyinMatches('nǐ hǎo', { p: 'nǐ hǎo' })) ? ok('pinyinMatches accepts accented input') : bad('accented match');
(Q.pinyinMatches('ni hao', { p: 'nǐ hǎo' })) ? ok('pinyinMatches ignores tones/spaces') : bad('toneless match');
(!Q.pinyinMatches('xyz', { p: 'nǐ hǎo' })) ? ok('pinyinMatches rejects wrong input') : bad('reject wrong');
(Q.pinyinMatches('de5', { p: 'de5' })) ? ok('pinyinMatches strips tone digits') : bad('digit match');

// distractors
const ds = Q.distractors(V['1'][0], 1, 3);
(ds.length === 3 && ds.every((d) => d.s !== V['1'][0].s)) ? ok('distractors: 3 unique, excluding the answer') : bad('distractors', ds.length);

// stats shape
const st = Q.stats();
(typeof st.tracked === 'number' && typeof st.learned === 'number') ? ok('stats() returns numbers') : bad('stats', JSON.stringify(st));

// ── HTTP: new assets + study route shell ──
console.log('\n[2] HTTP assets');
for (const p of ['/', '/js/quiz.js', '/js/views5.js', '/js/art.js', '/css/app.css']) {
  const res = await fetch(BASE + p);
  res.ok ? ok(res.status + ' ' + p) : bad('expected 2xx for ' + p, res.status);
}
const home = await (await fetch(BASE + '/')).text();
home.includes('js/views5.js') ? ok('index.html loads views5.js') : bad('index ref views5.js');
home.includes('js/quiz.js') ? ok('index.html loads quiz.js') : bad('index ref quiz.js');

console.log('\n' + (fail ? '\u2717 FAIL' : '\u2713 PASS') + '  ' + pass + ' passed, ' + fail + ' failed\n');
// Let undici close its keep-alive sockets before exiting (avoids a libuv
// teardown assertion on Windows when process.exit() races socket close).
await new Promise((r) => setTimeout(r, 200));
process.exit(fail ? 1 : 0);
