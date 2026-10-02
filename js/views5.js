/* 汉学课堂 — Phase 4 practice/quiz views: flashcards (flip), multiple-choice,
   listening, typing, and a session runner with an end summary. Persists via Store.
   Depends on: Quiz, Vocab, Store, Settings, UI, Art. */
(function () {
  'use strict';

  var U, S;
  function bind() { U = window.UI; S = window.Settings; }
  function el(tag, cls, html) { return U.el(tag, cls, html); }
  function go(p) { window.Router.go(p); }
  function esc(s) { return U.esc(s); }
  function t(k) { return window.I18N ? window.I18N.t(k) : k; }
  function speak(text) {
    try {
      if (!('speechSynthesis' in window)) return false;
      var u = new SpeechSynthesisUtterance(text); u.lang = 'zh-CN'; u.rate = 0.85;
      speechSynthesis.cancel(); speechSynthesis.speak(u); return true;
    } catch (e) { return false; }
  }
  function h1(title, sub) {
    var w = el('div', 'section');
    w.appendChild(el('h1', 'ui-h1', esc(title)));
    if (sub) w.appendChild(el('p', 'ui-muted', esc(sub)));
    return w;
  }

  // ── mode chooser ──
  var MODES = [
    { id: 'flashcard', name: 'Flashcards', ic: '🃏', desc: 'Flip a card, rate how well you knew it.', color: 'var(--sky)' },
    { id: 'choice', name: 'Multiple choice', ic: '🔘', desc: 'Pick the correct meaning.', color: 'var(--mint)' },
    { id: 'listen', name: 'Listening', ic: '🎧', desc: 'Hear the word, choose the character.', color: 'var(--lav)' },
    { id: 'type', name: 'Typing', ic: '⌨️', desc: 'Type the pinyin from the character.', color: 'var(--amber)' },
  ];

  function levelChips(selected, onChange) {
    var chips = el('div', 'hx-chips');
    [{ v: 0, l: 'All levels' }, { v: 1, l: 'HSK 1' }, { v: 2, l: 'HSK 2' }, { v: 3, l: 'HSK 3' }, { v: 4, l: 'HSK 4' }, { v: 5, l: 'HSK 5' }].forEach(function (c) {
      chips.appendChild(U.chip(c.l, { level: c.v || null, active: selected === c.v, onClick: function () { onChange(c.v); } }));
    });
    return chips;
  }

  function practice(mount) {
    bind();
    var lvl = (/([?&])level=(\d)/.exec(window.location.hash) || [])[2];
    var selected = lvl ? Number(lvl) : 0;
    var wrap = h1('Practice', 'Spaced repetition over 2,501 HSK words. Your review schedule is saved to your account.');

    // due summary
    var hero = el('div', 'ui-card');
    hero.style.display = 'flex'; hero.style.alignItems = 'center'; hero.style.gap = '18px';
    hero.style.flexWrap = 'wrap'; hero.style.marginTop = '14px';
    var due = window.Quiz.dueCount(selected || null);
    var fresh = window.Quiz.newCount(selected || null);
    var num = el('div'); num.style.flex = '1';
    num.appendChild(el('div', 'ui-stat-num', String(due)));
    num.appendChild(el('div', 'ui-stat-lbl', 'cards due for review'));
    num.appendChild(el('div', 'ui-stat-sub', fresh + ' new words available'));
    hero.appendChild(num);
    hero.appendChild(U.button('Start review', { variant: 'primary', onClick: function () { run('flashcard', selected, Math.min(20, Math.max(1, due || 10))); } }));
    hero.appendChild(U.button('Learn new', { onClick: function () { run('flashcard', selected, 10, true); } }));
    wrap.appendChild(hero);

    var lc = el('div'); lc.style.marginTop = '16px';
    lc.appendChild(levelChips(selected, function (v) { go('/practice?level=' + v); }));
    wrap.appendChild(lc);

    // modes
    wrap.appendChild(U.sectionHead('Modes'));
    var g = el('div', 'ui-grid cols-4');
    MODES.forEach(function (m) {
      var c = el('div', 'ui-card hx-course');
      var ic = el('div', 'hx-cat-ic'); ic.style.background = m.color; ic.textContent = m.ic; ic.style.fontSize = '24px';
      c.appendChild(ic);
      c.appendChild(el('div', 'ui-h3', m.name));
      c.appendChild(el('div', 'ui-stat-sub', m.desc));
      var row = el('div', 'ui-row'); row.style.marginTop = '12px';
      row.appendChild(U.button('Start', { variant: 'primary', onClick: function () { run(m.id, selected, 10); } }));
      c.appendChild(row);
      g.appendChild(c);
    });
    wrap.appendChild(g);

    // links
    var other = el('div', 'ui-row'); other.style.marginTop = '18px';
    other.appendChild(U.button('Browse vocabulary', { onClick: function () { go('/vocabulary'); } }));
    other.appendChild(U.button('HSK mock exams', { onClick: function () { go('/exams'); } }));
    wrap.appendChild(other);

    mount.appendChild(wrap);
  }

  // ── session runner ──
  function run(mode, level, count, learnNew) {
    var stack = window.Quiz.queue(level || null, count || 10);
    if (learnNew) {
      var pool = level ? window.Vocab.list(level) : window.Vocab.all();
      var fresh = pool.filter(function (w) { return window.Quiz.rec(w.s).seen === 0; });
      stack = window.Quiz.shuffle(fresh).slice(0, count || 10);
    }
    if (!stack.length) { U.toast('No cards for this selection'); return; }
    // hand the stack to the study view via a short-lived global, then navigate once
    window.__study = { mode: mode, level: level || 0, stack: stack };
    window.Router.go('/study/' + mode);
  }

  function study(mount, mode) {
    bind();
    var state = window.__study;
    if (!state || state.mode !== mode) {
      // rebuild from query if the page was reloaded
      state = { mode: mode, level: 0, stack: window.Quiz.queue(null, 10) };
      window.__study = state;
    }
    var stack = state.stack.slice();
    var idx = 0, correct = 0, answered = 0, level = state.level;
    var wrap = el('div', 'section');

    var top = el('div', 'ui-row');
    var back = U.button('← Practice', { onClick: function () { go('/practice'); } });
    top.appendChild(back);
    var prog = el('div'); prog.style.flex = '1';
    var bar = U.progressBar(0); prog.appendChild(bar);
    top.appendChild(prog);
    var counter = el('span', 'ui-muted', '0 / ' + stack.length);
    top.appendChild(counter);
    wrap.appendChild(top);

    var stage = el('div', 'ui-card'); stage.style.marginTop = '16px'; stage.style.minHeight = '300px';
    wrap.appendChild(stage);

    function setProgress() { U.clear(prog); prog.appendChild(U.progressBar((idx / stack.length) * 100)); counter.textContent = idx + ' / ' + stack.length; }

    function next() {
      if (idx >= stack.length) return finish();
      var w = stack[idx];
      setProgress();
      U.clear(stage);
      if (mode === 'flashcard') renderFlash(stage, w, next);
      else if (mode === 'choice') renderChoice(stage, w, level, next, function (ok) { answered++; if (ok) correct++; });
      else if (mode === 'listen') renderListen(stage, w, level, next, function (ok) { answered++; if (ok) correct++; });
      else renderType(stage, w, next, function (ok) { answered++; if (ok) correct++; });
      idx++;
    }

    function finish() {
      U.clear(stage);
      var pct = stack.length ? Math.round((correct / Math.max(1, stack.length)) * 100) : 0;
      stage.appendChild(el('div', 'ui-state-ic', '🎉'));
      var title = el('div', 'ui-state-title', 'Session complete');
      stage.appendChild(title);
      stage.appendChild(el('div', 'ui-state-sub', correct + ' correct of ' + stack.length + ' (' + pct + '%)'));
      window.Store.quizDone(level || 3, correct, stack.length);
      var row = el('div', 'ui-row'); row.style.justifyContent = 'center'; row.style.marginTop = '16px';
      row.appendChild(U.button('Practice again', { variant: 'primary', onClick: function () { go('/practice'); } }));
      row.appendChild(U.button('Back home', { onClick: function () { go('/'); } }));
      stage.appendChild(row);
      setProgress();
    }

    next();
    mount.appendChild(wrap);
  }

  // flashcard: flip + self-grade
  function renderFlash(stage, w, next) {
    var card = el('div', 'hx-flash');
    var face = el('div', 'hx-flash-face');
    face.appendChild(el('div', 'hx-flash-char', esc(window.Settings.surface(w))));
    var sp = el('button', 'hx-mini-btn', '🔊'); sp.addEventListener('click', function (e) { e.stopPropagation(); speak(w.s); });
    face.appendChild(sp);
    face.appendChild(el('div', 'ui-muted', 'Tap to reveal'));
    card.appendChild(face);
    stage.appendChild(card);

    var revealed = false, controls = el('div', 'ui-row'); controls.style.marginTop = '18px'; controls.style.justifyContent = 'center';
    function reveal() {
      if (revealed) return; revealed = true;
      U.clear(face);
      face.appendChild(el('div', 'hx-flash-char', esc(window.Settings.surface(w))));
      face.appendChild(el('div', 'hx-flash-pinyin', esc(w.p || '')));
      face.appendChild(el('div', 'hx-flash-def', esc(w.d || '')));
      var sp2 = el('button', 'hx-mini-btn', '🔊'); sp2.addEventListener('click', function (e) { e.stopPropagation(); speak(w.s); });
      face.appendChild(sp2);
      U.clear(controls);
      [['Again', 1], ['Hard', 3], ['Good', 4], ['Easy', 5]].forEach(function (g) {
        controls.appendChild(U.button(g[0], { variant: g[1] >= 4 ? 'primary' : '', onClick: function () {
          window.Quiz.grade(w.s, g[1]);
          if (g[1] >= 3) window.Store.markKnown(w.s);
          next();
        } }));
      });
    }
    card.addEventListener('click', reveal);
    stage.appendChild(controls);
  }

  // multiple choice: meaning
  function renderChoice(stage, w, level, next, cb) {
    stage.appendChild(el('div', 'ui-h3', 'What does this mean?'));
    var big = el('div', 'hx-flash-char'); big.style.fontSize = '52px'; big.style.margin = '14px 0';
    big.textContent = window.Settings.surface(w);
    var sp = el('button', 'hx-mini-btn', '🔊'); sp.addEventListener('click', function () { speak(w.s); });
    stage.appendChild(big); stage.appendChild(sp);
    var opts = window.Quiz.shuffle([w].concat(window.Quiz.distractors(w, level, 3))).slice(0, 4);
    var wrapO = el('div'); wrapO.style.cssText = 'display:flex;flex-direction:column;gap:10px;margin-top:14px';
    opts.forEach(function (o, i) {
      var row = el('div', 'hx-opt');
      row.appendChild(el('div', 'key', String.fromCharCode(65 + i)));
      row.appendChild(el('div', 'ui-p', esc(o.d || '')));
      row.addEventListener('click', function () {
        if (stage._done) return; stage._done = true;
        var ok = o.s === w.s;
        row.classList.add(ok ? 'correct' : 'wrong');
        if (!ok) wrapO.querySelectorAll('.hx-opt').forEach(function (r, j) { if (opts[j].s === w.s) r.classList.add('correct'); });
        window.Quiz.grade(w.s, ok ? 4 : 1);
        if (ok) window.Store.markKnown(w.s);
        cb(ok);
        stage.appendChild(U.button('Next →', { variant: 'primary', block: true, onClick: next }));
      });
      wrapO.appendChild(row);
    });
    stage.appendChild(wrapO);
  }

  // listening: audio → choose character
  function renderListen(stage, w, level, next, cb) {
    stage.appendChild(el('div', 'ui-h3', 'Listen and choose the word'));
    var play = el('button', 'hx-audio-btn', '🔊');
    play.style.margin = '18px auto';
    play.addEventListener('click', function () { speak(w.s); });
    var holder = el('div'); holder.style.textAlign = 'center';
    holder.appendChild(play);
    stage.appendChild(holder);
    setTimeout(function () { speak(w.s); }, 250);
    var opts = window.Quiz.shuffle([w].concat(window.Quiz.distractors(w, level, 3))).slice(0, 4);
    var wrapO = el('div', 'ui-grid cols-2'); wrapO.style.marginTop = '14px';
    opts.forEach(function (o) {
      var row = el('div', 'hx-opt');
      row.style.justifyContent = 'center';
      row.appendChild(el('div', 'ui-h3', esc(window.Settings.surface(o))));
      row.addEventListener('click', function () {
        if (stage._done) return; stage._done = true;
        var ok = o.s === w.s;
        row.classList.add(ok ? 'correct' : 'wrong');
        window.Quiz.grade(w.s, ok ? 4 : 1);
        cb(ok);
        stage.appendChild(U.button('Next →', { variant: 'primary', block: true, onClick: next }));
      });
      wrapO.appendChild(row);
    });
    stage.appendChild(wrapO);
  }

  // typing: character → pinyin
  function renderType(stage, w, next, cb) {
    stage.appendChild(el('div', 'ui-h3', 'Type the pinyin'));
    var big = el('div', 'hx-flash-char'); big.style.fontSize = '56px'; big.style.margin = '10px 0 4px';
    big.textContent = window.Settings.surface(w);
    stage.appendChild(big);
    stage.appendChild(el('div', 'ui-stat-sub', esc(w.p || '').replace(/[a-zāáǎàēéěèīíǐìōóǒòūúǔùüǖǘǚǜ1-5]/gi, '·')));
    var input = el('input', 'hx-input'); input.type = 'text'; input.placeholder = 'e.g. ni hao'; input.style.marginTop = '14px';
    input.setAttribute('autocapitalize', 'off'); input.setAttribute('autocorrect', 'off'); input.spellcheck = false;
    stage.appendChild(input);
    var fb = el('div', 'ui-stat-sub'); fb.style.marginTop = '8px';
    var check = U.button('Check', { variant: 'primary', block: true, onClick: function () {
      var ok = window.Quiz.pinyinMatches(input.value, w);
      fb.textContent = ok ? '✅ Correct' : ('❌ Answer: ' + (w.p || ''));
      fb.style.color = ok ? 'var(--success)' : 'var(--danger)';
      window.Quiz.grade(w.s, ok ? 4 : 2);
      if (ok) window.Store.markKnown(w.s);
      cb(ok);
      input.disabled = true;
      stage.appendChild(U.button('Next →', { variant: 'primary', block: true, onClick: next }));
    } });
    input.addEventListener('keydown', function (e) { if (e.key === 'Enter') check.click(); });
    stage.appendChild(check);
    stage.appendChild(fb);
    input.focus();
  }

  window.Views5 = { practice: practice, study: study };
})();
