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

    // ── two-factor step (Spec §77) ──
    function showTwoFA(challenge) {
      var form = document.getElementById('authForm');
      var user = document.getElementById('authUser');
      var pass = document.getElementById('authPass');
      var name = document.getElementById('authName');
      var submit = document.getElementById('authSubmit');
      [user, pass, name].forEach(function (f) { if (f) f.style.display = 'none'; });
      if (name && name.previousElementSibling) name.previousElementSibling.style.display = 'none';
      if (document.getElementById('nameLabel')) document.getElementById('nameLabel').style.display = 'none';
      document.getElementById('tabLogin').style.display = 'none';
      document.getElementById('tabRegister').style.display = 'none';
      var code = document.getElementById('auth2fa');
      if (!code) {
        code = document.createElement('input');
        code.id = 'auth2fa'; code.className = 'hx-input';
        code.setAttribute('inputmode', 'numeric'); code.setAttribute('autocomplete', 'one-time-code');
        code.placeholder = '000000 or a recovery code';
        form.insertBefore(code, submit);
      }
      code.style.display = ''; code.value = '';
      submit.textContent = 'Verify';
      alert('Enter the 6-digit code from your authenticator app.');
      setTimeout(function () { try { code.focus(); } catch (e) {} }, 40);

      function submitTwoFA(e) {
        e.preventDefault();
        submit.disabled = true; submit.textContent = '…';
        window.API.login2FA(challenge, code.value.trim()).then(function (r) {
          if (r.ok && r.success) { window.API.setToken(r.data.token); location.reload(); return; }
          alert((r.error && r.error.message) || 'Invalid code');
          submit.disabled = false; submit.textContent = 'Verify';
        }).catch(function () { alert('Cannot reach the server.'); submit.disabled = false; submit.textContent = 'Verify'; });
      }
      form._twoFAHandler = submitTwoFA;
    }
    window.Auth._showTwoFA = showTwoFA;

    document.getElementById('authForm').addEventListener('submit', function (e) {
      e.preventDefault();
      if (this._twoFAHandler) return this._twoFAHandler(e);
      var btn = document.getElementById('authSubmit');
      var username = document.getElementById('authUser').value.trim();
      var password = document.getElementById('authPass').value;
      var displayName = document.getElementById('authName').value.trim();
      btn.disabled = true; btn.textContent = '…';
      var p = tab === 'register' ? window.Store.signIn(username, password, displayName) : window.Store.signIn(username, password);
      p.then(function (r) {
        if (r && r.ok) { location.reload(); return; }
        if (r && r.twoFA) { btn.disabled = false; showTwoFA(r.challenge); return; }
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
