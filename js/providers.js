/* 汉学课堂 — local provider abstractions.
   This is a self-contained, offline study app: no network calls and no external
   services. These local implementations power translation lookup, offline
   speech, and vocabulary retrieval used by the study features. */
(function () {
  'use strict';

  // ── TranslationProvider ──
  // translate(text, source, target) -> Promise<{ text, quality }>
  function MockTranslationProvider() { this.name = 'local'; this.isMock = true; }
  MockTranslationProvider.prototype.translate = function (text, source, target) {
    // Placeholder: never pretends to translate.
    return Promise.resolve({ text: '[' + source + '→' + target + '] ' + text, quality: 'LOCAL', provider: 'local' });
  };

  // ── SpeechToTextProvider / TextToSpeechProvider ──
  function MockSpeechProvider() { this.name = 'local'; this.isMock = true; }
  MockSpeechProvider.prototype.transcribe = function () {
    return Promise.resolve({ text: '', confidence: null, quality: 'LOCAL' });
  };
  MockSpeechProvider.prototype.speak = function () {
    return Promise.resolve({ audioUrl: null, quality: 'LOCAL' });
  };

  // ── KnowledgeRetriever — local keyword retriever over the vocabulary dataset ──
  function LocalKnowledgeRetriever() { this.name = 'local'; this.isMock = true; }
  LocalKnowledgeRetriever.prototype.search = function (query, opts) {
    opts = opts || {};
    var out = [];
    var q = String(query || '').trim().toLowerCase();
    if (!q) return Promise.resolve(out);
    var vocab = (window.VOCAB || {});
    Object.keys(vocab).forEach(function (lvl) {
      (vocab[lvl] || []).forEach(function (w) {
        if (out.length >= (opts.limit || 5)) return;
        if ((w.s + ' ' + (w.p || '') + ' ' + w.d).toLowerCase().indexOf(q) !== -1) {
          out.push({ type: 'vocabulary', id: w.s, hanzi: w.s, pinyin: w.p, meaning: w.d, hskLevel: Number(lvl) });
        }
      });
    });
    return Promise.resolve(out.slice(0, opts.limit || 5));
  };

  // Provider registry — the app pulls providers from here, never instantiates
  // a concrete provider directly.
  var Providers = {
    translation: null, speech: null, knowledge: null,
    init: function () {
      Providers.translation = new MockTranslationProvider();
      Providers.speech = new MockSpeechProvider();
      Providers.knowledge = new LocalKnowledgeRetriever();
      return Providers;
    },
  };

  Providers.init();
  window.Providers = Providers;
  window.ProviderTypes = { MockTranslationProvider: MockTranslationProvider, MockSpeechProvider: MockSpeechProvider, LocalKnowledgeRetriever: LocalKnowledgeRetriever };
})();
