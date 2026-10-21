import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const source = fs.readFileSync(
  new URL("../../assets/js/app/moderation.js", import.meta.url),
  "utf8"
);

class FakeElement {
  constructor(tag = "div") {
    this.tag = tag;
    this.attributes = {};
    this.children = [];
    this.hidden = true;
    this.disabled = false;
    this.dataset = {};
    this.className = "";
    this.textContent = "";
    this.handlers = {};
  }

  set innerHTML(_) {
    throw new Error("No se permite HTML sin sanitizar.");
  }

  append(...children) {
    this.children.push(...children);
  }

  replaceChildren(...children) {
    this.children = [...children];
  }

  addEventListener(type, handler) {
    this.handlers[type] = handler;
  }

  setAttribute(name, value) {
    this.attributes[name] = value;
  }
}

function createHarness({
  authorized = true,
  response = { totalPending: 0, reports: [] },
  error = null,
  confirmed = true,
  decisionError = null
} = {}) {
  const elements = {
    moderationNavItem: new FakeElement(),
    "view-moderation": new FakeElement(),
    moderationReportsStatus: new FakeElement(),
    moderationReportsList: new FakeElement(),
    moderationReportsRefresh: new FakeElement("button")
  };

  const listeners = {};
  const calls = [];
  const decisions = [];
  const confirmations = [];
  let currentDecisionError = decisionError;
  let currentError = error;
  let currentResponse = response;

  const window = {
    confirm(message) {
      confirmations.push(message);
      return confirmed;
    },
    I18n: {
      t(key, params) {
        if (key === "moderation_pending_count") {
          return "Pendientes: " + params.count;
        }
        return key;
      }
    },
    Router: {
      registerView(id, element) {
        calls.push(["register", id, element]);
      },
      showView(id) {
        calls.push(["navigate", id]);
      }
    }
  };

  const context = {
    window,
    document: {
      getElementById(id) {
        return elements[id] || null;
      },
      createElement(tag) {
        return new FakeElement(tag);
      },
      addEventListener(type, handler) {
        listeners[type] = handler;
      }
    },
    ApiClient: {
      async getModeratorAccess() {
        return { isModerator: authorized };
      },
      async getModerationReports() {
        calls.push(["reports"]);
        if (currentError) throw currentError;
        return currentResponse;
      },
      async decideModerationReport(id, action, notes) {
        decisions.push({ id, action, notes });

        if (currentDecisionError) {
          throw currentDecisionError;
        }

        currentResponse = {
          totalPending: 0,
          reports: []
        };

        return {
          ok: true,
          reportId: id,
          status: action === "resolve"
            ? "resolved"
            : "dismissed"
        };
      }
    }
  };

  vm.runInNewContext(source, context);

  return {
    module: context.window.ModerationModule,
    elements,
    listeners,
    calls,
    decisions,
    confirmations,
    setDecisionError(value) {
      currentDecisionError = value;
    },
    setError(value) { currentError = value; },
    setResponse(value) { currentResponse = value; }
  };
}

function allText(node) {
  return [
    node.textContent,
    ...node.children.flatMap(allText)
  ].join(" ");
}

test("sin autorización no consulta denuncias", async () => {
  const h = createHarness({ authorized: false });
  await h.module.init();

  assert.equal(await h.module.loadReports(), false);
  assert.equal(h.elements.moderationNavItem.hidden, true);
  assert.equal(
    h.calls.some((entry) => entry[0] === "reports"),
    false
  );
});

test("la bandeja se consulta al entrar en moderación", async () => {
  const h = createHarness();
  await h.module.init();

  assert.equal(
    h.calls.some((entry) => entry[0] === "reports"),
    false
  );

  await h.listeners["quacker:view-change"]({
    detail: { viewId: "home" }
  });

  assert.equal(
    h.calls.some((entry) => entry[0] === "reports"),
    false
  );

  await h.listeners["quacker:view-change"]({
    detail: { viewId: "moderation" }
  });

  assert.equal(
    h.calls.filter((entry) => entry[0] === "reports").length,
    1
  );
});

