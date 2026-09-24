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
      if (event.key === "Escape") setMenu(false);
    });

    nav.addEventListener("click", function (event) {
      if (event.target.closest("a")) setMenu(false);
    });

    window.addEventListener("resize", function () {
      if (window.matchMedia("(min-width: 761px)").matches) setMenu(false);
    });
  }
})();
