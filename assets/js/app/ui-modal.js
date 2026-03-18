// assets/js/app/ui-modal.js
// Helper único para modales Quacker: Escape, click fuera, trap Tab, restore focus.
// Sin frameworks. Una sola fuente de verdad.

(function () {
  const stack = [];
  const lastFocus = new WeakMap();

  function isOpen(el) {
    return !!el && el.classList.contains("is-open");
  }

  function getFocusable(container) {
    if (!container) return [];
    const selector = [
      'a[href]',
      'button:not([disabled])',
      'textarea:not([disabled])',
      'input:not([disabled])',
      'select:not([disabled])',
      '[tabindex]:not([tabindex="-1"])'
    ].join(",");

    return Array.from(container.querySelectorAll(selector))
      .filter((el) => !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length));
  }

  function anyModalOpen() {
    return document.querySelectorAll(".modal-overlay.is-open").length > 0;
  }

  function open(modalEl, { initialFocusSelector = null, lastFocusEl = null } = {}) {
    if (!modalEl) return;

    // Guardar foco anterior (para restaurar al cerrar)
    const prev = lastFocusEl || document.activeElement;
    if (prev && typeof prev.focus === "function") lastFocus.set(modalEl, prev);

    if (!isOpen(modalEl)) {
      modalEl.classList.add("is-open");
      modalEl.setAttribute("aria-hidden", "false");

      // bloquear scroll
      document.body.classList.add("modal-open");

      // stack (top-most)
      stack.push(modalEl);
    }

    // foco inicial
    requestAnimationFrame(() => {
      let target = null;

      if (initialFocusSelector) {
        target = modalEl.querySelector(initialFocusSelector);
      }

      const focusables = getFocusable(modalEl);
      target = target || focusables[0];

      // si no hay nada focuseable, focusea el card
      if (!target) {
        const card = modalEl.querySelector(".modal-card");
        if (card) {
          card.setAttribute("tabindex", "-1");
          target = card;
        }
      }

      target?.focus?.();
    });
  }

  function close(modalEl, { restoreFocus = true } = {}) {
    if (!modalEl) return;
    if (!isOpen(modalEl)) return;

    modalEl.classList.remove("is-open");
    modalEl.setAttribute("aria-hidden", "true");

    // quitar de stack
    const idx = stack.lastIndexOf(modalEl);
    if (idx >= 0) stack.splice(idx, 1);

    // desbloquear scroll solo si ya no hay modales
    if (!anyModalOpen()) {
      document.body.classList.remove("modal-open");
    }

    // restaurar foco
    if (restoreFocus) {
      const back = lastFocus.get(modalEl);
      if (back && typeof back.focus === "function") {
        requestAnimationFrame(() => back.focus());
      }
    }
  }

  function closeTop() {
    const top = stack[stack.length - 1];
    if (top) close(top);
  }

  function trapTab(e) {
    const top = stack[stack.length - 1];
    if (!top || !isOpen(top)) return;

    const focusables = getFocusable(top);
    if (!focusables.length) return;

    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    const active = document.activeElement;

    // Si el foco está fuera, meterlo dentro
    if (!top.contains(active)) {
      e.preventDefault();
      first.focus();
      return;
    }

    // Shift+Tab desde el primero -> último
    if (e.shiftKey && active === first) {
      e.preventDefault();
      last.focus();
      return;
    }

    // Tab desde el último -> primero
    if (!e.shiftKey && active === last) {
      e.preventDefault();
      first.focus();
    }
  }

  // Keydown global (una sola vez)
  if (!document.documentElement.dataset.quackerModalBound) {
    document.documentElement.dataset.quackerModalBound = "1";

    document.addEventListener("keydown", (e) => {
      // Escape cierra el modal superior
      if (e.key === "Escape") {
        const top = stack[stack.length - 1];
        if (!top || !isOpen(top)) return;
        e.preventDefault();
        closeTop();
        return;
      }

      // Trap Tab
      if (e.key === "Tab") {
        trapTab(e);
      }
    }, true);
  }

  function bind(modalId, {
    closeSelectors = [],
    initialFocusSelector = null,
    closeOnBackdrop = true
  } = {}) {
    const modalEl = document.getElementById(modalId);
    if (!modalEl) return;

    // Click fuera (solo overlay)
    if (closeOnBackdrop && !modalEl.dataset.backdropBound) {
      modalEl.dataset.backdropBound = "1";
      modalEl.addEventListener("click", (e) => {
        if (e.target === modalEl) close(modalEl);
      });
    }

    // Botones de cierre
    closeSelectors.forEach((sel) => {
      const btn = document.querySelector(sel);
      if (!btn) return;

      if (btn.dataset.closeBound === "1") return;
      btn.dataset.closeBound = "1";

      btn.addEventListener("click", (e) => {
        e.preventDefault();
        close(modalEl);
      });
    });

    // API cómoda para abrir con foco inicial fijo
    modalEl.__quackerInitialFocusSelector = initialFocusSelector || null;
  }

  window.UIModal = {
    open,
    close,
    bind,
  };
})();
