(function () {
  var session = null;

  function stop() {
    if (!session) return;
    var current = session;
    session = null;
    current.halt();
  }

  function mount(root) {
    stop();
    root = root && root.querySelector ? root : document;
    var canvas = root.querySelector("#heli-canvas");
    var stage = root.querySelector("#heli-stage");
    var overlay = root.querySelector("#heli-overlay");
    var overlayTitle = root.querySelector("#heli-overlay-title");
    var overlayText = root.querySelector("#heli-overlay-text");
    var startBtn = root.querySelector("#heli-start");
    var scoreEl = root.querySelector("#heli-score");
    var bestEl = root.querySelector("#heli-best");
    var live = root.querySelector("#heli-live");
    if (!canvas || !canvas.getContext || !stage) return;

    var ctx = canvas.getContext("2d", { alpha: false });
    var W = 800;
    var H = 500;
    var BEST_KEY = "helicopter-best";
    var reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    var state = "ready";
    var holding = false;
    var ignoreClick = false;
    var last = 0;
    var time = 0;
    var cam = 0;
    var score = 0;
    var best = 0;
    var heli = { x: 168, y: H * 0.46, vy: 0 };
    var raf = 0;
    var alive = true;
    var cleanups = [];
    var observer = null;

    function listen(target, type, handler, options) {
      target.addEventListener(type, handler, options);
      cleanups.push(function () {
        target.removeEventListener(type, handler, options);
      });
    }

    function halt() {
      if (!alive) return;
      alive = false;
      holding = false;
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
      var i;
      for (i = 0; i < cleanups.length; i++) cleanups[i]();
      cleanups = [];
      if (observer) {
        observer.disconnect();
        observer = null;
      }
    }

    try {
      best = parseInt(localStorage.getItem(BEST_KEY) || "0", 10) || 0;
    } catch (error) {
      best = 0;
    }

    function colors() {
      var dark = document.documentElement.getAttribute("data-theme") === "dark";
      if (dark) {
        return {
          sky: "#12110f",
          rock: "#2a2824",
          edge: "#b7d7c6",
          heli: "#b7d7c6",
          window: "#1a2420"
        };
      }
      return {
        sky: "#f4f0e7",
        rock: "#1b1814",
        edge: "#1c5c43",
        heli: "#1c5c43",
        window: "#e7f2ec"
      };
    }

    function shapeAt(worldX) {
      if (worldX < 0) return { top: 70, bottom: H - 70 };
      var intro = Math.max(0, Math.min(1, (worldX - 320) / 640));
      var gap = Math.max(156, 300 - intro * Math.min(140, Math.max(0, worldX - 320) * 0.02));
      var amp = intro * Math.min(120, worldX * 0.03);
      var wave = Math.sin(worldX * 0.0072) * amp + Math.sin(worldX * 0.018 + 1.1) * amp * 0.38;
      var mid = H * 0.48 + wave;
      var limit = gap * 0.5 + 22;
      if (mid < limit) mid = limit;
      if (mid > H - limit) mid = H - limit;
      return { top: mid - gap / 2, bottom: mid + gap / 2 };
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
      canvas.width = Math.max(1, Math.round(width * dpr));
      canvas.height = Math.max(1, Math.round(height * dpr));
      ctx.setTransform(canvas.width / W, 0, 0, canvas.height / H, 0, 0);
    }

    function reset() {
      cam = 0;
      score = 0;
      heli.y = H * 0.46;
      heli.vy = 0;
      updateScore();
    }

    function updateScore() {
      if (scoreEl) scoreEl.textContent = String(score);
      if (bestEl) bestEl.textContent = String(Math.max(best, score));
    }

    function persistBest() {
      if (score <= best) return;
      best = score;
      updateScore();
      try {
        localStorage.setItem(BEST_KEY, String(best));
      } catch (error) {
        /* Private mode can block storage; the run still counts on screen. */
      }
    }

    function start() {
      reset();
      state = "playing";
      last = 0;
      if (overlay) overlay.hidden = true;
      if (live) live.textContent = "Flying.";
    }

    function crash() {
      if (state !== "playing") return;
      state = "crashed";
      holding = false;
      persistBest();
      if (overlayTitle) overlayTitle.textContent = "Crashed";
      if (overlayText) overlayText.textContent = "Distance " + score + ". Hold to fly again.";
      if (startBtn) startBtn.textContent = "Fly again";
      if (overlay) overlay.hidden = false;
      if (live) live.textContent = "Crashed at distance " + score + ".";
    }

    function hitsCave() {
      var points = [
        [heli.x + 16, heli.y],
        [heli.x - 28, heli.y + 1],
        [heli.x, heli.y - 12],
        [heli.x + 4, heli.y + 14],
        [heli.x + 10, heli.y - 8],
        [heli.x - 8, heli.y + 8]
      ];
      for (var i = 0; i < points.length; i++) {
        var px = points[i][0];
        var py = points[i][1];
        var cave = shapeAt(cam + px);
        if (py < cave.top || py > cave.bottom) return true;
      }
      return false;
    }

    function update(dt) {
      var speed = 188 + Math.min(170, cam * 0.018);
      var thrust = holding ? -1680 : 0;
      heli.vy += (920 + thrust) * dt;
      if (heli.vy > 420) heli.vy = 420;
      if (heli.vy < -360) heli.vy = -360;
      heli.y += heli.vy * dt;
      cam += speed * dt;
      score = Math.floor(cam / 14);
      updateScore();
      if (hitsCave()) crash();
    }

    function drawCave(palette) {
      ctx.fillStyle = palette.rock;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      var x;
      for (x = 0; x <= W; x += 8) ctx.lineTo(x, shapeAt(cam + x).top);
      ctx.lineTo(W, 0);
      ctx.closePath();
      ctx.fill();

      ctx.beginPath();
      ctx.moveTo(0, H);
      for (x = 0; x <= W; x += 8) ctx.lineTo(x, shapeAt(cam + x).bottom);
      ctx.lineTo(W, H);
      ctx.closePath();
      ctx.fill();

      ctx.strokeStyle = palette.edge;
      ctx.lineWidth = 3;
      ctx.beginPath();
      for (x = 0; x <= W; x += 8) {
        var top = shapeAt(cam + x).top;
        if (x === 0) ctx.moveTo(x, top);
        else ctx.lineTo(x, top);
      }
      ctx.stroke();
      ctx.beginPath();
      for (x = 0; x <= W; x += 8) {
        var bottom = shapeAt(cam + x).bottom;
        if (x === 0) ctx.moveTo(x, bottom);
        else ctx.lineTo(x, bottom);
      }
      ctx.stroke();
    }

    function drawHeli(palette, y) {
      ctx.save();
      ctx.translate(heli.x, y);
      var tilt = state === "playing" ? Math.max(-0.42, Math.min(0.5, heli.vy / 620)) : -0.08;
      ctx.rotate(tilt);
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.strokeStyle = palette.heli;
      ctx.fillStyle = palette.heli;
      ctx.lineWidth = 3;

      ctx.beginPath();
      ctx.moveTo(-8, 1);
      ctx.lineTo(-32, 3);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(-32, 3);
      ctx.lineTo(-36, -9);
      ctx.lineTo(-27, 3);
      ctx.closePath();
      ctx.fill();

      ctx.beginPath();
      ctx.ellipse(2, 0, 20, 11, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = palette.window;
      ctx.beginPath();
      ctx.ellipse(10, -1, 6.5, 4.5, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = palette.heli;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-10, 9);
      ctx.lineTo(-12, 14);
      ctx.lineTo(14, 14);
      ctx.moveTo(6, 9);
      ctx.lineTo(8, 14);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(0, -10);
      ctx.lineTo(0, -14);
      ctx.stroke();
      ctx.save();
      ctx.translate(0, -14);
      ctx.rotate(time * (holding ? 36 : 16));
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(-24, 0);
      ctx.lineTo(24, 0);
      ctx.stroke();
      ctx.restore();
      ctx.restore();
    }

    function draw() {
      var palette = colors();
      ctx.fillStyle = palette.sky;
      ctx.fillRect(0, 0, W, H);
      drawCave(palette);
      var y = heli.y;
      if (state === "ready" && !reducedMotion) y += Math.sin(time * 2.2) * 6;
      drawHeli(palette, y);
    }

    function frame(ts) {
      if (!alive) return;
      if (!last) last = ts;
      var dt = Math.min(0.034, (ts - last) / 1000);
      last = ts;
      if (document.hidden) {
        raf = requestAnimationFrame(frame);
        return;
      }
      time += dt;
      if (state === "playing") update(dt);
      draw();
      if (!alive) return;
      raf = requestAnimationFrame(frame);
    }

    function blockTouch(event) {
      event.preventDefault();
    }

    var touchOpts = { passive: false };
    listen(stage, "touchstart", blockTouch, touchOpts);
    listen(stage, "touchmove", blockTouch, touchOpts);
    listen(canvas, "touchstart", blockTouch, touchOpts);
    listen(canvas, "touchmove", blockTouch, touchOpts);

    listen(stage, "pointerdown", function (event) {
      if (event.pointerType === "mouse" && event.button !== 0) return;
      event.preventDefault();
      if (canvas.focus) canvas.focus({ preventScroll: true });
      if (state !== "playing") {
        start();
        ignoreClick = true;
      }
      holding = true;
    });

    listen(window, "pointerup", function () {
      holding = false;
    });
    listen(window, "pointercancel", function () {
      holding = false;
    });

    if (startBtn) {
      listen(startBtn, "click", function () {
        if (ignoreClick) {
          ignoreClick = false;
          return;
        }
        start();
      });
    }

    listen(window, "keydown", function (event) {
      var key = event.code;
      if (key !== "Space" && key !== "ArrowUp") return;
      var tag = document.activeElement ? document.activeElement.tagName : "";
      if (tag === "A" || tag === "INPUT" || tag === "TEXTAREA") return;
      if (tag === "BUTTON" && state !== "playing") return;
      event.preventDefault();
      if (event.repeat) return;
      holding = true;
      if (state !== "playing") start();
    });

    listen(window, "keyup", function (event) {
      if (event.code === "Space" || event.code === "ArrowUp") holding = false;
    });

    listen(window, "blur", function () {
      holding = false;
    });

    listen(document, "visibilitychange", function () {
      holding = false;
      last = 0;
      if (document.hidden) persistBest();
    });

    listen(window, "resize", resize);
    if (window.ResizeObserver) {
      observer = new ResizeObserver(resize);
      observer.observe(stage);
    }

    session = { halt: halt };
    updateScore();
    resize();
    draw();
    raf = requestAnimationFrame(frame);
  }

  window.SiteGames = window.SiteGames || {};
  window.SiteGames.helicopter = { mount: mount, stop: stop };

  if (document.getElementById("heli-canvas")) mount(document);
})();
