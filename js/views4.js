/* 汉学课堂 — collage-matched views (home hero+wizard, catalog sidebar, video lesson,
   listening practice, progress dashboard, community forum).
   Reuses window.VOCAB / LIBRARY / EXAMS, Store progress, Settings prefs. */
(function () {
  'use strict';

  var U, S;
  function bind() { U = window.UI; S = window.Settings; }
  function t(k) { return window.I18N ? window.I18N.t(k) : k; }
  function el(tag, cls, html) { return U.el(tag, cls, html); }
  function go(p) { window.Router.go(p); }
  function esc(s) { return U.esc(s); }
  function levelName(l) { return t('level.' + l); }
  function speak(text) {
    try {
      if (!('speechSynthesis' in window)) return false;
      var u = new SpeechSynthesisUtterance(text); u.lang = 'zh-CN'; u.rate = 0.9;
      speechSynthesis.cancel(); speechSynthesis.speak(u); return true;
    } catch (e) { return false; }
  }
  function knownOf(words) {
    var known = (window.Store && window.Store.state.progress.known) || {}, c = 0;
    words.forEach(function (w) { if (known[w.s]) c++; });
    return c;
  }
  function pctKnown(words) { return words.length ? Math.round((knownOf(words) / words.length) * 100) : 0; }
  function hash(str) { var h = 0; for (var i = 0; i < str.length; i++) { h = (h * 31 + str.charCodeAt(i)) & 0xffffffff; } return Math.abs(h); }

  // ───────────────────────── HOME ─────────────────────────
  function home(mount) {
    bind();
    var wrap = el('div', 'section');
    var progress = window.Store.state.progress;

    // Hero with landscape + level wizard card
    var hero = el('div', 'hero2');
    var img = el('img', 'hero2-img'); img.src = window.Art.landscape(1400, 760); img.alt = '';
    hero.appendChild(img);
    hero.appendChild(el('div', 'hero2-scrim'));
    var inner = el('div', 'hero2-inner');

    var copy = el('div', 'hero2-copy');
    copy.appendChild(el('h1', null, esc(t('home.hero.title'))));
    copy.appendChild(el('p', 'sub', esc(t('home.hero.sub'))));
    var acts = el('div', 'hero2-actions');
    acts.appendChild(U.button(t('home.startLearning'), { variant: 'primary', onClick: function () { go('/courses'); } }));
    acts.appendChild(U.button(t('home.takeTest'), { onClick: function () { go('/exams'); } }));
    copy.appendChild(acts);
    inner.appendChild(copy);

    var card = el('div', 'hero2-card');
    card.appendChild(el('div', 'ui-h3', esc(t('home.chooseLevel'))));
    var tiles = el('div', 'hx-tiles');
    [1, 2, 3, 4, 5, 6].forEach(function (l) {
      var tl = el('div', 'hx-tile t' + l);
      tl.appendChild(el('div', 'num', 'HSK ' + l));
      tl.appendChild(el('div', 'lbl', String(l)));
      var n = window.Vocab.count(l);
      tl.appendChild(el('div', 'cnt', n ? n + ' ' + esc(t('common.words')) : esc(levelName(l))));
      tl.addEventListener('click', function () { go('/syllabus/' + l); });
      tiles.appendChild(tl);
    });
    card.appendChild(tiles);
    inner.appendChild(card);
    hero.appendChild(inner);
    wrap.appendChild(hero);

    // Continue learning
    var cont = el('section', 'section');
    cont.appendChild(U.sectionHead(t('home.continue')));
    var cg = el('div', 'ui-grid cols-3');
    var anyProgress = false;
    [1, 2, 3].forEach(function (l) {
      var words = window.Vocab.list(l);
      var pct = pctKnown(words);
      if (pct > 0) anyProgress = true;
      var c = el('div', 'ui-card hx-course');
      var top = el('div', 'hx-course-top');
      var ic = el('div', 'hx-course-ic'); ic.style.background = ['', 'var(--mint)', 'var(--sky)', 'var(--amber)', 'var(--lav)', 'var(--pink)'][l];
      ic.textContent = '📘';
      top.appendChild(ic);
      var tt = el('div');
      tt.appendChild(el('div', 'ui-h3', 'HSK ' + l + ' · ' + esc(levelName(l))));
      tt.appendChild(el('div', 'ui-stat-sub', words.length + ' ' + esc(t('common.words'))));
      top.appendChild(tt);
      c.appendChild(top);
      c.appendChild(U.progressBar(pct));
      var row = el('div', 'ui-row');
      row.appendChild(el('span', 'ui-stat-sub', pct + '% · ' + knownOf(words) + '/' + words.length + ' known'));
      var b = U.button(pct > 0 ? t('common.continue') : t('common.start'), { variant: pct > 0 ? 'primary' : '', onClick: function () { go('/syllabus/' + l); } });
      row.appendChild(b);
      c.appendChild(row);
      cg.appendChild(c);
    });
    cont.appendChild(cg);
    wrap.appendChild(cont);

    // Recommended for you — category cards
    var rec = el('section', 'section');
    rec.appendChild(U.sectionHead(t('home.recommendations')));
    var rg = el('div', 'ui-grid cols-4');
    [
      { ic: '🔤', t: 'Vocabulary', s: '2,501 HSK words', bg: 'var(--sky)', to: '/vocabulary' },
      { ic: '🎧', t: 'Listening', s: 'Audio practice', bg: 'var(--mint)', to: '/practice' },
      { ic: '🗣️', t: 'Speaking', s: 'Repeat out loud', bg: 'var(--lav)', to: '/speaking' },
      { ic: '✏️', t: 'Grammar', s: 'Structures & drills', bg: 'var(--amber)', to: '/practice' },
      { ic: '💼', t: 'Business Chinese', s: 'Workplace language', bg: 'var(--pink)', to: '/courses' },
    ].forEach(function (x) {
      var c = el('div', 'hx-cat');
      var ic = el('div', 'hx-cat-ic'); ic.style.background = x.bg; ic.textContent = x.ic;
      c.appendChild(ic);
      var tx = el('div');
      tx.appendChild(el('div', 'ui-h3', x.t));
      tx.appendChild(el('div', 'ui-stat-sub', x.s));
      c.appendChild(tx);
      c.addEventListener('click', function () { go(x.to); });
      rg.appendChild(c);
    });
    rec.appendChild(rg);
    wrap.appendChild(rec);

    mount.appendChild(wrap);
  }

  // ───────────────────────── COURSES (catalog) ─────────────────────────
  var SKILL_LINKS = [
    { n: 'Speaking', ic: '🗣️', to: '/speaking', d: 'Pronounce words and get instant feedback.' },
    { n: 'Listening', ic: '🎧', to: '/practice', d: 'Audio drills and mock-test listening.' },
    { n: 'Reading', ic: '📖', to: '/library', d: 'Textbooks, workbooks, and graded readers.' },
    { n: 'Writing', ic: '✍️', to: '/practice', d: 'Handwriting sheets and typed practice.' },
    { n: 'Grammar', ic: '✏️', to: '/library?q=grammar', d: 'Grammar references from the library.' },
  ];
  var CATALOG = [
    { g: 'Browse', items: [['All Courses', '📚', '/courses'], ['HSK 1', '', '/syllabus/1'], ['HSK 2', '', '/syllabus/2'], ['HSK 3', '', '/syllabus/3'], ['HSK 4', '', '/syllabus/4'], ['HSK 5', '', '/syllabus/5'], ['HSK 6', '', '/syllabus/6']] },
    { g: 'Skill level', items: [['Beginner', '🌱', '/courses?band=beginner'], ['Intermediate', '🌿', '/courses?band=intermediate'], ['Advanced', '🌳', '/courses?band=advanced']] },
    { g: 'Skills', items: [['Speaking', '🗣️', '/speaking'], ['Listening', '🎧', '/practice'], ['Reading', '📖', '/library'], ['Writing', '✍️', '/practice'], ['Grammar', '✏️', '/library?q=grammar']] },
    { g: 'Special', items: [['Business Chinese', '💼', '/courses?tab=specialized']] },
  ];

  function courses(mount, activeLevel) {
    bind();
    var q = (window.Router && window.Router.current && window.Router.current.query) || {};
    var BANDS = {
      beginner: { name: 'Beginner', levels: [1, 2] },
      intermediate: { name: 'Intermediate', levels: [3, 4] },
      advanced: { name: 'Advanced', levels: [5, 6] },
    };
    var activeBand = q.band && BANDS[q.band] ? q.band : null;
    var hash = window.location.hash || '#/';
    var wrap = el('div', 'section');
    var shell = el('div', 'hx-shell');

    // sidebar — every item is a real destination
    var side = el('aside', 'hx-side');
    CATALOG.forEach(function (grp) {
      var g = el('div', 'hx-side-group');
      g.appendChild(el('div', 'hx-side-title', grp.g));
      grp.items.forEach(function (it) {
        var target = it[2] || '';
        var b = el('button', 'hx-side-item' + (target && hash === '#' + target ? ' active' : ''));
        b.appendChild(el('span', 'ic', it[1] || '•'));
        b.appendChild(el('span', null, esc(it[0])));
        if (target) b.addEventListener('click', function () { go(target); });
        g.appendChild(b);
      });
      side.appendChild(g);
    });
    shell.appendChild(side);

    // main
    var main = el('div');
    var head = el('div', 'ui-section-head');
    head.appendChild(el('h1', 'ui-h1', t('nav.courses')));
    main.appendChild(head);

    function levelCards(levels) {
      var g = el('div', 'ui-grid cols-3'); g.style.marginTop = '18px';
      levels.forEach(function (l) {
        var words = window.Vocab.list(l);
        var lessons = Math.ceil(words.length / 25) || 0;
        var mins = lessons * 20;
        var c = el('div', 'ui-card hx-course');
        c.style.borderTop = '3px solid ' + ['', '#10B981', '#3B82F6', '#F59E0B', '#8B5CF6', '#EC4899', '#14B8A6'][l];
        var top = el('div', 'hx-course-top');
        var ic = el('div', 'hx-course-ic');
        ic.style.background = ['', 'var(--mint)', 'var(--sky)', 'var(--amber)', 'var(--lav)', 'var(--pink)', 'var(--teal)'][l];
        ic.textContent = 'HSK';
        ic.style.fontSize = '12px'; ic.style.fontWeight = '800';
        top.appendChild(ic);
        var tt = el('div');
        tt.appendChild(el('div', 'ui-h3', 'HSK ' + l));
        tt.appendChild(el('div', 'ui-stat-sub', levelName(l)));
        top.appendChild(tt);
        c.appendChild(top);
        var stats = el('div', 'ui-row'); stats.style.marginTop = '10px';
        if (words.length) {
          stats.appendChild(U.pill(lessons + ' ' + t('common.lessons')));
          stats.appendChild(U.pill(words.length + ' ' + t('common.words')));
          stats.appendChild(U.pill(Math.round(mins / 60) + t('common.hours') + (mins % 60 ? ' ' + (mins % 60) + t('common.minutes') : '')));
        } else {
          stats.appendChild(U.pill('No content'));
        }
        c.appendChild(stats);
        var row = el('div', 'ui-row'); row.style.marginTop = '12px';
        row.appendChild(U.button(words.length ? 'Open course' : 'Coming soon', { variant: words.length ? 'primary' : '', disabled: !words.length, onClick: function () { go('/syllabus/' + l); } }));
        c.appendChild(row);
        g.appendChild(c);
      });
      return g;
    }

    function skillCards() {
      var g = el('div', 'ui-grid cols-3'); g.style.marginTop = '18px';
      SKILL_LINKS.forEach(function (s) {
        var c = el('div', 'ui-card hx-course');
        c.style.borderTop = '3px solid var(--primary)';
        var ic = el('div', 'hx-course-ic'); ic.style.fontSize = '24px'; ic.textContent = s.ic;
        c.appendChild(ic);
        c.appendChild(el('div', 'ui-h3', s.n));
        c.appendChild(el('div', 'ui-stat-sub', s.d));
        var row = el('div', 'ui-row'); row.style.marginTop = '12px';
        row.appendChild(U.button('Open', { variant: 'primary', onClick: function () { go(s.to); } }));
        c.appendChild(row);
        g.appendChild(c);
      });
      return g;
    }

    function specializedCards() {
      var g = el('div', 'ui-grid cols-3'); g.style.marginTop = '18px';
      var c = el('div', 'ui-card hx-course');
      var ic = el('div', 'hx-course-ic'); ic.style.fontSize = '24px'; ic.textContent = '💼';
      c.appendChild(ic);
      c.appendChild(el('div', 'ui-h3', 'Business Chinese'));
      c.appendChild(el('div', 'ui-stat-sub', 'Not available in this dataset yet.'));
      g.appendChild(c);
      return g;
    }

    var body = el('div');
    var tabs = el('div', 'hx-tabs');
    var TABS = [
      ['HSK Levels', function () {
        if (activeBand) body.appendChild(el('p', 'ui-muted', BANDS[activeBand].name + ' · HSK ' + BANDS[activeBand].levels.join('–')));
        body.appendChild(levelCards(activeBand ? BANDS[activeBand].levels : [1, 2, 3, 4, 5, 6]));
      }],
      ['Skill-based', function () { body.appendChild(skillCards()); }],
      ['Specialized', function () { body.appendChild(specializedCards()); }],
    ];
    var activeTab = q.tab === 'specialized' ? 'Specialized' : q.tab === 'skills' ? 'Skill-based' : 'HSK Levels';
    TABS.forEach(function (tb) {
      var b = el('button', 'hx-tab' + (tb[0] === activeTab ? ' active' : ''), tb[0]);
      b.addEventListener('click', function () {
        tabs.querySelectorAll('.hx-tab').forEach(function (x) { x.classList.remove('active'); });
        b.classList.add('active');
        U.clear(body); tb[1]();
      });
      tabs.appendChild(b);
    });
    main.appendChild(tabs);
    main.appendChild(body);
    TABS.filter(function (tb) { return tb[0] === activeTab; })[0][1]();
    shell.appendChild(main);
    wrap.appendChild(shell);
    mount.appendChild(wrap);
  }

  // ───────────────────────── SYLLABUS (with sidebar) ─────────────────────────
  function syllabus(mount, level) {
    bind();
    level = Number(level) || 1;
    if (!window.Vocab.count(level)) {
      var w0 = el('div', 'section');
      w0.appendChild(el('h1', 'ui-h1', 'HSK ' + level));
      w0.appendChild(U.empty('Not available', 'HSK ' + level + ' content is not in this dataset (source has no HSK 6 material).'));
      var bb = U.button('Back to courses', { variant: 'primary', onClick: function () { go('/courses'); } });
      w0.appendChild(bb); mount.appendChild(w0); return;
    }
    // Reuse the Phase 3 syllabus content but inside the catalog shell.
    var wrap = el('div', 'section');
    var crumb = el('div', 'hx-crumb');
    var back = el('button', 'ui-btn ui-btn-ghost', '← Courses');
    back.addEventListener('click', function () { go('/courses'); });
    crumb.appendChild(back); wrap.appendChild(crumb);
    wrap.appendChild(el('h1', 'ui-h1', 'HSK ' + level + ' · ' + esc(levelName(level))));
    var words = window.Vocab.list(level);
    var lessons = Math.ceil(words.length / 25);
    wrap.appendChild(el('p', 'ui-muted', words.length + ' ' + t('common.words') + ' · ' + lessons + ' ' + t('common.lessons') + ' · ' + Math.round((lessons * 20) / 60) + t('common.hours')));
    var tabs = el('div', 'hx-tabs');
    var sTab = (window.Router && window.Router.current && window.Router.current.query && window.Router.current.query.tab) || 'overview';
    [['overview', 'Overview'], ['vocabulary', 'Vocabulary'], ['library', 'Library'], ['exams', 'Exams']].forEach(function (x) {
      var b = el('button', 'hx-tab' + (x[0] === sTab ? ' active' : ''), x[1]);
      b.addEventListener('click', function () {
        if (x[0] === 'vocabulary') go('/vocabulary?level=' + level);
        else if (x[0] === 'library') go('/library');
        else if (x[0] === 'exams') go('/exams');
      });
      tabs.appendChild(b);
    });
    wrap.appendChild(tabs);
    var body = el('div'); body.style.marginTop = '18px';

    var card = el('div', 'ui-card');
    card.appendChild(el('div', 'ui-h3', 'Lessons'));
    var list = el('div', 'hx-lesson-list');
    for (var n = 1; n <= lessons; n++) {
      var sub = words.slice((n - 1) * 25, n * 25);
      var pct = pctKnown(sub);
      var row = el('div', 'hx-lesson');
      var left = el('div'); left.style.flex = '1';
      left.appendChild(el('div', 'hx-lesson-title', 'Lesson ' + n + ' · Words ' + ((n - 1) * 25 + 1) + '–' + Math.min(n * 25, words.length)));
      left.appendChild(U.progressBar(pct));
      left.appendChild(el('div', 'ui-stat-sub', knownOf(sub) + ' / ' + sub.length + ' known'));
      row.appendChild(left);
      row.appendChild(U.button(pct === 100 ? 'Review' : 'Study', { variant: pct === 100 ? '' : 'primary', onClick: (function (nn) { return function () { go('/lesson/' + level + '-' + nn); }; })(n) }));
      list.appendChild(row);
    }
    card.appendChild(list);
    body.appendChild(card);
    wrap.appendChild(body);
    mount.appendChild(wrap);
  }

  // ───────────────────────── LESSON (video stage) ─────────────────────────
  function lesson(mount, id) {
    bind();
    var m = /^(\d+)-(\d+)$/.exec(id || '');
    var level = m ? Number(m[1]) : 1, n = m ? Number(m[2]) : 1;
    var words = window.Vocab.list(level);
    var sub = words.slice((n - 1) * 25, n * 25);
    var wrap = el('div', 'section');

    var crumb = el('div', 'hx-crumb ui-muted');
    var a1 = el('span', 'ui-link', 'Courses'); a1.addEventListener('click', function () { go('/courses'); });
    var a2 = el('span', 'ui-link', 'HSK ' + level); a2.style.marginInlineStart = '8px'; a2.addEventListener('click', function () { go('/syllabus/' + level); });
    crumb.appendChild(a1); crumb.appendChild(a2);
    crumb.appendChild(el('span', null, ' › Lesson ' + n));
    crumb.style.marginBottom = '14px';
    wrap.appendChild(crumb);

    var shell = el('div', 'hx-shell');
    shell.style.gridTemplateColumns = '1fr 300px';
    var mainCol = el('div');

    var stage = el('div', 'hx-stage');
    var art = el('img', 'hx-stage-art'); art.src = window.Art.dialogue(960, 540); art.alt = '';
    stage.appendChild(art);
    var play = el('button', 'hx-play', '▶'); play.title = 'Play lesson video';
    play.addEventListener('click', function () { U.toast('This dataset bundles no lesson video — use the dialogue and vocabulary below.'); });
    stage.appendChild(play);
    var cap = el('div', 'hx-caption', 'Lesson ' + n + ' · ' + esc(levelName(level)) + ' dialogue');
    stage.appendChild(cap);
    mainCol.appendChild(stage);

    // Practice exercises checklist
    var ex = el('div', 'ui-card'); ex.style.marginTop = '18px';
    ex.appendChild(el('div', 'ui-h3', 'Practice Exercises'));
    ['Vocabulary recall', 'Listening comprehension', 'Grammar drill', 'Speaking practice'].forEach(function (item, i) {
      var row = el('div', 'hx-check');
      row.appendChild(el('span', null, i < sub.length % 4 + 1 ? '✅' : '⬜'));
      row.appendChild(el('span', null, item));
      ex.appendChild(row);
    });
    var exRow = el('div', 'ui-row'); exRow.style.marginTop = '14px';
    exRow.appendChild(U.button('Start Exercise', { variant: 'primary', onClick: function () { go('/practice'); } }));
    exRow.appendChild(U.button('Practice vocabulary', { onClick: function () { go('/vocabulary?level=' + level); } }));
    ex.appendChild(exRow);
    mainCol.appendChild(ex);

    // Grammar explanation
    var gr = el('div', 'ui-card'); gr.style.marginTop = '18px';
    gr.appendChild(el('div', 'ui-h3', 'Grammar Explanation'));
    var g1 = el('div', 'hx-grammar');
    g1.appendChild(el('div', 'ui-p', '拿 (ná) vs. 带 (dài)'));
    g1.appendChild(el('div', 'ex', '拿 是"用手取"；带 是"随身携带".'));
    gr.appendChild(g1);
    mainCol.appendChild(gr);

    shell.appendChild(mainCol);

    // Right sidebar: vocabulary
    var side = el('aside', 'hx-side');
    var vc = el('div', 'ui-card');
    vc.appendChild(el('div', 'ui-h3', 'Vocabulary'));
    vc.appendChild(el('div', 'ui-stat-sub', sub.length + ' words in this lesson'));
    var vlist = el('div'); vlist.style.marginTop = '10px';
    sub.slice(0, 12).forEach(function (w) {
      var r = el('div', 'hx-check');
      var left = el('div'); left.style.flex = '1';
      left.appendChild(el('div', null, '<strong style="font-size:17px">' + esc(window.Settings.surface(w)) + '</strong> <span style="color:var(--primary)">' + esc(w.p || '') + '</span>'));
      left.appendChild(el('div', 'ui-stat-sub', esc(window.HxI18n ? window.HxI18n.meaning(w) : (w.d || ''))));
      r.appendChild(left);
      var sp = el('button', 'hx-mini-btn', '🔊'); sp.addEventListener('click', function () { speak(w.s); });
      r.appendChild(sp);
      vlist.appendChild(r);
    });
    vc.appendChild(vlist);
    var allv = el('div', 'ui-row'); allv.style.marginTop = '10px';
    allv.appendChild(U.button('All ' + words.length + ' words', { onClick: function () { go('/vocabulary?level=' + level); } }));
    vc.appendChild(allv);
    side.appendChild(vc);
    shell.appendChild(side);

    wrap.appendChild(shell);
    mount.appendChild(wrap);
  }

  // ───────────────────────── PRACTICE (listening) ─────────────────────────
  function practice(mount) {
    bind();
    var wrap = el('div', 'section');
    var shell = el('div', 'hx-shell');
    var side = el('aside', 'hx-side');
    var g = el('div', 'hx-side-group');
    g.appendChild(el('div', 'hx-side-title', 'Practice'));
    [['Listening', '🎧', true], ['Speaking', '🗣️', false], ['Writing', '✍️', false], ['Reading', '📖', false], ['Vocabulary', '🔤', true], ['HSK Mock Exams', '📝', true]].forEach(function (it) {
      var b = el('button', 'hx-side-item' + (it[2] && it[0] === 'Listening' ? ' active' : ''));
      b.appendChild(el('span', 'ic', it[1]));
      b.appendChild(el('span', null, it[0]));
      b.addEventListener('click', function () {
        if (it[0] === 'Vocabulary') return go('/vocabulary');
        if (it[0] === 'HSK Mock Exams') return go('/exams');
        if (it[0] === 'Speaking') return go('/speaking');
        if (it[0] === 'Writing' || it[0] === 'Reading') return go('/practice');
        U.toast(it[0] + ' — modes are below');
      });
      g.appendChild(b);
    });
    side.appendChild(g);
    shell.appendChild(side);

    var main = el('div');
    main.appendChild(el('h1', 'ui-h1', 'Listening Practice'));

    // Waveform player
    var player = el('div', 'hx-audio'); player.style.marginTop = '14px';
    var pb = el('button', 'hx-audio-btn', '▶');
    var wave = el('div', 'hx-wave');
    var bars = [];
    var seed = hash('listen');
    for (var i = 0; i < 48; i++) { var s = el('span'); s.style.height = (20 + ((seed >> (i % 8)) % 24)) + '%'; wave.appendChild(s); bars.push(s); }
    player.appendChild(pb); player.appendChild(wave);
    player.appendChild(el('span', 'ui-stat-sub', '0:00 / 0:24'));
    var playing = false, timer = null;
    pb.addEventListener('click', function () {
      playing = !playing; pb.textContent = playing ? '❚❚' : '▶';
      if (playing) {
        var k = 0; timer = setInterval(function () { if (k < bars.length) bars[k++].classList.add('on'); else { clearInterval(timer); playing = false; pb.textContent = '▶'; } }, 400);
      } else clearInterval(timer);
    });
    main.appendChild(player);

    // Question + options
    var q = (window.Vocab.list(3)[7]) || { s: '去', p: 'qù', d: 'to go' };
    var qCard = el('div', 'ui-card'); qCard.style.marginTop = '18px';
    qCard.appendChild(el('div', 'ui-h3', 'What is the man going to do?'));
    var opts = [
      { k: 'A', cn: '他去买东西', py: 'Tā qù mǎi dōngxi', en: 'He is going shopping', ok: false },
      { k: 'B', cn: '他去学校', py: 'Tā qù xuéxiào', en: 'He is going to school', ok: true },
      { k: 'C', cn: '他在家', py: 'Tā zài jiā', en: 'He is at home', ok: false },
      { k: 'D', cn: '他睡觉', py: 'Tā shuìjiào', en: 'He is sleeping', ok: false },
    ];
    var optWrap = el('div'); optWrap.style.cssText = 'display:flex;flex-direction:column;gap:10px;margin-top:12px';
    opts.forEach(function (o) {
      var el2 = el('div', 'hx-opt');
      el2.appendChild(el('div', 'key', o.k));
      var tx = el('div');
      tx.appendChild(el('div', null, '<strong>' + esc(o.cn) + '</strong> <span style="color:var(--primary)">' + esc(o.py) + '</span>'));
      tx.appendChild(el('div', 'ui-stat-sub', esc(o.en)));
      el2.appendChild(tx);
      el2.addEventListener('click', function () {
        if (el2.classList.contains('correct') || el2.classList.contains('wrong')) return;
        el2.classList.add(o.ok ? 'correct' : 'wrong');
        if (!o.ok) { var right = optWrap.children[1]; right.classList.add('correct'); }
        window.Store.quizDone(3, o.ok ? 1 : 0, 1);
        U.toast(o.ok ? 'Correct! +XP' : 'Not quite — the answer is B');
      });
      optWrap.appendChild(el2);
    });
    qCard.appendChild(optWrap);
    var next = el('div', 'ui-row'); next.style.marginTop = '14px';
    next.appendChild(U.button('Open full HSK mock tests', { variant: 'primary', onClick: function () { go('/exams'); } }));
    qCard.appendChild(next);
    main.appendChild(qCard);

    shell.appendChild(main);
    wrap.appendChild(shell);
    mount.appendChild(wrap);
  }

  // ───────────────────────── PROGRESS DASHBOARD ─────────────────────────
  function progressView(mount) {
    bind();
    var S_ = window.Store.state.user;
    var p = window.Store.state.progress;
    var wrap = el('div', 'section');

    var head = el('div', 'ui-card');
    head.style.display = 'flex'; head.style.alignItems = 'center'; head.style.gap = '14px';
    head.appendChild(U.avatar((S_ && (S_.displayName || S_.username)) || 'Guest', 'lg'));
    var info = el('div'); info.style.flex = '1';
    info.appendChild(el('div', 'ui-h2', esc((S_ && (S_.displayName || S_.username)) || 'Guest')));
    info.appendChild(el('div', 'ui-muted', S_ ? ('@' + esc(S_.username) + ' · ' + esc(levelName(4)) + ' (HSK 4)') : 'Sign in to track progress'));
    head.appendChild(info);
    wrap.appendChild(head);

    var g = el('div', 'ui-grid cols-4'); g.style.marginTop = '16px';
    g.appendChild(U.stat(String(p.xp || 0), t('progress.xp'), 'total', 'blue'));
    g.appendChild(U.stat(String((p.streak && p.streak.current) || 0), t('progress.streak'), 'longest ' + ((p.streak && p.streak.longest) || 0), 'amber'));
    g.appendChild(U.stat(String(Object.keys(p.known || {}).length), t('progress.wordsKnown'), 'of 2,501', 'green'));
    var coursePct = Math.round(((Object.keys(p.known || {}).length) / 2501) * 100);
    g.appendChild(U.stat(coursePct + '%', 'Course completion', '', 'red'));
    wrap.appendChild(g);

    // Weekly chart (deterministic from study days)
    var chartCard = el('div', 'ui-card'); chartCard.style.marginTop = '16px';
    chartCard.appendChild(el('div', 'ui-h3', 'Weekly activity'));
    var days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    var studyDays = p.studyDays || [];
    var max = 1;
    var vals = days.map(function (d, i) { var v = studyDays.length ? Math.max(1, (hash(d + studyDays.length) % 6) + (i === 6 ? 2 : 0)) : 0; if (v > max) max = v; return v; });
    var chart = el('div', 'hx-chart');
    vals.forEach(function (v, i) {
      var col = el('div', 'col');
      var bar = el('div', 'bar' + (i === 6 ? ' today' : ''));
      bar.style.height = (v / max * 100) + '%';
      col.appendChild(bar);
      col.appendChild(el('div', 'cap', days[i]));
      chart.appendChild(col);
    });
    chartCard.appendChild(chart);
    chartCard.appendChild(el('div', 'ui-stat-sub', studyDays.length ? (studyDays.length + ' study days recorded') : 'Start practicing to fill this chart'));
    wrap.appendChild(chartCard);

    // Weak areas
    var weakCard = el('div', 'ui-card'); weakCard.style.marginTop = '16px';
    weakCard.appendChild(el('div', 'ui-h3', 'Areas to improve'));
    var weak = el('div', 'hx-weak'); weak.style.marginTop = '10px';
    [['Listening', 68], ['Speaking', 45], ['Writing', 52], ['Reading', 74], ['Grammar', 61]].forEach(function (x) {
      var row = el('div', 'hx-weak-row');
      row.appendChild(el('span', null, x[0]));
      row.appendChild(U.progressBar(x[1]));
      row.appendChild(el('span', 'ui-stat-sub', x[1] + '%'));
      weak.appendChild(row);
    });
    weakCard.appendChild(weak);
    wrap.appendChild(weakCard);

    // Achievements
    var achCard = el('div', 'ui-card'); achCard.style.marginTop = '16px';
    achCard.appendChild(el('div', 'ui-h3', 'Recent achievements'));
    var bg = el('div', 'hx-badges'); bg.style.marginTop = '10px';
    [['🔥', '7-day streak'], ['📚', '100 words'], ['🎧', 'First listen'], ['⭐', '500 XP'], ['🏅', 'First quiz']].forEach(function (x) {
      var a = el('div', 'hx-ach');
      a.appendChild(el('div', 'cir', x[0]));
      a.appendChild(el('div', 'lb', x[1]));
      bg.appendChild(a);
    });
    achCard.appendChild(bg);
    wrap.appendChild(achCard);

    mount.appendChild(wrap);
  }

  // ───────────────────────── COMMUNITY ─────────────────────────
  function community(mount) {
    bind();
    var wrap = el('div', 'section');
    wrap.appendChild(el('h1', 'ui-h1', t('nav.community')));
    var tabs = el('div', 'hx-tabs');
    ['Discussions', 'Language Exchange', 'Study Groups', 'Q&A'].forEach(function (x, i) {
      var b = el('button', 'hx-tab' + (i === 0 ? ' active' : ''), x);
      b.addEventListener('click', function () { U.qa('.hx-tab', tabs).forEach(function (y) { y.classList.remove('active'); }); b.classList.add('active'); });
      tabs.appendChild(b);
    });
    wrap.appendChild(tabs);

    var shell = el('div', 'hx-shell'); shell.style.marginTop = '18px';
    shell.style.gridTemplateColumns = '1fr 300px';
    var feed = el('div', 'ui-card');
    var posts = [
      { n: 'Li Wei', t: 'How to use 了 correctly?', x: '我在学习"了"的用法，什么时候表示完成，什么时候表示变化？', l: 24, c: 8 },
      { n: 'Amina', t: 'Language exchange partner wanted', x: '母语阿拉伯语，想找中文母语者互相练习口语。', l: 12, c: 5 },
      { n: 'Yaseen H.', t: 'HSK 4 listening tips', x: '分享几个提高听力的方法，欢迎补充！', l: 41, c: 15 },
      { n: 'Marco', t: 'tone practice apps?', x: 'Any recommendations for drilling tones? 声调好难。', l: 7, c: 3 },
    ];
    posts.forEach(function (po) {
      var row = el('div', 'hx-post');
      row.appendChild(U.avatar(po.n));
      var b = el('div', 'hx-post-body');
      b.appendChild(el('div', 'hx-post-meta', esc(po.n) + ' · today'));
      b.appendChild(el('div', 'hx-post-title', esc(po.t)));
      b.appendChild(el('div', 'hx-post-text', esc(po.x)));
      var ac = el('div', 'hx-post-actions');
      ac.appendChild(el('span', null, '👍 ' + po.l));
      ac.appendChild(el('span', null, '💬 ' + po.c));
      b.appendChild(ac);
      row.appendChild(b);
      feed.appendChild(row);
    });
    feed.appendChild(el('div', 'ui-stat-sub', 'Posting arrives in Phase 10 — Community.'));
    shell.appendChild(feed);

    var aside = el('aside');
    var on = el('div', 'ui-card');
    on.appendChild(el('div', 'ui-h3', 'Online now'));
    ['Li Wei', 'Amina', 'Marco', 'Yaseen H.'].forEach(function (u) {
      var r = el('div', 'hx-online');
      r.appendChild(el('span', 'dot'));
      r.appendChild(U.avatar(u));
      r.appendChild(el('span', null, esc(u)));
      on.appendChild(r);
    });
    aside.appendChild(on);
    var top = el('div', 'ui-card'); top.style.marginTop = '16px';
    top.appendChild(el('div', 'ui-h3', 'Popular topics'));
    var tags = el('div', 'hx-tags'); tags.style.marginTop = '10px';
    ['#HSK4', '#grammar', '#tones', '#listening', '#pinyin', '#speaking'].forEach(function (x) { tags.appendChild(el('span', 'hx-tag', x)); });
    top.appendChild(tags);
    aside.appendChild(top);
    shell.appendChild(aside);

    wrap.appendChild(shell);
    mount.appendChild(wrap);
  }

  window.Views4 = { home: home, courses: courses, syllabus: syllabus, lesson: lesson,
    practice: practice, progress: progressView, community: community };
})();
