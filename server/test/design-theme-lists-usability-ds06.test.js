import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const themeSource = fs.readFileSync(
  new URL("../../assets/js/app/ui-theme.js", import.meta.url),
  "utf8"
);

const i18nSource = fs.readFileSync(
  new URL("../../assets/js/app/i18n.js", import.meta.url),
  "utf8"
);

const controlsCss = fs.readFileSync(
  new URL("../../assets/css/design-controls.css", import.meta.url),
  "utf8"
);

function makeClassList() {
  const classes = new Set();

  return {
    toggle(name, force) {
      const active =
        force === undefined ? !classes.has(name) : !!force;

      if (active) classes.add(name);
      else classes.delete(name);

      return active;
    },

    contains(name) {
      return classes.has(name);
    }
  };
}

async function createThemeRuntime({
  initialTheme = "light",
  language = "es",
  failPersist = false
} = {}) {
  const listeners = new Map();

  const label = {
    dataset: { i18n: "theme_light" },
    textContent: "Modo claro"
  };

  const toggle = {
    classList: makeClassList(),
    addEventListener(name, callback) {
      listeners.set(name, callback);
    }
  };

  const body = {
    classList: makeClassList()
  };

  const document = {
    body,
    querySelector(selector) {
      if (selector === "[data-theme-toggle]") {
        return toggle;
      }

      if (selector.startsWith(".theme-row")) {
        return label;
      }

      return null;
    },

    addEventListener() {}
  };

  const translations = {
    es: {
      theme_light: "Modo claro",
      theme_dark: "Modo oscuro"
    },
    en: {
      theme_light: "Light mode",
      theme_dark: "Dark mode"
    }
  };

  const I18n = {
    t(key) {
      return translations[language]?.[key] || key;
    }
  };

  const window = {
    I18n,
    toast() {}
  };

  const ApiClient = {
    async getUserPreferences() {
      return { theme: initialTheme };
    },

    async setUserTheme() {
      if (failPersist) {
        throw new Error("fallo de persistencia simulado");
      }

      return { ok: true };
    }
  };

  const context = vm.createContext({
    document,
    window,
    ApiClient,
    console: {
      error() {}
    }
  });

  vm.runInContext(
    themeSource + "\n globalThis.__theme = UITheme;",
    context
  );

  await context.__theme.init();

  return {
    label,
    body,
    toggle,

    async click() {
      const callback = listeners.get("click");

      assert.equal(typeof callback, "function");

      await callback();
    },

    translate(nextLanguage) {
      language = nextLanguage;
      label.textContent = I18n.t(label.dataset.i18n);
    }
  };
}

test(
  "DS-06 tema: existen las traducciones del modo oscuro",
  () => {
    assert.match(
      i18nSource,
      /theme_dark:\s*"Modo oscuro"/
    );

    assert.match(
      i18nSource,
      /theme_dark:\s*"Dark mode"/
    );
  }
);

test(
  "DS-06 tema: inicio en oscuro muestra Modo oscuro",
  async () => {
    const app = await createThemeRuntime({
      initialTheme: "dark"
    });

    assert.equal(
      app.body.classList.contains("dark-theme"),
      true
    );

    assert.equal(app.label.dataset.i18n, "theme_dark");
    assert.equal(app.label.textContent, "Modo oscuro");
  }
);

test(
  "DS-06 tema: cambiar de claro a oscuro actualiza texto",
  async () => {
    const app = await createThemeRuntime();

    await app.click();

    assert.equal(
      app.body.classList.contains("dark-theme"),
      true
    );

    assert.equal(app.label.dataset.i18n, "theme_dark");
    assert.equal(app.label.textContent, "Modo oscuro");
  }
);

test(
  "DS-06 tema: rollback restaura el texto oscuro",
  async () => {
    const app = await createThemeRuntime({
      initialTheme: "dark",
      failPersist: true
    });

    await app.click();

    assert.equal(
      app.body.classList.contains("dark-theme"),
      true
    );

    assert.equal(app.label.dataset.i18n, "theme_dark");
    assert.equal(app.label.textContent, "Modo oscuro");
  }
);

test(
  "DS-06 tema: cambiar idioma respeta tema activo",
  async () => {
    const app = await createThemeRuntime({
      initialTheme: "dark"
    });

    app.translate("en");

    assert.equal(app.label.textContent, "Dark mode");
  }
);

test(
  "DS-06 listas: contador seleccionado contrasta en oscuro",
  () => {
    assert.match(
      controlsCss,
      /body\.dark-theme\s+#view-lists\s+\.pill-filter\.active\s+\.count\s*\{[^}]*background:\s*var\(--q-filter-selected-text\)\s*;[^}]*color:\s*var\(--q-filter-selected-bg\)\s*;/s
    );
  }
);
