/* 汉学课堂 — hash router. Routes per spec §10. */
(function () {
  'use strict';

  var routes = [];
  function compile(pattern) {
    var parts = pattern.split('/').filter(Boolean);
    return function (path) {
      var segs = path.split('/').filter(Boolean);
      if (segs.length !== parts.length) return null;
      var params = {};
      for (var i = 0; i < parts.length; i++) {
        if (parts[i][0] === ':') params[parts[i].slice(1)] = decodeURIComponent(segs[i]);
        else if (parts[i] !== segs[i]) return null;
      }
      return params;
    };
  }
  function on(pattern, handler) { routes.push({ pattern: pattern, match: compile(pattern), handler: handler }); }

  var Router = {
    current: { path: '', params: {}, query: {}, name: '' },
    on: on,
    go: function (path, replace) { if (replace) location.replace('#' + path); else location.hash = path; },
    start: function (fallback) {
      function resolve() {
        var raw = location.hash.replace(/^#/, '') || '/';
        // Split the query string out of the path so "?level=2" never breaks route matching.
        var qi = raw.indexOf('?');
        var path = qi === -1 ? raw : raw.slice(0, qi);
        var query = {};
        if (qi !== -1) {
          raw.slice(qi + 1).split('&').forEach(function (kv) {
            if (!kv) return;
            var i = kv.indexOf('=');
            var k = decodeURIComponent(i === -1 ? kv : kv.slice(0, i));
            var v = i === -1 ? '' : decodeURIComponent(kv.slice(i + 1));
            query[k] = v;
          });
        }
        for (var i = 0; i < routes.length; i++) {
          var p = routes[i].match(path);
          if (p) { Router.current = { path: path, params: p, query: query, name: routes[i].pattern }; document.dispatchEvent(new CustomEvent('route:change', { detail: Router.current })); return; }
        }
        if (fallback) fallback(path);
      }
      window.addEventListener('hashchange', resolve);
      resolve();
    },
  };
  window.Router = Router;
})();
