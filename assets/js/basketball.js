(function () {
  var canvas = document.getElementById("hoop-canvas");
  var stage = document.getElementById("hoop-stage");
  if (!canvas || !canvas.getContext || !stage) return;
  var ctx = canvas.getContext("2d");
  var madeEl = document.getElementById("hoop-made");
  var shotsEl = document.getElementById("hoop-shots");
  var streakEl = document.getElementById("hoop-streak");
  var bestEl = document.getElementById("hoop-best");
  var live = document.getElementById("hoop-live");

  var W = 0, H = 0, S = 1;
  var ANGLE = 58 * Math.PI / 180;
  var made = 0, shots = 0, streak = 0, best = 0;
  var hoopN = { x: 0.74, y: 0.36 };
  var ballStart = { nx: 0.2, ny: 0.84 };
  var ball = { x: 0, y: 0, vx: 0, vy: 0, r: 10 };
  var state = "ready"; // ready, holding, flying
  var holdStart = 0, power = 0, vMin = 0, vMax = 0;
  var flightTime = 0, scored = false, lastMsg = "", msgUntil = 0;
  window.__hoops = { get made() { return made; }, get shots() { return shots; }, ideal: function () { return idealPower(); }, state: function () { return [state, ball.x, ball.y, W, H, vMin, vMax, ANGLE]; } };

  function colors() {
    var cs = getComputedStyle(document.documentElement);
    function v(n, d) { return (cs.getPropertyValue(n) || d).trim() || d; }
    return { bg: v("--bg", "#f4f1ea"), fg: v("--fg", "#241f1a"), muted: v("--muted", "#6a625a"),
      line: v("--line", "#e3ddd3"), prompt: v("--prompt", "#8a5410"), chip: v("--chip", "#fffcf8") };
  }

  function geo() {
    var rimW = 46 * S;
    var x = hoopN.x * W, y = hoopN.y * H;
    return { rimL: x - rimW / 2, rimR: x + rimW / 2, rimY: y, boardX: x + rimW / 2 + 6 * S,
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
    ANGLE = Math.atan2(3 * dy + 60 * S, dx);
    ANGLE = Math.min(80 * Math.PI / 180, Math.max(45 * Math.PI / 180, ANGLE));
    var ideal = speedFor((gm.rimL + gm.rimR) / 2, gm.rimY - 2 * S);
    var spread = 0.32 + Math.random() * 0.12;
    var center = 0.45 + Math.random() * 0.25;
    vMin = ideal * (1 - spread * center);
    vMax = vMin + ideal * spread;
  }

  function idealPower() {
    var gm = geo();
    var ideal = speedFor((gm.rimL + gm.rimR) / 2, gm.rimY - 2 * S);
    return (ideal - vMin) / (vMax - vMin);
  }

  function newHoop() {
    hoopN = { x: 0.6 + Math.random() * 0.22, y: 0.26 + Math.random() * 0.2 };
    ballStart = { nx: 0.12 + Math.random() * 0.14, ny: 0.84 };
  }

  function updateBoard() {
    madeEl.textContent = made; shotsEl.textContent = shots;
    streakEl.textContent = streak; bestEl.textContent = best;
  }

  function say(t) { lastMsg = t; msgUntil = performance.now() + 1100; if (live) live.textContent = t; }

  function down(e) {
    if (state !== "ready") return;
    e.preventDefault();
    try { canvas.setPointerCapture(e.pointerId); } catch (_) {}
    state = "holding"; holdStart = performance.now(); power = 0;
  }
  function up(e) {
    if (state !== "holding") return;
    e.preventDefault();
    var v = vMin + (vMax - vMin) * power;
    ball.vx = v * Math.cos(ANGLE); ball.vy = -v * Math.sin(ANGLE);
    state = "flying"; flightTime = 0; scored = false; shots++;
    updateBoard();
  }
  canvas.addEventListener("pointerdown", down);
  canvas.addEventListener("pointerup", up);
  canvas.addEventListener("pointercancel", up);
  canvas.addEventListener("contextmenu", function (e) { e.preventDefault(); });

  function collidePoint(px, py, rest) {
    var dx = ball.x - px, dy = ball.y - py;
    var d = Math.hypot(dx, dy), min = ball.r + geo().pin;
    if (d < min && d > 0) {
      var nx = dx / d, ny = dy / d;
      ball.x = px + nx * min; ball.y = py + ny * min;
      var vn = ball.vx * nx + ball.vy * ny;
      if (vn < 0) { ball.vx -= (1 + rest) * vn * nx; ball.vy -= (1 + rest) * vn * ny; ball.vx *= 0.92; ball.vy *= 0.92; }
    }
  }

  function step(dt) {
    var gm = geo();
    var prevY = ball.y;
    ball.vy += gm.g * dt;
    ball.x += ball.vx * dt; ball.y += ball.vy * dt;
    flightTime += dt;
    collidePoint(gm.rimL, gm.rimY, 0.55);
    collidePoint(gm.rimR, gm.rimY, 0.55);
    // backboard
    if (ball.y > gm.boardTop - ball.r && ball.y < gm.boardBot + ball.r && ball.x + ball.r > gm.boardX && ball.x < gm.boardX + 4 * S) {
      if (ball.vx > 0) { ball.x = gm.boardX - ball.r; ball.vx *= -0.6; }
    }
    // score: center passes down through rim plane between rims
    if (!scored && prevY < gm.rimY && ball.y >= gm.rimY && ball.vy > 0 && ball.x > gm.rimL && ball.x < gm.rimR) {
      scored = true; made++; streak++; if (streak > best) best = streak;
      updateBoard(); say(streak > 1 ? "Streak " + streak : "Score");
    }
    // floor
    if (ball.y + ball.r > gm.floor) {
      ball.y = gm.floor - ball.r;
      if (ball.vy > 0) ball.vy *= -0.55;
      ball.vx *= 0.85;
    }
    if (ball.x < ball.r) { ball.x = ball.r; ball.vx = Math.abs(ball.vx) * 0.6; }
    if (ball.x > W + 60 * S || flightTime > 3.2 || (Math.abs(ball.vy) < 30 && ball.y + ball.r >= gm.floor - 1 && flightTime > 0.6)) {
      if (!scored) { streak = 0; updateBoard(); say("Miss"); }
      else newHoop();
      state = "ready"; resetBall();
    }
  }

  function draw(now) {
    var c = colors(), gm = geo();
    ctx.fillStyle = c.bg; ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = c.line; ctx.lineWidth = 2 * S;
    ctx.beginPath(); ctx.moveTo(0, gm.floor); ctx.lineTo(W, gm.floor); ctx.stroke();
    // backboard and pole
    ctx.fillStyle = c.muted;
    ctx.fillRect(gm.boardX, gm.boardTop, 4 * S, gm.boardBot - gm.boardTop);
    ctx.fillRect(gm.boardX + 4 * S, gm.boardBot - 8 * S, 3 * S, gm.floor - gm.boardBot + 8 * S);
    // net
    ctx.strokeStyle = c.muted; ctx.lineWidth = 1;
    ctx.beginPath();
    var nb = gm.rimY + 26 * S, inset = 8 * S;
    for (var i = 0; i <= 4; i++) {
      var tx = gm.rimL + (gm.rimR - gm.rimL) * i / 4;
      var bx = gm.rimL + inset + (gm.rimR - gm.rimL - 2 * inset) * i / 4;
      ctx.moveTo(tx, gm.rimY); ctx.lineTo(bx, nb);
    }
    ctx.stroke();
    // ball
    ctx.fillStyle = c.prompt;
    ctx.beginPath(); ctx.arc(ball.x, ball.y, ball.r, 0, Math.PI * 2); ctx.fill();
    // rim drawn over ball
    ctx.strokeStyle = c.prompt; ctx.lineWidth = 3 * S;
    ctx.beginPath(); ctx.moveTo(gm.rimL, gm.rimY); ctx.lineTo(gm.boardX, gm.rimY); ctx.stroke();
    // aim hint
    if (state !== "flying") {
      ctx.strokeStyle = c.line; ctx.lineWidth = 2 * S; ctx.setLineDash([4 * S, 6 * S]);
      ctx.beginPath(); ctx.moveTo(ball.x, ball.y);
      ctx.lineTo(ball.x + Math.cos(ANGLE) * 50 * S, ball.y - Math.sin(ANGLE) * 50 * S); ctx.stroke();
      ctx.setLineDash([]);
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
    if (state === "ready" && shots === 0) ctx.fillText("hold to shoot", mx, my - 8 * S);
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
    if (state === "flying") { var n = 4; for (var i = 0; i < n; i++) step(dt / n); }
    draw(now);
    requestAnimationFrame(frame);
  }
  window.addEventListener("resize", resize);
  if (window.ResizeObserver) new ResizeObserver(resize).observe(stage);
  resize(); updateBoard();
  requestAnimationFrame(frame);
})();
