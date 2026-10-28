import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const app = fs.readFileSync(
  new URL("../../assets/js/app/app-core.js", import.meta.url),
  "utf8"
);

const routerSource = fs.readFileSync(
  new URL("../../assets/js/app/router.js", import.meta.url),
  "utf8"
);

const moderationSource = fs.readFileSync(
  new URL("../../assets/js/app/moderation.js", import.meta.url),
  "utf8"
);

function createHarness({
  authorized = true,
  hash = "#moderation"
} = {}) {
  const listeners = new Map();
  const requests = [];

  function element(id, viewId = "", active = false) {
    const classes = new Set(
      active ? ["view", "is-active"] : ["view"]
    );

    return {
      id,
      dataset: viewId ? { viewId } : {},
      hidden: false,
      disabled: false,
      scrollTop: 0,
      textContent: "",
      handlers: {},
      classList: {
        add(name) {
          classes.add(name);
        },
        remove(name) {
          classes.delete(name);
        },
        contains(name) {
          return classes.has(name);
        },
        toggle(name, force) {
          if (force === undefined) {
            force = !classes.has(name);
          }
          if (force) classes.add(name);
          else classes.delete(name);
          return force;
        }
      },
      getAttribute(name) {
        if (name === "data-view-id") {
          return this.dataset.viewId || null;
        }
        return null;
      },
      addEventListener(type, handler) {
        this.handlers[type] = handler;
      },
      replaceChildren() {}
    };
  }

  const home = element("view-home", "home", true);
  const moderation = element("view-moderation");
  const moderationNav = element("moderationNavItem");
  moderationNav.hidden = true;

  const navButton = element("moderationButton");
  navButton.dataset.view = "moderation";

  const status = element("moderationReportsStatus");
  const list = element("moderationReportsList");
  const refresh = element("moderationReportsRefresh");

  const views = [home, moderation];

  const elements = new Map([
    ["moderationNavItem", moderationNav],
    ["view-moderation", moderation],
    ["moderationReportsStatus", status],
    ["moderationReportsList", list],
    ["moderationReportsRefresh", refresh]
  ]);

  const window = {
    location: { hash },
    I18n: {
      t(key) { return key; }
    },
    sessionStorage: {
      getItem() { return null; },
      setItem() {}
    }
  };

  const document = {
    getElementById(id) {
      return elements.get(id) || null;
    },
    querySelector(selector) {
      if (selector === ".view.is-active") {
        return views.find(
          (view) => view.classList.contains("is-active")
        ) || null;
      }
      return null;
    },
    querySelectorAll(selector) {
      if (selector === ".view") return views;
      if (
        selector === ".nav-item-btn[data-view]" ||
        selector === ".nav-item-btn"
      ) {
        return [navButton];
      }
      return [];
    },
    addEventListener(name, handler) {
      const handlers = listeners.get(name) || [];
      handlers.push(handler);
      listeners.set(name, handlers);
    },
    dispatchEvent(event) {
      for (const handler of listeners.get(event.type) || []) {
        handler(event);
      }
    }
  };

  const context = {
    window,
    document,
    history: {
      replaceState(_state, _unused, nextHash) {
        window.location.hash = nextHash;
      }
    },
    requestAnimationFrame(callback) {
      callback();
    },
    CustomEvent: class {
      constructor(type, options = {}) {
        this.type = type;
        this.detail = options.detail;
      }
    },
    ApiClient: {
      async getModeratorAccess() {
        requests.push("access");
        return { isModerator: authorized };
      },
      async getModerationReports() {
        requests.push("reports");
        return { totalPending: 0, reports: [] };
      }
    },
    console
  };

  vm.runInNewContext(
    routerSource,
    context,
    { filename: "router.js" }
  );

  vm.runInNewContext(
    moderationSource,
    context,
    { filename: "moderation.js" }
  );

  return {
    window,
    home,
    moderation,
    moderationNav,
    navButton,
    requests
  };
}

test("el bootstrap conserva autorización y restauración", () => {
  const authorization =
    app.indexOf("window.ModerationModule?.init?.()");

  const condition =
    app.indexOf("if (restoreModeration)");

  const awaited =
    app.indexOf("await moderationInit");

  const restoration =
    app.indexOf("Router.init();");

  assert.ok(authorization >= 0);
  assert.ok(condition > authorization);
  assert.ok(awaited > condition);
  assert.ok(restoration > awaited);

  assert.ok(
    app.includes("moderationInit?.catch?.")
  );
});

