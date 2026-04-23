// assets/js/app/explore.js
// Explore v1 — UI → ApiClient

const ExploreModule = (() => {
  let feed = [];
  let featuredFeed = [];
  let visible = [];
  let _libraryCache = [];
  let activeEid = null;
  let dismissed = new Set();
  let expandedSection = null;
  let sectionShownCount = { novedades: 0, tendencias: 0, recomendados: 0 };

  const LOAD_MORE_STEP = 12; // cuántos más se cargan cada vez

  let typeFilter = "all";
  let sortMode = "recent";
  let searchTerm = "";

  // Debounce (Explorar)

  let __applyTimer = null;
  let __toolbarBound = false;

  let __drawerOpen = false;
  let __drawerExpanded = false;
  let __drawerLastFocusEl = null;
  let __drawerListsPickerOpen = false;
  let __pendingLibraryEnsures = new Map();
  let __drawerDetailLoading = false;
  let __drawerDetailError = false;
  let __drawerDetailReqSeq = 0;
  const __drawerDetailCache = new Map();
  let __libraryStateSyncPromise = null;

  function _renderDrawerAddCtaLabel() {
    const btn = document.getElementById("exploreDrawerAddLibrary");
    if (!btn) return;
    if (btn.dataset?.busy === "1") return;
    btn.textContent = window.I18n.t("explore_drawer_add_library");
  }

  function _scheduleApplyFilters() {
    if (__applyTimer) clearTimeout(__applyTimer);

    __applyTimer = setTimeout(async () => {
      try {
        await load();
      } catch (e) {
        console.error("Explore remote search failed", e);
      }
    }, 250);
  }

  const TYPE_LABELS = {
    serie: () => window.I18n.t("type_series"),
    pelicula: () => window.I18n.t("type_movie"),
    book: () => window.I18n.t("type_book"),
    game: () => window.I18n.t("type_game")
  };

  function $(sel) {
    return document.querySelector(sel);
  }

  function _safeText(v) {
    return (v ?? "").toString();
  }

  function _norm(s) {
    return _safeText(s).trim().toLowerCase();
  }

  function _normalizeId(value) {
    return _safeText(value).trim();
  }

  function _normalizeExploreItem(rawItem, index = 0) {
    const raw = rawItem && typeof rawItem === "object" ? rawItem : {};
    const eid = _normalizeId(raw.eid) || `explore_${index + 1}`;
    const title = _safeText(raw.title).trim() || window.I18n.t("common_untitled");

    const rawType = _norm(raw.type);
    const type =
      rawType === "serie" || rawType === "series" || rawType === "tv" || rawType === "show"
        ? "serie"
        : rawType === "pelicula" || rawType === "película" || rawType === "movie" || rawType === "film"
          ? "pelicula"
          : rawType === "book" || rawType === "libro" || rawType === "books"
            ? "book"
            : rawType === "game" || rawType === "videojuego" || rawType === "videogame"
              ? "game"
              : rawType;

    const cover = _safeText(raw.cover).trim();
    const backdrop = _safeText(raw.backdrop).trim();
    const releaseDate = _safeText(raw.releaseDate).trim();
    const summary = _safeText(raw.summary).trim();
    const releaseDateObj = releaseDate ? new Date(releaseDate) : null;
    const releaseTs = releaseDateObj && !Number.isNaN(releaseDateObj.getTime()) ? releaseDateObj.getTime() : null;

    return {
      ...raw,
      eid,
      title,
      type,
      cover,
      backdrop,
      releaseDate,
      summary,
      __releaseTs: releaseTs,
      __isNew: releaseDate ? _isNewByDate(releaseDate) : false
    };
  }

  function _daysBetween(a, b) {
    const ms = Math.abs(a.getTime() - b.getTime());
    return Math.floor(ms / (1000 * 60 * 60 * 24));
  }

  function _isNewByDate(releaseDateStr) {
    if (!releaseDateStr) return false;
    const d = new Date(releaseDateStr);
    if (Number.isNaN(d.getTime())) return false;
    const days = _daysBetween(new Date(), d);
    return days <= 30;
  }

  function _cardCover(item) {
    const title = _safeText(item?.title).trim();
    const initials = title ? title.slice(0, 1).toUpperCase() : "Q";
    const cover = _safeText(item?.cover).trim();
    const backdrop = _safeText(item?.backdrop).trim();
    const isGame = _norm(item?.type) === "game";
    const imageUrl = isGame ? (cover || backdrop) : cover;
    const imageAlt = window.I18n
      .t("explore_cover_alt")
      .replace("{title}", title || window.I18n.t("explore_content_fallback"));

    if (imageUrl) {
      return `
        <div class="explore-cover${isGame ? " explore-cover--game" : ""}">
          <img
            class="explore-cover-img${isGame ? " explore-cover-img--game" : ""}"
            src="${imageUrl}"
            alt="${imageAlt}"
            loading="lazy"
            referrerpolicy="no-referrer"
            onerror="this.style.display='none'; this.parentElement.classList.add('is-fallback');"
            ${isGame ? 'style="object-fit: cover; object-position: center top;"' : ""}
          />
          <span class="explore-cover-initial">${initials}</span>
        </div>
      `;
    }

    return `
      <div class="explore-cover is-fallback" aria-hidden="true">
        <span class="explore-cover-initial">${initials}</span>
      </div>
    `;
  }

  function _renderExploreSkeleton() {
    const container = document.querySelector("[data-explore-container]");
    const empty = document.getElementById("exploreEmpty");
    const isActive = document.querySelector("#view-explore")?.classList.contains("is-active");

    if (!container || !isActive) return;

    if (empty) empty.hidden = true;
    container.hidden = false;

    const renderSkeletonCard = () => `
      <article class="explore-card explore-card--skeleton" aria-hidden="true">
        <div class="explore-cover explore-skel-cover"></div>

        <div class="explore-card-overlay">
          <span class="explore-card-type explore-card-type--skeleton"></span>
        </div>
      </article>
    `;

    const renderSkeletonSection = (title, count) => `
      <section class="explore-section explore-section--skeleton" aria-hidden="true">
        <header class="explore-section-header">
          <div>
            <div class="explore-skel-section-title"></div>
            <div class="explore-skel-section-subtitle"></div>
          </div>

          <div class="explore-skel-section-actions"></div>
        </header>

        <div class="explore-section-grid">
          ${Array.from({ length: count }).map(renderSkeletonCard).join("")}
        </div>
      </section>
    `;

    container.innerHTML = [
      renderSkeletonSection(window.I18n.t("explore_section_trending"), 12)
    ].join("");
  }

  function _buildExploreCardViewModel(item) {
    const title = _safeText(item?.title) || window.I18n.t("common_untitled");
    const normalizedType = _norm(item?.type);
    const typeLabel =
      TYPE_LABELS[normalizedType]?.() ||
      (normalizedType === "tv" ? window.I18n.t("home_type_series") : "") ||
      (normalizedType === "movie" ? window.I18n.t("home_type_movie") : "") ||
      (normalizedType === "libro" ? window.I18n.t("home_type_book") : "") ||
      (normalizedType === "videojuego" ? window.I18n.t("home_type_game") : "") ||
      window.I18n.t("lists_type_content");
    const isNew = _isNewByDate(item?.releaseDate);
    const saved = !!item?.__inLibrary;
    const saving = !!item?.__saving;
    const eid = _normalizeId(item?.eid);

    return {
      title,
      typeLabel,
      isNew,
      saved,
      saving,
      eid
    };
  }

  function _getFeaturedVisible() {
    const featuredSeen = new Set();

    return featuredFeed.filter((item) => {
      const eid = _normalizeId(item?.eid);
      if (!eid) return false;
      if (featuredSeen.has(eid)) return false;
      if (dismissed.has(eid)) return false;
      if (typeFilter !== "all" && item.type !== typeFilter) return false;

      featuredSeen.add(eid);
      return true;
    });
  }

  function _renderSearchResults({ container, empty, activeItems, renderCard }) {
    const titleSuffix = typeFilter !== "all" ? ` · ${TYPE_LABELS[typeFilter]?.() || typeFilter}` : "";
    const hasAny = activeItems.length > 0;
    const resultsTitle = window.I18n.t("explore_results_title");
    const resultsShowing = window.I18n.t("explore_results_showing")
      .replace("{count}", String(activeItems.length))
      .replace("{suffix}", titleSuffix);

    container.innerHTML = hasAny ? `
      <section class="explore-results">
        <div class="explore-results-head">
          <h2 class="explore-section-title">${resultsTitle} “${searchTerm}”</h2>
          <p class="explore-section-sub">${resultsShowing}</p>
        </div>
        <div class="explore-section-grid">
          ${activeItems.map(renderCard).join("")}
        </div>
      </section>
    ` : "";

    container.hidden = !hasAny;
    if (empty) empty.hidden = hasAny;
  }

  function _renderExploreSection(section, renderCard) {
    const { key, title, subtitle, items, limit } = section;
    if (!items || items.length === 0) return "";

    const isExpanded = expandedSection === key;
    const shownCount = isExpanded
      ? Math.min(items.length, sectionShownCount[key] || limit)
      : Math.min(items.length, limit);
    const shown = items.slice(0, shownCount);

    const canExpand = !isExpanded && items.length > limit;
    const canLoadMore = isExpanded && shownCount < items.length;

    return `
      <section class="explore-section" data-section="${key}">
        <header class="explore-section-header">
          <div>
            <h2 class="explore-section-title">${title}</h2>
            ${subtitle ? `<p class="explore-section-sub">${subtitle}</p>` : ""}
          </div>

          <div class="explore-section-actions">
            ${canExpand
              ? `<button type="button" class="btn-ghost explore-section-btn" data-explore-section-action="expand" data-section="${key}">${window.I18n.t("explore_action_view_more")}</button>`
              : ""}

            ${canLoadMore
              ? `<button type="button" class="btn-ghost explore-section-btn"
              data-explore-section-action="load-more"
              data-section="${key}">
              ${window.I18n.t("explore_action_load_more")}
              </button>`
              : ""}

            ${isExpanded
              ? `<button type="button" class="btn-ghost explore-section-btn" data-explore-section-action="collapse">${window.I18n.t("explore_action_back")}</button>`
              : ""}
          </div>
        </header>

        <div class="explore-section-grid">
          ${shown.map(renderCard).join("")}
        </div>
      </section>
    `;
  }

  function _getExploreSections(tendenciasAll) {
    return [
      {
        key: "featured",
        title: window.I18n.t("explore_section_trending"),
        subtitle: "Lo más interesante para ver, leer o jugar esta semana",
        items: tendenciasAll,
        limit: 12,
      }
    ];
  }

  function _getSectionsToRender(SECTIONS) {
    if (expandedSection) {
      return SECTIONS.filter((s) => s.key === expandedSection);
    }
    return SECTIONS;
  }

  function _render() {
    const container = document.querySelector("[data-explore-container]");
    const empty = document.getElementById("exploreEmpty");
    if (!container) return;

    const isActive = document.querySelector("#view-explore")?.classList.contains("is-active");
    if (!isActive) return;

  // --- Secciones Explore v1.4 (con “Ver más”) ---
  const isNewItem = (it) => !!it.__isNew;

  // Destacados esta semana:
  // usar el orden original del feed que llega de la API,
  // sin recomponer artificialmente por tipo en frontend.
  const tendenciasAll = _getFeaturedVisible();

  const SECTIONS = _getExploreSections(tendenciasAll);

  // Inicializa shownCount si está a 0 (para modo expandido)
  for (const s of SECTIONS) {
    if (!sectionShownCount[s.key] || sectionShownCount[s.key] < s.limit) {
      sectionShownCount[s.key] = s.limit;
    }
  }

  // Si estamos en modo “ver más” pero esa sección se queda vacía (por filtros/búsqueda), volvemos al modo normal
  if (expandedSection && !SECTIONS.some((s) => s.key === expandedSection && s.items.length > 0)) {
    expandedSection = null;
  }

  // Helper para renderizar cards (reutiliza tu HTML actual)
  const renderCard = (item) => {
    const vm = _buildExploreCardViewModel(item);
    const openDetailLabel = window.I18n.t("explore_card_open_detail")
      .replace("{title}", vm.title);
    return `
    <article
      class="explore-card explore-card--poster"
      data-eid="${vm.eid}"
      data-action="open-item-detail"
      tabindex="0"
      role="button"
      aria-label="${openDetailLabel}">
      ${_cardCover(item)}
      <div class="explore-card-overlay">
        <span class="explore-card-type">
          ${vm.typeLabel}
        </span>
      </div>
    </article>
    `;
  };

  const normalizedSearch = _norm(searchTerm);
  const isSearchMode = Boolean(normalizedSearch);
  const activeItems = isSearchMode ? visible : tendenciasAll;

  if (isSearchMode) {
    _renderSearchResults({ container, empty, activeItems, renderCard });
    return;
  }

    const sectionsToRender = _getSectionsToRender(SECTIONS);

    const hasAny = sectionsToRender.some((s) => (s.items || []).length > 0);

    // Render secciones (aunque luego ocultemos la grid, para mantener consistencia interna)
    container.innerHTML = sectionsToRender.map((section) => _renderExploreSection(section, renderCard)).join("");

    // Si no hay resultados: ocultar grid y mostrar empty state
    container.hidden = !hasAny;
    if (empty) empty.hidden = hasAny;

  }

  function _getFeedVisible() {
    const t = typeFilter;
    const q = _norm(searchTerm);

    let out = [...feed];

    out = out.filter((x) => !dismissed.has(_normalizeId(x?.eid)));

    if (t !== "all") {
      out = out.filter((x) => x.type === t);
    }

    if (sortMode === "title") {
      out.sort((a, b) =>
        _safeText(a.title).localeCompare(_safeText(b.title), "es", {
          sensitivity: "base",
        })
      );
    } else if (!q) {
      out.sort((a, b) => {
        const aTs = Number(a?.__releaseTs || 0);
        const bTs = Number(b?.__releaseTs || 0);
        return bTs - aTs;
      });
    }

    if (q) {
      out = out.filter((x) => {
        const title = _norm(x.title);
        const summary = _norm(x.summary);
        return title.includes(q) || summary.includes(q);
      });
    }

    return out;
  }

  function _applyFilters() {
    visible = _getFeedVisible();
    _render();
  }

  function _syncExploreToolbarUI() {
    const pillsRoot = document.querySelector("[data-explore-type]");
    const sortSelect = document.getElementById("exploreSort");

    if (pillsRoot) {
      pillsRoot.querySelectorAll(".pill-btn[data-value]").forEach((btn) => {
        btn.classList.toggle("active", btn.dataset.value === typeFilter);
        btn.setAttribute("aria-pressed", btn.dataset.value === typeFilter ? "true" : "false");
      });
    }

    if (sortSelect && sortSelect.value !== sortMode) {
      sortSelect.value = sortMode;
    }
  }

  function _bindExploreToolbar() {

    if (__toolbarBound) return;

    __toolbarBound = true;

    const pillsRoot = document.querySelector("[data-explore-type]");
    const sortSelect = document.getElementById("exploreSort");

    if (pillsRoot) {

      pillsRoot.addEventListener("click", (e) => {
        const btn = e.target.closest(".pill-btn[data-value]");

        if (!btn) return;

        const nextType = String(btn.dataset.value || "all");

        if (nextType === typeFilter) return;

        typeFilter = nextType;

        expandedSection = null;

        _syncExploreToolbarUI();

        _applyFilters();
      });

    }

    if (sortSelect) {

      sortSelect.addEventListener("change", () => {

        const nextSort = String(sortSelect.value || "recent");

        if (nextSort === sortMode) return;

        sortMode = nextSort;

        expandedSection = null;
        _syncExploreToolbarUI();

        _applyFilters();

      });

    }

    _syncExploreToolbarUI();

  }

  function _openExploreDrawer(triggerEl) {
    const drawer = document.getElementById("exploreDrawer");
    const backdrop = document.getElementById("exploreDrawerBackdrop");
    const closeBtn = document.getElementById("exploreDrawerClose");

    if (!drawer || !backdrop) return;

    const wasOpen = drawer.classList.contains("is-open");
    __drawerOpen = true;

    if (!wasOpen) __drawerLastFocusEl = triggerEl || document.activeElement;

    // Mostrar overlay + abrir panel
    backdrop.hidden = false;
    drawer.classList.add("is-open");
    drawer.setAttribute("aria-hidden", "false");

    const details = document.getElementById("exploreDrawerDetails");
    if (details) {
      details.hidden = false;
    }

    _syncExploreDrawerViewport();

    // Bloquear scroll (reutilizamos tu patrón existente)
    document.body.classList.add("modal-open");

    // Foco inicial (solo si abrimos desde cerrado)
    if (!wasOpen) {
      requestAnimationFrame(() => {
        (closeBtn || drawer).focus?.();
      });
    }

    __drawerDetailLoading = false;
    __drawerDetailError = false;
    _syncExploreDrawerDetailFeedback();

    __drawerListsPickerOpen = false;
    _syncExploreDrawerListPicker();

    const activeItem = _getActiveExploreItem();

    if (activeItem) {
      _refreshExploreDrawerLibraryState(activeItem)
        .then((freshItem) => {
          if (!freshItem) return;
          _syncExploreDrawerFromItem(freshItem);
          return _hydrateExploreDrawerDetail(freshItem);
        })
        .catch((error) => {
          console.error("[Explore] failed to refresh drawer library state", error);
          _hydrateExploreDrawerDetail(activeItem);
        });
    }
  }

  function _closeExploreDrawer() {
    const drawer = document.getElementById("exploreDrawer");
    const backdrop = document.getElementById("exploreDrawerBackdrop");
    if (!drawer || !backdrop) return;

    __drawerOpen = false;
    __drawerDetailReqSeq += 1;
    activeEid = null;
    __drawerDetailLoading = false;
    __drawerDetailError = false;
    __drawerListsPickerOpen = false;
    _syncExploreDrawerDetailFeedback();
    _syncExploreDrawerListPicker();
    _renderDrawerAddCtaLabel(null);

    drawer.classList.remove("is-open");
    drawer.setAttribute("aria-hidden", "true");
    backdrop.hidden = true;
    document.body.classList.remove("modal-open");

    const note = document.getElementById("exploreDrawerInlineNote");
    if (note) {
      note.classList.remove("is-visible");
      note.hidden = true;
      note.textContent = "";
    }
    const coverEl = document.getElementById("exploreDrawerCover");
    if (coverEl) {
      coverEl.classList.remove("is-fallback");
      coverEl.style.backgroundImage = "none";
      coverEl.style.backgroundSize = "";
      coverEl.style.backgroundPosition = "";
      coverEl.style.backgroundRepeat = "";
    }
    _setExploreDrawerExpanded(false);

    document.documentElement.style.removeProperty("--explore-expanded-left");

    document.documentElement.style.removeProperty("--explore-expanded-top");

    document.documentElement.style.removeProperty("--explore-expanded-right");

    document.documentElement.style.removeProperty("--explore-expanded-bottom");

    const listPicker = document.getElementById("exploreDrawerListPicker");
    const listSelect = document.getElementById("exploreDrawerListSelect");

    if (listPicker) listPicker.hidden = true;
    if (listSelect) listSelect.value = "";

    const back = __drawerLastFocusEl;
    __drawerLastFocusEl = null;
    if (back && typeof back.focus === "function") {
      requestAnimationFrame(() => back.focus());
    }
  }

  function _getExploreItemByEid(eid) {
    const targetEid = _normalizeId(eid);
    if (!targetEid) return null;

    return (
      feed.find((x) => _normalizeId(x?.eid) === targetEid) ||
      featuredFeed.find((x) => _normalizeId(x?.eid) === targetEid) ||
      null
    );
  }

  function _getActiveExploreItem() {
    return _getExploreItemByEid(activeEid);
  }

  function _syncExploreDrawerListPicker() {
    const picker = document.getElementById("exploreDrawerListPicker");
    const addListsBtn = document.getElementById("exploreDrawerAddLists");

    if (picker) {
      picker.hidden = !__drawerListsPickerOpen;
    }

    if (addListsBtn) {
      addListsBtn.setAttribute(
        "aria-expanded",
        __drawerListsPickerOpen ? "true" : "false"
      );

      if (__drawerListsPickerOpen) {
        addListsBtn.classList.add("is-active");
      } else {
        addListsBtn.classList.remove("is-active");
      }
    }
  }

  async function _handleExploreDrawerAddToListClick() {
    const activeItem = _getActiveExploreItem();
    if (!activeItem) return;

    if (__drawerListsPickerOpen) {
      _closeExploreListPicker();
      return;
    }

    await _openExploreListPicker();
  }

  function _syncExploreDrawerDetailFeedback() {
    const loadingEl = document.getElementById("exploreDrawerDetailLoading");
    const errorEl = document.getElementById("exploreDrawerDetailError");

    if (loadingEl) {
      loadingEl.hidden = !__drawerDetailLoading;
    }

    if (errorEl) {
      errorEl.hidden = !__drawerDetailError;
    }
  }

  function _replaceExploreItemByEid(nextItem) {
    const targetEid = _normalizeId(nextItem?.eid);
    if (!targetEid) return nextItem || null;

    feed = feed.map((entry) =>
      _normalizeId(entry?.eid) === targetEid
        ? { ...entry, ...nextItem, eid: targetEid }
        : entry
    );

    featuredFeed = featuredFeed.map((entry) =>
      _normalizeId(entry?.eid) === targetEid
        ? { ...entry, ...nextItem, eid: targetEid }
        : entry
    );

    visible = visible.map((entry) =>
      _normalizeId(entry?.eid) === targetEid
        ? { ...entry, ...nextItem, eid: targetEid }
        : entry
    );

    return _getExploreItemByEid(targetEid);
  }

  async function _refreshExploreDrawerLibraryState(item) {
    if (!item?.eid) return item || null;

    const library = await ApiClient.getLibrary();
    _libraryCache = library || [];
    const matchedLibraryItemId = _normalizeId(
      window.ItemIdentity?.resolveLibraryItemIdFromCache?.(item, library)
    );

    const matchedItem = (library || []).find(
      (entry) => _normalizeId(entry?.id) === matchedLibraryItemId
    );

    const updatedItem = {
      ...item,
      __inLibrary: !!matchedItem,
      __libraryItemId: _normalizeId(matchedItem?.id)
    };

    return _replaceExploreItemByEid(updatedItem) || updatedItem;
  }

  function _patchExploreItemsByLibraryItemId(libraryItemId, patcher) {
    const targetLibraryItemId = _normalizeId(libraryItemId);
    if (!targetLibraryItemId || typeof patcher !== "function") return false;

    let didChange = false;

    const applyPatch = (entry) => {
      const entryLibraryItemId = _normalizeId(
        window.ItemIdentity.resolveLibraryItemIdFromCache(entry, _libraryCache)
      );
        
      if (entryLibraryItemId !== targetLibraryItemId) return entry;

      didChange = true;
      return {
        ...entry,
        ...patcher(entry)
      };
    };

    feed = feed.map(applyPatch);
    featuredFeed = featuredFeed.map(applyPatch);
    visible = visible.map(applyPatch);

    return didChange;
  }

  function _patchExploreItemsByEid(eid, patcher) {
    const targetEid = _normalizeId(eid);
    if (!targetEid || typeof patcher !== "function") return false;

    let didChange = false;

    const applyPatch = (entry) => {
      if (_normalizeId(entry?.eid) !== targetEid) return entry;

      didChange = true;
      return {
        ...entry,
        ...patcher(entry)
      };
    };

    feed = feed.map(applyPatch);
    featuredFeed = featuredFeed.map(applyPatch);
    visible = visible.map(applyPatch);

    return didChange;
  }

  function _scheduleExploreLibraryStateSync() {
    if (__libraryStateSyncPromise) return __libraryStateSyncPromise;

    __libraryStateSyncPromise = Promise.resolve()
      .then(() => _syncInLibraryFlags())
      .then(() => {
        _applyFilters();

        if (!__drawerOpen) return;

        const activeItem = _getActiveExploreItem();
        if (!activeItem) return;

        _syncExploreDrawerFromItem(activeItem);
        _renderExploreDrawerDetails(activeItem);
      })
      .catch((error) => {
        console.error("[Explore] failed to sync library state", error);
      })
      .finally(() => {
        __libraryStateSyncPromise = null;
      });

    return __libraryStateSyncPromise;
  }

  function _handleExploreDataChanged(event) {
    const detail = event?.detail || {};
    const kind = String(detail.kind || "").trim();

    if (kind === "library") {
      void _scheduleExploreLibraryStateSync();
      return;
    }

    if (kind === "lists") {
      const listAction = String(detail.action || "").trim();

      if (listAction !== "add_item" && listAction !== "remove_item") {
        void _scheduleExploreLibraryStateSync();
      }

      return;
    }

    if (kind !== "item_state") return;

    const action = String(detail.action || "").trim();
    const libraryItemId = _normalizeId(detail.itemId);
    if (!libraryItemId) return;

    const hasAuthoritativeListsCount = Number.isFinite(Number(detail.listsCount));
    const authoritativeListsCount = hasAuthoritativeListsCount
      ? Math.max(0, Number(detail.listsCount))
      : null;

    let didChange = false;

    if (action === "list_item_added") {
      didChange = _patchExploreItemsByLibraryItemId(libraryItemId, (entry) => ({
        __inLibrary: true,
        __libraryItemId: libraryItemId,
        __listsCount:
          authoritativeListsCount != null
            ? authoritativeListsCount
            : Number(entry?.__listsCount || 0) + 1
      }));
    }

    if (action === "list_item_removed") {
      didChange = _patchExploreItemsByLibraryItemId(libraryItemId, (entry) => ({
        __inLibrary: true,
        __libraryItemId: libraryItemId,
        __listsCount:
          authoritativeListsCount != null
            ? authoritativeListsCount
            : Math.max(0, Number(entry?.__listsCount || 0) - 1)
      }));
    }

    if (!didChange) return;

    _render();

    const activeItem = _getActiveExploreItem();
    const activeLibraryItemId = _normalizeId(activeItem?.__libraryItemId);

    if (activeItem && activeLibraryItemId === libraryItemId) {
      _syncExploreDrawerFromItem(activeItem);
    }
  }

  document.addEventListener("quacker:data-changed", _handleExploreDataChanged);

  function _syncExploreDrawerViewport() {
    if (!__drawerExpanded) return;

    const root = document.documentElement;
    if (!root) return;

    const inset = window.innerWidth <= 980 ? 16 : 20;

    root.style.setProperty("--explore-expanded-left", `${inset}px`);
    root.style.setProperty("--explore-expanded-top", `${inset}px`);
    root.style.setProperty("--explore-expanded-right", `${inset}px`);
    root.style.setProperty("--explore-expanded-bottom", `${inset}px`);
  }

  function _buildExploreDrawerTextModel(item) {
    const count = Number(item?.__listsCount || 0);
    const normalizedType = _norm(item?.type);
    const resolvedTypeLabel =
      TYPE_LABELS[normalizedType]?.() ||
      (normalizedType === "tv" ? window.I18n.t("home_type_series") : "") ||
      (normalizedType === "movie" ? window.I18n.t("home_type_movie") : "") ||
      (normalizedType === "libro" ? window.I18n.t("home_type_book") : "") ||
      (normalizedType === "videojuego" ? window.I18n.t("home_type_game") : "") ||
      window.I18n.t("lists_type_content");

    const metaParts = [
      resolvedTypeLabel,
      item?.releaseDate ? _safeText(item.releaseDate) : ""
    ].filter(Boolean);

    const badgeParts = [];
    if (item?.__inLibrary) {
      badgeParts.push(window.I18n.t("explore_drawer_in_library"));
    }

    return {
      title: _safeText(item?.title) || window.I18n.t("common_untitled"),
      meta: metaParts.join(" · "),
      summary:
        _safeText(item?.description) ||
        _safeText(item?.summary) ||
        window.I18n.t("explore_drawer_no_description"),
      detailType: resolvedTypeLabel,
      detailReleaseDate:
        item?.releaseDate
          ? _safeText(item.releaseDate)
          : window.I18n.t("explore_drawer_no_date"),
      detailLibraryState:
        item?.__inLibrary
          ? window.I18n.t("explore_drawer_in_library")
          : window.I18n.t("explore_drawer_not_saved"),
      detailListsCount:
        count === 0
          ? window.I18n.t("explore_drawer_not_in_lists")
          : window.I18n
              .t(
                count === 1
                  ? "explore_drawer_lists_count_single"
                  : "explore_drawer_lists_count_plural"
              )
              .replace("{count}", String(count)),
      badge: badgeParts.join(" · "),
      hasBadge: badgeParts.length > 0
    };
  }

  function _translateExploreStatusLabel(statusLabel) {
    const safeStatus = _safeText(statusLabel).trim();
    if (!safeStatus) return "";

    const normalized = safeStatus.toLowerCase();

    const keyMap = {
      "returning series": "explore_status_returning_series",
      "ended": "explore_status_ended",
      "canceled": "explore_status_canceled",
      "released": "explore_status_released",
      "in production": "explore_status_in_production",
      "planned": "explore_status_planned",
      "pilot": "explore_status_pilot"
    };

    const i18nKey = keyMap[normalized];

    if (!i18nKey) return safeStatus;

    const translated = window.I18n?.t?.(i18nKey);
    return translated || safeStatus;
  }

  function _buildExploreDrawerDetailMeta(item) {
    const genres = Array.isArray(item?.genres)
      ? item.genres.map((genre) => _safeText(genre).trim()).filter(Boolean)
      : [];

    const ratingNumber = Number(item?.rating || 0);
    const rating =
      Number.isFinite(ratingNumber) && ratingNumber > 0
        ? `${ratingNumber.toFixed(1)} / 10`
        : window.I18n.t("explore_detail_no_rating");

    const author = _safeText(item?.meta?.author).trim();
    const platforms = _safeText(item?.meta?.platforms).trim();
    const statusLabel = _translateExploreStatusLabel(item?.statusLabel);
    const runtimeNumber = Number(item?.runtime || 0);
    const totalPagesNumber = Number(item?.meta?.totalPages || 0);

    let primaryLabel = window.I18n.t("explore_detail_label_meta");
    let primaryValue = window.I18n.t("explore_detail_no_meta");

    if (author) {
      primaryLabel = window.I18n.t("explore_detail_label_author");
      primaryValue = author;
    } else if (runtimeNumber > 0) {
      primaryLabel = window.I18n.t("explore_detail_label_duration");
      primaryValue = `${runtimeNumber} ${window.I18n.t("time_minutes")}`;
    } else if (platforms) {
      primaryLabel = window.I18n.t("explore_detail_label_platforms");
      primaryValue = platforms;
    } else if (totalPagesNumber > 0) {
      primaryLabel = window.I18n.t("explore_detail_label_pages");
      primaryValue = `${totalPagesNumber} ${window.I18n.t("library_pages")}`;
    } else if (statusLabel) {
      primaryLabel = window.I18n.t("explore_detail_label_status");
      primaryValue = statusLabel;
    }

    return {
      genres: genres.length
        ? genres.join(", ")
        : window.I18n.t("explore_detail_no_genres"),
      rating,
      primaryLabel,
      primaryValue
    };
  }

  function _renderExploreDrawerDetails(item) {
    const vm = _buildExploreDrawerTextModel(item);
    const metaVm = _buildExploreDrawerDetailMeta(item);

    const titleEl = document.getElementById("exploreDrawerTitle");
    const metaEl = document.getElementById("exploreDrawerMeta");

    if (titleEl) titleEl.textContent = vm.title;
    if (metaEl) metaEl.textContent = vm.meta;

    const typeEl = document.getElementById("exploreDetailType");
    const releaseEl = document.getElementById("exploreDetailReleaseDate");
    const libraryEl = document.getElementById("exploreDetailLibraryState");
    const listsEl = document.getElementById("exploreDetailListsCount");
    const ratingEl = document.getElementById("exploreDetailRating");
    const genresEl = document.getElementById("exploreDetailGenres");
    const metaPrimaryLabelEl = document.getElementById("exploreDetailMetaPrimaryLabel");
    const metaPrimaryValueEl = document.getElementById("exploreDetailMetaPrimaryValue");
    const summaryEl = document.getElementById("exploreDetailSummary");

    if (typeEl) typeEl.textContent = vm.detailType;
    if (releaseEl) releaseEl.textContent = vm.detailReleaseDate;
    if (libraryEl) libraryEl.textContent = vm.detailLibraryState;
    if (listsEl) listsEl.textContent = vm.detailListsCount;

    if (ratingEl) {
      const rawRating = Number(item?.rating || 0);
      const safeRating = Number.isFinite(rawRating) ? Math.max(0, Math.min(10, rawRating)) : 0;

      const duckCount = Math.round(safeRating / 2);
      const maxDucks = 5;

      const ducks = Array.from({ length: maxDucks }, (_, i) => {
        const filled = i < duckCount;

        return `
          <img
            src="assets/img/quacker-rating.png"
            class="explore-rating-duck${filled ? " is-filled" : ""}"
            alt=""
            aria-hidden="true"
          />
        `;
      }).join("");

      ratingEl.innerHTML = `
        <span class="explore-rating-ducks" aria-label="${safeRating.toFixed(1)} sobre 10">
          ${ducks}
        </span>
        <span class="explore-rating-number">${safeRating.toFixed(1)}</span>
      `;
    }

    if (genresEl) genresEl.textContent = metaVm.genres;
    if (metaPrimaryLabelEl) metaPrimaryLabelEl.textContent = metaVm.primaryLabel;
    if (metaPrimaryValueEl) metaPrimaryValueEl.textContent = metaVm.primaryValue;

    if (summaryEl) {
      summaryEl.textContent = vm.summary;
      summaryEl.hidden = false;
    }
  }

  function _setExploreDrawerExpanded(next) {
    __drawerExpanded = !!next;

    const drawer = document.getElementById("exploreDrawer");
    const details = document.getElementById("exploreDrawerDetails");
    const expandBtn = document.getElementById("exploreDrawerExpand");

    if (!drawer || !details) return;

    drawer.classList.toggle("is-expanded", __drawerExpanded);
    details.hidden = !__drawerExpanded;

    const expandLabel = __drawerExpanded
      ? window.I18n.t("explore_drawer_toggle_hide")
      : window.I18n.t("explore_drawer_toggle_show");

    if (expandBtn) {
      expandBtn.setAttribute("aria-pressed", __drawerExpanded ? "true" : "false");
      expandBtn.setAttribute("aria-label", expandLabel);
      expandBtn.textContent = expandLabel;
    }

    if (__drawerExpanded) {
      _syncExploreDrawerViewport();
    }
  }

  function _getActiveExploreItem() {
    return _getExploreItemByEid(activeEid);
  }

  async function _hydrateExploreDrawerDetail(item) {
    if (!item) return;

    const source = _safeText(item?.source).trim();
    const type = _safeText(item?.type).trim();
    const externalId = _safeText(item?.externalId).trim();
    const eid = _normalizeId(item?.eid);

    if (!source || !type || !externalId || !eid) return;

    const cacheKey = `${source}:${type}:${externalId}`;
    const reqSeq = ++__drawerDetailReqSeq;

    __drawerDetailLoading = true;
    __drawerDetailError = false;
    _syncExploreDrawerDetailFeedback();

    if (__drawerDetailCache.has(cacheKey)) {
      if (reqSeq !== __drawerDetailReqSeq) return;
      if (activeEid !== eid) return;

      __drawerDetailLoading = false;
      __drawerDetailError = false;
      _syncExploreDrawerDetailFeedback();

      const cachedDetail = __drawerDetailCache.get(cacheKey);
      const mergedItem = {
        ...item,
        ...cachedDetail,
        eid,
        __saving: item.__saving
      };

      const persistedItem = _replaceExploreItemByEid(mergedItem) || mergedItem;

      _syncExploreDrawerFromItem(persistedItem);
      _renderExploreDrawerDetails(persistedItem);
      return;
    }

    try {
      const detail = await ApiClient.getExploreItemDetail({ source, type, externalId });

      if (!detail) {
        if (reqSeq !== __drawerDetailReqSeq) return;
        if (activeEid !== eid) return;

        __drawerDetailLoading = false;
        __drawerDetailError = true;
        _syncExploreDrawerDetailFeedback();
        return;
      }

      if (reqSeq !== __drawerDetailReqSeq) return;
      if (activeEid !== eid) return;

      __drawerDetailCache.set(cacheKey, detail);

      const mergedItem = {
        ...item,
        ...detail,
        eid,
        __saving: item.__saving
      };

      const persistedItem = _replaceExploreItemByEid(mergedItem) || mergedItem;

      __drawerDetailLoading = false;
      __drawerDetailError = false;
      _syncExploreDrawerDetailFeedback();

      _syncExploreDrawerFromItem(persistedItem);
      _renderExploreDrawerDetails(persistedItem);
    } catch (err) {
      if (reqSeq !== __drawerDetailReqSeq) return;
      if (activeEid !== eid) return;

      __drawerDetailLoading = false;
      __drawerDetailError = true;
      _syncExploreDrawerDetailFeedback();
      console.error("[Explore] drawer detail hydration failed", err);
    }
  }

  function _syncExploreDrawerFromItem(item) {
    if (!item) return null;
    const drawerEid = _normalizeId(item.eid);
    if (!drawerEid) return item;

    activeEid = drawerEid;

    const vm = _buildExploreDrawerTextModel(item);
    const titleEl = document.getElementById("exploreDrawerTitle");
    const metaEl = document.getElementById("exploreDrawerMeta");
    const coverEl = document.getElementById("exploreDrawerCover");
    const badgeEl = document.getElementById("exploreDrawerBadge");
    const addLibraryBtn = document.getElementById("exploreDrawerAddLibrary");
    const addListsBtn = document.getElementById("exploreDrawerAddLists");

    if (titleEl) titleEl.textContent = vm.title;
    if (metaEl) metaEl.textContent = vm.meta;

    if (coverEl) {
      const backdrop = _safeText(item?.backdrop).trim();
      const cover = _safeText(item?.cover).trim();
      const heroImage = backdrop || cover;

      if (heroImage) {
        coverEl.style.backgroundImage = `url("${heroImage}")`;
        coverEl.style.backgroundSize = "cover";
        coverEl.style.backgroundPosition = "center";
        coverEl.style.backgroundRepeat = "no-repeat";
        coverEl.classList.remove("is-fallback");
      } else {
        coverEl.style.backgroundImage = "none";
        coverEl.style.backgroundSize = "";
        coverEl.style.backgroundPosition = "";
        coverEl.style.backgroundRepeat = "";
        coverEl.classList.add("is-fallback");
      }
    }

    if (badgeEl) {
      badgeEl.textContent = vm.badge;
      badgeEl.hidden = !vm.hasBadge;
    }

    if (addLibraryBtn) {
      addLibraryBtn.dataset.eid = drawerEid;
      addLibraryBtn.disabled = !!item.__saving;
    }

    if (addListsBtn) {
      addListsBtn.dataset.eid = drawerEid;
      addListsBtn.disabled = !!item.__saving;
    }

    _clearDrawerInlineNote();
    _renderDrawerAddCtaLabel();

    return item;
  }

  async function _populateExploreListPicker(preselectedListId = null) {
    const select = document.getElementById("exploreDrawerListSelect");
    const confirmBtn = document.getElementById("exploreDrawerConfirmList");
    if (!select) return;
    const normalizedPreselectedListId = _normalizeId(preselectedListId);

    let lists = [];
    try {
      lists = await ApiClient.getLists();
    } catch (e) {
      console.error("Explore: no se pudieron cargar las listas", e);
      lists = [];
    }

    const safeLists = Array.isArray(lists) ? lists : [];

    select.innerHTML = "";

    const placeholderOption = document.createElement("option");
    placeholderOption.value = "";
    placeholderOption.textContent =
      window.I18n.t("explore_drawer_list_placeholder");
    select.appendChild(placeholderOption);

    for (const list of safeLists) {
      const listId = _normalizeId(list?.id);
      if (!listId) continue;

      const option = document.createElement("option");
      option.value = listId;
      option.textContent =
        _safeText(list.name) ||
        window.I18n.t("explore_drawer_list_untitled");
      select.appendChild(option);
    }

    const hasLists = safeLists.length > 0;

    if (!hasLists) {
      select.innerHTML = "";

      const emptyOption = document.createElement("option");
      emptyOption.value = "";
      emptyOption.textContent =
        window.I18n.t("explore_drawer_list_empty");
      select.appendChild(emptyOption);
    }

    if (normalizedPreselectedListId && hasLists) {
      select.value = normalizedPreselectedListId;
    }

    select.disabled = !hasLists;

    if (confirmBtn) {
      confirmBtn.disabled = !hasLists;
    }
  }

  async function _openExploreListPicker(preselectedListId = null) {
    const picker = document.getElementById("exploreDrawerListPicker");
    const select = document.getElementById("exploreDrawerListSelect");
    const confirmBtn = document.getElementById("exploreDrawerConfirmList");

    if (!picker) return;

    __drawerListsPickerOpen = true;
    picker.hidden = false;

    if (select) {
      select.innerHTML = "";
      const loadingOption = document.createElement("option");
      loadingOption.value = "";
      loadingOption.textContent =
        window.I18n.t("explore_drawer_list_loading");
      select.appendChild(loadingOption);
      select.disabled = true;
    }

    if (confirmBtn) {
      confirmBtn.disabled = true;
    }

    try {
      await _populateExploreListPicker(preselectedListId);
    } catch (e) {
      console.error("Explore: no se pudo preparar el picker de listas", e);
    }

    _syncExploreListConfirmState();

    requestAnimationFrame(() => select?.focus?.());
  }

  function _closeExploreListPicker() {
    const picker = document.getElementById("exploreDrawerListPicker");
    const select = document.getElementById("exploreDrawerListSelect");
    const confirmBtn = document.getElementById("exploreDrawerConfirmList");

    __drawerListsPickerOpen = false;

    if (picker) picker.hidden = true;
    if (select) select.value = "";
    if (confirmBtn) confirmBtn.disabled = true;
  }

  function _syncExploreListConfirmState() {
    const select = document.getElementById("exploreDrawerListSelect");
    const confirmBtn = document.getElementById("exploreDrawerConfirmList");
    if (!confirmBtn) return;
    confirmBtn.disabled = !_normalizeId(select?.value);
  }

  async function _saveActiveExploreItemToList(listId) {
    const normalizedListId = _normalizeId(listId);
    const item = _getActiveExploreItem();
    if (!item || !normalizedListId) return;

    const confirmBtn = document.getElementById("exploreDrawerConfirmList");
    _setDrawerButtonLoading(confirmBtn, true);

    try {
      const ensured = await _ensureInLibrary(item);
      if (!ensured?.ok) return;

      const freshItem = _getExploreItemByEid(item.eid);

      const libraryItemId = _normalizeId(
        ensured.createdId ||
        freshItem?.__libraryItemId
      );

      if (!libraryItemId) {
        _showDrawerInlineNotePersistent(
          window.I18n.t("explore_drawer_list_resolve_error")
        );
        return;
      }

      const result = await ApiClient.addLibraryItemToList(
        normalizedListId,
        libraryItemId
      );

      let drawerNoteMessage = "";
      let drawerNotePersistent = false;

      if (result?.ok && !result?.already) {
        drawerNoteMessage = window.I18n.t("explore_drawer_list_added");
        drawerNotePersistent = false;
      } else if (result?.already) {
        drawerNoteMessage = window.I18n.t("explore_drawer_list_already_added");
        drawerNotePersistent = true;
      } else {
        _showDrawerInlineNotePersistent(
          window.I18n.t("explore_drawer_list_add_error")
        );
        return;
      }

      await _syncInLibraryFlags();

      const fresh = _getExploreItemByEid(item.eid);

      if (fresh) {
        _syncExploreDrawerFromItem(fresh);
        _renderExploreDrawerDetails(fresh);
      }

      _render();

      _closeExploreListPicker();

      if (drawerNoteMessage) {
        if (drawerNotePersistent) {
          _showDrawerInlineNotePersistent(drawerNoteMessage);
        } else {
          _showDrawerInlineNote(drawerNoteMessage);
        }
      }
    } catch (err) {
      console.error("[Explore] add item to list failed", err);
      _showDrawerInlineNotePersistent(
        window.I18n.t("explore_drawer_list_add_error")
      );
    } finally {
      _setDrawerButtonLoading(confirmBtn, false);
    }
  }

  async function _syncInLibraryFlags() {
    let lib = [];
    try {
      lib = await ApiClient.getLibrary();
      if (!Array.isArray(lib)) lib = [];
    } catch (e) {
      console.error(e);
      lib = [];
    }

    const libraryById = new Map(
      lib
        .filter((item) => _normalizeId(item?.id))
        .map((item) => [_normalizeId(item.id), item])
    );

    const libraryByCanonicalKey = new Map(
      lib
        .map(item => [
          window.ItemIdentity?.getCanonicalContentKey?.(item) || "",
          item
        ])
        .filter(([key]) => Boolean(key))
    );

    const libraryByKey = new Map(
      lib.map(item => [
        `${_norm(item.title)}::${_safeText(item.type)}`,
        item
      ])
    );

    // Mantener el vínculo por ID si ya existe.
    // Solo usar title+type como fallback para items antiguos o aún no enlazados.
    const syncLibraryRefs = (items) =>
      items.map((x) => {
        const currentLibraryId = _normalizeId(x.__libraryItemId) || null;
        const byId = currentLibraryId ? libraryById.get(currentLibraryId) : null;
        const canonicalKey = window.ItemIdentity?.getCanonicalContentKey?.(x) || "";
        const byCanonical = byId || !canonicalKey
          ? null
          : libraryByCanonicalKey.get(canonicalKey);
        const byKey = byId || byCanonical
          ? null
          : libraryByKey.get(`${_norm(x.title)}::${_safeText(x.type)}`);

        const libraryItem = byId || byCanonical || byKey || null;

        return {
          ...x,
          __inLibrary: !!libraryItem,
          __libraryItemId: _normalizeId(libraryItem?.id) || null
        };
      });

    feed = syncLibraryRefs(feed);
    featuredFeed = syncLibraryRefs(featuredFeed);

    let lists = [];
    try {
      lists = await ApiClient.getLists();
      if (!Array.isArray(lists)) lists = [];
    } catch (e) {
      console.error(e);
      lists = [];
    }

    const listsCountByLibraryId = new Map();

    for (const list of lists) {
      const items = Array.isArray(list?.items) ? list.items : [];
      const seenInList = new Set();

      for (const entry of items) {
        const rawId =
          typeof entry === "string"
            ? entry
            : entry?.id;

        if (!rawId) continue;

        const safeId = _normalizeId(rawId);
        if (!safeId) continue;
        if (seenInList.has(safeId)) continue;
        seenInList.add(safeId);

        listsCountByLibraryId.set(
          safeId,
          Number(listsCountByLibraryId.get(safeId) || 0) + 1
        );
      }
    }

    for (const item of [...feed, ...featuredFeed]) {
      const safeLibraryId = _normalizeId(item.__libraryItemId) || null;
      item.__listsCount = safeLibraryId
        ? Number(listsCountByLibraryId.get(safeLibraryId) || 0)
        : 0;
    }
  }

  async function load() {
    _bindExploreToolbar();

    const globalSearch = document.getElementById("globalSearch");

    if (globalSearch) {
      searchTerm = String(globalSearch.value || "").trim();
    }

    if (searchTerm) {
      expandedSection = null;
    }

    _renderExploreSkeleton();

    try {
      const [rawFeed, rawFeaturedFeed] = await Promise.all([
        ApiClient.getExploreFeed(searchTerm),
        searchTerm ? Promise.resolve([]) : ApiClient.getWeeklyFeaturedExploreFeed()
      ]);

      const safeFeed = Array.isArray(rawFeed) ? rawFeed : [];
      const safeFeaturedFeed = Array.isArray(rawFeaturedFeed) ? rawFeaturedFeed : [];

      feed = safeFeed
        .map((item, index) => _normalizeExploreItem(item, index));

      const normalizedFeatured = safeFeaturedFeed
        .map((item, index) => _normalizeExploreItem(item, index));

      featuredFeed = normalizedFeatured;

    } catch (e) {
      console.error("ExploreModule.load error", e);

      feed = [];
      featuredFeed = [];
    }

    try {
      const arr = await ApiClient.getExploreDismissed();
      dismissed = new Set((arr || []).map((entry) => _normalizeId(entry)).filter(Boolean));
    } catch (e) {
      console.error(e);
      dismissed = new Set();
    }

    await _syncInLibraryFlags();

    _syncExploreToolbarUI();
    _applyFilters();
  }

  async function _ensureInLibrary(item) {
    const eid = _normalizeId(item?.eid);
    if (!eid) return { ok: false, createdId: null };

    const current = _getExploreItemByEid(eid);

    if (current?.__inLibrary) {
      return {
        ok: true,
        createdId: _normalizeId(current.__libraryItemId) || null
      };
    }

    const pending = __pendingLibraryEnsures.get(eid);
    if (pending) {
      return pending;
    }

    const run = (async () => {

    _patchExploreItemsByEid(eid, () => ({ __saving: true }));

      _applyFilters();

      try {
        let detail = null;

        if (
          String(item?.type || "").trim() === "serie" &&
          item?.source &&
          item?.externalId
        ) {
          try {
            detail = await ApiClient.getExploreItemDetail({
              source: String(item.source),
              type: String(item.type),
              externalId: String(item.externalId)
            });
          } catch (e) {
            console.error("Explore: no se pudo cargar el detalle de la serie", e);
          }
        }

        const detailMeta =
        detail && typeof detail.meta === "object" && !Array.isArray(detail.meta)
        ? detail.meta
        : {};

        const totalSeasons =
        String(item?.type || "").trim() === "serie"
        ? Math.max(
            0,
            Number(detailMeta.totalSeasons || detail?.seasons || item?.seasons || 0) || 0
          )
        : 0;

        const totalEpisodes =
        String(item?.type || "").trim() === "serie"
        ? Math.max(
            0,
            Number(detailMeta.totalEpisodes || detail?.episodes || item?.episodes || 0) || 0
          )
        : 0;

        const seasonBreakdown =
        String(item?.type || "").trim() === "serie" &&
        Array.isArray(detailMeta.seasonBreakdown)
        ? detailMeta.seasonBreakdown
        : [];

        const normalizedType = String(item?.type || "").trim();
        const releaseYear = Number(
          item?.meta?.year || String(item?.releaseDate || "").slice(0, 4)
        );
        const baseMeta = Number.isFinite(releaseYear) && releaseYear > 0
          ? { year: releaseYear }
          : {};

        let meta = { ...baseMeta };

        if (normalizedType === "serie") {
          meta = {
            ...baseMeta,
            totalSeasons,
            totalEpisodes,
            seasonBreakdown,
            season: 1,
            episode: 1
          };
        }

        if (normalizedType === "book") {
          meta = {
            ...baseMeta,
            author: String(item?.meta?.author || "").trim(),
            totalPages: item?.meta?.totalPages || null,
            pagesRead: 0
          };
        }

        if (normalizedType === "game") {
          const platform = String(
            item?.meta?.platform || item?.meta?.platforms || ""
          ).trim();

          meta = {
            ...baseMeta,
            platform: platform || null
          };
        }

        const payload = {
          title: item.title,
          type: normalizedType,
          source: String(item?.source || "").trim(),
          externalId: String(item?.externalId || "").trim(),
          progress: 0,
          cover: String(item?.cover || "").trim(),
          meta
        };

        const created = await ApiClient.createLibraryItem(payload);
        const createdId = _normalizeId(created?.id);

        if (created?.ok === false || !createdId) {
          throw new Error(created?.reason || created?.error || "create_failed");
        }

        _patchExploreItemsByEid(eid, () => ({
          __saving: false,
          __inLibrary: true,
          __libraryItemId: createdId
        }));

        await _syncInLibraryFlags();

        window.toast?.({
          title: window.I18n.t("explore_library_added_title"),
          message: window.I18n.t("explore_library_added_desc"),
          type: "success",
          duration: 2400
        });

        if (window.LibraryUI?.load) {
          try {
            await window.LibraryUI.load();
          } catch (e) {
            console.error(
              "No se pudo refrescar LibraryUI tras añadir desde Explore",
              e
            );
          }
        }

        _applyFilters();

        return {
          ok: true,
          createdId
        };
      } catch (err) {
        if (err?.status === 409 || err?.error === "duplicate_item") {
          try {
            await _syncInLibraryFlags();
          } catch (syncErr) {
            console.error(syncErr);
          }

          const fresh = _getExploreItemByEid(eid);
          const resolvedLibraryItemId = _normalizeId(fresh?.__libraryItemId);

          if (!resolvedLibraryItemId) {
            console.error(err);

            _patchExploreItemsByEid(eid, () => ({ __saving: false }));

            _applyFilters();

            window.toast?.({
              title: window.I18n.t("explore_library_add_error"),
              message: window.I18n.t("explore_try_again"),
              type: "error",
              duration: 3000
            });

            return { ok: false, createdId: null };
          }

          _patchExploreItemsByEid(eid, () => ({
            __saving: false,
            __inLibrary: true,
            __libraryItemId: resolvedLibraryItemId
          }));

          _applyFilters();

          return {
            ok: true,
            createdId: resolvedLibraryItemId
          };
        }

        console.error(err);

        _patchExploreItemsByEid(eid, () => ({ __saving: false }));

        _applyFilters();

        window.toast?.({
          title: window.I18n.t("explore_library_add_error"),
          message: window.I18n.t("explore_try_again"),
          type: "error",
          duration: 3000
        });

        return { ok: false, createdId: null };
      } finally {
        __pendingLibraryEnsures.delete(eid);
      }
    })();

    __pendingLibraryEnsures.set(eid, run);
    return run;
  }

  async function _saveUIState() {
    try {
      await ApiClient.setExploreUIState({
        typeFilter,
        sortMode,
        searchTerm
      });
    } catch (e) {
      console.error("Explore: no se pudo guardar UI state", e);
    }
  }

  async function _loadUIState() {
    try {
      const data = await ApiClient.getExploreUIState();
      if (data && typeof data === "object") {
        if (typeof data.typeFilter === "string") typeFilter = data.typeFilter;
        if (typeof data.sortMode === "string") sortMode = data.sortMode;
        if (typeof data.searchTerm === "string") searchTerm = data.searchTerm;
      }
    } catch (e) {
      console.error("Explore: no se pudo cargar UI state", e);
    }
  }

  function _getFocusableIn(el) {
    if (!el) return [];
    const selectors = [
      'a[href]',
      'button:not([disabled])',
      'input:not([disabled]):not([type="hidden"])',
      'select:not([disabled])',
      'textarea:not([disabled])',
      '[tabindex]:not([tabindex="-1"])'
    ];
    return Array.from(el.querySelectorAll(selectors.join(",")))
      .filter((n) => n.offsetParent !== null);
  }

  function _setDrawerButtonLoading(btn, isLoading) {
    if (!btn) return;

    btn.classList.toggle("is-loading", isLoading);
    btn.disabled = !!isLoading;

    let spinner = btn.querySelector(".drawer-btn-spinner");

    if (isLoading) {
      if (!spinner) {
        spinner = document.createElement("span");
        spinner.className = "drawer-btn-spinner";
        spinner.innerHTML = `
          <svg viewBox="0 0 24 24" fill="none"
               stroke="currentColor" stroke-width="2"
               stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="10" opacity="0.25"></circle>
            <path d="M22 12a10 10 0 0 1-10 10"></path>
          </svg>
        `;
        btn.prepend(spinner);
      }
    } else {
      spinner?.remove();
    }
  }

  function _trapFocusKeydown(e) {
    if (!__drawerOpen) return;
    if (e.key !== "Tab") return;

    const drawer = document.getElementById("exploreDrawer");
    if (!drawer || !drawer.classList.contains("is-open")) return;

    const focusables = _getFocusableIn(drawer);
    if (focusables.length === 0) return;

    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    const active = document.activeElement;

    if (e.shiftKey) {
      // Shift+Tab: si estamos en el primero, saltar al último
      if (active === first || !drawer.contains(active)) {
        e.preventDefault();
        last.focus();
      }
    } else {
      // Tab: si estamos en el último, volver al primero
      if (active === last) {
        e.preventDefault();
        first.focus();
      }
    }
  }

  let __drawerInlineNoteTimer = null;

  function _showDrawerInlineNote(message) {
    const note = document.getElementById("exploreDrawerInlineNote");
    if (!note) return;

    // Reset (por si hay otro mensaje activo)
    if (__drawerInlineNoteTimer) {
      clearTimeout(__drawerInlineNoteTimer);
      __drawerInlineNoteTimer = null;
    }

    note.textContent = message;
    note.hidden = false;

    // Forzar reflow para que la transición siempre arranque
    note.classList.remove("is-visible");
    void note.offsetWidth;
    note.classList.add("is-visible");

    __drawerInlineNoteTimer = setTimeout(() => {
      note.classList.remove("is-visible");

      // Espera a la transición para ocultar
      setTimeout(() => {
        note.hidden = true;
        note.textContent = "";
      }, 180);
    }, 2600);
  }

  function _showDrawerInlineNotePersistent(message) {
    const note = document.getElementById("exploreDrawerInlineNote");
    if (!note) return;

    // Cancelar cualquier auto-hide pendiente
    if (__drawerInlineNoteTimer) {
      clearTimeout(__drawerInlineNoteTimer);
      __drawerInlineNoteTimer = null;
    }

    note.textContent = message;
    note.hidden = false;

    note.classList.remove("is-visible");
    void note.offsetWidth;
    note.classList.add("is-visible");
  }

  function _clearDrawerInlineNote() {
    const note = document.getElementById("exploreDrawerInlineNote");
    if (!note) return;

    // Cancelar cualquier auto-hide pendiente
    if (__drawerInlineNoteTimer) {
      clearTimeout(__drawerInlineNoteTimer);
      __drawerInlineNoteTimer = null;
    }

    note.classList.remove("is-visible");
    note.hidden = true;
    note.textContent = "";
  }

  async function _hydrateExploreItemDetail(item) {
    if (!item?.source || !item?.type || !item?.externalId) return item;
    if (item.source !== "tmdb") return item;

    try {
      const detail = await ApiClient.getExploreItemDetail({
        source: item.source,
        type: item.type,
        externalId: item.externalId
      });

      if (!detail || typeof detail !== "object") return item;

      const merged = {
        ...item,
        ...detail,
        eid: item.eid || detail.eid || item.eid
      };

      feed = feed.map((x) => (x.eid === item.eid ? merged : x));

      if (activeEid === item.eid) {
        _syncExploreDrawerFromItem(merged);
        _renderExploreDrawerDetails(merged);
      }

      return merged;
    } catch (e) {
      console.error("Explore detail hydrate failed", e);
      return item;
    }
  }

  function bind() {

    const globalSearch = document.getElementById("globalSearch");
    const globalSearchClear = document.getElementById("globalSearchClear");
    const globalSearchBox = document.getElementById("globalSearchBox");

    if (globalSearch && !globalSearch.__exploreBound) {
      globalSearch.__exploreBound = true;

      globalSearch.disabled = false;
      globalSearchBox?.classList.remove("is-disabled");
      globalSearchBox?.setAttribute("aria-disabled", "false");

      globalSearch.addEventListener("input", () => {
        searchTerm = String(globalSearch.value || "").trim();
        _scheduleApplyFilters();
      });

      globalSearch.addEventListener("search", () => {
        searchTerm = String(globalSearch.value || "").trim();
        _scheduleApplyFilters();
      });
    }

    if (globalSearchClear && !globalSearchClear.__exploreBound) {
      globalSearchClear.__exploreBound = true;

      globalSearchClear.removeAttribute("tabindex");

      globalSearchClear.addEventListener("click", () => {
        if (globalSearch) {
          globalSearch.value = "";
          globalSearch.focus();
        }

        searchTerm = "";
        _scheduleApplyFilters();
      });
    }

    // Evita doble binding
    if (bind._bound) return;
    bind._bound = true;

    // CLICK "+"

    document.addEventListener("click", async (e) => {
      const detailTrigger = e.target.closest('[data-action="open-item-detail"][data-eid]');
      if (detailTrigger) {
        e.preventDefault();
        e.stopPropagation();

        const item = _getExploreItemByEid(detailTrigger.dataset.eid);
        if (!item) return;

        _syncExploreDrawerFromItem(item);
        _renderExploreDrawerDetails(item);
        _openExploreDrawer(detailTrigger);
        return;
      }

      const addListsBtn = e.target.closest("#exploreDrawerAddLists");
      if (addListsBtn) {
        e.preventDefault();
        e.stopPropagation();
        await _handleExploreDrawerAddToListClick();
        return;
      }
    });

    document.addEventListener("keydown", async (e) => {
      const card = e.target.closest('[data-action="open-item-detail"][data-eid]');
      if (!card) return;

      if (e.key !== "Enter" && e.key !== " ") return;

      e.preventDefault();

      const item = _getExploreItemByEid(card.dataset.eid);
      if (!item) return;

      _syncExploreDrawerFromItem(item);
      _renderExploreDrawerDetails(item);
      _openExploreDrawer(card);
    });

    // BOTÓN CERRAR DRAWER

    const closeDrawerBtn = document.getElementById("exploreDrawerClose");
    if (closeDrawerBtn && !closeDrawerBtn.dataset.bound) {
      closeDrawerBtn.dataset.bound = "1";

      closeDrawerBtn.addEventListener("click", (e) => {
        e.preventDefault();
        _closeExploreDrawer();
      });
    }

    // BACKDROP

    const backdrop = document.getElementById("exploreDrawerBackdrop");
    if (backdrop && !backdrop.dataset.bound) {
      backdrop.dataset.bound = "1";

      backdrop.addEventListener("click", () => {
        _closeExploreDrawer();
      });
    }

    // ESC

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        _closeExploreDrawer();
      }
    });

    // EXPANDIR / CONTRAER DRAWER

    const expandDrawerBtn = document.getElementById("exploreDrawerExpand");

    if (expandDrawerBtn && !expandDrawerBtn.dataset.bound) {
      expandDrawerBtn.dataset.bound = "1";

      expandDrawerBtn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();

        _setExploreDrawerExpanded(!__drawerExpanded);
      });
    }

    // AÑADIR A BIBLIOTECA

    const addLibraryBtn = document.getElementById("exploreDrawerAddLibrary");

    if (addLibraryBtn && !addLibraryBtn.dataset.bound) {
      addLibraryBtn.dataset.bound = "1";

      addLibraryBtn.addEventListener("click", async (e) => {
        e.preventDefault();
        e.stopPropagation();

        const item = _getActiveExploreItem();
        if (!item) return;

        _setDrawerButtonLoading(addLibraryBtn, true);

        try {
          const ensured = await _ensureInLibrary(item);
          if (!ensured?.ok) return;

          await _syncInLibraryFlags();

          const fresh = _getExploreItemByEid(item.eid);
          if (fresh) {
            _syncExploreDrawerFromItem(fresh);
            _renderExploreDrawerDetails(fresh);
          }

          _render();

          _showDrawerInlineNote(window.I18n.t("explore_library_added_title"));
        } finally {
          _setDrawerButtonLoading(addLibraryBtn, false);
          _renderDrawerAddCtaLabel();
        }
      });
    }

    // Añadir a lista

    const confirmListBtn = document.getElementById("exploreDrawerConfirmList");

    if (confirmListBtn && !confirmListBtn.dataset.bound) {
      confirmListBtn.dataset.bound = "1";

      confirmListBtn.addEventListener("click", async (e) => {
        e.preventDefault();
        e.stopPropagation();

        const select = document.getElementById("exploreDrawerListSelect");
        const listId = select?.value;

        if (!listId) {
          _showDrawerInlineNotePersistent(window.I18n.t("explore_list_required"));
          return;
        }

        await _saveActiveExploreItemToList(listId);
      });
    }

    const cancelListBtn = document.getElementById("exploreDrawerCancelList");

    const listSelect = document.getElementById("exploreDrawerListSelect");

    if (listSelect && !listSelect.dataset.bound) {
      listSelect.dataset.bound = "1";

      listSelect.addEventListener("change", () => {
        _syncExploreListConfirmState();
      });
    }

    if (cancelListBtn && !cancelListBtn.dataset.bound) {
      cancelListBtn.dataset.bound = "1";

      cancelListBtn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();

        _closeExploreListPicker();
      });
    }

    // FILTROS (NO TOCAR)

    document.addEventListener("click", (e) => {
      const pill = e.target.closest("[data-filter]");
      if (!pill) return;
    });

  }

  function init() {
    // Cargamos UI state persistente (async) y luego bindeamos/renderizamos
    (async () => {
      await _loadUIState();
      bind();

      // Cargar Explore cuando el router active la vista
      if (!init._viewChangeBound) {
        init._viewChangeBound = true;

        document.addEventListener("quacker:view-change", (e) => {
          if (e.detail?.viewId !== "explore") return;

          const global = $("#globalSearch");
          searchTerm = String(global?.value || "").trim();

          const sort = $("#exploreSort");
          if (sort) sort.value = sortMode;

          void load();
        });
      }

      // aplicar sort al select
      const sort = document.getElementById("exploreSort");
      if (sort) sort.value = sortMode;

      // aplicar filtro pills
      const pillsWrap = document.querySelector("[data-explore-type]");
      if (pillsWrap) {
        pillsWrap.querySelectorAll(".pill-btn").forEach((b) => {
          b.classList.toggle("active", (b.dataset.value || "all") === typeFilter);
        });
      }

      // aplicar búsqueda al input global si estamos en Explore
      const isExplore = document.querySelector("#view-explore")?.classList.contains("is-active");
      const global = document.getElementById("globalSearch");
      if (isExplore && global) {
        searchTerm = String(global.value || "").trim();
      }

      if (isExplore) load();
    })();
  }

  document.addEventListener("quacker:lang-change", () => {
    _render();
  });

  return { init, load };
})();

window.ExploreModule = ExploreModule;

function openAddToLibraryModal(eid) {
  const modal = document.getElementById("addFromExploreModal");
  if (!modal) return;

  modal.dataset.eid = (eid ?? "").toString().trim();
  modal.classList.add("open");
}

function closeAddFromExploreModal() {
  const modal = document.getElementById("addFromExploreModal");
  if (!modal) return;

  modal.classList.remove("open");
  delete modal.dataset.eid;
}

window.ExploreModule = ExploreModule;
