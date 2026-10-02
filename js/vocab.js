/* 汉学课堂 — vocabulary helpers over the embedded dataset (Phase 3, Spec §4/§84).
   Data comes from window.VOCAB (levels 1–5), built into js/data.js. */
(function () {
  'use strict';

  var LEVELS = [1, 2, 3, 4, 5];

  function bag() { return window.VOCAB || {}; }

  var Vocab = {
    levels: LEVELS,
    list: function (level) { return bag()[String(level)] || bag()[level] || []; },
    count: function (level) { return Vocab.list(level).length; },
    total: function () { return LEVELS.reduce(function (a, l) { return a + Vocab.count(l); }, 0); },
    has: function (level) { return Vocab.count(level) > 0; },

    all: function () {
      var out = [];
      LEVELS.forEach(function (l) { Vocab.list(l).forEach(function (w) { out.push({ level: l, s: w.s, t: w.t, p: w.p, pn: w.pn, d: w.d }); }); });
      return out;
    },

    // Search across simplified, traditional, pinyin, and definition.
    search: function (q, level) {
      q = String(q || '').trim().toLowerCase();
      if (!q) return [];
      var pool = level ? Vocab.list(level) : Vocab.all();
      var out = [];
      for (var i = 0; i < pool.length && out.length < 200; i++) {
        var w = pool[i];
        var hay = (w.s + ' ' + (w.t || '') + ' ' + (w.p || '') + ' ' + (w.pn || '') + ' ' + (w.d || '')).toLowerCase();
        if (hay.indexOf(q) !== -1) out.push(w);
      }
      return out;
    },

    random: function (level) {
      var pool = level ? Vocab.list(level) : Vocab.all();
      if (!pool.length) return null;
      return pool[Math.floor(Math.random() * pool.length)];
    },

    // Deterministic "word of the day" so everyone sees the same word per date.
    daily: function () {
      var all = Vocab.all();
      if (!all.length) return { s: '坚持', p: 'jiānchí', d: 'to persist' };
      var d = new Date();
      var seed = d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
      return all[seed % all.length];
    },

    surface: function (w) { return window.Settings ? window.Settings.surface(w) : (w && w.s) || ''; },
    levelOf: function (w) { return (w && w.level) || null; },
  };

  window.Vocab = Vocab;
})();
