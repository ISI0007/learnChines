'use strict';
// RFC 4226 (HOTP) / RFC 6238 (TOTP) + base32, dependency-free (Spec §77 2FA).
const crypto = require('crypto');

const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

function base32Encode(buf) {
  let bits = 0, value = 0, out = '';
  for (const b of buf) {
    value = (value << 8) | b; bits += 8;
    while (bits >= 5) { out += B32[(value >>> (bits - 5)) & 31]; bits -= 5; }
  }
  if (bits > 0) out += B32[(value << (5 - bits)) & 31];
  return out;
}
function base32Decode(str) {
  const clean = String(str || '').toUpperCase().replace(/[=\s]/g, '');
  let bits = 0, value = 0; const out = [];
  for (const c of clean) {
    const idx = B32.indexOf(c);
    if (idx === -1) continue;
    value = (value << 5) | idx; bits += 5;
    if (bits >= 8) { out.push((value >>> (bits - 8)) & 0xff); bits -= 8; }
  }
  return Buffer.from(out);
}
function hotp(secretBuf, counter, digits) {
  const buf = Buffer.alloc(8);
  buf.writeUInt32BE(Math.floor(counter / 0x100000000), 0);
  buf.writeUInt32BE(counter >>> 0, 4);
  const hmac = crypto.createHmac('sha1', secretBuf).update(buf).digest();
  const off = hmac[hmac.length - 1] & 0xf;
  const bin = ((hmac[off] & 0x7f) << 24) | ((hmac[off + 1] & 0xff) << 16) | ((hmac[off + 2] & 0xff) << 8) | (hmac[off + 3] & 0xff);
  return (bin % Math.pow(10, digits || 6)).toString().padStart(digits || 6, '0');
}
function timeCode(secretB32, atMs, step, digits) {
  const counter = Math.floor((atMs || Date.now()) / ((step || 30) * 1000));
  return hotp(base32Decode(secretB32), counter, digits || 6);
}
// Verify with a +/- window (default 1 step) for clock drift.
function verify(secretB32, code, opts) {
  const oc = String(code || '').replace(/\D/g, '');
  if (oc.length !== 6 || !secretB32) return false;
  const window = (opts && typeof opts.window === 'number') ? opts.window : 1;
  const now = (opts && opts.atMs) || Date.now();
  for (let i = -window; i <= window; i++) {
    const c = timeCode(secretB32, now + i * 30000);
    if (c === oc) return true;
  }
  return false;
}
function newSecret() { return base32Encode(crypto.randomBytes(20)); }
function newRecoveryCodes(n) {
  const codes = [];
  for (let i = 0; i < (n || 10); i++) {
    const raw = crypto.randomBytes(5).toString('hex');
    codes.push(raw.slice(0, 5) + '-' + raw.slice(5, 10));
  }
  return codes;
}
function otpauthUri(secret, account, issuer) {
  const iss = issuer || 'Hanxue Classroom';
  return 'otpauth://totp/' + encodeURIComponent(iss + ':' + account) +
    '?secret=' + secret + '&issuer=' + encodeURIComponent(iss) + '&algorithm=SHA1&digits=6&period=30';
}

module.exports = { B32, base32Encode, base32Decode, hotp, timeCode, verify, newSecret, newRecoveryCodes, otpauthUri };
