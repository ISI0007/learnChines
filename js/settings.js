/* 汉学课堂 — language & display preferences (Phase 2, Spec §81).
   Three independent languages: interface / learning / translation. */
(function () {
  'use strict';

  var LEARNING = [
    { code: 'zh-CN', name: '简体中文 (Simplified)' },
    { code: 'zh-TW', name: '繁體中文 (Traditional)' },
  ];

  var Settings = {
    defaults: function () {
      return {
        uiLanguage: 'en', learningLanguage: 'zh-CN', translationLanguage: 'en',
        pinyinPreference: 'always', characterPreference: 'simplified',
        translationDisplayMode: 'always', dailyGoalMinutes: 30,
      };
    },
    get: function () { return (window.Store && window.Store.state.settings) || Settings.defaults(); },
    set: function (k, v) {
      if (!window.Store) return;
      window.Store.setSetting(k, v);
      if (k === 'uiLanguage' && window.I18N) window.I18N.set(v);
    },
    learningLanguages: LEARNING,
    translationLanguages: function () {
      var L = window.I18N ? window.I18N.locales : { en: { name: 'English' } };
      return Object.keys(L).map(function (c) { return { code: c, name: L[c].name }; });
    },
    // Apply character preference to a vocab word {s,t}.
    surface: function (w) {
      var pref = Settings.get().characterPreference;
      if (!w) return '';
      if (pref === 'traditional') return w.t || w.s || '';
      if (pref === 'both') return (w.t && w.t !== w.s) ? (w.s + ' / ' + w.t) : (w.s || '');
      return w.s || w.t || '';
    },
    // Whether pinyin is shown by default.
    showPinyin: function () { return Settings.get().pinyinPreference === 'always'; },
    showTranslation: function () { return Settings.get().translationDisplayMode === 'always'; },
  };

  window.Settings = Settings;
})();
