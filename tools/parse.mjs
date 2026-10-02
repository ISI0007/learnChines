import fs from 'fs';
import path from 'path';

const root = 'D:/chinese-learning';
const out = {};

for (let lvl = 1; lvl <= 5; lvl++) {
  const raw = fs.readFileSync(path.join(root, 'data', `L${lvl}.tsv`), 'utf8');
  const lines = raw.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const seen = new Set();
  const words = [];
  for (const line of lines) {
    const cols = line.split('\t');
    if (cols.length < 5) continue;
    const [trad, simp, pinyinNum, pinyin, def] = cols;
    const key = simp;
    if (seen.has(key)) continue;
    seen.add(key);
    words.push({
      s: simp,
      t: trad,
      p: pinyin,          // diacritic pinyin (display)
      pn: pinyinNum,      // numbered pinyin (optional)
      d: def              // english definition
    });
  }
  out[lvl] = words;
}

fs.writeFileSync(path.join(root, 'data', 'hsk-vocab.json'), JSON.stringify(out));
const total = [1,2,3,4,5].reduce((a, l) => a + out[l].length, 0);
console.log('Levels:', [1,2,3,4,5].map(l => `L${l}=${out[l].length}`).join(' '));
console.log('Total words:', total);
console.log('Sample L1:', JSON.stringify(out[1].slice(0,2)));
