/* 汉学课堂 — API client. Thin wrapper over fetch with session token + JSON envelope.
   Spec §83 (REST), §92 (error format). */
(function () {
  'use strict';
  var TOKEN_KEY = 'hx_token', TOKEN_EXP = 'hx_token_exp', TOKEN_MS = 1095 * 86400000;

  function getToken() {
    try {
      var e = localStorage.getItem(TOKEN_EXP);
      if (e && Date.now() > Number(e)) { localStorage.removeItem(TOKEN_KEY); localStorage.removeItem(TOKEN_EXP); return null; }
      return localStorage.getItem(TOKEN_KEY);
    } catch (err) { return null; }
  }
  function setToken(t) { try { if (t) { localStorage.setItem(TOKEN_KEY, t); localStorage.setItem(TOKEN_EXP, String(Date.now() + TOKEN_MS)); } } catch (e) {} }
  function clearToken() { try { localStorage.removeItem(TOKEN_KEY); localStorage.removeItem(TOKEN_EXP); } catch (e) {} }

  function request(method, path, body) {
    var headers = {};
    var tok = getToken();
    if (tok) headers['X-Hanxue-Token'] = tok;
    if (body) headers['Content-Type'] = 'application/json';
    return fetch(path, { method: method, credentials: 'same-origin', headers: headers, body: body ? JSON.stringify(body) : undefined })
      .then(function (r) {
        return r.json().catch(function () { return {}; }).then(function (j) { return { status: r.status, ok: r.ok, success: !!(j && j.success), data: j && j.data, error: j && j.error }; });
      });
  }

  window.API = {
    getToken: getToken, setToken: setToken, clearToken: clearToken,
    get: function (p) { return request('GET', p); },
    post: function (p, b) { return request('POST', p, b); },
    put: function (p, b) { return request('PUT', p, b); },
    del: function (p) { return request('DELETE', p); },

    // auth
    me: function () { return request('GET', '/api/me'); },
    login: function (username, password) { return request('POST', '/api/login', { username: username, password: password }); },
    register: function (username, password, displayName) { return request('POST', '/api/register', { username: username, password: password, displayName: displayName }); },
    logout: function () { return request('POST', '/api/logout'); },
    changePassword: function (currentPassword, newPassword) { return request('POST', '/api/change-password', { currentPassword: currentPassword, newPassword: newPassword }); },

    // auth: sessions + 2FA + providers (Spec §77)
    sessions: function () { return request('GET', '/api/auth/sessions'); },
    revokeSession: function (id) { return request('POST', '/api/auth/sessions/revoke', { id: id }); },
    revokeOtherSessions: function () { return request('POST', '/api/auth/sessions/revoke', { others: true }); },
    twoFAStatus: function () { return request('GET', '/api/auth/2fa'); },
    twoFASetup: function (password) { return request('POST', '/api/auth/2fa/setup', { password: password }); },
    twoFAEnable: function (code) { return request('POST', '/api/auth/2fa/enable', { code: code }); },
    twoFADisable: function (password, code) { return request('POST', '/api/auth/2fa/disable', { password: password, code: code }); },
    login2FA: function (challenge, code) { return request('POST', '/api/auth/2fa/verify', { challenge: challenge, code: code }); },
    providers: function () { return request('GET', '/api/auth/providers'); },

    // learning
    getProgress: function () { return request('GET', '/api/progress'); },
    putProgress: function (progress) { return request('PUT', '/api/progress', { progress: progress }); },
    activity: function (type, detail) { return request('POST', '/api/activity', { type: type, detail: detail }); },

    // community (Phase 6)
    posts: function (tag, sort) { var qs = []; if (tag) qs.push('tag=' + encodeURIComponent(tag)); if (sort) qs.push('sort=' + encodeURIComponent(sort)); return request('GET', '/api/posts' + (qs.length ? '?' + qs.join('&') : '')); },
    post: function (id) { return request('GET', '/api/posts/' + encodeURIComponent(id)); },
    createPost: function (title, body, tag) { return request('POST', '/api/posts', { title: title, body: body, tag: tag }); },
    likePost: function (id) { return request('POST', '/api/posts/' + encodeURIComponent(id) + '/like'); },
    commentPost: function (id, body) { return request('POST', '/api/posts/' + encodeURIComponent(id) + '/comments', { body: body }); },
    deletePost: function (id) { return request('DELETE', '/api/posts/' + encodeURIComponent(id)); },
    reportPost: function (id) { return request('POST', '/api/posts/' + encodeURIComponent(id) + '/report'); },

    // settings (Phase 2)
    getSettings: function () { return request('GET', '/api/settings'); },
    putSettings: function (s) { return request('PUT', '/api/settings', s); },

    // admin
    adminUsers: function () { return request('GET', '/api/admin/users'); },
    adminUser: function (id) { return request('GET', '/api/admin/users/' + encodeURIComponent(id)); },
    adminSessions: function () { return request('GET', '/api/admin/sessions'); },
    adminStats: function () { return request('GET', '/api/admin/stats'); },
    adminModeration: function () { return request('GET', '/api/admin/moderation'); },
    adminComments: function () { return request('GET', '/api/admin/comments'); },
    adminUserAction: function (id, action) { return request('POST', '/api/admin/users/' + encodeURIComponent(id), { action: action }); },
    adminDeleteComment: function (postId, cid) { return request('DELETE', '/api/admin/posts/' + encodeURIComponent(postId) + '/comments/' + encodeURIComponent(cid)); },

    // translations (Spec §79)
    translations: function (lang) { return request('GET', '/api/translations?lang=' + encodeURIComponent(lang)); },
    adminTranslationStats: function () { return request('GET', '/api/admin/translations/stats'); },
    adminTranslationSearch: function (lang, q, level, limit) {
      return request('GET', '/api/admin/translations?lang=' + encodeURIComponent(lang) + '&q=' + encodeURIComponent(q || '') + '&level=' + encodeURIComponent(level || 'all') + '&limit=' + (limit || 50));
    },
    adminTranslationSave: function (payload) { return request('POST', '/api/admin/translations', payload); },
  };
})();
