// Home page: commands panel plus a full-window three.js glass scene.
// three.js is MIT, see assets/vendor/three/LICENSE. Build: npm run build:home
import {
  WebGLRenderer, Scene, PerspectiveCamera, PMREMGenerator, Group, Mesh,
  MeshPhysicalMaterial, MeshStandardMaterial, MeshBasicMaterial, IcosahedronGeometry,
  SphereGeometry, TorusGeometry, CapsuleGeometry, PlaneGeometry, CanvasTexture, Color,
  ACESFilmicToneMapping, SRGBColorSpace, RepeatWrapping, MathUtils, Vector2
} from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

// ---------- Commands ----------
export const COMMANDS = {
  projects: {
    line: 'show projects',
    rows: [
      ['Learning Games', 'Phonics, typing, and numbers.', 'https://ericrayanderson.github.io/learning-terminal/'],
      ['shinymaterial', 'Material Design for Shiny.', 'projects.html#shinymaterial'],
      ['shinyglass', 'Liquid glass themes.', 'projects.html#shinyglass']
    ]
  },
  games: {
    line: 'show games',
    rows: [
      ['play helicopter', 'Fly a cave.', 'helicopter.html'],
      ['play putt', 'Three holes.', 'putt.html'],
      ['play dirtbike', 'A short trail.', 'dirtbike.html'],
      ['play basketball', 'Ten shots a round.', 'basketball.html']
    ]
  },
  about: {
    line: 'about',
    rows: [
      ['Eric Anderson, Wake Forest, NC.', 'A personal site with projects and tools.', 'about.html']
    ]
  },
  contact: {
    line: 'contact',
    rows: [
      ['eric.ray.anderson@gmail.com', 'Email', 'mailto:eric.ray.anderson@gmail.com'],
      ['GitHub', 'Code and projects', 'https://github.com/ericrayanderson']
    ]
  }
};

const ORDER = ['projects', 'games', 'about', 'contact'];
let onCommand = () => {};

function showCommand(name) {
  const spec = COMMANDS[name];
  const panel = document.getElementById('panel');
  if (!spec || !panel) return;
  document.querySelectorAll('button[data-cmd]').forEach((b) => {
    b.setAttribute('aria-pressed', b.dataset.cmd === name ? 'true' : 'false');
  });
  const title = document.createElement('p');
  title.className = 'panel-title';
  const gt = document.createElement('span');
  gt.textContent = 'eric>';
  title.append(gt, spec.line);
  const list = document.createElement('ul');
  list.className = 'rows';
  spec.rows.forEach(([label, note, href]) => {
    const li = document.createElement('li');
    const a = document.createElement('a');
    a.href = href;
    if (href.includes('github.com')) a.rel = 'me';
    const l = document.createElement('span');
    l.textContent = label;
    const n = document.createElement('span');
    n.className = 'note';
    n.textContent = note;
    a.append(l, n);
    li.append(a);
    list.append(li);
  });
  panel.replaceChildren(title, list);
  panel.hidden = false;
  // Restart the entrance animation.
  panel.style.animation = 'none';
  void panel.offsetWidth;
  panel.style.animation = '';
  onCommand(ORDER.indexOf(name));
}

const commands = document.getElementById('commands');
if (commands) {
  commands.addEventListener('click', (e) => {
    const b = e.target.closest('button[data-cmd]');
    if (b) showCommand(b.dataset.cmd);
  });
}
document.documentElement.setAttribute('data-booted', '1');

// ---------- Scene ----------
const host = document.getElementById('scene');
const reduceQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
const darkQuery = window.matchMedia('(prefers-color-scheme: dark)');
const smallQuery = window.matchMedia('(max-width: 700px)');

