// Verify the real js/router.js handles query strings without a browser.
import fs from 'fs';
import vm from 'vm';

const handlers = [];
const listeners = {};
const sandbox = {
  window: {
    addEventListener: (ev, fn) => { (listeners[ev] = listeners[ev] || []).push(fn); },
    location: { hash: '#/vocabulary?level=2', replace: (h) => { sandbox.window.location.hash = h; } },
  },
  location: null,
  document: { dispatchEvent: () => {} },
  CustomEvent: function (t, o) { this.type = t; this.detail = o && o.detail; },
  decodeURIComponent,
  console,
};
sandbox.location = sandbox.window.location;
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync('js/router.js', 'utf8'), sandbox);
const Router = sandbox.window.Router;

let pass = 0, fail = 0;
let routerStarted = false;
const check = (name, cond, extra) => { if (cond) { pass++; console.log('  \u2713 ' + name); } else { fail++; console.log('  \u2717 ' + name + (extra ? '  -> ' + extra : '')); } };

// Install routes, then start the router (which registers the hashchange listener).
const seen = [];
['/', '/vocabulary', '/syllabus/:level', '/courses', '/library', '/practice'].forEach((p) => Router.on(p, (c) => seen.push(c)));
routerStarted = true;
Router.start(function () {});

const resolve = listeners['hashchange'] ? listeners['hashchange'][0] : null;
check('router installed a hashchange listener after start()', !!resolve);

function goHash(h) { sandbox.location.hash = h; resolve(); return Router.current; }

let c = goHash('#/vocabulary?level=2');
check('/vocabulary?level=2 resolves to /vocabulary', c.path === '/vocabulary', JSON.stringify(c));
check('query.level === "2"', c.query && c.query.level === '2', JSON.stringify(c.query));
check('route name is /vocabulary (not the old broken null)', c.name === '/vocabulary', c.name);

c = goHash('#/syllabus/3?tab=vocabulary');
check('/syllabus/3?tab=vocabulary -> level param is clean "3"', c.params && c.params.level === '3', JSON.stringify(c));
check('  and tab is in query', c.query && c.query.tab === 'vocabulary', JSON.stringify(c.query));

c = goHash('#/courses?band=beginner');
check('/courses?band=beginner matches /courses', c.path === '/courses' && c.query.band === 'beginner', JSON.stringify(c));

c = goHash('#/library?q=grammar');
check('/library?q=grammar matches /library', c.path === '/library' && c.query.q === 'grammar', JSON.stringify(c));

c = goHash('#/courses');
check('plain /courses still works', c.path === '/courses' && Object.keys(c.query).length === 0, JSON.stringify(c));

console.log('\n' + (fail === 0 ? '\u2713 PASS' : '\u2717 FAIL') + '  ' + pass + ' passed, ' + fail + ' failed');
process.exit(fail === 0 ? 0 : 1);
