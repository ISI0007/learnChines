import fs from 'fs';
import path from 'path';

const root = 'D:/chinese-learning';
const vocab = JSON.parse(fs.readFileSync(path.join(root, 'data', 'hsk-vocab.json'), 'utf8'));
const lib = JSON.parse(fs.readFileSync(path.join(root, 'data', 'library-manifest.json'), 'utf8'));
const examsPath = path.join(root, 'data', 'exams-manifest.json');
const exams = fs.existsSync(examsPath)
  ? JSON.parse(fs.readFileSync(examsPath, 'utf8'))
  : { exams: [] };

const out = 'window.VOCAB = ' + JSON.stringify(vocab) + ';\n'
  + 'window.LIBRARY = ' + JSON.stringify(lib) + ';\n'
  + 'window.EXAMS = ' + JSON.stringify(exams.exams) + ';\n';

fs.writeFileSync(path.join(root, 'js', 'data.js'), out);
console.log('data.js written:', out.length, 'bytes; exams:', exams.exams.length);
