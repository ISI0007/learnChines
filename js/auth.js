/* 汉学课堂 — Auth overlay + chrome wiring for the Phase 1 shell.
   Depends on: API, Store, I18N, UI. Spec §77 (auth), §2 (brand). */
(function () {
  'use strict';

  function t(k, v) { return window.I18N ? window.I18N.t(k, v) : k; }
  function $(s) { return document.querySelector(s); }

  var Auth = {};

  Auth.build = function () {
    var ov = $('#authOverlay');
    if (!ov || ov._bound) return ov;
    ov._bound = true;
    var tab = 'login';

    function setTab(x) {
      tab = x;
      document.getElementById('tabLogin').classList.toggle('active', x === 'login');
      document.getElementById('tabRegister').classList.toggle('active', x === 'register');
      document.getElementById('nameLabel').style.display = x === 'register' ? '' : 'none';
      document.getElementById('authSubmit').textContent = x === 'register' ? t('auth.createAccount') : t('auth.signIn');
      document.getElementById('authPass').setAttribute('autocomplete', x === 'register' ? 'new-password' : 'current-password');
      alert('');
    }
    function alert(msg, ok) {
      var a = document.getElementById('authAlert');
      a.textContent = msg || '';
      a.className = 'auth-alert' + (msg ? ' show' : '') + (ok ? ' ok' : '');
    }

    document.getElementById('tabLogin').addEventListener('click', function () { setTab('login'); });
    document.getElementById('tabRegister').addEventListener('click', function () { setTab('register'); });
    document.getElementById('authForm').addEventListener('submit', function (e) {
      e.preventDefault();
      var btn = document.getElementById('authSubmit');
      var username = document.getElementById('authUser').value.trim();
      var password = document.getElementById('authPass').value;
      var displayName = document.getElementById('authName').value.trim();
      btn.disabled = true; btn.textContent = '…';
      var p = tab === 'register' ? window.Store.signIn(username, password, displayName) : window.Store.signIn(username, password);
      p.then(function (r) {
        if (r && r.ok) { location.reload(); return; }
        alert((r && r.error) || 'Something went wrong');
        btn.disabled = false; btn.textContent = tab === 'register' ? t('auth.createAccount') : t('auth.signIn');
      }).catch(function () {
        alert('Cannot reach the server. Is it running?');
        btn.disabled = false; btn.textContent = tab === 'register' ? t('auth.createAccount') : t('auth.signIn');
      });
    });
    return ov;
  };

  Auth.show = function (show) { var ov = $('#authOverlay'); if (ov) ov.classList.toggle('show', !!show); };

  window.Auth = Auth;
})();
