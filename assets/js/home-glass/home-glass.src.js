// Home page glass scene. Built with three.js (MIT), see assets/vendor/three/LICENSE.
// Bundle: npm run build:home (writes assets/js/home-glass.js).
import {
  WebGLRenderer, Scene, PerspectiveCamera, PMREMGenerator, Group, Mesh,
  MeshPhysicalMaterial, MeshStandardMaterial, IcosahedronGeometry, SphereGeometry,
  TorusGeometry, PlaneGeometry, MeshBasicMaterial, CanvasTexture, Color, ACESFilmicToneMapping, SRGBColorSpace, MathUtils, Vector2
} from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

const host = document.getElementById('glass-stage');
const reduceQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
const darkQuery = window.matchMedia('(prefers-color-scheme: dark)');

function webglOk() {
  try {
    const c = document.createElement('canvas');
    return !!(window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl')));
  } catch (e) { return false; }
}

if (host && webglOk()) start();

function palette() {
  return darkQuery.matches
    ? { bg: '#1c1c1c', line: '#333333', amber: '#e4b25a', blue: '#6fb0ff', ring: '#6a6a6a', exposure: 1.0, env: 0.55 }
    : { bg: '#f4f1ea', line: '#e1d9cc', amber: '#d48a1c', blue: '#2a68b0', ring: '#b9ae9e', exposure: 0.9, env: 0.45 };
}

function start() {
  let renderer;
  try {
    renderer = new WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'low-power' });
  } catch (e) { return; }
  // Opaque background in the page color. Glass refracts what was drawn behind it,
  // so a transparent clear made the pebble read as flat white.
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.toneMapping = ACESFilmicToneMapping;
  const canvas = renderer.domElement;
  canvas.setAttribute('aria-hidden', 'true');
  canvas.className = 'glass-canvas';
  host.appendChild(canvas);

  const scene = new Scene();
  const pmrem = new PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

  const camera = new PerspectiveCamera(32, 1, 0.1, 50);
  camera.position.set(0, 0, 7.2);

  const rig = new Group();
  scene.add(rig);

  // A faint console grid behind everything gives the glass something to bend.
  const gridCanvas = document.createElement('canvas');
  gridCanvas.width = gridCanvas.height = 256;
  const gridTex = new CanvasTexture(gridCanvas);
  gridTex.colorSpace = SRGBColorSpace;
  const backdrop = new Mesh(new PlaneGeometry(16, 10), new MeshBasicMaterial({ map: gridTex }));
  backdrop.position.z = -3.2;
  scene.add(backdrop);
  function paintGrid(p) {
    const g = gridCanvas.getContext('2d');
    g.fillStyle = p.bg;
    g.fillRect(0, 0, 256, 256);
    g.strokeStyle = p.line;
    g.lineWidth = 2;
    for (let i = 0; i <= 256; i += 32) {
      g.beginPath(); g.moveTo(i, 0); g.lineTo(i, 256); g.stroke();
      g.beginPath(); g.moveTo(0, i); g.lineTo(256, i); g.stroke();
    }
    gridTex.wrapS = gridTex.wrapT = 1000;
    gridTex.repeat.set(5, 3.2);
    gridTex.needsUpdate = true;
  }

  // A soft glass pebble, with two small lights of color behind it to bend.
  const glass = new MeshPhysicalMaterial({
    color: 0xffffff, metalness: 0, roughness: 0.03, transmission: 1,
    thickness: 0.9, ior: 1.5, specularIntensity: 0.8, clearcoat: 0.6, clearcoatRoughness: 0.08,
    envMapIntensity: 0.5, dispersion: 0.12
  });
  const pebbleGeo = new IcosahedronGeometry(1.1, 24);
  const pos = pebbleGeo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    pos.setXYZ(i, x * 1.18, y * 0.92, z * 0.78);
  }
  pebbleGeo.computeVertexNormals();
  const pebble = new Mesh(pebbleGeo, glass);
  rig.add(pebble);

  const amber = new MeshStandardMaterial({ roughness: 0.35, metalness: 0.1 });
  const blue = new MeshStandardMaterial({ roughness: 0.35, metalness: 0.1 });
  const ringMat = new MeshStandardMaterial({ roughness: 0.5, metalness: 0.2 });
  const a = new Mesh(new SphereGeometry(0.42, 48, 32), amber);
  const b = new Mesh(new SphereGeometry(0.3, 48, 32), blue);
  a.position.set(-0.75, 0.35, -1.6);
  b.position.set(0.85, -0.4, -1.3);
  const ring = new Mesh(new TorusGeometry(2.05, 0.018, 16, 160), ringMat);
  ring.rotation.x = Math.PI * 0.42;
  scene.add(a, b, ring);

  function applyPalette() {
    const p = palette();
    amber.color = new Color(p.amber);
    blue.color = new Color(p.blue);
    ringMat.color = new Color(p.ring);
    scene.background = new Color(p.bg);
    renderer.setClearColor(p.bg, 1);
    glass.envMapIntensity = p.env;
    paintGrid(p);
    renderer.toneMappingExposure = p.exposure;
  }
  applyPalette();

  const pointer = new Vector2(0, 0);
  const tilt = new Vector2(0, 0);
  function onPointer(e) {
    const r = host.getBoundingClientRect();
    pointer.x = MathUtils.clamp(((e.clientX - r.left) / r.width) * 2 - 1, -1, 1);
    pointer.y = MathUtils.clamp(((e.clientY - r.top) / r.height) * 2 - 1, -1, 1);
    if (reduceQuery.matches) draw(performance.now());
  }
  window.addEventListener('pointermove', onPointer, { passive: true });
  host.addEventListener('pointerdown', onPointer, { passive: true });

  function resize() {
    const w = Math.max(1, host.clientWidth), h = Math.max(1, host.clientHeight);
    const cap = window.matchMedia('(max-width: 700px)').matches ? 1.5 : 2;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, cap));
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.position.z = w / h < 1.2 ? 8.4 : 7.2;
    camera.updateProjectionMatrix();
    draw(performance.now());
  }

  function draw(t) {
    const still = reduceQuery.matches;
    const s = still ? 0 : t / 1000;
    tilt.lerp(pointer, still ? 1 : 0.06);
    rig.rotation.y = s * 0.18 + tilt.x * 0.45;
    rig.rotation.x = Math.sin(s * 0.4) * 0.08 + tilt.y * 0.3;
    pebble.position.y = Math.sin(s * 0.7) * 0.06;
    a.position.x = -0.75 + Math.sin(s * 0.5) * 0.35 - tilt.x * 0.25;
    b.position.x = 0.85 + Math.cos(s * 0.45) * 0.35 - tilt.x * 0.2;
    ring.rotation.z = s * 0.05;
    renderer.render(scene, camera);
  }

  let visible = true;
  let running = false;
  function loop(t) {
    if (!running) return;
    draw(t);
    requestAnimationFrame(loop);
  }
  function update() {
    const want = visible && !document.hidden && !reduceQuery.matches;
    if (want && !running) { running = true; requestAnimationFrame(loop); }
    if (!want) running = false;
  }

  new ResizeObserver(resize).observe(host);
  if ('IntersectionObserver' in window) {
    new IntersectionObserver((entries) => {
      visible = entries[0].isIntersecting;
      update();
    }).observe(host);
  }
  document.addEventListener('visibilitychange', update);
  const onScheme = () => { applyPalette(); draw(performance.now()); };
  darkQuery.addEventListener && darkQuery.addEventListener('change', onScheme);
  reduceQuery.addEventListener && reduceQuery.addEventListener('change', () => { update(); draw(performance.now()); });
  canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); running = false; host.classList.remove('is-ready'); });
  canvas.addEventListener('webglcontextrestored', () => { host.classList.add('is-ready'); resize(); update(); });

  host.classList.add('is-ready');
  resize();
  update();
}
