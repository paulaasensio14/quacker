import {
  isModeratorUserId
} from "./moderator-access.js";

const DECISION_STATUSES = Object.freeze({
  resolve: "resolved",
  dismiss: "dismissed"
});

const REPORT_ID_PATTERN =
  /^[a-zA-Z0-9_-]{1,128}$/;

export function applyModerationDecision(
  reports,
  input,
  {
    moderatorUserId = "",
    allowedModeratorUserIds = "",
    decidedAt = ""
  } = {}
) {
  // Verificación redundante: no confiar solamente
  // en el middleware de autorización HTTP.
  if (
    !isModeratorUserId(
      moderatorUserId,
      allowedModeratorUserIds
    )
  ) {
    return {
      ok: false,
      error: "forbidden"
    };
  }

  if (!Array.isArray(reports)) {
    return {
      ok: false,
      error: "invalid_report_collection"
    };
  }

  if (
    !input ||
    typeof input !== "object" ||
    Array.isArray(input)
  ) {
    return {
      ok: false,
      error: "invalid_moderation_decision"
    };
  }

  const reportId =
    typeof input.reportId === "string"
      ? input.reportId.trim()
      : "";

  if (!REPORT_ID_PATTERN.test(reportId)) {
    return {
      ok: false,
      error: "invalid_report_id"
    };
  }

  const action =
    typeof input.action === "string"
      ? input.action.trim().toLowerCase()
      : "";

  if (!Object.hasOwn(DECISION_STATUSES, action)) {
    return {
      ok: false,
      error: "invalid_moderation_action"
    };
  }

  if (
    input.notes !== undefined &&
    typeof input.notes !== "string"
  ) {
    return {
      ok: false,
      error: "invalid_moderation_notes"
    };
  }

  const notes =
    String(input.notes ?? "").trim();

  if (notes.length > 500) {
    return {
      ok: false,
      error: "invalid_moderation_notes"
    };
  }

  const decisionDate =
    typeof decidedAt === "string" &&
    decidedAt.trim()
      ? new Date(decidedAt)
      : new Date(NaN);

  if (Number.isNaN(decisionDate.getTime())) {
    return {
      ok: false,
      error: "invalid_decision_metadata"
    };
  }

  const index = reports.findIndex(
    (entry) =>
      entry &&
      typeof entry === "object" &&
      !Array.isArray(entry) &&
      entry.id === reportId
  );

  if (index < 0) {
    return {
      ok: false,
      error: "report_not_found"
    };
  }

  const previous = reports[index];

  if (previous.status !== "pending") {
    return {
      ok: false,
      error: "report_already_reviewed"
    };
  }

  const report = {
    ...previous,
    status: DECISION_STATUSES[action],
    moderationDecision: {
      moderatorUserId,
      decidedAt: decisionDate.toISOString(),
      notes
    }
  };

  const nextReports = reports.map(
    (entry, currentIndex) =>
      currentIndex === index
        ? report
        : entry
  );

  return {
    ok: true,
    report,
    reports: nextReports
  };
}
