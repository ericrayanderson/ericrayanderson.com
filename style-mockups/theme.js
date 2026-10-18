(function () {
  var root = document.documentElement;
  var key = root.getAttribute("data-theme-key") || "mockup-theme";
  var button = document.getElementById("theme-toggle");
  var meta = document.getElementById("theme-color");
  var nav = document.getElementById("site-nav");
  var navToggle = document.getElementById("nav-toggle");
  var colors = {
    light: root.getAttribute("data-color-light") || "#ffffff",
    dark: root.getAttribute("data-color-dark") || "#111111"
  };

  function apply(theme) {
    root.setAttribute("data-theme", theme);
    if (meta) meta.setAttribute("content", colors[theme] || colors.light);
    if (button) {
      var next = theme === "dark" ? "light" : "dark";
      button.setAttribute("aria-label", "Switch to " + next + " theme");
      button.textContent = theme === "dark" ? "Light" : "Dark";
    }
  }

  var theme = root.getAttribute("data-default") === "dark" ? "dark" : "light";
  var followSystem = root.getAttribute("data-follow-system") !== "off";
  try {
    var stored = localStorage.getItem(key);
    if (stored === "light" || stored === "dark") theme = stored;
    else if (followSystem && window.matchMedia("(prefers-color-scheme: dark)").matches) theme = "dark";
  } catch (error) {}
  apply(theme);

  if (button) {
    button.addEventListener("click", function () {
      var next = root.getAttribute("data-theme") === "dark" ? "light" : "dark";
      apply(next);
      try {
        localStorage.setItem(key, next);
      } catch (error) {}
    });
  }

  function setMenu(open) {
    if (!nav || !navToggle) return;
    nav.classList.toggle("is-open", open);
    navToggle.setAttribute("aria-expanded", open ? "true" : "false");
    navToggle.textContent = open ? "Close" : "Menu";
  }

  if (nav && navToggle) {
    navToggle.addEventListener("click", function () {
      setMenu(!nav.classList.contains("is-open"));
    });
    nav.addEventListener("click", function (event) {
      if (event.target.closest("a")) setMenu(false);
    });
    window.addEventListener("resize", function () {
      if (window.matchMedia("(min-width: 860px)").matches) setMenu(false);
    });
  }
})();
