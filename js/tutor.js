/* 汉学课堂 — RAG tutor (Phase 5, offline). Retrieves from the local knowledge base
   (vocabulary + curated grammar) and composes a grounded answer. No network.
   When a real AI provider is configured later, this becomes the retrieval layer
   that feeds it context (Spec §63). */
(function () {
  'use strict';

  var GRAMMAR = [
    { keys: ['了', ' le '], title: '了 (le)', body: 'Used after a verb for completed actions, or at the end of a sentence for a change of state.', ex: '我吃了饭。Wǒ chī le fàn. — I ate.' },
    { keys: ['的', ' de '], title: '的 (de)', body: 'Possessive / attributive marker, like "\'s" or "of".', ex: '我的书。Wǒ de shū. — My book.' },
    { keys: ['把', ' ba '], title: '把 (bǎ)', body: 'Moves the object before the verb to show what is being acted on.', ex: '把书放在桌子上。Bǎ shū fàng zài zhuōzi shàng. — Put the book on the table.' },
    { keys: ['被', ' bei '], title: '被 (bèi)', body: 'Passive marker — "to be (done to)".', ex: '杯子被打破了。Bēizi bèi dǎpò le. — The cup was broken.' },
    { keys: ['tone', '声调', 'tones'], title: 'Tones', body: 'Mandarin has four tones plus a neutral tone: mā (1), má (2), mǎ (3), mà (4), ma (neutral).', ex: '妈 mā (mother), 麻 má (hemp), 马 mǎ (horse), 骂 mà (scold).' },
    { keys: ['pinyin', '拼音'], title: 'Pinyin', body: 'Romanization of Mandarin. "ü" is written "u" after j/q/x/y (ju, qu, xu, yu).', ex: '女 nǚ, 去 qù.' },
    { keys: ['measure', '量词', 'classifier'], title: 'Measure words', body: 'Nouns need a measure word after a number: 个, 本, 张, 只…', ex: '三个人 sān gè rén — three people.' },
  ];

  function norm(s) { return ' ' + String(s || '').toLowerCase() + ' '; }

  function answer(text) {
    text = String(text || '').trim();
    return Promise.resolve(window.Providers.knowledge.search(text, { limit: 3 })).then(function (hits) {
      var g = null;
      var n = norm(text);
      for (var i = 0; i < GRAMMAR.length; i++) {
        if (GRAMMAR[i].keys.some(function (k) { return n.indexOf(k.toLowerCase()) !== -1; })) { g = GRAMMAR[i]; break; }
      }
      if (hits && hits.length) {
        var w = hits[0];
        return {
          kind: 'vocab',
          cn: '我们来看这个词：' + w.hanzi,
          pin: w.pinyin || '',
          tr: (w.meaning || '') + (w.hskLevel ? '  (HSK ' + w.hskLevel + ')' : ''),
          more: hits.slice(1).map(function (h) { return h.hanzi + ' ' + (h.pinyin || ''); }),
        };
      }
      if (g) return { kind: 'grammar', cn: g.title, pin: '', tr: g.body, ex: g.ex };
      return {
        kind: 'none', cn: '', offline: true,
        tr: 'I can explain vocabulary and grammar, and drill HSK words. Try a word (学习, 朋友) or grammar (了, 把, tones).',
      };
    });
  }

  window.Tutor = { answer: answer, grammar: GRAMMAR };
})();
