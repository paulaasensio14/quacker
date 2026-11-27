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

  contains(target) {
    return this === target ||
      this.children.some(child => child.contains(target));
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
  confirmSupported = true,
  decisionError = null
} = {}) {
  const elements = {
    moderationNavItem: new FakeElement(),
    "view-moderation": new FakeElement(),
    moderationReportsStatus: new FakeElement(),
    moderationReportsList: new FakeElement(),
    moderationReportsRefresh: new FakeElement("button")
  };

  const view = elements["view-moderation"];

  view.active = true;

  view.classList = {
    contains(name) {
      return name === "is-active" && view.active;
    }
  };

  const listeners = {};
  const calls = [];
  const decisions = [];
  const confirmations = [];
  const confirmationOptions = [];
  let currentDecisionError = decisionError;
  let currentError = error;
  let currentResponse = response;

  const window = {
    confirm() {
      throw new Error("native_confirm_must_not_be_used");
    },
    UIConfirm: confirmSupported ? {
      async ask(options) {
        confirmations.push(options.message);
        confirmationOptions.push(options);

        return typeof confirmed === "function"
          ? await confirmed(options)
          : confirmed;
      }
    } : undefined,
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
    confirmationOptions,
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

test("muestra @usuarios sin perder identificadores", async () => {
  const h = createHarness({
    response: {
      totalPending: 1,
      reports: [{
        id: "report_qa",
        kind: "user",
        reason: "spam",
        reporterUserId: "internal_reporter_123",
        reporterUsername: "qa_reporter",
        targetUserId: "internal_author_456",
        targetUsername: "qa_author",
        createdAt: "2026-10-23"
      }]
    }
  });

  await h.module.init();
  assert.equal(await h.module.loadReports(), true);

  const card = h.elements.moderationReportsList.children[0];
  const lines = card.children.filter(
    (node) => node.className === "moderation-report-meta"
  );

  const reporter = lines.find(
    (line) => line.children[0]?.textContent ===
      "moderation_reporter: "
  ).children[1];

  const target = lines.find(
    (line) => line.children[0]?.textContent ===
      "moderation_target: "
  ).children[1];

  assert.equal(reporter.textContent, "@qa_reporter");
  assert.equal(target.textContent, "@qa_author");

  assert.match(
    reporter.attributes.title,
    /internal_reporter_123/
  );

  assert.match(
    target.attributes.title,
    /internal_author_456/
  );

  assert.equal(
    allText(card).includes("internal_reporter_123"),
    false
  );
});

test("un usuario eliminado o inválido conserva su ID", async () => {
  const h = createHarness({
    response: {
      totalPending: 1,
      reports: [{
        id: "report_missing",
        kind: "user",
        reason: "spam",
        reporterUserId: "historical_reporter_1",
        reporterUsername: "",
        targetUserId: "historical_author_2",
        targetUsername: "<script>alert(1)</script>",
        createdAt: "2026-10-23"
      }]
    }
  });

  await h.module.init();
  assert.equal(await h.module.loadReports(), true);

  const text = allText(
    h.elements.moderationReportsList
  );

  assert.ok(text.includes("historical_reporter_1"));
  assert.ok(text.includes("historical_author_2"));

  assert.equal(
    text.includes("<script>"),
    false
  );
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

function pendingModerationDecision() {
  let release;

  const promise = new Promise(resolve => {
    release = resolve;
  });

  return { promise, release };
}

async function confirmationHarness(options = {}) {
  const h = createHarness({
    response: {
      totalPending: 1,
      reports: [makeReport()]
    },
    ...options
  });

  await h.module.init();
  await h.module.loadReports();

  return h;
}

test("DS-07.5.2 moderacion: decisiones y tonos originales", async () => {
  for (const action of ["resolve", "dismiss"]) {
    const h = await confirmationHarness();
    const controls = getControls(h);

    controls.notes.value = "  Nota privada  ";

    await controls[action].handlers.click();

    assert.equal(h.confirmations.length, 1);

    const options = h.confirmationOptions[0];

    assert.equal(
      options.tone,
      action === "resolve" ? "normal" : "danger"
    );

    assert.equal(
      options.title,
      "moderation_" + action
    );

    assert.equal(
      options.confirmLabel,
      "moderation_" + action
    );

    assert.equal(
      options.message,
      "moderation_confirm_" + action
    );

    assert.equal(options.cancelLabel, "common_cancel");
    assert.equal(options.closeLabel, "common_close");

    assert.deepEqual(h.decisions, [{
      id: "report_decision_1",
      action,
      notes: "Nota privada"
    }]);

    assert.equal(
      h.elements.moderationReportsList.children.length,
      0
    );
  }
});

test("DS-07.5.2 moderacion: fallo o respuesta invalida no guarda", async () => {
  for (const options of [
    { confirmSupported: false },
    { confirmed: false },
    { confirmed: "true" },
    { confirmed: 1 },
    { confirmed: async () => undefined },
    {
      confirmed: async () => {
        throw new Error("dialog_failed");
      }
    }
  ]) {
    const h = await confirmationHarness(options);
    const controls = getControls(h);

    await controls.resolve.handlers.click();
    await controls.dismiss.handlers.click();

    assert.equal(h.decisions.length, 0);
    assert.equal(controls.resolve.disabled, false);
    assert.equal(controls.dismiss.disabled, false);
    assert.equal(controls.notes.disabled, false);

    assert.equal(
      h.elements.moderationReportsRefresh.disabled,
      false
    );
  }
});

test("DS-07.5.2 moderacion: cambios de contexto invalidan decision", async () => {
  for (const change of [
    async h => {
      await h.module.loadReports();
    },

    async h => {
      h.setError(
        Object.assign(
          new Error("forbidden"),
          { status: 403 }
        )
      );

      await h.module.loadReports();
    },

    h => {
      h.elements["view-moderation"].active = false;
    },

    h => {
      h.elements["view-moderation"].hidden = true;
    },

    h => {
      h.elements.moderationReportsList.replaceChildren();
    },

    (h, controls) => {
      controls.notes.value = "Notas modificadas";
    },

    (h, controls) => {
      controls.resolve.disabled = true;
    }
  ]) {
    const decision = pendingModerationDecision();

    const h = await confirmationHarness({
      confirmed: () => decision.promise
    });

    const controls = getControls(h);

    controls.notes.value = "Notas originales";

    const operation = controls.resolve.handlers.click();

    assert.equal(h.confirmations.length, 1);
    assert.equal(h.decisions.length, 0);

    await change(h, controls);

    decision.release(true);

    await operation;

    assert.equal(h.decisions.length, 0);
  }
});

test("DS-07.5.2 moderacion: no duplica decisiones pendientes", async () => {
  const decision = pendingModerationDecision();

  const h = await confirmationHarness({
    confirmed: () => decision.promise,

    response: {
      totalPending: 2,
      reports: [
        makeReport(),
        {
          ...makeReport(),
          id: "report_decision_2"
        }
      ]
    }
  });

  const first = getControls(h);

  const secondCard =
    h.elements.moderationReportsList.children[1];

  const secondActions = secondCard.children.find(
    entry =>
      entry.className === "moderation-report-actions"
  );

  const secondResolve =
    secondActions.children[1].children[0];

  const operation = first.resolve.handlers.click();

  await first.resolve.handlers.click();
  await first.dismiss.handlers.click();
  await secondResolve.handlers.click();

  assert.equal(h.confirmations.length, 1);
  assert.equal(h.decisions.length, 0);

  decision.release(true);

  await operation;

  assert.equal(h.decisions.length, 1);
  assert.equal(h.decisions[0].id, "report_decision_1");
  assert.equal(h.decisions[0].action, "resolve");
});
