import fs from 'fs';
import path from 'path';

const root = 'D:/chinese-learning';
const seed = 'D:/seed data';
const lib = path.join(root, 'library');
const examsRoot = path.join(lib, 'exams');
fs.mkdirSync(examsRoot, { recursive: true });

const exams = [];

function walkFiles(dir) {
  const out = [];
  (function walk(d) {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      if (e.name === '__MACOSX' || e.name.startsWith('._') || e.name === '.DS_Store') continue;
      const f = path.join(d, e.name);
      if (e.isDirectory()) walk(f); else out.push(f);
    }
  })(dir);
  return out;
}
const base = (f) => path.basename(f);
const find = (files, re) => files.find((f) => re.test(base(f)));

// Global pool of loose test PDFs (print test hsk 3) keyed by exam id -> used to fill gaps
const testPool = {};
const printTestDir = path.join(seed, 'print test hsk 3');
if (fs.existsSync(printTestDir)) {
  for (const f of fs.readdirSync(printTestDir)) {
    const m = f.match(/^test[-_ ]?(h?\d+)\.pdf$/i);
    if (m) testPool[m[1].toUpperCase()] = path.join(printTestDir, f);
  }
}

function addSet(level, id, srcDir, title) {
  if (!fs.existsSync(srcDir)) return null;
  const files = walkFiles(srcDir);
  let test = find(files, /^test.*\.pdf$/i) || find(files, /试卷.*\.pdf$/i);
  if (!test) {
    const key = id.replace(/^HSK/i, '').toUpperCase();
    if (testPool[key]) test = testPool[key];
  }
  const answers = find(files, /answers?\.pdf$/i);
  const listening = find(files, /\.mp3$/i);
  const transcript = find(files, /listening\.pdf$/i);
  if (!test && !listening) { console.log('skip (nothing):', id); return null; }
  const destDir = path.join(examsRoot, `hsk${level}`, id);
  fs.mkdirSync(destDir, { recursive: true });
  const rec = { level, id, title: title || id };
  const cp = (src, key) => {
    if (!src) return;
    const dest = path.join(destDir, base(src));
    fs.copyFileSync(src, dest);
    rec[key] = { name: base(src), path: `library/exams/hsk${level}/${id}/${base(src)}`, size: fs.statSync(dest).size };
  };
  cp(test, 'test'); cp(answers, 'answers'); cp(listening, 'listening'); cp(transcript, 'transcript');
  exams.push(rec);
  return rec;
}

// ── HSK 3 mock sets (test + answers + listening) ──
const newFolderHSK = path.join(seed, 'New folder HSK');
for (const d of fs.readdirSync(newFolderHSK, { withFileTypes: true })) {
  if (!d.isDirectory() || !/^h\d+$/i.test(d.name)) continue;
  const inner = path.join(newFolderHSK, d.name, d.name);
  const src = fs.existsSync(inner) ? inner : path.join(newFolderHSK, d.name);
  addSet(3, d.name.toUpperCase(), src);
}

// ── HSK 3 official exam papers (2018) + extra test ──
const official3 = path.join(seed, 'print test hsk 3', 'New folder', 'Official Examination Papers of HSK 3 (2018 Edition).pdf');
if (fs.existsSync(official3)) {
  const destDir = path.join(examsRoot, 'hsk3', 'Official-2018');
  fs.mkdirSync(destDir, { recursive: true });
  const dest = path.join(destDir, 'Official Examination Papers HSK 3 (2018).pdf');
  fs.copyFileSync(official3, dest);
  exams.push({ level: 3, id: 'Official-2018', title: 'Official Examination Papers HSK 3 (2018)',
    test: { name: path.basename(dest), path: 'library/exams/hsk3/Official-2018/' + path.basename(dest), size: fs.statSync(dest).size } });
}
const h31553 = path.join(seed, 'print test hsk 3', '742829958-H31553D-2.pdf');
if (fs.existsSync(h31553)) addSet(3, 'H31553', path.dirname(h31553), 'H31553');

// ── HSK 4 single papers ──
const hsk4dir = path.join(seed, 'hsk4');
if (fs.existsSync(hsk4dir)) {
  for (const f of fs.readdirSync(hsk4dir)) {
    if (!/\.pdf$/i.test(f)) continue;
    const id = f.replace(/\.pdf$/i, '');
    const destDir = path.join(examsRoot, 'hsk4', id);
    fs.mkdirSync(destDir, { recursive: true });
    const dest = path.join(destDir, 'paper.pdf');
    fs.copyFileSync(path.join(hsk4dir, f), dest);
    exams.push({ level: 4, id, title: id,
      test: { name: f, path: `library/exams/hsk4/${id}/paper.pdf`, size: fs.statSync(dest).size } });
  }
}
const official4 = path.join(seed, 'print test hsk 3', 'New folder', 'Official Examination Papers of HSK 4 (2014 Edition).pdf');
if (fs.existsSync(official4)) {
  const destDir = path.join(examsRoot, 'hsk4', 'Official-2014');
  fs.mkdirSync(destDir, { recursive: true });
  const dest = path.join(destDir, 'Official Examination Papers HSK 4 (2014).pdf');
  fs.copyFileSync(official4, dest);
  exams.push({ level: 4, id: 'Official-2014', title: 'Official Examination Papers HSK 4 (2014)',
    test: { name: path.basename(dest), path: 'library/exams/hsk4/Official-2014/' + path.basename(dest), size: fs.statSync(dest).size } });
}
// NewHskLevel4 practice tests
for (const n of [1, 2, 3, 4]) {
  const src = path.join(seed, 'print test hsk 3', `NewHskLevel4-${n}.pdf`);
  if (fs.existsSync(src)) {
    const id = `NewHskLevel4-${n}`;
    const destDir = path.join(examsRoot, 'hsk4', id);
    fs.mkdirSync(destDir, { recursive: true });
    const dest = path.join(destDir, 'paper.pdf');
    fs.copyFileSync(src, dest);
    exams.push({ level: 4, id, title: `New HSK Level 4 test ${n}`,
      test: { name: `NewHskLevel4-${n}.pdf`, path: `library/exams/hsk4/${id}/paper.pdf`, size: fs.statSync(dest).size } });
  }
}

exams.sort((a, b) => a.level - b.level || a.id.localeCompare(b.id));
fs.writeFileSync(path.join(root, 'data', 'exams-manifest.json'), JSON.stringify({ exams }, null, 0));
console.log('exam sets:', exams.length);
for (const e of exams) console.log(`  L${e.level} ${e.id}  test=${!!e.test} answers=${!!e.answers} audio=${!!e.listening}`);
