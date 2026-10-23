(function () {
  "use strict";

  const REASONS = Object.freeze({
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

  function fail(code, status = 400) {
    const error = new Error(code);
    error.status = status;
    error.error = code;
    return error;
  }

  async function submit(input) {
    if (
      !input ||
      typeof input !== "object" ||
      Array.isArray(input)
    ) {
      throw fail("invalid_report");
    }

    const username =
      typeof input.username === "string"
        ? input.username.trim().replace(/^@/, "")
        : "";

    const kind =
      typeof input.kind === "string"
        ? input.kind.trim().toLowerCase()
        : "";

    const reason =
      typeof input.reason === "string"
        ? input.reason.trim().toLowerCase()
        : "";

    if (!username) {
      throw fail("invalid_report_target");
    }

    if (!Object.hasOwn(REASONS, kind)) {
      throw fail("invalid_report_kind");
    }

    if (!REASONS[kind].includes(reason)) {
      throw fail("invalid_report_reason");
    }

    if (
      input.details !== undefined &&
      typeof input.details !== "string"
    ) {
      throw fail("invalid_report_details");
    }

    const details = String(input.details || "").trim();

    if (details.length > 500) {
      throw fail("invalid_report_details");
    }

    const body = {
      username,
      kind,
      reason,
      details
    };

    if (kind === "review") {
      const identity = input.reviewIdentity;

      if (
        !identity ||
        typeof identity !== "object" ||
        Array.isArray(identity)
      ) {
        throw fail("invalid_report_review");
      }

      const source =
        String(identity.source || "").trim();

      const contentType =
        String(identity.contentType || "").trim();

      const externalId =
        String(identity.externalId ?? "").trim();

      if (!source || !contentType || !externalId) {
        throw fail("invalid_report_review");
      }

      body.reviewIdentity = {
        source,
        contentType,
        externalId
      };
    }

    const response = await fetch(
      "/api/user/reports",
      {
        method: "POST",
        credentials: "same-origin",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json"
        },
        body: JSON.stringify(body)
      }
    );

    let result = null;

    try {
      result = await response.json();
    } catch (_) {
      result = null;
    }

    if (!response.ok) {
      const code =
        typeof result?.error === "string"
          ? result.error
          : "report_submission_failed";

      const error = fail(code, response.status);

      if (response.status === 429) {
        const retryAfter = Number(
          response.headers?.get?.("Retry-After")
        );

        error.retryAfterSeconds =
          Number.isFinite(retryAfter) && retryAfter > 0
            ? Math.ceil(retryAfter)
            : null;
      }

      throw error;
    }

    if (
      response.status !== 201 ||
      result?.ok !== true ||
      typeof result.reportId !== "string" ||
      !result.reportId
    ) {
      throw fail("invalid_report_response", 502);
    }

    return {
      ok: true,
      reportId: result.reportId
    };
  }

  window.QuackerReports = Object.freeze({
    submit,
    reasons: REASONS
  });
})();
