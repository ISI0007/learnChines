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
    current: { path: '', params: {} },
    on: on,
    go: function (path, replace) { if (replace) location.replace('#' + path); else location.hash = path; },
    start: function (fallback) {
      function resolve() {
        var path = location.hash.replace(/^#/, '') || '/';
        for (var i = 0; i < routes.length; i++) {
          var p = routes[i].match(path);
          if (p) { Router.current = { path: path, params: p, name: routes[i].pattern }; document.dispatchEvent(new CustomEvent('route:change', { detail: Router.current })); return; }
        }
        if (fallback) fallback(path);
      }
      window.addEventListener('hashchange', resolve);
      resolve();
    },
  };
  window.Router = Router;
})();
