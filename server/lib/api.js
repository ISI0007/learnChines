'use strict';
// API handlers. Each writes a JSON envelope: success:{success,data} / error:{success,error:{code,message}}.
const db = require('./db');
const auth = require('./auth');
const totp = require('./totp');
const secretbox = require('./secretbox');
const oauth = require('./oauth');

const USERNAME_RE = /^[a-zA-Z0-9_.-]{3,24}$/;

function send(res, status, obj) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(obj));
}
const ok = (res, data) => send(res, 200, { success: true, data });
const created = (res, data) => send(res, 201, { success: true, data });
const fail = (res, status, code, message) => send(res, status, { success: false, error: { code, message } });

function todayStr() {
  try { return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Shanghai' }); }
  catch (e) { return new Date().toISOString().slice(0, 10); }
}
function clampInt(v, min, max) { v = Number(v); if (!isFinite(v)) return min; return Math.max(min, Math.min(max, Math.floor(v))); }
function strArr(a, maxItems, maxLen) {
  if (!Array.isArray(a)) return [];
  const out = [];
  for (const x of a) { if (out.length >= maxItems) break; if (typeof x === 'string' && x.length) out.push(x.slice(0, maxLen)); }
  return out;
}
function sanitizeProgress(input) {
  const out = db.defaultProgress();
  if (!input || typeof input !== 'object') return out;
  if (input.known && typeof input.known === 'object') {
    let n = 0;
    for (const k of Object.keys(input.known)) {
      if (n >= 5000) break;
      if (typeof k === 'string' && k.length <= 40 && input.known[k]) { out.known[k] = true; n++; }
    }
  }
  const q = input.quiz || {};
  out.quiz.taken = clampInt(q.taken, 0, 100000);
  out.quiz.correct = clampInt(q.correct, 0, 1000000);
  out.quiz.answered = clampInt(q.answered, 0, 1000000);
  if (q.byLevel && typeof q.byLevel === 'object') {
    for (const l of Object.keys(q.byLevel).slice(0, 20)) {
      const v = q.byLevel[l] || {};
      out.quiz.byLevel[String(l).slice(0, 8)] = {
        taken: clampInt(v.taken, 0, 100000),
        correct: clampInt(v.correct, 0, 1000000),
        best: clampInt(v.best, 0, 100),
      };
    }
  }
  out.examsOpened = strArr(input.examsOpened, 500, 120);
  out.booksOpened = strArr(input.booksOpened, 500, 160);
  const ap = input.audioPlayed || {};
  out.audioPlayed.count = clampInt(ap.count, 0, 1e7);
  out.audioPlayed.recent = strArr(ap.recent, 50, 200);
  const st = input.streak || {};
  out.streak.current = clampInt(st.current, 0, 100000);
  out.streak.longest = clampInt(st.longest, 0, 100000);
  out.streak.lastDay = (typeof st.lastDay === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(st.lastDay)) ? st.lastDay : null;
  out.xp = clampInt(input.xp, 0, 1e8);
  out.studyDays = strArr(input.studyDays, 400, 10);
  out.updatedAt = new Date().toISOString();
  return out;
}
function pushActivity(user, type, detail) {
  if (!Array.isArray(user.activity)) user.activity = [];
  user.activity.push({ t: new Date().toISOString(), type: String(type || '').slice(0, 40), detail: String(detail || '').slice(0, 160) });
  if (user.activity.length > 300) user.activity = user.activity.slice(-300);
}
function ensureProgress(user) {
  if (!user.progress || typeof user.progress !== 'object') user.progress = db.defaultProgress();
  return user.progress;
}
const UI_LANGS = ['en','zh-CN','zh-TW','ru','ur','ar','fa','hi','es','fr','de','pt','ja','ko','it','tr','id','vi','bn','th'];
const PINYIN = ['always','click','hidden'];
const CHARS = ['simplified','traditional','both'];
const TDM = ['always','click','hidden'];
function pick(v, allowed, def) { return allowed.includes(v) ? v : def; }
function sanitizeSettings(input) {
  const out = db.defaultSettings();
  if (!input || typeof input !== 'object') return out;
  out.uiLanguage = pick(input.uiLanguage, UI_LANGS, out.uiLanguage);
  out.learningLanguage = ['zh-CN','zh-TW'].includes(input.learningLanguage) ? input.learningLanguage : out.learningLanguage;
  out.translationLanguage = pick(input.translationLanguage, UI_LANGS, out.translationLanguage);
  out.pinyinPreference = pick(input.pinyinPreference, PINYIN, out.pinyinPreference);
  out.characterPreference = pick(input.characterPreference, CHARS, out.characterPreference);
  out.translationDisplayMode = pick(input.translationDisplayMode, TDM, out.translationDisplayMode);
  out.dailyGoalMinutes = clampInt(input.dailyGoalMinutes, 0, 600);
  out.updatedAt = new Date().toISOString();
  return out;
}
function ensureSettings(user) {
  if (!user.settings || typeof user.settings !== 'object') user.settings = db.defaultSettings();
  return user.settings;
}
function touchDay(user) {
  const p = ensureProgress(user);
  const today = todayStr();
  if (!Array.isArray(p.studyDays)) p.studyDays = [];
  if (!p.studyDays.includes(today)) {
    p.studyDays.push(today);
    if (p.studyDays.length > 400) p.studyDays = p.studyDays.slice(-400);
  }
  const s = p.streak || (p.streak = { current: 0, longest: 0, lastDay: null });
  if (s.lastDay !== today) {
    const yStr = new Date(Date.now() - 86400000).toLocaleDateString('en-CA', { timeZone: 'Asia/Shanghai' });
    s.current = (s.lastDay === yStr) ? (clampInt(s.current, 0, 1e5) + 1) : 1;
    s.longest = Math.max(clampInt(s.longest, 0, 1e5), s.current);
    s.lastDay = today;
  }
}

// ── handlers ──
function register(ctx) {
  const { res, body } = ctx;
  const username = String(body.username || '').trim();
  const password = String(body.password || '');
  if (!USERNAME_RE.test(username)) return fail(res, 400, 'INVALID_USERNAME', 'Username must be 3-24 letters, numbers, or _ . -');
  if (password.length < 8 || password.length > 200) return fail(res, 400, 'INVALID_PASSWORD', 'Password must be at least 8 characters');
  if (db.findUserByName(username)) return fail(res, 409, 'USERNAME_TAKEN', 'That username is already taken');

  const u = db.createUser({ username, displayName: String(body.displayName || '').trim().slice(0, 40) || username });
  auth.setPassword(u, password);
  u.lastLoginAt = new Date().toISOString();
  u.loginCount = 1;
  touchDay(u);
  pushActivity(u, 'register', 'Account created');
  db.saveUsers();
  const token = auth.createSession(u.id, { ua: ctx.req.headers['user-agent'] });
  ctx.setSession(token);
  created(res, { user: auth.publicUser(u), token: token });
}

function login(ctx) {
  const { res, body } = ctx;
  const username = String(body.username || '').trim().toLowerCase();
  const password = String(body.password || '');
  const u = db.findUserByName(username);
  if (!u || !auth.verifyPassword(password, u.salt, u.hash)) {
    // Rate-limit only failed attempts, so repeated legitimate sign-ins are never blocked.
    if (ctx.rateLimit('login', 20, 5 * 60 * 1000)) return fail(res, 429, 'RATE_LIMITED', 'Too many failed attempts. Try again shortly.');
    return fail(res, 401, 'BAD_CREDENTIALS', 'Incorrect username or password');
  }
  if (u.suspended) return fail(res, 403, 'ACCOUNT_SUSPENDED', 'This account is suspended. Contact an administrator.');
  // Two-factor: hand back a short-lived challenge instead of a session (Spec §77).
  if (u.twoFA && u.twoFA.enabled && u.twoFA.secret) {
    const challenge = auth.createChallenge(u.id, { ua: ctx.req.headers['user-agent'] });
    return ok(res, { twoFA: true, challenge: challenge, expiresIn: Math.round(auth.CHALLENGE_MS / 1000) });
  }
  touchDay(u);
  u.lastLoginAt = new Date().toISOString();
  u.loginCount = (u.loginCount || 0) + 1;
  pushActivity(u, 'login', 'Signed in');
  db.saveUsers();
  const token = auth.createSession(u.id, { ua: ctx.req.headers['user-agent'] });
  ctx.setSession(token);
  ok(res, { user: auth.publicUser(u), token: token });
}

function logout(ctx) {
  auth.destroySession(ctx.sessionToken);
  ctx.clearSession();
  ok(ctx.res, { ok: true });
}

function me(ctx) {
  ok(ctx.res, { user: auth.publicUser(ctx.user), progress: ensureProgress(ctx.user), settings: ensureSettings(ctx.user), serverTime: new Date().toISOString() });
}

function getSettings(ctx) { ok(ctx.res, { settings: ensureSettings(ctx.user) }); }

function putSettings(ctx) {
  ctx.user.settings = sanitizeSettings(ctx.body && ctx.body.settings ? ctx.body.settings : ctx.body);
  db.saveUsers();
  ok(ctx.res, { settings: ctx.user.settings });
}

// ── community (Phase 6) ──
const TOPIC_TAGS = ['hsk4', 'grammar', 'tones', 'listening', 'pinyin', 'speaking', 'vocab', 'exam', 'culture', 'general'];
function publicPost(p) {
  return {
    id: p.id, title: p.title, body: p.body, tag: p.tag,
    author: p.authorName, authorId: p.authorId, createdAt: p.createdAt,
    likes: (p.likes || []).length, comments: (p.comments || []).length,
    flags: (p.flags || []).length,
  };
}
function listPosts(ctx) {
  const tag = ctx.query.get('tag');
  const sort = ctx.query.get('sort') || 'new';
  let posts = (db.state.posts || []).slice();
  if (tag) posts = posts.filter((p) => p.tag === tag);
  if (sort === 'top') posts.sort((a, b) => (b.likes || []).length - (a.likes || []).length);
  else posts.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  ok(ctx.res, { posts: posts.slice(0, 100).map(publicPost), total: posts.length });
}
function createPost(ctx) {
  const b = ctx.body || {};
  const title = String(b.title || '').trim().slice(0, 120);
  const body = String(b.body || '').trim().slice(0, 4000);
  if (title.length < 3) return fail(ctx.res, 400, 'INVALID_TITLE', 'Title must be at least 3 characters');
  if (!body) return fail(ctx.res, 400, 'INVALID_BODY', 'Post body is required');
  const tag = TOPIC_TAGS.includes(String(b.tag)) ? String(b.tag) : 'general';
  const post = {
    id: db.newId(), title, body, tag,
    authorId: ctx.user.id, authorName: ctx.user.displayName || ctx.user.username,
    createdAt: new Date().toISOString(), likes: [], comments: [],
  };
  db.state.posts.unshift(post);
  if (db.state.posts.length > 500) db.state.posts = db.state.posts.slice(0, 500);
  db.savePosts();
  pushActivity(ctx.user, 'post', 'Posted: ' + title);
  db.saveUsers();
  created(ctx.res, { post: publicPost(post) });
}
function getPost(ctx) {
  const p = (db.state.posts || []).find((x) => x.id === ctx.params.id);
  if (!p) return fail(ctx.res, 404, 'NOT_FOUND', 'Post not found');
  ok(ctx.res, { post: Object.assign(publicPost(p), {
    comments: (p.comments || []).map((c) => ({ id: c.id, body: c.body, author: c.authorName, createdAt: c.createdAt })),
    liked: ctx.user ? (p.likes || []).includes(ctx.user.id) : false,
  }) });
}
function likePost(ctx) {
  const p = (db.state.posts || []).find((x) => x.id === ctx.params.id);
  if (!p) return fail(ctx.res, 404, 'NOT_FOUND', 'Post not found');
  if (!Array.isArray(p.likes)) p.likes = [];
  const i = p.likes.indexOf(ctx.user.id);
  if (i === -1) p.likes.push(ctx.user.id); else p.likes.splice(i, 1);
  db.savePosts();
  ok(ctx.res, { likes: p.likes.length, liked: i === -1 });
}
function commentPost(ctx) {
  const p = (db.state.posts || []).find((x) => x.id === ctx.params.id);
  if (!p) return fail(ctx.res, 404, 'NOT_FOUND', 'Post not found');
  const body = String((ctx.body && ctx.body.body) || '').trim().slice(0, 2000);
  if (!body) return fail(ctx.res, 400, 'INVALID_COMMENT', 'Comment body is required');
  if (!Array.isArray(p.comments)) p.comments = [];
  const c = { id: db.newId(), body, authorId: ctx.user.id, authorName: ctx.user.displayName || ctx.user.username, createdAt: new Date().toISOString() };
  p.comments.push(c);
  if (p.comments.length > 200) p.comments = p.comments.slice(-200);
  db.savePosts();
  ok(ctx.res, { comment: { id: c.id, body: c.body, author: c.authorName, createdAt: c.createdAt } });
}
function deletePost(ctx) {
  const i = (db.state.posts || []).findIndex((x) => x.id === ctx.params.id);
  if (i === -1) return fail(ctx.res, 404, 'NOT_FOUND', 'Post not found');
  const p = db.state.posts[i];
  if (p.authorId !== ctx.user.id && ctx.user.role !== 'admin') return fail(ctx.res, 403, 'FORBIDDEN', 'You can only delete your own posts');
  db.state.posts.splice(i, 1);
  db.savePosts();
  ok(ctx.res, { ok: true });
}

function getProgress(ctx) { ok(ctx.res, { progress: ensureProgress(ctx.user) }); }

function putProgress(ctx) {
  const raw = JSON.stringify(ctx.body.progress || {});
  if (raw.length > ctx.limits.PROGRESS_MAX) return fail(ctx.res, 413, 'PROGRESS_TOO_LARGE', 'Progress payload too large');
  ctx.user.progress = sanitizeProgress(ctx.body.progress);
  touchDay(ctx.user);
  db.saveUsers();
  ok(ctx.res, { progress: ctx.user.progress });
}

function postActivity(ctx) {
  const b = ctx.body || {};
  pushActivity(ctx.user, b.type, b.detail);
  if (b.type !== 'audio') touchDay(ctx.user);
  db.saveUsers();
  ok(ctx.res, { ok: true });
}

function changePassword(ctx) {
  const { body } = ctx;
  if (!auth.verifyPassword(String(body.currentPassword || ''), ctx.user.salt, ctx.user.hash)) {
    return fail(ctx.res, 401, 'BAD_PASSWORD', 'Current password is incorrect');
  }
  const next = String(body.newPassword || '');
  if (next.length < 8 || next.length > 200) return fail(ctx.res, 400, 'INVALID_PASSWORD', 'New password must be at least 8 characters');
  auth.setPassword(ctx.user, next);
  auth.destroyUserSessions(ctx.user.id);
  pushActivity(ctx.user, 'security', 'Password changed (all sessions signed out)');
  db.saveUsers();
  ok(ctx.res, { ok: true });
}

function adminUsers(ctx) {
  if (ctx.user.role !== 'admin') return fail(ctx.res, 403, 'FORBIDDEN', 'Admin only');
  const users = db.state.users.map((u) => {
    const p = u.progress || {};
    const q = p.quiz || {};
    const act = Array.isArray(u.activity) ? u.activity : [];
    return {
      id: u.id, username: u.username, displayName: u.displayName, role: u.role,
      createdAt: u.createdAt, lastLoginAt: u.lastLoginAt, loginCount: u.loginCount || 0,
      known: Object.keys(p.known || {}).length,
      xp: p.xp || 0, streak: (p.streak && p.streak.current) || 0, longestStreak: (p.streak && p.streak.longest) || 0,
      quizzes: q.taken || 0, quizCorrect: q.correct || 0, quizAnswered: q.answered || 0,
      exams: (p.examsOpened || []).length, books: (p.booksOpened || []).length,
      audioListens: (p.audioPlayed && p.audioPlayed.count) || 0,
      studyDays: (p.studyDays || []).length,
      activityCount: act.length,
      lastActivity: act.length ? act[act.length - 1].t : null,
    };
  });
  ok(ctx.res, { users, me: ctx.user.id });
}

function adminUser(ctx) {
  if (ctx.user.role !== 'admin') return fail(ctx.res, 403, 'FORBIDDEN', 'Admin only');
  const u = db.findUserById(ctx.params.id);
  if (!u) return fail(ctx.res, 404, 'NOT_FOUND', 'User not found');
  ok(ctx.res, {
    user: auth.publicUser(u),
    progress: u.progress || db.defaultProgress(),
    activity: (u.activity || []).slice(-100).reverse(),
  });
}

function adminSessions(ctx) {
  if (ctx.user.role !== 'admin') return fail(ctx.res, 403, 'FORBIDDEN', 'Admin only');
  const now = Date.now();
  const sessions = Object.keys(db.state.sessions).map((token) => {
    const s = db.state.sessions[token] || {};
    const u = db.findUserById(s.userId);
    return {
      username: u ? u.username : '(deleted user)',
      displayName: u ? (u.displayName || u.username) : '',
      role: u ? u.role : '',
      created: s.created ? new Date(s.created).toISOString() : null,
      lastSeen: s.lastSeen ? new Date(s.lastSeen).toISOString() : null,
      expires: s.expires ? new Date(s.expires).toISOString() : null,
      daysLeft: s.expires ? Math.max(0, Math.round((s.expires - now) / 86400000)) : 0,
      active: !!(s.expires && s.expires > now),
    };
  }).sort((a, b) => (b.lastSeen || '').localeCompare(a.lastSeen || ''));
  ok(ctx.res, { sessions });
}

// ── admin CMS (Phase 11) ──
const VOCAB_TOTAL = 2501, BOOKS_TOTAL = 42, EXAMS_TOTAL = 92, AUDIO_TOTAL = 896; // imported-library counts (tools/import-hsk.mjs)

function adminStats(ctx) {
  if (ctx.user.role !== 'admin') return fail(ctx.res, 403, 'FORBIDDEN', 'Admin only');
  const users = db.state.users;
  const posts = db.state.posts || [];
  const sessions = db.state.sessions || {};
  const now = Date.now(), day = 86400000;
  const learners = users.filter((u) => u.role !== 'admin');
  const suspended = users.filter((u) => u.suspended).length;
  const last7 = [0, 0, 0, 0, 0, 0, 0];
  const byLevel = {};
  let xp = 0, known = 0, quizzes = 0, active7 = 0, active30 = 0, new7 = 0, studyDays = 0;
  for (const u of users) {
    const p = u.progress || {};
    xp += p.xp || 0;
    quizzes += (p.quiz && p.quiz.taken) || 0;
    const seen = u.lastLoginAt || u.createdAt;
    if (seen) { const age = now - new Date(seen).getTime(); if (age <= 7 * day) active7++; if (age <= 30 * day) active30++; }
    if (u.createdAt && now - new Date(u.createdAt).getTime() <= 7 * day) new7++;
    const days = p.studyDays || [];
    studyDays += days.length;
    for (const d of days) {
      const idx = Math.floor((now - new Date(d + 'T12:00:00Z').getTime()) / day);
      if (idx >= 0 && idx < 7) last7[6 - idx]++;
    }
    for (const k of Object.keys(p.known || {})) {
      known++;
      const m = /^(\d)/.exec(k); const l = m ? m[1] : '?';
      byLevel[l] = (byLevel[l] || 0) + 1;
    }
  }
  const tagCounts = {};
  for (const p of posts) tagCounts[p.tag || 'general'] = (tagCounts[p.tag || 'general'] || 0) + 1;
  const activeSessions = Object.keys(sessions).filter((k) => sessions[k] && sessions[k].expires > now).length;
  const recent = users.slice().sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || ''))).slice(0, 6)
    .map((u) => ({ username: u.username, displayName: u.displayName, createdAt: u.createdAt, role: u.role, suspended: !!u.suspended }));
  ok(ctx.res, {
    users: { total: users.length, learners: learners.length, admins: users.length - learners.length, suspended, new7, active7, active30 },
    content: { vocabulary: VOCAB_TOTAL, books: BOOKS_TOTAL, exams: EXAMS_TOTAL, audio: AUDIO_TOTAL, posts: posts.length },
    engagement: { xp, known, quizzes, studyDays, studyMinutes: studyDays * 20 },
    sessions: { active: activeSessions, total: Object.keys(sessions).length },
    last7, byLevel, tagCounts, recent,
  });
}

