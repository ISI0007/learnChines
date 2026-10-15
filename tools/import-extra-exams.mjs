// Import the 6 net-new exam papers found in D:\seed data (missed by the original
// build-exams.mjs run). Copies each PDF into library/exams/hskN/<ID>/ and
// appends a manifest record. Idempotent: skips IDs already present.
import fs from 'fs';
import path from 'path';

const root = 'D:/chinese-learning';
const examsRoot = path.join(root, 'library', 'exams');
const manifestPath = path.join(root, 'data', 'exams-manifest.json');

const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const have = new Set(manifest.exams.map((e) => `${e.level}/${e.id}`));

const CANDIDATES = [
  { level: 4, id: 'H41113', src: 'D:/seed data/hsk4/H41113.pdf' },
  { level: 4, id: 'H41114', src: 'D:/seed data/hsk4/H41114.pdf' },
  { level: 4, id: 'H41115', src: 'D:/seed data/hsk4/H41115.pdf' },
  { level: 4, id: 'H41116', src: 'D:/seed data/hsk4/H41116.pdf' },
  { level: 3, id: 'H31003', src: 'D:/seed data/print test hsk 3/testH31003.pdf' },
  { level: 3, id: 'H31553', src: 'D:/seed data/print test hsk 3/742829958-H31553D-2.pdf' },
];

let added = 0;
for (const c of CANDIDATES) {
  if (have.has(c.level + '/' + c.id)) { console.log('skip (already in manifest):', c.id); continue; }
  if (!fs.existsSync(c.src)) { console.log('skip (missing source):', c.src); continue; }
  const destDir = path.join(examsRoot, 'hsk' + c.level, c.id);
  fs.mkdirSync(destDir, { recursive: true });
  const name = 'test.pdf';
  const dest = path.join(destDir, name);
  fs.copyFileSync(c.src, dest);
  manifest.exams.push({
    level: c.level,
    id: c.id,
    title: c.id,
    test: { name, path: `library/exams/hsk${c.level}/${c.id}/${name}`, size: fs.statSync(dest).size },
  });
  have.add(c.level + '/' + c.id);
  added++;
  console.log('added:', c.id, '->', dest);
}

manifest.exams.sort((a, b) => a.level - b.level || a.id.localeCompare(b.id));
fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 0));
const by = {};
manifest.exams.forEach((e) => { by[e.level] = (by[e.level] || 0) + 1; });
console.log('added:', added, '| total exams:', manifest.exams.length, '| by level:', JSON.stringify(by));
