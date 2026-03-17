// Toast unificado para toda la app Quacker
// API pública: window.toast({ title, message, type, duration, actionLabel, onAction })
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

  function iconSvg(type) {
    if (type === "success") {
      return `
        <svg class="toast-icon" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M9 16.2 4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4z"></path>
        </svg>`;
    }

    if (type === "error") {
      return `
        <svg class="toast-icon" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 2 1 21h22L12 2zm0 6c.6 0 1 .4 1 1v5c0 .6-.4 1-1 1s-1-.4-1-1V9c0-.6.4-1 1-1zm0 10a1.25 1.25 0 1 1 0 2.5A1.25 1.25 0 0 1 12 18z"></path>
        </svg>`;
    }

    return `
      <svg class="toast-icon" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm0 4.8a1.2 1.2 0 1 1 0 2.4 1.2 1.2 0 0 1 0-2.4zM11 10h2v8h-2v-8z"></path>
      </svg>`;
  }

  function showToast({
    title = "",
    message = "",
    type = "info",
    duration = 2200,
    actionLabel = null,
    onAction = null
  } = {}) {
    const host = getHost();
    if (!host) return;

    closeToast();

    const toast = document.createElement("div");
    toast.className = `toast toast--${type}`;
    toast.setAttribute("role", "status");

    const safeTitle = escapeHtml(title);
    const safeMessage = escapeHtml(message);
    const safeActionLabel = escapeHtml(actionLabel);

    toast.innerHTML = `
      ${iconSvg(type)}
      <div class="toast-content">
        ${safeTitle ? `<div class="toast-title">${safeTitle}</div>` : ""}
        ${safeMessage ? `<div class="toast-message">${safeMessage}</div>` : ""}
      </div>
      ${safeActionLabel ? `<button class="toast-btn toast-action">${safeActionLabel}</button>` : ""}
      <button class="toast-btn toast-close" aria-label="Cerrar notificación">
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
          const busyText = (String(actionLabel || "").toLowerCase() === "deshacer")
            ? "Deshaciendo…"
            : "Procesando…";

          actionBtn.innerHTML = `
            <span class="btn-spinner" aria-hidden="true"></span>
            <span>${busyText}</span>
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
