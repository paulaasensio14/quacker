import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const source = fs.readFileSync(
  new URL("../../assets/js/app/public-profile-reports.js", import.meta.url),
  "utf8"
);

const html = fs.readFileSync(
  new URL("../../public-profile.html", import.meta.url),
  "utf8"
);

const profileSource = fs.readFileSync(
  new URL("../../assets/js/app/public-profile.js", import.meta.url),
  "utf8"
);

const translations = fs.readFileSync(
  new URL("../../assets/js/app/i18n.js", import.meta.url),
  "utf8"
);

function createHarness({ error = null } = {}) {
  const elements = new Map();
  const calls = [];
  const opened = [];
  const closed = [];

  for (const id of [
    "publicProfileReportAction",
    "publicProfileReportModal",
    "publicProfileReportForm",
    "publicProfileReportReason",
    "publicProfileReportDetails",
    "publicProfileReportStatus",
    "publicProfileReportSubmit"
  ]) {
    elements.set(id, {
      hidden: id === "publicProfileReportAction",
      disabled: false,
      value: "",
      textContent: "",
      handlers: {},
      addEventListener(name, handler) {
        this.handlers[name] = handler;
      }
    });
  }

  const window = {
    I18n: {
      t(key, params) {
        return params?.seconds
          ? key + ":" + params.seconds
          : key;
      }
    },
    UIModal: {
      bind() {},
      open(modal) { opened.push(modal); },
      close(modal) { closed.push(modal); }
    },
    QuackerReports: {
      async submit(body) {
        calls.push(body);
        if (error) throw error;
        return { ok: true, reportId: "report_1" };
      }
    }
  };

  vm.runInNewContext(
    source,
    {
      window,
      document: {
        getElementById(id) {
          return elements.get(id) || null;
        }
      }
    },
    { filename: "public-profile-reports.js" }
  );

  const ui = window.PublicProfileReportUI;
  ui.init();

  const element = (id) => elements.get(id);

  return {
    ui,
    element,
    calls,
    opened,
    closed,
    open() {
      element("publicProfileReportAction").handlers.click();
    },
    submit() {
      return element("publicProfileReportForm").handlers.submit({
        preventDefault() {}
      });
    }
  };
}

test("el perfil incluye el botón y formulario accesible", () => {
  for (const marker of [
    'id="publicProfileReportAction"',
    'id="publicProfileReportModal"',
    'id="publicProfileReportForm"',
    'id="publicProfileReportReason"',
    'id="publicProfileReportDetails"',
    'aria-modal="true"',
    'maxlength="500"'
  ]) {
    assert.ok(html.includes(marker), marker);
  }

  assert.ok(
    html.indexOf('src="/assets/js/app/report-submission.js"') <
    html.indexOf('src="/assets/js/app/public-profile-reports.js"')
  );

  assert.ok(
    profileSource.includes("PublicProfileReportUI?.sync?.")
  );

  assert.ok(
    profileSource.includes("PublicProfileReportUI?.init?.")
  );
});

test("no muestra denunciar sin sesión o en el perfil propio", () => {
  const h = createHarness();

  for (const viewer of [
    null,
    { state: "self" },
    { state: "invalid" }
  ]) {
    h.ui.sync(viewer, { username: "bob" });

    assert.equal(
      h.element("publicProfileReportAction").hidden,
      true
    );
  }

  assert.equal(h.calls.length, 0);
});

test("se muestra en el perfil de otro usuario autenticado", () => {
  const h = createHarness();

  h.ui.sync(
    { state: "following", access: "full" },
    { username: "bob" }
  );

  assert.equal(
    h.element("publicProfileReportAction").hidden,
    false
  );

  h.open();
  assert.equal(h.opened.length, 1);
});

test("envía motivo y descripción sin identidad manipulable", async () => {
  const h = createHarness();

  h.ui.sync(
    { state: "none", access: "full" },
    { username: "bob" }
  );

  h.open();

  h.element("publicProfileReportReason").value = "harassment";
  h.element("publicProfileReportDetails").value = "  Ejemplo  ";

  assert.equal(await h.submit(), true);
  assert.equal(h.calls.length, 1);

  const payload = JSON.parse(JSON.stringify(h.calls[0]));

  assert.deepEqual(payload, {
    username: "bob",
    kind: "user",
    reason: "harassment",
    details: "Ejemplo"
  });

  assert.equal(
    h.element("publicProfileReportStatus").textContent,
    "public_report_success"
  );

  assert.equal(
    h.element("publicProfileReportAction").hidden,
    true
  );

  assert.equal(await h.submit(), false);
  assert.equal(h.calls.length, 1);
});

test("no envía formularios con motivo inválido", async () => {
  const h = createHarness();

  h.ui.sync(
    { state: "none" },
    { username: "bob" }
  );

  h.open();

  h.element("publicProfileReportReason").value = "spoilers";

  assert.equal(await h.submit(), false);
  assert.equal(h.calls.length, 0);
});

test("informa de denuncias duplicadas", async () => {
  const h = createHarness({
    error: Object.assign(new Error("duplicate"), {
      status: 409
    })
  });

  h.ui.sync(
    { state: "none" },
    { username: "bob" }
  );

  h.open();

  h.element("publicProfileReportReason").value = "spam";

  assert.equal(await h.submit(), false);
  assert.equal(
    h.element("publicProfileReportStatus").textContent,
    "public_report_duplicate"
  );
  assert.equal(
    h.element("publicProfileReportSubmit").disabled,
    false
  );
});

test("informa del límite de denuncias", async () => {
  const h = createHarness({
    error: Object.assign(new Error("limited"), {
      status: 429,
      retryAfterSeconds: 42
    })
  });

  h.ui.sync(
    { state: "none" },
    { username: "bob" }
  );

  h.open();
  h.element("publicProfileReportReason").value = "spam";

  assert.equal(await h.submit(), false);
  assert.equal(
    h.element("publicProfileReportStatus").textContent,
    "public_report_limit_seconds:42"
  );
});

test("hay textos españoles e ingleses", () => {
  assert.equal(
    translations.includes('public_report_button: "Denunciar usuario"'),
    true
  );

  assert.equal(
    translations.includes('public_report_button: "Report user"'),
    true
  );
});