function adminUserAction(ctx) {
  if (ctx.user.role !== 'admin') return fail(ctx.res, 403, 'FORBIDDEN', 'Admin only');
  const u = db.findUserById(ctx.params.id);
  if (!u) return fail(ctx.res, 404, 'NOT_FOUND', 'User not found');
  const action = String((ctx.body && ctx.body.action) || '');
  if (u.id === ctx.user.id && (action === 'suspend' || action === 'delete' || action === 'makeUser')) {
    return fail(ctx.res, 400, 'SELF', 'You cannot change your own account this way');
  }
  if (action === 'suspend') {
    if (u.role === 'admin') return fail(ctx.res, 400, 'PROTECTED', 'Administrators cannot be suspended');
    u.suspended = true; u.suspendedAt = new Date().toISOString(); u.suspendedBy = ctx.user.username;
    const n = auth.destroyUserSessions(u.id);
    pushActivity(u, 'admin', 'Suspended by ' + ctx.user.username + ' (revoked ' + n + ' session(s))');
    db.saveUsers();
    return ok(ctx.res, { user: auth.publicUser(u), suspended: true, revoked: n });
  }
  if (action === 'restore' || action === 'unsuspend') {
    u.suspended = false; delete u.suspendedAt; delete u.suspendedBy;
    pushActivity(u, 'admin', 'Restored by ' + ctx.user.username);
    db.saveUsers();
    return ok(ctx.res, { user: auth.publicUser(u), suspended: false });
  }
  if (action === 'makeAdmin' || action === 'makeUser') {
    u.role = action === 'makeAdmin' ? 'admin' : 'user';
    pushActivity(u, 'admin', 'Role set to ' + u.role + ' by ' + ctx.user.username);
    db.saveUsers();
    return ok(ctx.res, { user: auth.publicUser(u), role: u.role });
  }
  if (action === 'delete') {
    if (u.role === 'admin') return fail(ctx.res, 400, 'PROTECTED', 'Delete the admin role before removing an administrator');
    auth.destroyUserSessions(u.id);
    db.deleteUser(u.id);
    return ok(ctx.res, { deleted: true, id: u.id });
  }
  return fail(ctx.res, 400, 'BAD_ACTION', 'Unknown action');
}

