// Denuncias desde el perfil interno de Comunidad.
// Comparte el validador y endpoint con los perfiles públicos.
(function () {
  "use strict";

  const REPORTABLE_STATES = new Set([
    "none", "requested", "following", "friend"
  ]);

  let initialized = false;
  let username = "";
  const reportedUsernames = new Set();
  let busy = false;
  let operationVersion = 0;

  const get = (id) => document.getElementById(id);
  const t = (key, params) => window.I18n?.t?.(key, params) || key;
  const modal = () => get("communityReportModal");

  function errorMessage(error) {
    if (error?.status === 409) return t("public_report_duplicate");
    if (error?.status === 401) return t("public_report_session");
    if (error?.status === 404) return t("public_report_missing");
    if (error?.status === 400) return t("public_report_invalid");
    if (error?.status === 429) {
      const seconds = error.retryAfterSeconds;
      return Number.isInteger(seconds) && seconds > 0
        ? t("public_report_limit_seconds", { seconds })
        : t("public_report_limit");
    }
    return t("public_report_error");
  }

  function sync(viewer, profileUsername) {
    const button = get("communityProfileReportAction");
    if (!button) return;

    const normalized = typeof profileUsername === "string"
      ? profileUsername.trim().replace(/^@/, "").toLowerCase()
      : "";
    const state = typeof viewer?.state === "string"
      ? viewer.state.trim()
      : "";
    const allowed = /^[a-z0-9_]{2,20}$/.test(normalized) &&
      REPORTABLE_STATES.has(state) &&
      typeof window.QuackerReports?.submit === "function";

    if (username !== normalized || !allowed) {
      operationVersion += 1;
      window.UIModal?.close?.(modal(), { restoreFocus: false });
    }

    username = allowed ? normalized : "";
    button.hidden = !allowed || reportedUsernames.has(username);
    button.disabled = busy || button.hidden;
  }

  function clear() {
    sync(null, "");
  }

  function open() {
    const button = get("communityProfileReportAction");
    const reason = get("communityReportReason");
    const status = get("communityReportStatus");
    const details = get("communityReportDetails");
    const send = get("communityReportSubmit");

    if (!username || busy || !button || button.hidden ||
      !reason || !status || !details || !send) return;

    // Solo motivos permitidos; Safari no mostrará opciones deshabilitadas.
    const allowed = window.QuackerReports?.reasons?.user;
    if (!Array.isArray(allowed)) return;
    const options = ["", ...allowed].map((value) => {
      const option = document.createElement("option");
      const key = value ? `moderation_reason_${value}` : "public_report_select";
      option.value = value;
      option.textContent = t(key);
      option.setAttribute("data-i18n", key);
      return option;
    });

    reason.replaceChildren(...options);
    reason.value = "";
    details.value = "";
    status.textContent = "";
    send.disabled = false;
    window.UIModal?.open?.(modal(), {
      initialFocusSelector: "#communityReportReason",
      lastFocusEl: button
    });
  }

  async function submit(event) {
    event?.preventDefault?.();
    const reason = get("communityReportReason");
    const details = get("communityReportDetails");
    const status = get("communityReportStatus");
    const send = get("communityReportSubmit");
    const button = get("communityProfileReportAction");

    if (!username || busy || !reason || !details || !status ||
      !send || !button || button.hidden) return false;

    const selected = String(reason.value || "").trim();
    if (!window.QuackerReports?.reasons?.user?.includes(selected) ||
      String(details.value || "").trim().length > 500) {
      status.textContent = t("public_report_invalid");
      return false;
    }

    const submitted = username;
    const version = operationVersion;
    busy = true;
    button.disabled = true;
    reason.disabled = true;
    details.disabled = true;
    send.disabled = true;
    status.textContent = t("public_report_sending");

    try {
      const result = await window.QuackerReports.submit({
        username: submitted,
        kind: "user",
        reason: selected,
        details: String(details.value || "").trim()
      });

      if (version !== operationVersion || submitted !== username) return false;
      if (result?.ok !== true) throw new Error("invalid_report_response");

      reportedUsernames.add(submitted);
      button.hidden = true;
      status.textContent = t("public_report_success");
      return true;
    } catch (error) {
      if (version !== operationVersion || submitted !== username) return false;
      status.textContent = errorMessage(error);
      return false;
    } finally {
      busy = false;
      reason.disabled = false;
      details.disabled = false;
      send.disabled = reportedUsernames.has(username);
      button.disabled = button.hidden;
    }
  }

  function init() {
    if (initialized) return;
    const button = get("communityProfileReportAction");
    const form = get("communityReportForm");
    if (!button || !form || !modal()) return;

    initialized = true;
    button.hidden = true;
    button.addEventListener("click", open);
    form.addEventListener("submit", submit);
    window.UIModal?.bind?.("communityReportModal", {
      closeSelectors: ["#communityReportClose", "#communityReportCancel"],
      initialFocusSelector: "#communityReportReason"
    });
  }

  window.CommunityReportUI = Object.freeze({ init, sync, clear });
})();
