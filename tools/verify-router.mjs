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
const fired = [];
['/', '/vocabulary', '/syllabus/:level', '/courses', '/library', '/practice'].forEach((p) => Router.on(p, function (c) { seen.push(c); fired.push(c.name); }));
routerStarted = true;
Router.start(function () {});

const resolve = listeners['hashchange'] ? listeners['hashchange'][0] : null;
check('router installed a hashchange listener after start()', !!resolve);

function goHash(h) { sandbox.location.hash = h; const before = fired.length; resolve(); return { cur: Router.current, fired: fired.length > before }; }

let c = goHash('#/vocabulary?level=2');
check('/vocabulary?level=2 resolves to /vocabulary', c.cur.path === '/vocabulary', JSON.stringify(c.cur));
check('query.level === "2"', c.cur.query && c.cur.query.level === '2', JSON.stringify(c.cur.query));
check('route name is /vocabulary (not the old broken null)', c.cur.name === '/vocabulary', c.cur.name);
check('route handler FIRED on navigation (the click-does-nothing bug)', c.fired === true, 'handler was not invoked');

c = goHash('#/syllabus/3?tab=vocabulary');
check('/syllabus/3?tab=vocabulary -> level param is clean "3"', c.cur.params && c.cur.params.level === '3', JSON.stringify(c.cur));
check('  and tab is in query', c.cur.query && c.cur.query.tab === 'vocabulary', JSON.stringify(c.cur.query));
check('  and its handler fired too', c.fired === true);

c = goHash('#/courses?band=beginner');
check('/courses?band=beginner matches /courses', c.cur.path === '/courses' && c.cur.query.band === 'beginner', JSON.stringify(c.cur));

c = goHash('#/library?q=grammar');
check('/library?q=grammar matches /library', c.cur.path === '/library' && c.cur.query.q === 'grammar', JSON.stringify(c.cur));

c = goHash('#/courses');
check('plain /courses still works', c.cur.path === '/courses' && Object.keys(c.cur.query).length === 0, JSON.stringify(c.cur));

// repeat navigation must fire the handler every time (not just once)
const firedBefore = fired.length;
goHash('#/courses'); goHash('#/vocabulary'); goHash('#/courses');
check('handler fires on every navigation', fired.length === firedBefore + 3, 'fired ' + (fired.length - firedBefore) + ' of 3');

console.log('\n' + (fail === 0 ? '\u2713 PASS' : '\u2717 FAIL') + '  ' + pass + ' passed, ' + fail + ' failed');
process.exit(fail === 0 ? 0 : 1);
