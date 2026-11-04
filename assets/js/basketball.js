(function () {
  var canvas = document.getElementById("hoop-canvas");
  var stage = document.getElementById("hoop-stage");
  if (!canvas || !canvas.getContext || !stage) return;
  var ctx = canvas.getContext("2d");
  var madeEl = document.getElementById("hoop-made");
  var shotEl = document.getElementById("hoop-shot");
  var bestEl = document.getElementById("hoop-best");
  var live = document.getElementById("hoop-live");

  var W = 0, H = 0, S = 1;
  var ANGLE = 58 * Math.PI / 180, minDeg = 35, maxDeg = 70, defDeg = 55, userDeg = null, spread = 0.38, center = 0.55, dragY = 0, dragDeg = 55;
  var wob = { y: 0, v: 0 };
  var net = [];
  var decidedAt = 0, made = 0, shots = 0, best = 0, totalMade = 0, ROUND = 10, roundEndAt = 0, rimTouch = 0;
  var hoopN = { x: 0.74, y: 0.36 };
  var ballStart = { nx: 0.2, ny: 0.84 };
  var ball = { x: 0, y: 0, vx: 0, vy: 0, r: 10 };
  var state = "ready"; // ready, holding, flying, done
  var holdStart = 0, power = 0, vMin = 0, vMax = 0;
  var flightTime = 0, scored = false, lastMsg = "", msgUntil = 0;
  window.__hoops = { get made() { return totalMade; }, get roundMade() { return made; }, get shots() { return shots; }, get best() { return best; }, get mode() { return state; }, place: function (b, h) { ballStart = b; hoopN = h; resetBall(); }, debugBall: function (x, y, vx, vy) { decidedAt = 0; rimTouch = 0; ball.x = x; ball.y = y; ball.vx = vx; ball.vy = vy; state = "flying"; flightTime = 0; scored = false; }, geo: function () { return geo(); }, newHoop: function () { newHoop(); resetBall(); }, stepOnce: function () { return step(1 / 600); }, spot: function () { return { b: ballStart, h: hoopN }; }, sim: function (p) { this.shoot(p); var n = 0; while (state === "flying" && n < 20000) { n++; if (step(1 / 600)) break; } return [scored, n / 600]; }, shoot: function (p) { if (state === "done") newRound(); state = "holding"; power = p; up({ preventDefault: function () {} }); }, ideal: function () { return idealPower(); }, setAngle: function (d) { userDeg = d; setAngle(d); return ANGLE * 180 / Math.PI; }, angle: function () { return ANGLE * 180 / Math.PI; }, angleRange: function () { return [minDeg, maxDeg, defDeg]; }, wobble: function () { return wob.y; }, net: function () { return net; }, holdTest: function () { return state; }, state: function () { return [state, ball.x, ball.y, W, H, vMin, vMax, ANGLE]; } };

  function colors() {
    var cs = getComputedStyle(document.documentElement);
    function v(n, d) { return (cs.getPropertyValue(n) || d).trim() || d; }
    return { bg: v("--bg", "#f4f1ea"), fg: v("--fg", "#241f1a"), muted: v("--muted", "#6a625a"),
      line: v("--line", "#e3ddd3"), prompt: v("--prompt", "#8a5410"), chip: v("--chip", "#fffcf8") };
  }

  function geo() {
    var rimW = 46 * S;
    var x = hoopN.x * W, y = hoopN.y * H;
    return { rimL: x - rimW / 2, rimR: x + rimW / 2, rimY: y, boardX: x + rimW / 2 + 3 * S,
      boardTop: y - 62 * S, boardBot: y + 14 * S, floor: H - 18 * S, g: 1300 * S, pin: 3 * S };
  }

  function resize() {
    var r = stage.getBoundingClientRect();
    var dpr = Math.min(window.devicePixelRatio || 1, 3);
    W = Math.max(200, r.width); H = Math.max(200, r.height);
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    S = Math.min(W / 400, H / 600, 1.6);
    S = Math.max(S, 0.6);
    ball.r = 11 * S;
    if (state !== "flying") resetBall();
  }

  function speedFor(tx, ty) {
    var g = geo().g;
    var dx = tx - ball.x, dy = ball.y - ty;
    var c = Math.cos(ANGLE), t = Math.tan(ANGLE);
    var den = 2 * c * c * (dx * t - dy);
    return den > 0 ? Math.sqrt(g * dx * dx / den) : 0;
  }

  function resetBall() {
    ball.x = ballStart.nx * W; ball.y = ballStart.ny * H - ball.r;
    ball.vx = 0; ball.vy = 0;
    var gm = geo();
    var dx = (gm.rimL + gm.rimR) / 2 - ball.x, dy = ball.y - gm.rimY;
    /* lowest angle that still comes down into the rim, highest fixed at 70 */
    minDeg = Math.max(35, Math.atan2(2.3 * dy, dx) * 180 / Math.PI + 2);
    maxDeg = Math.max(minDeg, 70);
    defDeg = clampDeg(Math.atan2(3 * dy + 60 * S, dx) * 180 / Math.PI);
    spread = 0.32 + Math.random() * 0.12;
    center = 0.45 + Math.random() * 0.25;
    setAngle(userDeg == null ? defDeg : userDeg);
  }

  function clampDeg(d) { return Math.min(maxDeg, Math.max(minDeg, d)); }

  /* the power range follows the angle, so every allowed angle has a power that scores */
  function setAngle(d) {
    ANGLE = clampDeg(d) * Math.PI / 180;
    var gm = geo();
    var ideal = speedFor(aimX(gm), gm.rimY - 2 * S);
    vMin = ideal * (1 - spread * center);
    vMax = vMin + ideal * spread;
  }

  function aimX(gm) { return (gm.rimL + gm.rimR) / 2 + (gm.rimR - gm.rimL) * 0.12; }

  function idealPower() {
    var gm = geo();
    var ideal = speedFor(aimX(gm), gm.rimY - 2 * S);
    return (ideal - vMin) / (vMax - vMin);
  }

  function newHoop() {
    /* random distance each shot; the rise is tied to the gap so no shot is too steep to make */
    var hx = 0.7 + Math.random() * 0.12;
    var bx = 0.13 + Math.random() * 0.33;
    var dx = (hx - bx) * W;
    var rise = dx * (0.4 + Math.random() * 0.35);
    rise = Math.max(120 * S, Math.min(rise, (0.84 - 0.24) * H));
    hoopN = { x: hx, y: 0.84 - rise / H };
    ballStart = { nx: bx, ny: 0.84 };
  }


  function updateBoard() {
    madeEl.textContent = made; shotEl.textContent = Math.min(shots + 1, ROUND);
    bestEl.textContent = best;
  }

  function say(t) { lastMsg = t; msgUntil = performance.now() + 1100; if (live) live.textContent = t; }

  function newRound() {
    made = 0; shots = 0; state = "ready"; newHoop(); resetBall(); updateBoard();
  }

  function down(e) {
    if (state === "done") { e.preventDefault(); newRound(); return; }
    if (state !== "ready") return;
    e.preventDefault();
    try { canvas.setPointerCapture(e.pointerId); } catch (_) {}
    state = "holding"; holdStart = performance.now(); power = 0;
    dragY = e.clientY; dragDeg = ANGLE * 180 / Math.PI;
  }
  function up(e) {
    if (state !== "holding") return;
    e.preventDefault();
    var v = vMin + (vMax - vMin) * power;
    ball.vx = v * Math.cos(ANGLE); ball.vy = -v * Math.sin(ANGLE);
    state = "flying"; flightTime = 0; scored = false; rimTouch = 0; decidedAt = 0;
  }
  canvas.addEventListener("pointerdown", down);
  canvas.addEventListener("pointermove", function (e) {
    if (state !== "holding") return;
    e.preventDefault();
    /* drag up for a higher arc, down for a flatter one */
    userDeg = clampDeg(dragDeg + (dragY - e.clientY) * 0.25);
    setAngle(userDeg);
  });
  canvas.addEventListener("pointerup", up);
  canvas.addEventListener("pointercancel", up);
  canvas.addEventListener("contextmenu", function (e) { e.preventDefault(); });

  function collidePoint(px, py, rest) {
    var dx = ball.x - px, dy = ball.y - py;
    var d = Math.hypot(dx, dy), min = ball.r + geo().pin;
    if (d >= min) return false;
    var nx, ny;
    if (d < 1e-6) { nx = 0; ny = -1; } else { nx = dx / d; ny = dy / d; }
    ball.x = px + nx * min; ball.y = py + ny * min;
    var vn = ball.vx * nx + ball.vy * ny;
    if (vn < 0) {
      var tx = -ny, ty = nx, vt = ball.vx * tx + ball.vy * ty;
      vn = -vn * rest; vt *= 0.9;
      ball.vx = vn * nx + vt * tx; ball.vy = vn * ny + vt * ty;
    }
    return true;
  }

  function kick(speed) { wob.v += Math.min(speed, 900 * S) * 0.12; }

  function netRest(gm) {
    var pts = [], rows = 4, cols = 5, depth = 26 * S, inset = 8 * S;
    for (var r = 0; r <= rows; r++) {
      var f = r / rows, l = gm.rimL + inset * f, w = (gm.rimR - gm.rimL) - 2 * inset * f;
      for (var c = 0; c < cols; c++) pts.push({ x: l + w * c / (cols - 1), y: gm.rimY + depth * f, r: r });
    }
    return pts;
  }

  /* visual only: net points follow springs to rest and get pushed by the ball */
  function updateNet(dt) {
    var gm = geo(), rest = netRest(gm);
    if (net.length !== rest.length) net = rest.map(function (p) { return { x: p.x, y: p.y, vx: 0, vy: 0 }; });
    for (var i = 0; i < net.length; i++) {
      var p = net[i], q = rest[i];
      if (q.r === 0) { p.x = q.x; p.y = q.y + wob.y; p.vx = p.vy = 0; continue; }
      p.vx += ((q.x - p.x) * 260 - p.vx * 9) * dt;
      p.vy += ((q.y + wob.y - p.y) * 260 - p.vy * 9) * dt;
      var dx = p.x - ball.x, dy = p.y - ball.y, d = Math.hypot(dx, dy), m = ball.r + 1.5 * S;
      if (state === "flying" && d < m && d > 0) {
        p.x = ball.x + dx / d * m; p.y = ball.y + dy / d * m;
        p.vx += ball.vx * 0.35; p.vy += ball.vy * 0.35;
      }
      p.x += p.vx * dt; p.y += p.vy * dt;
    }
  }

  function step(dt) {
    var gm = geo();
    var prevY = ball.y;
    ball.vy += gm.g * dt;
    ball.x += ball.vx * dt; ball.y += ball.vy * dt;
    flightTime += dt;
    if (!decidedAt && ball.y - ball.r > gm.rimY + 30 * S && ball.vy > 0) decidedAt = flightTime;
    var hitL = collidePoint(gm.rimL, gm.rimY, 0.5);
    var hitR = collidePoint(gm.rimR, gm.rimY, 0.5);
    if (hitL || hitR) {
      if (rimTouch === 0) kick(Math.hypot(ball.vx, ball.vy));
      rimTouch += dt;
      /* never rest on the rim: a slow ball sitting on a rim point gets nudged off its top */
      if (rimTouch > 0.2 && Math.hypot(ball.vx, ball.vy) < 120 * S) {
        var px = hitL ? gm.rimL : gm.rimR;
        var side = ball.x >= px ? 1 : -1;
        if (Math.abs(ball.x - px) < 0.5 || !hitL) side = hitL ? side : -1;
        ball.vx += side * 40 * S;
      }
    } else rimTouch = Math.max(0, rimTouch - dt);
    // backboard
    if (ball.y > gm.boardTop - ball.r && ball.y < gm.boardBot + ball.r && ball.x + ball.r > gm.boardX && ball.x < gm.boardX + 4 * S) {
      if (ball.vx > 0) { kick(Math.abs(ball.vx) * 0.6); ball.x = gm.boardX - ball.r; ball.vx *= -0.55; ball.vy *= 0.92; }
    }
    // score: center passes down through rim plane between rims
    if (!scored && prevY < gm.rimY && ball.y >= gm.rimY && ball.vy > 0 && ball.x > gm.rimL && ball.x < gm.rimR) {
      scored = true; made++; totalMade++;
      updateBoard(); say("Score");
    }
    // floor
    if (ball.y + ball.r > gm.floor) {
      ball.y = gm.floor - ball.r;
      if (ball.vy > 0) ball.vy *= -0.55;
      ball.vx *= 0.85;
    }
    if (ball.x < ball.r) { ball.x = ball.r; ball.vx = Math.abs(ball.vx) * 0.6; }
    if (ball.x > W + 60 * S || flightTime > 3.2 || (decidedAt && flightTime - decidedAt > 0.8) || (Math.abs(ball.vy) < 30 && ball.y + ball.r >= gm.floor - 1 && flightTime > 0.6)) {
      if (!scored) say("Miss");
      shots++;
      if (shots >= ROUND) {
        if (made > best) best = made;
        state = "done"; roundEndAt = performance.now();
        say(made + " of " + ROUND); msgUntil = roundEndAt + 2200;
        updateBoard(); shotEl.textContent = ROUND;
        return true;
      }
      state = "ready"; newHoop(); resetBall(); updateBoard();
      return true;
    }
  }

  function draw(now) {
    var c = colors(), gm = geo();
    ctx.fillStyle = c.bg; ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = c.line; ctx.lineWidth = 2 * S;
    ctx.beginPath(); ctx.moveTo(0, gm.floor); ctx.lineTo(W, gm.floor); ctx.stroke();
    // backboard on the wall
    ctx.fillStyle = c.muted;
    ctx.fillRect(gm.boardX, gm.boardTop, 4 * S, gm.boardBot - gm.boardTop);
    /* mounted on the back wall: a short bracket to the right edge, no pole */
    ctx.fillRect(gm.boardX + 4 * S, gm.boardTop + 20 * S, W - gm.boardX - 4 * S, 3 * S);
    ctx.fillRect(gm.boardX + 4 * S, gm.boardBot - 16 * S, W - gm.boardX - 4 * S, 3 * S);
    ctx.fillRect(W - 3 * S, 0, 3 * S, gm.floor);
    // net
    if (net.length) {
      ctx.strokeStyle = c.muted; ctx.lineWidth = 1;
      ctx.beginPath();
      for (var i = 0; i < 5; i++) for (var r = 0; r < 4; r++) {
        var p0 = net[r * 5 + i], p1 = net[(r + 1) * 5 + i];
        ctx.moveTo(p0.x, p0.y); ctx.lineTo(p1.x, p1.y);
        if (i < 4 && r > 0) { var p2 = net[r * 5 + i + 1]; ctx.moveTo(p0.x, p0.y); ctx.lineTo(p2.x, p2.y); }
      }
      ctx.stroke();
    }
    // ball
    ctx.fillStyle = c.prompt;
    ctx.beginPath(); ctx.arc(ball.x, ball.y, ball.r, 0, Math.PI * 2); ctx.fill();
    // rim drawn over ball
    ctx.strokeStyle = c.prompt; ctx.lineWidth = 3 * S;
    ctx.beginPath(); ctx.moveTo(gm.rimL, gm.rimY + wob.y); ctx.lineTo(gm.boardX, gm.rimY + wob.y * 0.3); ctx.stroke();
    // aim hint
    if (state !== "flying") {
      ctx.strokeStyle = c.line; ctx.lineWidth = 2 * S; ctx.setLineDash([4 * S, 6 * S]);
      ctx.beginPath(); ctx.moveTo(ball.x, ball.y);
      ctx.lineTo(ball.x + Math.cos(ANGLE) * 70 * S, ball.y - Math.sin(ANGLE) * 70 * S); ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = c.muted; ctx.textAlign = "left";
      ctx.font = Math.round(12 * S) + "px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";
      ctx.fillText(Math.round(ANGLE * 180 / Math.PI) + "\u00b0", ball.x + Math.cos(ANGLE) * 70 * S + 6 * S, ball.y - Math.sin(ANGLE) * 70 * S);
    }
    // power meter
    var mx = 14 * S, mh = Math.min(180 * S, H * 0.4), my = gm.floor - 14 * S - mh, mw = 12 * S;
    ctx.strokeStyle = c.muted; ctx.lineWidth = 1.5;
    ctx.strokeRect(mx, my, mw, mh);
    if (state === "holding") {
      ctx.fillStyle = c.fg; var ph = mh * power;
      ctx.fillRect(mx, my + mh - ph, mw, ph);
    }
    ctx.fillStyle = c.muted;
    ctx.font = Math.round(12 * S) + "px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";
    ctx.textAlign = "left";
    if (state === "ready" && shots === 0 && totalMade === 0) ctx.fillText("hold to shoot, drag up or down to aim", mx, my - 8 * S);
    if (state === "done") { ctx.textAlign = "center"; ctx.fillText("tap for next round", W / 2, 66 * S); }
    if (now < msgUntil) {
      ctx.fillStyle = c.fg; ctx.textAlign = "center";
      ctx.font = Math.round(18 * S) + "px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";
      ctx.fillText(lastMsg, W / 2, 40 * S);
    }
  }

  var last = performance.now();
  function frame(now) {
    var dt = Math.min(0.05, (now - last) / 1000); last = now;
    if (state === "holding") {
      var t = (now - holdStart) / 1000;
      power = (1 - Math.cos(t * Math.PI / 1.1)) / 2; // full sweep in 1.1s, then back
    }
    if (state === "flying") {
      var sp = Math.hypot(ball.vx, ball.vy) * dt;
      var n = Math.min(64, Math.max(4, Math.ceil(sp / (1.5 * S))));
      for (var i = 0; i < n; i++) { if (step(dt / n)) break; }
    }
    if (state === "done" && now - roundEndAt > 2200) newRound();
    /* damped spring, settles in well under half a second */
    wob.v += (-wob.y * 900 - wob.v * 32) * dt; wob.y += wob.v * dt;
    if (Math.abs(wob.y) > 4 * S) wob.y = 4 * S * Math.sign(wob.y);
    updateNet(dt);
    draw(now);
    requestAnimationFrame(frame);
  }
  window.addEventListener("resize", resize);
  if (window.ResizeObserver) new ResizeObserver(resize).observe(stage);
  resize(); updateBoard();
  requestAnimationFrame(frame);
})();
