import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import test from "node:test";

const source = fs.readFileSync(
  new URL(
    "../../assets/js/app/router.js",
    import.meta.url
  ),
  "utf8"
);

function createElement({ id, active = false, nav = false }) {
  const classes = new Set(active ? ["is-active"] : []);
  const handlers = new Map();

  return {
    dataset: nav ? { view: id } : { viewId: id },

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
          if (classes.has(name)) {
            classes.delete(name);
          } else {
            classes.add(name);
          }
        } else if (force) {
          classes.add(name);
        } else {
          classes.delete(name);
        }

        return classes.has(name);
      }
    },

    getAttribute(name) {
      return name === "data-view-id" ? id : null;
    },

    addEventListener(type, handler) {
      const existing = handlers.get(type) || [];
      existing.push(handler);
      handlers.set(type, existing);
    },

    click() {
      for (const handler of handlers.get("click") || []) {
        handler();
      }
    }
  };
}

function createHarness() {
  const store = new Map();
  const views = {};
  const nav = {};

  for (const id of ["home", "lists", "explore"]) {
    views[id] = createElement({
      id,
      active: id === "home"
    });

    nav[id] = createElement({
      id,
      nav: true,
      active: id === "home"
    });
  }

  const location = { hash: "" };

  const main = { scrollTop: 0 };

  const window = {
    location,

    sessionStorage: {
      getItem(key) {
        return store.get(key) ?? null;
      },

      setItem(key, value) {
        store.set(key, String(value));
      }
    },

    I18n: {
      t(key) {
        return key;
      }
    }
  };

  const document = {
    querySelectorAll(selector) {
      if (selector === ".view") {
        return Object.values(views);
      }

      if (
        selector === ".nav-item-btn[data-view]" ||
        selector === ".nav-item-btn"
      ) {
        return Object.values(nav);
      }

      if (selector === ".modal-overlay.is-open") {
        return [];
      }

      return [];
    },

    querySelector(selector) {
      if (selector === "main.app-main") {
        return main;
      }

      if (selector === ".view.is-active") {
        return Object.values(views).find(
          view => view.classList.contains("is-active")
        ) || null;
      }

      return null;
    },

    addEventListener() {},

    dispatchEvent() {}
  };

  const context = {
    window,
    document,

    history: {
      replaceState(_state, _title, hash) {
        location.hash = hash;
      }
    },

    CustomEvent: class {
      constructor(type, options) {
        this.type = type;
        this.detail = options?.detail;
      }
    },

    requestAnimationFrame(callback) {
      callback();
    },

    console
  };

  vm.runInNewContext(source, context, {
    filename: "router.js",
    timeout: 3000
  });

  const router = window.Router;
  assert.equal(typeof router?.init, "function");
  assert.equal(typeof router?.showView, "function");

  router.init();

  return {
    router,
    nav,
    views,
    location,

    activeNav() {
      return Object.entries(nav)
        .filter(
          ([, button]) =>
            button.classList.contains("is-active")
        )
        .map(([id]) => id);
    },

    activeViews() {
      return Object.entries(views)
        .filter(
          ([, view]) =>
            view.classList.contains("is-active")
        )
        .map(([id]) => id);
    }
  };
}

test(
  "QK-184-NAV: showView listas sincroniza menu automaticamente",
  () => {
    const h = createHarness();

    assert.deepEqual(h.activeNav(), ["home"]);

    h.router.showView("lists");

    assert.deepEqual(h.activeViews(), ["lists"]);

    assert.deepEqual(
      h.activeNav(),
      ["lists"],
      "El menu debe seleccionar Listas sin un clic"
    );
  }
);

test(
  "QK-184-NAV: showView inicio restaura menu automaticamente",
  () => {
    const h = createHarness();

    h.nav.lists.click();

    assert.deepEqual(h.activeNav(), ["lists"]);

    h.router.showView("home");

    assert.deepEqual(h.activeViews(), ["home"]);

    assert.deepEqual(
      h.activeNav(),
      ["home"],
      "El menu debe volver a seleccionar Inicio"
    );
  }
);

test(
  "QK-184-NAV: clic manual sigue actualizando menu",
  () => {
    const h = createHarness();

    h.nav.lists.click();

    assert.deepEqual(h.activeViews(), ["lists"]);
    assert.deepEqual(h.activeNav(), ["lists"]);

    h.nav.home.click();

    assert.deepEqual(h.activeViews(), ["home"]);
    assert.deepEqual(h.activeNav(), ["home"]);
  }
);

test(
  "QK-184-NAV: vista no registrada no cambia menu",
  () => {
    const h = createHarness();

    h.router.showView("vista-inexistente");

    assert.deepEqual(h.activeViews(), ["home"]);
    assert.deepEqual(h.activeNav(), ["home"]);
  }
);
