(function () {
  var root = document.documentElement;
  var consoleEl = document.getElementById("console");
  var log = document.getElementById("log");
  var form = document.getElementById("prompt-form");
  var input = document.getElementById("prompt");
  var viewBtn = document.getElementById("view-toggle");
  var themeBtn = document.getElementById("theme-toggle");
  var meta = document.getElementById("theme-color");
  var normal = document.getElementById("normal-view");
  if (!consoleEl || !log || !input) return;

  var colors = { dark: "#1e1e1e", light: "#ffffff" };
  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var busy = false;
  var history = [];
  var histAt = -1;
  var draft = "";
  var tabMatches = [];
  var tabIndex = 0;
  var tabPrefix = "";

  var games = {
    helicopter: { href: "../../helicopter.html", label: "Helicopter" },
    putt: { href: "../../putt.html", label: "Mini putt" },
    dirtbike: { href: "../../dirtbike.html", label: "Dirt Trail" },
    learning: { href: "https://ericrayanderson.github.io/learning-terminal/", label: "Learning Terminal" }
  };

  var commands = ["help", "about", "projects", "games", "play", "contact", "github", "clear"];

  function sleep(ms) {
    return new Promise(function (resolve) { setTimeout(resolve, ms); });
  }

  function applyTheme(theme) {
    root.setAttribute("data-theme", theme);
    if (meta) meta.setAttribute("content", colors[theme]);
    if (themeBtn) themeBtn.textContent = theme === "dark" ? "Light" : "Dark";
  }

  function setConsoleMode(on) {
    root.classList.toggle("is-console", on);
    consoleEl.hidden = !on;
    consoleEl.setAttribute("aria-hidden", "true");
    if (viewBtn) viewBtn.textContent = on ? "Normal view" : "Console";
    if (!normal) return;
    var links = normal.querySelectorAll("a");
    var i;
    for (i = 0; i < links.length; i++) {
      if (on) links[i].setAttribute("tabindex", "-1");
      else links[i].removeAttribute("tabindex");
    }
  }

  function scrollLog() {
    log.scrollTop = log.scrollHeight;
  }

  function addNode(node) {
    log.appendChild(node);
    scrollLog();
    return node;
  }

  function addLine(text, className) {
    var p = document.createElement("p");
    p.className = className || "out";
    p.textContent = text;
    return addNode(p);
  }

  async function typeText(node, text) {
    if (!text) {
      node.textContent = "\u00a0";
      scrollLog();
      return;
    }
    node.textContent = "";
    if (reduced) {
      node.textContent = text;
      scrollLog();
      return;
    }
    var i;
    for (i = 0; i < text.length; i++) {
      node.textContent += text.charAt(i);
      if (i % 2 === 0) scrollLog();
      await sleep(12);
    }
    scrollLog();
  }

  async function typePrompt(text) {
    input.value = "";
    if (reduced) {
      input.value = text;
      return;
    }
    var i;
    for (i = 0; i < text.length; i++) {
      input.value += text.charAt(i);
      await sleep(28);
    }
  }

  function echo(command) {
    var p = document.createElement("p");
    p.className = "echo";
    var gt = document.createElement("span");
    gt.className = "gt";
    gt.textContent = ">";
    p.appendChild(gt);
    p.appendChild(document.createTextNode(command));
    addNode(p);
  }

  function link(href, label) {
    var a = document.createElement("a");
    a.href = href;
    a.textContent = label;
    return a;
  }

  function tibble(count, cols, rows) {
    var wrap = document.createElement("div");
    wrap.className = "tibble";
    var metaLine = document.createElement("p");
    metaLine.className = "tibble-meta";
    metaLine.textContent = "# A tibble: " + count + " x " + cols;
    wrap.appendChild(metaLine);

    var table = document.createElement("table");
    var thead = document.createElement("thead");
    var names = document.createElement("tr");
    var types = document.createElement("tr");
    types.className = "types";
    var blank = document.createElement("th");
    blank.className = "rn";
    blank.textContent = "";
    names.appendChild(blank);
    var blankType = document.createElement("th");
    blankType.className = "rn";
    types.appendChild(blankType);
    ["name", "what", "where"].forEach(function (col) {
      var th = document.createElement("th");
      th.textContent = col;
      names.appendChild(th);
      var ty = document.createElement("th");
      ty.textContent = "<chr>";
      types.appendChild(ty);
    });
    thead.appendChild(names);
    thead.appendChild(types);
    table.appendChild(thead);

    var tbody = document.createElement("tbody");
    rows.forEach(function (row, index) {
      var tr = document.createElement("tr");
      var num = document.createElement("td");
      num.className = "rn";
      num.textContent = String(index + 1);
      tr.appendChild(num);
      var name = document.createElement("td");
      name.appendChild(link(row.href, row.name));
      var what = document.createElement("td");
      what.textContent = row.what;
      var where = document.createElement("td");
      where.appendChild(link(row.href, row.where));
      tr.appendChild(name);
      tr.appendChild(what);
      tr.appendChild(where);
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    wrap.appendChild(table);
    addNode(wrap);
  }

  var aliases = {
    help: "help",
    "?": "help",
    man: "help",
    about: "about",
    who: "about",
    whoami: "about",
    projects: "projects",
    project: "projects",
    games: "games",
    game: "games",
    contact: "contact",
    email: "contact",
    mail: "contact",
    github: "github",
    gh: "github",
    clear: "clear",
    cls: "clear",
    play: "play",
    ls: "ls",
    dir: "ls"
  };

  function helpText() {
    return [
      "help()       these commands",
      "about()      a short note",
      "projects()   games and R packages",
      "games()      browser games",
      "play(\"name\") helicopter, putt,",
      "             dirtbike, learning",
      "contact()    email",
      "github()     open GitHub",
      "clear()      clear the screen",
      "",
      "Words or calls both work, any case.",
      "Try projects, ls, cd games, or ?."
    ].join("\n");
  }

  function clean(value) {
    return String(value || "").toLowerCase().replace(/^\s+|\s+$/g, "").replace(/\s+/g, " ");
  }

  function gameKey(value) {
    var key = clean(value).replace(/[\s_-]+/g, "");
    if (key === "helicopter" || key === "heli" || key === "copter") return "helicopter";
    if (key === "putt" || key === "miniputt" || key === "golf" || key === "minigolf") return "putt";
    if (key === "dirtbike" || key === "dirt" || key === "dirttrail" || key === "bike" || key === "trail") return "dirtbike";
    if (key === "learning" || key === "learningterminal" || key === "terminal" || key === "learn") return "learning";
    return "";
  }

  function commandName(value) {
    var key = clean(value).replace(/[()]/g, "");
    if (aliases[key]) return aliases[key];
    if (gameKey(key)) return "play";
    return "";
  }

  function dist(a, b) {
    var s = a.length;
    var t = b.length;
    var d = [];
    var i, j;
    for (i = 0; i <= s; i++) {
      d[i] = [i];
    }
    for (j = 1; j <= t; j++) d[0][j] = j;
    for (i = 1; i <= s; i++) {
      for (j = 1; j <= t; j++) {
        var cost = a.charAt(i - 1) === b.charAt(j - 1) ? 0 : 1;
        d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
      }
    }
    return d[s][t];
  }

  function suggest(raw) {
    var token = clean(raw).replace(/\(.*$/, "").replace(/[^a-z]/g, "");
    if (!token) return "help()";
    if (token === "cd") return "cd games";
    if (token.indexOf("heli") === 0 || token === "copter") return "play(\"helicopter\")";
    if (token === "putt" || token === "golf") return "play(\"putt\")";
    if (token.indexOf("dirt") === 0 || token === "bike") return "play(\"dirtbike\")";
    if (token.indexOf("learn") === 0 || token === "terminal") return "play(\"learning\")";
    var names = ["help", "about", "projects", "games", "play", "contact", "github", "clear", "ls"];
    var best = names[0];
    var bestD = dist(token, best);
    var i;
    for (i = 1; i < names.length; i++) {
      var score = dist(token, names[i]);
      if (score < bestD) {
        best = names[i];
        bestD = score;
      }
    }
    if (best === "play") return "play(\"helicopter\")";
    if (best === "ls") return "ls";
    return best + "()";
  }

  function parse(raw) {
    var s = clean(raw);
    if (!s) return null;
    if (s === "?" || s === "??") return { cmd: "help" };

    var asked = s.match(/^\?\s*([a-z][a-z0-9.]*)\s*(?:\(\s*\))?$/);
    if (asked) return { cmd: "help" };

    var called = s.match(/^([a-z?][a-z0-9.]*)\s*\(\s*["']?([^"']*?)["']?\s*\)$/);
    if (called) {
      var calledName = commandName(called[1]);
      var calledArg = clean(called[2]);
      if (calledName === "play") return { cmd: "play", arg: calledArg };
      if (calledArg && (calledName === "ls" || called[1] === "cd" || called[1] === "open" || called[1] === "show")) {
        return { cmd: calledName === "ls" ? "ls" : "cd", arg: calledArg };
      }
      if (calledName && !calledArg) return { cmd: calledName };
    }

    var played = s.match(/^play\s+(.+)$/);
    if (played) return { cmd: "play", arg: clean(played[1]) };

    var headed = s.match(/^(cd|ls|dir|open|show)\s+(.+)$/);
    if (headed) {
      var head = headed[1] === "ls" || headed[1] === "dir" ? "ls" : "cd";
      return { cmd: head, arg: clean(headed[2]) };
    }

    if (s === "cd") return { cmd: "cd", arg: "" };
    if (s === "ls" || s === "dir") return { cmd: "ls", arg: "" };

    var bare = s.match(/^([a-z?][a-z0-9.]*)\s*(?:\(\s*\))?$/);
    if (!bare) return null;
    var name = commandName(bare[1]);
    if (name === "play" && gameKey(bare[1])) return { cmd: "play", arg: bare[1] };
    if (name) return { cmd: name };
    return null;
  }

  function showAbout() {
    addLine("Eric Anderson, Wake Forest, NC. A personal site with projects and tools. He works in R with the tidyverse and Shiny, and wrote shinymaterial and shinyglass.");
  }

  function showProjects() {
    tibble(3, 3, [
      {
        name: "Learning Games",
        what: "Phonics, typing, spelling, and number games for kids.",
        where: "projects",
        href: "../../projects.html#learning-games"
      },
      {
        name: "shinymaterial",
        what: "Material Design components for Shiny.",
        where: "CRAN",
        href: "https://cran.r-project.org/package=shinymaterial"
      },
      {
        name: "shinyglass",
        what: "Liquid glass themes for Shiny.",
        where: "CRAN",
        href: "https://cran.r-project.org/package=shinyglass"
      }
    ]);
  }

  function showGames() {
    tibble(4, 3, [
      {
        name: "Helicopter",
        what: "Fly a cave. Hold to climb, release to drop.",
        where: "play",
        href: games.helicopter.href
      },
      {
        name: "Mini putt",
        what: "Three holes of miniature golf. Drag to aim, then release to putt.",
        where: "play",
        href: games.putt.href
      },
      {
        name: "Dirt Trail",
        what: "Ride three short courses. Accelerate, brake, and lean.",
        where: "play",
        href: games.dirtbike.href
      },
      {
        name: "Learning Terminal",
        what: "Phonics, typing, spelling, and number games for kids.",
        where: "play",
        href: games.learning.href
      }
    ]);
  }

  function showContact() {
    var p = document.createElement("p");
    p.className = "out";
    p.appendChild(document.createTextNode("Email "));
    p.appendChild(link("mailto:eric.ray.anderson@gmail.com", "eric.ray.anderson@gmail.com"));
    addNode(p);
  }

  function openGithub() {
    addLine("Opening GitHub.");
    window.location.href = "https://github.com/ericrayanderson";
  }

  function openGame(key) {
    var game = games[key];
    if (!game) {
      addLine("Did you mean play(\"helicopter\")?");
      return;
    }
    addLine("Opening " + game.label + ".");
    window.location.href = game.href;
  }

  function showLs(arg) {
    if (!arg) {
      addLine([
        "projects   games and R packages",
        "games      browser games",
        "about      a short note",
        "contact    email",
        "github     GitHub"
      ].join("\n"));
      return;
    }
    var key = gameKey(arg);
    if (key) {
      addLine("play(\"" + key + "\") opens " + games[key].label + ".");
      return;
    }
    var name = commandName(arg);
    if (name === "projects") return showProjects();
    if (name === "games") return showGames();
    if (name === "about") return showAbout();
    if (name === "contact") return showContact();
    if (name === "help") return addLine(helpText());
    if (name === "github") {
      addLine("github() opens GitHub.");
      return;
    }
    addLine("Did you mean ls, or cd games?");
  }

  function go(arg) {
    if (!arg || arg === ".." || arg === "~" || arg === "home" || arg === "/") {
      addLine("You are already home. Try cd projects or cd games.");
      return;
    }
    var key = gameKey(arg);
    if (key) return openGame(key);
    var name = commandName(arg);
    if (name === "projects") return showProjects();
    if (name === "games") return showGames();
    if (name === "about") return showAbout();
    if (name === "contact") return showContact();
    if (name === "github") return openGithub();
    if (name === "help") return addLine(helpText());
    addLine("Did you mean cd games?");
  }

  function run(command) {
    var trimmed = command.trim();
    if (!trimmed) return;
    history.push(trimmed);
    histAt = history.length;
    draft = "";
    echo(trimmed);
    input.value = "";

    var parsed = parse(trimmed);
    if (!parsed) {
      addLine("Did you mean " + suggest(trimmed) + "?");
      return;
    }
    if (parsed.cmd === "help") return addLine(helpText());
    if (parsed.cmd === "about") return showAbout();
    if (parsed.cmd === "projects") return showProjects();
    if (parsed.cmd === "games") return showGames();
    if (parsed.cmd === "contact") return showContact();
    if (parsed.cmd === "github") return openGithub();
    if (parsed.cmd === "clear") {
      log.textContent = "";
      return;
    }
    if (parsed.cmd === "ls") return showLs(parsed.arg || "");
    if (parsed.cmd === "cd") return go(parsed.arg || "");
    if (parsed.cmd === "play") {
      var key = gameKey(parsed.arg);
      if (!key) {
        addLine("Did you mean play(\"helicopter\")?");
        return;
      }
      return openGame(key);
    }
    addLine("Did you mean " + suggest(trimmed) + "?");
  }

  async function typeAndRun(command) {
    busy = true;
    await typePrompt(command);
    run(command);
    busy = false;
    scrollLog();
  }

  function unlockPrompt() {
    input.readOnly = false;
    input.setAttribute("inputmode", "text");
    input.focus();
  }

  function lockPrompt() {
    input.readOnly = true;
    input.setAttribute("inputmode", "none");
    input.blur();
  }

  input.addEventListener("pointerdown", function () {
    unlockPrompt();
  });

  form.addEventListener("submit", function (event) {
    event.preventDefault();
    if (busy) return;
    run(input.value);
  });

  input.addEventListener("keydown", function (event) {
    if (input.readOnly && event.key.length === 1 && !event.metaKey && !event.ctrlKey && !event.altKey) {
      input.readOnly = false;
      input.setAttribute("inputmode", "text");
    }
    if (event.key === "Tab") {
      event.preventDefault();
      var current = input.value;
      var continuing = tabMatches.length > 0 && current === tabMatches[tabIndex];
      var prefix = continuing ? tabPrefix : current;
      var matches = [];
      var pool = commands.map(function (name) {
        return name === "play" ? "play(\"helicopter\")" : name + "()";
      });
      ["play(\"putt\")", "play(\"dirtbike\")", "play(\"learning\")"].forEach(function (item) {
        pool.push(item);
      });
      var i;
      for (i = 0; i < pool.length; i++) {
        if (pool[i].toLowerCase().indexOf(prefix.toLowerCase()) === 0) matches.push(pool[i]);
      }
      if (!matches.length) return;
      tabPrefix = prefix;
      tabMatches = matches;
      tabIndex = continuing ? (tabIndex + 1) % matches.length : 0;
      input.value = matches[tabIndex];
      return;
    }
    tabMatches = [];
    tabPrefix = "";
    if (event.key === "ArrowUp") {
      event.preventDefault();
      if (!history.length) return;
      if (histAt === history.length) draft = input.value;
      histAt = Math.max(0, histAt - 1);
      input.value = history[histAt];
      return;
    }
    if (event.key === "ArrowDown") {
      event.preventDefault();
      if (histAt >= history.length) return;
      histAt += 1;
      input.value = histAt >= history.length ? draft : history[histAt];
    }
  });

  var chips = document.querySelectorAll("[data-cmd]");
  var c;
  for (c = 0; c < chips.length; c++) {
    chips[c].addEventListener("click", function (event) {
      var cmd = event.currentTarget.getAttribute("data-cmd");
      if (busy || !cmd) return;
      lockPrompt();
      typeAndRun(cmd);
    });
  }

  if (themeBtn) {
    themeBtn.hidden = false;
    themeBtn.addEventListener("click", function () {
      var next = root.getAttribute("data-theme") === "dark" ? "light" : "dark";
      applyTheme(next);
      try { localStorage.setItem("mockup-theme-d", next); } catch (error) {}
    });
  }

  if (viewBtn) {
    viewBtn.hidden = false;
    viewBtn.addEventListener("click", function () {
      var on = !root.classList.contains("is-console");
      setConsoleMode(on);
    });
  }

  try {
    var stored = localStorage.getItem("mockup-theme-d");
    if (stored === "light" || stored === "dark") applyTheme(stored);
  } catch (error) {}

  setConsoleMode(true);

  (async function boot() {
    busy = true;
    var lines = [
      "R console",
      "",
      "Eric Anderson",
      "Wake Forest, NC",
      "",
      "Type 'help()' for help."
    ];
    var i;
    for (i = 0; i < lines.length; i++) {
      var node = addLine("");
      await typeText(node, lines[i]);
    }
    await typePrompt("help()");
    run("help()");
    busy = false;
    root.setAttribute("data-booted", "1");
    scrollLog();
  })();
})();