function adminModeration(ctx) {
  if (ctx.user.role !== 'admin') return fail(ctx.res, 403, 'FORBIDDEN', 'Admin only');
  const posts = (db.state.posts || []).slice();
  posts.sort((a, b) => ((b.flags || []).length - (a.flags || []).length) || String(b.createdAt).localeCompare(String(a.createdAt)));
  const items = posts.slice(0, 100).map((p) => {
    const author = db.findUserById(p.authorId);
    return Object.assign(publicPost(p), {
      flags: (p.flags || []).length,
      suspendedAuthor: !!(author && author.suspended),
      bodyPreview: String(p.body || '').slice(0, 200),
    });
  });
  ok(ctx.res, {
    posts: items,
    stats: { posts: posts.length, flagged: posts.filter((p) => (p.flags || []).length).length, totalFlags: posts.reduce((a, p) => a + (p.flags || []).length, 0) },
  });
}

function adminComments(ctx) {
  if (ctx.user.role !== 'admin') return fail(ctx.res, 403, 'FORBIDDEN', 'Admin only');
  const out = [];
  for (const p of (db.state.posts || [])) {
    for (const c of (p.comments || [])) {
      out.push({ id: c.id, postId: p.id, postTitle: p.title, body: c.body, author: c.authorName, authorId: c.authorId, createdAt: c.createdAt });
    }
  }
  out.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  ok(ctx.res, { comments: out.slice(0, 200), total: out.length });
}

