(function () {
  var canvas = document.getElementById("dirt-canvas");
  var stage = document.getElementById("dirt-stage");
  var overlay = document.getElementById("dirt-overlay");
  var overlayTitle = document.getElementById("dirt-overlay-title");
  var overlayText = document.getElementById("dirt-overlay-text");
  var actionBtn = document.getElementById("dirt-action");
  var trailEl = document.getElementById("dirt-trail");
  var nameEl = document.getElementById("dirt-name");
  var timeEl = document.getElementById("dirt-time");
  var bestEl = document.getElementById("dirt-best");
  var live = document.getElementById("dirt-live");
  var pad = document.getElementById("ride-pad");
  var gravityInput = document.getElementById("dirt-gravity");
  var gravityValue = document.getElementById("dirt-gravity-value");
  if (!canvas || !canvas.getContext || !stage) return;

  var ctx = canvas.getContext("2d", { alpha: false });
  var W = 800;
  var H = 500;
  var BEST_KEY = "dirt-trail-bests";
  var GRAVITY_KEY = "dirt-trail-gravity";
  var BASE = 408;
  var GRAVITY = 1700;
  var INERTIA = 2400;
  var WHEEL_R = 13;
  var REAR_X = -30;
  var FRONT_X = 48;
  var MOUNT_Y = 0;
  var REST = 18;
  var SPRING = 280;
  var DAMP = 26;
  var BUMP = 900;
  var THROTTLE = 1500;
  var BRAKE_FORCE = 1600;
  var MU = 1.8;
  var ROLL = 0.45;
  var MAX_SPEED = 500;
  var AIR_LEAN = 4.4;
  var GROUND_LEAN = 2.0;
  var STEP = 1 / 120;
  var LIP = 110;
  var reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  var LEVELS = [
    {
      name: "Pasture",
      start: 170,
      finish: 3720,
      points: [
        [0, 92], [340, 92], [560, 155], [780, 78], [1020, 178], [1240, 96],
        [1400, 96], [1760, 236], [1960, 64], [2180, 148], [2380, 86], [2600, 132],
        [2820, 84], [3040, 150], [3260, 88], [3480, 96], [3920, 96]
      ],
      gaps: [{ from: 1760, to: 1940, floor: 64, fatal: false }],
      logs: [2920],
      trees: [420, 1120, 2480, 3400]
    },
    {
      name: "Ridge",
      start: 170,
      finish: 4680,
      points: [
        [0, 100], [260, 100], [480, 196], [680, 72], [900, 78], [1120, 86],
        [1540, 248], [1760, 48], [1980, 176], [2160, 78], [2380, 150], [2580, 96],
        [2780, 142], [2980, 88], [3360, 300], [3560, 78], [3880, 68], [4100, 140],
        [4300, 82], [4520, 110], [5100, 100]
      ],
      gaps: [
        { from: 1540, to: 1760, floor: 48, fatal: true },
        { from: 3360, to: 3540, floor: 78, fatal: true }
      ],
      logs: [820],
      trees: [340, 2060, 3080, 4000]
    },
    {
      name: "Quarry",
      start: 180,
      finish: 5480,
      points: [
        [0, 100], [300, 100], [500, 158], [700, 86], [920, 168], [1120, 96],
        [1320, 104], [1700, 236], [1900, 52], [2100, 140], [2300, 78], [2480, 148],
        [2660, 82], [2840, 150], [3040, 86], [3160, 86], [3560, 320], [3760, 78],
        [4080, 70], [4300, 150], [4500, 78], [4680, 80], [4920, 108], [5180, 90],
        [5800, 90]
      ],
      gaps: [
        { from: 1700, to: 1880, floor: 52, fatal: true },
        { from: 3560, to: 3740, floor: 78, fatal: true }
      ],
      logs: [1180, 2940],
      trees: [360, 1240, 2360, 3400, 4300, 5000]
    }
  ];

  var state = "ready";
  var levelIndex = 0;
  var level = LEVELS[0];
  var time = 0;
  var last = 0;
  var accumulator = 0;
  var raf = 0;
  var bests = {};
  var cam = { x: 0, y: 0 };
  var particles = [];
  var waitRelease = false;
  var keys = { gas: false, brake: false, back: false, fwd: false };
  var touches = { gas: false, brake: false, back: false, fwd: false };
  var gravityScale = 1;
  var bike = {
    x: 170,
    y: 280,
    vx: 0,
    vy: 0,
    angle: 0,
    angVel: 0,
    spin: 0,
    rearC: 0,
    frontC: 0,
    on: false
  };

  try {
    bests = JSON.parse(localStorage.getItem(BEST_KEY) || "{}") || {};
  } catch (error) {
    bests = {};
  }

  function formatGravity(scale) {
    var shown = Math.round(scale * 20) / 20;
    var text = shown.toFixed(2).replace(/0$/, "").replace(/\.0$/, "");
    return text + "x";
  }

  function readGravity() {
    try {
      var raw = parseFloat(localStorage.getItem(GRAVITY_KEY));
      if (isFinite(raw)) return clamp(Math.round(raw * 20) / 20, 0.1, 2);
    } catch (error) {
      /* Storage can be blocked. The slider still works for this visit. */
    }
    return 1;
  }

  function applyGravity(scale, persist, writeControl) {
    gravityScale = clamp(Math.round(Number(scale) * 20) / 20, 0.1, 2);
    var label = formatGravity(gravityScale);
    if (gravityValue) gravityValue.textContent = label;
    if (gravityInput) {
      if (writeControl) gravityInput.value = String(gravityScale);
      gravityInput.setAttribute("aria-valuenow", String(gravityScale));
      gravityInput.setAttribute("aria-valuetext", label);
    }
    if (!persist) return;
    try {
      localStorage.setItem(GRAVITY_KEY, String(gravityScale));
    } catch (error) {
      /* The choice still applies until the page is closed. */
    }
  }

  function colors() {
    var dark = document.documentElement.getAttribute("data-theme") === "dark";
    if (dark) {
      return {
        skyTop: "#17191d",
        sky: "#12110f",
        hillFar: "#1e1c19",
        hillNear: "#2a2622",
        dirt: "#4a4036",
        dirtDeep: "#2a241e",
        grass: "#9ecbb4",
        ink: "#f3efe6",
        frame: "#f3efe6",
        tire: "#0c0b0a",
        tireEdge: "#f3efe6",
        hub: "#d5c4a1",
        accent: "#b7d7c6",
        dust: "#6b5c4c"
      };
    }
    return {
      skyTop: "#d7e6f4",
      sky: "#f4f0e7",
      hillFar: "#e6ddd0",
      hillNear: "#d3c6b4",
      dirt: "#6e5846",
      dirtDeep: "#3e3228",
      grass: "#1c5c43",
      ink: "#1b1814",
      frame: "#1b1814",
      tire: "#ffffff",
      tireEdge: "#1b1814",
      hub: "#1b1814",
      accent: "#1c5c43",
      dust: "#8a7362"
    };
  }

  function clamp(v, a, b) {
    return v < a ? a : v > b ? b : v;
  }

  function wrap(a) {
    var t = Math.PI * 2;
    while (a > Math.PI) a -= t;
    while (a < -Math.PI) a += t;
    return a;
  }

  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  function smooth(t) {
    if (t < 0) t = 0;
    if (t > 1) t = 1;
    return t * t * (3 - 2 * t);
  }

  function linearHeight(x) {
    var pts = level.points;
    if (x <= pts[0][0]) return pts[0][1];
    var end = pts[pts.length - 1];
    if (x >= end[0]) return end[1];
    var lo = 0;
    var hi = pts.length - 1;
    while (hi - lo > 1) {
      var mid = (lo + hi) >> 1;
      if (pts[mid][0] < x) lo = mid;
      else hi = mid;
    }
    var p0 = pts[lo];
    var p1 = pts[hi];
    var t = (x - p0[0]) / (p1[0] - p0[0] || 1);
    return lerp(p0[1], p1[1], t);
  }

  function logBump(x) {
    var logs = level.logs || [];
    var extra = 0;
    var i;
    for (i = 0; i < logs.length; i++) {
      var d = x - logs[i];
      var w = 34;
      if (d < -w || d > w) continue;
      var u = d / w;
      var bell = (1 - u * u) * (1 - u * u);
      extra += bell * 8;
    }
    return extra;
  }

  function crestHeight(x) {
    var a = linearHeight(x - 16);
    var b = linearHeight(x);
    var c = linearHeight(x + 16);
    return (a + b * 2 + c) / 4 + logBump(x);
  }

  function heightAt(x) {
    var h = crestHeight(x);
    var gaps = level.gaps || [];
    var i;
    for (i = 0; i < gaps.length; i++) {
      var g = gaps[i];
      var lip = g.fatal ? LIP : 0;
      if (g.fatal && x > g.from && x < g.from + lip) h = crestHeight(g.from);
      if (x <= g.from + lip || x >= g.to) continue;
      var dropW = 18;
      var landW = 48;
      if (x < g.from + lip + dropW) {
        var td = smooth((x - (g.from + lip)) / dropW);
        h = lerp(crestHeight(g.from), g.floor, td);
      } else if (x > g.to - landW) {
        var tl = smooth((x - (g.to - landW)) / landW);
        h = lerp(g.floor, crestHeight(g.to), tl);
      } else h = g.floor;
    }
    return h;
  }

  function terrainY(x) {
    return BASE - heightAt(x);
  }

  function sample(x) {
    var y = terrainY(x);
    var slope = (terrainY(x + 5) - terrainY(x - 5)) / 10;
    var len = Math.hypot(1, slope) || 1;
    var tx = 1 / len;
    var ty = slope / len;
    return {
      y: y,
      tx: tx,
      ty: ty,
      nx: ty,
      ny: -tx,
      slope: Math.atan2(ty, tx),
      steep: Math.abs(slope) > 0.95
    };
  }

  function trailSlope(x) {
    var yL = BASE - (linearHeight(x - 18) + logBump(x - 18));
    var yR = BASE - (linearHeight(x + 18) + logBump(x + 18));
    return Math.atan2(yR - yL, 36);
  }

  function fatalAt(x) {
    var gaps = level.gaps || [];
    var i;
    for (i = 0; i < gaps.length; i++) {
      var g = gaps[i];
      if (g.fatal && x > g.from + LIP + 6 && x < g.to - 16) return true;
    }
    return false;
  }

  function worldPoint(lx, ly) {
    var c = Math.cos(bike.angle);
    var s = Math.sin(bike.angle);
    return {
      x: bike.x + lx * c - ly * s,
      y: bike.y + lx * s + ly * c
    };
  }

  function held(name) {
    if (waitRelease) return false;
    return !!(keys[name] || touches[name]);
  }

  function anyHeld() {
    return keys.gas || keys.brake || keys.back || keys.fwd || touches.gas || touches.brake || touches.back || touches.fwd;
  }

  function refreshWait() {
    if (waitRelease && !anyHeld()) waitRelease = false;
  }

  function wheelContact(lx) {
    var mount = worldPoint(lx, MOUNT_Y);
    var downX = Math.sin(bike.angle);
    var downY = Math.cos(bike.angle);
    var axle = {
      x: mount.x + downX * REST,
      y: mount.y + downY * REST
    };
    var g = sample(axle.x);
    var dist = (axle.y - g.y) * g.ny;
    var compression = g.steep ? 0 : WHEEL_R - dist;
    if (compression < 0) compression = 0;
    var rx = axle.x - bike.x;
    var ry = axle.y - bike.y;
    var axleVx = bike.vx - bike.angVel * ry;
    var axleVy = bike.vy + bike.angVel * rx;
    var vn = axleVx * g.nx + axleVy * g.ny;
    var vt = axleVx * g.tx + axleVy * g.ty;
    var springK = SPRING * gravityScale;
    var dampC = DAMP * Math.sqrt(gravityScale);
    var force = 0;
    if (compression > 0) {
      force = compression * springK - vn * dampC;
      if (compression > 9) force += (compression - 9) * BUMP * gravityScale;
      if (force < 0) force = 0;
    }
    return {
      g: g,
      compression: compression,
      force: force,
      vt: vt,
      axle: axle,
      rx: rx,
      ry: ry,
      load: compression * springK
    };
  }

  function physics(dt) {
    var gas = held("gas") && !held("brake");
    var brake = held("brake") && !held("gas");
    var lean = (held("fwd") ? 1 : 0) - (held("back") ? 1 : 0);
    var rear = wheelContact(REAR_X);
    var front = wheelContact(FRONT_X);
    bike.rearC = rear.compression;
    bike.frontC = front.compression;

    if ((rear.compression > 0 && fatalAt(rear.axle.x)) || (front.compression > 0 && fatalAt(front.axle.x))) {
      crash("Missed the landing.");
      return;
    }

    var fx = 0;
    var fy = GRAVITY * gravityScale;
    var torque = 0;
    var grounded = false;
    var contacts = [rear, front];
    var i;
    for (i = 0; i < contacts.length; i++) {
      var c = contacts[i];
      if (c.force <= 0) continue;
      grounded = true;
      fx += c.g.nx * c.force;
      fy += c.g.ny * c.force;
      torque += c.rx * (c.g.ny * c.force) - c.ry * (c.g.nx * c.force);
    }

    if (rear.compression > 0.4 && !rear.g.steep) {
      var maxT = Math.max(220, MU * rear.load);
      var drive = -rear.vt * ROLL;
      if (gas) drive += THROTTLE * (1 - clamp(Math.max(rear.vt, 0) / MAX_SPEED, 0, 1));
      if (brake && Math.abs(rear.vt) > 4) drive += -Math.sign(rear.vt) * BRAKE_FORCE;
      if (!gas && !brake && Math.abs(rear.vt) < 18) drive += -rear.vt * 8;
      drive = clamp(drive, -maxT, maxT);
      fx += rear.g.tx * drive;
      fy += rear.g.ty * drive;
      bike.spin += (rear.vt / WHEEL_R) * dt;
    }
    if (front.compression > 0.4 && brake && Math.abs(front.vt) > 4 && !front.g.steep) {
      var maxFront = Math.max(220, MU * front.load);
      var frontDrive = clamp(-Math.sign(front.vt) * BRAKE_FORCE * 0.55, -maxFront, maxFront);
      fx += front.g.tx * frontDrive;
      fy += front.g.ty * frontDrive;
    }
    if (!grounded) {
      fx += -bike.vx * 0.15;
      fy += -bike.vy * 0.02;
    }

    torque += lean * (grounded ? GROUND_LEAN : AIR_LEAN) * INERTIA;
    if (gas && held("back") && rear.compression > 0.4) torque -= 1.5 * INERTIA;
    if (brake && held("fwd") && front.compression > 0.4) torque += 1.4 * INERTIA;

    bike.vx += fx * dt;
    bike.vy += fy * dt;
    bike.angVel += (torque / INERTIA) * dt;
    bike.angVel *= Math.exp((grounded ? -5.5 : -0.45) * dt);
    if (rear.compression > 0.8 && front.compression < 0.3 && lean === 0 && bike.angVel > 0) {
      bike.angVel *= Math.exp(-12 * dt);
    }
    var spinCap = grounded ? 2.6 : 3.8;
    bike.angVel = clamp(bike.angVel, -spinCap, spinCap);

    var tangent = rear.compression > 0 ? rear.g : front.compression > 0 ? front.g : { tx: 1, ty: 0 };
    var along = bike.vx * tangent.tx + bike.vy * tangent.ty;
    if (along > MAX_SPEED) {
      bike.vx -= tangent.tx * (along - MAX_SPEED);
      bike.vy -= tangent.ty * (along - MAX_SPEED);
    }
    if (along < -140) {
      bike.vx -= tangent.tx * (along + 140);
      bike.vy -= tangent.ty * (along + 140);
    }

    bike.x += bike.vx * dt;
    bike.y += bike.vy * dt;
    bike.angle = wrap(bike.angle + bike.angVel * dt);

    var axles = [REAR_X, FRONT_X];
    for (i = 0; i < axles.length; i++) {
      var mount = worldPoint(axles[i], MOUNT_Y);
      var downX = Math.sin(bike.angle);
      var downY = Math.cos(bike.angle);
      var axle = { x: mount.x + downX * REST, y: mount.y + downY * REST };
      var g = sample(axle.x);
      if (g.steep) continue;
      var pen = WHEEL_R - (axle.y - g.y) * g.ny;
      if (pen > 11) {
        var corr = (pen - 11) * 0.65;
        bike.x += g.nx * corr;
        bike.y += g.ny * corr;
        var vn = bike.vx * g.nx + bike.vy * g.ny;
        if (vn < 0) {
          bike.vx -= g.nx * vn;
          bike.vy -= g.ny * vn;
        }
      }
    }

    var head = worldPoint(-2, -30);
    var hg = sample(head.x);
    var headAbove = (head.y - hg.y) * hg.ny;
    if (!hg.steep && headAbove < 7) {
      crash("The rider hit the ground.");
      return;
    }
    var rel = Math.abs(wrap(bike.angle - trailSlope(bike.x)));
    if (grounded && rel > 1.7) {
      crash("Landed upside down.");
      return;
    }
    if (bike.y > BASE + 260) {
      crash("Fell off the trail.");
      return;
    }
    if (bike.x >= level.finish && grounded) finish();
    bike.on = grounded;
    if (gas && rear.compression > 0.4) spawnDust();
  }

  function formatTime(t) {
    if (t == null || !isFinite(t)) return "\u2014";
    var m = Math.floor(t / 60);
    var s = t - m * 60;
    var whole = Math.floor(s);
    var frac = Math.floor((s - whole) * 100 + 1e-4);
    if (frac >= 100) {
      frac = 0;
      whole += 1;
    }
    if (whole >= 60) {
      whole -= 60;
      m += 1;
    }
    return m + ":" + (whole < 10 ? "0" : "") + whole + "." + (frac < 10 ? "0" : "") + frac;
  }

  function saveBests() {
    try {
      localStorage.setItem(BEST_KEY, JSON.stringify(bests));
    } catch (error) {
      /* Private mode can block storage; the run still shows on screen. */
    }
  }

  function refreshHud() {
    if (trailEl) trailEl.textContent = String(levelIndex + 1);
    if (nameEl) nameEl.textContent = level.name;
    if (timeEl) timeEl.textContent = formatTime(time);
    if (bestEl) bestEl.textContent = formatTime(bests[level.name]);
  }

  function showOverlay(title, text, label, focus) {
    if (overlayTitle) overlayTitle.textContent = title;
    if (overlayText) overlayText.textContent = text;
    if (actionBtn) actionBtn.textContent = label;
    if (overlay) overlay.hidden = false;
    if (focus && actionBtn && actionBtn.focus) actionBtn.focus({ preventScroll: true });
  }

  function settle() {
    var g = sample(level.start);
    bike.angle = g.slope;
    bike.x = level.start;
    bike.vx = 0;
    bike.vy = 0;
    bike.angVel = 0;
    bike.spin = 0;
    bike.y = g.y - Math.cos(bike.angle) * REST - 8;
    var n;
    var saved = state;
    state = "settle";
    for (n = 0; n < 180; n++) physics(STEP);
    state = saved;
    bike.vx = 0;
    bike.vy = 0;
    bike.angVel = 0;
    bike.on = true;
  }

  function snapCamera() {
    cam.x = bike.x - 230;
    cam.y = clamp(bike.y - 255, -24, 80);
  }

  function beginRun() {
    level = LEVELS[levelIndex];
    settle();
    time = 0;
    accumulator = 0;
    particles.length = 0;
    state = "playing";
    snapCamera();
    if (overlay) overlay.hidden = true;
    refreshHud();
    if (live) live.textContent = "Riding " + level.name + ".";
    if (canvas && canvas.focus) canvas.focus({ preventScroll: true });
  }

  function primaryAction() {
    if (state === "cleared" && levelIndex < LEVELS.length - 1) levelIndex += 1;
    beginRun();
  }

  function crash(reason) {
    if (state !== "playing") return;
    state = "crashed";
    waitRelease = !!anyHeld();
    var text = reason + " " + level.name + " \u00b7 " + formatTime(time) + ".";
    showOverlay("Crashed", text, "Ride again", true);
    if (live) live.textContent = "Crashed on " + level.name + " at " + formatTime(time) + ".";
    refreshHud();
  }

  function finish() {
    if (state !== "playing") return;
    state = "cleared";
    var prev = bests[level.name];
    var isBest = prev == null || time < prev;
    if (isBest) {
      bests[level.name] = time;
      saveBests();
    }
    refreshHud();
    var done = levelIndex >= LEVELS.length - 1;
    var detail = level.name + " in " + formatTime(time) + ".";
    if (isBest && prev != null) detail += " New best.";
    else if (prev != null) detail += " Best " + formatTime(prev) + ".";
    if (done) detail += " All three trails are clear.";
    showOverlay(done ? "All clear" : "Clear", detail, done ? "Ride again" : "Next trail", true);
    if (live) live.textContent = detail;
  }

  function spawnDust() {
    if (reducedMotion) return;
    if (Math.random() > 0.45) return;
    var p = worldPoint(REAR_X - 8, REST);
    particles.push({
      x: p.x - 6,
      y: p.y,
      vx: -30 - Math.random() * 50,
      vy: -10 - Math.random() * 40,
      life: 0.28 + Math.random() * 0.18
    });
    if (particles.length > 28) particles.splice(0, particles.length - 28);
  }

  function updateDust(dt) {
    var i;
    for (i = particles.length - 1; i >= 0; i--) {
      var p = particles[i];
      p.life -= dt;
      if (p.life <= 0) {
        particles.splice(i, 1);
        continue;
      }
      p.vy += 280 * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }
  }

  function update(dt) {
    refreshWait();
    if (state === "playing") {
      time += dt;
      accumulator += dt;
      if (accumulator > 0.05) accumulator = 0.05;
      var steps = 0;
      while (accumulator >= STEP && state === "playing" && steps < 8) {
        physics(STEP);
        accumulator -= STEP;
        steps += 1;
      }
      refreshHud();
    } else {
      accumulator = 0;
    }
    updateDust(dt);
    var look = clamp(bike.vx * 0.12, -20, 90);
    var targetX = bike.x - 220 + look;
    var targetY = clamp(bike.y - H * 0.52, -H, H);
    if (state === "ready") {
      cam.x = targetX;
      cam.y = targetY;
    } else {
      var k = 1 - Math.exp(-8 * dt);
      cam.x += (targetX - cam.x) * k;
      cam.y += (targetY - cam.y) * k;
    }
  }

  function sx(x) {
    return x - cam.x;
  }

  function sy(y) {
    return y - cam.y;
  }

  function drawSky(palette) {
    var sky = ctx.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, palette.skyTop);
    sky.addColorStop(1, palette.sky);
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, H);
  }

  function drawHills(palette, color, parallax, base, amp) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(0, H + 20);
    var x;
    for (x = 0; x <= W; x += 18) {
      var wx = cam.x * parallax + x;
      var y = base + Math.sin(wx * 0.0042) * amp + Math.sin(wx * 0.0016 + 1.1) * amp * 0.45;
      ctx.lineTo(x, y - cam.y * parallax * 0.3);
    }
    ctx.lineTo(W, H + 20);
    ctx.closePath();
    ctx.fill();
  }

  function drawTerrain(palette) {
    var start = Math.floor(cam.x - 30);
    var end = Math.ceil(cam.x + W + 30);
    var x;
    ctx.fillStyle = palette.dirt;
    ctx.beginPath();
    ctx.moveTo(sx(start), H + 40);
    for (x = start; x <= end; x += 8) ctx.lineTo(sx(x), sy(terrainY(x)));
    ctx.lineTo(sx(end), H + 40);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = palette.grass;
    ctx.lineWidth = 3;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.beginPath();
    for (x = start; x <= end; x += 8) {
      var py = sy(terrainY(x));
      if (x === start) ctx.moveTo(sx(x), py);
      else ctx.lineTo(sx(x), py);
    }
    ctx.stroke();
  }

  function drawTrees(palette) {
    var trees = level.trees || [];
    var i;
    for (i = 0; i < trees.length; i++) {
      var x = trees[i];
      if (x < cam.x - 50 || x > cam.x + W + 50) continue;
      var y = terrainY(x);
      ctx.fillStyle = palette.dirtDeep;
      ctx.fillRect(sx(x) - 2, sy(y - 30), 4, 30);
      ctx.fillStyle = palette.accent;
      ctx.beginPath();
      ctx.arc(sx(x), sy(y - 40), 14, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawLogs(palette) {
    var logs = level.logs || [];
    var i;
    for (i = 0; i < logs.length; i++) {
      var x = logs[i];
      if (x < cam.x - 40 || x > cam.x + W + 40) continue;
      var y = terrainY(x);
      ctx.fillStyle = palette.dirtDeep;
      ctx.beginPath();
      ctx.ellipse(sx(x), sy(y - 3), 16, 7, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawMarker(x, label, palette) {
    if (x < cam.x - 80 || x > cam.x + W + 80) return;
    var y = terrainY(x);
    ctx.strokeStyle = palette.ink;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(sx(x), sy(y));
    ctx.lineTo(sx(x), sy(y) - 64);
    ctx.stroke();
    ctx.fillStyle = palette.accent;
    ctx.beginPath();
    ctx.moveTo(sx(x), sy(y) - 64);
    ctx.lineTo(sx(x) + 42, sy(y) - 54);
    ctx.lineTo(sx(x), sy(y) - 44);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = palette.ink;
    ctx.font = "600 14px Fraunces, Georgia, serif";
    ctx.textAlign = "center";
    ctx.fillText(label, sx(x), sy(y) - 74);
  }

  function wheelPoint(lx, compression) {
    var travel = clamp(compression, 0, 12);
    var mount = worldPoint(lx, MOUNT_Y);
    var downX = Math.sin(bike.angle);
    var downY = Math.cos(bike.angle);
    var len = Math.max(6, REST - travel);
    return {
      x: mount.x + downX * len,
      y: mount.y + downY * len
    };
  }

  function drawWheel(p, palette) {
    ctx.save();
    ctx.translate(sx(p.x), sy(p.y));
    ctx.rotate(bike.spin);
    ctx.fillStyle = palette.tire;
    ctx.beginPath();
    ctx.arc(0, 0, WHEEL_R, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = palette.tireEdge;
    ctx.lineWidth = 1.6;
    ctx.stroke();
    ctx.strokeStyle = palette.hub;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-6, 0);
    ctx.lineTo(6, 0);
    ctx.stroke();
    ctx.fillStyle = palette.hub;
    ctx.beginPath();
    ctx.arc(0, 0, 3.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawBike(palette) {
    var lean = held("back") ? -1 : held("fwd") ? 1 : 0;
    var rear = wheelPoint(REAR_X, bike.rearC);
    var front = wheelPoint(FRONT_X, bike.frontC);
    drawWheel(rear, palette);
    drawWheel(front, palette);

    var seat = worldPoint(-8, -6);
    var bars = worldPoint(22, -14);
    var peg = worldPoint(2, 4);
    var hip = worldPoint(-4 - lean * 3, -13);
    var shoulder = worldPoint(-6 - lean * 5, -24);
    var head = worldPoint(-4 - lean * 4, -31);

    ctx.strokeStyle = palette.frame;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(sx(rear.x), sy(rear.y));
    ctx.lineTo(sx(seat.x), sy(seat.y));
    ctx.lineTo(sx(bars.x), sy(bars.y));
    ctx.lineTo(sx(front.x), sy(front.y));
    ctx.moveTo(sx(peg.x), sy(peg.y));
    ctx.lineTo(sx(seat.x), sy(seat.y));
    ctx.stroke();

    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(sx(peg.x), sy(peg.y));
    ctx.lineTo(sx(hip.x), sy(hip.y));
    ctx.lineTo(sx(shoulder.x), sy(shoulder.y));
    ctx.moveTo(sx(shoulder.x), sy(shoulder.y));
    ctx.lineTo(sx(bars.x), sy(bars.y));
    ctx.stroke();

    ctx.fillStyle = palette.accent;
    ctx.beginPath();
    ctx.arc(sx(head.x), sy(head.y), 6.5, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawDust(palette) {
    var i;
    ctx.fillStyle = palette.dust;
    for (i = 0; i < particles.length; i++) {
      var p = particles[i];
      ctx.globalAlpha = clamp(p.life * 2.2, 0, 0.65);
      ctx.fillRect(sx(p.x), sy(p.y), 3, 3);
    }
    ctx.globalAlpha = 1;
  }

  function drawProgress(palette) {
    var span = level.finish - level.start;
    var p = span > 0 ? clamp((bike.x - level.start) / span, 0, 1) : 0;
    var x0 = 28;
    var y = 20;
    var w = W - 56;
    ctx.globalAlpha = 0.28;
    ctx.strokeStyle = palette.ink;
    ctx.lineWidth = 2;
    ctx.strokeRect(x0, y, w, 7);
    ctx.globalAlpha = 1;
    ctx.fillStyle = palette.accent;
    ctx.fillRect(x0, y, Math.max(0, w * p), 7);
  }

  function draw() {
    var palette = colors();
    drawSky(palette);
    drawHills(palette, palette.hillFar, 0.22, H * 0.62, 28);
    drawHills(palette, palette.hillNear, 0.48, H * 0.74, 18);
    drawTerrain(palette);
    drawTrees(palette);
    drawLogs(palette);
    drawMarker(70, "Start", palette);
    drawMarker(level.finish, "Finish", palette);
    drawDust(palette);
    drawBike(palette);
    drawProgress(palette);
  }

  function frame(ts) {
    if (!last) last = ts;
    var dt = Math.min(0.034, (ts - last) / 1000);
    last = ts;
    if (document.hidden) {
      raf = requestAnimationFrame(frame);
      return;
    }
    update(dt);
    draw();
    raf = requestAnimationFrame(frame);
  }

  function resize() {
    var cssW = stage.clientWidth;
    var cssH = stage.clientHeight;
    if (cssW < 2 || cssH < 2) return;
    var dpr = Math.min(window.devicePixelRatio || 1, 3);
    W = 800;
    H = W * (cssH / cssW);
    canvas.width = Math.max(1, Math.round(cssW * dpr));
    canvas.height = Math.max(1, Math.round(cssH * dpr));
    ctx.setTransform(canvas.width / W, 0, 0, canvas.height / H, 0, 0);
  }

  function isControlTarget(event) {
    var target = event.target;
    return !!(target && target.closest && target.closest("a, button, input, textarea, select"));
  }

  function preventPlayGesture(event) {
    if (isControlTarget(event)) return;
    if (event.cancelable) event.preventDefault();
  }

  function releaseInputs() {
    keys.gas = false;
    keys.brake = false;
    keys.back = false;
    keys.fwd = false;
    touches.gas = false;
    touches.brake = false;
    touches.back = false;
    touches.fwd = false;
    waitRelease = false;
    if (!pad) return;
    var heldButtons = pad.querySelectorAll(".is-held");
    var i;
    for (i = 0; i < heldButtons.length; i++) {
      heldButtons[i].classList.remove("is-held");
      heldButtons[i].setAttribute("aria-pressed", "false");
    }
  }

  function bindHold(button) {
    var act = button.getAttribute("data-act");
    function press(event) {
      if (event.pointerType === "mouse" && event.button !== 0) return;
      if (event.cancelable) event.preventDefault();
      touches[act] = true;
      button.classList.add("is-held");
      button.setAttribute("aria-pressed", "true");
      if (button.setPointerCapture) button.setPointerCapture(event.pointerId);
      if (state !== "playing") primaryAction();
    }
    function release(event) {
      if (event && event.cancelable) event.preventDefault();
      touches[act] = false;
      button.classList.remove("is-held");
      button.setAttribute("aria-pressed", "false");
      refreshWait();
    }
    button.addEventListener("pointerdown", press, { passive: false });
    button.addEventListener("pointerup", release);
    button.addEventListener("pointercancel", release);
  }

  var ACT_BY_CODE = {
    ArrowRight: "gas",
    ArrowLeft: "brake",
    ArrowUp: "back",
    ArrowDown: "fwd",
    KeyD: "gas",
    KeyA: "brake",
    KeyW: "back",
    KeyS: "fwd"
  };

  function blockedTyping() {
    var el = document.activeElement;
    if (!el) return false;
    var tag = el.tagName;
    return tag === "A" || tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
  }

  function onKeyDown(event) {
    var act = ACT_BY_CODE[event.code];
    var startKey = event.code === "Space" || event.code === "Enter";
    if (!act && !startKey) return;
    if (blockedTyping()) return;
    var el = document.activeElement;
    var tag = el ? el.tagName : "";
    if (tag === "BUTTON" && el.id === "dirt-action" && state !== "playing" && startKey && !act) return;
    if (tag === "BUTTON" && el.id !== "dirt-action" && !(el.classList && el.classList.contains("ride-key")) && !act) return;

    if (act) {
      event.preventDefault();
      keys[act] = true;
      if (event.repeat) return;
      if (state !== "playing") primaryAction();
      return;
    }

    if (state === "playing") {
      event.preventDefault();
      return;
    }
    event.preventDefault();
    if (!event.repeat) primaryAction();
  }

  function onKeyUp(event) {
    var act = ACT_BY_CODE[event.code];
    if (!act) return;
    keys[act] = false;
    refreshWait();
  }

  stage.addEventListener("pointerdown", function (event) {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    preventPlayGesture(event);
    if (isControlTarget(event)) return;
    if (canvas.focus) canvas.focus({ preventScroll: true });
    if (state !== "playing") primaryAction();
  }, { passive: false });

  stage.addEventListener("touchstart", preventPlayGesture, { passive: false });
  stage.addEventListener("touchmove", preventPlayGesture, { passive: false });
  canvas.addEventListener("touchstart", preventPlayGesture, { passive: false });
  canvas.addEventListener("touchmove", preventPlayGesture, { passive: false });

  if (pad) {
    pad.addEventListener("touchstart", function (event) {
      if (event.cancelable) event.preventDefault();
    }, { passive: false });
    pad.addEventListener("touchmove", function (event) {
      if (event.cancelable) event.preventDefault();
    }, { passive: false });
    pad.addEventListener("contextmenu", function (event) {
      event.preventDefault();
    });
    var buttons = pad.querySelectorAll("[data-act]");
    var b;
    for (b = 0; b < buttons.length; b++) bindHold(buttons[b]);
  }

  if (actionBtn) actionBtn.addEventListener("click", primaryAction);

  function onGravityInput() {
    if (!gravityInput) return;
    applyGravity(gravityInput.value, true, false);
  }

  function leaveSliderAlone(event) {
    event.stopPropagation();
  }

  if (gravityInput) {
    gravityInput.addEventListener("input", onGravityInput);
    gravityInput.addEventListener("change", onGravityInput);
    gravityInput.addEventListener("pointerdown", leaveSliderAlone);
    gravityInput.addEventListener("pointermove", leaveSliderAlone);
    gravityInput.addEventListener("touchstart", leaveSliderAlone, { passive: true });
    gravityInput.addEventListener("touchmove", leaveSliderAlone, { passive: true });
  }
  applyGravity(readGravity(), false, true);

  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);
  window.addEventListener("blur", releaseInputs);
  document.addEventListener("visibilitychange", function () {
    releaseInputs();
    last = 0;
  });

  stage.addEventListener("contextmenu", function (event) {
    event.preventDefault();
  });

  window.addEventListener("resize", resize);
  if (window.visualViewport) window.visualViewport.addEventListener("resize", resize);
  if (window.ResizeObserver) new ResizeObserver(resize).observe(stage);

  level = LEVELS[0];
  settle();
  snapCamera();
  refreshHud();
  showOverlay(
    "Ready",
    "Three trails. Gas on the climbs, and lean so both wheels meet the ground.",
    "Ride",
    false
  );
  resize();
  draw();
  raf = requestAnimationFrame(frame);
})();
