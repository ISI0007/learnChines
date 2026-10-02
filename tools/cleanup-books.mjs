// Retire old/superseded books (reversible: move to _retired/, never delete),
// then mark the book + workbook audio library read-only.
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const ROOT = 'D:/chinese-learning';
const BOOKS = path.join(ROOT, 'library', 'books');
const RETIRED = path.join(ROOT, '_retired', 'books');

// Exact duplicates of a newer import (byte-identical keeper remains) -> retire the older copy.
const DUPLICATES = [
  'extra/New HSK 3.0/新HSK教程2 学练手册.pdf',
  'hsk1/HSK 1 Student Book.pdf',
  'hsk1/HSK 1 Workbook.pdf',
  'hsk2/HSK 2 Textbook (新HSK2).pdf',
  'hsk3/HSK 3 Student Book.pdf',
  'hsk3/HSK 3 Teacher Book.pdf',
  'hsk3/HSK 3 Textbook (新HSK3).pdf',
  'hsk3/New HSK 3 Workbook (hanyu_uz).pdf',
  'hsk4/HSK 4 Student Book 1.pdf',
  'hsk4/HSK 4 Student Book 2.pdf',
  'hsk4/HSK 4 Teacher Book.pdf',
  'hsk4/HSK 4 Workbook 1.pdf',
  'hsk4/HSK 4 Workbook 2.pdf',
];
// Older course books superseded by the new HSK 1-4 import (unique old content).
const SUPERSEDED = [
  'hsk2/HSK 2 Student Book.pdf',
  'hsk2/HSK 2 Workbook.pdf',
  'hsk3/HSK 3 Workbook.pdf',
];

const REMOVE = [...DUPLICATES, ...SUPERSEDED];

function walk(d, o = []) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const f = path.join(d, e.name);
    if (e.isDirectory()) walk(f, o); else o.push(f);
  }
  return o;
}
function sha1(f) { return crypto.createHash('sha1').update(fs.readFileSync(f)).digest('hex'); }

// Guard: every "duplicate" must have a byte-identical keeper left behind.
const hashes = {};
for (const f of walk(BOOKS)) (hashes[sha1(f)] = hashes[sha1(f)] || []).push(f);
const removeAbs = new Set(REMOVE.map((r) => path.join(BOOKS, r.replace(/\//g, path.sep))));
for (const rel of DUPLICATES) {
  const abs = path.join(BOOKS, rel.replace(/\//g, path.sep));
  const survivors = (hashes[sha1(abs)] || []).filter((x) => !removeAbs.has(x));
  if (!survivors.length) throw new Error('No identical keeper for ' + rel + ' — aborting');
}

const log = [];
for (const rel of REMOVE) {
  const src = path.join(BOOKS, rel.replace(/\//g, path.sep));
  if (!fs.existsSync(src)) { log.push(['MISSING', rel]); continue; }
  const dst = path.join(RETIRED, rel.replace(/\//g, path.sep));
  fs.mkdirSync(path.dirname(dst), { recursive: true });
  const size = fs.statSync(src).size;
  fs.renameSync(src, dst);
  log.push(['RETIRED', rel, size]);
}

fs.writeFileSync(
  path.join(ROOT, '_retired', 'REMOVED.txt'),
  `Retired ${new Date().toISOString()}\n` +
  log.map((l) => l.join('\t')).join('\n') + '\n'
);

// Read-only for books + book/workbook audio.
let roCount = 0;
for (const dir of [path.join(ROOT, 'library', 'books'), path.join(ROOT, 'library', 'audio')]) {
  for (const f of walk(dir)) { fs.chmodSync(f, 0o444); roCount++; }
}

console.log('--- retired ---');
for (const l of log) console.log(' ', l[0], l[1], l[2] ? (l[2] / 1e6).toFixed(1) + 'MB' : '');
const remaining = walk(BOOKS).filter((f) => /\.pdf$/i.test(f));
console.log('books remaining:', remaining.length);
console.log('read-only set on', roCount, 'files (library/books + library/audio)');