function adminDeleteComment(ctx) {
  if (ctx.user.role !== 'admin') return fail(ctx.res, 403, 'FORBIDDEN', 'Admin only');
  const p = (db.state.posts || []).find((x) => x.id === ctx.params.id);
  if (!p) return fail(ctx.res, 404, 'NOT_FOUND', 'Post not found');
  const before = (p.comments || []).length;
  p.comments = (p.comments || []).filter((c) => c.id !== ctx.params.cid);
  if (p.comments.length === before) return fail(ctx.res, 404, 'NOT_FOUND', 'Comment not found');
  db.savePosts();
  ok(ctx.res, { removed: true });
}

// Users can report a post; reports feed the admin moderation queue (Spec §78 Community→Reports).
function reportPost(ctx) {
  const p = (db.state.posts || []).find((x) => x.id === ctx.params.id);
  if (!p) return fail(ctx.res, 404, 'NOT_FOUND', 'Post not found');
  if (!Array.isArray(p.flags)) p.flags = [];
  if (!p.flags.includes(ctx.user.id)) p.flags.push(ctx.user.id);
  db.savePosts();
  ok(ctx.res, { flags: p.flags.length, reported: true });
}

// ── translation admin (Spec §79) ──
const config = require('../config');
const TRANS_LANGS = ['en','zh-CN','zh-TW','ru','ur','ar','fa','hi','es','fr','de','pt','ja','ko','it','tr','id','vi','bn','th'];
const TRANS_STATUS = ['draft','reviewed','published'];

