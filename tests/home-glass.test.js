// Home page glass scene checks. Run: npm ci && npm test
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { JSDOM } = require('jsdom');
const root = path.join(__dirname, '..');
let failed = 0;
function ok(cond, msg) { console.log((cond ? 'ok   ' : 'FAIL ') + msg); if (!cond) failed++; }

const index = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const bundlePath = path.join(root, 'assets/js/home-glass.js');
const bundle = fs.readFileSync(bundlePath, 'utf8');
const src = fs.readFileSync(path.join(root, 'assets/js/home-glass/home-glass.src.js'), 'utf8');

// Local assets referenced by index.html all exist.
const refs = [...index.matchAll(/(?:href|src)="([^"#:]+?)(?:\?[^"]*)?"/g)].map(m => m[1]);
refs.forEach(r => ok(fs.existsSync(path.join(root, r)), 'index asset exists: ' + r));
ok(/<script type="module" src="assets\/js\/home-glass\.js\?v=\d+">/.test(index), 'index loads the glass module');
ok(/<link rel="stylesheet" href="assets\/css\/home-glass\.css\?v=\d+">/.test(index), 'index loads the glass css');
ok(index.includes('id="glass-stage"') && index.includes('aria-hidden="true"'), 'stage is decorative');

// Only index.html uses the new files.
fs.readdirSync(root).filter(f => f.endsWith('.html') && f !== 'index.html').forEach(f => {
  ok(!fs.readFileSync(path.join(root, f), 'utf8').includes('home-glass'), f + ' does not load glass assets');
});

// Content and links are still in the page without the scene.
['Eric Anderson', 'Wake Forest, NC', 'projects.html', 'games.html', 'about.html', 'contact.html',
 'basketball.html', 'https://ericrayanderson.github.io/learning-terminal/', 'mailto:eric.ray.anderson@gmail.com'
].forEach(t => ok(index.includes(t), 'index keeps ' + t));

// License and pinned library.
ok(fs.existsSync(path.join(root, 'assets/vendor/three/LICENSE')) &&
   /MIT License/.test(fs.readFileSync(path.join(root, 'assets/vendor/three/LICENSE'), 'utf8')), 'three.js MIT license present');
ok(/SPDX-License-Identifier: MIT/.test(bundle) && /Three\.js Authors/.test(bundle), 'bundle keeps three.js license notice');
ok(!/https?:\/\/(unpkg|cdn|esm\.sh|jsdelivr)/.test(bundle + index), 'no hotlinked library');

// Bundle matches source.
const tmp = path.join(require('os').tmpdir(), 'home-glass-check.js');
require('esbuild').buildSync({ entryPoints: [path.join(root, 'assets/js/home-glass/home-glass.src.js')], bundle: true, minify: true, format: 'esm', target: 'es2019', legalComments: 'eof', outfile: tmp, logLevel: 'silent' });
ok(fs.readFileSync(tmp, 'utf8') === bundle, 'committed bundle matches source build');

// Renderer behavior in source.
ok(/prefers-reduced-motion/.test(src) && /reduceQuery\.matches/.test(src), 'honors reduced motion');
ok(/visibilitychange/.test(src) && /IntersectionObserver/.test(src), 'pauses when hidden or offscreen');
ok(/Math\.min\(window\.devicePixelRatio \|\| 1, cap\)/.test(src), 'caps pixel ratio');
ok(/webglcontextlost/.test(src) && /webglOk\(\)/.test(src), 'handles missing or lost WebGL');
ok(/prefers-color-scheme: dark/.test(src), 'follows light and dark');

// No WebGL: the module adds nothing and the page stays readable.
(async () => {
  const dom = new JSDOM(index, { url: 'https://ericrayanderson.com/', pretendToBeVisual: true });
  const w = dom.window;
  w.matchMedia = () => ({ matches: false, addEventListener() {} });
  w.HTMLCanvasElement.prototype.getContext = () => null;
  for (const k of ['window', 'document', 'performance']) globalThis[k] = k === 'window' ? w : w[k];
  globalThis.matchMedia = w.matchMedia;
  await import(bundlePath + '?nowebgl');
  const stage = w.document.getElementById('glass-stage');
  ok(stage.children.length === 0 && !stage.classList.contains('is-ready'), 'no WebGL: no canvas, stage stays hidden');
  ok(w.document.querySelectorAll('#commands button').length === 4, 'no WebGL: commands still there');
  console.log(failed ? failed + ' FAILED' : 'ALL PASS');
  process.exitCode = failed ? 1 : 0;
})();
