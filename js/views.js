/* 汉学课堂 — Phase 1 views. Home shell + honest placeholders for later phases.
   Spec §12 (home), §101 (no dead UI), §123 (phases). All strings go through I18N. */
(function () {
  'use strict';

  var t = function (k, v) { return window.I18N ? window.I18N.t(k, v) : k; };
  var el = function (tag, cls, html) { return window.UI.el(tag, cls, html); };

  function levelInfo(l) {
    return { 1: 6, 2: 4, 3: 3, 4: 2, 5: 1 }[l] || 1; // placeholder lesson counts until course data exists
  }
  function vocabCount(l) { return ((window.VOCAB || {})[l] || []).length; }

  // A card that honestly states which phase delivers the feature (Spec §101).
  function phaseCard(title, desc, phase, icon) {
    var c = window.UI.card([
      el('div', 'ui-row', ''),
    ]);
    c.innerHTML = '';
    c.appendChild(el('div', null, '<div style="font-size:26px">' + (icon || '🧩') + '</div>'));
    c.appendChild(el('div', 'ui-h3', window.UI.esc(title)));
    c.appendChild(el('p', 'ui-muted', window.UI.esc(desc)));
    var row = el('div', 'ui-row'); row.style.marginTop = '10px';
    row.appendChild(window.UI.badge(phase, 'blue'));
    c.appendChild(row);
    return c;
  }

  function timeAgoShort(iso) {
    var d = (Date.now() - new Date(iso).getTime()) / 1000;
    if (d < 3600) return Math.max(1, Math.floor(d / 60)) + 'm ago';
    if (d < 86400) return Math.floor(d / 3600) + 'h ago';
    return Math.floor(d / 86400) + 'd ago';
  }

  var Views = {
    home: function (mount) {
      var U = window.UI;

      // Hero
      var hero = el('section', 'hero');
      hero.appendChild(el('h1', null, window.UI.esc(t('home.hero.title'))));
      hero.appendChild(el('p', 'sub', window.UI.esc(t('home.hero.sub'))));
      var actions = el('div', 'hero-actions');
      actions.appendChild(U.button(t('home.startLearning'), { variant: 'primary', onClick: function () { window.Router.go('/courses'); } }));
      actions.appendChild(U.button(t('home.takeTest'), { onClick: function () { window.Router.go('/exams'); } }));
      hero.appendChild(actions);
      mount.appendChild(hero);

      // HSK level selector (Spec §12)
      var lvl = el('section', 'section');
      lvl.appendChild(U.sectionHead(t('home.chooseLevel')));
      var grid = el('div', 'ui-grid cols-3');
      [1, 2, 3, 4, 5, 6].forEach(function (l) {
        var c = U.card([]);
        c.appendChild(el('div', 'ui-row', '<span class="ui-badge blue">HSK ' + l + '</span><span class="ui-pill">' + window.UI.esc(t('level.' + l)) + '</span>'));
        var big = el('div', 'ui-stat-num', String(vocabCount(l)));
        big.style.marginTop = '10px';
        c.appendChild(big);
        c.appendChild(el('div', 'ui-stat-sub', window.UI.esc(t('common.words')) + (l >= 5 ? ' · ' + window.UI.esc(t('common.lessons')) + ' ' + levelInfo(l) : '')));
        var cont = el('div'); cont.style.marginTop = '14px';
        cont.appendChild(U.button(t('common.start'), { variant: 'primary', onClick: function () { window.Router.go('/courses'); } }));
        c.appendChild(cont);
        grid.appendChild(c);
      });
      lvl.appendChild(grid);
      mount.appendChild(lvl);

      // Daily challenge (Spec §12) — uses a real word from the dataset
      var w = (window.Vocab && window.Vocab.daily()) || { s: '坚持', p: 'jiānchí', d: 'to persist' };
      var daily = el('section', 'section');
      daily.appendChild(U.sectionHead(t('home.daily.title')));
      var dc = U.card([]);
      dc.appendChild(el('div', 'ui-muted', window.UI.esc(t('home.daily.word'))));
      dc.appendChild(el('div', null, '<div style="font-size:40px;font-weight:800">' + window.UI.esc(window.Vocab ? window.Vocab.surface(w) : w.s) + '</div><div style="color:var(--primary);font-size:17px">' + window.UI.esc(w.p || '') + '</div><div class="ui-muted">' + window.UI.esc(w.d) + '</div>'));
      var drow = el('div', 'ui-row'); drow.style.marginTop = '14px';
      drow.appendChild(U.button(t('home.daily.cta'), { variant: 'primary', onClick: function () { window.Router.go('/practice'); } }));
      dc.appendChild(drow);
      daily.appendChild(dc);
      mount.appendChild(daily);

      // What's built so far — honest status grid
      var plan = el('section', 'section');
      plan.appendChild(U.sectionHead('Platform roadmap'));
      var pg = el('div', 'ui-grid cols-4');
      pg.appendChild(phaseCard('Courses & lessons', 'Structured HSK courses, enrollment, progress.', 'Phase 3', '📚'));
      pg.appendChild(phaseCard('Practice center', 'Listening, speaking, reading, writing, review.', 'Phase 4', '🎧'));
      pg.appendChild(phaseCard('Speaking practice', 'Repeat sentences aloud with scoring.', 'Phase 8', '🗣️'));
      pg.appendChild(phaseCard('Community', 'Discussion, language exchange, study groups.', 'Phase 10', '💬'));
      plan.appendChild(pg);
      mount.appendChild(plan);
    },

    // Phase 2 delivers learning; these views are honest placeholders until then.
    placeholder: function (mount, opts) {
      var U = window.UI;
      var wrap = el('div', 'section');
      wrap.appendChild(el('h1', 'ui-h1', window.UI.esc(opts.title)));
      if (opts.sub) wrap.appendChild(el('p', 'ui-muted', window.UI.esc(opts.sub)));
      var c = U.card([]);
      c.style.marginTop = '16px';
      c.appendChild(el('div', null, '<div style="font-size:30px">' + (opts.icon || '🧩') + '</div>'));
      c.appendChild(el('div', 'ui-h3', 'Planned for ' + window.UI.esc(opts.phase)));
      c.appendChild(el('p', 'ui-muted', window.UI.esc(opts.note || 'This screen is part of the specification and will be built in a later phase.')));
      var row = el('div', 'ui-row'); row.style.marginTop = '12px';
      row.appendChild(U.button('Back to Home', { variant: 'primary', onClick: function () { window.Router.go('/'); } }));
      c.appendChild(row);
      wrap.appendChild(c);
      mount.appendChild(wrap);
    },

    courses: function (mount) {
      if (window.Views3) return window.Views3.courses(mount);
      Views.placeholder(mount, { title: t('nav.courses'), phase: 'Phase 3', icon: '📚' });
    },
    practice: function (mount) {
      Views.placeholder(mount, { title: t('nav.practice'), phase: 'Phase 4 — Practice', icon: '🎧', note: 'Listening, speaking, writing, reading, quizzes, and spaced review arrive in Phase 4.' });
    },
    community: function (mount) {
      Views.placeholder(mount, { title: t('nav.community'), phase: 'Phase 10 — Community', icon: '💬' });
    },
    exams: function (mount) {
      if (window.Views3) return window.Views3.exams(mount);
      Views.placeholder(mount, { title: 'HSK Mock Tests', phase: 'Phase 4', icon: '📝' });
    },
    progress: function (mount) {
      var U = window.UI;
      var S = window.Store.state;
      var wrap = el('div', 'section');
      wrap.appendChild(el('h1', 'ui-h1', t('nav.progress')));
      var p = S.progress;
      var g = el('div', 'ui-grid cols-4'); g.style.marginTop = '16px';
      g.appendChild(U.stat(String(p.xp || 0), t('progress.xp'), 'earned', 'blue'));
      g.appendChild(U.stat(String((p.streak && p.streak.current) || 0), t('progress.streak'), 'longest ' + ((p.streak && p.streak.longest) || 0), 'amber'));
      g.appendChild(U.stat(String(Object.keys(p.known || {}).length), t('progress.wordsKnown'), '', 'green'));
      g.appendChild(U.stat(String((p.quiz && p.quiz.taken) || 0), t('progress.quizzes'), ((p.quiz && p.quiz.correct) || 0) + ' correct', 'red'));
      wrap.appendChild(g);
      mount.appendChild(wrap);
    },
    profile: function (mount) {
      var U = window.UI, S = window.Store.state;
      var wrap = el('div', 'section');
      wrap.appendChild(el('h1', 'ui-h1', t('nav.profile')));
      if (!S.user) { wrap.appendChild(U.empty('Not signed in', 'Sign in to view your profile.')); mount.appendChild(wrap); return; }
      var c = U.card([]); c.style.marginTop = '16px';
      c.appendChild(el('div', 'ui-row', ''));
      c.innerHTML = '';
      var row = el('div', 'ui-row');
      row.appendChild(U.avatar(S.user.displayName || S.user.username, 'lg'));
      var info = el('div');
      info.appendChild(el('div', 'ui-h3', window.UI.esc(S.user.displayName || S.user.username)));
      info.appendChild(el('div', 'ui-muted', '@' + window.UI.esc(S.user.username) + ' · ' + (S.user.role === 'admin' ? 'Administrator' : 'Learner')));
      row.appendChild(info);
      c.appendChild(row);
      wrap.appendChild(c);
      mount.appendChild(wrap);
    },
    settings: function (mount) {
      var U = window.UI, S = window.Settings ? window.Settings.get() : {};
      var wrap = el('div', 'section');
      wrap.appendChild(el('h1', 'ui-h1', t('nav.settings')));
      wrap.appendChild(el('p', 'ui-muted', 'Choose how the interface, your learning content, and translations appear. Saved to your account.'));

      function sel(label, key, options, hint) {
        var card = el('div', 'ui-card');
        card.appendChild(el('div', 'ui-h3', U.esc(label)));
        if (hint) card.appendChild(el('p', 'ui-muted', U.esc(hint)));
        var row = el('div', 'ui-row'); row.style.marginTop = '10px';
        var s = el('select', 'lang-select');
        options.forEach(function (o) {
          var op = el('option', null, U.esc(o.name)); op.value = o.code;
          if (o.code === S[key]) op.selected = true;
          s.appendChild(op);
        });
        s.addEventListener('change', function () {
          window.Settings.set(key, s.value);
          window.UI.toast('Saved');
          if (key === 'uiLanguage') { window.App.refreshChrome(); window.App.render(); }
        });
        row.appendChild(s);
        card.appendChild(row);
        return card;
      }

      var g1 = el('div', 'ui-grid cols-3'); g1.style.marginTop = '16px';
      g1.appendChild(sel('Interface language', 'uiLanguage', window.Settings.translationLanguages(), 'Menus, buttons, and labels.'));
      g1.appendChild(sel('Learning language', 'learningLanguage', window.Settings.learningLanguages(), 'The Chinese you are studying.'));
      g1.appendChild(sel('Translation language', 'translationLanguage', window.Settings.translationLanguages(), 'The language meanings are shown in.'));
      wrap.appendChild(g1);

      var g2 = el('div', 'ui-grid cols-3'); g2.style.marginTop = '16px';
      g2.appendChild(sel('Pinyin', 'pinyinPreference', [{ code: 'always', name: 'Always show' }, { code: 'click', name: 'Show on click' }, { code: 'hidden', name: 'Hidden' }]));
      g2.appendChild(sel('Characters', 'characterPreference', [{ code: 'simplified', name: 'Simplified' }, { code: 'traditional', name: 'Traditional' }, { code: 'both', name: 'Both' }]));
      g2.appendChild(sel('Translation display', 'translationDisplayMode', [{ code: 'always', name: 'Always show' }, { code: 'click', name: 'Show on click' }, { code: 'hidden', name: 'Hidden' }]));
      wrap.appendChild(g2);

      if (window.Store.state.user) {
        var act = el('div', 'ui-card'); act.style.marginTop = '16px';
        act.appendChild(el('div', 'ui-h3', 'Account'));
        act.appendChild(el('p', 'ui-muted', '@' + U.esc(window.Store.state.user.username) + ' · ' + (window.Store.state.user.role === 'admin' ? 'Administrator' : 'Learner')));
        var r = el('div', 'ui-row'); r.style.marginTop = '10px';
        r.appendChild(U.button('Sign out', { onClick: function () { window.Store.signOut(); } }));
        act.appendChild(r);
        wrap.appendChild(act);
      }
      mount.appendChild(wrap);
    },
  };

  window.Views = Views;
})();
