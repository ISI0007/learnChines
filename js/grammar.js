/* 汉学课堂 — grammar store over data/grammar.json (embedded as window.GRAMMAR).
   Read-only helper for the grammar browser. Spec §4 (grammar points). */
(function () {
  'use strict';
  var G = window.GRAMMAR || [];

  var Grammar = {
    all: function () { return G; },
    count: function () { return G.length; },
    levels: function () {
      var seen = {};
      G.forEach(function (g) { seen[g.level] = true; });
      return Object.keys(seen).map(Number).sort(function (a, b) { return a - b; });
    },
    byLevel: function (level) {
      var lv = +level;
      return G.filter(function (g) { return g.level === lv; });
    },
    search: function (q) {
      q = String(q || '').trim().toLowerCase();
      if (!q) return [];
      return G.filter(function (g) {
        return (g.text || '').toLowerCase().indexOf(q) !== -1 || (g.code || '').indexOf(q) !== -1;
      });
    },
  };

  window.Grammar = Grammar;
})();
