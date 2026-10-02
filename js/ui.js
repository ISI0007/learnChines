/* 汉学课堂 — UI component system (small, dependency-free).
   Spec §7-§9 design language, §91 loading/error/empty states. */
(function () {
  'use strict';

  function el(tag, cls, html) {
    var d = document.createElement(tag);
    if (cls) d.className = cls;
    if (html !== undefined && html !== null) d.innerHTML = html;
    return d;
  }
  function esc(s) { var d = document.createElement('div'); d.textContent = s == null ? '' : String(s); return d.innerHTML; }
  function txt(s) { return document.createTextNode(s == null ? '' : String(s)); }
  function q(sel, root) { return (root || document).querySelector(sel); }
  function qa(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function clear(node) { while (node.firstChild) node.removeChild(node.firstChild); return node; }
  function mount(node, children) { clear(node); (children || []).forEach(function (c) { if (c) node.appendChild(c); }); return node; }
  function fmtSize(b) {
    if (!b) return '';
    var kb = b / 1024; if (kb < 1024) return Math.round(kb) + ' KB';
    var mb = kb / 1024; if (mb < 1024) return mb.toFixed(1) + ' MB';
    return (mb / 1024).toFixed(2) + ' GB';
  }

  var UI = {
    el: el, esc: esc, txt: txt, q: q, qa: qa, clear: clear, mount: mount, fmtSize: fmtSize,

    card: function (children, cls) { var c = el('div', 'ui-card' + (cls ? ' ' + cls : '')); (children || []).forEach(function (x) { c.appendChild(x); }); return c; },
    h: function (level, text, cls) { return el('h' + level, 'ui-h' + (cls ? ' ' + cls : ''), esc(text)); },
    p: function (text, cls) { return el('p', 'ui-p' + (cls ? ' ' + cls : ''), esc(text)); },
    muted: function (text) { return el('p', 'ui-muted', esc(text)); },

    button: function (label, opts) {
      opts = opts || {};
      var b = el('button', 'ui-btn' + (opts.variant ? ' ui-btn-' + opts.variant : '') + (opts.block ? ' ui-btn-block' : ''));
      b.type = opts.type || 'button';
      b.textContent = label;
      if (opts.disabled) b.disabled = true;
      if (opts.title) b.title = opts.title;
      if (opts.onClick) b.addEventListener('click', opts.onClick);
      if (opts.icon) { b.innerHTML = ''; b.appendChild(el('span', 'ui-btn-ic', esc(opts.icon))); b.appendChild(txt(' ' + label)); }
      return b;
    },
    // Honest placeholder button for not-yet-built features (Spec §101 — no dead UI).
    soonButton: function (label, phase) {
      var self = this;
      return this.button(label, { variant: 'ghost', title: phase ? ('Planned: ' + phase) : '', disabled: true, icon: '🔒' });
    },
    link: function (label, href, cls) { var a = el('a', 'ui-link' + (cls ? ' ' + cls : ''), esc(label)); a.href = href; return a; },
    buttonLink: function (label, onClick, opts) { opts = opts || {}; opts.onClick = onClick; return this.button(label, opts); },

    chip: function (label, opts) {
      opts = opts || {};
      var c = el('button', 'ui-chip' + (opts.active ? ' active' : '') + (opts.level ? ' lv' + opts.level : ''));
      c.textContent = label;
      if (opts.disabled) c.disabled = true;
      if (opts.onClick) c.addEventListener('click', opts.onClick);
      return c;
    },
    badge: function (label, kind) { return el('span', 'ui-badge' + (kind ? ' ' + kind : ''), esc(label)); },
    pill: function (label) { return el('span', 'ui-pill', esc(label)); },

    stat: function (value, label, sub, color) {
      var d = el('div', 'ui-stat' + (color ? ' ' + color : ''));
      d.appendChild(el('div', 'ui-stat-num', esc(value)));
      d.appendChild(el('div', 'ui-stat-lbl', esc(label)));
      if (sub) d.appendChild(el('div', 'ui-stat-sub', esc(sub)));
      return d;
    },

    progressBar: function (pct, cls) {
      var wrap = el('div', 'ui-progress' + (cls ? ' ' + cls : ''));
      var fill = el('div', 'ui-progress-fill');
      fill.style.width = Math.max(0, Math.min(100, pct)) + '%';
      wrap.appendChild(fill);
      wrap.setAttribute('role', 'progressbar');
      wrap.setAttribute('aria-valuenow', String(Math.round(pct)));
      wrap.setAttribute('aria-valuemin', '0'); wrap.setAttribute('aria-valuemax', '100');
      return wrap;
    },

    avatar: function (name, size) {
      var n = (name || '?').trim();
      var a = el('span', 'ui-avatar' + (size ? ' ui-avatar-' + size : ''), esc(n.slice(0, 1).toUpperCase()));
      return a;
    },

    grid: function (children, cls) { var g = el('div', 'ui-grid' + (cls ? ' ' + cls : '')); (children || []).forEach(function (c) { g.appendChild(c); }); return g; },
    row: function (children, cls) { var r = el('div', 'ui-row' + (cls ? ' ' + cls : '')); (children || []).forEach(function (c) { r.appendChild(c); }); return r; },

    // States (Spec §91)
    loading: function (lines) {
      var wrap = el('div', 'ui-skeleton');
      for (var i = 0; i < (lines || 3); i++) wrap.appendChild(el('div', 'ui-skeleton-line'));
      return wrap;
    },
    empty: function (title, sub, action) {
      var d = el('div', 'ui-state ui-state-empty');
      d.appendChild(el('div', 'ui-state-ic', '🗒️'));
      d.appendChild(el('div', 'ui-state-title', esc(title)));
      if (sub) d.appendChild(el('div', 'ui-state-sub', esc(sub)));
      if (action) d.appendChild(action);
      return d;
    },
    error: function (title, sub, retry) {
      var d = el('div', 'ui-state ui-state-error');
      d.appendChild(el('div', 'ui-state-ic', '⚠️'));
      d.appendChild(el('div', 'ui-state-title', esc(title || 'Something went wrong')));
      if (sub) d.appendChild(el('div', 'ui-state-sub', esc(sub)));
      if (retry) d.appendChild(UI.button('Retry', { variant: 'primary', onClick: retry }));
      return d;
    },

    sectionHead: function (title, action) {
      var h = el('div', 'ui-section-head');
      h.appendChild(el('h2', 'ui-section-title', esc(title)));
      if (action) h.appendChild(action);
      return h;
    },

    toast: function (msg) {
      var t = q('#toast');
      if (!t) { t = el('div', 'ui-toast'); t.id = 'toast'; document.body.appendChild(t); }
      t.textContent = msg; t.classList.add('show');
      clearTimeout(t._h); t._h = setTimeout(function () { t.classList.remove('show'); }, 2400);
    },
  };

  window.UI = UI;
})();