let VOCAB_INDEX = null;
function vocabIndex() {
  if (VOCAB_INDEX) return VOCAB_INDEX;
  let data = {};
  try { data = JSON.parse(require('fs').readFileSync(config.VOCAB_FILE, 'utf8')); } catch (e) { data = {}; }
  const items = [];
  const levels = Object.keys(data).sort();
  for (const level of levels) {
    for (const v of (Array.isArray(data[level]) ? data[level] : [])) {
      if (v && v.s) items.push({ level: String(level), hanzi: v.s, traditional: v.t || v.s, pinyin: v.p || '', toneNumbers: v.pn || '', def: v.d || '' });
    }
  }
  VOCAB_INDEX = { items, levels };
  return VOCAB_INDEX;
}

function transBucket(lang, create) {
  const l = String(lang || '');
  if (!TRANS_LANGS.includes(l)) return null;
  const all = db.state.translations || (db.state.translations = {});
  if (!all[l] || typeof all[l] !== 'object' || Array.isArray(all[l])) { if (!create) return null; all[l] = {}; }
  return all[l];
}

// Public: published translations for one language, keyed by hanzi.
function publicTranslations(ctx) {
  const lang = String(ctx.query.get('lang') || '').trim();
  if (!TRANS_LANGS_SAFE(lang)) return fail(ctx.res, 400, 'BAD_LANG', 'Unsupported language');
  const bucket = transBucket(lang, false);
  const out = {};
  if (bucket) {
    for (const hz of Object.keys(bucket)) {
      const r = bucket[hz];
      if (r && r.status === 'published' && r.meaning) out[hz] = { m: r.meaning, x: r.explanation || '', e: r.example || '' };
    }
  }
  ok(ctx.res, { lang: lang, translations: out, count: Object.keys(out).length });
}
function TRANS_LANGS_SAFE(l) { return TRANS_LANGS.includes(String(l || '')); }

