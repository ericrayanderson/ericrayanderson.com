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
  if (!canvas || !canvas.getContext || !stage) return;

  var ctx = canvas.getContext("2d", { alpha: false });
  var W = 800;
  var H = 500;
  var BEST_KEY = "dirt-trail-bests";
  var BASE = 408;
  var GRAVITY = 1680;
  var WHEEL_R = 16;
  var REAR = { x: -40, y: 18 };
  var FRONT = { x: 44, y: 18 };
  var HEAD = { x: 6, y: -28 };
  var STEP = 1 / 90;
  var reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  var LEVELS = [
    {
      name: "Pasture",
      start: 170,
      finish: 3720,
      points: [
        [0, 92],
        [340, 92],
        [560, 155],
        [780, 78],
        [1020, 178],
        [1240, 96],
        [1400, 96],
        [1760, 236],
        [1960, 64],
        [2180, 148],
        [2380, 86],
        [2600, 132],
        [2820, 84],
        [3040, 150],
        [3260, 88],
        [3480, 96],
        [3920, 96]
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
        [0, 100],
        [260, 100],
        [480, 196],
        [680, 72],
        [900, 78],
        [1120, 86],
        [1540, 248],
        [1760, 48],
        [1980, 176],
        [2160, 78],
        [2380, 150],
        [2580, 96],
        [2780, 142],
        [2980, 88],
        [3360, 300],
        [3560, 78],
        [3880, 68],
        [4100, 140],
        [4300, 82],
        [4520, 110],
        [5100, 100]
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
        [0, 100],
        [300, 100],
        [500, 158],
        [700, 86],
        [920, 168],
        [1120, 96],
        [1320, 104],
        [1700, 236],
        [1900, 52],
        [2100, 140],
        [2300, 78],
        [2480, 148],
        [2660, 82],
        [2840, 150],
        [3040, 86],
        [3160, 86],
        [3560, 320],
        [3760, 78],
        [4080, 70],
        [4300, 150],
        [4500, 78],
        [4680, 80],
        [4920, 108],
        [5180, 90],
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
  var rearOn = false;
  var frontOn = false;
  var wasOnGround = true;
  var keys = { gas: false, brake: false, back: false, fwd: false };
  var touches = { gas: false, brake: false, back: false, fwd: false };
  var bike = { x: 170, y: 280, vx: 0, vy: 0, angle: 0, angVel: 0, spin: 0 };

  try {
    bests = JSON.parse(localStorage.getItem(BEST_KEY) || "{}") || {};
  } catch (error) {
    bests = {};
  }

  function colors() {
    var dark = document.documentElement.getAttribute("data-theme") === "dark";
    if (dark) {
      return {
        sky: "#12110f",
        haze: "#1e1c19",
        dirt: "#4a4036",
        dirtDeep: "#2a241e",
        grass: "#b7d7c6",
        ink: "#f3efe6",
        frame: "#f3efe6",
        tire: "#0c0b0a",
        hub: "#d5c4a1",
        accent: "#b7d7c6",
        dust: "#6b5c4c"
      };
    }
    return {
      sky: "#f4f0e7",
      haze: "#e4dccf",
      dirt: "#6e5846",
      dirtDeep: "#3e3228",
      grass: "#1c5c43",
      ink: "#1b1814",
      frame: "#1b1814",
      tire: "#1b1814",
      hub: "#f4f0e7",
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

  function interp(points, x) {
    if (x <= points[0][0]) return points[0][1];
    var last = points[points.length - 1];
    if (x >= last[0]) return last[1];
    var lo = 0;
    var hi = points.length - 1;
    while (hi - lo > 1) {
      var mid = (lo + hi) >> 1;
      if (points[mid][0] < x) lo = mid;
      else hi = mid;
    }
    var p0 = points[lo];
    var p1 = points[hi];
    var t = (x - p0[0]) / (p1[0] - p0[0]);
    return lerp(p0[1], p1[1], t);
  }

  function heightAt(x) {
    var gaps = level.gaps || [];
    var i;
    var h;
    for (i = 0; i < gaps.length; i++) {
      if (x > gaps[i].from && x < gaps[i].to) {
        h = gaps[i].floor;
        return h + logBump(x);
      }
    }
    h = interp(level.points, x);
    return h + logBump(x);
  }

  function logBump(x) {
    var logs = level.logs || [];
    var extra = 0;
    var i;
    for (i = 0; i < logs.length; i++) {
      var d = x - logs[i];
      if (d < -18 || d > 18) continue;
      extra += Math.cos((d / 18) * Math.PI * 0.5) * 16;
    }
    return extra;
  }

  function terrainY(x) {
    return BASE - heightAt(x);
  }

  function terrainSample(x) {
    var y = terrainY(x);
    var yL = terrainY(x - 12);
    var yR = terrainY(x + 12);
    var leftDrop = yL - y;
    var rightDrop = yR - y;
    var slope;
    if (rightDrop > 26 && leftDrop < 20) slope = (y - yL) / 12;
    else if (leftDrop > 26 && rightDrop < 20) slope = (yR - y) / 12;
    else if (leftDrop > 26 && rightDrop > 26) slope = 0;
    else slope = (yR - yL) / 24;
    var len = Math.hypot(1, slope) || 1;
    var tx = 1 / len;
    var ty = slope / len;
    return {
      y: y,
      tx: tx,
      ty: ty,
      nx: ty,
      ny: -tx,
      slope: Math.atan2(ty, tx)
    };
  }

  function fatalAt(x) {
    var gaps = level.gaps || [];
    var i;
    for (i = 0; i < gaps.length; i++) {
      if (gaps[i].fatal && x > gaps[i].from && x < gaps[i].to) return true;
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

  function wheelInfo(lx, ly) {
    var p = worldPoint(lx, ly);
    var g = terrainSample(p.x);
    var above = (p.y - g.y) * g.ny;
    return { p: p, g: g, above: above, pen: WHEEL_R - above, lx: lx, ly: ly };
  }

  function tooSteep(g) {
    return Math.abs(g.nx) > 0.92;
  }

  function resolveWheel(lx, ly) {
    var info = wheelInfo(lx, ly);
    if (info.pen <= 0 || tooSteep(info.g)) return;
    var pen = info.pen > 32 ? 32 : info.pen;
    var g = info.g;
    var shift = pen * 0.52;
    bike.x += g.nx * shift;
    bike.y += g.ny * shift;
    var c = Math.cos(bike.angle);
    var s = Math.sin(bike.angle);
    var dwx = -lx * s - ly * c;
    var dwy = lx * c - ly * s;
    var dAbove = dwx * g.nx + dwy * g.ny;
    if (Math.abs(dAbove) > 8) {
      var dAng = (pen * 0.42) / dAbove;
      if (dAng > 0.045) dAng = 0.045;
      if (dAng < -0.045) dAng = -0.045;
      bike.angle += dAng;
    }
  }

  function mixGround(a, b) {
    var tx = a.tx + b.tx;
    var ty = a.ty + b.ty;
    var tl = Math.hypot(tx, ty) || 1;
    tx /= tl;
    ty /= tl;
    return { tx: tx, ty: ty, nx: ty, ny: -tx, slope: Math.atan2(ty, tx) };
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

  function place(x) {
    bike.x = x;
    bike.vx = 0;
    bike.vy = 0;
    bike.angVel = 0;
    bike.spin = 0;
    var ahead = terrainSample(x + 70);
    var here = terrainSample(x - 10);
    bike.angle = Math.atan2(ahead.y - here.y, 80);
    var offset = REAR.x * Math.sin(bike.angle) + REAR.y * Math.cos(bike.angle);
    var g = terrainSample(x + REAR.x);
    bike.y = g.y - offset + WHEEL_R / (g.ny || -1);
    var n;
    for (n = 0; n < 12; n++) {
      resolveWheel(REAR.x, REAR.y);
      resolveWheel(FRONT.x, FRONT.y);
    }
    var guard = 0;
    while (guard < 8) {
      var head = worldPoint(HEAD.x, HEAD.y);
      var hg = terrainSample(head.x);
      var above = (head.y - hg.y) * hg.ny;
      if (above > 14) break;
      bike.y += hg.ny * (16 - above);
      guard += 1;
    }
    bike.vx = 0;
    bike.vy = 0;
    bike.angVel = 0;
    wasOnGround = true;
  }

  function snapCamera() {
    cam.x = bike.x - 230;
    cam.y = clamp(bike.y - 255, -24, 80);
  }

  function beginRun() {
    level = LEVELS[levelIndex];
    place(level.start);
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
    var last = levelIndex >= LEVELS.length - 1;
    var detail = level.name + " in " + formatTime(time) + ".";
    if (isBest && prev != null) detail += " New best.";
    else if (prev != null) detail += " Best " + formatTime(prev) + ".";
    if (last) detail += " All three trails are clear.";
    showOverlay(last ? "All clear" : "Clear", detail, last ? "Ride again" : "Next trail", true);
    if (live) live.textContent = detail;
  }

  function spawnDust() {
    if (reducedMotion) return;
    if (Math.random() > 0.45) return;
    var p = worldPoint(REAR.x - 4, REAR.y + 6);
    particles.push({
      x: p.x - 6,
      y: p.y,
      vx: -30 - Math.random() * 50,
      vy: -10 - Math.random() * 40,
      life: 0.28 + Math.random() * 0.18
    });
    if (particles.length > 40) particles.splice(0, particles.length - 40);
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

  function physics(dt) {
    var gas = held("gas");
    var brake = held("brake");
    var back = held("back");
    var fwd = held("fwd");
    if (gas && brake) gas = false;

    bike.vy += GRAVITY * dt;
    bike.x += bike.vx * dt;
    bike.y += bike.vy * dt;
    bike.angle += bike.angVel * dt;
    var incoming = bike.angle;

    var n;
    for (n = 0; n < 5; n++) {
      resolveWheel(REAR.x, REAR.y);
      resolveWheel(FRONT.x, FRONT.y);
    }

    var rear = wheelInfo(REAR.x, REAR.y);
    var front = wheelInfo(FRONT.x, FRONT.y);
    var rearG = rear.pen > -1.25 && !tooSteep(rear.g);
    var frontG = front.pen > -1.25 && !tooSteep(front.g);
    rearOn = rearG;
    frontOn = frontG;

    if ((rearG && fatalAt(rear.p.x)) || (frontG && fatalAt(front.p.x))) {
      crash("Missed the landing.");
      return;
    }

    var grounded = rearG || frontG;
    var gnd = null;
    if (rearG && frontG) gnd = mixGround(rear.g, front.g);
    else if (rearG) gnd = rear.g;
    else if (frontG) gnd = front.g;

    if (gnd) {
      var vt = bike.vx * gnd.tx + bike.vy * gnd.ty;
      var vn = bike.vx * gnd.nx + bike.vy * gnd.ny;
      var impact = vn < 0 ? -vn : 0;
      if (vn < 0) vn = 0;
      if (gas && rearG) vt += 1380 * dt;
      else if (!brake) vt *= Math.exp(-0.55 * dt);
      if (brake) {
        var sign = vt > 2 ? 1 : vt < -2 ? -1 : 0;
        vt -= sign * 1500 * dt;
        if (sign > 0 && vt < 0) vt = 0;
        if (sign < 0 && vt > 0) vt = 0;
      }
      if (vt > 520) vt = 520;
      if (vt < -80) vt = -80;
      bike.vx = gnd.tx * vt + gnd.nx * vn;
      bike.vy = gnd.ty * vt + gnd.ny * vn;

      var rel = Math.abs(wrap(bike.angle - gnd.slope));
      var relIn = Math.abs(wrap(incoming - gnd.slope));
      if (!wasOnGround && impact > 340 && relIn > 0.5) {
        crash("That landing was too steep.");
        return;
      }
      if (rel > 1.18) {
        crash("The bike tipped over.");
        return;
      }
    } else {
      bike.vx *= Math.exp(-0.06 * dt);
    }

    var lean = (fwd ? 1 : 0) - (back ? 1 : 0);
    bike.angVel += lean * (grounded ? 4.2 : 6.4) * dt;
    if (gas && rearG && lean === 0) bike.angVel -= 0.85 * dt;
    if (brake && grounded && lean === 0) bike.angVel += 1.15 * dt;

    if (grounded && gnd) {
      var diff = wrap(gnd.slope - bike.angle);
      var gain = lean === 0 ? 15 : 3.2;
      bike.angVel += diff * gain * dt;
      bike.angVel *= Math.exp((lean === 0 ? -6.5 : -2.2) * dt);
    } else {
      bike.angVel *= Math.exp(-0.22 * dt);
    }

    if (bike.angVel > 5.2) bike.angVel = 5.2;
    if (bike.angVel < -5.2) bike.angVel = -5.2;
    bike.angle = wrap(bike.angle);
    if (rearG) bike.spin += (bike.vx / WHEEL_R) * dt;

    var head = worldPoint(HEAD.x, HEAD.y);
    var hg = terrainSample(head.x);
    var headAbove = (head.y - hg.y) * hg.ny;
    if (headAbove < 7.5) {
      crash("The rider hit the ground.");
      return;
    }

    if (bike.y > BASE + 180) {
      crash("Fell off the trail.");
      return;
    }

    wasOnGround = grounded;
    if (bike.x >= level.finish) finish();
    else if (gas && rearG) spawnDust();
  }

  function update(dt) {
    refreshWait();
    if (state === "playing") {
      time += dt;
      accumulator += dt;
      if (accumulator > 0.05) accumulator = 0.05;
      while (accumulator >= STEP && state === "playing") {
        physics(STEP);
        accumulator -= STEP;
      }
      refreshHud();
    } else {
      accumulator = 0;
    }
    updateDust(dt);
    var look = clamp(bike.vx * 0.12, -20, 90);
    var targetX = bike.x - 220 + look;
    var targetY = clamp(bike.y - 255, -24, 80);
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

  function drawFar(palette) {
    ctx.fillStyle = palette.haze;
    ctx.beginPath();
    ctx.moveTo(0, H);
    var x;
    for (x = 0; x <= W; x += 12) {
      var wx = cam.x * 0.28 + x;
      var y = 268 + Math.sin(wx * 0.0075) * 24 + Math.sin(wx * 0.0028 + 0.7) * 16;
      ctx.lineTo(x, y - cam.y * 0.2);
    }
    ctx.lineTo(W, H);
    ctx.closePath();
    ctx.fill();
  }

  function drawTerrain(palette) {
    var start = Math.floor(cam.x - 24);
    var end = Math.ceil(cam.x + W + 24);
    var x;
    ctx.fillStyle = palette.dirt;
    ctx.beginPath();
    ctx.moveTo(sx(start), H + 30);
    for (x = start; x <= end; x += 8) ctx.lineTo(sx(x), sy(terrainY(x)));
    ctx.lineTo(sx(end), H + 30);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = palette.grass;
    ctx.lineWidth = 3;
    ctx.lineJoin = "round";
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
      if (x < cam.x - 40 || x > cam.x + W + 40) continue;
      var y = terrainY(x);
      ctx.fillStyle = palette.dirtDeep;
      ctx.fillRect(sx(x) - 2, sy(y - 34), 4, 34);
      ctx.fillStyle = palette.accent;
      ctx.beginPath();
      ctx.arc(sx(x), sy(y - 46), 16, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = palette.ink;
      ctx.globalAlpha = 0.18;
      ctx.beginPath();
      ctx.arc(sx(x) - 5, sy(y - 50), 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
  }

  function drawLogs(palette) {
    var logs = level.logs || [];
    var i;
    for (i = 0; i < logs.length; i++) {
      var x = logs[i];
      if (x < cam.x - 30 || x > cam.x + W + 30) continue;
      var y = terrainY(x);
      ctx.fillStyle = palette.dirtDeep;
      ctx.beginPath();
      ctx.arc(sx(x), sy(y + 2), 11, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = palette.ink;
      ctx.globalAlpha = 0.35;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(sx(x), sy(y + 2), 7, 0.4, 2.2);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
  }

  function drawMarker(x, label, palette) {
    if (x < cam.x - 80 || x > cam.x + W + 80) return;
    var y = terrainY(x);
    ctx.strokeStyle = palette.ink;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(sx(x), sy(y));
    ctx.lineTo(sx(x), sy(y) - 72);
    ctx.stroke();
    ctx.fillStyle = palette.accent;
    ctx.beginPath();
    ctx.moveTo(sx(x), sy(y) - 72);
    ctx.lineTo(sx(x) + 46, sy(y) - 60);
    ctx.lineTo(sx(x), sy(y) - 48);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = palette.ink;
    ctx.font = "600 14px Fraunces, Georgia, serif";
    ctx.textAlign = "center";
    ctx.fillText(label, sx(x), sy(y) - 82);
  }

  function drawWheel(x, y, palette) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(bike.spin);
    ctx.fillStyle = palette.tire;
    ctx.beginPath();
    ctx.arc(0, 0, WHEEL_R, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = palette.hub;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, WHEEL_R - 5, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    var s;
    for (s = 0; s < 4; s++) {
      var a = (s * Math.PI) / 2;
      ctx.moveTo(Math.cos(a) * 3, Math.sin(a) * 3);
      ctx.lineTo(Math.cos(a) * (WHEEL_R - 6), Math.sin(a) * (WHEEL_R - 6));
    }
    ctx.stroke();
    ctx.fillStyle = palette.hub;
    ctx.beginPath();
    ctx.arc(0, 0, 2.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawBike(palette) {
    var lean = held("back") ? -8 : held("fwd") ? 7 : 0;
    ctx.save();
    ctx.translate(sx(bike.x), sy(bike.y));
    ctx.rotate(bike.angle);
    drawWheel(REAR.x, REAR.y, palette);
    drawWheel(FRONT.x, FRONT.y, palette);

    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = palette.frame;
    ctx.fillStyle = palette.frame;
    ctx.lineWidth = 3.5;

    ctx.beginPath();
    ctx.moveTo(-8, 6);
    ctx.lineTo(REAR.x + 5, REAR.y - 1);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(-14, 5);
    ctx.lineTo(-6, -8);
    ctx.lineTo(22, -6);
    ctx.lineTo(12, 8);
    ctx.closePath();
    ctx.stroke();

    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(-20, 0);
    ctx.quadraticCurveTo(-2, -13, 10, -8);
    ctx.stroke();

    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(18, -8);
    ctx.lineTo(FRONT.x - 2, FRONT.y - 2);
    ctx.moveTo(24, -4);
    ctx.lineTo(FRONT.x + 6, FRONT.y - 1);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(16, -8);
    ctx.lineTo(14, -21);
    ctx.lineTo(30, -18);
    ctx.stroke();

    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.moveTo(-1, -1);
    ctx.lineTo(16, 11);
    ctx.lineTo(28, 5);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(-1, -1);
    ctx.lineTo(5 + lean, -20);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(4 + lean * 0.55, -15);
    ctx.lineTo(22, -19);
    ctx.stroke();

    ctx.fillStyle = palette.accent;
    ctx.beginPath();
    ctx.arc(7 + lean, -28, 7.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = palette.sky;
    ctx.beginPath();
    ctx.arc(10 + lean, -27.5, 2.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawDust(palette) {
    var i;
    ctx.fillStyle = palette.dust;
    for (i = 0; i < particles.length; i++) {
      var p = particles[i];
      ctx.globalAlpha = clamp(p.life * 2.2, 0, 0.7);
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
    ctx.fillStyle = palette.sky;
    ctx.fillRect(0, 0, W, H);
    drawFar(palette);
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
    var parent = stage.parentElement;
    var avail = parent ? parent.clientWidth : 800;
    var width = Math.min(avail, 800);
    var height = Math.round(width * (H / W));
    var maxH = Math.max(220, Math.min(window.innerHeight * 0.62, 520));
    if (height > maxH) {
      height = Math.round(maxH);
      width = Math.round(height * (W / H));
    }
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.style.width = width + "px";
    canvas.style.height = height + "px";
    stage.style.width = width + "px";
    if (pad) pad.style.width = width + "px";
    canvas.width = Math.max(1, Math.round(width * dpr));
    canvas.height = Math.max(1, Math.round(height * dpr));
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

  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);
  window.addEventListener("blur", releaseInputs);
  document.addEventListener("visibilitychange", function () {
    releaseInputs();
    last = 0;
  });

  window.addEventListener("resize", resize);
  if (window.ResizeObserver) new ResizeObserver(resize).observe(stage);

  level = LEVELS[0];
  place(level.start);
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
