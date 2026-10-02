/* 汉学课堂 — quiz + spaced-repetition engine (Phase 4).
   SM-2-lite scheduling over the embedded vocabulary. State lives in
   Store.state.progress.srs so it persists per user via /api/progress.
   Depends on: Vocab, Store. */
(function () {
  'use strict';

  var DAY = 86400000;

  function bag() {
    var p = window.Store.state.progress;
    if (!p.srs || typeof p.srs !== 'object') p.srs = {};
    return p.srs;
  }
  function rec(word) {
    var b = bag();
    if (!b[word]) b[word] = { i: 0, e: 2.5, d: null, n: 0, l: 0, seen: 0, correct: 0, last: null };
    return b[word];
  }
  function isDue(word, now) {
    var r = rec(word);
    if (!r.d) return true;
    return new Date(r.d).getTime() <= (now || Date.now());
  }

  // Which words to study now: due first (soonest), then unseen new words.
  function queue(level, limit) {
    var now = Date.now();
    var pool = level ? window.Vocab.list(level) : window.Vocab.all();
    var due = [], fresh = [];
    pool.forEach(function (w) {
      var r = rec(w.s);
      if (r.seen === 0 && !r.d) fresh.push(w);
      else if (isDue(w.s, now)) due.push(w);
    });
    due.sort(function (a, b) { return new Date(rec(a.s).d || 0) - new Date(rec(b.s).d || 0); });
    var out = due.concat(fresh);
    return out.slice(0, limit || 10);
  }

  function dueCount(level) {
    var now = Date.now();
    var pool = level ? window.Vocab.list(level) : window.Vocab.all();
    var n = 0;
    pool.forEach(function (w) { if (rec(w.s).seen > 0 && isDue(w.s, now)) n++; });
    return n;
  }
  function newCount(level) {
    var pool = level ? window.Vocab.list(level) : window.Vocab.all();
    var n = 0;
    pool.forEach(function (w) { if (rec(w.s).seen === 0) n++; });
    return n;
  }

  // SM-2-lite: quality 0..5.
  function grade(word, quality) {
    var r = rec(word);
    r.seen += 1;
    r.last = new Date().toISOString();
    if (quality >= 3) {
      r.correct += 1;
      r.n += 1;
      if (r.n === 1) r.i = 1;
      else if (r.n === 2) r.i = 6;
      else r.i = Math.round(r.i * r.e) || 6;
      r.e = r.e + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
      if (r.e < 1.3) r.e = 1.3;
      if (r.e > 2.5) r.e = 2.5;
    } else {
      r.l += 1;
      r.n = 0;
      r.i = 1;
    }
    r.d = new Date(Date.now() + r.i * DAY).toISOString();
    return r.i;
  }

  // Strip tone marks / digits / spaces for lenient pinyin matching.
  function normPinyin(s) {
    return String(s || '')
      .toLowerCase()
      .replace(/[āáǎà]/g, 'a').replace(/[ēéěè]/g, 'e').replace(/[īíǐì]/g, 'i')
      .replace(/[ōóǒò]/g, 'o').replace(/[ūúǔù]/g, 'u').replace(/[ǖǘǚǜü]/g, 'u')
      .replace(/[1-5]/g, '').replace(/[^a-z]/g, '');
  }
  function pinyinMatches(input, word) {
    var want = String(word.p || '').split(/[,\s]+/).map(normPinyin).filter(Boolean);
    var got = normPinyin(input);
    if (!got) return false;
    if (want.indexOf(got) !== -1) return true;
    // allow per-syllable match ignoring grouping
    var joined = want.join('');
    return joined === got;
  }

  function distractors(word, level, n) {
    var pool = (level ? window.Vocab.list(level) : window.Vocab.all()).filter(function (w) {
      return w.s !== word.s && w.d && w.d !== word.d;
    });
    var out = [], guard = 0;
    while (out.length < n && guard < 200) {
      guard++;
      var c = pool[Math.floor(Math.random() * pool.length)];
      if (c && !out.some(function (x) { return x.s === c.s; })) out.push(c);
    }
    return out;
  }

  function shuffle(a) { for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; } return a; }

  window.Quiz = {
    queue: queue, dueCount: dueCount, newCount: newCount, grade: grade,
    isDue: isDue, rec: rec, distractors: distractors, shuffle: shuffle,
    normPinyin: normPinyin, pinyinMatches: pinyinMatches,
    totalSeen: function () { var b = bag(), n = 0; for (var k in b) if (b[k].seen) n++; return n; },
    stats: function () {
      var b = bag(), n = 0, learned = 0, leech = 0;
      for (var k in b) { n++; if (b[k].n >= 3) learned++; if (b[k].l >= 4) leech++; }
      return { tracked: n, learned: learned, leeches: leech };
    },
  };
})();
