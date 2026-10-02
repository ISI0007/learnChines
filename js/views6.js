/* 汉学课堂 — Phase 6 community (real posts API) + Phase 8 speaking practice.
   Community persists server-side via /api/posts. Speaking uses the browser
   SpeechRecognition API when available, with a typed fallback. */
(function () {
  'use strict';

  var U;
  function bind() { U = window.UI; }
  function el(tag, cls, html) { return U.el(tag, cls, html); }
  function esc(s) { return U.esc(s); }
  function t(k) { return window.I18N ? window.I18N.t(k) : k; }
  function go(p) { window.Router.go(p); }
  function signedIn() { return !!(window.Store.state.user && window.Store.state.mode === 'server'); }
  function speak(text) {
    try { if (!('speechSynthesis' in window)) return; var u = new SpeechSynthesisUtterance(text); u.lang = 'zh-CN'; u.rate = 0.85; speechSynthesis.cancel(); speechSynthesis.speak(u); } catch (e) {}
  }
  function timeAgo(iso) {
    var d = (Date.now() - new Date(iso).getTime()) / 1000;
    if (d < 60) return 'just now';
    if (d < 3600) return Math.floor(d / 60) + 'm ago';
    if (d < 86400) return Math.floor(d / 3600) + 'h ago';
    return Math.floor(d / 86400) + 'd ago';
  }

  var TAGS = ['general', 'hsk4', 'grammar', 'tones', 'listening', 'pinyin', 'speaking', 'vocab', 'exam', 'culture'];

  // ───────────────────────── COMMUNITY ─────────────────────────
  function community(mount) {
    bind();
    var wrap = el('div', 'section');
    wrap.appendChild(el('h1', 'ui-h1', t('nav.community')));
    wrap.appendChild(el('p', 'ui-muted', 'Discuss, swap languages, and study together. Posts are saved for everyone.'));

    var state = { tag: null, sort: 'new' };

    var tabs = el('div', 'hx-tabs');
    [['new', 'Latest'], ['top', 'Top'], ['exams', 'Q&A']].forEach(function (x, i) {
      var b = el('button', 'hx-tab' + (i === 0 ? ' active' : ''), x[1]);
      b.addEventListener('click', function () {
        U.qa('.hx-tab', tabs).forEach(function (y) { y.classList.remove('active'); }); b.classList.add('active');
        if (x[0] === 'exams') { state.tag = null; state.sort = 'new'; go('/exams'); return; }
        state.sort = x[0]; load();
      });
      tabs.appendChild(b);
    });
    wrap.appendChild(tabs);

    var shell = el('div', 'hx-shell'); shell.style.marginTop = '18px';
    shell.style.gridTemplateColumns = '1fr 300px';
    var main = el('div');

    // composer
    var composer = el('div', 'ui-card');
    var cInput = el('input', 'hx-input'); cInput.placeholder = 'Post title…'; cInput.maxLength = 120;
    composer.appendChild(cInput);
    var cBody = el('textarea', 'hx-input'); cBody.placeholder = 'Share a question or tip…'; cBody.rows = 3; cBody.maxLength = 4000;
    cBody.style.marginTop = '10px'; cBody.style.resize = 'vertical';
    composer.appendChild(cBody);
    var cRow = el('div', 'hx-vocab-bar');
    var sel = el('select', 'lang-select');
    TAGS.forEach(function (tg) { var o = el('option', null, '#' + tg); o.value = tg; sel.appendChild(o); });
    var postBtn = U.button('Post', { variant: 'primary', onClick: function () {
      if (!signedIn()) return U.toast('Sign in to post');
      var title = cInput.value.trim(), body = cBody.value.trim();
      if (title.length < 3) return U.toast('Title needs at least 3 characters');
      if (!body) return U.toast('Write something first');
      postBtn.disabled = true;
      window.API.createPost(title, body, sel.value).then(function (r) {
        postBtn.disabled = false;
        if (r.ok && r.success) { cInput.value = ''; cBody.value = ''; U.toast('Posted'); load(); }
        else U.toast((r.error && r.error.message) || 'Could not post');
      });
    } });
    cRow.appendChild(sel); cRow.appendChild(postBtn);
    composer.appendChild(cRow);
    if (!signedIn()) composer.appendChild(el('div', 'ui-stat-sub', 'Sign in to post, like, and comment.'));
    main.appendChild(composer);

    var feed = el('div', 'ui-card'); feed.style.marginTop = '16px';
    main.appendChild(feed);

    var tagBar = el('div', 'hx-tags'); tagBar.style.marginTop = '14px';
    ['All'].concat(TAGS.slice(1, 7)).forEach(function (tg, i) {
      var b = el('span', 'hx-tag' + (i === 0 ? ' active' : ''), (i === 0 ? '' : '#') + tg.toLowerCase());
      b.style.cursor = 'pointer';
      b.addEventListener('click', function () {
        U.qa('.hx-tag', tagBar).forEach(function (x) { x.classList.remove('active'); }); b.classList.add('active');
        state.tag = i === 0 ? null : tg; load();
      });
      tagBar.appendChild(b);
    });
    main.appendChild(tagBar);

    function load() {
      U.clear(feed); feed.appendChild(U.loading(3));
      window.API.posts(state.tag, state.sort).then(function (r) {
        U.clear(feed);
        if (!r.ok || !r.success) { feed.appendChild(U.error('Could not load posts', 'Check your connection.')); return; }
        var posts = r.data.posts || [];
        var head = el('div', 'ui-section-head');
        head.appendChild(el('div', 'ui-h3', (r.data.total || posts.length) + ' posts'));
        feed.appendChild(head);
        if (!posts.length) { feed.appendChild(U.empty('No posts yet', 'Be the first to start a discussion.')); return; }
        posts.forEach(function (p) { feed.appendChild(renderPost(p, load)); });
      }).catch(function () { U.clear(feed); feed.appendChild(U.error('Could not load posts')); });
    }

    // sidebar
    var aside = el('aside');
    var top = el('div', 'ui-card');
    top.appendChild(el('div', 'ui-h3', 'Popular topics'));
    var tags = el('div', 'hx-tags'); tags.style.marginTop = '10px';
    TAGS.slice(1).forEach(function (x) {
      var tEl = el('span', 'hx-tag', '#' + x);
      tEl.style.cursor = 'pointer';
      tEl.addEventListener('click', function () { state.tag = x; load(); window.scrollTo(0, 0); });
      tags.appendChild(tEl);
    });
    top.appendChild(tags);
    aside.appendChild(top);
    var info = el('div', 'ui-card'); info.style.marginTop = '16px';
    info.appendChild(el('div', 'ui-h3', 'Guidelines'));
    info.appendChild(el('p', 'ui-muted', 'Be kind. Use Chinese or English. No spam.'));
    aside.appendChild(info);
    shell.appendChild(main); shell.appendChild(aside);
    wrap.appendChild(shell);

    mount.appendChild(wrap);
    load();
  }

  function renderPost(p, reload) {
    var row = el('div', 'hx-post');
    row.appendChild(U.avatar(p.author || '?'));
    var b = el('div', 'hx-post-body');
    b.appendChild(el('div', 'hx-post-meta', esc(p.author) + ' · ' + timeAgo(p.createdAt) + ' · #' + esc(p.tag)));
    b.appendChild(el('div', 'hx-post-title', esc(p.title)));
    b.appendChild(el('div', 'hx-post-text', esc(p.body)));
    var ac = el('div', 'hx-post-actions');
    var likeBtn = el('span', null, '👍 ' + (p.likes || 0));
    likeBtn.style.cursor = 'pointer';
    likeBtn.addEventListener('click', function () {
      if (!signedIn()) return U.toast('Sign in to like');
      window.API.likePost(p.id).then(function (r) { if (r.ok && r.success) { likeBtn.textContent = '👍 ' + r.data.likes; likeBtn.style.color = r.data.liked ? 'var(--primary)' : ''; } });
    });
    ac.appendChild(likeBtn);
    var cCount = el('span', null, '💬 ' + (p.comments || 0));
    ac.appendChild(cCount);
    var rep = el('span', null, '⚑ Report');
    rep.style.cursor = 'pointer'; rep.style.marginLeft = 'auto'; rep.style.color = 'var(--text-2)';
    rep.addEventListener('click', function () {
      if (!signedIn()) return U.toast('Sign in to report');
      window.API.reportPost(p.id).then(function (r) {
        if (r.ok && r.success) { rep.textContent = '⚑ Reported'; rep.style.color = 'var(--cn-red)'; U.toast('Thanks — a moderator will review this.'); }
        else U.toast('Could not report post');
      });
    });
    ac.appendChild(rep);
    b.appendChild(ac);

    var comments = el('div'); comments.style.display = 'none'; comments.style.marginTop = '10px';
    b.appendChild(comments);
    cCount.style.cursor = 'pointer';
    cCount.addEventListener('click', function () { toggleComments(p.id, comments, cCount); });
    row.appendChild(b);
    return row;
  }

  function toggleComments(id, box, counter) {
    if (box.style.display === 'block') { box.style.display = 'none'; return; }
    box.style.display = 'block';
    U.clear(box); box.appendChild(U.loading(2));
    window.API.post(id).then(function (r) {
      U.clear(box);
      if (!r.ok || !r.success) { box.appendChild(el('div', 'ui-stat-sub', 'Could not load comments')); return; }
      (r.data.post.comments || []).forEach(function (c) {
        var c1 = el('div', 'hx-post-meta', esc(c.author) + ' · ' + timeAgo(c.createdAt));
        var c2 = el('div', 'ui-p', esc(c.body));
        box.appendChild(c1); box.appendChild(c2);
      });
      var inp = el('input', 'hx-input'); inp.placeholder = 'Add a comment…'; inp.style.marginTop = '8px';
      var send = U.button('Comment', { variant: 'primary', onClick: function () {
        if (!signedIn()) return U.toast('Sign in to comment');
        if (!inp.value.trim()) return;
        window.API.commentPost(id, inp.value.trim()).then(function (r2) {
          if (r2.ok && r2.success) { inp.value = ''; toggleComments(id, box, counter); toggleComments(id, box, counter); counter.textContent = '💬 ' + (+((counter.textContent || '').replace(/\D/g, '')) + 1); }
        });
      } });
      box.appendChild(inp); box.appendChild(send);
    });
  }

  // ───────────────────────── SPEAKING PRACTICE ─────────────────────────
  var PHRASES = [
    { cn: '你好，很高兴认识你。', py: 'Nǐ hǎo, hěn gāoxìng rènshi nǐ.', en: 'Hello, nice to meet you.' },
    { cn: '请问，洗手间在哪里？', py: 'Qǐngwèn, xǐshǒujiān zài nǎlǐ?', en: 'Excuse me, where is the restroom?' },
    { cn: '我想点一杯咖啡。', py: 'Wǒ xiǎng diǎn yì bēi kāfēi.', en: 'I would like to order a coffee.' },
    { cn: '这个多少钱？', py: 'Zhège duōshao qián?', en: 'How much is this?' },
    { cn: '今天天气很好。', py: 'Jīntiān tiānqì hěn hǎo.', en: 'The weather is nice today.' },
  ];

  function speaking(mount) {
    bind();
    var wrap = el('div', 'section');
    wrap.appendChild(el('h1', 'ui-h1', 'Speaking Practice'));
    wrap.appendChild(el('p', 'ui-muted', 'Repeat the sentence aloud. Chrome/Edge can score you with speech recognition; otherwise type what you said.'));

    var idx = 0;
    var card = el('div', 'ui-card'); card.style.marginTop = '16px';
    wrap.appendChild(card);

    var SR = window.SpeechRecognition || window.webkitSpeechRecognition;

    function render() {
      U.clear(card);
      var p = PHRASES[idx];
      card.appendChild(el('div', 'ui-muted', 'Sentence ' + (idx + 1) + ' / ' + PHRASES.length));
      card.appendChild(el('div', 'hx-flash-char', esc(p.cn)));
      card.appendChild(el('div', 'hx-flash-pinyin', esc(p.py)));
      card.appendChild(el('div', 'hx-flash-def', esc(p.en)));

      var row = el('div', 'hx-vocab-bar');
      row.appendChild(U.button('🔊 Listen', { onClick: function () { speak(p.cn); } }));
      var recBtn = U.button(SR ? '🎤 Record' : '⌨️ Type it', { variant: 'primary' });
      row.appendChild(recBtn);
      card.appendChild(row);

      var result = el('div', 'ui-stat-sub'); result.style.marginTop = '10px';
      card.appendChild(result);

      var typedBox = el('div'); typedBox.style.marginTop = '10px'; typedBox.style.display = 'none';
      var tin = el('input', 'hx-input'); tin.placeholder = 'Type the sentence in Chinese…';
      var tgo = U.button('Check', { variant: 'primary', onClick: function () { grade(tin.value, p.cn, result); } });
      typedBox.appendChild(tin); typedBox.appendChild(tgo);
      card.appendChild(typedBox);

      recBtn.addEventListener('click', function () {
        if (!SR) { typedBox.style.display = 'block'; tin.focus(); return; }
        var rec = new SR(); rec.lang = 'zh-CN'; rec.interimResults = false; rec.maxAlternatives = 1;
        result.textContent = 'Listening… speak now';
        rec.onresult = function (e) { grade(e.results[0][0].transcript, p.cn, result); };
        rec.onerror = function () { result.textContent = 'Mic error — type instead below.'; typedBox.style.display = 'block'; };
        try { rec.start(); } catch (e) { typedBox.style.display = 'block'; }
      });

      var nav = el('div', 'ui-row'); nav.style.marginTop = '16px';
      if (idx > 0) nav.appendChild(U.button('← Previous', { onClick: function () { idx--; render(); } }));
      if (idx < PHRASES.length - 1) nav.appendChild(U.button('Next →', { variant: 'primary', onClick: function () { idx++; render(); } }));
      nav.appendChild(U.button('Practice words', { onClick: function () { go('/practice'); } }));
      card.appendChild(nav);
    }

    function grade(said, target, out) {
      var a = String(said || '').replace(/[\s，。！？、,.!?]/g, '');
      var b = String(target || '').replace(/[\s，。！？、,.!?]/g, '');
      var hit = 0;
      for (var i = 0; i < b.length; i++) if (a.indexOf(b[i]) !== -1) hit++;
      var pct = b.length ? Math.round((hit / b.length) * 100) : 0;
      out.textContent = 'You said: "' + said + '" — match ' + pct + '%';
      out.style.color = pct >= 70 ? 'var(--success)' : pct >= 40 ? 'var(--warning)' : 'var(--danger)';
      if (pct >= 70) window.Store.markKnown(target);
    }

    render();
    mount.appendChild(wrap);
  }

  window.Views6 = { community: community, speaking: speaking };
})();
