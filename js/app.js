/* 汉学课堂 — app bootstrap: chrome, routes, auth gate.
   Load order: data, i18n, api, store, providers, ui, router, auth, views, app. */
(function () {
  'use strict';

  function t(k, v) { return window.I18N ? window.I18N.t(k, v) : k; }
  function $(s) { return document.querySelector(s); }

  var NAV = [
    { path: '/', key: 'nav.home', ic: '🏠' },
    { path: '/courses', key: 'nav.courses', ic: '📚' },
    { path: '/practice', key: 'nav.practice', ic: '🎧' },
    { path: '/ai-tutor', key: 'nav.aiTutor', ic: '🤖' },
    { path: '/community', key: 'nav.community', ic: '💬' },
  ];
  var MOBILE = [
    { path: '/', key: 'nav.home', ic: '🏠' },
    { path: '/courses', key: 'nav.courses', ic: '📚' },
    { path: '/practice', key: 'nav.practice', ic: '🎧' },
    { path: '/ai-tutor', key: 'nav.aiTutor', ic: '🤖' },
    { path: '/profile', key: 'nav.profile', ic: '👤' },
  ];

  var App = {
    refreshChrome: function () {
      // nav links
      var links = $('#navLinks');
      window.UI.clear(links);
      NAV.forEach(function (n) {
        var a = window.UI.el('button', 'nav-link', window.UI.esc(t(n.key)));
        a.addEventListener('click', function () { window.Router.go(n.path); });
        if (window.Router.current.name === n.path) a.classList.add('active');
        links.appendChild(a);
      });
      // mobile bottom nav
      var bn = window.UI.clear($('#bottomNav'));
      MOBILE.forEach(function (n) {
        var b = window.UI.el('button', window.Router.current.name === n.path ? 'active' : '');
        b.appendChild(window.UI.el('span', 'ic', n.ic));
        b.appendChild(window.UI.el('span', null, window.UI.esc(t(n.key))));
        b.addEventListener('click', function () { window.Router.go(n.path); });
        bn.appendChild(b);
      });
      // user chip
      var S = window.Store.state;
      var userChip = $('#navUser'), signBtn = $('#signInBtn');
      if (S.user) {
        userChip.style.display = ''; signBtn.style.display = 'none';
        $('#navName').textContent = S.user.displayName || S.user.username;
        $('#navAv').textContent = (S.user.displayName || S.user.username || '?').slice(0, 1).toUpperCase();
      } else {
        userChip.style.display = 'none'; signBtn.style.display = '';
      }
      // language select
      var sel = $('#langSelect');
      if (sel && !sel._filled) {
        Object.keys(window.I18N.locales).forEach(function (code) {
          var o = window.UI.el('option', null, window.I18N.locales[code].name); o.value = code;
          sel.appendChild(o);
        });
        sel._filled = true;
        sel.addEventListener('change', function () {
          window.I18N.set(sel.value);
          window.Store.setSetting('uiLanguage', sel.value);
          App.refreshChrome(); App.render();
        });
      }
      if (sel) sel.value = window.I18N.lang;
      // brand/title translated
      document.title = window.I18N.t('app.nameCn') + ' · ' + window.I18N.t('app.name');
      var nt = $('#navTitle');
      if (nt) nt.innerHTML = '<span class="cn">' + window.UI.esc(window.I18N.t('app.nameCn').slice(0, 2)) + '</span>' + window.UI.esc(window.I18N.t('app.nameCn').slice(2));
      var search = $('#navSearch');
      if (search) search.placeholder = t('search.placeholder');
    },

    render: function () {
      var view = $('#view');
      if (!view) return;
      var name = window.Router.current.name || '/';
      var fn = ({ '/': 'home', '/courses': 'courses', '/practice': 'practice', '/ai-tutor': 'aiTutor',
        '/community': 'community', '/exams': 'exams', '/progress': 'progress', '/profile': 'profile',
        '/settings': 'settings', '/admin': 'admin' })[name] || 'home';
      var page = window.UI.el('div', 'page');
      window.Views[fn] ? window.Views[fn](page) : window.Views.home(page);
      window.UI.mount(view, [page]);
      App.refreshChrome();
      window.scrollTo(0, 0);
    },

    bind: function () {
      $('#navBrand').addEventListener('click', function () { window.Router.go('/'); });
      $('#signInBtn').addEventListener('click', function () { window.Auth.show(true); });
      $('#navUser').addEventListener('click', function () { window.Router.go('/profile'); });
      $('#themeBtn').addEventListener('click', function () {
        var html = document.documentElement;
        var next = html.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
        html.setAttribute('data-theme', next);
        try { localStorage.setItem('hx_theme', next); } catch (e) {}
        $('#themeBtn').textContent = next === 'dark' ? '☀️' : '🌙';
      });
      var search = $('#navSearch');
      if (search) search.addEventListener('keydown', function (e) { if (e.key === 'Enter') { window.UI.toast('Search arrives in Phase 3'); } });
      document.addEventListener('i18n:change', function () { App.refreshChrome(); App.render(); });
    },

    initTheme: function () {
      var saved = 'light';
      try { saved = localStorage.getItem('hx_theme') || 'light'; } catch (e) {}
      document.documentElement.setAttribute('data-theme', saved);
      $('#themeBtn').textContent = saved === 'dark' ? '☀️' : '🌙';
    },
  };

  window.App = App;

  document.addEventListener('DOMContentLoaded', function () {
    App.initTheme();
    window.Auth.build();
    App.bind();

    // routes (hash-based)
    window.Router.on('/', function () { App.render(); });
    window.Router.on('/courses', function () { App.render(); });
    window.Router.on('/practice', function () { App.render(); });
    window.Router.on('/ai-tutor', function () { App.render(); });
    window.Router.on('/community', function () { App.render(); });
    window.Router.on('/exams', function () { App.render(); });
    window.Router.on('/progress', function () { App.render(); });
    window.Router.on('/profile', function () { App.render(); });
    window.Router.on('/settings', function () { App.render(); });
    window.Router.on('/admin', function () { App.render(); });

    // initial render + route
    App.render();
    window.Router.start(function () { window.Router.go('/', true); });

    // load identity; gate with auth overlay when not signed in
    window.Store.load().then(function (ok) {
      App.refreshChrome();
      App.render();
      if (!ok && window.Store.state.mode === 'server') window.Auth.show(true);
    });
  });
})();
