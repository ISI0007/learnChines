'use strict';
// AES-256-GCM for secrets at rest (TOTP secrets). Key lives in a git-ignored,
// owner-only file under server/data/ so secrets are never stored in plaintext.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { DATA_DIR } = require('../config');

const KEY_FILE = path.join(DATA_DIR, 'app.key');
let cached = null;

function key() {
  if (cached) return cached;
  try {
    const hex = fs.readFileSync(KEY_FILE, 'utf8').trim();
    if (/^[0-9a-f]{64}$/.test(hex)) { cached = Buffer.from(hex, 'hex'); return cached; }
  } catch (e) { /* generate below */ }
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const k = crypto.randomBytes(32);
  fs.writeFileSync(KEY_FILE, k.toString('hex'), { mode: 0o600 });
  cached = k;
  return cached;
}
function encrypt(plain) {
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv('aes-256-gcm', key(), iv);
  const enc = Buffer.concat([c.update(String(plain), 'utf8'), c.final()]);
  return iv.toString('hex') + ':' + c.getAuthTag().toString('hex') + ':' + enc.toString('hex');
}
function decrypt(blob) {
  try {
    const parts = String(blob || '').split(':');
    if (parts.length !== 3) return '';
    const iv = Buffer.from(parts[0], 'hex'), tag = Buffer.from(parts[1], 'hex'), data = Buffer.from(parts[2], 'hex');
    const d = crypto.createDecipheriv('aes-256-gcm', key(), iv);
    d.setAuthTag(tag);
    return Buffer.concat([d.update(data), d.final()]).toString('utf8');
  } catch (e) { return ''; }
}
// Stable, non-reversible id for a session token (never expose the token itself).
function tokenId(token) { return crypto.createHash('sha256').update(String(token || '')).digest('hex').slice(0, 12); }
function hashCode(code) { return crypto.createHash('sha256').update(String(code || '').replace(/[^a-z0-9]/gi, '').toLowerCase()).digest('hex'); }

module.exports = { key, encrypt, decrypt, tokenId, hashCode, KEY_FILE };