test("muestra denuncias y evidencias como texto seguro", async () => {
  const malicious = '<img src=x onerror=alert(1)>';

  const h = createHarness({
    response: {
      totalPending: 2,
      reports: [
        {
          id: "report_1",
          kind: "user",
          reason: "spam",
          reporterUserId: "alice",
          targetUserId: "bob",
          createdAt: "2026-10-21",
          details: malicious
        },
        {
          id: "report_2",
          kind: "review",
          reason: "spoilers",
          reporterUserId: "alice",
          targetUserId: "bob",
          createdAt: "2026-10-21",
          reviewEvidence: {
            title: "Título",
            text: malicious,
            spoiler: true,
            textTruncated: true
          }
        }
      ]
    }
  });

  await h.module.init();
  assert.equal(await h.module.loadReports(), true);

  assert.equal(h.elements.moderationReportsList.children.length, 2);
  assert.equal(
    h.elements.moderationReportsStatus.textContent,
    "Pendientes: 2"
  );

  const text = allText(h.elements.moderationReportsList);

  assert.ok(text.includes(malicious));
  assert.ok(text.includes("moderation_spoiler"));
  assert.ok(text.includes("moderation_evidence_truncated"));
});

test("la bandeja vacía muestra un estado informativo", async () => {
  const h = createHarness();
  await h.module.init();
  await h.module.loadReports();

  assert.equal(
    h.elements.moderationReportsStatus.textContent,
    "moderation_empty"
  );
  assert.equal(
    h.elements.moderationReportsList.children.length,
    0
  );
});

test("un error limpia evidencias y permite reintentar", async () => {
  const h = createHarness({
    response: {
      totalPending: 1,
      reports: [{
        id: "report_1",
        kind: "review",
        reason: "spam",
        reviewEvidence: { text: "privado" }
      }]
    }
  });

  await h.module.init();
  await h.module.loadReports();

  h.setError(Object.assign(new Error("network"), {
    status: 500
  }));

  assert.equal(await h.module.loadReports(), false);
  assert.equal(
    h.elements.moderationReportsList.children.length,
    0
  );
  assert.equal(
    h.elements.moderationReportsStatus.textContent,
    "moderation_load_error"
  );

  h.setError(null);
  assert.equal(await h.module.loadReports(), true);
  assert.equal(
    h.elements.moderationReportsList.children.length,
    1
  );
});

test("un 403 retira acceso y elimina evidencias de la vista", async () => {
  const h = createHarness();
  await h.module.init();

  h.setError(Object.assign(new Error("forbidden"), {
    status: 403
  }));

  assert.equal(await h.module.loadReports(), false);
  assert.equal(h.elements.moderationNavItem.hidden, true);
  assert.equal(h.elements["view-moderation"].hidden, true);
  assert.equal(h.elements.moderationReportsList.children.length, 0);
  assert.equal(await h.module.loadReports(), false);

  assert.ok(
    h.calls.some(
      (entry) =>
        entry[0] === "navigate" &&
        entry[1] === "home"
    )
  );
});


function makeReport() {
  return {
    id: "report_decision_1",
    kind: "user",
    reason: "spam",
    reporterUserId: "alice",
    targetUserId: "bob",
    createdAt: "2026-10-21"
  };
}

function getControls(h) {
  const card =
    h.elements.moderationReportsList.children[0];

  assert.ok(card, "debe existir una denuncia");

  const actions = card.children.find(
    (entry) =>
      entry.className === "moderation-report-actions"
  );

  assert.ok(actions, "deben existir controles");

  return {
    notes: actions.children[0].children[1],
    resolve: actions.children[1].children[0],
    dismiss: actions.children[1].children[1],
    feedback: actions.children[2]
  };
}

