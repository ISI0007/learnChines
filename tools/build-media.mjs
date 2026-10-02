import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';

const root = 'D:/chinese-learning';
const SEVENZIP = 'C:/Program Files/7-Zip/7z.exe';
const dwnd = 'D:/dwnd/Telegram Desktop';
const sem5 = 'D:/download sem 5/Telegram Desktop';
const sep5 = 'D:/downlaod september sem 5/Telegram Desktop';

function copy(src, dest) {
  if (!fs.existsSync(src)) { console.log('MISSING:', src); return false; }
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
  console.log('COPIED:', path.basename(dest));
  return true;
}

// ---- Books (PDFs) ----
const books = [
  { src: `${dwnd}/HSK-1 SB.pdf`, dest: 'books/hsk1/HSK 1 Student Book.pdf', title: 'HSK 1 Student Book', level: 1 },
  { src: `${dwnd}/HSK-1 Workbook.pdf`, dest: 'books/hsk1/HSK 1 Workbook.pdf', title: 'HSK 1 Workbook', level: 1 },
  { src: `${dwnd}/HSK-2-SB.pdf`, dest: 'books/hsk2/HSK 2 Student Book.pdf', title: 'HSK 2 Student Book', level: 2 },
  { src: `${dwnd}/HSK-2-Workbook.pdf`, dest: 'books/hsk2/HSK 2 Workbook.pdf', title: 'HSK 2 Workbook', level: 2 },
  { src: `${dwnd}/HSK-2-workbook answers.pdf`, dest: 'books/hsk2/HSK 2 Workbook Answers.pdf', title: 'HSK 2 Workbook Answers', level: 2 },
  { src: `${dwnd}/HSK Standard 2 Character Book .pdf`, dest: 'books/hsk2/HSK 2 Character Book.pdf', title: 'HSK 2 Character Book', level: 2 },
  { src: `${dwnd}/HSK-3-SB.pdf`, dest: 'books/hsk3/HSK 3 Student Book.pdf', title: 'HSK 3 Student Book', level: 3 },
  { src: `${dwnd}/HSK-3-Workbook.pdf`, dest: 'books/hsk3/HSK 3 Workbook.pdf', title: 'HSK 3 Workbook', level: 3 },
  { src: `${dwnd}/HSK-3-Teachers book.pdf`, dest: 'books/hsk3/HSK 3 Teacher Book.pdf', title: 'HSK 3 Teacher Book', level: 3 },
  { src: `${dwnd}/HSK-4 SB1.pdf`, dest: 'books/hsk4/HSK 4 Student Book 1.pdf', title: 'HSK 4 Student Book 1', level: 4 },
  { src: `${dwnd}/HSK-4 SB2.pdf`, dest: 'books/hsk4/HSK 4 Student Book 2.pdf', title: 'HSK 4 Student Book 2', level: 4 },
  { src: `${dwnd}/HSK-4 TB.pdf`, dest: 'books/hsk4/HSK 4 Teacher Book.pdf', title: 'HSK 4 Teacher Book', level: 4 },
  { src: `${dwnd}/HSK-4 Workbook1.pdf`, dest: 'books/hsk4/HSK 4 Workbook 1.pdf', title: 'HSK 4 Workbook 1', level: 4 },
  { src: `${dwnd}/HSK-4 Workbook2.pdf`, dest: 'books/hsk4/HSK 4 Workbook 2.pdf', title: 'HSK 4 Workbook 2', level: 4 },
  { src: `${sem5}/新HSK2 教材 @hanyu_uz.pdf`, dest: 'books/hsk2/HSK 2 Textbook (新HSK2).pdf', title: 'HSK 2 Textbook (新HSK2)', level: 2 },
  { src: `${sem5}/新HSK3教材 @hanyu_uz.pdf`, dest: 'books/hsk3/HSK 3 Textbook (新HSK3).pdf', title: 'HSK 3 Textbook (新HSK3)', level: 3 },
  { src: `${sem5}/1000 Chinese words 1 @hanyu_uz.pdf`, dest: 'books/extra/1000 Chinese Words.pdf', title: '1000 Chinese Words', level: 0 },
  { src: `${sep5}/New HSK3 workbook @hanyu_uz.pdf`, dest: 'books/hsk3/New HSK 3 Workbook (hanyu_uz).pdf', title: 'New HSK 3 Workbook', level: 3 },
];

