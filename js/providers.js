/* 汉学课堂 — provider abstractions + local mock implementations.
   Spec §35 (TranslationProvider), §50 (STT/TTS), §63 (AIProvider), §102 (must run with no credentials).
   Real adapters (OpenAI-compatible, etc.) plug in here later; every provider MUST have a mock. */
(function () {
  'use strict';

  // ── AIProvider ──
  // chat(request) -> Promise<{ text, model, provider }>
  // stream(request) -> AsyncIterable<string>  (not implemented by the local mock)
  function MockAIProvider() {
    this.name = 'mock'; this.isMock = true;
  }
  MockAIProvider.prototype.chat = function (req) {
    var msg = (req && req.messages && req.messages.length) ? req.messages[req.messages.length - 1].content : '';
    var lang = (req && req.language) || 'en';
    var text = window.I18N ? window.I18N.t('msg.demoMode') : 'Demo mode — no AI provider configured.';
    return Promise.resolve({ text: text + (msg ? ('\n\n(echo: ' + msg + ')') : ''), model: 'mock-1', provider: 'mock' });
  };
  MockAIProvider.prototype.stream = function () {
    var err = new Error('Streaming is not available in the mock provider');
    return { [Symbol.asyncIterator]: function () { return { next: function () { return Promise.reject(err); } }; } };
  };

  // ── TranslationProvider ──
  // translate(text, source, target) -> Promise<{ text, quality }>
  function MockTranslationProvider() { this.name = 'mock'; this.isMock = true; }
  MockTranslationProvider.prototype.translate = function (text, source, target) {
    // Honest mock: returns a clearly-marked placeholder, never pretends to translate.
    return Promise.resolve({ text: '[' + source + '→' + target + '] ' + text, quality: 'MOCK', provider: 'mock' });
  };

  // ── SpeechToTextProvider / TextToSpeechProvider ──
  function MockSpeechProvider() { this.name = 'mock'; this.isMock = true; }
  MockSpeechProvider.prototype.transcribe = function () {
    return Promise.resolve({ text: '', confidence: null, quality: 'MOCK' });
  };
  MockSpeechProvider.prototype.speak = function () {
    return Promise.resolve({ audioUrl: null, quality: 'MOCK' });
  };

  // ── KnowledgeRetriever (RAG) — Phase 6; local keyword retriever over the vocab dataset ──
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
  // a concrete provider directly (Spec §63/§128: no coupling to one provider).
  var Providers = {
    ai: null, translation: null, speech: null, knowledge: null,
    config: { mode: 'mock' },
    init: function (cfg) {
      cfg = cfg || {};
      Providers.config = cfg;
      // No credentials configured anywhere yet → mock everything (Spec §102).
      Providers.ai = cfg.ai && cfg.ai.apiKey ? null : new MockAIProvider();
      Providers.translation = cfg.translation && cfg.translation.apiKey ? null : new MockTranslationProvider();
      Providers.speech = cfg.speech && cfg.speech.apiKey ? null : new MockSpeechProvider();
      Providers.knowledge = new LocalKnowledgeRetriever();
      Providers.isDemo = !(cfg.ai && cfg.ai.apiKey);
      return Providers;
    },
    // true when running without a real AI provider, so the UI can show the demo banner.
    isDemo: function () { return Providers.config.mode !== 'real'; },
  };

  Providers.init({});
  window.Providers = Providers;
  window.ProviderTypes = { MockAIProvider: MockAIProvider, MockTranslationProvider: MockTranslationProvider, MockSpeechProvider: MockSpeechProvider, LocalKnowledgeRetriever: LocalKnowledgeRetriever };
})();
