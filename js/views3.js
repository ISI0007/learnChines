/* 汉学课堂 — Phase 3 views: courses, syllabus, lessons, vocabulary, library, exams.
   Uses window.VOCAB / window.LIBRARY / window.EXAMS (embedded in js/data.js).
   Spec §13 (courses), §84 (vocab), §85 (library), §86 (exams). No dead UI (§101). */
(function () {
  'use strict';

  var U, V, S;
  function bind() { U = window.UI; V = window.Vocab; S = window.Settings; }
  function t(k, v) { return window.I18N ? window.I18N.t(k, v) : k; }
  function el(tag, cls, html) { return U.el(tag, cls, html); }

  function levelName(l) { return t('level.' + l); }
  function levelColor(l) { return ['', 'green', 'blue', 'amber', '', 'red', ''][l] || 'blue'; }

  // Deterministic lesson plan: chunk a level's vocab into ~25-word lessons.
  function lessonsFor(level) {
    var words = V.list(level), per = 25, out = [];
    for (var i = 0; i < words.length; i += per) {
      out.push({ n: out.length + 1, start: i, end: Math.min(i + per, words.length), words: words.slice(i, i + per) });
    }
    return out;
  }
  function lessonId(level, n) { return level + '-' + n; }

  function knownCount(words) {
    var known = (window.Store && window.Store.state.progress.known) || {}, c = 0;
    words.forEach(function (w) { if (known[w.s]) c++; });
    return c;
  }

  function speak(text) {
    try {
      if (!('speechSynthesis' in window)) return;
      var u = new SpeechSynthesisUtterance(text);
      u.lang = 'zh-CN'; u.rate = 0.9;
      speechSynthesis.cancel(); speechSynthesis.speak(u);
    } catch (e) {}
  }

  // ── word card ──
  function wordRow(w, opts) {
    opts = opts || {};
    var known = (window.Store && window.Store.state.progress.known) || {};
    var S_ = S.get();
    var row = el('div', 'hx-word');
    var main = el('div', 'hx-word-main');
    main.appendChild(el('div', 'hx-word-char', U.esc(S.surface(w))));
    var meta = el('div', 'hx-word-meta');
    if (S_.pinyinPreference !== 'hidden') meta.appendChild(el('span', 'hx-pinyin', U.esc(w.p || '')));
    if (S_.translationDisplayMode !== 'hidden') {
      var dTxt = (window.HxI18n ? window.HxI18n.meaning(w) : (w.d || ''));
      meta.appendChild(el('span', 'hx-def', U.esc(dTxt)));
      var xTxt = window.HxI18n ? window.HxI18n.explanation(w) : '';
      if (xTxt) { var xb = el('span', 'ui-muted', U.esc(xTxt)); xb.style.marginLeft = '8px'; meta.appendChild(xb); }
    }
    main.appendChild(meta);
    row.appendChild(main);

    var actions = el('div', 'hx-word-actions');
    var spk = el('button', 'hx-mini-btn'); spk.type = 'button'; spk.title = 'Listen'; spk.textContent = '🔊';
    spk.addEventListener('click', function () { speak(w.s); });
    actions.appendChild(spk);

    if (opts.known !== false) {
      var isKnown = !!known[w.s];
      var kb = el('button', 'hx-mini-btn' + (isKnown ? ' on' : ''));
      kb.type = 'button'; kb.textContent = isKnown ? '✓' : '+'; kb.title = isKnown ? 'Known' : 'Mark as known';
      kb.addEventListener('click', function () {
        window.Store.markKnown(w.s);
        kb.classList.add('on'); kb.textContent = '✓';
        window.UI.toast('Saved · +5 XP');
      });
      actions.appendChild(kb);
    }
    row.appendChild(actions);
    return row;
  }

  // ── level chooser card ──
  function levelCard(l, opts) {
    opts = opts || {};
    var c = el('div', 'ui-card hx-level-card');
    var head = el('div', 'ui-row');
    head.appendChild(el('span', 'ui-badge ' + levelColor(l) + 'ic', 'HSK ' + l));
    head.appendChild(el('span', 'ui-pill', U.esc(levelName(l))));
    c.appendChild(head);
    var n = V.count(l);
    c.appendChild(el('div', 'ui-stat-num', String(n)));
    c.appendChild(el('div', 'ui-stat-sub', U.esc(t('common.words'))));
    var acts = el('div', 'ui-row'); acts.style.marginTop = '14px';
    acts.appendChild(U.button(opts.cta || t('common.start'), { variant: 'primary', onClick: function () { window.Router.go('/syllabus/' + l); } }));
    c.appendChild(acts);
    return c;
  }

  // ───────────────────────── COURSES ─────────────────────────
  function courses(mount) {
    bind();
    var wrap = el('div', 'section');
    wrap.appendChild(el('h1', 'ui-h1', t('nav.courses')));
    wrap.appendChild(el('p', 'ui-muted', 'Structured HSK 1–5 courses. ' + V.total() + ' vocabulary items, ' + (window.LIBRARY.books || []).length + ' books, and ' + (window.EXAMS || []).length + ' mock exams.'));

    var tabs = el('div', 'hx-tabs');
    [['/syllabus/1', 'HSK 1'], ['/syllabus/2', 'HSK 2'], ['/syllabus/3', 'HSK 3'], ['/syllabus/4', 'HSK 4'], ['/syllabus/5', 'HSK 5']].forEach(function (x, i) {
      var b = el('button', 'hx-tab' + (i === 0 ? ' active' : ''), x[1]);
      b.addEventListener('click', function () { window.Router.go(x[0]); });
      tabs.appendChild(b);
    });
    wrap.appendChild(tabs);

    var g = el('div', 'ui-grid cols-3'); g.style.marginTop = '16px';
    [1, 2, 3, 4, 5].forEach(function (l) { g.appendChild(levelCard(l)); });
    wrap.appendChild(g);
    mount.appendChild(wrap);
  }

  // ───────────────────────── SYLLABUS (course detail) ─────────────────────────
  function syllabus(mount, level) {
    bind();
    level = Number(level) || 1;
    var tab = (/([?&])tab=([a-z]+)/i.exec(window.location.hash) || [])[2] || 'overview';
    var wrap = el('div', 'section');

    var crumb = el('div', 'hx-crumb');
    var back = el('button', 'ui-btn ui-btn-ghost', '← Courses');
    back.addEventListener('click', function () { window.Router.go('/courses'); });
    crumb.appendChild(back);
    wrap.appendChild(crumb);

    wrap.appendChild(el('h1', 'ui-h1', 'HSK ' + level + ' · ' + U.esc(levelName(level))));
    var lessons = lessonsFor(level);
    wrap.appendChild(el('p', 'ui-muted', V.count(level) + ' ' + t('common.words') + ' · ' + lessons.length + ' ' + t('common.lessons')));

    // tabs
    var tabs = el('div', 'hx-tabs');
    [['overview', 'Overview'], ['vocabulary', 'Vocabulary'], ['library', 'Library'], ['exams', 'Exams']].forEach(function (x) {
      var b = el('button', 'hx-tab' + (tab === x[0] ? ' active' : ''), x[1]);
      b.addEventListener('click', function () { window.Router.go('/syllabus/' + level + '?tab=' + x[0]); });
      tabs.appendChild(b);
    });
    wrap.appendChild(tabs);

    var body = el('div'); body.style.marginTop = '18px';
    wrap.appendChild(body);

    if (tab === 'vocabulary') { body.appendChild(vocabBlock(level)); }
    if (tab === 'library') { body.appendChild(bookGrid(level)); }
    if (tab === 'exams') { body.appendChild(examGrid(level)); }
    if (tab === 'overview') {
      var card = el('div', 'ui-card');
      card.appendChild(el('div', 'ui-h3', 'Lessons'));
      card.appendChild(el('p', 'ui-muted', 'Each lesson covers 25 words with audio and progress tracking.'));
      var list = el('div', 'hx-lesson-list');
      lessons.forEach(function (ls) {
        var known = knownCount(ls.words);
        var pct = ls.words.length ? Math.round((known / ls.words.length) * 100) : 0;
        var row = el('div', 'hx-lesson');
        var left = el('div'); left.style.flex = '1';
        left.appendChild(el('div', 'hx-lesson-title', 'Lesson ' + ls.n + ' · Words ' + (ls.start + 1) + '–' + ls.end));
        left.appendChild(U.progressBar(pct));
        left.appendChild(el('div', 'ui-stat-sub', known + ' / ' + ls.words.length + ' known'));
        row.appendChild(left);
        var go = U.button(pct === 100 ? 'Review' : 'Study', { variant: pct === 100 ? '' : 'primary', onClick: function () { window.Router.go('/lesson/' + lessonId(level, ls.n)); } });
        row.appendChild(go);
        list.appendChild(row);
      });
      card.appendChild(list);
      body.appendChild(card);
    }

    mount.appendChild(wrap);
  }

  function vocabBlock(level) {
    var box = el('div');
    var listWrap = el('div', 'hx-word-list');
    function render(q) {
      U.clear(listWrap);
      var words = q ? V.search(q, level) : V.list(level);
      if (!words.length) { listWrap.appendChild(U.empty('No words found', 'Try a different search.')); return; }
      words.slice(0, 400).forEach(function (w) { listWrap.appendChild(wordRow(w)); });
      if (words.length > 400) listWrap.appendChild(el('p', 'ui-muted', 'Showing first 400 of ' + words.length + '. Use search to narrow.'));
    }
    box.appendChild(vocabControls(level, render));
    box.appendChild(listWrap);
    setTimeout(function () { render(''); }, 0);
    return box;
  }

  function vocabControls(level, onSearch) {
    var bar = el('div', 'hx-vocab-bar');
    var input = el('input', 'hx-input'); input.type = 'search'; input.placeholder = 'Search ' + V.count(level) + ' words (character, pinyin, or meaning)…';
    var btn = U.button('Mark all known', { onClick: function () {
      V.list(level).forEach(function (w) { window.Store.markKnown(w.s); });
      window.UI.toast('Marked ' + V.count(level) + ' words known');
      onSearch(input.value);
    } });
    input.addEventListener('input', function () { onSearch(input.value); });
    bar.appendChild(input); bar.appendChild(btn);
    return bar;
  }

  // ───────────────────────── LESSON ─────────────────────────
  function lesson(mount, id) {
    bind();
    var m = /^(\d+)-(\d+)$/.exec(id || '');
    var level = m ? Number(m[1]) : 1, n = m ? Number(m[2]) : 1;
    var lessons = lessonsFor(level);
    var ls = lessons[n - 1] || lessons[0];
    var wrap = el('div', 'section');

    var crumb = el('div', 'hx-crumb');
    var back = el('button', 'ui-btn ui-btn-ghost', '← HSK ' + level);
    back.addEventListener('click', function () { window.Router.go('/syllabus/' + level); });
    crumb.appendChild(back);
    wrap.appendChild(crumb);

    if (!ls) { wrap.appendChild(U.empty('Lesson not found', 'This lesson has no vocabulary yet.')); mount.appendChild(wrap); return; }

    wrap.appendChild(el('h1', 'ui-h1', 'Lesson ' + ls.n));
    wrap.appendChild(el('p', 'ui-muted', 'HSK ' + level + ' · ' + ls.words.length + ' words · words ' + (ls.start + 1) + '–' + ls.end));

    var bar = el('div', 'hx-vocab-bar');
    var all = U.button('Mark all known', { onClick: function () {
      ls.words.forEach(function (w) { window.Store.markKnown(w.s); });
      window.Router.go('/lesson/' + lessonId(level, ls.n));
    } });
    var prac = U.button('Practice these words', { variant: 'primary', onClick: function () { window.Router.go('/vocabulary?level=' + level); } });
    bar.appendChild(all); bar.appendChild(prac);
    wrap.appendChild(bar);

    var list = el('div', 'hx-word-list');
    ls.words.forEach(function (w) { list.appendChild(wordRow(w)); });
    wrap.appendChild(list);

    // prev / next
    var nav = el('div', 'ui-row'); nav.style.marginTop = '18px';
    if (n > 1) { var p = U.button('← Lesson ' + (n - 1), { onClick: function () { window.Router.go('/lesson/' + lessonId(level, n - 1)); } }); nav.appendChild(p); }
    if (n < lessons.length) { var nx = U.button('Lesson ' + (n + 1) + ' →', { variant: 'primary', onClick: function () { window.Router.go('/lesson/' + lessonId(level, n + 1)); } }); nav.appendChild(nx); }
    wrap.appendChild(nav);

    mount.appendChild(wrap);
  }

  // ───────────────────────── VOCABULARY (global) ─────────────────────────
  function vocabulary(mount) {
    bind();
    var lvl = (/([?&])level=(\d)/.exec(window.location.hash) || [])[2];
    var selected = lvl ? Number(lvl) : 0; // 0 = all levels
    var wrap = el('div', 'section');
    wrap.appendChild(el('h1', 'ui-h1', t('common.vocabulary')));
    wrap.appendChild(el('p', 'ui-muted', V.total() + ' words across HSK 1–5. Track what you know.'));

    var chips = el('div', 'hx-chips');
    [{ v: 0, l: 'All levels' }, { v: 1, l: 'HSK 1' }, { v: 2, l: 'HSK 2' }, { v: 3, l: 'HSK 3' }, { v: 4, l: 'HSK 4' }, { v: 5, l: 'HSK 5' }].forEach(function (c) {
      var b = U.chip(c.l, { level: c.v || null, active: selected === c.v, onClick: function () { window.Router.go('/vocabulary?level=' + c.v); } });
      chips.appendChild(b);
    });
    wrap.appendChild(chips);

    var input = el('input', 'hx-input'); input.type = 'search'; input.placeholder = 'Search 2,501 words…'; input.style.marginTop = '14px';
    wrap.appendChild(input);

    var list = el('div', 'hx-word-list');
    wrap.appendChild(list);
    function render(q) {
      U.clear(list);
      var words = q ? V.search(q, selected || null) : (selected ? V.list(selected) : V.all());
      if (!words.length) { list.appendChild(U.empty('No matches', 'Try another word or meaning.')); return; }
      words.slice(0, 300).forEach(function (w) { list.appendChild(wordRow(w)); });
      if (words.length > 300) list.appendChild(el('p', 'ui-muted', 'Showing first 300 of ' + words.length + '.'));
    }
    input.addEventListener('input', function () { render(input.value); });
    render('');
    mount.appendChild(wrap);
  }

  // ───────────────────────── LIBRARY ─────────────────────────
  function bookGrid(level, q) {
    var U_ = U;
    var books = (window.LIBRARY.books || []).filter(function (b) { return !level || b.level === level; });
    if (q) {
      var needle = String(q).toLowerCase();
      books = books.filter(function (b) { return String(b.title || '').toLowerCase().indexOf(needle) !== -1; });
    }
    if (!books.length) return U_.empty('No books found', q ? 'Nothing matches “' + q + '”.' : (level ? 'No books imported for HSK ' + level + '.' : ''));
    var byLevel = {};
    books.forEach(function (b) { (byLevel[b.level] = byLevel[b.level] || []).push(b); });
    var box = el('div');
    Object.keys(byLevel).sort().forEach(function (lv) {
      box.appendChild(el('div', 'ui-h3', 'HSK ' + lv + (lv === '0' ? ' · Extra' : '')));
      var g = el('div', 'ui-grid cols-3'); g.style.margin = '10px 0 20px';
      byLevel[lv].forEach(function (b, i) {
        var idx = (window.LIBRARY.books || []).indexOf(b);
        var c = el('div', 'ui-card hx-book');
        c.appendChild(el('div', 'hx-book-ic', '📘'));
        c.appendChild(el('div', 'hx-book-title', U_.esc(b.title)));
        c.appendChild(el('div', 'ui-stat-sub', U_.fmtSize(b.size) + ' · PDF'));
        var row = el('div', 'ui-row'); row.style.marginTop = '10px';
        row.appendChild(U_.button('Open', { variant: 'primary', onClick: function () { window.Router.go('/book/' + idx); } }));
        var a = el('a', 'ui-btn'); a.href = encodeURI(b.path); a.target = '_blank'; a.rel = 'noopener'; a.textContent = '↗ PDF';
        row.appendChild(a);
        c.appendChild(row);
        g.appendChild(c);
      });
      box.appendChild(g);
    });
    return box;
  }

  function library(mount) {
    bind();
    var q = (window.Router && window.Router.current && window.Router.current.query && window.Router.current.query.q) || '';
    var wrap = el('div', 'section');
    wrap.appendChild(el('h1', 'ui-h1', 'Library'));
    wrap.appendChild(el('p', 'ui-muted', (window.LIBRARY.books || []).length + ' textbooks and workbooks, HSK 1–5.' +
      (q ? ' Filtered by “' + U.esc(q) + '”.' : '')));
    wrap.appendChild(bookGrid(0, q));
    mount.appendChild(wrap);
  }

  function book(mount, idx) {
    bind();
    var b = (window.LIBRARY.books || [])[Number(idx)];
    var wrap = el('div', 'section');
    var crumb = el('div', 'hx-crumb');
    var back = el('button', 'ui-btn ui-btn-ghost', '← Library');
    back.addEventListener('click', function () { window.Router.go('/library'); });
    crumb.appendChild(back); wrap.appendChild(crumb);
    if (!b) { wrap.appendChild(U.empty('Book not found', '')); mount.appendChild(wrap); return; }
    if (b.path) window.Store.track('book', b.path);
    wrap.appendChild(el('h1', 'ui-h1', U.esc(b.title)));
    wrap.appendChild(el('p', 'ui-muted', 'HSK ' + b.level + ' · ' + U.fmtSize(b.size)));
    var row = el('div', 'ui-row');
    var a = el('a', 'ui-btn ui-btn-primary'); a.href = encodeURI(b.path); a.target = '_blank'; a.rel = 'noopener'; a.textContent = 'Open PDF';
    row.appendChild(a);
    wrap.appendChild(row);
    var iframe = el('iframe', 'hx-frame');
    iframe.src = encodeURI(b.path);
    iframe.title = b.title;
    wrap.appendChild(iframe);
    mount.appendChild(wrap);
  }

  // ───────────────────────── EXAMS ─────────────────────────
  var ROLE_LABEL = { test: 'Test paper', answers: 'Answer key', listening: 'Listening audio', transcript: 'Transcript' };
  var ROLE_ICON = { test: '📝', answers: '✅', listening: '🎧', transcript: '📄' };

  function examGrid(level) {
    var exams = (window.EXAMS || []).filter(function (e) { return !level || e.level === level; });
    if (!exams.length) return U.empty('No exams yet', level ? 'No mock exams for HSK ' + level + ' (source has none).' : '');
    var byLevel = {};
    exams.forEach(function (e) { (byLevel[e.level] = byLevel[e.level] || []).push(e); });
    var box = el('div');
    Object.keys(byLevel).sort().forEach(function (lv) {
      box.appendChild(el('div', 'ui-h3', 'HSK ' + lv + ' · ' + byLevel[lv].length + ' sets'));
      var g = el('div', 'ui-grid cols-4'); g.style.margin = '10px 0 20px';
      byLevel[lv].forEach(function (e) {
        var c = el('div', 'ui-card hx-exam');
        c.appendChild(el('div', 'ui-row', '<span style="font-size:22px">📝</span><span class="ui-badge blue">' + U.esc(e.id) + '</span>'));
        var badges = el('div', 'ui-row'); badges.style.marginTop = '8px';
        ['test', 'answers', 'listening', 'transcript'].forEach(function (r) {
          if (e[r]) badges.appendChild(el('span', 'ui-badge', ROLE_ICON[r] + ' ' + ROLE_LABEL[r].split(' ')[0]));
        });
        c.appendChild(badges);
        var row = el('div', 'ui-row'); row.style.marginTop = '12px';
        row.appendChild(U.button('Open', { variant: 'primary', onClick: function () { window.Router.go('/exam/' + e.id); } }));
        c.appendChild(row);
        g.appendChild(c);
      });
      box.appendChild(g);
    });
    return box;
  }

  function exams(mount) {
    bind();
    var wrap = el('div', 'section');
    wrap.appendChild(el('h1', 'ui-h1', 'HSK Mock Tests'));
    wrap.appendChild(el('p', 'ui-muted', (window.EXAMS || []).length + ' exam sets with answer keys and listening audio.'));
    wrap.appendChild(examGrid(0));
    mount.appendChild(wrap);
  }

  function exam(mount, id) {
    bind();
    var e = (window.EXAMS || []).filter(function (x) { return x.id === id; })[0];
    var wrap = el('div', 'section');
    var crumb = el('div', 'hx-crumb');
    var back = el('button', 'ui-btn ui-btn-ghost', '← Exams');
    back.addEventListener('click', function () { window.Router.go('/exams'); });
    crumb.appendChild(back); wrap.appendChild(crumb);
    if (!e) { wrap.appendChild(U.empty('Exam not found', '')); mount.appendChild(wrap); return; }
    if (e.test && e.test.path) window.Store.track('exam', e.id);
    wrap.appendChild(el('h1', 'ui-h1', U.esc(e.id) + ' · HSK ' + e.level));
    wrap.appendChild(el('p', 'ui-muted', 'Official mock test set with answer key, listening audio, and transcript where available.'));

    var g = el('div', 'ui-grid cols-2');
    ['test', 'answers', 'listening', 'transcript'].forEach(function (r) {
      if (!e[r]) return;
      var card = el('div', 'ui-card');
      card.appendChild(el('div', 'ui-row', '<span style="font-size:22px">' + ROLE_ICON[r] + '</span><span class="ui-h3">' + ROLE_LABEL[r] + '</span>'));
      card.appendChild(el('div', 'ui-stat-sub', U.esc(e[r].name) + ' · ' + U.fmtSize(e[r].size)));
      var row = el('div', 'ui-row'); row.style.marginTop = '12px';
      var a = el('a', 'ui-btn ui-btn-primary'); a.href = encodeURI(e[r].path); a.target = '_blank'; a.rel = 'noopener';
      a.textContent = r === 'listening' ? 'Play' : (r === 'transcript' ? 'View transcript' : 'Open');
      row.appendChild(a);
      card.appendChild(row);
      g.appendChild(card);
    });
    wrap.appendChild(g);

    if (e.listening) {
      var player = el('div', 'ui-card'); player.style.marginTop = '16px';
      player.appendChild(el('div', 'ui-h3', 'Listening audio'));
      var audio = el('audio'); audio.controls = true; audio.preload = 'none';
      audio.src = encodeURI(e.listening.path);
      audio.style.width = '100%'; audio.style.marginTop = '8px';
      audio.addEventListener('play', function () { window.Store.track('audio', e.id); });
      player.appendChild(audio);
      wrap.appendChild(player);
    }
    mount.appendChild(wrap);
  }

  window.Views3 = { courses: courses, syllabus: syllabus, lesson: lesson, vocabulary: vocabulary,
    library: library, book: book, exams: exams, exam: exam };
})();