const bookManifest = [];
for (const b of books) {
  const ok = copy(b.src, path.join(root, 'library', b.dest));
  if (ok) {
    bookManifest.push({
      level: b.level,
      title: b.title,
      path: 'library/' + b.dest,
      size: fs.statSync(path.join(root, 'library', b.dest)).size
    });
  }
}

// ---- Audio (rar/zip) -> extract into library/audio/<level>/<book>/ ----
const audio = [
  { src: `${dwnd}/HSK-1 SB-AUDIO.rar`, out: 'audio/hsk1/student-book', title: 'HSK 1 Student Book Audio', level: 1 },
  { src: `${dwnd}/HSK-1 WB-AUDIO.rar`, out: 'audio/hsk1/workbook', title: 'HSK 1 Workbook Audio', level: 1 },
  { src: `${dwnd}/HSK- 2 SB-AUDIO.rar`, out: 'audio/hsk2/student-book', title: 'HSK 2 Student Book Audio', level: 2 },
  { src: `${dwnd}/HSK- 2 WB-AUDIO.rar`, out: 'audio/hsk2/workbook', title: 'HSK 2 Workbook Audio', level: 2 },
  { src: `${dwnd}/HSK - 3-SB-AUDIO.rar`, out: 'audio/hsk3/student-book', title: 'HSK 3 Student Book Audio', level: 3 },
  { src: `${dwnd}/HSK 3-WB-AUDIO.rar`, out: 'audio/hsk3/workbook', title: 'HSK 3 Workbook Audio', level: 3 },
  { src: `${dwnd}/HSK-4（上）SB1-AUDIO.rar`, out: 'audio/hsk4/student-book-1', title: 'HSK 4 Student Book 1 Audio', level: 4 },
  { src: `${dwnd}/HSK-4（上）-WB1-AUDIO.rar`, out: 'audio/hsk4/workbook-1', title: 'HSK 4 Workbook 1 Audio', level: 4 },
  { src: `${dwnd}/HSK-4（下）SB2-AUDIO.rar`, out: 'audio/hsk4/student-book-2', title: 'HSK 4 Student Book 2 Audio', level: 4 },
  { src: `${dwnd}/HSK-4（下）-WB2-AUDIO.rar`, out: 'audio/hsk4/workbook-2', title: 'HSK 4 Workbook 2 Audio', level: 4 },
  { src: `${sep5}/New HSK 3 workbook audio @hanyu_uz .zip`, out: 'audio/hsk3/workbook-new', title: 'New HSK 3 Workbook Audio', level: 3 },
];

const audioManifest = [];
for (const a of audio) {
  if (!fs.existsSync(a.src)) { console.log('MISSING AUDIO:', a.src); continue; }
  const dest = path.join(root, 'library', a.out);
  fs.mkdirSync(dest, { recursive: true });
  try {
    execFileSync(SEVENZIP, ['x', '-y', `-o${dest}`, a.src], { stdio: 'ignore' });
    const files = fs.readdirSync(dest).filter(f => /\.(mp3|m4a|wav|wma|flac|ogg|aac)$/i.test(f)).sort();
    audioManifest.push({ level: a.level, title: a.title, dir: 'library/' + a.out, count: files.length });
    console.log('EXTRACTED:', a.out, '->', files.length, 'audio files');
  } catch (e) {
    console.log('EXTRACT FAIL:', a.out, e.message);
  }
}

const manifest = { books: bookManifest, audio: audioManifest, generated: new Date().toISOString() };
fs.writeFileSync(path.join(root, 'data', 'library-manifest.json'), JSON.stringify(manifest, null, 2));
console.log('MANIFEST written.');
console.log('Books:', bookManifest.length, '| Audio groups:', audioManifest.length);
