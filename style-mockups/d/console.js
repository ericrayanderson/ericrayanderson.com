(function () {
  var root = document.documentElement;
  var consoleEl = document.getElementById("console");
  var log = document.getElementById("log");
  var menuBtn = document.getElementById("menu-toggle");
  var menu = document.getElementById("corner-menu");
  var viewBtn = document.getElementById("view-toggle");
  var themeBtn = document.getElementById("theme-toggle");
  var meta = document.getElementById("theme-color");
  var normal = document.getElementById("normal-view");
  var corner = document.querySelector(".corner");
  if (!consoleEl || !log) return;

  var colors = { dark: "#1c1c1c", light: "#f7f6f3" };

  var commands = {
    projects: {
      line: "show projects",
      rows: [
        ["Learning Games", "Phonics, typing, and numbers.", "../../projects.html#learning-games"],
        ["shinymaterial", "Material Design for Shiny.", "../../projects.html#shinymaterial"],
        ["shinyglass", "Liquid glass themes.", "../../projects.html#shinyglass"]
      ]
    },
    games: {
      line: "show games",
      rows: [
        ["play helicopter", "Fly a cave.", "../../helicopter.html"],
        ["play putt", "Three holes.", "../../putt.html"],
        ["play dirtbike", "A short trail.", "../../dirtbike.html"],
        ["play learning", "Games for kids.", "https://ericrayanderson.github.io/learning-terminal/"]
      ]
    },
    about: {
      line: "about",
      rows: [
        ["Eric Anderson, Wake Forest, NC.", "A personal site with projects and tools.", "../../about.html"]
      ]
    },
    contact: {
      line: "contact",
      rows: [
        ["eric.ray.anderson@gmail.com", "Email", "mailto:eric.ray.anderson@gmail.com"],
        ["GitHub", "Code and projects", "https://github.com/ericrayanderson"]
      ]
    }
  };

  function applyTheme(theme) {
    root.setAttribute("data-theme", theme);
    if (meta) meta.setAttribute("content", colors[theme]);
    if (themeBtn) themeBtn.textContent = theme === "dark" ? "Light" : "Dark";
  }

  function setConsoleMode(on) {
    root.classList.toggle("is-console", on);
    consoleEl.hidden = !on;
    consoleEl.setAttribute("aria-hidden", "true");
    log.setAttribute("aria-hidden", "true");
    if (viewBtn) viewBtn.textContent = on ? "Normal view" : "Console";
    if (!normal) return;
    var links = normal.querySelectorAll("a");
    var i;
    for (i = 0; i < links.length; i++) {
      if (on) links[i].setAttribute("tabindex", "-1");
      else links[i].removeAttribute("tabindex");
    }
  }

  function closeMenu() {
    if (!menu || !menuBtn) return;
    menu.hidden = true;
    menuBtn.setAttribute("aria-expanded", "false");
  }

  function print(name) {
    var spec = commands[name];
    if (!spec) return;
    var block = document.createElement("section");
    block.className = "entry";

    var echo = document.createElement("p");
    echo.className = "echo";
    var gt = document.createElement("span");
    gt.className = "gt";
    gt.textContent = "eric>";
    echo.appendChild(gt);
    echo.appendChild(document.createTextNode(spec.line));
    block.appendChild(echo);

    var list = document.createElement("ul");
    list.className = "rows";
    spec.rows.forEach(function (row) {
      var item = document.createElement("li");
      var link = document.createElement("a");
      link.href = row[2];
      if (row[2].indexOf("github.com") !== -1) link.rel = "me";
      var label = document.createElement("span");
      label.textContent = row[0];
      var note = document.createElement("span");
      note.className = "note";
      note.textContent = row[1];
      link.appendChild(label);
      link.appendChild(note);
      item.appendChild(link);
      list.appendChild(item);
    });
    block.appendChild(list);
    log.appendChild(block);
    block.scrollIntoView({ block: "nearest" });
  }

  consoleEl.addEventListener("click", function (event) {
    var button = event.target.closest("button[data-cmd]");
    if (!button) return;
    print(button.getAttribute("data-cmd"));
  });

  if (menuBtn && menu) {
    menuBtn.hidden = false;
    menuBtn.addEventListener("click", function () {
      var open = menu.hidden;
      menu.hidden = !open;
      menuBtn.setAttribute("aria-expanded", open ? "true" : "false");
    });
    document.addEventListener("click", function (event) {
      if (corner && !corner.contains(event.target)) closeMenu();
    });
    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape") closeMenu();
    });
  }

  if (themeBtn) {
    themeBtn.addEventListener("click", function () {
      var next = root.getAttribute("data-theme") === "dark" ? "light" : "dark";
      applyTheme(next);
      try { localStorage.setItem("mockup-theme-d", next); } catch (error) {}
      closeMenu();
    });
  }

  if (viewBtn) {
    viewBtn.addEventListener("click", function () {
      setConsoleMode(!root.classList.contains("is-console"));
      closeMenu();
    });
  }

  try {
    var stored = localStorage.getItem("mockup-theme-d");
    if (stored === "light" || stored === "dark") applyTheme(stored);
  } catch (error) {}

  setConsoleMode(true);
  root.setAttribute("data-booted", "1");
})();
