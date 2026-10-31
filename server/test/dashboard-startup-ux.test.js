import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const app = fs.readFileSync(
  new URL("../../assets/js/app/app-core.js", import.meta.url),
  "utf8"
);

const bootstrap = fs.readFileSync(
  new URL("../../assets/js/app/dashboard-bootstrap.js", import.meta.url),
  "utf8"
);

const html = fs.readFileSync(
  new URL("../../dashboard.html", import.meta.url),
  "utf8"
);

const css = fs.readFileSync(
  new URL("../../assets/css/dashboard.css", import.meta.url),
  "utf8"
);

function createHarness(session) {
  const calls = [];
  let start;

  const first = app.indexOf(
    'document.addEventListener("DOMContentLoaded", async () => {'
  );

  const last = app.indexOf(
    "  // 2) Iniciar módulos después",
    first
  );

  assert.ok(first >= 0);
  assert.ok(last > first);

  const initialSource = app.slice(first, last) + "\n});";

  const context = {
    document: {
      documentElement: {
        classList: {
          remove(name) {
            calls.push("remove:" + name);
          }
        }
      },
      addEventListener(name, callback) {
        if (name === "DOMContentLoaded") start = callback;
      }
    },
    window: {
      location: { hash: "#library", href: "" },
      sessionStorage: {
        getItem() { return null; }
      },
      I18n: {
        init() {},
        setLang() {}
      },
      ModerationModule: {
        async init() {
          calls.push("moderation");
        }
      }
    },
    localStorage: {
      getItem() { return "es"; }
    },
    UITheme: {
      async init() {
        calls.push("theme");
      }
    },
    ApiClient: {
      async getCurrentSession() {
        calls.push("session");
        return session;
      }
    },
    Router: {
      init() {
        calls.push("router");
      }
    },
    console: {
      error() {}
    }
  };

  vm.runInNewContext(initialSource, context);

  assert.equal(typeof start, "function");

  return { start, calls, context };
}

test("el cargador existe y oculta la interfaz durante el arranque", () => {
  assert.match(html, /class="quacker-booting"/);
  assert.match(html, /class="quacker-boot-loader"/);
  assert.match(html, /role="status"/);
  assert.match(css, /\.quacker-booting \.app-shell/);
});

test("una sesión válida inicializa el router y retira el cargador", async () => {
  const h = createHarness({ user: { language: "es" } });

  await h.start();

  assert.equal(
    h.calls.filter((value) => value === "session").length,
    1
  );

  const router = h.calls.indexOf("router");
  const dismiss = h.calls.indexOf("remove:quacker-booting");

  assert.ok(router >= 0);
  assert.ok(dismiss > router);
});

test("sin sesión válida no se inicializa la interfaz protegida", async () => {
  const h = createHarness(null);

  await h.start();

  assert.equal(h.context.window.location.href, "index.html");
  assert.equal(h.calls.includes("router"), false);
  assert.equal(
    h.calls.includes("remove:quacker-booting"),
    false
  );
});

test("el bootstrap ya no duplica la consulta inicial de sesión", () => {
  assert.doesNotMatch(
    bootstrap,
    /ApiClient\.getCurrentSession\s*\(/
  );
});
