import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import vm from "node:vm";

const appCoreSource = fs.readFileSync(
  new URL("../../assets/js/app/app-core.js", import.meta.url),
  "utf8"
);

const startMarker = "// ===== SIDEBAR TOGGLE =====";
const endMarker =
  "// ===== PROFILE MENU (chip arriba derecha) =====";

const start = appCoreSource.indexOf(startMarker);
const end = appCoreSource.indexOf(endMarker, start);

assert.ok(start !== -1 && end > start);

const sidebarController = appCoreSource.slice(start, end);

function createHarness({ mobile }) {
  let collapsed = false;
  const attributes = new Map();
  const storage = new Map([
    ["quacker:sidebar-collapsed", "true"]
  ]);

  function createButton() {
    const listeners = new Map();

    return {
      addEventListener(type, handler) {
        const current = listeners.get(type) || [];
        current.push(handler);
        listeners.set(type, current);
      },
      setAttribute(name, value) {
        attributes.set(name, String(value));
      },
      click() {
        for (const handler of listeners.get("click") || []) {
          handler();
        }
      }
    };
  }

  const toggleButton = createButton();
  const navButton = createButton();

  const sidebar = {
    classList: {
      contains(name) {
        assert.equal(name, "collapsed");
        return collapsed;
      },
      toggle(name, force) {
        assert.equal(name, "collapsed");
        collapsed = Boolean(force);
        return collapsed;
      }
    }
  };

  const document = {
    getElementById(id) {
      if (id === "sidebar") return sidebar;
      if (id === "sidebarToggle") return toggleButton;
      return null;
    },
    querySelectorAll(selector) {
      assert.equal(
        selector,
        ".nav-item-btn[data-view]"
      );
      return [navButton];
    }
  };

  const window = {
    I18n: {
      t(key) {
        return key;
      }
    },
    localStorage: {
      getItem(key) {
        return storage.get(key) ?? null;
      },
      setItem(key, value) {
        storage.set(key, String(value));
      }
    },
    matchMedia(query) {
      assert.equal(query, "(max-width: 640px)");
      return { matches: mobile };
    }
  };

  vm.runInNewContext(
    sidebarController,
    { document, window },
    { filename: "app-core-sidebar.js" }
  );

  return {
    navButton,
    toggleButton,
    isCollapsed: () => collapsed,
    getAttribute: name => attributes.get(name),
    getStored: key => storage.get(key)
  };
}

test(
  "QA-007: al navegar en móvil se cierra el menú lateral",
  () => {
    const ui = createHarness({ mobile: true });

    assert.equal(ui.isCollapsed(), true);

    // El usuario abre el menú.
    ui.toggleButton.click();

    assert.equal(ui.isCollapsed(), false);

    // Selecciona una sección del menú.
    ui.navButton.click();

    assert.equal(
      ui.isCollapsed(),
      true,
      "QA-007: navegar en móvil debe plegar el menú"
    );

    assert.equal(
      ui.getAttribute("aria-expanded"),
      "false"
    );

    assert.equal(
      ui.getStored("quacker:sidebar-collapsed"),
      "true"
    );
  }
);

test(
  "QA-007: en escritorio navegar mantiene el menú abierto",
  () => {
    const ui = createHarness({ mobile: false });

    ui.toggleButton.click();

    assert.equal(ui.isCollapsed(), false);

    ui.navButton.click();

    assert.equal(
      ui.isCollapsed(),
      false,
      "la navegación en escritorio no debe plegar el menú"
    );
  }
);

test(
  "QA-007: navegar no abre un menú móvil ya plegado",
  () => {
    const ui = createHarness({ mobile: true });

    assert.equal(ui.isCollapsed(), true);

    ui.navButton.click();

    assert.equal(ui.isCollapsed(), true);
  }
);
