import test from "node:test";
import assert from "node:assert/strict";

import {
  addModerationReport,
  REPORT_REASONS
} from "../lib/moderation-reports.js";

const metadata = {
  id: "report_1",
  createdAt: "2026-10-21T09:00:00.000Z",
  reviewEvidence: {
    title: "The Matrix",
    text: "Reseña pública original",
    spoiler: false,
    updatedAt: "2026-10-21T09:00:00.000Z"
  }
};

const base = {
  reporterUserId: "user_alice",
  targetUserId: "user_bob",
  kind: "user",
  reason: "spam"
};

const reviewIdentity = {
  source: "tmdb",
  contentType: "movie",
  externalId: "000603"
};

test("crea una denuncia de usuario pendiente", () => {
  const result = addModerationReport(
    [],
    base,
    metadata
  );

  assert.equal(result.ok, true);
  assert.equal(result.reports.length, 1);
  assert.equal(result.report.kind, "user");
  assert.equal(result.report.status, "pending");
  assert.equal(result.report.reason, "spam");
  assert.equal(result.report.reviewIdentity, null);
  assert.equal(result.report.createdAt, metadata.createdAt);
});

test("crea una denuncia de reseña con identidad canónica", () => {
  const result = addModerationReport(
    [],
    {
      ...base,
      kind: "review",
      reason: "spoilers",
      reviewIdentity
    },
    metadata
  );

  assert.equal(result.ok, true);
  assert.equal(
    result.report.reviewIdentity.contentType,
    "pelicula"
  );
  assert.equal(
    result.report.reviewIdentity.externalId,
    "603"
  );
  assert.ok(result.report.reviewIdentity.key);
});

test("impide denunciarse a uno mismo", () => {
  const result = addModerationReport(
    [],
    {
      ...base,
      targetUserId: "user_alice"
    },
    metadata
  );

  assert.deepEqual(result, {
    ok: false,
    error: "cannot_report_self"
  });
});

test("rechaza destinatarios e informantes inválidos", () => {
  for (const patch of [
    { reporterUserId: "" },
    { reporterUserId: {} },
    { targetUserId: null },
    { targetUserId: "" }
  ]) {
    assert.equal(
      addModerationReport(
        [],
        { ...base, ...patch },
        metadata
      ).ok,
      false
    );
  }
});

test("rechaza tipos y motivos de denuncia desconocidos", () => {
  assert.equal(
    addModerationReport(
      [],
      { ...base, kind: "admin" },
      metadata
    ).error,
    "invalid_report_kind"
  );

  assert.equal(
    addModerationReport(
      [],
      { ...base, reason: "inventado" },
      metadata
    ).error,
    "invalid_report_reason"
  );

  assert.equal(
    REPORT_REASONS.user.includes("impersonation"),
    true
  );

  assert.equal(
    REPORT_REASONS.review.includes("spoilers"),
    true
  );
});

test("valida motivos específicos según el tipo", () => {
  assert.equal(
    addModerationReport(
      [],
      { ...base, reason: "spoilers" },
      metadata
    ).error,
    "invalid_report_reason"
  );

  assert.equal(
    addModerationReport(
      [],
      {
        ...base,
        kind: "review",
        reason: "impersonation",
        reviewIdentity
      },
      metadata
    ).error,
    "invalid_report_reason"
  );
});

test("rechaza reseñas sin identidad canónica válida", () => {
  for (const identity of [
    null,
    {},
    {
      source: "tmdb",
      contentType: "movie",
      externalId: "invalid"
    }
  ]) {
    assert.equal(
      addModerationReport(
        [],
        {
          ...base,
          kind: "review",
          reviewIdentity
            : identity
        },
        metadata
      ).error,
      "invalid_report_review"
    );
  }
});

test("limita los comentarios de una denuncia", () => {
  assert.equal(
    addModerationReport(
      [],
      {
        ...base,
        details: "x".repeat(501)
      },
      metadata
    ).error,
    "invalid_report_details"
  );

  assert.equal(
    addModerationReport(
      [],
      { ...base, details: {} },
      metadata
    ).error,
    "invalid_report_details"
  );
});

test("impide duplicar denuncias pendientes del mismo usuario", () => {
  const first = addModerationReport(
    [],
    base,
    metadata
  );

  const second = addModerationReport(
    first.reports,
    {
      ...base,
      reason: "harassment"
    },
    {
      ...metadata,
      id: "report_2"
    }
  );

  assert.equal(
    second.error,
    "report_already_exists"
  );
});

test("normaliza la identidad para detectar reseñas duplicadas", () => {
  const first = addModerationReport(
    [],
    {
      ...base,
      kind: "review",
      reason: "spam",
      reviewIdentity
    },
    metadata
  );

  const second = addModerationReport(
    first.reports,
    {
      ...base,
      kind: "review",
      reason: "hate",
      reviewIdentity: {
        source: "tmdb",
        contentType: "pelicula",
        externalId: "603"
      }
    },
    {
      ...metadata,
      id: "report_2"
    }
  );

  assert.equal(
    second.error,
    "report_already_exists"
  );
});

test("permite denuncias de diferentes informantes", () => {
  const first = addModerationReport(
    [],
    base,
    metadata
  );

  const second = addModerationReport(
    first.reports,
    {
      ...base,
      reporterUserId: "user_charlie"
    },
    {
      ...metadata,
      id: "report_2"
    }
  );

  assert.equal(second.ok, true);
  assert.equal(second.reports.length, 2);
});

test("ignora permisos y estados enviados por el cliente", () => {
  const result = addModerationReport(
    [],
    {
      ...base,
      id: "forged_id",
      status: "resolved",
      isAdmin: true
    },
    metadata
  );

  assert.equal(result.ok, true);
  assert.equal(result.report.id, "report_1");
  assert.equal(result.report.status, "pending");
  assert.equal(
    Object.hasOwn(result.report, "isAdmin"),
    false
  );
});

test("exige metadatos generados por el servidor", () => {
  const result = addModerationReport(
    [],
    base
  );

  assert.equal(
    result.error,
    "invalid_report_metadata"
  );
});

test("no modifica la lista original de denuncias", () => {
  const previous = [];
  const result = addModerationReport(
    previous,
    base,
    metadata
  );

  assert.equal(result.ok, true);
  assert.deepEqual(previous, []);
  assert.equal(result.reports.length, 1);
});


test("exige evidencia fiable al denunciar reseñas", () => {
  const result = addModerationReport(
    [],
    {
      ...base,
      kind: "review",
      reviewIdentity
    },
    {
      id: metadata.id,
      createdAt: metadata.createdAt
    }
  );

  assert.equal(result.ok, false);
  assert.equal(result.error, "invalid_report_evidence");
});

test("limita el texto conservado e ignora evidencia inventada", () => {
  const result = addModerationReport(
    [],
    {
      ...base,
      kind: "review",
      reviewIdentity,
      reviewEvidence: {
        text: "FALSIFICADA"
      }
    },
    {
      ...metadata,
      reviewEvidence: {
        ...metadata.reviewEvidence,
        text: "x".repeat(4200)
      }
    }
  );

  assert.equal(result.ok, true);
  assert.equal(result.report.reviewEvidence.text.length, 4000);
  assert.equal(result.report.reviewEvidence.textTruncated, true);
  assert.equal(
    result.report.reviewEvidence.text.includes("FALSIFICADA"),
    false
  );
});
