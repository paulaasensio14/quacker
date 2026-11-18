import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const source = readFileSync(
  new URL("../../assets/js/app/whats-new.js", import.meta.url),
  "utf8"
);

const html = readFileSync(
  new URL("../../dashboard.html", import.meta.url),
  "utf8"
);

const core = readFileSync(
  new URL("../../assets/js/app/app-core.js", import.meta.url),
  "utf8"
);

function createHarness(initialState) {
  let state = { ...initialState };
  let marks = 0;

  const opens = [];
  const bindings = [];

  function makeElement() {
    return {
      hidden: false,
      textContent: "",
      children: [],
      listeners: {},

      replaceChildren() {
        this.children = [];
      },

      appendChild(child) {
        this.children.push(child);
      },

      addEventListener(type, callback) {
        this.listeners[type] = callback;
      },

      click() {
        this.listeners.click?.();
      }
    };
  }

  const ids = [
    "whatsNewModal",
    "whatsNewVersion",
    "whatsNewReleaseTitle",
    "whatsNewItems"
  ];

  const elements = Object.fromEntries(
    ids.map(id => [id, makeElement()])
  );

  const menu = makeElement();

  const document = {
    getElementById(id) {
      return elements[id] || null;
    },

    querySelector(selector) {
      return selector ===
        '.profile-menu-item[data-profile-action="whats-new"]'
          ? menu
          : null;
    },

    createElement() {
      return makeElement();
    }
  };

  const UIModal = {
    bind(id, options) {
      bindings.push({ id, options });
    },

    open(modal) {
      opens.push(modal);
      modal.hidden = false;
    },

    close(modal) {
      modal.hidden = true;
    }
  };

  const ApiClient = {
    async getWhatsNewUIState() {
      return state;
    },

    async markWhatsNewSeen() {
      marks += 1;
      state = {
        ...state,
        unseen: false
      };

      return state;
    }
  };

  const window = {};

  vm.runInNewContext(
    source,
    {
      window,
      document,
      UIModal,
      ApiClient,
      console
    },
    {
      filename: "whats-new.js",
      timeout: 3000
    }
  );

  return {
    module: window.WhatsNewModule,
    elements,
    menu,
    opens,
    bindings,

    get marks() {
      return marks;
    },

    close() {
      UIModal.close(elements.whatsNewModal);
    }
  };
}

const release = {
  version: "1.1.0",
  title: "Novedades simuladas",
  items: ["Contenido ficticio de prueba."]
};

test(
  "primera visita abre novedades y mantiene el acceso del menu",
  async () => {
    const h = createHarness({
      currentVersion: "1.1.0",
      available: true,
      unseen: true,
      release
    });

    await h.module.init();

    assert.equal(h.opens.length, 1);
    assert.equal(h.marks, 1);

    assert.equal(h.menu.hidden, false);

    assert.match(
      html,
      /data-profile-action="whats-new"/
    );

    assert.match(
      core,
      /case "whats-new":\s*\{\s*window\.WhatsNewModule\?\.open\?\.\(\)/
    );
  }
);

test(
  "cerrar y volver a abrir no marca novedades otra vez",
  async () => {
    const h = createHarness({
      currentVersion: "1.1.0",
      available: true,
      unseen: true,
      release
    });

    await h.module.init();

    assert.ok(
      h.bindings[0].options.closeSelectors.includes(
        "#closeWhatsNewModalFooter"
      )
    );

    h.close();

    assert.equal(
      h.elements.whatsNewModal.hidden,
      true
    );

    await h.module.open();

    assert.equal(h.opens.length, 2);
    assert.equal(h.marks, 1);

    h.close();

    await h.module.open();

    assert.equal(h.opens.length, 3);
    assert.equal(h.marks, 1);
  }
);

test(
  "version ya vista permite apertura manual sin autoabrir",
  async () => {
    const h = createHarness({
      currentVersion: "1.1.0",
      available: true,
      unseen: false,
      release
    });

    await h.module.init();

    assert.equal(h.opens.length, 0);
    assert.equal(h.marks, 0);
    assert.equal(h.menu.hidden, false);

    await h.module.open();

    assert.equal(h.opens.length, 1);
    assert.equal(h.marks, 0);
  }
);

test(
  "version candidata sin novedades conserva accesos ocultos",
  async () => {
    const h = createHarness({
      currentVersion: "1.1.0-rc.1",
      available: false,
      unseen: false,
      release: null
    });

    await h.module.init();
    await h.module.open();

    assert.equal(h.opens.length, 0);
    assert.equal(h.marks, 0);
    assert.equal(h.menu.hidden, true);
  }
);