function webglOk() {
  try {
    const c = document.createElement('canvas');
    return !!(window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl')));
  } catch (e) { return false; }
}

function palette() {
  return darkQuery.matches
    ? { bg: '#161616', glowA: 'rgba(228,178,90,0.30)', glowB: 'rgba(111,176,255,0.24)', line: 'rgba(255,255,255,0.05)',
        amber: '#e4b25a', blue: '#6fb0ff', ring: '#5c5c5c', exposure: 1.0, env: 0.5 }
    : { bg: '#f4f1ea', glowA: 'rgba(212,138,28,0.32)', glowB: 'rgba(42,104,176,0.24)', line: 'rgba(60,45,25,0.06)',
        amber: '#d48a1c', blue: '#2a68b0', ring: '#b4a996', exposure: 0.88, env: 0.42 };
}

if (host && webglOk()) startScene();

function startScene() {
  let renderer;
  try {
    renderer = new WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'low-power' });
  } catch (e) { return; }
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.toneMapping = ACESFilmicToneMapping;
  const canvas = renderer.domElement;
  canvas.setAttribute('aria-hidden', 'true');
  host.appendChild(canvas);

  const scene = new Scene();
  const pmrem = new PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  const camera = new PerspectiveCamera(35, 1, 0.1, 60);

  // Backdrop: page color, two soft color fields and a faint grid. The glass bends this.
  const bgCanvas = document.createElement('canvas');
  bgCanvas.width = 1024; bgCanvas.height = 640;
  const bgTex = new CanvasTexture(bgCanvas);
  bgTex.colorSpace = SRGBColorSpace;
  const backdrop = new Mesh(new PlaneGeometry(30, 18.75), new MeshBasicMaterial({ map: bgTex, toneMapped: false }));
  backdrop.position.z = -6;
  scene.add(backdrop);
  function paintBackdrop(p) {
    const g = bgCanvas.getContext('2d');
    const W = bgCanvas.width, H = bgCanvas.height;
    g.fillStyle = p.bg; g.fillRect(0, 0, W, H);
    const blob = (x, y, r, c) => {
      const grd = g.createRadialGradient(x, y, 0, x, y, r);
      grd.addColorStop(0, c); grd.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = grd; g.fillRect(0, 0, W, H);
    };
    blob(W * 0.72, H * 0.3, W * 0.32, p.glowB);
    blob(W * 0.3, H * 0.72, W * 0.3, p.glowA);
    g.strokeStyle = p.line; g.lineWidth = 1.5;
    for (let x = 0; x <= W; x += 32) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, H); g.stroke(); }
    for (let y = 0; y <= H; y += 32) { g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); }
    bgTex.needsUpdate = true;
  }

  const glass = new MeshPhysicalMaterial({
    color: 0xffffff, metalness: 0, roughness: 0.03, transmission: 1, thickness: 1.0,
    ior: 1.5, specularIntensity: 0.9, clearcoat: 0.5, clearcoatRoughness: 0.08, dispersion: 0.15
  });
  const frost = new MeshPhysicalMaterial({
    color: 0xffffff, metalness: 0, roughness: 0.35, transmission: 1, thickness: 0.6, ior: 1.4
  });
  const amber = new MeshStandardMaterial({ roughness: 0.3, metalness: 0.05 });
  const blue = new MeshStandardMaterial({ roughness: 0.3, metalness: 0.05 });
  const ringMat = new MeshStandardMaterial({ roughness: 0.45, metalness: 0.3 });

  const world = new Group();
  scene.add(world);

  function pebbleGeo(r, sx, sy, sz) {
    const geo = new IcosahedronGeometry(r, 20);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) pos.setXYZ(i, pos.getX(i) * sx, pos.getY(i) * sy, pos.getZ(i) * sz);
    geo.computeVertexNormals();
    return geo;
  }

  // Each piece floats on its own; positions are set per layout in resize().
  const pieces = [
    { mesh: new Mesh(new TorusGeometry(1.15, 0.42, 48, 128), glass), spin: [0.12, 0.18], bob: 0.5 },
    { mesh: new Mesh(pebbleGeo(1.0, 1.2, 0.9, 0.75), glass), spin: [0.08, -0.14], bob: 0.7 },
    { mesh: new Mesh(new CapsuleGeometry(0.32, 1.1, 12, 32), frost), spin: [0.2, 0.1], bob: 0.6 },
    { mesh: new Mesh(new SphereGeometry(0.48, 48, 32), amber), spin: [0, 0], bob: 0.45 },
    { mesh: new Mesh(new SphereGeometry(0.34, 48, 32), blue), spin: [0, 0], bob: 0.55 },
    { mesh: new Mesh(new TorusGeometry(2.6, 0.012, 12, 200), ringMat), spin: [0.02, 0.03], bob: 0.2 }
  ];
  pieces.forEach((p, i) => { p.phase = i * 1.7; world.add(p.mesh); });

  const layouts = {
    wide: [[3.6, 1.3, -1.2], [-3.9, -1.5, -1.0], [4.4, -2.0, -2.0], [3.0, 1.9, -3.2], [-4.6, -0.8, -3.0], [0.4, 0.2, -4.0]],
    tall: [[1.3, 3.2, -1.6], [-1.2, -3.4, -1.2], [1.6, -2.6, -2.4], [0.6, 3.9, -3.4], [-1.6, -2.7, -3.4], [0, 0, -4.0]]
  };

  function applyPalette() {
    const p = palette();
    paintBackdrop(p);
    scene.background = new Color(p.bg);
    amber.color = new Color(p.amber);
    blue.color = new Color(p.blue);
    ringMat.color = new Color(p.ring);
    glass.envMapIntensity = p.env;
    frost.envMapIntensity = p.env;
    renderer.toneMappingExposure = p.exposure;
  }
  applyPalette();

  const pointer = new Vector2();
  const tilt = new Vector2();
  let turn = 0;
  let turnTarget = 0;
  onCommand = (i) => {
    turnTarget = (i + 1) * 0.9;
    if (reduceQuery.matches) { turn = turnTarget; draw(performance.now()); }
  };
  window.addEventListener('pointermove', (e) => {
    pointer.set((e.clientX / window.innerWidth) * 2 - 1, (e.clientY / window.innerHeight) * 2 - 1);
    if (reduceQuery.matches) draw(performance.now());
  }, { passive: true });

  function resize() {
    const w = Math.max(1, window.innerWidth), h = Math.max(1, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, smallQuery.matches ? 1.5 : 2));
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    const tall = w / h < 0.9;
    camera.position.set(0, 0, tall ? 11 : 9);
    camera.updateProjectionMatrix();
    const L = tall ? layouts.tall : layouts.wide;
    pieces.forEach((p, i) => { p.base = L[i]; });
    draw(performance.now());
  }

  function draw(t) {
    const still = reduceQuery.matches;
    const s = still ? 0 : t / 1000;
    tilt.lerp(pointer, still ? 1 : 0.05);
    turn += (turnTarget - turn) * (still ? 1 : 0.04);
    pieces.forEach((p) => {
      const [x, y, z] = p.base;
      p.mesh.position.set(x, y + Math.sin(s * p.bob + p.phase) * 0.15, z);
      p.mesh.rotation.x = s * p.spin[0] + p.phase + turn * 0.5;
      p.mesh.rotation.y = s * p.spin[1] + p.phase * 0.5 + turn;
    });
    world.rotation.y = tilt.x * 0.12;
    world.rotation.x = tilt.y * 0.08;
    camera.position.x = tilt.x * 0.35;
    camera.position.y = -tilt.y * 0.25;
    camera.lookAt(0, 0, -2);
    renderer.render(scene, camera);
  }

  let running = false;
  function loop(t) {
    if (!running) return;
    draw(t);
    requestAnimationFrame(loop);
  }
  function update() {
    const want = !document.hidden && !reduceQuery.matches;
    if (want && !running) { running = true; requestAnimationFrame(loop); }
    if (!want) running = false;
  }

  window.addEventListener('resize', resize);
  document.addEventListener('visibilitychange', update);
  darkQuery.addEventListener('change', () => { applyPalette(); draw(performance.now()); });
  reduceQuery.addEventListener('change', () => { update(); draw(performance.now()); });
  smallQuery.addEventListener('change', resize);
  canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); running = false; host.classList.remove('is-ready'); });
  canvas.addEventListener('webglcontextrestored', () => { host.classList.add('is-ready'); resize(); update(); });

  resize();
  host.classList.add('is-ready');
  update();
}
