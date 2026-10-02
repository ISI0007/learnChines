'use strict';
// Password hashing (scrypt) + opaque server-side sessions.
// A session lives for 3 years and slides forward on use, so an active (or returning) user stays signed in.
const crypto = require('crypto');
const db = require('./db');
const cfg = require('../config');

const SESSION_MS = cfg.SESSION_MS;               // 3 years
const RENEW_WHEN_BELOW = SESSION_MS / 2;         // slide when less than half the lifetime remains
const SCRYPT = { N: 16384, r: 8, p: 1, len: 64, maxmem: 64 * 1024 * 1024 };

function hashPassword(password, salt) {
  const s = salt || crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, s, SCRYPT.len, { N: SCRYPT.N, r: SCRYPT.r, p: SCRYPT.p, maxmem: SCRYPT.maxmem }).toString('hex');
  return { salt: s, hash };
}
function verifyPassword(password, salt, hash) {
  if (!salt || !hash) return false;
  try {
    const h = crypto.scryptSync(password, salt, SCRYPT.len, { N: SCRYPT.N, r: SCRYPT.r, p: SCRYPT.p, maxmem: SCRYPT.maxmem });
    const e = Buffer.from(hash, 'hex');
    return h.length === e.length && crypto.timingSafeEqual(h, e);
  } catch (e) { return false; }
}
function setPassword(user, password) {
  const { salt, hash } = hashPassword(password);
  user.salt = salt; user.hash = hash;
}

function createSession(userId, meta) {
  const token = crypto.randomBytes(32).toString('hex');
  const now = Date.now();
  db.state.sessions[token] = {
    userId,
    created: now,
    lastSeen: now,
    expires: now + SESSION_MS,
    ua: String((meta && meta.ua) || '').slice(0, 200),
  };
  db.saveSessions();
  return token;
}

// Resolve a session token. Sliding renewal extends the expiry (and refreshes the cookie via cookieMaxAge()).
function getSession(token, opts) {
  if (!token) return null;
  const s = db.state.sessions[token];
  if (!s) return null;
  const now = Date.now();
  if (s.expires < now) { delete db.state.sessions[token]; db.saveSessions(); return null; }
  s.lastSeen = now;
  const renewing = !opts || opts.touch !== false;
  if (renewing) {
    if (s.expires - now < RENEW_WHEN_BELOW) {
      s.expires = now + SESSION_MS;
      s.renewedAt = now;
      db.saveSessions();
    } else {
      db.saveSessions();
    }
  }
  return s;
}
function destroySession(token) {
  if (token && db.state.sessions[token]) { delete db.state.sessions[token]; db.saveSessions(); }
}
// Revoke every session for a user (used when a password changes).
function destroyUserSessions(userId) {
  let n = 0;
  for (const k of Object.keys(db.state.sessions)) {
    if (db.state.sessions[k] && db.state.sessions[k].userId === userId) { delete db.state.sessions[k]; n++; }
  }
  if (n) db.saveSessions();
  return n;
}

// ── session management (Spec §77) ──
function userSessions(userId) {
  const out = [];
  for (const token of Object.keys(db.state.sessions)) {
    const s = db.state.sessions[token];
    if (s && s.userId === userId) out.push({ token, session: s });
  }
  return out;
}
// Revoke one of a user's own sessions, matched by its non-reversible id.
function destroySessionById(userId, id) {
  for (const token of Object.keys(db.state.sessions)) {
    const s = db.state.sessions[token];
    if (s && s.userId === userId && require('./secretbox').tokenId(token) === id) {
      delete db.state.sessions[token]; db.saveSessions(); return true;
    }
  }
  return false;
}
function destroyOtherSessions(userId, keepToken) {
  let n = 0;
  for (const token of Object.keys(db.state.sessions)) {
    const s = db.state.sessions[token];
    if (s && s.userId === userId && token !== keepToken) { delete db.state.sessions[token]; n++; }
  }
  if (n) db.saveSessions();
  return n;
}

// ── short-lived login challenges for 2FA (Spec §77) ──
// Deliberately in-memory: a challenge must not survive a restart, and it can
// never be used as an auth token (kept out of the sessions store entirely).
const CHALLENGE_MS = 5 * 60 * 1000;
const challenges = new Map();
function createChallenge(userId, meta) {
  const token = crypto.randomBytes(24).toString('hex');
  challenges.set(token, { userId, expires: Date.now() + CHALLENGE_MS, ua: String((meta && meta.ua) || '').slice(0, 200), attempts: 0 });
  return token;
}
function consumeChallenge(token) {
  const c = token && challenges.get(token);
  if (!c) return null;
  if (c.expires < Date.now()) { challenges.delete(token); return null; }
  return c;
}
function clearChallenge(token) { challenges.delete(token); }

function publicUser(u) {
  return {
    id: u.id, username: u.username, displayName: u.displayName, role: u.role,
    createdAt: u.createdAt, lastLoginAt: u.lastLoginAt, loginCount: u.loginCount || 0,
    suspended: !!u.suspended,
  };
}

module.exports = {
  SESSION_MS, hashPassword, verifyPassword, setPassword,
  createSession, getSession, destroySession, destroyUserSessions, publicUser,
  userSessions, destroySessionById, destroyOtherSessions,
  createChallenge, consumeChallenge, clearChallenge, CHALLENGE_MS,
};
