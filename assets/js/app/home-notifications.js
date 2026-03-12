// assets/js/app/home-notifications.js
// UI de notificaciones del dashboard (UI → ApiClient → FakeBackend)

const NotificationsUI = (() => {
  const $ = (sel) => document.querySelector(sel);

  const notifListEl = $("#notifList");
  const notifCountEl = $("#notifCount");
  const markAllBtn = $("#markAllBtn");
  const notifBadgeEl = $("#notifBadge");
  const notifButtonEl = $("#notifButton");

  // Elementos del panel (una sola fuente de verdad)
  const trigger = document.querySelector("[data-open-notifications]");
  const panel = document.querySelector("[data-notifications-panel]");
  const closeBtn = document.querySelector("[data-close-notifications]");

  // Si el panel no existe en este HTML, no hacemos nada
  if (!notifListEl || !notifCountEl) {
    return { render() {} };
  }

  // Memoria para detectar "nuevas" notificaciones y animarlas al aparecer
  let __prevNotifIds = new Set();

  // Freeze de orden mientras el panel está abierto (evita saltos)
  let __frozenOrderIds = null; // array de ids en orden

  let __lastFocusEl = null;

  function normalizeNotifColor(notif) {
    const iconKind = String(notif?.icon || "").trim().toLowerCase();

    // Racha: alineamos con el lenguaje Home (warm desde 3, hot desde 7+)
    if (iconKind === "flame") return "hot";
    if (iconKind === "spark" || iconKind === "streak" || iconKind === "check") return "warm";

    // Si llega ya como "warm/hot", lo respetamos
    const raw = String(notif?.color || "").trim().toLowerCase();
    if (raw === "warm" || raw === "hot") return raw;

    // Si viene hex ("#f97316") NO lo usamos como clase
    return "";
  }

  function getNotifIconSvg(kind = "check") {
    if (kind === "flame") {
      return `
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M12 22c4.4 0 8-3.1 8-7.5 0-3.2-2-5.6-3.9-7.3-1.2-1.1-2.1-2.6-2.3-4.2C12.5 4.2 11 6 10.5 7.6c-.5 1.6-.3 3.4.6 4.8-2.3-1.1-3.9-3.4-3.9-6 0 0-3.2 2.6-3.2 8.1C4 18.9 7.6 22 12 22z"></path>
        </svg>
      `;
    }

    if (kind === "spark" || kind === "streak") {
      return `
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M12 2l1.8 6.2L20 10l-6.2 1.8L12 18l-1.8-6.2L4 10l6.2-1.8L12 2z"></path>
        </svg>
      `;
    }

    if (kind === "resume") {
      return `
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M3 12a9 9 0 1 0 3-6.7"></path>
          <path d="M3 3v6h6"></path>
        </svg>
      `;
    }

    // default: check
    return `
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
        stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M5 12l4 4 10-10"></path>
      </svg>
    `;
  }

  async function renderNotifications() {
    const rawList = await ApiClient.getNotifications();
    const list = Array.isArray(rawList) ? rawList : [];

    const panelOpen = !!panel && panel.classList.contains("is-open");

    // ===== Preservar foco si el panel está abierto (ANTES de re-render) =====
    const activeEl = document.activeElement;
    let __restoreFocus = null;

    if (panelOpen && activeEl && panel && panel.contains(activeEl)) {
      if (activeEl.id === "markAllBtn") __restoreFocus = { kind: "markAll" };
      else if (closeBtn && activeEl === closeBtn) __restoreFocus = { kind: "close" };

      const cardEl = activeEl.closest?.(".notif-card");
      if (!__restoreFocus && cardEl) {
        const id = String(cardEl.getAttribute("data-notif-id") || cardEl.dataset?.notifId || "");
        if (id && activeEl.classList.contains("notif-mark-btn")) {
          __restoreFocus = { kind: "markOne", notifId: id };
        }
      }
    }

    // ===== Orden visual (freeze si panel abierto) =====
    const isStreak = (n) =>
      n?.icon === "flame" || n?.icon === "spark" || n?.icon === "streak" || n?.icon === "check";

    const sortByRules = (arr) => {
      return [...arr].sort((a, b) => {
        const aSt = isStreak(a) ? 1 : 0;
        const bSt = isStreak(b) ? 1 : 0;
        if (aSt !== bSt) return bSt - aSt;

        const ad = Date.parse(a?.createdAt || "") || 0;
        const bd = Date.parse(b?.createdAt || "") || 0;
        return bd - ad;
      });
    };

    let sortedList = [];

    if (panelOpen) {
      if (!Array.isArray(__frozenOrderIds)) {
        const firstSorted = sortByRules(list);
        __frozenOrderIds = firstSorted.map((x) => String(x.id));
      }

      const byId = new Map(list.map((x) => [String(x.id), x]));
      sortedList = [];

      for (const id of __frozenOrderIds) {
        const item = byId.get(String(id));
        if (item) sortedList.push(item);
      }

      // Nuevas (no estaban en el freeze) -> al final
      for (const item of list) {
        const id = String(item.id);
        if (!__frozenOrderIds.includes(id)) {
          sortedList.push(item);
          __frozenOrderIds.push(id);
        }
      }
    } else {
      sortedList = sortByRules(list);
      __frozenOrderIds = null;
    }

    // Detectar nuevas notificaciones (comparando con el render anterior)
    const prevIds = __prevNotifIds;
    const nextIds = new Set((list || []).map((x) => String(x.id)));

    // Contador
    notifCountEl.textContent = list.length;
    notifListEl.innerHTML = "";

    // UX: si no hay notificaciones, desactivar "Marcar todas"
    if (markAllBtn) {
      const hasAny = list.length > 0;
      markAllBtn.disabled = !hasAny;
      markAllBtn.style.opacity = hasAny ? "1" : "0.55";
      markAllBtn.style.cursor = hasAny ? "pointer" : "not-allowed";
      markAllBtn.textContent = hasAny ? "Marcar todas" : "Nada nuevo";
    }

    // Badge en la campana + aria-label accesible
    if (notifBadgeEl) {
      const n = list.length;
      const prev = Number(notifBadgeEl.dataset.count || 0);

      if (n <= 0) {
        notifBadgeEl.style.display = "none";
        notifBadgeEl.textContent = "";
      } else {
        notifBadgeEl.style.display = "inline-flex";
        notifBadgeEl.textContent = n > 99 ? "99+" : String(n);
      }

      notifBadgeEl.dataset.count = String(n);

      // Animación solo si SUBE el contador
      if (n > prev && n > 0) {
        notifBadgeEl.classList.remove("is-pop");
        void notifBadgeEl.offsetWidth;
        notifBadgeEl.classList.add("is-pop");
      }
    }

    if (notifButtonEl) {
      const n = list.length;
      notifButtonEl.setAttribute("aria-label", n > 0 ? `Notificaciones, ${n} nuevas` : "Notificaciones");
    }

    const emptyStateEl = document.getElementById("notifEmptyState");
    if (!list.length) {
      if (emptyStateEl) emptyStateEl.hidden = false;
      __prevNotifIds = nextIds;
      return;
    }
    if (emptyStateEl) emptyStateEl.hidden = true;

    sortedList.forEach((n) => {
      const notifId = String(n.id);

      const card = document.createElement("div");
      card.className = "notif-card";
      card.dataset.notifId = notifId;
      card.setAttribute("data-notif-id", notifId);

      const isStreakNotif = n.icon === "flame" || n.icon === "spark" || n.icon === "streak" || n.icon === "check";
      if (isStreakNotif) card.classList.add("is-streak");

      // Micro-animación solo si es "nueva" respecto al render anterior (y no en el primer render)
      const isNew = prevIds.size > 0 && !prevIds.has(notifId);
      if (isNew) {
        card.classList.add("is-highlight");
        setTimeout(() => {
          try { card.classList.remove("is-highlight"); } catch (_) {}
        }, 900);
      }

      const icon = document.createElement("div");
      icon.className = "notif-icon";

      const colorKey = normalizeNotifColor(n);
      if (colorKey) icon.classList.add(`is-${colorKey}`);

      icon.innerHTML = getNotifIconSvg(n.icon);

      const body = document.createElement("div");
      body.className = "notif-body";

      const chipHtml = isStreakNotif
        ? `<span class="notif-chip" aria-label="Notificación de racha">Racha</span>`
        : "";

      body.innerHTML = `
        <div class="notif-topline">
          <strong>${n.title || ""}</strong>
          ${chipHtml}
        </div>
        <div>${n.text || ""}</div>
        <div class="notif-time">${n.time || ""}</div>
      `;

      const markBtn = document.createElement("button");
      markBtn.type = "button";
      markBtn.className = "notif-mark-btn";
      markBtn.innerHTML = `
        <span class="sr-only">Marcar como vista</span>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M20 6L9 17l-5-5" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"></path>
        </svg>
      `;

      markBtn.addEventListener("click", async (e) => {
        e.stopPropagation();

        if (markBtn.dataset.busy === "1") return;
        markBtn.dataset.busy = "1";

        let snapshot = [];
        try {
          snapshot = await ApiClient.getNotifications();
          if (!Array.isArray(snapshot)) snapshot = [];
        } catch (_) {
          snapshot = [];
        }

        markBtn.disabled = true;
        markBtn.style.opacity = "0.6";
        markBtn.style.cursor = "not-allowed";

        card.classList.add("is-removing");

        setTimeout(async () => {
          try {
            await ApiClient.dismissNotification(n.id);

            window.toast?.({
              title: "Notificación actualizada",
              message: "Se ha marcado como vista.",
              type: "success",
              duration: 4500,
              actionLabel: "Deshacer",
              onAction: async () => {
                try {
                  await ApiClient.setNotifications(snapshot || []);
                  window.toast?.({
                    title: "Notificaciones restauradas",
                    message: "Se ha recuperado el estado anterior.",
                    type: "info",
                    duration: 2200
                  });
                } catch (err) {
                  console.error(err);
                  window.toast?.({
                    title: "No se pudo deshacer",
                    message: "Inténtalo de nuevo.",
                    type: "error",
                    duration: 3000
                  });
                }
              }
            });
          } catch (err) {
            console.error(err);

            card.classList.remove("is-removing");
            markBtn.disabled = false;
            markBtn.style.opacity = "1";
            markBtn.style.cursor = "pointer";
            markBtn.dataset.busy = "0";

            window.toast?.({
              title: "No se pudo actualizar",
              message: "Inténtalo de nuevo.",
              type: "error",
              duration: 2800
            });
          }
        }, 180);
      });

      card.appendChild(icon);
      card.appendChild(body);
      card.appendChild(markBtn);
      notifListEl.appendChild(card);
    });

    // Guardamos snapshot actual para detectar nuevas en el próximo render
    __prevNotifIds = nextIds;

    // Restaurar foco si estábamos interactuando dentro del panel
    if (__restoreFocus && panelOpen && panel) {
      requestAnimationFrame(() => {
        try {
          if (__restoreFocus.kind === "markAll") {
            document.getElementById("markAllBtn")?.focus?.();
            return;
          }

          if (__restoreFocus.kind === "close") {
            closeBtn?.focus?.();
            return;
          }

          if (__restoreFocus.kind === "markOne") {
            const safe = (window.CSS && CSS.escape)
              ? CSS.escape(String(__restoreFocus.notifId))
              : String(__restoreFocus.notifId);

            const btn = panel.querySelector?.(`.notif-card[data-notif-id="${safe}"] .notif-mark-btn`);
            btn?.focus?.();
          }
        } catch (_) {}
      });
    }
  }

  // Modal confirmar "Marcar todas"
  window.UIModal?.bind("confirmClearNotifsModal", {
    closeSelectors: ["#closeConfirmClearNotifs", "#cancelClearNotifs"],
    initialFocusSelector: "#confirmClearNotifs",
    closeOnBackdrop: true
  });

  const openConfirmClearNotifsModal = () => {
    const modal = document.getElementById("confirmClearNotifsModal");
    if (!modal) return;
    window.UIModal?.open(modal, { initialFocusSelector: "#confirmClearNotifs" });
  };

  const closeConfirmClearNotifsModal = () => {
    const modal = document.getElementById("confirmClearNotifsModal");
    if (!modal) return;
    window.UIModal?.close(modal);
  };

  // Botón "Marcar todas" (abre confirmación)
  if (markAllBtn) {
    markAllBtn.addEventListener("click", async () => {
      const list = await ApiClient.getNotifications();
      if (!list || list.length === 0) return;
      openConfirmClearNotifsModal();
    });
  }

  // Confirmar desde modal
  const confirmClearBtn = document.getElementById("confirmClearNotifs");
  if (confirmClearBtn) {
    confirmClearBtn.addEventListener("click", async () => {
      const snapshot = await ApiClient.getNotifications();

      closeConfirmClearNotifsModal();

      if (markAllBtn) {
        markAllBtn.disabled = true;
        const originalText = markAllBtn.textContent;
        markAllBtn.dataset.originalText = originalText || "Marcar todas";
        markAllBtn.textContent = "Marcando…";
        markAllBtn.style.cursor = "not-allowed";
        markAllBtn.style.opacity = "0.7";
      }

      const cards = Array.from(notifListEl.querySelectorAll(".notif-card"));
      cards.forEach((el, i) => {
        setTimeout(() => el.classList.add("is-removing"), i * 35);
      });

      setTimeout(async () => {
        try {
          await ApiClient.clearNotifications();

          window.toast?.({
            title: "Notificaciones actualizadas",
            message: "Se han marcado como vistas.",
            type: "success",
            duration: 4500,
            actionLabel: "Deshacer",
            onAction: async () => {
              try {
                await ApiClient.setNotifications(snapshot || []);
                window.toast?.({
                  title: "Notificaciones restauradas",
                  message: "Se han recuperado las notificaciones anteriores.",
                  type: "info",
                  duration: 2200
                });
              } catch (err) {
                console.error(err);
                window.toast?.({
                  title: "No se pudo deshacer",
                  message: "Inténtalo de nuevo.",
                  type: "error",
                  duration: 3000
                });
              }
            }
          });

          // Importante: no hacemos render manual. Vendrá por evento.
        } catch (err) {
          console.error(err);

          window.toast?.({
            title: "No se pudieron marcar",
            message: "Inténtalo de nuevo.",
            type: "error",
            duration: 3000
          });
        } finally {
          if (markAllBtn) {
            markAllBtn.disabled = false;
            markAllBtn.textContent = markAllBtn.dataset.originalText || "Marcar todas";
            markAllBtn.style.cursor = "pointer";
            markAllBtn.style.opacity = "1";
          }
        }
      }, Math.min(260, cards.length * 35 + 140));
    });
  }

  // Render inicial al cargar el archivo
  renderNotifications().catch(console.error);

  // Refresco oficial cuando cambia el state de notificaciones (UI reactiva al evento global)
  if (!document.documentElement.dataset.notifsDataChangedBound) {
    document.documentElement.dataset.notifsDataChangedBound = "1";

    let __notifRefreshTimer = null;

    document.addEventListener("quacker:data-changed", (e) => {
      const kind = e?.detail?.kind;
      if (kind !== "notifications") return;

      if (__notifRefreshTimer) clearTimeout(__notifRefreshTimer);
      __notifRefreshTimer = setTimeout(() => {
        renderNotifications().catch(console.error);
      }, 60);
    });
  }

  function openPanel() {
    if (!panel) return;

    // Al abrir: reiniciamos freeze para aplicar el orden correcto en este panel
    __frozenOrderIds = null;

    __lastFocusEl = document.activeElement;

    panel.classList.add("is-open");
    panel.setAttribute("aria-hidden", "false");
    if (trigger) trigger.setAttribute("aria-expanded", "true");

    renderNotifications().catch(console.error);

    setTimeout(() => {
      const markAll = document.getElementById("markAllBtn");
      if (markAll && !markAll.disabled) {
        markAll.focus();
        return;
      }
      closeBtn?.focus?.();
    }, 0);
  }

  function closePanel({ restoreFocus = true } = {}) {
    if (!panel) return;

    panel.classList.remove("is-open");
    panel.setAttribute("aria-hidden", "true");
    if (trigger) trigger.setAttribute("aria-expanded", "false");

    // Al cerrar: liberamos freeze
    __frozenOrderIds = null;

    if (restoreFocus) {
      const toFocus = __lastFocusEl || trigger;
      if (toFocus && typeof toFocus.focus === "function") {
        setTimeout(() => toFocus.focus(), 0);
      }
    }
  }

  function getFocusableInPanel() {
    if (!panel) return [];
    const selector = [
      "button:not([disabled])",
      "a[href]",
      "input:not([disabled])",
      "select:not([disabled])",
      "textarea:not([disabled])",
      "[tabindex]:not([tabindex='-1'])"
    ].join(",");

    return Array.from(panel.querySelectorAll(selector))
      .filter((el) => el.offsetParent !== null && !el.hasAttribute("hidden"));
  }

  function trapTabKey(e) {
    if (!panel || !panel.classList.contains("is-open")) return;
    if (e.key !== "Tab") return;

    const focusables = getFocusableInPanel();
    if (!focusables.length) return;

    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    const active = document.activeElement;

    if (!panel.contains(active)) {
      e.preventDefault();
      first.focus();
      return;
    }

    if (e.shiftKey && active === first) {
      e.preventDefault();
      last.focus();
      return;
    }

    if (!e.shiftKey && active === last) {
      e.preventDefault();
      first.focus();
    }
  }

  if (trigger && panel) {
    trigger.addEventListener("click", (e) => {
      e.stopPropagation();
      const isOpen = panel.classList.contains("is-open");
      if (isOpen) closePanel();
      else openPanel();
    });
  }

  if (closeBtn && panel) {
    closeBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      closePanel();
    });
  }

  // Cerrar al clicar fuera
  document.addEventListener("click", (e) => {
    if (!panel || !panel.classList.contains("is-open")) return;
    const isClickInside = panel.contains(e.target) || trigger?.contains(e.target);
    if (!isClickInside) closePanel({ restoreFocus: false });
  });

  // Cerrar con Escape
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    if (!panel || !panel.classList.contains("is-open")) return;
    closePanel();
  });

  // Trap de Tab dentro del panel
  document.addEventListener("keydown", trapTabKey);

  return { render: renderNotifications };
})();

window.NotificationsUI = NotificationsUI;