test("permite resolver con confirmación y nota privada", async () => {
  const h = createHarness({
    response: {
      totalPending: 1,
      reports: [makeReport()]
    }
  });

  await h.module.init();
  await h.module.loadReports();

  const controls = getControls(h);
  controls.notes.value = "  Revisado manualmente  ";

  assert.equal(
    controls.resolve.attributes?.role,
    undefined
  );

  assert.equal(controls.resolve.type, "button");

  await controls.resolve.handlers.click();

  assert.equal(h.confirmations.length, 1);
  assert.equal(h.decisions.length, 1);

  assert.deepEqual(h.decisions[0], {
    id: "report_decision_1",
    action: "resolve",
    notes: "Revisado manualmente"
  });

  assert.equal(
    h.elements.moderationReportsList.children.length,
    0
  );

  assert.equal(
    h.elements.moderationReportsStatus.textContent,
    "moderation_empty"
  );
});

test("cancelar la confirmación no guarda cambios", async () => {
  const h = createHarness({
    confirmed: false,
    response: {
      totalPending: 1,
      reports: [makeReport()]
    }
  });

  await h.module.init();
  await h.module.loadReports();

  const controls = getControls(h);

  await controls.dismiss.handlers.click();

  assert.equal(h.confirmations.length, 1);
  assert.equal(h.decisions.length, 0);
  assert.equal(controls.dismiss.disabled, false);
});

test("puede descartar una denuncia con notas opcionales", async () => {
  const h = createHarness({
    response: {
      totalPending: 1,
      reports: [makeReport()]
    }
  });

  await h.module.init();
  await h.module.loadReports();

  await getControls(h).dismiss.handlers.click();

  assert.equal(h.decisions.length, 1);
  assert.equal(h.decisions[0].action, "dismiss");
  assert.equal(h.decisions[0].notes, "");
});

test("un error de guardado conserva la denuncia", async () => {
  const h = createHarness({
    decisionError: Object.assign(
      new Error("network"),
      { status: 500 }
    ),
    response: {
      totalPending: 1,
      reports: [makeReport()]
    }
  });

  await h.module.init();
  await h.module.loadReports();

  const controls = getControls(h);

  await controls.resolve.handlers.click();

  assert.equal(h.decisions.length, 1);
  assert.equal(
    controls.feedback.textContent,
    "moderation_decision_error"
  );

  assert.equal(controls.resolve.disabled, false);
  assert.equal(controls.notes.disabled, false);

  assert.equal(
    h.elements.moderationReportsList.children.length,
    1
  );
});

test("revocar permisos durante una decisión limpia la vista", async () => {
  const h = createHarness({
    decisionError: Object.assign(
      new Error("forbidden"),
      { status: 403 }
    ),
    response: {
      totalPending: 1,
      reports: [makeReport()]
    }
  });

  await h.module.init();
  await h.module.loadReports();

  await getControls(h).resolve.handlers.click();

  assert.equal(h.elements.moderationNavItem.hidden, true);
  assert.equal(h.elements["view-moderation"].hidden, true);
  assert.equal(
    h.elements.moderationReportsList.children.length,
    0
  );
  assert.equal(await h.module.loadReports(), false);

  assert.ok(
    h.calls.some(
      (entry) =>
        entry[0] === "navigate" &&
        entry[1] === "home"
    )
  );
});

test("una denuncia ya revisada provoca actualización", async () => {
  const h = createHarness({
    decisionError: Object.assign(
      new Error("already_reviewed"),
      { status: 409 }
    ),
    response: {
      totalPending: 1,
      reports: [makeReport()]
    }
  });

  await h.module.init();
  await h.module.loadReports();

  await getControls(h).dismiss.handlers.click();

  assert.equal(h.decisions.length, 1);
  assert.equal(
    h.calls.filter(
      (entry) => entry[0] === "reports"
    ).length,
    2
  );
});

test("las notas excesivamente largas se rechazan", async () => {
  const h = createHarness({
    response: {
      totalPending: 1,
      reports: [makeReport()]
    }
  });

  await h.module.init();
  await h.module.loadReports();

  const controls = getControls(h);
  controls.notes.value = "x".repeat(501);

  await controls.resolve.handlers.click();

  assert.equal(h.confirmations.length, 0);
  assert.equal(h.decisions.length, 0);
  assert.equal(
    controls.feedback.textContent,
    "moderation_notes_too_long"
  );
});