function adminTranslationStats(ctx) {
  if (ctx.user.role !== 'admin') return fail(ctx.res, 403, 'FORBIDDEN', 'Admin only');
  const vocab = vocabIndex();
  const total = vocab.items.length;
  const languages = TRANS_LANGS.map((lang) => {
    const bucket = transBucket(lang, false) || {};
    let draft = 0, reviewed = 0, published = 0;
    for (const hz of Object.keys(bucket)) {
      const st = (bucket[hz] || {}).status;
      if (st === 'published') published++; else if (st === 'reviewed') reviewed++; else draft++;
    }
    const count = Object.keys(bucket).length;
    return { lang, count, draft, reviewed, published, total, missing: Math.max(0, total - count), coverage: total ? Math.round((count / total) * 1000) / 10 : 0 };
  }).filter((x) => x.count > 0 || x.lang === 'en');
  ok(ctx.res, { vocabTotal: total, languages, levels: vocab.levels, activeLanguages: languages.filter((l) => l.count > 0).length });
}

function adminTranslationSearch(ctx) {
  if (ctx.user.role !== 'admin') return fail(ctx.res, 403, 'FORBIDDEN', 'Admin only');
  const lang = String(ctx.query.get('lang') || 'en');
  if (!TRANS_LANGS_SAFE(lang)) return fail(ctx.res, 400, 'BAD_LANG', 'Unsupported language');
  const q = String(ctx.query.get('q') || '').trim().toLowerCase();
  const level = String(ctx.query.get('level') || '').trim();
  const limit = Math.min(100, Math.max(1, Number(ctx.query.get('limit')) || 50));
  let items = vocabIndex().items;
  if (level && level !== 'all') items = items.filter((v) => v.level === level);
  if (q) {
    const qq = q.replace(/\s/g, '');
    items = items.filter((v) => v.hanzi.indexOf(q) !== -1 || (v.traditional || '').indexOf(q) !== -1 ||
      v.pinyin.toLowerCase().indexOf(q) !== -1 || v.toneNumbers.toLowerCase().replace(/\s/g, '').indexOf(qq) !== -1 ||
      v.def.toLowerCase().indexOf(q) !== -1);
  }
  const bucket = transBucket(lang, false) || {};
  const rows = items.slice(0, limit).map((v) => {
    const r = bucket[v.hanzi] || null;
    return Object.assign({}, v, { translation: r ? { meaning: r.meaning || '', explanation: r.explanation || '', example: r.example || '', status: r.status || 'draft', updatedAt: r.updatedAt || null } : null });
  });
  ok(ctx.res, { lang, query: q, level: level || 'all', rows, total: items.length, returned: rows.length });
}

