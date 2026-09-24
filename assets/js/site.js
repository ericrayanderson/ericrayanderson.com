(function () {
  var root = document.documentElement;
  var themeButton = document.getElementById("theme-toggle");
  var themeColor = document.getElementById("theme-color");
  var nav = document.getElementById("site-nav");
  var navToggle = document.getElementById("nav-toggle");
  var colors = { light: "#f4f0e7", dark: "#12110f" };

  function currentTheme() {
    return root.getAttribute("data-theme") === "dark" ? "dark" : "light";
  }

  function storedTheme() {
    try {
      return localStorage.getItem("theme");
    } catch (error) {
      return null;
    }
  }

  function applyTheme(theme) {
    root.setAttribute("data-theme", theme);
    if (themeColor) themeColor.setAttribute("content", colors[theme]);
    if (themeButton) {
      var nextLabel = theme === "dark" ? "light" : "dark";
      themeButton.setAttribute("aria-label", "Switch to " + nextLabel + " theme");
    }
  }

  function setMenu(open) {
    if (!nav || !navToggle) return;
    nav.classList.toggle("is-open", open);
    navToggle.setAttribute("aria-expanded", open ? "true" : "false");
    var label = navToggle.querySelector(".nav-toggle-label");
    if (label) label.textContent = open ? "Close" : "Menu";
  }

  applyTheme(currentTheme());
  root.classList.add("theme-ready");

  if (themeButton) {
    themeButton.addEventListener("click", function () {
      var next = currentTheme() === "dark" ? "light" : "dark";
      applyTheme(next);
      try {
        localStorage.setItem("theme", next);
      } catch (error) {
        /* Storage can be blocked; the choice still applies for this view. */
      }
    });
  }

  var media = window.matchMedia("(prefers-color-scheme: dark)");
  if (typeof media.addEventListener === "function") {
    media.addEventListener("change", function (event) {
      var saved = storedTheme();
      if (saved === "light" || saved === "dark") return;
      applyTheme(event.matches ? "dark" : "light");
    });
  }

  if (nav && navToggle) {
    navToggle.addEventListener("click", function () {
      setMenu(!nav.classList.contains("is-open"));
    });

    document.addEventListener("click", function (event) {
      if (!nav.classList.contains("is-open")) return;
      if (nav.contains(event.target) || navToggle.contains(event.target)) return;
      setMenu(false);
    });

    document.addEventListener("keydown", function (event) {
      if (event.key !== "Escape") return;
      var modal = document.getElementById("game-modal");
      if (modal && !modal.hidden) return;
      setMenu(false);
    });

    nav.addEventListener("click", function (event) {
      if (event.target.closest("a")) setMenu(false);
    });

    window.addEventListener("resize", function () {
      if (window.matchMedia("(min-width: 861px)").matches) setMenu(false);
    });
  }

  var clock = document.getElementById("site-clock");
  if (clock) {
    var weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    var months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

    function pad(value) {
      return value < 10 ? "0" + value : String(value);
    }

    function renderClock() {
      var now = new Date();
      var hour = now.getHours();
      var suffix = hour >= 12 ? "PM" : "AM";
      hour = hour % 12;
      if (hour === 0) hour = 12;
      clock.textContent = weekdays[now.getDay()] + " " + months[now.getMonth()] + " " + now.getDate() + ", " + now.getFullYear() + " · " + hour + ":" + pad(now.getMinutes()) + ":" + pad(now.getSeconds()) + " " + suffix;
      clock.setAttribute("datetime", now.toISOString());
      window.setTimeout(renderClock, 1000 - now.getMilliseconds());
    }

    renderClock();
  }

  var gameCatalog = {
    helicopter: {
      title: "Helicopter",
      script: "assets/js/helicopter.js",
      key: "helicopter",
      html:
        "<div class=\"stage\" id=\"heli-stage\">" +
          "<canvas id=\"heli-canvas\" width=\"800\" height=\"500\" tabindex=\"0\" aria-label=\"Helicopter game canvas. Hold to climb through the cave.\"></canvas>" +
          "<div class=\"stage-overlay\" id=\"heli-overlay\">" +
            "<div class=\"stage-card\">" +
              "<p class=\"overlay-title\" id=\"heli-overlay-title\">Ready</p>" +
              "<p id=\"heli-overlay-text\">Hold on the game, or hold Space, to climb.</p>" +
              "<button class=\"fly-button\" id=\"heli-start\" type=\"button\">Fly</button>" +
            "</div>" +
          "</div>" +
        "</div>" +
        "<p class=\"scoreboard\">" +
          "<span>Distance <strong id=\"heli-score\">0</strong></span>" +
          "<span>Best <strong id=\"heli-best\">0</strong></span>" +
        "</p>" +
        "<p id=\"heli-live\" class=\"visually-hidden\" aria-live=\"polite\"></p>"
    },
    putt: {
      title: "Mini putt",
      embed: "https://cdn2.addictinggames.com/addictinggames-content/ag-assets/content-items/html5-games/miniputt/index.html",
      external: "https://www.addictinggames.com/sports/mini-putt",
      note: "The sports page blocks embedding, so this frame loads Addicting Games’ hosted mini putt. Switch to the on-site version if the frame stays blank.",
      script: "assets/js/putt.js",
      key: "putt",
      html:
        "<div class=\"stage\" id=\"putt-stage\">" +
          "<canvas id=\"putt-canvas\" width=\"800\" height=\"480\" tabindex=\"0\" aria-label=\"Mini putt green. Drag from the ball to aim and release to putt.\"></canvas>" +
          "<div class=\"stage-overlay\" id=\"putt-overlay\" hidden>" +
            "<div class=\"stage-card\">" +
              "<p class=\"overlay-title\" id=\"putt-overlay-title\">In the hole</p>" +
              "<p id=\"putt-overlay-text\"></p>" +
              "<button class=\"fly-button\" id=\"putt-next\" type=\"button\">Next hole</button>" +
            "</div>" +
          "</div>" +
        "</div>" +
        "<p class=\"scoreboard\">" +
          "<span>Hole <strong id=\"putt-hole\">1</strong> of 3</span>" +
          "<span id=\"putt-name\">Warm-up</span>" +
          "<span>Par <strong id=\"putt-par\">2</strong></span>" +
          "<span>This hole <strong id=\"putt-strokes\">0</strong></span>" +
          "<span>Round <strong id=\"putt-total\">0</strong></span>" +
        "</p>" +
        "<p id=\"putt-live\" class=\"visually-hidden\" aria-live=\"polite\"></p>"
    }
  };

  var gameModal = document.createElement("div");
  gameModal.className = "game-modal";
  gameModal.id = "game-modal";
  gameModal.hidden = true;
  gameModal.innerHTML = "<div class=\"game-modal-backdrop\" data-close-game></div>" +
    "<div class=\"game-modal-dialog\" role=\"dialog\" aria-modal=\"true\" aria-labelledby=\"game-modal-title\">" +
      "<div class=\"game-modal-bar\">" +
        "<h2 id=\"game-modal-title\"></h2>" +
        "<button type=\"button\" class=\"game-modal-close\" data-close-game>Close</button>" +
      "</div>" +
      "<div class=\"game-frame\" id=\"game-modal-frame\" hidden><iframe title=\"Game\" referrerpolicy=\"strict-origin-when-cross-origin\" allow=\"fullscreen; gamepad\"></iframe></div>" +
      "<div class=\"game-modal-play\" id=\"game-modal-play\"></div>" +
      "<p class=\"game-modal-note\" id=\"game-modal-note\" hidden></p>" +
      "<div class=\"game-modal-actions\" id=\"game-modal-actions\" hidden>" +
        "<button type=\"button\" class=\"fly-button\" id=\"game-source-toggle\">On-site version</button>" +
        "<a id=\"game-external\" href=\"https://www.addictinggames.com/sports/mini-putt\" target=\"_blank\" rel=\"noreferrer\">Addicting Games</a>" +
      "</div>" +
    "</div>";
  document.body.appendChild(gameModal);

  var gameTitle = document.getElementById("game-modal-title");
  var gamePlay = document.getElementById("game-modal-play");
  var gameFrame = document.getElementById("game-modal-frame");
  var gameIframe = gameFrame.querySelector("iframe");
  var gameNote = document.getElementById("game-modal-note");
  var gameActions = document.getElementById("game-modal-actions");
  var gameToggle = document.getElementById("game-source-toggle");
  var gameExternal = document.getElementById("game-external");
  var gameShell = document.querySelector(".shell");
  var gameOpener = null;
  var activeGame = null;
  var showingEmbed = false;
  var openToken = 0;
  var scriptLoads = {};

  function stopGames() {
    var games = window.SiteGames || {};
    if (games.helicopter && games.helicopter.stop) games.helicopter.stop();
    if (games.putt && games.putt.stop) games.putt.stop();
  }

  function loadGameScript(src) {
    if (scriptLoads[src]) return scriptLoads[src];
    scriptLoads[src] = new Promise(function (resolve, reject) {
      var script = document.createElement("script");
      script.src = src;
      script.onload = function () { resolve(); };
      script.onerror = function () { reject(); };
      document.body.appendChild(script);
    });
    return scriptLoads[src];
  }

  function ensureGame(game) {
    var api = window.SiteGames && window.SiteGames[game.key];
    if (api && api.mount) return Promise.resolve(api);
    return loadGameScript(game.script).then(function () {
      return window.SiteGames && window.SiteGames[game.key];
    });
  }

  function showGameError() {
    gamePlay.hidden = false;
    gamePlay.innerHTML = "<p class=\"game-modal-note\">The game did not load.</p>";
  }

  function showExtras(game, hosted) {
    if (!game.embed) {
      gameNote.hidden = true;
      gameActions.hidden = true;
      return;
    }
    gameNote.hidden = false;
    gameActions.hidden = false;
    gameNote.textContent = game.note;
    gameExternal.href = game.external;
    gameToggle.textContent = hosted ? "On-site version" : "Hosted game";
  }

  function showEmbed(game) {
    showingEmbed = true;
    stopGames();
    gamePlay.innerHTML = "";
    gamePlay.hidden = true;
    gameFrame.hidden = false;
    gameIframe.title = game.title;
    gameIframe.src = game.embed;
    showExtras(game, true);
    var closeButton = gameModal.querySelector(".game-modal-close");
    if (closeButton) closeButton.focus();
  }

  function showCanvas(game, token) {
    showingEmbed = false;
    gameFrame.hidden = true;
    gameIframe.src = "about:blank";
    gamePlay.hidden = false;
    showExtras(game, false);
    ensureGame(game).then(function (api) {
      if (token !== openToken || gameModal.hidden || showingEmbed || activeGame !== game) return;
      if (!api || !api.mount) {
        showGameError();
        return;
      }
      gamePlay.innerHTML = game.html;
      if (token !== openToken || gameModal.hidden || showingEmbed) {
        gamePlay.innerHTML = "";
        return;
      }
      api.mount(gamePlay);
      var canvas = gamePlay.querySelector("canvas");
      if (canvas && canvas.focus) canvas.focus({ preventScroll: true });
    }).catch(function () {
      if (token !== openToken || gameModal.hidden) return;
      showGameError();
    });
  }

  function openGame(id, opener) {
    var game = gameCatalog[id];
    if (!game) return;
    var token = ++openToken;
    gameOpener = opener || null;
    activeGame = game;
    stopGames();
    gamePlay.innerHTML = "";
    gameIframe.src = "about:blank";
    gameTitle.textContent = game.title;
    gameModal.hidden = false;
    document.body.classList.add("modal-open");
    try {
      if (gameShell) gameShell.inert = true;
    } catch (error) {}
    if (game.embed) showEmbed(game);
    else showCanvas(game, token);
  }

  function closeGame() {
    if (gameModal.hidden) return;
    openToken += 1;
    activeGame = null;
    showingEmbed = false;
    stopGames();
    gamePlay.innerHTML = "";
    gamePlay.hidden = false;
    gameFrame.hidden = true;
    gameIframe.src = "about:blank";
    gameNote.hidden = true;
    gameActions.hidden = true;
    gameModal.hidden = true;
    document.body.classList.remove("modal-open");
    try {
      if (gameShell) gameShell.inert = false;
    } catch (error) {}
    if (gameOpener && gameOpener.focus) gameOpener.focus();
    gameOpener = null;
  }

  document.addEventListener("click", function (event) {
    var trigger = event.target.closest("[data-game]");
    if (trigger) {
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
      event.preventDefault();
      openGame(trigger.getAttribute("data-game"), trigger);
      return;
    }
    if (event.target.closest("[data-close-game]")) closeGame();
  });

  gameToggle.addEventListener("click", function () {
    if (!activeGame) return;
    if (showingEmbed) showCanvas(activeGame, openToken);
    else if (activeGame.embed) showEmbed(activeGame);
  });

  // The hosted game is a cross-origin frame, so Escape would stay inside it.
  window.addEventListener("blur", function () {
    if (gameModal.hidden || !showingEmbed) return;
    window.setTimeout(function () {
      if (gameModal.hidden || !showingEmbed) return;
      if (document.activeElement !== gameIframe) return;
      var closeButton = gameModal.querySelector(".game-modal-close");
      if (closeButton && closeButton.focus) closeButton.focus({ preventScroll: true });
    }, 0);
  });

  document.addEventListener("keydown", function (event) {
    if (gameModal.hidden) return;
    if (event.key === "Escape") {
      event.preventDefault();
      closeGame();
    }
  });
})();
