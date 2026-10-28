import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const moduleSource = fs.readFileSync(
  new URL("../../assets/js/app/moderation.js", import.meta.url),
  "utf8"
);

const routerSource = fs.readFileSync(
  new URL("../../assets/js/app/router.js", import.meta.url),
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

const i18n = fs.readFileSync(
  new URL("../../assets/js/app/i18n.js", import.meta.url),
  "utf8"
);

function createHarness({
  authorized = false,
  accessError = null
} = {}) {
  const nav = { hidden: true };
  const view = {
    hidden: true,
    dataset: {}
  };

  const registrations = [];
  const calls = [];

  const context = {
    window: {
      Router: {
        registerView(id, element) {
          registrations.push({ id, element });
        }
      }
    },
    document: {
      getElementById(id) {
        if (id === "moderationNavItem") return nav;
        if (id === "view-moderation") return view;
        return null;
      },
      addEventListener(type, handler) {
        assert.equal(type, "quacker:view-change");
        assert.equal(typeof handler, "function");
      }
    },
    ApiClient: {
      async getModeratorAccess() {
        calls.push("access");

        if (accessError) throw accessError;

        return { isModerator: authorized };
      },
      async getModerationReports() {
        calls.push("reports");
        throw new Error("No debe solicitar denuncias al iniciar.");
      }
    }
  };

  vm.runInNewContext(
    moduleSource,
    context,
    { filename: "moderation.js" }
  );

  return {
    module: context.window.ModerationModule,
    nav,
    view,
    registrations,
    calls
  };
}

test("la vista administrativa nace oculta y sin ruta", () => {
  assert.match(
    html,
    /id="moderationNavItem" hidden/
  );

  assert.match(
    html,
    /<section class="view" id="view-moderation" hidden>/
  );

  assert.doesNotMatch(
    html,
    /<section[^>]*id="view-moderation"[^>]*data-view-id/
  );

  assert.ok(css.includes("#moderationNavItem[hidden]"));
  assert.ok(css.includes("#view-moderation[hidden]"));

  assert.ok(routerSource.includes("if (!views[id]) return;"));
});

test("sin permisos no registra ni muestra la vista", async () => {
  const h = createHarness();

  await h.module.init();
  await h.module.init();

  assert.equal(h.nav.hidden, true);
  assert.equal(h.view.hidden, true);
  assert.equal(h.registrations.length, 0);
  assert.deepEqual(h.calls, ["access"]);
});

test("con permiso registra la vista y muestra su menú", async () => {
  const h = createHarness({ authorized: true });

  await h.module.init();

  assert.equal(h.nav.hidden, false);
  assert.equal(h.view.hidden, false);
  assert.equal(h.view.dataset.viewId, "moderation");

  assert.equal(h.registrations.length, 1);
  assert.equal(h.registrations[0].id, "moderation");
  assert.equal(h.registrations[0].element, h.view);

  assert.deepEqual(h.calls, ["access"]);
});

test("los errores de acceso mantienen la vista cerrada", async () => {
  const h = createHarness({
    accessError: new Error("forbidden")
  });

  await h.module.init();

  assert.equal(h.nav.hidden, true);
  assert.equal(h.view.hidden, true);
  assert.equal(h.registrations.length, 0);
  assert.deepEqual(h.calls, ["access"]);
});

test("la interfaz está integrada en ambos idiomas", () => {
  assert.match(
    i18n,
    /nav_moderation: "Moderación"/
  );

  assert.match(
    i18n,
    /nav_moderation: "Moderation"/
  );

  assert.ok(
    html.includes('src="assets/js/app/moderation.js"')
  );
});
