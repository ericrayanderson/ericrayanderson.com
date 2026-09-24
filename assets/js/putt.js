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
    var canvas = root.querySelector("#putt-canvas");
    var stage = root.querySelector("#putt-stage");
    var overlay = root.querySelector("#putt-overlay");
    var overlayTitle = root.querySelector("#putt-overlay-title");
    var overlayText = root.querySelector("#putt-overlay-text");
    var nextBtn = root.querySelector("#putt-next");
    var holeEl = root.querySelector("#putt-hole");
    var nameEl = root.querySelector("#putt-name");
    var parEl = root.querySelector("#putt-par");
    var strokesEl = root.querySelector("#putt-strokes");
    var totalEl = root.querySelector("#putt-total");
    var live = root.querySelector("#putt-live");
    if (!canvas || !canvas.getContext || !stage) return;

    var ctx = canvas.getContext("2d", { alpha: false });
    var W = 800;
    var H = 480;
    var RAD = 9;
    var CUP = 13;
    var L = 46;
    var T = 46;
    var R = 754;
    var B = 434;

    var holes = [
      {
        title: "Warm-up",
        par: 2,
        ball: { x: 150, y: 240 },
        cup: { x: 650, y: 240 },
        blocks: []
      },
      {
        title: "Center post",
        par: 3,
        ball: { x: 140, y: 240 },
        cup: { x: 660, y: 240 },
        blocks: [{ x: 372, y: 150, w: 56, h: 180 }]
      },
      {
        title: "Dogleg",
        par: 3,
        ball: { x: 150, y: 360 },
        cup: { x: 630, y: 120 },
        blocks: [{ x: 300, y: 46, w: 44, h: 250 }]
      }
    ];

    var holeIndex = 0;
    var ball = { x: 0, y: 0, vx: 0, vy: 0 };
    var holeStrokes = 0;
    var total = 0;
    var phase = "play";
    var aiming = false;
    var aim = null;
    var last = 0;
    var raf = 0;
    var alive = true;
    var cleanups = [];
    var observer = null;
    var reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    function listen(target, type, handler, options) {
      target.addEventListener(type, handler, options);
      cleanups.push(function () {
        target.removeEventListener(type, handler, options);
      });
    }

    function halt() {
      if (!alive) return;
      alive = false;
      aiming = false;
      aim = null;
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

    function colors() {
      var dark = document.documentElement.getAttribute("data-theme") === "dark";
      if (dark) {
        return {
          sky: "#12110f",
          green: "#1a2822",
          wall: "#2e2c28",
          edge: "#b7d7c6",
          ball: "#f3efe6",
          ballLine: "#1b1814",
          cup: "#0c0e0d",
          flag: "#d7ebe3",
          aim: "#b7d7c6"
        };
      }
      return {
        sky: "#f4f0e7",
        green: "#e4efe6",
        wall: "#1b1814",
        edge: "#1c5c43",
        ball: "#fbf8f2",
        ballLine: "#1b1814",
        cup: "#14211c",
        flag: "#1c5c43",
        aim: "#1c5c43"
      };
    }

    function hole() {
      return holes[holeIndex];
    }

    function placeBall() {
      var start = hole().ball;
      ball.x = start.x;
      ball.y = start.y;
      ball.vx = 0;
      ball.vy = 0;
    }

    function loadHole(index) {
      holeIndex = index;
      holeStrokes = 0;
      phase = "play";
      aiming = false;
      aim = null;
      placeBall();
      if (overlay) overlay.hidden = true;
      updateHud();
    }

    function updateHud() {
      var current = hole();
      if (holeEl) holeEl.textContent = String(holeIndex + 1);
      if (nameEl) nameEl.textContent = current.title;
      if (parEl) parEl.textContent = String(current.par);
      if (strokesEl) strokesEl.textContent = String(holeStrokes);
      if (totalEl) totalEl.textContent = String(total + holeStrokes);
    }

    function resize() {
      var parent = stage.parentElement;
      var avail = parent ? parent.clientWidth : 800;
      var width = Math.min(avail, 800);
      var height = Math.round(width * (H / W));
      var maxH = Math.max(220, Math.min(window.innerHeight * 0.62, 500));
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

    function worldPoint(event) {
      var rect = canvas.getBoundingClientRect();
      return {
        x: ((event.clientX - rect.left) / rect.width) * W,
        y: ((event.clientY - rect.top) / rect.height) * H
      };
    }

    function speed() {
      return Math.hypot(ball.vx, ball.vy);
    }

    function collideRect(rect) {
      var nearestX = Math.max(rect.x, Math.min(ball.x, rect.x + rect.w));
      var nearestY = Math.max(rect.y, Math.min(ball.y, rect.y + rect.h));
      var dx = ball.x - nearestX;
      var dy = ball.y - nearestY;
      var distSq = dx * dx + dy * dy;
      if (distSq > RAD * RAD) return;
      if (distSq === 0) {
        var left = ball.x - rect.x;
        var right = rect.x + rect.w - ball.x;
        var top = ball.y - rect.y;
        var bottom = rect.y + rect.h - ball.y;
        var min = Math.min(left, right, top, bottom);
        if (min === left) {
          ball.x = rect.x - RAD;
          ball.vx = -Math.abs(ball.vx) * 0.62;
        } else if (min === right) {
          ball.x = rect.x + rect.w + RAD;
          ball.vx = Math.abs(ball.vx) * 0.62;
        } else if (min === top) {
          ball.y = rect.y - RAD;
          ball.vy = -Math.abs(ball.vy) * 0.62;
        } else {
          ball.y = rect.y + rect.h + RAD;
          ball.vy = Math.abs(ball.vy) * 0.62;
        }
        return;
      }
      var dist = Math.sqrt(distSq);
      var nx = dx / dist;
      var ny = dy / dist;
      ball.x += nx * (RAD - dist);
      ball.y += ny * (RAD - dist);
      var vn = ball.vx * nx + ball.vy * ny;
      if (vn < 0) {
        ball.vx -= 1.62 * vn * nx;
        ball.vy -= 1.62 * vn * ny;
      }
    }

    function collideBounds() {
      if (ball.x < L + RAD) {
        ball.x = L + RAD;
        if (ball.vx < 0) ball.vx *= -0.62;
      } else if (ball.x > R - RAD) {
        ball.x = R - RAD;
        if (ball.vx > 0) ball.vx *= -0.62;
      }
      if (ball.y < T + RAD) {
        ball.y = T + RAD;
        if (ball.vy < 0) ball.vy *= -0.62;
      } else if (ball.y > B - RAD) {
        ball.y = B - RAD;
        if (ball.vy > 0) ball.vy *= -0.62;
      }
    }

    function sink() {
      phase = holeIndex === holes.length - 1 ? "done" : "holed";
      ball.vx = 0;
      ball.vy = 0;
      ball.x = hole().cup.x;
      ball.y = hole().cup.y;
      var round = total + holeStrokes;
      if (phase === "done") {
        if (overlayTitle) overlayTitle.textContent = "Round complete";
        if (overlayText) overlayText.textContent = "Three holes in " + round + (round === 1 ? " stroke." : " strokes.");
        if (nextBtn) nextBtn.textContent = "Play again";
      } else {
        if (overlayTitle) overlayTitle.textContent = "In the hole";
        if (overlayText) overlayText.textContent = hole().title + " in " + holeStrokes + (holeStrokes === 1 ? " stroke." : " strokes.");
        if (nextBtn) nextBtn.textContent = "Next hole";
      }
      if (overlay) overlay.hidden = false;
      if (live) live.textContent = overlayText ? overlayText.textContent : "In the hole.";
      updateHud();
    }

    function step(dt) {
      var sub = 3;
      var h = dt / sub;
      var blocks = hole().blocks;
      var i;
      var s;
      for (s = 0; s < sub; s++) {
        ball.x += ball.vx * h;
        ball.y += ball.vy * h;
        collideBounds();
        for (i = 0; i < blocks.length; i++) collideRect(blocks[i]);
        var drag = Math.exp(-1.05 * h);
        ball.vx *= drag;
        ball.vy *= drag;
        var cup = hole().cup;
        if (Math.hypot(ball.x - cup.x, ball.y - cup.y) < CUP && speed() < 240) {
          sink();
          return;
        }
      }
      if (Math.abs(ball.vx) < 16) ball.vx = 0;
      if (Math.abs(ball.vy) < 16) ball.vy = 0;
    }

    function shoot(point) {
      if (phase !== "play" || speed() > 20) return;
      var dx = point.x - ball.x;
      var dy = point.y - ball.y;
      var len = Math.hypot(dx, dy);
      if (len < 16) return;
      var capped = Math.min(len, 168);
      var scale = capped / 168;
      ball.vx = (dx / len) * scale * 720;
      ball.vy = (dy / len) * scale * 720;
      holeStrokes += 1;
      updateHud();
    }

    function draw() {
      var palette = colors();
      var current = hole();
      ctx.fillStyle = palette.wall;
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = palette.green;
      ctx.fillRect(L, T, R - L, B - T);

      ctx.strokeStyle = palette.edge;
      ctx.lineWidth = 3;
      ctx.strokeRect(L + 1.5, T + 1.5, R - L - 3, B - T - 3);

      var i;
      ctx.fillStyle = palette.wall;
      for (i = 0; i < current.blocks.length; i++) {
        var block = current.blocks[i];
        ctx.fillRect(block.x, block.y, block.w, block.h);
      }

      ctx.fillStyle = palette.cup;
      ctx.beginPath();
      ctx.arc(current.cup.x, current.cup.y, CUP, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = palette.edge;
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.strokeStyle = palette.flag;
      ctx.fillStyle = palette.flag;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(current.cup.x, current.cup.y);
      ctx.lineTo(current.cup.x, current.cup.y - 46);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(current.cup.x, current.cup.y - 46);
      ctx.lineTo(current.cup.x + 18, current.cup.y - 38);
      ctx.lineTo(current.cup.x, current.cup.y - 30);
      ctx.closePath();
      ctx.fill();

      if (aiming && aim && phase === "play" && speed() < 20) {
        var dx = aim.x - ball.x;
        var dy = aim.y - ball.y;
        var len = Math.hypot(dx, dy);
        if (len > 8) {
          var shown = Math.min(len, 168);
          var nx = dx / len;
          var ny = dy / len;
          ctx.strokeStyle = palette.aim;
          ctx.lineWidth = 2;
          ctx.setLineDash([5, 6]);
          ctx.beginPath();
          ctx.moveTo(ball.x, ball.y);
          ctx.lineTo(ball.x + nx * shown, ball.y + ny * shown);
          ctx.stroke();
          ctx.setLineDash([]);
          ctx.fillStyle = palette.aim;
          ctx.beginPath();
          ctx.arc(ball.x + nx * shown, ball.y + ny * shown, 3.5, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      var bob = phase === "play" && speed() < 20 && !reducedMotion ? Math.sin(last / 280) * 0.6 : 0;
      ctx.fillStyle = "rgba(27, 24, 20, 0.18)";
      ctx.beginPath();
      ctx.ellipse(ball.x + 2, ball.y + 5, RAD * 0.85, RAD * 0.45, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = palette.ball;
      ctx.beginPath();
      ctx.arc(ball.x, ball.y + bob, phase === "play" ? RAD : RAD * 0.72, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = palette.ballLine;
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }

    function frame(ts) {
      if (!alive) return;
      if (!last) last = ts;
      var dt = Math.min(0.034, (ts - last) / 1000);
      last = ts;
      if (!document.hidden && phase === "play" && speed() > 0) step(dt);
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

    listen(canvas, "pointerdown", function (event) {
      if (event.pointerType === "mouse" && event.button !== 0) return;
      if (phase !== "play" || speed() > 20) return;
      event.preventDefault();
      aiming = true;
      aim = worldPoint(event);
      if (canvas.setPointerCapture) canvas.setPointerCapture(event.pointerId);
    });

    listen(canvas, "pointermove", function (event) {
      if (!aiming) return;
      aim = worldPoint(event);
    });

    function release(event) {
      if (!aiming) return;
      aiming = false;
      var point = worldPoint(event);
      aim = null;
      shoot(point);
    }

    listen(canvas, "pointerup", release);
    listen(canvas, "pointercancel", function () {
      aiming = false;
      aim = null;
    });

    if (nextBtn) {
      listen(nextBtn, "click", function () {
        if (phase === "done") {
          total = 0;
          loadHole(0);
          return;
        }
        if (phase === "holed") {
          total += holeStrokes;
          loadHole(holeIndex + 1);
        }
      });
    }

    listen(window, "resize", resize);
    if (window.ResizeObserver) {
      observer = new ResizeObserver(resize);
      observer.observe(stage.parentElement || stage);
    }

    session = { halt: halt };
    loadHole(0);
    resize();
    raf = requestAnimationFrame(frame);
  }

  window.SiteGames = window.SiteGames || {};
  window.SiteGames.putt = { mount: mount, stop: stop };

  if (document.getElementById("putt-canvas")) mount(document);
})();
