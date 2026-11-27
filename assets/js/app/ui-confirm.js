/*
 * Quacker UIConfirm - DS-07.5.2
 * Confirmacion asincrona, independiente de las operaciones.
 */
(function () {
  "use strict";

  let pending = false;

  function create(tag, className, text) {
    const element = document.createElement(tag);

    if (className) {
      element.className = className;
    }

    if (typeof text === "string") {
      element.textContent = text;
    }

    return element;
  }

  function makeButton(className, text) {
    const button = create("button", className, text);

    button.type = "button";

    return button;
  }

  function valid(options) {
    return Boolean(
      options &&
      typeof options === "object" &&
      ["normal", "danger"].includes(options.tone) &&
      [
        "title",
        "message",
        "confirmLabel",
        "cancelLabel",
        "closeLabel"
      ].every(key =>
        typeof options[key] === "string" &&
        options[key].trim().length > 0
      )
    );
  }

  function ask(options) {
    if (pending || !valid(options)) {
      return Promise.resolve(false);
    }

    pending = true;

    return new Promise(resolve => {
      const previousFocus = document.activeElement;

      let dialog = null;
      let settled = false;
      let keyHandler = null;

      function finish(accepted) {
        if (settled) return;

        settled = true;

        if (keyHandler) {
          window.removeEventListener(
            "keydown", keyHandler, true
          );
        }

        const confirmed =
          accepted === true && dialog?.open === true;

        try {
          if (dialog?.open) {
            dialog.close();
          }
        } finally {
          dialog?.remove();
          pending = false;

          if (
            previousFocus?.isConnected &&
            typeof previousFocus.focus === "function"
          ) {
            try {
              previousFocus.focus({ preventScroll: true });
            } catch (_) {
              // Un fallo de foco no impide resolver la promesa.
            }
          }

          resolve(confirmed);
        }
      }

      try {
        dialog = create("dialog", "q-confirm-dialog");

        if (
          typeof dialog.showModal !== "function" ||
          typeof dialog.close !== "function"
        ) {
          finish(false);
          return;
        }

        if (
          document.getElementById("qConfirmDialog") ||
          document.getElementById("qConfirmTitle") ||
          document.getElementById("qConfirmMessage")
        ) {
          finish(false);
          return;
        }

        dialog.id = "qConfirmDialog";

        dialog.setAttribute("role", "dialog");
        dialog.setAttribute("aria-modal", "true");
        dialog.setAttribute("aria-labelledby", "qConfirmTitle");
        dialog.setAttribute("aria-describedby", "qConfirmMessage");
        dialog.setAttribute("data-tone", options.tone);

        const header = create("div", "q-confirm-header");

        const icon = create("span", "q-confirm-icon");
        icon.setAttribute("aria-hidden", "true");

        const close = makeButton("q-confirm-close", "\u00d7");

        close.setAttribute("aria-label", options.closeLabel);

        const title = create(
          "h2", "q-confirm-title", options.title
        );

        title.id = "qConfirmTitle";

        header.append(icon, close, title);

        const message = create(
          "p", "q-confirm-message", options.message
        );

        message.id = "qConfirmMessage";

        const footer = create("div", "q-confirm-actions");

        const cancel = makeButton(
          "q-confirm-cancel", options.cancelLabel
        );

        cancel.setAttribute("autofocus", "");

        const accept = makeButton(
          "q-confirm-accept", options.confirmLabel
        );

        footer.append(cancel, accept);
        dialog.append(header, message, footer);

        cancel.addEventListener("click", () => finish(false));
        close.addEventListener("click", () => finish(false));
        accept.addEventListener("click", () => finish(true));

        dialog.addEventListener("cancel", event => {
          event.preventDefault();
          finish(false);
        });

        dialog.addEventListener("close", () => {
          finish(false);
        });

        // Interceptar solo las teclas gestionadas por el modal.
        // Evita que el gestor antiguo cierre un modal inferior.

        keyHandler = event => {
          if (settled || !dialog.open) return;

          if (event.key === "Escape") {
            event.preventDefault();
            event.stopPropagation();

            finish(false);
            return;
          }

          if (event.key !== "Tab") return;

          event.stopPropagation();

          const controls = [close, cancel, accept];

          const first = controls[0];
          const last = controls[controls.length - 1];

          const active = document.activeElement;

          if (!controls.includes(active)) {
            event.preventDefault();
            cancel.focus();
            return;
          }

          if (event.shiftKey && active === first) {
            event.preventDefault();
            last.focus();
            return;
          }

          if (!event.shiftKey && active === last) {
            event.preventDefault();
            first.focus();
          }
        };

        window.addEventListener(
          "keydown", keyHandler, true
        );

        document.body.append(dialog);

        dialog.showModal();
        cancel.focus();

      } catch (_) {
        // Nunca autorizar una accion si el dialogo falla.
        finish(false);
      }
    });
  }

  window.UIConfirm = Object.freeze({
    ask,
    isPending() {
      return pending;
    }
  });
})();
