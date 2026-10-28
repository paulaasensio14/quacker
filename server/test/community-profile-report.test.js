import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import vm from "node:vm";

const source = fs.readFileSync(
  new URL("../../assets/js/app/community-report.js", import.meta.url),
  "utf8"
);

function setup() {
  const handlers = {};
  const items = {};
  const ids = [
    "communityProfileReportAction", "communityReportModal",
    "communityReportForm", "communityReportReason",
    "communityReportDetails", "communityReportStatus",
    "communityReportSubmit"
  ];
  const makeElement = () => ({
    hidden: false, disabled: false, value: "", textContent: "",
    children: [], attributes: {},
    addEventListener(type, callback) { (this.handlers ||= {})[type] = callback; },
    setAttribute(key, value) { this.attributes[key] = value; },
    replaceChildren(...nodes) { this.children = nodes; }
  });
  for (const id of ids) items[id] = makeElement();

  let submitted = [];
  let pending = [];
  const modalCalls = [];
  const window = {
    I18n: { t(key) { return key; } },
    UIModal: {
      bind() {},
      open(_modal, options) { modalCalls.push(options); },
      close() {}
    },
    QuackerReports: {
      reasons: { user: ["spam", "harassment", "hate", "impersonation", "other"] },
      submit(payload) {
        submitted.push(payload);
        return new Promise((resolve, reject) => pending.push({ resolve, reject }));
      }
    }
  };

  const document = {
    getElementById(id) { return items[id] || null; },
    createElement() { return makeElement(); }
  };
  vm.runInNewContext(source, { document, window }, { filename: "community-report.js" });
  const ui = window.CommunityReportUI;
  ui.init();
  return {
    ui, items, submitted, pending, modalCalls,
    action: items.communityProfileReportAction,
    reason: items.communityReportReason,
    status: items.communityReportStatus,
    button: items.communityReportSubmit,
    open() { items.communityProfileReportAction.handlers.click(); },
    submit() { return items.communityReportForm.handlers.submit({ preventDefault() {} }); }
  };
}

test("QA-014: no permite denunciar perfiles propios ni anónimos", () => {
  const h = setup();
  h.ui.sync({ state: "self" }, "alba");
  assert.equal(h.action.hidden, true);
  h.ui.sync(null, "alba");
  assert.equal(h.action.hidden, true);
  h.ui.sync({ state: "following" }, "alba");
  assert.equal(h.action.hidden, false);
});

test("QA-014: motivos válidos y foco accesible", () => {
  const h = setup();
  h.ui.sync({ state: "none" }, "alba");
  h.open();
  assert.equal(h.reason.children.length, 6);
  assert.equal(h.reason.children[1].value, "spam");
  assert.equal(h.modalCalls[0].initialFocusSelector, "#communityReportReason");
  assert.equal(h.modalCalls[0].lastFocusEl, h.action);
});

test("QA-014: no envía motivos inválidos", async () => {
  const h = setup();
  h.ui.sync({ state: "none" }, "alba");
  h.open();
  h.reason.value = "invalid";
  assert.equal(await h.submit(), false);
  assert.equal(h.submitted.length, 0);
  assert.equal(h.status.textContent, "public_report_invalid");
});

test("QA-014: envío correcto deshabilita duplicados y conserva usuario", async () => {
  const h = setup();
  h.ui.sync({ state: "requested" }, "alba");
  h.open();
  h.reason.value = "spam";
  const operation = h.submit();
  assert.equal(h.submitted.length, 1);
  assert.equal(h.submitted[0].username, "alba");
  assert.equal(h.submitted[0].kind, "user");
  assert.equal(h.action.disabled, true);
  assert.equal(await h.submit(), false);
  assert.equal(h.submitted.length, 1);
  h.pending[0].resolve({ ok: true, reportId: "r1" });
  assert.equal(await operation, true);
  assert.equal(h.action.hidden, true);
  assert.equal(h.status.textContent, "public_report_success");
});

test("QA-014: error 429 conserva acción y comunica límite", async () => {
  const h = setup();
  h.ui.sync({ state: "friend" }, "alba");
  h.open();
  h.reason.value = "spam";
  const operation = h.submit();
  h.pending[0].reject({ status: 429, retryAfterSeconds: 12 });
  assert.equal(await operation, false);
  assert.equal(h.action.hidden, false);
  assert.equal(h.status.textContent, "public_report_limit_seconds");
});

test("QA-014: respuesta antigua no modifica otro perfil", async () => {
  const h = setup();
  h.ui.sync({ state: "none" }, "alba");
  h.open();
  h.reason.value = "spam";
  const operation = h.submit();
  h.ui.clear();
  h.ui.sync({ state: "following" }, "carlos");
  h.pending[0].resolve({ ok: true, reportId: "r1" });
  assert.equal(await operation, false);
  assert.equal(h.action.hidden, false);
  assert.equal(h.status.textContent, "public_report_sending");
});
