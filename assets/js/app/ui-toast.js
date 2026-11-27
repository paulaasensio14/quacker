// Toast unificado para toda la app Quacker
// API pública: window.toast({ title, message, type, duration, actionLabel, onAction, icon })
// Sin emojis. Solo SVG. Soporta Undo.

(function () {
  let currentToast = null;
  let timer = null;

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function getToastFallbackLanguage() {
    try {
      const saved = localStorage.getItem("quacker_lang");
      if (saved === "es" || saved === "en") return saved;
    } catch (_) {}

    return (
      typeof navigator !== "undefined" &&
      String(navigator.language || "").toLowerCase().startsWith("es")
    )
      ? "es"
      : "en";
  }

  function getToastFallbackText(key) {
    const language = getToastFallbackLanguage();
    const messages = {
      es: {
        toast_close_label: "Cerrar notificación",
        toast_undo_busy: "Deshaciendo…",
        toast_action_busy: "Procesando…",
        common_undo: "Deshacer"
      },
      en: {
        toast_close_label: "Close notification",
        toast_undo_busy: "Undoing…",
        toast_action_busy: "Processing…",
        common_undo: "Undo"
      }
    };

    return messages[language]?.[key] || messages.en[key] || "";
  }

  function getHost() {
    let host = document.getElementById("toastHost");
    if (host) return host;

    host = document.createElement("div");
    host.id = "toastHost";
    host.className = "toast-host";
    host.setAttribute("aria-live", "polite");
    host.setAttribute("aria-atomic", "true");
    document.body.appendChild(host);
    return host;
  }

  function closeToast() {
    if (!currentToast) return;

    currentToast.classList.remove("is-open");
    const el = currentToast;
    currentToast = null;

    clearTimeout(timer);
    timer = null;

    setTimeout(() => el.remove(), 180);
  }

  function iconSvg(type, icon) {
    const paths = type === "success" && icon === "list"
      ? '<path d="M9 6h11M9 12h11M9 18h11M4 6h.01M4 12h.01M4 18h.01"></path>'
      : type === "success"
        ? '<path d="M5 12l4 4L19 6"></path>'
        : type === "error"
          ? '<path d="M6 6l12 12M18 6L6 18"></path>'
          : '<path d="M12 11v6M12 7h.01"></path>';

    return `
      <svg class="toast-icon"
        viewBox="0 0 24 24"
        aria-hidden="true"
        focusable="false"
        fill="none"
        stroke="currentColor"
        stroke-width="2.5"
        stroke-linecap="round"
        stroke-linejoin="round">
        ${paths}
      </svg>`;
  }

  function showToast({
    title = "",
    message = "",
    type = "info",
    duration = 2200,
    actionLabel = null,
    onAction = null,
    icon = null
  } = {}) {
    const host = getHost();
    if (!host) return;

    closeToast();

    const toast = document.createElement("div");
    toast.className = `toast toast--${type}`;

    if (type === "success" && icon === "list") {
      toast.classList.add("toast--list");
    }

    toast.setAttribute("role", "status");

    const safeTitle = escapeHtml(title);
    const safeMessage = escapeHtml(message);
    const safeActionLabel = escapeHtml(actionLabel);
    const closeLabel = (
      window.I18n &&
      typeof window.I18n.t === "function"
    )
      ? window.I18n.t("toast_close_label")
      : getToastFallbackText("toast_close_label");
    const safeCloseLabel = escapeHtml(closeLabel);

    toast.innerHTML = `
      ${iconSvg(type, icon)}
      <div class="toast-content">
        ${safeTitle ? `<div class="toast-title">${safeTitle}</div>` : ""}
        ${safeMessage ? `<div class="toast-message">${safeMessage}</div>` : ""}
      </div>
      ${safeActionLabel ? `<button class="toast-btn toast-action">${safeActionLabel}</button>` : ""}
      <button class="toast-btn toast-close" aria-label="${safeCloseLabel}">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"
          aria-hidden="true">
          <path d="M18 6L6 18"></path>
          <path d="M6 6l12 12"></path>
        </svg>
      </button>
    `;

    toast.querySelector(".toast-close").addEventListener("click", closeToast);

    if (actionLabel && onAction) {
      const actionBtn = toast.querySelector(".toast-action");

      if (actionBtn) {
        actionBtn.addEventListener("click", async () => {
          // Evitar doble acción
          if (actionBtn.classList.contains("is-busy")) return;

          // Evitar auto-cierre mientras ejecuta la acción
          clearTimeout(timer);
          timer = null;

          actionBtn.classList.add("is-busy");
          actionBtn.disabled = true;

          const prevHtml = actionBtn.innerHTML;

          // Texto de estado (sin emojis)
          const hasSharedI18n = (
            window.I18n &&
            typeof window.I18n.t === "function"
          );
          const undoLabel = hasSharedI18n
            ? window.I18n.t("common_undo")
            : getToastFallbackText("common_undo");
          const isUndo = String(actionLabel || "").trim().toLowerCase()
            === String(undoLabel || "").trim().toLowerCase();
          const busyText = isUndo
            ? (
              hasSharedI18n
                ? window.I18n.t("toast_undo_busy")
                : getToastFallbackText("toast_undo_busy")
            )
            : (
              hasSharedI18n
                ? window.I18n.t("toast_action_busy")
                : getToastFallbackText("toast_action_busy")
            );
          const safeBusyText = escapeHtml(busyText);

          actionBtn.innerHTML = `
            <span class="btn-spinner" aria-hidden="true"></span>
            <span>${safeBusyText}</span>
          `;

          try {
            await onAction();
          } catch (e) {
            // onAction normalmente ya gestiona el toast de error,
            // pero no rompemos si lanza excepción.
            console.error(e);
          } finally {
            // Importante: onAction puede disparar window.toast(...) y crear un toast nuevo.
            // NO debemos cerrar "currentToast" porque podría ser el nuevo.
            // Cerramos solo ESTE toast (el que contiene el botón).
            try {
              const thisToast = actionBtn.closest(".toast");
              if (thisToast) {
                thisToast.classList.remove("is-open");

                // Si por casualidad sigue siendo el currentToast, lo limpiamos.
                if (currentToast === thisToast) currentToast = null;

                window.setTimeout(() => {
                  try { thisToast.remove(); } catch (_) {}
                }, 180);
              }
            } catch (_) {}

            // No intentamos restaurar el botón: el toast se cierra y se elimina.
          }
        });
      }
    }

    host.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add("is-open"));

    currentToast = toast;

    if (duration > 0) {
      timer = setTimeout(closeToast, duration);
    }
  }

  // API pública oficial
  window.toast = showToast;
})();