function adminTranslationSave(ctx) {
  if (ctx.user.role !== 'admin') return fail(ctx.res, 403, 'FORBIDDEN', 'Admin only');
  const b = ctx.body || {};
  const lang = String(b.lang || '');
  const hanzi = String(b.hanzi || '').trim().slice(0, 40);
  if (!TRANS_LANGS_SAFE(lang)) return fail(ctx.res, 400, 'BAD_LANG', 'Unsupported language');
  if (!hanzi) return fail(ctx.res, 400, 'BAD_HANZI', 'hanzi is required');
  const bucket = transBucket(lang, true);
  if (b.delete === true) {
    const existed = !!bucket[hanzi];
    if (existed) { delete bucket[hanzi]; db.saveTranslations(); }
    return ok(ctx.res, { deleted: existed, lang: lang, hanzi: hanzi });
  }
  const meaning = String(b.meaning || '').trim().slice(0, 400);
  const explanation = String(b.explanation || '').trim().slice(0, 1200);
  const example = String(b.example || '').trim().slice(0, 400);
  if (!meaning) return fail(ctx.res, 400, 'INVALID_MEANING', 'Meaning is required');
  const status = TRANS_STATUS.includes(b.status) ? b.status : 'draft';
  bucket[hanzi] = { meaning, explanation, example, status, updatedAt: new Date().toISOString(), updatedBy: ctx.user.username };
  db.saveTranslations();
  ok(ctx.res, { lang: lang, hanzi: hanzi, status: status, updatedAt: bucket[hanzi].updatedAt });
}

// ── auth management: sessions + 2FA + providers (Spec §77) ──
function listSessions(ctx) {
  const now = Date.now();
  const list = auth.userSessions(ctx.user.id).map(({ token, session }) => ({
    id: secretbox.tokenId(token),
    created: session.created ? new Date(session.created).toISOString() : null,
    lastSeen: session.lastSeen ? new Date(session.lastSeen).toISOString() : null,
    expires: session.expires ? new Date(session.expires).toISOString() : null,
    daysLeft: session.expires ? Math.max(0, Math.round((session.expires - now) / 86400000)) : 0,
    ua: session.ua || '',
    current: token === ctx.sessionToken,
  })).sort((a, b) => (b.lastSeen || '').localeCompare(a.lastSeen || ''));
  ok(ctx.res, { sessions: list, count: list.length });
}
function revokeSession(ctx) {
  const b = ctx.body || {};
  if (b.others) {
    const n = auth.destroyOtherSessions(ctx.user.id, ctx.sessionToken);
    pushActivity(ctx.user, 'security', 'Signed out ' + n + ' other session(s)');
    db.saveUsers();
    return ok(ctx.res, { revoked: n, others: true });
  }
  const id = String(b.id || '');
  if (!id) return fail(ctx.res, 400, 'BAD_REQUEST', 'Session id required');
  const done = auth.destroySessionById(ctx.user.id, id);
  if (!done) return fail(ctx.res, 404, 'NOT_FOUND', 'Session not found');
  ok(ctx.res, { revoked: 1 });
}

