'use strict';
// API handlers. Each writes a JSON envelope: success:{success,data} / error:{success,error:{code,message}}.
const db = require('./db');
const auth = require('./auth');

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
  if (ctx.rateLimit('login', 12, 5 * 60 * 1000)) return fail(res, 429, 'RATE_LIMITED', 'Too many attempts. Try again shortly.');
  const username = String(body.username || '').trim().toLowerCase();
  const password = String(body.password || '');
  const u = db.findUserByName(username);
  if (!u || !auth.verifyPassword(password, u.salt, u.hash)) return fail(res, 401, 'BAD_CREDENTIALS', 'Incorrect username or password');
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
  ok(ctx.res, { user: auth.publicUser(ctx.user), progress: ensureProgress(ctx.user), serverTime: new Date().toISOString() });
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

module.exports = { register, login, logout, me, getProgress, putProgress, postActivity, changePassword, adminUsers, adminUser, adminSessions, fail, ok };
