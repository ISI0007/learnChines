/* 汉学课堂 — learner-side translation display layer (Spec §29/§30/§79).
   Loads admin-authored vocabulary translations for the learner's chosen
   translation language and exposes the meaning to render. Never replaces the
   Chinese source, and never invents a translation: if none is published for the
   chosen language, the built-in English gloss is used. Offline (single local call). */
(function () {
  'use strict';
  if (!window.API) return;

  var store = { lang: null, map: {}, loading: false };
  var listeners = [];

  function currentLang() {
    return (window.Settings ? window.Settings.get().translationLanguage : null) || 'en';
  }

  function emit() {
    if (window.document) document.dispatchEvent(new CustomEvent('hx:translations'));
    listeners.slice().forEach(function (fn) { try { fn(); } catch (e) {} });
  }

  function load() {
    var lang = currentLang();
    if (lang === store.lang && !store.loading) { emit(); return Promise.resolve(); }
    if (!lang) return Promise.resolve();
    store.lang = lang;
    store.loading = true;
    return API.translations(lang).then(function (r) {
      store.loading = false;
      store.map = (r.ok && r.success && r.data && r.data.translations) ? r.data.translations : {};
      emit();
    }).catch(function () { store.loading = false; store.map = {}; emit(); });
  }

  var T = {
    ready: function () {
      return load();
    },
    refresh: load,
    onChange: function (fn) { listeners.push(fn); },
    get lang() { return store.lang || currentLang(); },
    count: function () { return Object.keys(store.map).length; },
    has: function (w) { return !!(w && store.map[w.s]); },
    // Localized meaning for a vocab word {s,d}. Falls back to the English gloss.
    meaning: function (w) {
      if (!w) return '';
      var t = store.map[w.s];
      return (t && t.m) ? t.m : (w.d || '');
    },
    explanation: function (w) { var t = store.map[w && w.s]; return (t && t.x) ? t.x : ''; },
    example: function (w) { var t = store.map[w && w.s]; return (t && t.e) ? t.e : ''; },
  };

  window.HxI18n = T;

  // Fetch once the session is ready; re-fetch when the learner switches language.
  if (window.Store && window.Store.whenReady) window.Store.whenReady(function () { load(); });
})();
