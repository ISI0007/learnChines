/* 汉学课堂 — app bootstrap: chrome, routes, auth gate.
   Load order: data, i18n, api, store, providers, ui, router, auth, views, app. */
(function () {
  'use strict';

  function t(k, v) { return window.I18N ? window.I18N.t(k, v) : k; }
  function $(s) { return document.querySelector(s); }

  var NAV = [
    { path: '/', key: 'nav.home', ic: '🏠' },
    { path: '/courses', key: 'nav.courses', ic: '📚' },
    { path: '/vocabulary', key: 'nav.vocab', ic: '🔤' },
    { path: '/library', key: 'nav.library', ic: '📖' },
    { path: '/exams', key: 'nav.exams', ic: '📝' },
    { path: '/practice', key: 'nav.practice', ic: '🎧' },
    { path: '/ai-tutor', key: 'nav.aiTutor', ic: '🤖' },
  ];
  var MOBILE = [
    { path: '/', key: 'nav.home', ic: '🏠' },
    { path: '/courses', key: 'nav.courses', ic: '📚' },
    { path: '/vocabulary', key: 'nav.vocab', ic: '🔤' },
    { path: '/library', key: 'nav.library', ic: '📖' },
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
      var cur = window.Router.current || { name: '/', params: {} };
      var name = cur.name || '/', params = cur.params || {};
      var page = window.UI.el('div', 'page');
      var V = window.Views, V3 = window.Views3, V4 = window.Views4;
      var fn =
        name === '/' ? function () { V4.home(page); } :
        name === '/courses' ? function () { V4.courses(page); } :
        name === '/syllabus/:level' ? function () { V4.syllabus(page, params.level); } :
        name === '/lesson/:id' ? function () { V4.lesson(page, params.id); } :
        name === '/vocabulary' ? function () { V3.vocabulary(page); } :
        name === '/library' ? function () { V3.library(page); } :
        name === '/book/:idx' ? function () { V3.book(page, params.idx); } :
        name === '/exams' ? function () { V3.exams(page); } :
        name === '/exam/:id' ? function () { V3.exam(page, params.id); } :
        name === '/practice' ? function () { V4.practice(page); } :
        name === '/ai-tutor' ? function () { V4.aiTutor(page); } :
        name === '/community' ? function () { V4.community(page); } :
        name === '/progress' ? function () { V4.progress(page); } :
        name === '/profile' ? function () { V.profile(page); } :
        name === '/settings' ? function () { V.settings(page); } :
        name === '/admin' ? function () { V.admin(page); } :
        function () { V4.home(page); };
      fn();
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
    ['/', '/courses', '/practice', '/ai-tutor', '/community', '/exams', '/progress', '/profile', '/settings', '/admin',
     '/syllabus/:level', '/lesson/:id', '/vocabulary', '/library', '/book/:idx', '/exam/:id'].forEach(function (p) {
      window.Router.on(p, function () { App.render(); });
    });

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
