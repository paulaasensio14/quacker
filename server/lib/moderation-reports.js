import {
  normalizeContentIdentity
} from "./content-identity.js";

export const REPORT_REASONS = Object.freeze({
  user: Object.freeze([
    "spam",
    "harassment",
    "hate",
    "impersonation",
    "other"
  ]),
  review: Object.freeze([
    "spam",
    "harassment",
    "hate",
    "spoilers",
    "inappropriate_content",
    "other"
  ])
});

function normalizeUserId(value) {
  if (typeof value !== "string") return "";

  const id = value.trim();

  return id.length <= 128 ? id : "";
}

function normalizeReviewIdentity(value) {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value)
  ) {
    return null;
  }

  const identity = normalizeContentIdentity({
    source: value.source,
    type: value.contentType ?? value.type,
    externalId: value.externalId
  });

  if (!identity.ok) return null;

  return {
    source: identity.source,
    contentType: identity.type,
    externalId: identity.externalId,
    key: identity.key
  };
}


function normalizeReviewEvidence(value) {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value)
  ) {
    return null;
  }

  const title =
    typeof value.title === "string"
      ? value.title.trim().slice(0, 120)
      : "";

  const fullText =
    typeof value.text === "string"
      ? value.text.trim()
      : "";

  const updatedAt =
    typeof value.updatedAt === "string"
      ? value.updatedAt.trim()
      : "";

  const parsedDate = new Date(updatedAt);

  if (
    !title ||
    !fullText ||
    !updatedAt ||
    Number.isNaN(parsedDate.getTime())
  ) {
    return null;
  }

  const maxTextLength = 4000;

  return {
    title,
    text: fullText.slice(0, maxTextLength),
    textTruncated: fullText.length > maxTextLength,
    spoiler: value.spoiler === true,
    updatedAt: parsedDate.toISOString()
  };
}

export function addModerationReport(
  reports,
  input = {},
  {
    id = "",
    createdAt = "",
    reviewEvidence = null
  } = {}
) {
  if (
    !input ||
    typeof input !== "object" ||
    Array.isArray(input)
  ) {
    return {
      ok: false,
      error: "invalid_report"
    };
  }

  const reporterUserId =
    normalizeUserId(input.reporterUserId);

  const targetUserId =
    normalizeUserId(input.targetUserId);

  if (!reporterUserId) {
    return {
      ok: false,
      error: "invalid_reporter"
    };
  }

  if (!targetUserId) {
    return {
      ok: false,
      error: "invalid_report_target"
    };
  }

  if (reporterUserId === targetUserId) {
    return {
      ok: false,
      error: "cannot_report_self"
    };
  }

  const kind =
    typeof input.kind === "string"
      ? input.kind.trim().toLowerCase()
      : "";

  if (!Object.hasOwn(REPORT_REASONS, kind)) {
    return {
      ok: false,
      error: "invalid_report_kind"
    };
  }

  const reason =
    typeof input.reason === "string"
      ? input.reason.trim().toLowerCase()
      : "";

  if (!REPORT_REASONS[kind].includes(reason)) {
    return {
      ok: false,
      error: "invalid_report_reason"
    };
  }

  if (
    input.details !== undefined &&
    typeof input.details !== "string"
  ) {
    return {
      ok: false,
      error: "invalid_report_details"
    };
  }

  const details =
    String(input.details ?? "").trim();

  if (details.length > 500) {
    return {
      ok: false,
      error: "invalid_report_details"
    };
  }

  const reviewIdentity =
    kind === "review"
      ? normalizeReviewIdentity(input.reviewIdentity)
      : null;

  if (kind === "review" && !reviewIdentity) {
    return {
      ok: false,
      error: "invalid_report_review"
    };
  }

  const normalizedEvidence =
    kind === "review"
      ? normalizeReviewEvidence(reviewEvidence)
      : null;

  if (kind === "review" && !normalizedEvidence) {
    return {
      ok: false,
      error: "invalid_report_evidence"
    };
  }

  // Estos metadatos deberán generarse en el servidor.
  const reportId =
    typeof id === "string" ? id.trim() : "";

  const date =
    typeof createdAt === "string"
      ? new Date(createdAt)
      : new Date(NaN);

  if (
    !/^[a-zA-Z0-9_-]{1,128}$/.test(reportId) ||
    Number.isNaN(date.getTime())
  ) {
    return {
      ok: false,
      error: "invalid_report_metadata"
    };
  }

  const previous =
    Array.isArray(reports) ? reports : [];

  const duplicate = previous.some((entry) => {
    if (
      !entry ||
      typeof entry !== "object" ||
      entry.status !== "pending" ||
      entry.reporterUserId !== reporterUserId ||
      entry.targetUserId !== targetUserId ||
      entry.kind !== kind
    ) {
      return false;
    }

    if (kind === "user") return true;

    return (
      entry.reviewIdentity?.key ===
      reviewIdentity.key
    );
  });

  if (duplicate) {
    return {
      ok: false,
      error: "report_already_exists"
    };
  }

  const report = {
    id: reportId,
    reporterUserId,
    targetUserId,
    kind,
    reason,
    details,
    reviewIdentity,
    reviewEvidence: normalizedEvidence,
    status: "pending",
    createdAt: date.toISOString()
  };

  return {
    ok: true,
    report,
    reports: [
      ...previous,
      report
    ]
  };
}
