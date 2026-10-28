// Moderación: activar la navegación únicamente con permiso HTTP.
const ModerationModule = (() => {
  let initialized = false;
  let authorized = false;
  let requestVersion = 0;
  let decisionBusy = false;

  const t = (key, params) =>
    window.I18n?.t?.(key, params) || key;

  function element(tag, className, value) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (value !== undefined) node.textContent = String(value);
    return node;
  }

  function reportUserLabel(username, userId) {
    const validUsername =
      typeof username === "string" &&
      /^[a-z0-9_]{2,20}$/.test(username);

    return validUsername
      ? `@${username}`
      : String(userId || "—");
  }

  function renderReport(report) {
    if (!report || !["user", "review"].includes(report.kind)) {
      return null;
    }

    const card = element("article", "moderation-report-card");

    const title = element(
      "h3",
      "moderation-report-title",
      t(report.kind === "review"
        ? "moderation_kind_review"
        : "moderation_kind_user")
    );

    const reasonKey = "moderation_reason_" + report.reason;
    const reason = t(reasonKey);
    const reasonText = reason === reasonKey
      ? String(report.reason || "")
      : reason;

    const fields = [
      [t("moderation_report_id"), report.id],
      [
        t("moderation_reporter"),
        reportUserLabel(
          report.reporterUsername,
          report.reporterUserId
        ),
        report.reporterUserId
      ],
      [
        t("moderation_target"),
        reportUserLabel(
          report.targetUsername,
          report.targetUserId
        ),
        report.targetUserId
      ],
      [t("moderation_reason"), reasonText],
      [t("moderation_created_at"), report.createdAt]
    ];

    card.append(title);

    for (const [label, value, originalId] of fields) {
      const line = element("p", "moderation-report-meta");
      const strong = element("strong", "", label + ": ");
      const span = element("span", "", value || "—");

      if (originalId && value !== originalId) {
        span.setAttribute(
          "title",
          `${t("moderation_report_id")}: ${originalId}`
        );
      }

      line.append(strong, span);
      card.append(line);
    }

    if (report.details) {
      card.append(
        element("h4", "", t("moderation_details")),
        element(
          "p",
          "moderation-report-text",
          report.details
        )
      );
    }

    if (report.kind === "review" && report.reviewEvidence) {
      const evidence = report.reviewEvidence;

      card.append(
        element("h4", "", t("moderation_evidence")),
        element(
          "p",
          "moderation-report-meta",
          evidence.title || ""
        )
      );

      if (evidence.spoiler === true) {
        card.append(
          element(
            "p",
            "moderation-report-warning",
            t("moderation_spoiler")
          )
        );
      }

      card.append(
        element(
          "p",
          "moderation-report-text moderation-evidence-text",
          evidence.text || ""
        )
      );

      if (evidence.textTruncated === true) {
        card.append(
          element(
            "p",
            "moderation-report-meta",
            t("moderation_evidence_truncated")
          )
        );
      }
    }

    appendDecisionControls(card, report);
    return card;
  }

  function revokeAccess() {
    authorized = false;
    requestVersion++;

    const nav =
      document.getElementById("moderationNavItem");

    const view =
      document.getElementById("view-moderation");

    const list =
      document.getElementById("moderationReportsList");

    const status =
      document.getElementById("moderationReportsStatus");

    if (nav) nav.hidden = true;
    if (view) view.hidden = true;
    if (list) list.replaceChildren();

    if (status) {
      status.textContent = t("moderation_access_denied");
    }

    window.Router?.showView?.("home");
  }

  function appendDecisionControls(card, report) {
    const reportId =
      typeof report.id === "string"
        ? report.id
        : "";

    if (!/^[a-zA-Z0-9_-]{1,128}$/.test(reportId)) {
      return;
    }

    const container = element(
      "div",
      "moderation-report-actions"
    );

    const label = element(
      "label",
      "moderation-note-label"
    );

    const labelText = element(
      "span",
      "",
      t("moderation_private_notes")
    );

    const notesInput = element(
      "textarea",
      "moderation-note-input"
    );

    notesInput.rows = 3;
    notesInput.maxLength = 500;
    notesInput.placeholder = t(
      "moderation_private_notes_placeholder"
    );

    label.append(labelText, notesInput);

    const buttons = element(
      "div",
      "moderation-decision-buttons"
    );

    const resolve = element(
      "button",
      "btn-primary",
      t("moderation_resolve")
    );

    const dismiss = element(
      "button",
      "btn-secondary",
      t("moderation_dismiss")
    );

    resolve.type = "button";
    dismiss.type = "button";

    const feedback = element(
      "p",
      "moderation-decision-feedback"
    );

    feedback.setAttribute("role", "status");
    feedback.setAttribute("aria-live", "polite");

    async function submitDecision(action) {
      if (!authorized || decisionBusy) {
        return false;
      }

      const notes =
        String(notesInput.value || "").trim();

      if (notes.length > 500) {
        feedback.textContent =
          t("moderation_notes_too_long");
        return false;
      }

      const confirmationKey =
        action === "resolve"
          ? "moderation_confirm_resolve"
          : "moderation_confirm_dismiss";

      // Sin confirmación disponible, no ejecutar.
      if (
        typeof window.confirm !== "function" ||
        !window.confirm(t(confirmationKey))
      ) {
        return false;
      }

      decisionBusy = true;
      resolve.disabled = true;
      dismiss.disabled = true;
      notesInput.disabled = true;

      const refresh =
        document.getElementById(
          "moderationReportsRefresh"
        );

      if (refresh) refresh.disabled = true;

      feedback.textContent = t(
        "moderation_decision_saving"
      );

      try {
        const result =
          await ApiClient.decideModerationReport(
            reportId,
            action,
            notes
          );

        if (result?.ok !== true) {
          throw new Error(
            "invalid_moderation_decision_response"
          );
        }

        // Desbloquear antes de refrescar la bandeja.
        decisionBusy = false;

        return await loadReports();
      } catch (error) {
        if (error?.status === 403) {
          revokeAccess();
          return false;
        }

        if (
          error?.status === 404 ||
          error?.status === 409
        ) {
          decisionBusy = false;
          await loadReports();
          return false;
        }

        feedback.textContent =
          t("moderation_decision_error");

        return false;
      } finally {
        decisionBusy = false;
        resolve.disabled = false;
        dismiss.disabled = false;
        notesInput.disabled = false;

        if (refresh && authorized) {
          refresh.disabled = false;
        }
      }
    }

    resolve.addEventListener(
      "click",
      () => submitDecision("resolve")
    );

    dismiss.addEventListener(
      "click",
      () => submitDecision("dismiss")
    );

    buttons.append(resolve, dismiss);
    container.append(label, buttons, feedback);
    card.append(container);
  }

  async function loadReports() {
    if (!authorized || decisionBusy) return false;

    const list =
      document.getElementById("moderationReportsList");

    const status =
      document.getElementById("moderationReportsStatus");

    const refresh =
      document.getElementById("moderationReportsRefresh");

    if (!list || !status) return false;

    const version = ++requestVersion;

    list.replaceChildren();
    status.textContent = t("moderation_loading");

    if (refresh) refresh.disabled = true;

    try {
      const result =
        await ApiClient.getModerationReports();

      if (version !== requestVersion || !authorized) {
        return false;
      }

      const reports = Array.isArray(result?.reports)
        ? result.reports
        : [];

      const total =
        Number.isInteger(result?.totalPending)
          ? Math.max(0, result.totalPending)
          : reports.length;

      for (const report of reports) {
        const card = renderReport(report);
        if (card) list.append(card);
      }

      status.textContent = total
        ? t("moderation_pending_count", { count: total })
        : t("moderation_empty");

      return true;
    } catch (error) {
      if (version !== requestVersion) return false;

      list.replaceChildren();

      if (error?.status === 403) {
        revokeAccess();
      } else {
        status.textContent = t("moderation_load_error");
      }

      return false;
    } finally {
      if (version === requestVersion && refresh) {
        refresh.disabled = false;
      }
    }
  }

  async function init() {
    if (initialized) return;
    initialized = true;

    const navItem =
      document.getElementById("moderationNavItem");

    const view =
      document.getElementById("view-moderation");

    if (!navItem || !view) return;

    navItem.hidden = true;
    view.hidden = true;

    // No registrar esta vista antes de consultar el servidor.
    // El HTML por sí solo nunca concede permisos.
    try {
      const access =
        await ApiClient.getModeratorAccess();

      if (access?.isModerator !== true) return;

      const register =
        window.Router?.registerView;

      if (typeof register !== "function") return;

      view.dataset.viewId = "moderation";
      register("moderation", view);

      authorized = true;
      navItem.hidden = false;
      view.hidden = false;

      const refresh =
        document.getElementById("moderationReportsRefresh");

      refresh?.addEventListener("click", () => {
        void loadReports();
      });

      document.addEventListener(
        "quacker:view-change",
        (event) => {
          if (event?.detail?.viewId === "moderation") {
            return loadReports();
          }
        }
      );
    } catch (error) {
      // Error de red o permisos: navegación cerrada.
      navItem.hidden = true;
      view.hidden = true;
    }
  }

  return { init, loadReports };
})();

window.ModerationModule = ModerationModule;
