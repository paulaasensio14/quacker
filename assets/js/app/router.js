// assets/js/app/router.js
// Router muy simple basado en data-view-id y botones con data-view.

const Router = (() => {
  const views = {};

  let currentView = null;
  let mainScrollEl = null;
  const viewScrollPositions = {};

  function _trimSearchValue(v) {
    return String(v || "").trim();
  }

  const VIEW_SEARCH_STORAGE_KEY = "quacker:view-search";

  function _readViewSearchState() {
    try {
      const raw = window.sessionStorage.getItem(VIEW_SEARCH_STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : {};
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch (_) {
      return {};
    }
  }

  function _writeViewSearchState(nextState) {
    try {
      window.sessionStorage.setItem(
        VIEW_SEARCH_STORAGE_KEY,
        JSON.stringify(nextState || {})
      );
    } catch (_) {}
  }

  function _persistSearchForView(viewId, value) {
    const v = _trimSearchValue(value);

    if (viewId !== "library" && viewId !== "explore") return;

    const state = _readViewSearchState();
    state[viewId] = { searchTerm: v };
    _writeViewSearchState(state);
  }

  function _restoreSearchForView(viewId, inputEl) {
    if (!inputEl) return;
    if (viewId !== "library" && viewId !== "explore") return;

    const state = _readViewSearchState();
    inputEl.value = _trimSearchValue(state?.[viewId]?.searchTerm);
  }

  function registerView(id, element) {
    views[id] = element;
  }

  function showView(id) {
    if (!views[id]) return;

    const prevView = currentView;

    if (!mainScrollEl) {
      mainScrollEl = document.querySelector("main.app-main");
    }

    if (prevView && mainScrollEl) {
      viewScrollPositions[prevView] = mainScrollEl.scrollTop;
    }

    // Si salimos de Biblioteca o Explorar, persistimos el término actual del buscador global

    const globalSearchPrev = document.querySelector("#globalSearch");

    if (prevView && globalSearchPrev && (prevView === "library" || prevView === "explore")) {

    _persistSearchForView(prevView, globalSearchPrev.value);

    }

    // 1) activar vista
    if (currentView) {
      views[currentView].classList.remove("is-active");
    }

    views[id].classList.add("is-active");

    currentView = id;

    requestAnimationFrame(() => {
      if (!mainScrollEl) {
        mainScrollEl = document.querySelector("main.app-main");
      }

      if (!mainScrollEl) return;

      const savedScrollTop = viewScrollPositions[id] ?? 0;
      mainScrollEl.scrollTop = savedScrollTop;
    });

    // 2) topbar title
    const titles = {
      home: "Inicio",
      explore: "Explorar",
      library: "Mi biblioteca",
      lists: "Listas personalizadas",
      profile: "Mi perfil"
    };
    const titleEl = document.querySelector("#sectionTitle");
    if (titleEl) titleEl.textContent = titles[id] || "Quacker";

    // 3) topbar subtitle (solo texto)
    const subtitles = {
      home: "Resumen de tu actividad en Quacker",
      explore: "Novedades y recomendaciones para añadir a tu ocio",
      library: "Todos tus contenidos en un solo lugar",
      lists: "Organiza tu contenido como quieras",
      profile: "Ajusta tu cuenta de Quacker"
    };
    const subtitleTextEl = document.querySelector("#sectionSubtitleText");
    if (subtitleTextEl) subtitleTextEl.textContent = subtitles[id] || "";

    // 3.5) Search global contextual (Biblioteca / Explorar)
    const globalSearch = document.querySelector("#globalSearch");
    const globalSearchBox = document.querySelector("#globalSearchBox");
    const globalSearchClear = document.querySelector("#globalSearchClear");

    const setSearchEnabled = (enabled) => {
      if (!globalSearch) return;

      globalSearch.disabled = !enabled;

      if (globalSearchBox) {
        globalSearchBox.classList.toggle("is-disabled", !enabled);
        globalSearchBox.setAttribute("aria-disabled", enabled ? "false" : "true");

        // micro feedback al habilitar
        if (enabled) {
          globalSearchBox.classList.add("is-pop");
          window.setTimeout(() => globalSearchBox.classList.remove("is-pop"), 180);
        } else {
          globalSearchBox.classList.remove("is-pop");
        }
      }

      // botón X: solo interactivo si hay valor y está enabled
      if (globalSearchClear) {
        globalSearchClear.tabIndex = enabled ? 0 : -1;
      }
    };

    const syncClearVisibility = () => {
      if (!globalSearchBox || !globalSearch) return;
      const has = String(globalSearch.value || "").trim().length > 0;
      globalSearchBox.classList.toggle("has-value", has);
    };

    if (globalSearch) {
      if (id === "library") {
        setSearchEnabled(true);
        globalSearch.placeholder = "Buscar en Mi biblioteca...";
        _restoreSearchForView("library", globalSearch);
        syncClearVisibility();
      } else if (id === "explore") {
        setSearchEnabled(true);
        globalSearch.placeholder = "Buscar en Explorar...";
        _restoreSearchForView("explore", globalSearch);
        syncClearVisibility();
      } else {
        // En otras vistas, lo desactivamos y lo vaciamos visualmente,
        // pero el término queda persistido por vista (library/explore).
        globalSearch.value = "";
        setSearchEnabled(false);
        globalSearch.placeholder = "Buscar contenido...";
        syncClearVisibility();
      }
    }

    // 4) limpiar contador si NO estamos en biblioteca
    const countInline = document.querySelector("#libraryCountInline");
    if (countInline && id !== "library") {
      countInline.style.display = "none";
      countInline.textContent = "";
    }

    // 5) evento global
    document.dispatchEvent(
      new CustomEvent("quacker:view-change", { detail: { viewId: id } })
    );
  }

  function init() {
    document.querySelectorAll(".view").forEach((view) => {
      const id = view.getAttribute("data-view-id");
      if (id) registerView(id, view);
    });

    document.querySelectorAll(".nav-item-btn[data-view]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.dataset.view;
        showView(id);

        document.querySelectorAll(".nav-item-btn").forEach((b) =>
          b.classList.toggle("is-active", b === btn)
        );
      });
    });

     // Buscar: botón X (bind una sola vez)
     const globalSearch = document.querySelector("#globalSearch");
     const globalSearchBox = document.querySelector("#globalSearchBox");
     const globalSearchClear = document.querySelector("#globalSearchClear");

     const syncClearVisibility = () => {
       if (!globalSearchBox || !globalSearch) return;
       const has = String(globalSearch.value || "").trim().length > 0;
       globalSearchBox.classList.toggle("has-value", has);
     };

    if (globalSearch) {
      globalSearch.addEventListener("input", () => {
        syncClearVisibility();
      });
    }

    const clearGlobalSearch = () => {
      if (!globalSearch || globalSearch.disabled) return false;

      const had = String(globalSearch.value || "").trim().length > 0;
      if (!had) return false;

      globalSearch.value = "";
      syncClearVisibility();

      // dispara el mismo flujo que usan Biblioteca y Explorar
      globalSearch.dispatchEvent(new Event("input", { bubbles: true }));

      return true;
    };

    if (globalSearchClear && globalSearch) {
      globalSearchClear.addEventListener("click", () => {
        const cleared = clearGlobalSearch();
        if (cleared) globalSearch.focus();
      });
    }

    // Escape: limpiar búsqueda (solo Biblioteca/Explorar), sin interferir con modales/drawer
    document.addEventListener("keydown", (e) => {
      if (e.key !== "Escape") return;
      if (e.defaultPrevented) return;

      const activeView =
        document.querySelector(".view.is-active")?.getAttribute("data-view-id") || "";

      if (activeView !== "library" && activeView !== "explore") return;
      if (!globalSearch || globalSearch.disabled) return;

      // Si hay un modal abierto, el modal gestiona Escape
      if (document.querySelectorAll(".modal-overlay.is-open").length > 0) return;

      // Si el drawer de Explore está abierto, Explore gestiona Escape
      const exploreDrawer = document.getElementById("exploreDrawer");
      if (exploreDrawer && exploreDrawer.classList.contains("is-open")) return;

      // Si el foco está en otro input/textarea, no tocamos (solo el buscador global o nada)
      const ae = document.activeElement;
      const isTypingOther =
        ae &&
        (ae.tagName === "INPUT" || ae.tagName === "TEXTAREA") &&
        ae !== globalSearch;

      if (isTypingOther) return;

      const cleared = clearGlobalSearch();
      if (cleared) {
        e.preventDefault();
        globalSearch.focus();
      }
    });

    // Vista inicial según HTML
    const initial = document.querySelector(".view.is-active")?.dataset.viewId;
    if (initial) showView(initial);
  }

  return { init, showView };
})();

window.Router = Router;
