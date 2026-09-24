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
      embed: "https://www.addictinggames.com/embed/html5-games/16834",
      fallback: "helicopter.html?embed=1",
      external: "https://www.addictinggames.com/embed/html5-games/16834",
      externalLabel: "Open hosted game",
      note: "Hosted helicopter game. Switch to the on-site version if this frame stays blank."
    },
    putt: {
      title: "Mini putt",
      embed: "https://cdn2.addictinggames.com/addictinggames-content/ag-assets/content-items/html5-games/miniputt/index.html",
      fallback: "putt.html?embed=1",
      external: "https://www.addictinggames.com/sports/mini-putt",
      externalLabel: "Sports page",
      note: "The mini putt sports page blocks embedding, so this frame loads Addicting Games’ hosted game. The on-site version is the fallback."
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
      "<div class=\"game-frame\"><iframe title=\"Game\" referrerpolicy=\"strict-origin-when-cross-origin\" allow=\"fullscreen; gamepad\"></iframe></div>" +
      "<p class=\"game-modal-note\" id=\"game-modal-note\"></p>" +
      "<div class=\"game-modal-actions\">" +
        "<button type=\"button\" class=\"fly-button\" id=\"game-source-toggle\">On-site version</button>" +
        "<a id=\"game-external\" href=\"#\" target=\"_blank\" rel=\"noreferrer\">Open hosted game</a>" +
      "</div>" +
    "</div>";
  document.body.appendChild(gameModal);

  var gameFrame = gameModal.querySelector("iframe");
  var gameTitle = document.getElementById("game-modal-title");
  var gameNote = document.getElementById("game-modal-note");
  var gameToggle = document.getElementById("game-source-toggle");
  var gameExternal = document.getElementById("game-external");
  var gameShell = document.querySelector(".shell");
  var activeGame = null;
  var showingFallback = false;
  var gameOpener = null;

  function setGameSource(useFallback) {
    if (!activeGame) return;
    showingFallback = useFallback;
    gameFrame.src = useFallback ? activeGame.fallback : activeGame.embed;
    gameFrame.title = activeGame.title + (useFallback ? " on this site" : " hosted game");
    gameToggle.textContent = useFallback ? "Hosted game" : "On-site version";
  }

  function openGame(id, opener) {
    var game = gameCatalog[id];
    if (!game) return;
    activeGame = game;
    gameOpener = opener || null;
    gameTitle.textContent = game.title;
    gameNote.textContent = game.note;
    gameExternal.href = game.external;
    gameExternal.textContent = game.externalLabel;
    setGameSource(false);
    gameModal.hidden = false;
    document.body.classList.add("modal-open");
    try {
      if (gameShell) gameShell.inert = true;
    } catch (error) {}
    var closeButton = gameModal.querySelector(".game-modal-close");
    if (closeButton) closeButton.focus();
  }

  function closeGame() {
    if (gameModal.hidden) return;
    gameModal.hidden = true;
    gameFrame.src = "about:blank";
    activeGame = null;
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
    setGameSource(!showingFallback);
  });

  document.addEventListener("keydown", function (event) {
    if (gameModal.hidden) return;
    if (event.key === "Escape") {
      event.preventDefault();
      closeGame();
    }
  });
})();
