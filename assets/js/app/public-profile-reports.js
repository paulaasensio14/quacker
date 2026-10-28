(function () {
  "use strict";

  const REASONS = Object.freeze({
    user: new Set([
      "spam",
      "harassment",
      "hate",
      "impersonation",
      "other"
    ]),
    review: new Set([
      "spam",
      "harassment",
      "hate",
      "spoilers",
      "inappropriate_content",
      "other"
    ])
  });

  const REPORTABLE_STATES = new Set([
    "none",
    "requested",
    "following",
    "friend"
  ]);

  let initialized = false;
  let targetUsername = "";
  let submittedUsername = "";
  let busy = false;
  let activeKind = "user";
  let activeReviewIdentity = null;
  let activeReviewButton = null;
  let activeReviewKey = "";
  const submittedReviewKeys = new Set();

  const get = (id) => document.getElementById(id);
  const t = (key, params) =>
    window.I18n?.t?.(key, params) || key;

  function sync(viewer, profile) {
    const button = get("publicProfileReportAction");
    if (!button) return;

    const state =
      typeof viewer?.state === "string"
        ? viewer.state.trim()
        : "";

    const username =
      typeof profile?.username === "string"
        ? profile.username.trim().replace(/^@/, "")
        : "";

    const allowed =
      REPORTABLE_STATES.has(state) &&
      !!username &&
      !!window.QuackerReports?.submit;

    targetUsername = allowed ? username : "";

    button.hidden =
      !allowed ||
      username === submittedUsername;

    if (!allowed) {
      window.UIModal?.close?.(
        get("publicProfileReportModal")
      );
    }
  }

  function showError(error) {
    if (error?.status === 409) {
      return t("public_report_duplicate");
    }

    if (error?.status === 401) {
      return t("public_report_session");
    }

    if (error?.status === 404) {
      return t("public_report_missing");
    }

    if (error?.status === 429) {
      const seconds = error.retryAfterSeconds;

      return Number.isInteger(seconds) && seconds > 0
        ? t("public_report_limit_seconds", { seconds })
        : t("public_report_limit");
    }

    if (error?.status === 400) {
      return t("public_report_invalid");
    }

    return t("public_report_error");
  }

  function open(
    kind = "user",
    identity = null,
    sourceButton = null,
    reviewKey = ""
  ) {
    const button =
      sourceButton || get("publicProfileReportAction");

    const modal = get("publicProfileReportModal");

    if (
      !targetUsername ||
      !button ||
      button.hidden ||
      busy ||
      !modal ||
      !Object.hasOwn(REASONS, kind) ||
      (kind === "review" && !identity)
    ) {
      return;
    }

    activeKind = kind;
    activeReviewIdentity =
      kind === "review" ? { ...identity } : null;

    activeReviewButton =
      kind === "review" ? button : null;

    activeReviewKey =
      kind === "review" ? reviewKey : "";

    const title = get("publicProfileReportTitle");
    if (title) {
      title.textContent = t(
        kind === "review"
          ? "public_report_review_title"
          : "public_report_title"
      );
    }

    const reasonSelect =
      get("publicProfileReportReason");

    if (!reasonSelect) return;

    // Safari puede mostrar las opciones deshabilitadas.
    // Solo insertamos en el DOM los motivos permitidos.
    const options = ["", ...REASONS[kind]].map((value) => {
      const option = document.createElement("option");

      const translationKey = value
        ? `moderation_reason_${value}`
        : "public_report_select";

      option.value = value;
      option.textContent = t(translationKey);
      option.setAttribute("data-i18n", translationKey);

      return option;
    });

    reasonSelect.replaceChildren(...options);
    reasonSelect.value = "";
    get("publicProfileReportDetails").value = "";
    get("publicProfileReportStatus").textContent = "";

    const submitButton =
      get("publicProfileReportSubmit");

    if (submitButton) submitButton.disabled = false;

    window.UIModal?.open?.(modal, {
      initialFocusSelector: "#publicProfileReportReason",
      lastFocusEl: button
    });
  }

  function decorateReview(card, entry) {
    if (
      !targetUsername ||
      !card ||
      !entry ||
      !window.QuackerReports?.submit
    ) {
      return;
    }

    const source =
      String(entry.source || "").trim();

    const contentType =
      String(entry.contentType || "").trim();

    const externalId =
      String(entry.externalId ?? "").trim();

    if (!source || !contentType || !externalId) {
      return;
    }

    const identity = {
      source,
      contentType,
      externalId
    };

    const reviewKey = JSON.stringify([
      targetUsername,
      source,
      contentType,
      externalId
    ]);

    if (submittedReviewKeys.has(reviewKey)) {
      return;
    }

    const title =
      String(entry.itemSnapshot?.title || "").trim();

    const button = document.createElement("button");

    button.type = "button";
    button.className =
      "public-profile-report-review-action";

    button.textContent = t(
      "public_report_review_button"
    );

    button.setAttribute(
      "aria-label",
      t("public_report_review_aria", {
        title: title || t("public_report_review_title")
      })
    );

    button.addEventListener("click", () => {
      open("review", identity, button, reviewKey);
    });

    card.append(button);
  }

  async function submit(event) {
    event?.preventDefault?.();

    const button = get("publicProfileReportAction");
    const reason = get("publicProfileReportReason");
    const details = get("publicProfileReportDetails");
    const status = get("publicProfileReportStatus");
    const send = get("publicProfileReportSubmit");

    if (
      busy ||
      !targetUsername ||
      (activeKind === "user" && button?.hidden) ||
      !reason ||
      !details ||
      !status ||
      !send
    ) {
      return false;
    }

    const selected = String(reason.value || "").trim();
    const description = String(details.value || "").trim();

    if (!REASONS[activeKind]?.has(selected) || description.length > 500) {
      status.textContent = t("public_report_invalid");
      return false;
    }

    const submittedTarget = targetUsername;
    const submittedKind = activeKind;
    const submittedKey = activeReviewKey;
    const submittedButton = activeReviewButton;

    const payload = {
      username: submittedTarget,
      kind: submittedKind,
      reason: selected,
      details: description
    };

    if (submittedKind === "review") {
      if (!activeReviewIdentity || !submittedKey) {
        status.textContent = t("public_report_invalid");
        return false;
      }

      payload.reviewIdentity = {
        ...activeReviewIdentity
      };
    }

    busy = true;
    reason.disabled = true;
    details.disabled = true;
    send.disabled = true;

    status.textContent = t("public_report_sending");

    try {
      const result = await window.QuackerReports.submit(
        payload
      );

      if (result?.ok !== true) {
        throw new Error("invalid_report_result");
      }

      if (submittedKind === "review") {
        submittedReviewKeys.add(submittedKey);

        if (submittedButton) {
          submittedButton.hidden = true;
        }
      } else {
        submittedUsername = submittedTarget;
        button.hidden = true;
      }

      status.textContent = t("public_report_success");
      return true;
    } catch (error) {
      status.textContent = showError(error);
      return false;
    } finally {
      busy = false;
      reason.disabled = false;
      details.disabled = false;
      send.disabled = activeKind === "review"
        ? submittedReviewKeys.has(activeReviewKey)
        : (
            submittedUsername === targetUsername &&
            !!submittedUsername
          );
    }
  }

  function init() {
    if (initialized) return;
    initialized = true;

    const button = get("publicProfileReportAction");
    const form = get("publicProfileReportForm");
    const modal = get("publicProfileReportModal");

    if (!button || !form || !modal) return;

    button.hidden = true;
    button.addEventListener(
      "click",
      () => open("user")
    );
    form.addEventListener("submit", submit);

    window.UIModal?.bind?.(
      "publicProfileReportModal",
      {
        closeSelectors: [
          "#publicProfileReportClose",
          "#publicProfileReportCancel"
        ],
        initialFocusSelector: "#publicProfileReportReason"
      }
    );
  }

  window.PublicProfileReportUI = Object.freeze({
    init,
    sync,
    decorateReview
  });
})();