function twoFAStatus(ctx) {
  const t = ctx.user.twoFA || {};
  ok(ctx.res, { enabled: !!t.enabled, recoveryRemaining: (t.recovery || []).filter((r) => !r.used).length, available: true });
}
function matchRecovery(t, code) {
  const h = secretbox.hashCode(code);
  for (const r of (t.recovery || [])) { if (!r.used && r.h === h) { r.used = true; return true; } }
  return false;
}
function twoFASetup(ctx) {
  if (!auth.verifyPassword(String((ctx.body && ctx.body.password) || ''), ctx.user.salt, ctx.user.hash)) {
    return fail(ctx.res, 401, 'BAD_PASSWORD', 'Password is incorrect');
  }
  const secret = totp.newSecret();
  if (!ctx.user.twoFA || typeof ctx.user.twoFA !== 'object') ctx.user.twoFA = { enabled: false, secret: '', pending: '', recovery: [], enabledAt: null };
  ctx.user.twoFA.pending = secretbox.encrypt(secret);
  db.saveUsers();
  ok(ctx.res, { secret: secret, otpauth: totp.otpauthUri(secret, ctx.user.username, 'Hanxue Classroom') });
}
function twoFAEnable(ctx) {
  const t = ctx.user.twoFA || {};
  if (!t.pending) return fail(ctx.res, 400, 'NO_SETUP', 'Start setup first');
  const secret = secretbox.decrypt(t.pending);
  if (!totp.verify(secret, (ctx.body && ctx.body.code) || '')) return fail(ctx.res, 400, 'BAD_CODE', 'That code is not valid');
  const codes = totp.newRecoveryCodes(10);
  ctx.user.twoFA = { enabled: true, secret: secretbox.encrypt(secret), pending: '', recovery: codes.map((c) => ({ h: secretbox.hashCode(c), used: false })), enabledAt: new Date().toISOString() };
  pushActivity(ctx.user, 'security', 'Two-factor authentication enabled');
  db.saveUsers();
  ok(ctx.res, { enabled: true, recoveryCodes: codes });
}
function twoFADisable(ctx) {
  const t = ctx.user.twoFA || {};
  if (!auth.verifyPassword(String((ctx.body && ctx.body.password) || ''), ctx.user.salt, ctx.user.hash)) {
    return fail(ctx.res, 401, 'BAD_PASSWORD', 'Password is incorrect');
  }
  const code = String((ctx.body && ctx.body.code) || '');
  const secret = secretbox.decrypt(t.secret);
  if (t.enabled && !totp.verify(secret, code) && !matchRecovery(t, code)) return fail(ctx.res, 400, 'BAD_CODE', 'Enter a valid code or recovery code');
  ctx.user.twoFA = { enabled: false, secret: '', pending: '', recovery: [], enabledAt: null };
  pushActivity(ctx.user, 'security', 'Two-factor authentication disabled');
  db.saveUsers();
  ok(ctx.res, { enabled: false });
}
function login2FA(ctx) {
  const b = ctx.body || {};
  if (ctx.rateLimit('login2fa', 20, 5 * 60 * 1000)) return fail(ctx.res, 429, 'RATE_LIMITED', 'Too many attempts. Try again shortly.');
  const c = auth.consumeChallenge(String(b.challenge || ''));
  if (!c) return fail(ctx.res, 400, 'CHALLENGE_EXPIRED', 'This sign-in attempt expired. Sign in again.');
  const u = db.findUserById(c.userId);
  if (!u || !u.twoFA || !u.twoFA.enabled) return fail(ctx.res, 400, 'BAD_STATE', 'Two-factor is not active');
  c.attempts = (c.attempts || 0) + 1;
  if (c.attempts > 6) { auth.clearChallenge(String(b.challenge)); return fail(ctx.res, 429, 'RATE_LIMITED', 'Too many attempts. Sign in again.'); }
  const code = String(b.code || '');
  const secret = secretbox.decrypt(u.twoFA.secret);
  const okTotp = totp.verify(secret, code);
  const okRecovery = !okTotp && matchRecovery(u.twoFA, code);
  if (!okTotp && !okRecovery) return fail(ctx.res, 401, 'BAD_CODE', 'Invalid code');
  auth.clearChallenge(String(b.challenge));
  touchDay(u);
  u.lastLoginAt = new Date().toISOString();
  u.loginCount = (u.loginCount || 0) + 1;
  pushActivity(u, 'login', 'Signed in with 2FA' + (okRecovery ? ' (recovery code)' : ''));
  db.saveUsers();
  const token = auth.createSession(u.id, { ua: ctx.req.headers['user-agent'] });
  ctx.setSession(token);
  ok(ctx.res, { user: auth.publicUser(u), token: token });
}
function oauthProviders(ctx) {
  ok(ctx.res, { providers: oauth.list() });
}

module.exports = { register, login, logout, me, getProgress, putProgress, postActivity, changePassword, getSettings, putSettings, listPosts, createPost, getPost, likePost, commentPost, deletePost, reportPost, publicTranslations, listSessions, revokeSession, twoFAStatus, twoFASetup, twoFAEnable, twoFADisable, login2FA, oauthProviders, adminUsers, adminUser, adminSessions, adminStats, adminUserAction, adminModeration, adminComments, adminDeleteComment, adminTranslationStats, adminTranslationSearch, adminTranslationSave, fail, ok };