function createBootstrapHarness({
  hash = "#home",
  storedView = ""
} = {}) {
  const calls = [];
  let onLoad = null;
  let completePermissionCheck;

  const permissionCheck = new Promise((resolve) => {
    completePermissionCheck = resolve;
  });

  const startMarker =
    'document.addEventListener("DOMContentLoaded", async () => {';

  const endMarker =
    "  // 2) Iniciar módulos después";

  const start = app.indexOf(startMarker);
  const end = app.indexOf(endMarker, start);

  assert.ok(start >= 0);
  assert.ok(end > start);

  // Ejecutamos el arranque real hasta Router.init,
  // sin inicializar los módulos no relacionados.
  const bootstrapSource =
    app.slice(start, end) + "\n});\n";

  const context = {
    document: {
      addEventListener(type, callback) {
        if (type === "DOMContentLoaded") {
          onLoad = callback;
        }
      }
    },
    window: {
      location: {
        hash,
        href: ""
      },
      sessionStorage: {
        getItem(key) {
          return key === "quacker:last-view"
            ? storedView
            : null;
        }
      },
      I18n: {
        init() {},
        setLang() {}
      },
      ModerationModule: {
        init() {
          calls.push("permissions");
          return permissionCheck;
        }
      }
    },
    localStorage: {
      getItem() {
        return "es";
      }
    },
    UITheme: {
      async init() {}
    },
    ApiClient: {
      async getCurrentSession() {
        return {
          user: {
            language: "es"
          }
        };
      }
    },
    Router: {
      init() {
        calls.push("router");
      }
    },
    console: {
      error() {
        calls.push("error");
      }
    }
  };

  vm.runInNewContext(
    bootstrapSource,
    context,
    { filename: "app-core-bootstrap.js" }
  );

  assert.equal(typeof onLoad, "function");

  return {
    calls,
    start: onLoad,
    finishAuthorization: completePermissionCheck
  };
}

test("Inicio no espera una comprobación de permisos lenta", async () => {
  const h = createBootstrapHarness({
    hash: "#home"
  });

  const startup = h.start();

  await new Promise((resolve) =>
    setImmediate(resolve)
  );

  try {
    assert.deepEqual(
      h.calls,
      ["permissions", "router"]
    );
  } finally {
    h.finishAuthorization();
    await startup;
  }
});

test("Inicio explícito prevalece sobre Moderación guardada", async () => {
  const h = createBootstrapHarness({
    hash: "#home",
    storedView: "moderation"
  });

  const startup = h.start();

  await new Promise((resolve) =>
    setImmediate(resolve)
  );

  try {
    assert.deepEqual(
      h.calls,
      ["permissions", "router"]
    );
  } finally {
    h.finishAuthorization();
    await startup;
  }
});

test("Explorar explícito no espera permisos administrativos", async () => {
  const h = createBootstrapHarness({
    hash: "#explore",
    storedView: "moderation"
  });

  const startup = h.start();

  await new Promise((resolve) =>
    setImmediate(resolve)
  );

  try {
    assert.deepEqual(
      h.calls,
      ["permissions", "router"]
    );
  } finally {
    h.finishAuthorization();
    await startup;
  }
});

test("Moderación sí espera autorización antes del router", async () => {
  const h = createBootstrapHarness({
    hash: "#moderation"
  });

  const startup = h.start();

  await new Promise((resolve) =>
    setImmediate(resolve)
  );

  try {
    assert.deepEqual(
      h.calls,
      ["permissions"]
    );
  } finally {
    h.finishAuthorization();
    await startup;
  }

  assert.deepEqual(
    h.calls,
    ["permissions", "router"]
  );
});

test("una vista administrativa guardada también espera", async () => {
  const h = createBootstrapHarness({
    hash: "",
    storedView: "moderation"
  });

  const startup = h.start();

  await new Promise((resolve) =>
    setImmediate(resolve)
  );

  try {
    assert.deepEqual(
      h.calls,
      ["permissions"]
    );
  } finally {
    h.finishAuthorization();
    await startup;
  }

  assert.deepEqual(
    h.calls,
    ["permissions", "router"]
  );
});

test("un moderador recupera su vista al recargar", async () => {
  const h = createHarness();

  await h.window.ModerationModule.init();
  h.window.Router.init();

  assert.equal(h.window.location.hash, "#moderation");
  assert.equal(h.moderationNav.hidden, false);
  assert.equal(
    h.moderation.classList.contains("is-active"),
    true
  );
  assert.ok(h.requests.includes("reports"));
});

test("un usuario sin permisos no recupera moderación", async () => {
  const h = createHarness({ authorized: false });

  await h.window.ModerationModule.init();
  h.window.Router.init();

  assert.equal(h.moderationNav.hidden, true);
  assert.equal(h.window.location.hash, "#home");
  assert.equal(
    h.home.classList.contains("is-active"),
    true
  );
  assert.equal(h.requests.includes("reports"), false);
});

test("abrir el panel desde Inicio carga la bandeja", async () => {
  const h = createHarness({ hash: "#home" });

  await h.window.ModerationModule.init();
  h.window.Router.init();

  assert.equal(h.requests.includes("reports"), false);

  h.navButton.handlers.click();

  assert.equal(h.window.location.hash, "#moderation");
  assert.ok(h.requests.includes("reports"));
});
