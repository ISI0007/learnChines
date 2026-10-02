// Verify every asset referenced by the site manifests is served over HTTP.
import fs from 'fs';
import path from 'path';
import http from 'http';

const ROOT = 'D:/chinese-learning';
const base = 'http://127.0.0.1:8091/';
const lib = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'library-manifest.json'), 'utf8'));
const ex = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'exams-manifest.json'), 'utf8')).exams;

const urls = [];
for (const b of lib.books) urls.push(b.path);
for (const g of lib.audio) for (const f of g.files) urls.push(f.path);
for (const e of ex) for (const k of ['test', 'answers', 'listening', 'transcript']) if (e[k]) urls.push(e[k].path);

function head(u, tries = 3) {
  return new Promise((res) => {
    const req = http.request(base + encodeURI(u).replace(/#/g, '%23'), { method: 'HEAD', agent: false, headers: { Connection: 'close' } }, (r) => {
      r.resume(); res({ u, code: r.statusCode });
    });
    req.on('error', () => {
      if (tries > 1) setTimeout(() => head(u, tries - 1).then(res), 120);
      else res({ u, code: 0 });
    });
    req.setTimeout(20000, () => { req.destroy(); });
    req.end();
  });
}

const CONC = 4;
let i = 0, ok = 0;
const bad = [];
await new Promise((done) => {
  let active = 0, finished = 0;
  const total = urls.length;
  const next = () => {
    if (i >= total) { if (active === 0) done(); return; }
    const u = urls[i++];
    active++;
    head(u).then((r) => {
      if (r.code === 200) ok++; else bad.push(r);
      active--; finished++;
      if (finished === total) done(); else next();
    });
  };
  for (let c = 0; c < CONC; c++) next();
});

console.log('checked:', urls.length, '| ok:', ok, '| bad:', bad.length);
for (const b of bad.slice(0, 40)) console.log('  BAD', b.code, b.u);
process.exit(bad.length ? 1 : 0);
