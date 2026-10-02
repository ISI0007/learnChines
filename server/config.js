'use strict';
// Central configuration. No secrets here — admin bootstrap comes from env or is generated at first run.
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

module.exports = {
  SITE_NAME: '汉学课堂',
  ROOT,
  PORT: Number(process.env.PORT || 8091),
  HOST: process.env.HOST || '127.0.0.1',
  DATA_DIR: process.env.HANXUE_DATA_DIR || path.join(__dirname, 'data'),
  ADMIN_USERNAME: (process.env.HANXUE_ADMIN_USER || 'admin').toLowerCase(),
  ADMIN_PASSWORD: process.env.HANXUE_ADMIN_PASSWORD || '',
  // Sessions + saved data persist for at least 3 years.
  SESSION_MS: 1000 * 60 * 60 * 24 * 1095,        // server-side session lifetime (3 years)
  COOKIE_MAX_AGE: 60 * 60 * 24 * 400,            // browser cookie cap (~400 days); sliding keeps it fresh
  WEB_TOKEN_DAYS: 1095,                          // localStorage persistent login token (3 years)
  MAX_BODY: 256 * 1024,
  PROGRESS_MAX: 128 * 1024,
  // Never serve these top-level folders over HTTP.
  BLOCKED_DIRS: ['server', '_retired', 'tools', '.git'],
  // Read-only vocabulary index used by the translation admin (Spec §79).
  VOCAB_FILE: path.join(ROOT, 'data', 'hsk-vocab.json'),
};
