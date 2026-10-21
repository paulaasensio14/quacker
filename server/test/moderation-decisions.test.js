import test from "node:test";
import assert from "node:assert/strict";

import {
  applyModerationDecision
} from "../lib/moderation-decisions.js";

const moderatorUserId = "moderator_1";
const date = "2026-10-21T12:00:00.000Z";

const metadata = {
  moderatorUserId,
  allowedModeratorUserIds: moderatorUserId,
  decidedAt: date
};

function pendingReport() {
  return {
    id: "report_1",
    reporterUserId: "alice",
    targetUserId: "bob",
    kind: "review",
    reason: "harassment",
    status: "pending",
    reviewEvidence: {
      text: "Evidencia original"
    }
  };
}

function decide(
  reports,
  input = {
    reportId: "report_1",
    action: "resolve"
  },
  options = metadata
) {
  return applyModerationDecision(
    reports,
    input,
    options
  );
}

test("resuelve una denuncia y conserva evidencia", () => {
  const original = pendingReport();
  const result = decide([original]);

  assert.equal(result.ok, true);
  assert.equal(result.report.status, "resolved");

  assert.deepEqual(result.report.moderationDecision, {
    moderatorUserId,
    decidedAt: date,
    notes: ""
  });

  assert.equal(
    result.report.reviewEvidence.text,
    "Evidencia original"
  );

  assert.equal(original.status, "pending");
  assert.equal(original.moderationDecision, undefined);
});

test("descarta una denuncia con nota privada", () => {
  const result = decide(
    [pendingReport()],
    {
      reportId: "report_1",
      action: "dismiss",
      notes: "  No procede  "
    }
  );

  assert.equal(result.ok, true);
  assert.equal(result.report.status, "dismissed");

  assert.equal(
    result.report.moderationDecision.notes,
    "No procede"
  );
});

test("sin autorización no revela la denuncia", () => {
  const result = decide(
    [pendingReport()],
    undefined,
    {
      ...metadata,
      allowedModeratorUserIds: ""
    }
  );

  assert.deepEqual(result, {
    ok: false,
    error: "forbidden"
  });
});

test("rechaza moderadores no autorizados", () => {
  for (const id of [
    "other_user",
    "moderator_1 ",
    null,
    { id: moderatorUserId, isAdmin: true }
  ]) {
    assert.equal(
      decide(
        [pendingReport()],
        undefined,
        {
          ...metadata,
          moderatorUserId: id
        }
      ).error,
      "forbidden"
    );
  }
});

test("rechaza acciones e identificadores inválidos", () => {
  for (const action of [
    "delete",
    "ban",
    "__proto__",
    "pending",
    null
  ]) {
    assert.equal(
      decide(
        [pendingReport()],
        {
          reportId: "report_1",
          action
        }
      ).error,
      "invalid_moderation_action"
    );
  }

  assert.equal(
    decide(
      [pendingReport()],
      {
        reportId: "../report_1",
        action: "resolve"
      }
    ).error,
    "invalid_report_id"
  );
});

test("rechaza denuncias inexistentes o ya cerradas", () => {
  assert.equal(
    decide([]).error,
    "report_not_found"
  );

  const closed = {
    ...pendingReport(),
    status: "dismissed"
  };

  assert.equal(
    decide([closed]).error,
    "report_already_reviewed"
  );
});

test("valida notas y fecha de decisión", () => {
  assert.equal(
    decide(
      [pendingReport()],
      {
        reportId: "report_1",
        action: "resolve",
        notes: "x".repeat(501)
      }
    ).error,
    "invalid_moderation_notes"
  );

  assert.equal(
    decide(
      [pendingReport()],
      undefined,
      {
        ...metadata,
        decidedAt: "fecha-inválida"
      }
    ).error,
    "invalid_decision_metadata"
  );
});

test("ignora identidades y decisiones inventadas", () => {
  const original = pendingReport();

  const result = decide(
    [original],
    {
      reportId: "report_1",
      action: "dismiss",
      moderatorUserId: "atacante",
      decidedAt: "2099-01-01",
      status: "resolved",
      moderationDecision: {
        moderatorUserId: "atacante"
      }
    }
  );

  assert.equal(result.ok, true);

  assert.equal(
    result.report.moderationDecision.moderatorUserId,
    moderatorUserId
  );

  assert.equal(
    result.report.moderationDecision.decidedAt,
    date
  );

  assert.equal(result.report.status, "dismissed");
  assert.equal(original.status, "pending");
});
