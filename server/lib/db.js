'use strict';
// Tiny JSON-file persistence for users + sessions. Atomic writes.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { DATA_DIR } = require('../config');

const USERS_FILE = path.join(DATA_DIR, 'users.json');
const SESS_FILE = path.join(DATA_DIR, 'sessions.json');

const state = { users: [], sessions: {} };

function ensureDir() { fs.mkdirSync(DATA_DIR, { recursive: true }); }

function readJson(file, def) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { return def; }
}
function writeJson(file, obj) {
  ensureDir();
  const tmp = file + '.' + process.pid + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(obj, null, 2));
  fs.renameSync(tmp, file);
}
function saveUsers() { writeJson(USERS_FILE, { users: state.users }); }
function saveSessions() { writeJson(SESS_FILE, { sessions: state.sessions }); }

function defaultSettings() {
  return {
    uiLanguage: 'en',
    learningLanguage: 'zh-CN',
    translationLanguage: 'en',
    pinyinPreference: 'always',
    characterPreference: 'simplified',
    translationDisplayMode: 'always',
    dailyGoalMinutes: 30,
  };
}

function defaultProgress() {
  return {
    known: {},
    quiz: { taken: 0, correct: 0, answered: 0, byLevel: {} },
    examsOpened: [],
    booksOpened: [],
    audioPlayed: { count: 0, recent: [] },
    streak: { current: 0, longest: 0, lastDay: null },
    xp: 0,
    studyDays: [],
    updatedAt: null,
  };
}

function load() {
  const u = readJson(USERS_FILE, { users: [] });
  state.users = Array.isArray(u.users) ? u.users : [];
  const s = readJson(SESS_FILE, { sessions: {} });
  state.sessions = (s && s.sessions) || {};
  const now = Date.now();
  let changed = false;
  for (const k of Object.keys(state.sessions)) {
    if (!state.sessions[k] || state.sessions[k].expires < now) { delete state.sessions[k]; changed = true; }
  }
  if (changed) saveSessions();
}

function findUserByName(name) {
  const n = String(name || '').toLowerCase();
  return state.users.find((u) => u.username === n) || null;
}
function findUserById(id) { return state.users.find((u) => u.id === id) || null; }

function createUser(opts) {
  const u = {
    id: crypto.randomUUID(),
    username: String(opts.username).toLowerCase(),
    displayName: opts.displayName || opts.username,
    role: opts.role || 'user',
    salt: '', hash: '',
    createdAt: new Date().toISOString(),
    lastLoginAt: null,
    loginCount: 0,
    progress: defaultProgress(),
    settings: defaultSettings(),
    activity: [],
  };
  state.users.push(u);
  saveUsers();
  return u;
}

module.exports = {
  state, load, saveUsers, saveSessions,
  findUserByName, findUserById, createUser, defaultProgress, defaultSettings, ensureDir,
};
