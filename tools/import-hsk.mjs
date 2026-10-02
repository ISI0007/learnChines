// Import the curated D:\HSK library into the site.
//   Books        -> library/books/hsk<n>, library/books/extra/<group>
//   Exam sets    -> library/exams/hsk<n>/<ID>/  (+ data/exams-manifest.json)
//   Companion    -> library/audio/hsk<n>/<slug>/
// Source tree is read-only; nothing under D:\HSK is modified.
import fs from 'fs';
import path from 'path';

const ROOT = 'D:/chinese-learning';
const SRC = 'D:/HSK';
const lib = path.join(ROOT, 'library');
const examsRoot = path.join(lib, 'exams');
const booksRoot = path.join(lib, 'books');
const audioRoot = path.join(lib, 'audio');

const LEVELS = [1, 2, 3, 4, 5];
const log = (...a) => console.log(...a);

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === '__MACOSX' || e.name.startsWith('._') || e.name === '.DS_Store') continue;
    const f = path.join(dir, e.name);
    if (e.isDirectory()) walk(f, out); else out.push(f);
  }
  return out;
}
function safeName(s) { return s.replace(/[<>:"/\\|?*]/g, '_').trim(); }
function copy(src, destDir, destName) {
  fs.mkdirSync(destDir, { recursive: true });
  const dest = path.join(destDir, destName || path.basename(src));
  fs.copyFileSync(src, dest);
  return { name: destName || path.basename(src), size: fs.statSync(dest).size, dest };
}

// ─────────────────────────── BOOKS ───────────────────────────
const books = [];
function addBook(level, title, src, destDir) {
  const base = safeName(path.basename(src));
  const c = copy(src, destDir, base);
  books.push({
    level,
    title: title || base.replace(/\.pdf$/i, ''),
    path: path.relative(ROOT, c.dest).replace(/\\/g, '/'),
    size: c.size,
  });
}
for (const n of LEVELS) {
  const dir = path.join(SRC, `HSK ${n}`, 'Books');
  if (!fs.existsSync(dir)) continue;
  for (const f of fs.readdirSync(dir)) {
    if (!/\.pdf$/i.test(f)) continue;
    if (/\(dup\)/i.test(f) || /\.pdf \(/i.test(f)) { log('  skip dup book:', f); continue; }
    addBook(n, null, path.join(dir, f), path.join(booksRoot, `hsk${n}`));
  }
}
for (const grp of ['Reference', 'Russian Books']) {
  for (const f of walk(path.join(SRC, grp))) {
    if (!/\.pdf$/i.test(f)) continue;
    addBook(0, `${grp} — ${path.basename(f).replace(/\.pdf$/i, '')}`, f, path.join(booksRoot, 'extra', safeName(grp)));
  }
}

// ─────────────────────────── EXAM SETS ───────────────────────
fs.rmSync(examsRoot, { recursive: true, force: true });
const exams = [];

function classify(basename, id) {
  const b = basename;
  if (/\.mp3$/i.test(b)) return 'listening';
  if (/\.rar$/i.test(b) || /\.zip$/i.test(b)) return 'archive';
  if (!/\.pdf$/i.test(b)) return null;
  if (/答案|answer key|\banswers?\b/i.test(b)) return 'answers';
  if (/听力材料|listening script|listening text|听力文本|transcript/i.test(b)) return 'transcript';
  if (/test paper|试卷|^test/i.test(b)) return 'test';
  if (b.replace(/\.pdf$/i, '') === id) return 'test';       // <ID>.pdf in the answers pack = test paper
  return 'misc';
}

function addExam(level, id, title, files, forceTest) {
  // files: array of source paths; pick best per role
  const roles = {};
  for (const f of files) {
    const role = classify(path.basename(f), id);
    if (!role || role === 'archive') continue;
    if (!roles[role]) roles[role] = f;
    else if (role === 'test' && /test paper/i.test(path.basename(f))) roles[role] = f; // prefer explicit test paper
  }
  if (forceTest) roles.test = forceTest;
  if (!roles.test && !roles.listening && !roles.answers && !roles.transcript) return null;
  const destDir = path.join(examsRoot, `hsk${level}`, id);
  const rec = { level, id, title: title || id };
  for (const key of ['test', 'answers', 'listening', 'transcript']) {
    if (!roles[key]) continue;
    const c = copy(roles[key], destDir, safeName(path.basename(roles[key])));
    rec[key] = { name: c.name, path: path.relative(ROOT, c.dest).replace(/\\/g, '/'), size: c.size };
  }
  exams.push(rec);
  return rec;
}

for (const n of LEVELS) {
  const base = path.join(SRC, `HSK ${n}`);
  const answersDir = path.join(base, 'Answers');
  const papersDir = path.join(base, 'Papers');
  const audioDir = path.join(base, 'Audio');
  if (!fs.existsSync(answersDir)) continue;

  const papers = fs.existsSync(papersDir) ? fs.readdirSync(papersDir).map(f => path.join(papersDir, f)) : [];
  const audioTop = fs.existsSync(audioDir) ? fs.readdirSync(audioDir).filter(f => /\.mp3$/i.test(f)).map(f => path.join(audioDir, f)) : [];
  const looseAns = fs.readdirSync(answersDir).filter(f => fs.statSync(path.join(answersDir, f)).isFile()).map(f => path.join(answersDir, f));

  // (a) per-ID sets from "Answers/<ID> ..." folders
  const idDirs = fs.readdirSync(answersDir, { withFileTypes: true })
    .filter(e => e.isDirectory())
    .map(e => e.name);
  const seen = new Set();
  for (const dirName of idDirs) {
    const m = dirName.match(/^(H\d+)/i);
    if (!m) continue;
    const id = m[1].toUpperCase();
    if (seen.has(id)) continue;
    seen.add(id);
    const inner = walk(path.join(answersDir, dirName));
    const related = []
      .concat(inner)
      .concat(looseAns.filter(f => f.includes(id)))
      .concat(papers.filter(f => path.basename(f).startsWith(id)))
      .concat(audioTop.filter(f => path.basename(f).startsWith(id)));
    addExam(n, id, id, related);
  }

  // (b) named papers (Sample / Exam Paper N / Mock Test) matched by shared stem
  const named = papers.filter(f => {
    const b = path.basename(f);
    return /sample paper|exam paper \d|mock test|speaking sample/i.test(b) && !/listening script/i.test(b);
  });
  for (const p of named) {
    const stem = path.basename(p).replace(/\.pdf$/i, '').replace(/ - Speaking Sample Paper$/i, ' - Speaking Sample');
    const id = 'HSK' + n + '-' + stem.replace(/^HSK \d+ - /i, '').replace(/[^\w]+/g, '');
    const related = [p]
      .concat(looseAns.filter(f => path.basename(f).replace(/\.pdf$/i, '').startsWith(stem)))
      .concat(audioTop.filter(f => path.basename(f).replace(/\.mp3$/i, '').startsWith(stem)));
    // speaking sample has no answers
    addExam(n, id, `HSK ${n} — ${stem.replace(/^HSK \d+ - /i, '')}`, related, p);
  }
}

exams.sort((a, b) => a.level - b.level || a.id.localeCompare(b.id));
fs.mkdirSync(path.join(ROOT, 'data'), { recursive: true });
fs.writeFileSync(path.join(ROOT, 'data', 'exams-manifest.json'), JSON.stringify({ exams }, null, 0));

// ─────────────────────── COMPANION AUDIO ─────────────────────
const audioGroups = [];
const AUDIO_RE = /\.(mp3|m4a|wav|wma|flac|ogg|aac)$/i;
function addAudioGroup(level, title, srcDir) {
  const files = walk(srcDir).filter(f => AUDIO_RE.test(f));
  if (!files.length) return;
  const slug = safeName(path.basename(srcDir)).replace(/\s+/g, '-').toLowerCase();
  const destDir = path.join(audioRoot, `hsk${level}`, slug);
  const recs = files.map(f => {
    const c = copy(f, destDir, safeName(path.basename(f)));
    return { name: path.basename(f).replace(/\.[^.]+$/, ''), path: path.relative(ROOT, c.dest).replace(/\\/g, '/'), size: c.size };
  }).sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
  audioGroups.push({
    level,
    title,
    dir: path.relative(ROOT, destDir).replace(/\\/g, '/'),
    count: recs.length,
    files: recs,
  });
}
function findAudioDirs(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (!e.isDirectory()) continue;
    const f = path.join(dir, e.name);
    const sub = findAudioDirs(f, out);
    if (!sub.length && walk(f).some(x => AUDIO_RE.test(x))) out.push(f);
  }
  return out;
}
for (const n of LEVELS) {
  const audioDir = path.join(SRC, `HSK ${n}`, 'Audio');
  for (const d of findAudioDirs(audioDir)) addAudioGroup(n, path.basename(d), d);
}
audioGroups.sort((a, b) => a.level - b.level || a.title.localeCompare(b.title));

// ─────────────────────────── REPORT ──────────────────────────
log('\n================ IMPORT COMPLETE ================');
log('Books:', books.length);
const byLvl = {};
for (const b of books) byLvl[b.level] = (byLvl[b.level] || 0) + 1;
log('  by level:', JSON.stringify(byLvl));
log('Exam sets:', exams.length);
const exLvl = {};
for (const e of exams) exLvl[e.level] = (exLvl[e.level] || 0) + 1;
log('  by level:', JSON.stringify(exLvl));
log('Audio groups:', audioGroups.length, '| tracks:', audioGroups.reduce((a, g) => a + g.count, 0));
log('\n-- exam sets by level --');
for (const n of LEVELS) {
  const list = exams.filter(e => e.level === n);
  log(`HSK ${n} (${list.length}):`);
  for (const e of list) {
    const r = ['test', 'answers', 'listening', 'transcript'].filter(k => e[k]).join(',') || '—';
    log(`   ${e.id.padEnd(18)} [${r}]  ${Object.keys(e).filter(k => ['test','answers','listening','transcript'].includes(k)).map(k=>k+'='+e[k].size).join(' ')}`);
  }
}
log('\n-- companion audio groups --');
for (const g of audioGroups) log(`  L${g.level}  ${g.title}  (${g.count})  ${g.dir}`);

// stash books+audio for gen-manifest to pick up is unnecessary; gen-manifest walks the dirs.
