import fs from 'fs';
import path from 'path';

const root = 'D:/chinese-learning';
const lib = path.join(root, 'library');
const audioRoot = path.join(lib, 'audio');

const AUDIO_RE = /\.(mp3|m4a|wav|wma|flac|ogg|aac)$/i;

// Book manifest (from files actually present)
const bookManifest = [];
function walkBooks(dir, level, relBase) {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkBooks(full, level, path.join(relBase, entry.name));
    } else if (/\.pdf$/i.test(entry.name)) {
      const rel = path.join(relBase, entry.name).replace(/\\/g, '/');
      bookManifest.push({ level, title: entry.name.replace(/\.pdf$/i, ''), path: rel, size: fs.statSync(full).size });
    }
  }
}
for (const lvl of [1, 2, 3, 4, 5]) {
  const d = path.join(lib, 'books', `hsk${lvl}`);
  walkBooks(d, lvl, `library/books/hsk${lvl}`);
}
const extraD = path.join(lib, 'books', 'extra');
walkBooks(extraD, 0, 'library/books/extra');

// Audio manifest (recursive, individual files)
const audioManifest = [];
for (const group of fs.readdirSync(audioRoot, { withFileTypes: true })) {
  if (!group.isDirectory()) continue;
  const levelDir = path.join(audioRoot, group.name);
  for (const sub of fs.readdirSync(levelDir, { withFileTypes: true })) {
    if (!sub.isDirectory()) continue;
    const subDir = path.join(levelDir, sub.name);
    const files = [];
    function collect(dir) {
      for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, e.name);
        if (e.isDirectory()) collect(full);
        else if (AUDIO_RE.test(e.name)) {
          const rel = path.relative(audioRoot, full).replace(/\\/g, '/');
          files.push({ name: e.name.replace(/\.[^.]+$/, ''), path: 'library/audio/' + rel, size: fs.statSync(full).size });
        }
      }
    }
    collect(subDir);
    files.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
    const lvl = parseInt(group.name.replace('hsk', ''), 10);
    audioManifest.push({
      level: lvl,
      title: sub.name.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
      dir: `library/audio/${group.name}/${sub.name}`,
      count: files.length,
      files
    });
  }
}
audioManifest.sort((a, b) => a.level - b.level || a.title.localeCompare(b.title));

const manifest = { books: bookManifest, audio: audioManifest, generated: new Date().toISOString() };
fs.writeFileSync(path.join(root, 'data', 'library-manifest.json'), JSON.stringify(manifest));

console.log('Books:', bookManifest.length);
console.log('Audio groups:', audioManifest.length);
console.log('Total audio files:', audioManifest.reduce((a, g) => a + g.count, 0));
