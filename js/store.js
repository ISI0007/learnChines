/* 汉学课堂 — application state + per-user persistence.
   Spec §81 (language model), §116 (learning profile). Keeps the last-known copy
   per user in localStorage so the UI works offline. */
(function () {
  'use strict';

  function pad(n) { return n < 10 ? '0' + n : '' + n; }
  function today() { var d = new Date(); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function emptyProgress() {
    return { known: {}, quiz: { taken: 0, correct: 0, answered: 0, byLevel: {} }, examsOpened: [], booksOpened: [],
      audioPlayed: { count: 0, recent: [] }, streak: { current: 0, longest: 0, lastDay: null }, xp: 0, studyDays: [], updatedAt: null };
  }

  var S = {
    ready: false,
    mode: 'local',           // 'server' | 'local'
    user: null,              // {id,username,displayName,role,...}
    progress: emptyProgress(),
    settings: {
      uiLanguage: 'en', learningLanguage: 'zh-CN', translationLanguage: 'en',
      pinyinPreference: 'always',      // always | click | hidden
      characterPreference: 'simplified', // simplified | traditional | both
      translationDisplayMode: 'always',  // always | click | hidden
      dailyGoalMinutes: 30,
    },
    _waiters: [], _saveTimer: null,
  };

  function progKey() { return 'hx_prog_' + ((S.user && S.user.username) || 'anon'); }
  function setKey() { return 'hx_settings_' + ((S.user && S.user.username) || 'anon'); }
  function saveCache() {
    try {
      if (S.user) {
        localStorage.setItem(progKey(), JSON.stringify(S.progress));
        localStorage.setItem(setKey(), JSON.stringify(S.settings));
        localStorage.setItem('hx_last_user', JSON.stringify({ username: S.user.username, displayName: S.user.displayName, role: S.user.role }));
      }
    } catch (e) {}
  }
  function loadCache() {
    try {
      var p = localStorage.getItem(progKey()); if (p) S.progress = mergeProgress(JSON.parse(p));
      var s = localStorage.getItem(setKey()); if (s) S.settings = Object.assign(S.settings, JSON.parse(s));
    } catch (e) {}
  }
  function mergeProgress(server) {
    var base = emptyProgress();
    if (!server || typeof server !== 'object') return base;
    base.known = server.known || {};
    base.quiz = server.quiz || base.quiz; if (!base.quiz.byLevel) base.quiz.byLevel = {};
    base.examsOpened = server.examsOpened || [];
    base.booksOpened = server.booksOpened || [];
    base.audioPlayed = server.audioPlayed || base.audioPlayed;
    base.streak = server.streak || base.streak;
    base.xp = server.xp || 0;
    base.studyDays = server.studyDays || [];
    base.updatedAt = server.updatedAt || null;
    return base;
  }

  function touch() {
    var p = S.progress, t = today();
    if (p.studyDays.indexOf(t) === -1) p.studyDays.push(t);
    var s = p.streak;
    if (s.lastDay !== t) {
      var y = new Date(Date.now() - 86400000); var ys = y.getFullYear() + '-' + pad(y.getMonth() + 1) + '-' + pad(y.getDate());
      s.current = (s.lastDay === ys) ? (s.current + 1) : 1;
      if (s.current > s.longest) s.longest = s.current;
      s.lastDay = t;
    }
  }

  var store = {
    state: S,
    whenReady: function (cb) { if (S.ready) cb(S); else S._waiters.push(cb); },
    known: function () { return S.progress.known || {}; },
    markKnown: function (word) { S.progress.known[word] = true; S.progress.xp = (S.progress.xp || 0) + 5; touch(); store.save(); },
    quizDone: function (level, correct, total) {
      var p = S.progress; p.quiz.taken += 1; p.quiz.correct += correct; p.quiz.answered += total;
      var k = String(level); p.quiz.byLevel[k] = p.quiz.byLevel[k] || { taken: 0, correct: 0, best: 0 };
      p.quiz.byLevel[k].taken += 1; p.quiz.byLevel[k].correct += correct;
      var pct = total ? Math.round((correct / total) * 100) : 0;
      if (pct > p.quiz.byLevel[k].best) p.quiz.byLevel[k].best = pct;
      p.xp = (p.xp || 0) + 10 + correct * 2;
      touch(); store.save(); store.log('quiz', 'HSK ' + level + ': ' + correct + '/' + total);
    },
    track: function (kind, id) {
      var p = S.progress;
      if (kind === 'exam') { if (p.examsOpened.indexOf(id) === -1) p.examsOpened.push(id); p.xp += 3; }
      else if (kind === 'book') { if (p.booksOpened.indexOf(id) === -1) p.booksOpened.push(id); p.xp += 3; }
      else if (kind === 'audio') { p.audioPlayed.count += 1; p.audioPlayed.recent.unshift(id); p.audioPlayed.recent = p.audioPlayed.recent.slice(0, 30); p.xp += 1; }
      touch(); store.save(); store.log(kind, id);
    },
    log: function (type, detail) { if (S.mode === 'server' && window.API) window.API.activity(type, String(detail || '').slice(0, 160)).catch(function () {}); },
    save: function () {
      saveCache();
      if (S.mode !== 'server' || !window.API) return;
      clearTimeout(S._saveTimer);
      S._saveTimer = setTimeout(function () { window.API.putProgress(S.progress).catch(function () {}); }, 800);
    },
    saveSettings: function () {
      saveCache();
      if (S.mode === 'server' && window.API) window.API.putSettings(S.settings).catch(function () {});
    },
    setSetting: function (k, v) { S.settings[k] = v; store.saveSettings(); },

    // bootstrap: load identity + progress + settings
    load: function () {
      return window.API.me().then(function (r) {
        if (r.ok && r.success) {
          S.mode = 'server'; S.user = r.data.user; S.progress = mergeProgress(r.data.progress);
          if (r.data.settings) S.settings = Object.assign(S.settings, r.data.settings);
          S.ready = true; saveCache();
          if (window.I18N && S.settings.uiLanguage) window.I18N.set(S.settings.uiLanguage);
          return true;
        }
        if (r.status === 401) window.API.clearToken();
        S.mode = 'server'; S.ready = true;
        return false;
      }).catch(function () {
        S.mode = 'local'; S.ready = true;
        try { S.user = JSON.parse(localStorage.getItem('hx_last_user') || 'null'); } catch (e) { S.user = null; }
        loadCache();
        return false;
      });
    },
    signIn: function (username, password, displayName) {
      var fn = displayName != null ? window.API.register(username, password, displayName) : window.API.login(username, password);
      return fn.then(function (r) {
        if (r.ok && r.success) {
          if (r.data && r.data.twoFA) return { ok: false, twoFA: true, challenge: r.data.challenge };
          window.API.setToken(r.data.token); return store.load().then(function () { return { ok: true, user: S.user }; });
        }
        return { ok: false, error: (r.error && r.error.message) || 'Sign-in failed', code: r.error && r.error.code };
      });
    },
    signOut: function () {
      window.API.clearToken();
      try { localStorage.removeItem(progKey()); localStorage.removeItem(setKey()); localStorage.removeItem('hx_last_user'); } catch (e) {}
      return window.API.logout().catch(function () {}).then(function () { location.reload(); });
    },
    waiters: function () { var w = S._waiters; S._waiters = []; return w; },
  };

  window.Store = store;
})();
