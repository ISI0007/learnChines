/* 汉学课堂 — Phase 11 admin CMS. Tabs: Overview, Users, Content, Community, Sessions.
   Admin-only; all data comes from /api/admin/* (Spec §78). Fully offline, no external services. */
(function () {
  'use strict';

  var U;
  function bind() { U = window.UI; }
  function el(tag, cls, html) { return U.el(tag, cls, html); }
  function esc(s) { return U.esc(s); }
  function t(k) { return window.I18N ? window.I18N.t(k) : k; }
  function isAdmin() { var u = window.Store.state.user; return !!(u && u.role === 'admin'); }
  function fmt(n) { return Number(n || 0).toLocaleString(); }
  function ago(iso) {
    if (!iso) return '—';
    var d = (Date.now() - new Date(iso).getTime()) / 1000;
    if (d < 0) return 'now';
    if (d < 60) return 'just now';
    if (d < 3600) return Math.floor(d / 60) + 'm ago';
    if (d < 86400) return Math.floor(d / 3600) + 'h ago';
    return Math.floor(d / 86400) + 'd ago';
  }
  function card(children) { var c = el('div', 'ui-card'); (children || []).forEach(function (x) { c.appendChild(x); }); return c; }
  function statGrid(items) {
    var g = el('div', 'ui-grid cols-4');
    items.forEach(function (x) { g.appendChild(U.stat(String(x[0]), x[1], x[2] || '', x[3])); });
    return g;
  }
  function th(v) { var h = el('th', null, esc(v)); h.style.cssText = 'text-align:left;color:var(--text-2);padding:9px;border-bottom:1px solid var(--border);white-space:nowrap'; return h; }
  function tableHead(cols) { var tr = el('tr'); cols.forEach(function (c) { tr.appendChild(th(c)); }); var thead = el('thead'); thead.appendChild(tr); return thead; }
  function tdv(v) { var d = el('td', null, esc(String(v))); d.style.cssText = 'padding:9px;border-bottom:1px solid var(--border)'; return d; }
  function cell(children) { var d = el('td'); d.style.cssText = 'padding:9px;border-bottom:1px solid var(--border);vertical-align:top'; (children || []).forEach(function (c) { d.appendChild(c); }); return d; }
  function miniBtn(label, onClick, danger) {
    var b = el('button', 'ui-btn ui-btn-ghost', label);
    b.type = 'button';
    b.style.cssText = 'padding:4px 9px;font-size:12.5px;margin:2px 2px 2px 0' + (danger ? ';color:var(--cn-red)' : '');
    b.addEventListener('click', onClick);
    return b;
  }
  function bars(values, labels, unit) {
    var max = Math.max(1, Math.max.apply(null, values.concat([1])));
    var chart = el('div');
    chart.style.cssText = 'display:flex;gap:10px;align-items:flex-end;height:120px;margin-top:12px';
    values.forEach(function (n, i) {
      var col = el('div');
      col.style.cssText = 'flex:1;display:flex;flex-direction:column;justify-content:flex-end;align-items:center;height:100%';
      var bar = el('div');
      bar.style.cssText = 'width:68%;background:var(--primary);border-radius:6px 6px 0 0;height:' + Math.max(4, Math.round((n / max) * 84)) + 'px';
      bar.title = n + ' ' + (unit || '');
      col.appendChild(bar);
      var lb = el('div', null, esc(labels[i]));
      lb.style.cssText = 'font-size:11px;color:var(--text-2);margin-top:6px';
      col.appendChild(lb);
      chart.appendChild(col);
    });
    return chart;
  }
  function meter(label, n, max, color) {
    var row = el('div'); row.style.marginTop = '10px';
    var top = el('div'); top.style.cssText = 'display:flex;justify-content:space-between;font-size:13px';
    top.appendChild(el('span', null, esc(label)));
    top.appendChild(el('span', 'ui-muted', fmt(n)));
    row.appendChild(top);
    var track = el('div'); track.style.cssText = 'height:8px;background:var(--border);border-radius:99px;margin-top:5px;overflow:hidden';
    var fill = el('div'); fill.style.cssText = 'height:100%;border-radius:99px;width:' + Math.round((n / Math.max(1, max)) * 100) + '%;background:' + (color || 'var(--primary)');
    track.appendChild(fill); row.appendChild(track);
    return row;
  }

  var TABS = [['overview', 'Overview'], ['users', 'Users'], ['content', 'Content'], ['community', 'Community'], ['translations', 'Translations'], ['sessions', 'Sessions']];
  var state = { tab: 'overview' };

  function admin(mount) {
    bind();
    var wrap = el('div', 'section');
    wrap.appendChild(el('h1', 'ui-h1', t('nav.admin')));
    if (!isAdmin()) {
      wrap.appendChild(U.empty('Admins only', 'You do not have access to this page.'));
      mount.appendChild(wrap); return;
    }
    wrap.appendChild(el('p', 'ui-muted', 'Platform administration — users, content inventory, community moderation, and analytics.'));
    var tabs = el('div', 'hx-tabs');
    TABS.forEach(function (x) {
      var b = el('button', 'hx-tab' + (x[0] === state.tab ? ' active' : ''), x[1]);
      b.addEventListener('click', function () {
        state.tab = x[0];
        U.qa('.hx-tab', tabs).forEach(function (y) { y.classList.remove('active'); });
        b.classList.add('active');
        render(body);
      });
      tabs.appendChild(b);
    });
    wrap.appendChild(tabs);
    var body = el('div'); body.style.marginTop = '18px';
    wrap.appendChild(body);
    mount.appendChild(wrap);
    render(body);
  }

  function render(body) {
    U.clear(body);
    if (state.tab === 'overview') return overviewTab(body);
    if (state.tab === 'users') return usersTab(body);
    if (state.tab === 'content') return contentTab(body);
    if (state.tab === 'community') return communityTab(body);
    if (state.tab === 'translations') return translationsTab(body);
    return sessionsTab(body);
  }

  // ───── Overview ─────
  function overviewTab(body) {
    body.appendChild(U.loading(4));
    window.API.adminStats().then(function (r) {
      U.clear(body);
      if (!r.ok || !r.success) { body.appendChild(U.error('Could not load analytics', (r.error && r.error.message) || '')); return; }
      var d = r.data, u = d.users, c = d.content, e = d.engagement, s = d.sessions;
      body.appendChild(statGrid([
        [fmt(u.total), 'Accounts', u.admins + ' admin · ' + u.learners + ' learners', 'blue'],
        [fmt(u.active7), 'Active (7d)', u.active30 + ' in 30 days', 'green'],
        [fmt(u.new7), 'New (7d)', 'sign-ups this week', 'amber'],
        [fmt(u.suspended), 'Suspended', u.suspended ? 'accounts disabled' : 'all in good standing', u.suspended ? 'red' : ''],
      ]));
      var g2 = statGrid([
        [fmt(s.active), 'Active sessions', s.total + ' stored', 'blue'],
        [fmt(c.posts), 'Community posts', Object.keys(d.tagCounts || {}).length + ' topics used', 'green'],
        [fmt(e.known), 'Words known', 'across learners', 'amber'],
        [fmt(e.xp), 'Total XP earned', '', 'purple'],
      ]);
      g2.style.marginTop = '12px';
      body.appendChild(g2);

      var act = card();
      act.style.marginTop = '16px';
      act.appendChild(el('div', 'ui-h3', 'Study activity · last 7 days'));
      act.appendChild(el('div', 'ui-muted', fmt(e.studyDays) + ' study-days logged in total (~' + fmt(e.studyMinutes) + ' minutes)'));
      var labels = [];
      for (var i = 0; i < 7; i++) labels.push(new Date(Date.now() - (6 - i) * 86400000).toLocaleDateString(undefined, { weekday: 'short' }));
      act.appendChild(bars(d.last7 || [0, 0, 0, 0, 0, 0, 0], labels, 'learners'));
      body.appendChild(act);

      var two = el('div', 'hx-shell');
      two.style.marginTop = '16px'; two.style.gridTemplateColumns = '1fr 1fr';

      var lv = card();
      lv.appendChild(el('div', 'ui-h3', 'Words known · by level'));
      var byL = d.byLevel || {};
      var lvKeys = Object.keys(byL).filter(function (k) { return k !== '?'; }).sort();
      var lvMax = Math.max(1, Math.max.apply(null, lvKeys.map(function (k) { return byL[k]; }).concat([1])));
      if (!lvKeys.length) lv.appendChild(el('p', 'ui-muted', 'No vocabulary progress yet.'));
      lvKeys.forEach(function (k) { lv.appendChild(meter('HSK ' + k, byL[k], lvMax, 'var(--primary)')); });
      if (byL['?']) lv.appendChild(meter('Unclassified', byL['?'], lvMax, 'var(--text-2)'));
      two.appendChild(lv);

      var rec = card();
      rec.appendChild(el('div', 'ui-h3', 'Recent sign-ups'));
      var recent = d.recent || [];
      if (!recent.length) rec.appendChild(el('p', 'ui-muted', 'No accounts yet.'));
      recent.forEach(function (r2) {
        var row = el('div');
        row.style.cssText = 'display:flex;justify-content:space-between;align-items:center;padding:7px 0;border-bottom:1px solid var(--border)';
        var left = el('div');
        left.appendChild(el('div', null, esc(r2.displayName || r2.username)));
        left.appendChild(el('div', 'ui-muted', '@' + esc(r2.username) + ' · ' + ago(r2.createdAt)));
        row.appendChild(left);
        row.appendChild(U.badge(r2.suspended ? 'suspended' : r2.role, r2.suspended ? 'red' : (r2.role === 'admin' ? 'blue' : 'green')));
        rec.appendChild(row);
      });
      two.appendChild(rec);
      body.appendChild(two);
    }).catch(function () { U.clear(body); body.appendChild(U.error('Could not load analytics')); });
  }

  // ───── Users ─────
  function usersTab(body) {
    var ctl = el('div');
    ctl.style.cssText = 'display:flex;gap:10px;flex-wrap:wrap;align-items:center';
    var search = el('input', 'hx-input');
    search.placeholder = 'Search username…'; search.style.maxWidth = '240px';
    var roleSel = el('select', 'lang-select');
    ['all', 'admin', 'user'].forEach(function (x) { var o = el('option', null, x); o.value = x; roleSel.appendChild(o); });
    var statSel = el('select', 'lang-select');
    ['all', 'active', 'suspended'].forEach(function (x) { var o = el('option', null, x); o.value = x; statSel.appendChild(o); });
    ctl.appendChild(search); ctl.appendChild(roleSel); ctl.appendChild(statSel);
    ctl.appendChild(U.button('Refresh', { onClick: function () { load(); } }));
    body.appendChild(ctl);

    var detail = el('div'); detail.style.marginTop = '14px';
    var holder = el('div'); holder.style.marginTop = '8px';
    body.appendChild(detail); body.appendChild(holder);
    holder.appendChild(U.loading(4));

    var all = [];
    function apply() {
      var term = search.value.trim().toLowerCase();
      var rows = all.filter(function (u) {
        if (term && ((u.username || '') + ' ' + (u.displayName || '')).toLowerCase().indexOf(term) === -1) return false;
        if (roleSel.value !== 'all' && u.role !== roleSel.value) return false;
        if (statSel.value === 'suspended' && !u.suspended) return false;
        if (statSel.value === 'active' && u.suspended) return false;
        return true;
      });
      draw(rows);
    }
    function load() {
      U.clear(holder); holder.appendChild(U.loading(4));
      window.API.adminUsers().then(function (r) {
        if (!r.ok || !r.success) { U.clear(holder); holder.appendChild(U.error('Could not load users', (r.error && r.error.message) || '')); return; }
        all = r.data.users || [];
        apply();
      }).catch(function () { U.clear(holder); holder.appendChild(U.error('Could not load users')); });
    }
    function draw(rows) {
      U.clear(holder);
      var g = el('div', 'ui-grid cols-4');
      g.appendChild(U.stat(fmt(all.length), 'Accounts', '', 'blue'));
      g.appendChild(U.stat(fmt(rows.length), 'Shown', 'after filters', 'green'));
      g.appendChild(U.stat(fmt(all.filter(function (u) { return u.suspended; }).length), 'Suspended', '', 'red'));
      g.appendChild(U.stat(fmt(all.reduce(function (a, u) { return a + (u.xp || 0); }, 0)), 'Total XP', '', 'amber'));
      holder.appendChild(g);

      var c = card(); c.style.marginTop = '14px';
      var tbl = el('table'); tbl.style.cssText = 'width:100%;border-collapse:collapse;font-size:13.5px';
      tbl.appendChild(tableHead(['User', 'Role', 'Status', 'Words', 'XP', 'Streak', 'Quizzes', 'Study days', 'Last seen', '']));
      var tb = el('tbody');
      rows.forEach(function (u) {
        var tr = el('tr');
        var nc = el('td'); nc.style.cssText = 'padding:9px;border-bottom:1px solid var(--border)';
        nc.appendChild(el('div', null, esc(u.displayName || u.username)));
        nc.appendChild(el('div', 'ui-muted', '@' + esc(u.username)));
        tr.appendChild(nc);
        tr.appendChild(tdv(u.role));
        var stc = el('td'); stc.style.cssText = 'padding:9px;border-bottom:1px solid var(--border)';
        stc.appendChild(U.badge(u.suspended ? 'suspended' : 'active', u.suspended ? 'red' : 'green'));
        tr.appendChild(stc);
        [u.known, u.xp, u.streak, u.quizzes, u.studyDays, u.lastLoginAt ? ago(u.lastLoginAt) : 'never'].forEach(function (v) { tr.appendChild(tdv(v)); });
        var ac = el('td'); ac.style.cssText = 'padding:9px;border-bottom:1px solid var(--border);white-space:nowrap';
        ac.appendChild(miniBtn('View', function () { showUser(u.id, detail); }));
        if (u.role === 'admin') ac.appendChild(miniBtn('Make user', function () { act(u, 'makeUser', load); }));
        else ac.appendChild(miniBtn('Make admin', function () { act(u, 'makeAdmin', load); }));
        if (u.role !== 'admin') {
          if (u.suspended) ac.appendChild(miniBtn('Restore', function () { act(u, 'restore', load); }));
          else ac.appendChild(miniBtn('Suspend', function () { if (window.confirm('Suspend ' + u.username + '? Their sessions will be signed out.')) act(u, 'suspend', load); }, true));
          ac.appendChild(miniBtn('Delete', function () { if (window.confirm('Permanently delete ' + u.username + '? This cannot be undone.')) act(u, 'delete', load); }, true));
        }
        tr.appendChild(ac);
        tb.appendChild(tr);
      });
      tbl.appendChild(tb); c.appendChild(tbl); holder.appendChild(c);
    }
    function act(u, action, reload) {
      window.API.adminUserAction(u.id, action).then(function (r) {
        if (r.ok && r.success) { U.toast(action + ' → ' + u.username); reload(); }
        else U.toast((r.error && r.error.message) || 'Action failed');
      }).catch(function () { U.toast('Action failed'); });
    }
    search.addEventListener('input', apply);
    roleSel.addEventListener('change', apply);
    statSel.addEventListener('change', apply);
    load();
  }

  function showUser(id, host) {
    U.clear(host); host.appendChild(U.loading(3));
    window.API.adminUser(id).then(function (r) {
      U.clear(host);
      if (!r.ok || !r.success) { host.appendChild(U.error('Could not load user')); return; }
      var u = r.data.user, p = r.data.progress || {}, log = r.data.activity || [];
      var c = card();
      var head = el('div'); head.style.cssText = 'display:flex;justify-content:space-between;align-items:center';
      head.appendChild(el('div', 'ui-h3', u.displayName || u.username));
      head.appendChild(U.button('Close', { variant: 'ghost', onClick: function () { U.clear(host); } }));
      c.appendChild(head);
      c.appendChild(el('div', 'ui-muted', '@' + esc(u.username) + ' · ' + esc(u.role) + (u.suspended ? ' · suspended' : '') + ' · joined ' + ago(u.createdAt)));
      var g = el('div', 'ui-grid cols-4'); g.style.marginTop = '12px';
      g.appendChild(U.stat(fmt(Object.keys(p.known || {}).length), 'Words known'));
      g.appendChild(U.stat(fmt(p.xp || 0), 'XP'));
      g.appendChild(U.stat(fmt((p.streak && p.streak.current) || 0), 'Streak'));
      g.appendChild(U.stat(fmt((p.studyDays || []).length), 'Study days'));
      c.appendChild(g);
      var box = el('div'); box.style.marginTop = '12px';
      box.appendChild(el('div', 'ui-h3', 'Recent activity'));
      if (!log.length) box.appendChild(el('p', 'ui-muted', 'No activity recorded.'));
      log.slice(0, 12).forEach(function (a) {
        box.appendChild(el('div', 'hx-post-meta', esc(a.type || '') + ' · ' + esc(a.detail || '') + ' · ' + ago(a.t)));
      });
      c.appendChild(box);
      host.appendChild(c);
    }).catch(function () { U.clear(host); host.appendChild(U.error('Could not load user')); });
  }

  // ───── Content ─────
  function countOf(x, keys) {
    if (Array.isArray(x)) return x.length;
    if (x && typeof x === 'object') {
      for (var i = 0; i < keys.length; i++) { if (Array.isArray(x[keys[i]])) return x[keys[i]].length; }
      if (typeof x.count === 'number') return x.count;
    }
    return 0;
  }
  function contentTab(body) {
    var vocab = window.VOCAB || {};
    var levels = Object.keys(vocab).sort();
    var total = 0; levels.forEach(function (l) { total += (vocab[l] || []).length; });
    var books = countOf(window.LIBRARY, ['books', 'items', 'library']);
    var exams = countOf(window.EXAMS, ['sets', 'exams', 'items']);
    body.appendChild(statGrid([
      [fmt(total), 'Vocabulary', levels.length + ' HSK levels', 'blue'],
      [fmt(books), 'Library books', 'read-only PDFs', 'green'],
      [fmt(exams), 'Mock exam sets', 'keys & audio', 'amber'],
      [fmt(896), 'Audio tracks', 'companion listening', 'purple'],
    ]));
    var c = card(); c.style.marginTop = '16px';
    c.appendChild(el('div', 'ui-h3', 'Vocabulary by level'));
    var max = Math.max(1, Math.max.apply(null, levels.map(function (l) { return (vocab[l] || []).length; }).concat([1])));
    levels.forEach(function (l) { c.appendChild(meter('HSK ' + l, (vocab[l] || []).length, max, 'var(--primary)')); });
    var row = el('div'); row.style.marginTop = '14px';
    row.appendChild(U.button('Browse vocabulary', { onClick: function () { window.Router.go('/vocabulary'); } }));
    row.appendChild(U.button('Open library', { onClick: function () { window.Router.go('/library'); } }));
    row.appendChild(U.button('Mock exams', { onClick: function () { window.Router.go('/exams'); } }));
    c.appendChild(row);
    c.appendChild(el('p', 'ui-muted', 'Content is imported read-only from the curated source library (D:\\HSK). To change it, run tools/import-hsk.mjs → gen-manifest.mjs → gen-data-js.mjs, then restart the server.'));
    body.appendChild(c);
  }

  // ───── Community (moderation) ─────
  function communityTab(body) {
    body.appendChild(U.loading(4));
    Promise.all([window.API.adminModeration(), window.API.adminComments()]).then(function (res) {
      var m = res[0], cm = res[1];
      U.clear(body);
      if (!m.ok || !m.success) { body.appendChild(U.error('Could not load moderation queue', (m.error && m.error.message) || '')); return; }
      var st = m.data.stats || {};
      body.appendChild(statGrid([
        [fmt(st.posts), 'Posts', 'in the feed', 'blue'],
        [fmt(st.flagged), 'Flagged', 'awaiting review', st.flagged ? 'red' : 'green'],
        [fmt(st.totalFlags), 'Total reports', 'from learners', 'amber'],
        [fmt((cm.ok && cm.data && cm.data.total) || 0), 'Comments', 'across all posts', 'purple'],
      ]));
      var feed = card(); feed.style.marginTop = '16px';
      feed.appendChild(el('div', 'ui-h3', 'Moderation queue (flagged first)'));
      var posts = m.data.posts || [];
      if (!posts.length) feed.appendChild(U.empty('No posts yet', 'The community feed is empty.'));
      posts.forEach(function (p) {
        var row = el('div', 'hx-post'); row.style.marginTop = '10px';
        row.appendChild(U.avatar(p.author || '?'));
        var b = el('div', 'hx-post-body');
        var meta = el('div', 'hx-post-meta', esc(p.author) + ' · ' + ago(p.createdAt) + ' · #' + esc(p.tag) + ' · 👍 ' + (p.likes || 0) + ' · 💬 ' + (p.comments || 0));
        if (p.flags) { var fb = U.badge(p.flags + ' report' + (p.flags > 1 ? 's' : ''), 'red'); fb.style.marginLeft = '6px'; meta.appendChild(fb); }
        if (p.suspendedAuthor) { var sb = U.badge('author suspended', 'amber'); sb.style.marginLeft = '6px'; meta.appendChild(sb); }
        b.appendChild(meta);
        b.appendChild(el('div', 'hx-post-title', esc(p.title)));
        b.appendChild(el('div', 'hx-post-text', esc(p.bodyPreview || p.body)));
        var ac = el('div', 'hx-post-actions');
        ac.appendChild(U.button('Delete post', { variant: 'ghost', onClick: function () {
          if (window.confirm('Delete this post?')) window.API.deletePost(p.id).then(function (r) { if (r.ok) { U.toast('Post deleted'); render(body); } });
        } }));
        b.appendChild(ac);
        row.appendChild(b);
        feed.appendChild(row);
      });
      body.appendChild(feed);

      var cc = card(); cc.style.marginTop = '16px';
      cc.appendChild(el('div', 'ui-h3', 'Recent comments'));
      var comments = (cm.ok && cm.data && cm.data.comments) || [];
      if (!comments.length) cc.appendChild(el('p', 'ui-muted', 'No comments yet.'));
      comments.slice(0, 25).forEach(function (c0) {
        var row = el('div'); row.style.cssText = 'padding:8px 0;border-bottom:1px solid var(--border)';
        row.appendChild(el('div', 'hx-post-meta', esc(c0.author) + ' · ' + ago(c0.createdAt) + ' · on “' + esc(c0.postTitle || '') + '”'));
        row.appendChild(el('div', 'ui-p', esc(c0.body)));
        row.appendChild(miniBtn('Delete comment', function () {
          window.API.adminDeleteComment(c0.postId, c0.id).then(function (r) {
            if (r.ok && r.success) { U.toast('Comment deleted'); render(body); } else U.toast('Could not delete');
          });
        }, true));
        cc.appendChild(row);
      });
      body.appendChild(cc);
    }).catch(function () { U.clear(body); body.appendChild(U.error('Could not load moderation')); });
  }

  // ───── Sessions ─────
  function sessionsTab(body) {
    body.appendChild(U.loading(4));
    window.API.adminSessions().then(function (r) {
      U.clear(body);
      if (!r.ok || !r.success) { body.appendChild(U.error('Could not load sessions', (r.error && r.error.message) || '')); return; }
      var sess = r.data.sessions || [];
      var active = sess.filter(function (s) { return s.active; });
      body.appendChild(statGrid([
        [fmt(active.length), 'Active sessions', 'signed in now', 'green'],
        [fmt(sess.length), 'Stored sessions', 'including expired', 'blue'],
        [fmt(active.filter(function (s) { return s.role === 'admin'; }).length), 'Admin sessions', '', 'amber'],
        [fmt(active.filter(function (s) { return s.role !== 'admin'; }).length), 'Learner sessions', '', 'purple'],
      ]));
      var c = card(); c.style.marginTop = '16px';
      c.appendChild(el('div', 'ui-h3', 'All sessions'));
      var tbl = el('table'); tbl.style.cssText = 'width:100%;border-collapse:collapse;font-size:13.5px';
      tbl.appendChild(tableHead(['User', 'Role', 'Last seen', 'Expires', 'Days left', 'Status']));
      var tb = el('tbody');
      sess.slice(0, 60).forEach(function (s) {
        var tr = el('tr');
        var nc = el('td'); nc.style.cssText = 'padding:9px;border-bottom:1px solid var(--border)';
        nc.appendChild(el('div', null, esc(s.displayName || s.username)));
        nc.appendChild(el('div', 'ui-muted', '@' + esc(s.username)));
        tr.appendChild(nc);
        tr.appendChild(tdv(s.role));
        tr.appendChild(tdv(s.lastSeen ? ago(s.lastSeen) : '—'));
        tr.appendChild(tdv(s.expires ? new Date(s.expires).toLocaleDateString() : '—'));
        tr.appendChild(tdv(s.daysLeft));
        tr.appendChild(cell([U.badge(s.active ? 'active' : 'expired', s.active ? 'green' : '')]));
        tb.appendChild(tr);
      });
      tbl.appendChild(tb); c.appendChild(tbl); body.appendChild(c);
    }).catch(function () { U.clear(body); body.appendChild(U.error('Could not load sessions')); });
  }

  // ───── Translations (Spec §79) ─────
  var LANGS = [['en', 'English'], ['ru', 'Russian'], ['ur', 'Urdu'], ['ar', 'Arabic'], ['fa', 'Persian'], ['hi', 'Hindi'], ['es', 'Spanish'], ['fr', 'French'], ['de', 'German'], ['pt', 'Portuguese'], ['ja', 'Japanese'], ['ko', 'Korean'], ['it', 'Italian'], ['tr', 'Turkish'], ['id', 'Indonesian'], ['vi', 'Vietnamese'], ['bn', 'Bengali'], ['th', 'Thai'], ['zh-CN', 'Chinese (Simpl.)'], ['zh-TW', 'Chinese (Trad.)']];
  var tState = { lang: 'ru', level: 'all', q: '' };
  function langName(code) { for (var i = 0; i < LANGS.length; i++) if (LANGS[i][0] === code) return LANGS[i][1]; return code; }

  function translationsTab(body) {
    body.appendChild(U.loading(4));
    window.API.adminTranslationStats().then(function (r) {
      U.clear(body);
      if (!r.ok || !r.success) { body.appendChild(U.error('Could not load translation stats', (r.error && r.error.message) || '')); return; }
      var d = r.data, total = d.vocabTotal || 0;

      var head = el('div', 'ui-card');
      var hrow = el('div'); hrow.style.cssText = 'display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px';
      hrow.appendChild(el('div', 'ui-h3', 'Vocabulary translations'));
      hrow.appendChild(el('div', 'ui-muted', fmt(total) + ' words in the vocabulary index · ' + d.activeLanguages + ' language(s) in progress'));
      head.appendChild(hrow);
      head.appendChild(el('p', 'ui-muted', 'Translate vocabulary meanings, then publish them. Published translations appear to learners who pick that translation language. Nothing is auto-generated — every entry is human-authored.'));

      var cov = el('div', 'ui-grid cols-4'); cov.style.marginTop = '12px';
      d.languages.slice().sort(function (a, b) { return b.coverage - a.coverage; }).forEach(function (l) {
        cov.appendChild(U.stat(l.coverage + '%', langName(l.lang), l.count ? (l.published + ' published · ' + (l.count - l.published) + ' in progress') : 'not started', l.count ? 'green' : ''));
      });
      head.appendChild(cov);

      // controls
      var ctl = el('div'); ctl.style.cssText = 'display:flex;gap:10px;flex-wrap:wrap;align-items:center;margin-top:16px';
      var langSel = el('select', 'lang-select');
      LANGS.forEach(function (l) { var o = el('option', null, l[1]); o.value = l[0]; if (l[0] === tState.lang) o.selected = true; langSel.appendChild(o); });
      var levelSel = el('select', 'lang-select');
      ['all'].concat(d.levels || []).forEach(function (l) { var o = el('option', null, l === 'all' ? 'All levels' : 'HSK ' + l); o.value = l; if (l === tState.level) o.selected = true; levelSel.appendChild(o); });
      var search = el('input', 'hx-input'); search.placeholder = 'Search hanzi, pinyin, or meaning…'; search.style.maxWidth = '300px';
      ctl.appendChild(langSel); ctl.appendChild(levelSel); ctl.appendChild(search);
      head.appendChild(ctl);
      body.appendChild(head);

      var results = el('div'); results.style.marginTop = '14px';
      body.appendChild(results);

      function tblHead() {
        var hr = el('tr');
        ['Hanzi', 'Pinyin', 'English', langName(tState.lang), 'Status', 'Updated', ''].forEach(function (h) {
          var th = el('th', null, esc(h)); th.style.cssText = 'text-align:left;color:var(--text-2);padding:9px;border-bottom:1px solid var(--border);white-space:nowrap';
          hr.appendChild(th);
        });
        var thead = el('thead'); thead.appendChild(hr); return thead;
      }

      function load() {
        U.clear(results); results.appendChild(U.loading(3));
        window.API.adminTranslationSearch(tState.lang, tState.q, tState.level, 50).then(function (rr) {
          U.clear(results);
          if (!rr.ok || !rr.success) { results.appendChild(U.error('Could not load translations', (rr.error && rr.error.message) || '')); return; }
          var rows = rr.data.rows || [];
          var box = card();
          var top = el('div'); top.style.cssText = 'display:flex;justify-content:space-between;align-items:center';
          top.appendChild(el('div', 'ui-h3', langName(tState.lang) + ' · ' + fmt(rr.data.returned) + ' of ' + fmt(rr.data.total) + ' matches'));
          top.appendChild(el('div', 'ui-muted', 'Click a row to edit'));
          box.appendChild(top);
          if (!rows.length) { box.appendChild(U.empty('No matching words', 'Try a different search or level.')); results.appendChild(box); return; }
          var tbl = el('table'); tbl.style.cssText = 'width:100%;border-collapse:collapse;font-size:13.5px;margin-top:10px';
          tbl.appendChild(tblHead());
          var tb = el('tbody');
          rows.forEach(function (v) {
            var tr = el('tr'); tr.style.cursor = 'pointer';
            var hz = el('td'); hz.style.cssText = 'padding:9px;border-bottom:1px solid var(--border);font-size:19px';
            hz.appendChild(el('span', null, esc(v.hanzi)));
            if (v.traditional && v.traditional !== v.hanzi) { var t2 = el('div', 'ui-muted', esc(v.traditional)); t2.style.fontSize = '12px'; hz.appendChild(t2); }
            tr.appendChild(hz);
            tr.appendChild(tdv(v.pinyin));
            tr.appendChild(tdv(v.def.length > 42 ? v.def.slice(0, 42) + '…' : v.def));
            var mc = el('td'); mc.style.cssText = 'padding:9px;border-bottom:1px solid var(--border)';
            mc.appendChild(el('div', null, v.translation && v.translation.meaning ? esc(v.translation.meaning) : ''));
            if (!v.translation) mc.appendChild(el('span', 'ui-muted', '— not translated'));
            tr.appendChild(mc);
            var sc = el('td'); sc.style.cssText = 'padding:9px;border-bottom:1px solid var(--border)';
            var stt = v.translation ? v.translation.status : 'missing';
            sc.appendChild(U.badge(stt, stt === 'published' ? 'green' : stt === 'reviewed' ? 'blue' : stt === 'draft' ? 'amber' : ''));
            tr.appendChild(sc);
            tr.appendChild(tdv(v.translation && v.translation.updatedAt ? ago(v.translation.updatedAt) : '—'));
            var ac = el('td'); ac.style.cssText = 'padding:9px;border-bottom:1px solid var(--border)';
            ac.appendChild(miniBtn('Edit', function () { openEditor(v, load); }));
            tr.appendChild(ac);
            tr.addEventListener('click', function (e) { if (e.target.tagName === 'BUTTON') return; openEditor(v, load); });
            tb.appendChild(tr);
          });
          tbl.appendChild(tb); box.appendChild(tbl); results.appendChild(box);
        }).catch(function () { U.clear(results); results.appendChild(U.error('Could not load translations')); });
      }

      var timer = null;
      search.addEventListener('input', function () { tState.q = search.value.trim(); clearTimeout(timer); timer = setTimeout(load, 250); });
      langSel.addEventListener('change', function () { tState.lang = langSel.value; load(); });
      levelSel.addEventListener('change', function () { tState.level = levelSel.value; load(); });
      load();
    }).catch(function () { U.clear(body); body.appendChild(U.error('Could not load translation stats')); });
  }

  function openEditor(v, reload) {
    var U2 = U;
    var row = v.translation || { meaning: '', explanation: '', example: '', status: 'draft' };
    var backdrop = el('div', 'hx-modal-backdrop');
    backdrop.style.cssText = 'position:fixed;inset:0;background:rgba(15,23,42,.45);z-index:60;display:flex;align-items:center;justify-content:center;padding:20px';
    var modal = el('div', 'ui-card');
    modal.style.cssText = 'max-width:560px;width:100%;max-height:88vh;overflow:auto';
    var head = el('div'); head.style.cssText = 'display:flex;justify-content:space-between;align-items:flex-start;gap:12px';
    var left = el('div');
    left.appendChild(el('div', 'ui-h3', 'Translate · ' + langName(tState.lang)));
    left.appendChild(el('div', 'ui-muted', 'HSK ' + esc(v.level)));
    head.appendChild(left);
    var close = el('button', 'ui-btn ui-btn-ghost', '✕'); close.type = 'button';
    head.appendChild(close);
    modal.appendChild(head);

    var hz = el('div'); hz.style.cssText = 'font-size:40px;margin-top:6px';
    hz.appendChild(el('span', null, esc(v.hanzi)));
    if (v.traditional && v.traditional !== v.hanzi) { var tr2 = el('span', 'ui-muted', ' ' + esc(v.traditional)); tr2.style.fontSize = '20px'; hz.appendChild(tr2); }
    modal.appendChild(hz);
    modal.appendChild(el('div', 'ui-muted', esc(v.pinyin) + (v.toneNumbers ? ' · ' + esc(v.toneNumbers) : '')));
    var enBox = el('div'); enBox.style.cssText = 'background:var(--bg-2,rgba(15,23,42,.04));border-radius:8px;padding:10px;margin-top:10px';
    enBox.appendChild(el('div', 'ui-muted', 'English'));
    enBox.appendChild(el('div', null, esc(v.def) || '(no gloss in source)'));
    modal.appendChild(enBox);

    function field(label, val, ph, area) {
      var w = el('div'); w.style.marginTop = '12px';
      w.appendChild(el('label', 'ui-muted', label));
      var inp = area ? el('textarea', 'hx-input') : el('input', 'hx-input');
      if (area) { inp.rows = 3; inp.style.resize = 'vertical'; }
      inp.value = val || ''; inp.placeholder = ph || '';
      w.appendChild(inp); return { wrap: w, input: inp };
    }
    var mF = field(langName(tState.lang) + ' meaning *', row.meaning, 'translation of the meaning');
    var xF = field('Explanation (optional)', row.explanation, 'grammar notes, usage, nuance', true);
    var eF = field('Example translation (optional)', row.example, 'example sentence in ' + langName(tState.lang), true);
    modal.appendChild(mF.wrap); modal.appendChild(xF.wrap); modal.appendChild(eF.wrap);

    var sW = el('div'); sW.style.marginTop = '12px';
    sW.appendChild(el('label', 'ui-muted', 'Status'));
    var sSel = el('select', 'lang-select');
    ['draft', 'reviewed', 'published'].forEach(function (s) { var o = el('option', null, s); o.value = s; if ((row.status || 'draft') === s) o.selected = true; sSel.appendChild(o); });
    sW.appendChild(sSel); modal.appendChild(sW);

    var bar = el('div'); bar.style.cssText = 'display:flex;gap:8px;justify-content:flex-end;margin-top:16px';
    if (row.meaning) bar.appendChild(U.button('Delete', { variant: 'ghost', onClick: function () {
      if (!window.confirm('Delete this translation?')) return;
      window.API.adminTranslationSave({ lang: tState.lang, hanzi: v.hanzi, delete: true }).then(function (r) {
        if (r.ok && r.success) { U.toast('Translation deleted'); cleanup(); reload(); } else U.toast('Could not delete');
      });
    } }));
    bar.appendChild(U.button('Cancel', { variant: 'ghost', onClick: function () { cleanup(); } }));
    var save = U.button('Save', { variant: 'primary', onClick: function () {
      var payload = { lang: tState.lang, hanzi: v.hanzi, meaning: mF.input.value.trim(), explanation: xF.input.value.trim(), example: eF.input.value.trim(), status: sSel.value };
      if (!payload.meaning) return U.toast('Meaning is required');
      save.disabled = true;
      window.API.adminTranslationSave(payload).then(function (r) {
        save.disabled = false;
        if (r.ok && r.success) { U.toast('Saved (' + sSel.value + ')'); cleanup(); reload(); } else U.toast((r.error && r.error.message) || 'Could not save');
      }).catch(function () { save.disabled = false; U.toast('Could not save'); });
    } });
    bar.appendChild(save);
    modal.appendChild(bar);
    backdrop.appendChild(modal);
    function cleanup() { if (backdrop.parentNode) backdrop.parentNode.removeChild(backdrop); document.removeEventListener('keydown', onKey); }
    function onKey(e) { if (e.key === 'Escape') cleanup(); }
    close.addEventListener('click', cleanup);
    backdrop.addEventListener('click', function (e) { if (e.target === backdrop) cleanup(); });
    document.addEventListener('keydown', onKey);
    document.body.appendChild(backdrop);
    setTimeout(function () { try { mF.input.focus(); } catch (e) {} }, 30);
  }

  window.V7 = { admin: admin };
})();
