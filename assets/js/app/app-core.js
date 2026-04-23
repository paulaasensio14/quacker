// assets/js/app/app-core.js
// Punto de entrada del dashboard.

const $ = (selector, root = document) => root.querySelector(selector);
const $all = (selector, root = document) => Array.from(root.querySelectorAll(selector));

document.addEventListener("DOMContentLoaded", async () => {
  await UITheme.init();
  window.I18n?.init?.();

  try {
    const session = await ApiClient.getCurrentSession();

    const savedLang = localStorage.getItem("quacker:lang");
    const sessionLang = session?.user?.language;

    if (!savedLang && (sessionLang === "en" || sessionLang === "es")) {
      window.I18n.setLang(sessionLang);
    }
  } catch (e) {
    console.error("Session bootstrap error", e);
    window.location.href = "index.html";
    return;
  }

  // 1) Restaurar primero la vista correcta
  Router.init();

  // 2) Iniciar módulos después
  try { window.LibraryUI?.init?.(); } catch (e) { console.error("LibraryUI.init error", e); }
  try { window.ListsModule?.init?.(); } catch (e) { console.error("ListsModule.init error", e); }
  try { window.ProfileModule?.init?.(); } catch (e) { console.error("ProfileModule.init error", e); }
  try { window.ExploreModule?.init?.(); } catch (e) { console.error("ExploreModule.init error", e); }
  try { window.HomeUI?.init?.(); } catch (e) { console.error("HomeUI.init error", e); }

  let homeRefreshScheduled = false;
  let notificationsRefreshScheduled = false;
  let libraryRefreshPromise = null;
  let listsRefreshPromise = null;

  function scheduleHomeRefresh() {
    if (homeRefreshScheduled) return;
    homeRefreshScheduled = true;

    queueMicrotask(() => {
      homeRefreshScheduled = false;
      document.dispatchEvent(new CustomEvent("quacker:home-refresh"));
    });
  }

  function scheduleNotificationsRefresh() {
    if (notificationsRefreshScheduled) return;
    notificationsRefreshScheduled = true;

    queueMicrotask(() => {
      notificationsRefreshScheduled = false;
      window.NotificationsUI?.render?.().catch?.(console.error);
    });
  }

  function scheduleLibraryRefresh() {
    if (libraryRefreshPromise) return libraryRefreshPromise;

    libraryRefreshPromise = Promise.resolve()
      .then(() => window.LibraryUI?.load?.())
      .then(() => window.LibraryUI?.render?.())
      .catch(console.error)
      .finally(() => {
        libraryRefreshPromise = null;
      });

    return libraryRefreshPromise;
  }

  function scheduleListsRefresh() {
    if (listsRefreshPromise) return listsRefreshPromise;

    listsRefreshPromise = Promise.resolve()
      .then(() => window.ListsModule?.load?.())
      .catch(console.error)
      .finally(() => {
        listsRefreshPromise = null;
      });

    return listsRefreshPromise;
  }

  // ===== REFRESCO GLOBAL (una sola fuente de verdad) =====
  // Cuando ApiClient cambia datos reales (biblioteca/listas/notificaciones),
  // emitimos refrescos oficiales para mantener Home / Explore / Listas sincronizados.
  document.addEventListener("quacker:data-changed", (e) => {
    const detail = e?.detail || {};
    const kind = String(detail.kind || "").trim();
    const action = String(detail.action || "").trim();
    const itemId = detail.itemId != null ? String(detail.itemId).trim() : null;
    const listId = detail.listId != null ? String(detail.listId).trim() : null;

    // 1) Home + notificaciones solo cuando cambia contenido real (no para ajustes de usuario)
    const affectsHome =
      kind === "library" ||
      kind === "lists" ||
      kind === "notifications" ||
      kind === "activities" ||
      kind === "goals";

    if (affectsHome) {
      scheduleHomeRefresh();
      scheduleNotificationsRefresh();
    }

    // 1.b) Si estás en Perfil y cambia el usuario, recargamos el formulario
    const isProfileActive = document.querySelector("#view-profile")?.classList.contains("is-active");
    if (isProfileActive && kind === "user") {
      // Perfil no expone load público ahora, así que re-inicializamos de forma defensiva:
      // (solo recarga datos del formulario; no duplica listeners porque init ya los bindea una vez)
      try {
        // si más adelante expones ProfileModule.load(), cambiamos esto por load().
        window.ProfileModule?.load?.() || window.ProfileModule?.init?.();
      } catch (e) {
        console.error(e);
      }
    }

    // 3) Explore: actualizar contadores "En X listas" cuando cambian listas o biblioteca
    if (kind === "lists" || kind === "library") {
      document.dispatchEvent(new CustomEvent("quacker:lists-changed", {
        detail: { itemId, listId }
      }));
    }

    // 4) Si estás en Biblioteca, recargar solo cuando hace falta de verdad.
    // Para add/remove de items en listas usamos parche local en LibraryUI.
    const isLibraryActive = document.querySelector("#view-library")?.classList.contains("is-active");
    const isListMembershipMutation =
      kind === "lists" &&
      (action === "add_item" || action === "remove_item");

    if (isLibraryActive && (kind === "library" || (kind === "lists" && !isListMembershipMutation))) {
      scheduleLibraryRefresh();
    }

    // 5) Si estás en Listas, recargar solo cuando cambian listas o biblioteca
    const isListsActive = document.querySelector("#view-lists")?.classList.contains("is-active");
    if (isListsActive && (kind === "lists" || kind === "library")) {
      scheduleListsRefresh();
    }
  });

  document.addEventListener("quacker:view-change", (e) => {
    const viewId = e?.detail?.viewId;

    try {
      if (viewId === "home") {
        window.HomeUI?.refresh?.();
        return;
      }

      if (viewId === "library") {
        scheduleLibraryRefresh();
        return;
      }

      if (viewId === "lists") {
        scheduleListsRefresh();
        return;
      }

      if (viewId === "explore") {
        return;
      }

      if (viewId === "profile") {
        window.ProfileModule?.load?.() || window.ProfileModule?.init?.();
      }
    } catch (err) {
      console.error("View change refresh error:", err);
    }
  });

  // ===== SIDEBAR TOGGLE =====
  const sidebar = document.getElementById("sidebar");
  const sidebarToggle = document.getElementById("sidebarToggle");
  const SIDEBAR_COLLAPSED_KEY = "quacker:sidebar-collapsed";

  function applySidebarCollapsed(collapsed) {
    if (!sidebar || !sidebarToggle) return;
    sidebar.classList.toggle("collapsed", collapsed);
    sidebarToggle.setAttribute(
      "aria-label",
      window.I18n?.t?.(collapsed ? "sidebar_expand" : "sidebar_collapse") || ""
    );
    sidebarToggle.setAttribute("aria-expanded", String(!collapsed));
  }

  if (sidebar && sidebarToggle) {
    const savedCollapsed = window.localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === "true";
    applySidebarCollapsed(savedCollapsed);

    sidebarToggle.addEventListener("click", () => {
      const collapsed = !sidebar.classList.contains("collapsed");
      applySidebarCollapsed(collapsed);
      window.localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(collapsed));
    });
  }

  // ===== PROFILE MENU (chip arriba derecha) =====
  const profileChip = $("#profileChip");
  const profileMenu = $("#profileMenu");

  if (profileChip && profileMenu) {
    // Abrir/cerrar al hacer click en el chip
    profileChip.addEventListener("click", (e) => {
      e.stopPropagation();
      const isOpen = profileMenu.classList.toggle("is-open");
      profileMenu.setAttribute("aria-hidden", String(!isOpen));

      // Si abro el menú de perfil, cierro las notificaciones
      const notifPanelEl = document.getElementById("notifPanel");
      if (isOpen && notifPanelEl) {
        notifPanelEl.classList.remove("is-open");
      }
    });

    // Cerrar al clicar fuera
    document.addEventListener("click", (e) => {
      if (!profileMenu.classList.contains("is-open")) return;
      if (!profileMenu.contains(e.target) && !profileChip.contains(e.target)) {
        profileMenu.classList.remove("is-open");
        profileMenu.setAttribute("aria-hidden", "true");
      }
    });

    // Cerrar con Escape
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        profileMenu.classList.remove("is-open");
        profileMenu.setAttribute("aria-hidden", "true");
      }
    });

    // Acciones del menú
    profileMenu.addEventListener("click", async (e) => {
      const item = e.target.closest(".profile-menu-item");
      if (!item) return;

      const action = item.dataset.profileAction;

      switch (action) {
        case "profile": {
          const profileBtn = document.querySelector('.nav-item-btn[data-view="profile"]');
          if (profileBtn) profileBtn.click();
          break;
        }

        case "settings": {
          const profileBtn = document.querySelector('.nav-item-btn[data-view="profile"]');
          if (profileBtn) profileBtn.click();
          break;
        }

        case "theme": {
          const themeToggle = $("#themeToggle");
          if (themeToggle) themeToggle.click();
          break;
        }

        case "logout": {
          try {
            await ApiClient.logout();
          } catch (err) {
            console.error(err);
          } finally {
            window.location.href = "index.html";
          }
          break;
        }
      }

      profileMenu.classList.remove("is-open");
      profileMenu.setAttribute("aria-hidden", "true");
    });

    // ===== LANG TOGGLE (persistente en user via ApiClient) =====
    const langBtns = $all(".lang-btn");

    function applyActiveLang(lang) {
      langBtns.forEach(b => b.classList.toggle("active", b.dataset.lang === lang));
    }

    // Cargar preferencia inicial
    (async () => {
      try {
        const transport = String(ApiClient.getTransportInfo?.()?.transport || "").trim().toLowerCase();
        if (transport === "http") {
          const prefs = await ApiClient.getUserPreferences?.();
          const lang = (prefs?.language === "en" || prefs?.language === "es")
            ? prefs.language
            : (window.I18n?.getLang?.() || "es");

          window.I18n?.setLang?.(lang);
          applyActiveLang(lang);
          return;
        }

        const savedLang = localStorage.getItem("quacker:lang");

        if (savedLang === "en" || savedLang === "es") {
          applyActiveLang(savedLang);
          return;
        }

        const prefs = await ApiClient.getUserPreferences?.();
        const lang = (prefs?.language === "en" || prefs?.language === "es")
          ? prefs.language
          : (window.I18n?.getLang?.() || "es");

        window.I18n?.setLang?.(lang);
        applyActiveLang(lang);
      } catch (e) {
        console.error(e);
        const fallbackLang = window.I18n?.getLang?.() || "es";
        window.I18n?.setLang?.(fallbackLang);
        applyActiveLang(fallbackLang);
      }
    })();

    // Click: guardar preferencia
    langBtns.forEach(btn => {
      if (btn.__quackerBound) return;
      btn.__quackerBound = true;
      btn.addEventListener("click", async () => {
        const lang = btn.dataset.lang;
        if (!lang) return;
        window.I18n?.setLang?.(lang);
        applyActiveLang(lang);
        try {
          await ApiClient.setUserLanguage(lang);
          window.toast?.({
            title: window.I18n?.t?.("settings_language_updated"),
            message: window.I18n?.t?.("settings_language_saved"),
            type: "success",
            duration: 2000
          });
        } catch (e) {
          console.error(e);
          window.toast?.({
            title: window.I18n?.t?.("settings_language_save_error"),
            message: window.I18n?.t?.("home_notif_try_again"),
            type: "error",
            duration: 3000
          });
        }
      });
    });
  }
});
