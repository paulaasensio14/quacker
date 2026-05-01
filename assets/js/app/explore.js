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
  let __detailViewReqSeq = 0;
  let __detailViewLastFocusEl = null;
  let __detailViewItem = null;
  let __detailViewLoading = false;
  let __detailViewError = false;
  let __detailListsPickerOpen = false;
  let __detailOriginView = "explore";
  let __detailCastExpanded = false;
  const __detailExpandedSeasonKeys = new Set();
  const __detailSeasonCache = new Map();
  const __detailRelatedDrag = {
    pointerId: null,
    startX: 0,
    startScrollLeft: 0,
    moved: false,
    suppressClickUntil: 0
  };

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

  function _getCanonicalIdentityKey(item) {
    const source = _safeText(item?.source).trim().toLowerCase();
    const externalId = _safeText(item?.externalId).trim();

    if (!source || !externalId) return "";

    return `${source}::${externalId}`;
  }

  function _escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function _getActiveViewId() {
    return (
      document.querySelector(".view.is-active")?.getAttribute("data-view-id") || ""
    );
  }

  function _scrollAppMainToTop() {
    const mainEl = document.querySelector("main.app-main");

    if (mainEl && typeof mainEl.scrollTo === "function") {
      try {
        mainEl.scrollTo({ top: 0, behavior: "auto" });
        return;
      } catch (_) {
        mainEl.scrollTop = 0;
        return;
      }
    }

    if (typeof window.scrollTo === "function") {
      window.scrollTo({ top: 0, behavior: "auto" });
    }
  }

  function _formatExploreCountLabel(count, singularKey, pluralKey) {
    const safeCount = Math.max(0, Number(count || 0));
    return window.I18n
      .t(safeCount === 1 ? singularKey : pluralKey)
      .replace("{count}", String(safeCount));
  }

  function _getExploreLocale() {
    const lang = _safeText(window.I18n?.getLang?.()).trim().toLowerCase();
    return lang === "en" ? "en-US" : "es-ES";
  }

  function _formatExploreDate(dateStr, options = {}) {
    const safeDate = _safeText(dateStr).trim();
    if (!safeDate) return "";

    const date = new Date(safeDate);
    if (Number.isNaN(date.getTime())) return safeDate;

    try {
      return new Intl.DateTimeFormat(_getExploreLocale(), {
        day: "numeric",
        month: "short",
        year: "numeric",
        ...options
      }).format(date);
    } catch (_) {
      return safeDate;
    }
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

  function _normalizeDetailRelatedItem(rawItem, index = 0) {
    const raw = rawItem && typeof rawItem === "object" ? rawItem : {};
    const eid = _normalizeId(raw.eid) || `detail_related_${index + 1}`;
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

    return {
      ...raw,
      eid,
      title,
      type,
      cover: _safeText(raw.cover).trim(),
      backdrop: _safeText(raw.backdrop).trim(),
      releaseDate: _safeText(raw.releaseDate).trim(),
      summary: _safeText(raw.summary).trim()
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
        limit: 14,
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

    backdrop.hidden = false;
    drawer.classList.add("is-open");
    drawer.setAttribute("aria-hidden", "false");

    const details = document.getElementById("exploreDrawerDetails");
    if (details) {
      details.hidden = false;
    }

    _syncExploreDrawerViewport();
    document.body.classList.add("modal-open");

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
      _refreshItemLibraryState(activeItem)
        .then((freshItem) => {
          if (!freshItem) return;
          // Explore SÍ actualiza su catálogo interno si quiere
          _replaceExploreItemByEid(freshItem);
          _syncExploreDrawerFromItem(freshItem);
          return _hydrateExploreDrawerDetail(freshItem);
        })
        .catch((error) => {
          console.error("[Explore] failed to refresh drawer library state", error);
          _hydrateExploreDrawerDetail(activeItem);
        });
    }
  }

  function _closeExploreDrawer({ restoreFocus = true, clearActiveEid = true } = {}) {
    const drawer = document.getElementById("exploreDrawer");
    const backdrop = document.getElementById("exploreDrawerBackdrop");
    if (!drawer || !backdrop) return;

    __drawerOpen = false;
    __drawerDetailReqSeq += 1;
    if (clearActiveEid) activeEid = null;
    __drawerDetailLoading = false;
    __drawerDetailError = false;
    __drawerListsPickerOpen = false;
    _syncExploreDrawerDetailFeedback();
    _syncExploreDrawerListPicker();
    _renderDrawerAddCtaLabel();

    drawer.classList.remove("is-open");
    drawer.setAttribute("aria-hidden", "true");
    backdrop.hidden = true;
    document.body.classList.remove("modal-open");

    _clearDrawerInlineNote();

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

    const { picker, select } = _getExploreListPickerRefs("drawer");
    if (picker) picker.hidden = true;
    if (select) select.value = "";

    const back = __drawerLastFocusEl;
    __drawerLastFocusEl = null;
    if (restoreFocus && back && typeof back.focus === "function") {
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

  function _isDetailViewActive() {
    return _getActiveViewId() === "detail";
  }

  function _getActiveDetailItem() {
    const detailState = window.DetailModule?.getDetailState?.();
    return detailState?.item || __detailViewItem || null;
  }

  function _setActiveDetailState({
    item = __detailViewItem,
    loading = undefined,
    error = undefined
  } = {}) {
    __detailViewItem = item || null;

    if (typeof loading !== "undefined") {
      __detailViewLoading = !!loading;
    }

    if (typeof error !== "undefined") {
      __detailViewError = !!error;
    }

    window.DetailModule?.setDetailState?.({
      item: __detailViewItem,
      loading: typeof loading !== "undefined" ? !!loading : undefined,
      error: typeof error !== "undefined" ? !!error : undefined
    });
  }

  function _nextDetailRequestSeq() {
    const nextSeq = window.DetailModule?.nextRequestSeq?.();

    if (Number.isFinite(Number(nextSeq))) {
      __detailViewReqSeq = Number(nextSeq);
      return __detailViewReqSeq;
    }

    __detailViewReqSeq += 1;
    return __detailViewReqSeq;
  }

  function _getCurrentDetailRequestSeq() {
    const detailSeq = window.DetailModule?.getDetailState?.()?.reqSeq;

    if (Number.isFinite(Number(detailSeq))) {
      return Number(detailSeq);
    }

    return __detailViewReqSeq;
  }

  function _isCurrentDetailRequest(reqSeq) {
    return Number(reqSeq) === _getCurrentDetailRequestSeq();
  }

  function _getDetailSeasonCacheKey(item, seasonNumber) {
    const source = _safeText(item?.source).trim();
    const type = _safeText(item?.type).trim();
    const externalId = _safeText(item?.externalId).trim();
    const safeSeasonNumber = Math.max(1, Number(seasonNumber || 0) || 0);

    if (!source || !type || !externalId || !safeSeasonNumber) return "";

    return `${source}:${type}:${externalId}:season:${safeSeasonNumber}`;
  }

  function _canLoadDetailSeasonEpisodes(item) {
    return (
      _safeText(item?.source).trim() === "tmdb" &&
      _safeText(item?.type).trim() === "serie" &&
      !!_safeText(item?.externalId).trim()
    );
  }

  function _renderContentDetailSeasonBody(item, seasonNumber) {
    const cacheKey = _getDetailSeasonCacheKey(item, seasonNumber);
    const seasonState = cacheKey ? __detailSeasonCache.get(cacheKey) : null;

    if (!seasonState || seasonState.status === "loading") {
      return `
        <div class="content-detail-season-body">
          <p class="content-detail-season-status">
            ${_escapeHtml(window.I18n.t("explore_detail_season_loading"))}
          </p>
        </div>
      `;
    }

    if (seasonState.status === "error") {
      return `
        <div class="content-detail-season-body">
          <p class="content-detail-season-status content-detail-season-status--error">
            ${_escapeHtml(window.I18n.t("explore_detail_season_error"))}
          </p>
        </div>
      `;
    }

    const episodes = Array.isArray(seasonState.episodes) ? seasonState.episodes : [];

    if (episodes.length === 0) {
      return `
        <div class="content-detail-season-body">
          <p class="content-detail-season-status">
            ${_escapeHtml(window.I18n.t("explore_detail_no_episodes"))}
          </p>
        </div>
      `;
    }

    return `
      <div class="content-detail-season-body">
        <ul class="content-detail-episode-list">
          ${episodes
            .map((episode) => {
              const episodeNumber = Math.max(1, Number(episode?.episodeNumber || 0) || 0);
              const episodeTitle =
                _safeText(episode?.name).trim() ||
                window.I18n
                  .t("explore_detail_episode_name_fallback")
                  .replace("{number}", String(episodeNumber));
              const episodeStill = _safeText(episode?.still).trim();
              const episodeSummary = _safeText(episode?.summary).trim();
              const episodeMeta = [
                _formatExploreDate(episode?.airDate),
                Number(episode?.runtime || 0) > 0
                  ? `${Number(episode.runtime)} ${window.I18n.t("time_minutes")}`
                  : ""
              ].filter(Boolean).join(" · ");

              return `
                <li class="content-detail-episode-item">
                  <div
                    class="content-detail-episode-still${episodeStill ? "" : " is-fallback"}"
                    ${episodeStill ? `style="background-image: url('${_escapeHtml(episodeStill)}');"` : ""}
                    aria-hidden="true"
                  >
                    ${
                      episodeStill
                        ? ""
                        : `<span class="content-detail-episode-still-fallback">E${episodeNumber}</span>`
                    }
                  </div>

                  <div class="content-detail-episode-copy">
                    <strong class="content-detail-episode-title">
                      E${episodeNumber}. ${_escapeHtml(episodeTitle)}
                    </strong>
                    ${
                      episodeMeta
                        ? `<span class="content-detail-episode-meta">${_escapeHtml(episodeMeta)}</span>`
                        : ""
                    }
                    ${
                      episodeSummary
                        ? `<p class="content-detail-episode-summary">${_escapeHtml(episodeSummary)}</p>`
                        : ""
                    }
                  </div>
                </li>
              `;
            })
            .join("")}
        </ul>
      </div>
    `;
  }

  async function _toggleContentDetailSeason(seasonNumber) {
    const activeItem = _getActiveDetailItem();
    const safeSeasonNumber = Math.max(1, Number(seasonNumber || 0) || 0);
    const cacheKey = _getDetailSeasonCacheKey(activeItem, safeSeasonNumber);

    if (!activeItem || !cacheKey) return;

    if (__detailExpandedSeasonKeys.has(cacheKey)) {
      __detailExpandedSeasonKeys.delete(cacheKey);
      window.DetailModule?.render?.(activeItem);
      return;
    }

    __detailExpandedSeasonKeys.add(cacheKey);
    window.DetailModule?.render?.(activeItem);

    const cachedSeason = __detailSeasonCache.get(cacheKey);
    if (cachedSeason?.status === "loaded" || cachedSeason?.status === "loading") {
      return;
    }

    __detailSeasonCache.set(cacheKey, {
      status: "loading",
      episodes: []
    });
    window.DetailModule?.render?.(activeItem);

    try {
      const season = await ApiClient.getExploreItemSeasonDetail({
        source: activeItem.source,
        type: activeItem.type,
        externalId: activeItem.externalId,
        seasonNumber: safeSeasonNumber
      });

      const episodes = Array.isArray(season?.episodes)
        ? season.episodes.map((episode) => ({
            episodeNumber: Math.max(1, Number(episode?.episodeNumber || 0) || 0),
            name: _safeText(episode?.name).trim(),
            airDate: _safeText(episode?.airDate).trim(),
            runtime: Number(episode?.runtime || 0) || null,
            summary: _safeText(episode?.summary).trim(),
            still: _safeText(episode?.still).trim()
          }))
        : [];

      __detailSeasonCache.set(cacheKey, {
        status: "loaded",
        episodes
      });
    } catch (error) {
      console.error("[Explore] failed to load season episodes", error);
      __detailSeasonCache.set(cacheKey, {
        status: "error",
        episodes: []
      });
    }

    if (!_isDetailViewActive()) return;
    if (!__detailExpandedSeasonKeys.has(cacheKey)) return;

    const freshItem = _getActiveDetailItem();
    if (freshItem) {
      window.DetailModule?.render?.(freshItem);
    }
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

  function _syncContentDetailFeedback() {
    const loadingEl = document.getElementById("contentDetailLoading");
    const errorEl = document.getElementById("contentDetailError");
    const detailState = window.DetailModule?.getDetailState?.() || {};

    const isLoading = Boolean(detailState.loading ?? __detailViewLoading);
    const hasError = Boolean(detailState.error ?? __detailViewError);

    if (loadingEl) {
      loadingEl.hidden = !isLoading;
    }

    if (errorEl) {
      errorEl.hidden = !hasError;
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

  async function _refreshItemLibraryState(item) {
    if (!item?.eid) return item || null;

    const library = await ApiClient.getLibrary();
    _libraryCache = Array.isArray(library) ? library : [];

    const itemIdentityKey = _getCanonicalIdentityKey(item);

    const matchedItem = itemIdentityKey
      ? _libraryCache.find((entry) => _getCanonicalIdentityKey(entry) === itemIdentityKey)
      : null;

    // Retorna el objeto actualizado sin mutar nada externo
    return {
      ...item,
      __inLibrary: !!matchedItem,
      __libraryItemId: _normalizeId(matchedItem?.id)
    };
  }

  async function _fetchHydratedExploreItemDetail(item) {
    if (!item) return null;

    const source = _safeText(item?.source).trim();
    const type = _safeText(item?.type).trim();
    const externalId = _safeText(item?.externalId).trim();
    const eid = _normalizeId(item?.eid);

    if (!eid) return null;
    if (!source || !type || !externalId) return item;
    if (source !== "tmdb") return item;

    const cacheKey = `${source}:${type}:${externalId}`;
    const cachedDetail = __drawerDetailCache.get(cacheKey);

    let detail = cachedDetail;
    if (!detail) {
      detail = await ApiClient.getExploreItemDetail({ source, type, externalId });
      if (!detail || typeof detail !== "object") return null;
      __drawerDetailCache.set(cacheKey, detail);
    }

    const mergedItem = {
      ...item,
      ...detail,
      relatedItems: (Array.isArray(detail?.relatedItems) ? detail.relatedItems : [])
        .map((entry, index) => _normalizeDetailRelatedItem(entry, index))
        .filter((entry) => _normalizeId(entry?.eid) !== eid),
      eid,
      __saving: item.__saving,
      __inLibrary: item.__inLibrary,
      __libraryItemId: item.__libraryItemId,
      __listsCount: item.__listsCount
    };

    // Devolvemos el objeto puro, sin mutar las listas de Explore por la espalda
    return mergedItem;
  }

  async function _hydrateExploreDrawerDetail(item) {
    if (!item) return;

    const eid = _normalizeId(item?.eid);
    if (!eid) return;

    const reqSeq = ++__drawerDetailReqSeq;

    __drawerDetailLoading = true;
    __drawerDetailError = false;
    _syncExploreDrawerDetailFeedback();

    try {
      const persistedItem = await _fetchHydratedExploreItemDetail(item);

      if (reqSeq !== __drawerDetailReqSeq) return;
      if (activeEid !== eid) return;

      __drawerDetailLoading = false;
      __drawerDetailError = !persistedItem;
      _syncExploreDrawerDetailFeedback();

      if (!persistedItem) return;

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

  async function _hydrateContentDetailView(item) {
    return window.DetailModule?.hydrate?.(item);
  }

  function _applyExploreVisualCover(coverEl, item) {
    if (!coverEl) return;

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

  function _buildExploreRatingMarkup(item, { compact = false } = {}) {
    const rawRating = Number(item?.rating || 0);
    const safeRating = Number.isFinite(rawRating) ? Math.max(0, Math.min(10, rawRating)) : 0;
    const duckCount = Math.round(safeRating / 2);
    const maxDucks = 5;

    const ducks = Array.from({ length: maxDucks }, (_, i) => {
      const filled = i < duckCount;

      return `
        <img
          src="assets/img/quacker-rating.png"
          class="explore-rating-duck${compact ? " explore-rating-duck--compact" : ""}${filled ? " is-filled" : ""}"
          alt=""
          aria-hidden="true"
        />
      `;
    }).join("");

    return `
      <span class="explore-rating-ducks${compact ? " explore-rating-ducks--compact" : ""}" aria-label="${safeRating.toFixed(1)} sobre 10">
        ${ducks}
      </span>
      <span class="explore-rating-number${compact ? " explore-rating-number--compact" : ""}">${safeRating.toFixed(1)}</span>
    `;
  }

  function _renderExploreRating(ratingEl, item) {
    if (!ratingEl) return;
    ratingEl.innerHTML = _buildExploreRatingMarkup(item);
  }

  function _renderContentDetailCast(castEl, castEntries = [], toggleBtnEl = null) {
    if (!castEl) return;

    const safeCastEntries = Array.isArray(castEntries) ? castEntries : [];
    const hasMoreCast = safeCastEntries.length > 8;
    const visibleCastEntries = hasMoreCast && !__detailCastExpanded
      ? safeCastEntries.slice(0, 8)
      : safeCastEntries;

    if (toggleBtnEl) {
      toggleBtnEl.hidden = !hasMoreCast;
      toggleBtnEl.textContent = __detailCastExpanded
        ? window.I18n.t("explore_detail_cast_show_less")
        : window.I18n.t("explore_detail_cast_show_more");
    }

    if (safeCastEntries.length === 0) {
      castEl.innerHTML = `
        <p class="content-detail-cast-empty">
          ${_escapeHtml(window.I18n.t("explore_detail_no_cast"))}
        </p>
      `;
      return;
    }

    castEl.innerHTML = visibleCastEntries
      .map((entry) => {
        const profile = _safeText(entry.profile).trim();
        const initial = _escapeHtml(String(entry.name || "?").trim().charAt(0).toUpperCase() || "?");

        return `
          <article class="content-detail-cast-person">
            <div
              class="content-detail-cast-avatar${profile ? "" : " is-fallback"}"
              ${profile ? `style="background-image: url('${_escapeHtml(profile)}');"` : ""}
              aria-hidden="true"
            >
              ${profile ? "" : `<span class="content-detail-cast-avatar-initial">${initial}</span>`}
            </div>

            <div class="content-detail-cast-copy">
              <strong class="content-detail-cast-name">${_escapeHtml(entry.name)}</strong>
              ${
                entry.character
                  ? `<span class="content-detail-cast-role">${_escapeHtml(entry.character)}</span>`
                  : ""
              }
            </div>
          </article>
        `;
    })
    .join("");
  }

  function _formatExploreRegionName(regionCode) {
    const safeRegion = _safeText(regionCode).trim().toUpperCase();
    if (!safeRegion) return "";

    try {
      const locale =
        document?.documentElement?.lang ||
        (navigator.languages && navigator.languages[0]) ||
        navigator.language ||
        "es";

      const formatter = new Intl.DisplayNames([locale], { type: "region" });
      return formatter.of(safeRegion) || safeRegion;
    } catch (_) {
      return safeRegion;
    }
  }

  function _translateExploreProviderAccessType(accessType) {
    const safeType = _safeText(accessType).trim().toLowerCase();

    const keyMap = {
      flatrate: "explore_detail_provider_flatrate",
      free: "explore_detail_provider_free",
      ads: "explore_detail_provider_ads",
      rent: "explore_detail_provider_rent",
      buy: "explore_detail_provider_buy"
    };

    const key = keyMap[safeType];
    return key ? window.I18n.t(key) : "";
  }

  function _renderContentDetailProviders(
    cardEl,
    listEl,
    metaEl,
    linkEl,
    providers = [],
    region = "",
    href = ""
  ) {
    if (!cardEl || !listEl) return;

    const safeProviders = (Array.isArray(providers) ? providers : [])
      .map((provider) => ({
        name: _safeText(provider?.name).trim(),
        logo: _safeText(provider?.logo).trim(),
        accessType: _safeText(provider?.accessType).trim()
      }))
      .filter((provider) => provider.name);
    const safeHref = _safeText(href).trim();
    const hasSafeHref = /^https?:\/\//i.test(safeHref);

    if (safeProviders.length === 0) {
      cardEl.hidden = true;
      listEl.innerHTML = "";
      if (metaEl) {
        metaEl.hidden = true;
        metaEl.textContent = "";
      }
      if (linkEl) {
        linkEl.hidden = true;
        linkEl.removeAttribute("href");
      }
      return;
    }

    cardEl.hidden = false;

    if (metaEl) {
      const regionName = _formatExploreRegionName(region);
      const metaText = regionName
        ? window.I18n.t("explore_detail_watch_region").replace("{region}", regionName)
        : "";

      metaEl.textContent = metaText;
      metaEl.hidden = !metaText;
    }

    if (linkEl) {
      if (hasSafeHref) {
        linkEl.hidden = false;
        linkEl.href = safeHref;
      } else {
        linkEl.hidden = true;
        linkEl.removeAttribute("href");
      }
    }

    listEl.innerHTML = safeProviders
      .map((provider) => {
        const accessTypeLabel = _translateExploreProviderAccessType(provider.accessType);
        const initial = _escapeHtml(provider.name.charAt(0).toUpperCase() || "?");

        return `
          <article class="content-detail-provider-chip">
            <div
              class="content-detail-provider-logo${provider.logo ? "" : " is-fallback"}"
              ${provider.logo ? `style="background-image: url('${_escapeHtml(provider.logo)}');"` : ""}
              aria-hidden="true"
            >
              ${provider.logo ? "" : `<span class="content-detail-provider-initial">${initial}</span>`}
            </div>

            <div class="content-detail-provider-copy">
              <strong class="content-detail-provider-name">${_escapeHtml(provider.name)}</strong>
              ${
                accessTypeLabel
                  ? `<span class="content-detail-provider-type">${_escapeHtml(accessTypeLabel)}</span>`
                  : ""
              }
            </div>
          </article>
        `;
      })
      .join("");
  }

  function _syncContentDetailRelatedNav(gridEl, navEl, prevBtnEl, nextBtnEl) {
    if (!gridEl) return;

    const maxScrollLeft = Math.max(0, gridEl.scrollWidth - gridEl.clientWidth);
    const canScroll = maxScrollLeft > 8;
    const scrollLeft = Math.max(0, gridEl.scrollLeft);
    const isAtStart = scrollLeft <= 4;
    const isAtEnd = scrollLeft >= maxScrollLeft - 4;

    if (navEl) {
      navEl.hidden = !canScroll;
    }

    gridEl.classList.toggle("is-scrollable", canScroll);
    gridEl.classList.toggle("is-at-start", !canScroll || isAtStart);
    gridEl.classList.toggle("is-at-end", !canScroll || isAtEnd);

    if (prevBtnEl) {
      prevBtnEl.disabled = !canScroll || isAtStart;
    }

    if (nextBtnEl) {
      nextBtnEl.disabled = !canScroll || isAtEnd;
    }
  }

  function _scrollContentDetailRelated(gridEl, direction = 1) {
    if (!gridEl) return;

    const cardWidth = gridEl.firstElementChild?.getBoundingClientRect?.().width || 168;
    const gap = 12;
    const delta = Math.max(cardWidth + gap, Math.floor(gridEl.clientWidth * 0.72));

    try {
      gridEl.scrollBy({
        left: delta * direction,
        behavior: "smooth"
      });
    } catch (_) {
      gridEl.scrollLeft += delta * direction;
    }
  }

  function _resetContentDetailRelatedDrag(gridEl) {
    if (gridEl) {
      gridEl.classList.remove("is-dragging");

      if (
        __detailRelatedDrag.pointerId != null &&
        typeof gridEl.hasPointerCapture === "function" &&
        gridEl.hasPointerCapture(__detailRelatedDrag.pointerId)
      ) {
        try {
          gridEl.releasePointerCapture(__detailRelatedDrag.pointerId);
        } catch (_) {}
      }
    }

    __detailRelatedDrag.pointerId = null;
    __detailRelatedDrag.startX = 0;
    __detailRelatedDrag.startScrollLeft = 0;
    __detailRelatedDrag.moved = false;
  }

  function _shouldSuppressContentDetailRelatedClick(target) {
    return (
      !!target?.closest?.("#contentDetailRelatedGrid") &&
      Date.now() < __detailRelatedDrag.suppressClickUntil
    );
  }

  function _renderContentDetailRelatedItems(
    sectionEl,
    gridEl,
    navEl,
    prevBtnEl,
    nextBtnEl,
    items = []
  ) {
    if (!sectionEl || !gridEl) return;

    const safeItems = (Array.isArray(items) ? items : [])
      .filter((item) => _normalizeId(item?.eid) && _safeText(item?.title).trim())
      .slice(0, 8);

    window.DetailModule?.setRelatedItems?.(safeItems);

    if (safeItems.length === 0) {
      sectionEl.hidden = true;
      gridEl.innerHTML = "";
      if (navEl) navEl.hidden = true;
      return;
    }

    sectionEl.hidden = false;
    gridEl.innerHTML = safeItems
      .map((item) => {
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
            aria-label="${openDetailLabel}"
          >
            ${_cardCover(item)}
            <div class="explore-card-overlay">
              <span class="explore-card-type">${vm.typeLabel}</span>
            </div>
          </article>
        `;
      })
      .join("");

    gridEl.onscroll = () => {
      _syncContentDetailRelatedNav(gridEl, navEl, prevBtnEl, nextBtnEl);
    };

    gridEl.onwheel = (event) => {
      const maxScrollLeft = Math.max(0, gridEl.scrollWidth - gridEl.clientWidth);
      if (maxScrollLeft <= 8) return;

      if (Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return;

      event.preventDefault();
      gridEl.scrollLeft += event.deltaY;
    };

    gridEl.onpointerdown = (event) => {
      const maxScrollLeft = Math.max(0, gridEl.scrollWidth - gridEl.clientWidth);
      if (maxScrollLeft <= 8) return;
      if (event.button !== 0) return;

      __detailRelatedDrag.pointerId = event.pointerId;
      __detailRelatedDrag.startX = event.clientX;
      __detailRelatedDrag.startScrollLeft = gridEl.scrollLeft;
      __detailRelatedDrag.moved = false;
    };

    gridEl.onpointermove = (event) => {
      if (__detailRelatedDrag.pointerId !== event.pointerId) return;

      const deltaX = event.clientX - __detailRelatedDrag.startX;

      if (!__detailRelatedDrag.moved && Math.abs(deltaX) > 6) {
        __detailRelatedDrag.moved = true;
        gridEl.classList.add("is-dragging");

        if (typeof gridEl.setPointerCapture === "function") {
          try {
            gridEl.setPointerCapture(event.pointerId);
          } catch (_) {}
        }
      }

      if (!__detailRelatedDrag.moved) return;

      event.preventDefault();
      gridEl.scrollLeft = __detailRelatedDrag.startScrollLeft - deltaX;
    };

    gridEl.onpointerup = (event) => {
      if (__detailRelatedDrag.pointerId !== event.pointerId) return;
      if (__detailRelatedDrag.moved) {
        __detailRelatedDrag.suppressClickUntil = Date.now() + 180;
      }
      _resetContentDetailRelatedDrag(gridEl);
    };

    gridEl.onpointercancel = () => {
      _resetContentDetailRelatedDrag(gridEl);
    };

    gridEl.onlostpointercapture = () => {
      _resetContentDetailRelatedDrag(gridEl);
    };

    requestAnimationFrame(() => {
      _syncContentDetailRelatedNav(gridEl, navEl, prevBtnEl, nextBtnEl);
    });
  }

  function _syncContentDetailTrailerLink(linkEl, wrapperEl, trailerUrl = "") {
    if (!linkEl || !wrapperEl) return;

    const safeHref = _safeText(trailerUrl).trim();
    const hasSafeHref = /^https?:\/\//i.test(safeHref);

    if (!hasSafeHref) {
      wrapperEl.hidden = true;
      linkEl.hidden = true;
      linkEl.removeAttribute("href");
      return;
    }

    wrapperEl.hidden = false;
    linkEl.hidden = false;
    linkEl.href = safeHref;
  }

  function _renderContentDetailHighlights(highlightsEl, facts = [], item = null) {
    if (!highlightsEl) return;

    const safeFacts = (Array.isArray(facts) ? facts : [])
      .filter((fact) => _safeText(fact?.label).trim())
      .slice(0, 3);

    if (safeFacts.length === 0) {
      highlightsEl.hidden = true;
      highlightsEl.innerHTML = "";
      return;
    }

    highlightsEl.hidden = false;
    highlightsEl.innerHTML = safeFacts
      .map((fact) => {
        if (fact?.kind === "rating") {
          return `
            <span class="content-detail-highlight content-detail-highlight--rating">
              <span class="content-detail-highlight-label">${_escapeHtml(fact.label)}</span>
              <span class="content-detail-highlight-rating">
                ${_buildExploreRatingMarkup(item, { compact: true })}
              </span>
            </span>
          `;
        }

        return `
          <span class="content-detail-highlight">
            <span class="content-detail-highlight-label">${_escapeHtml(fact.label)}</span>
            <strong class="content-detail-highlight-value">${_escapeHtml(fact.value)}</strong>
          </span>
        `;
      })
      .join("");
  }

  function _syncContentDetailAddLibraryButton(btn, item) {
    if (!btn) return;

    const isSaving = !!item?.__saving;
    const isInLibrary = !!item?.__inLibrary;

    btn.textContent = isInLibrary
      ? window.I18n.t("detail_library_added")
      : window.I18n.t("explore_drawer_add_library");

    btn.disabled = isSaving || isInLibrary;
    btn.setAttribute("aria-disabled", btn.disabled ? "true" : "false");
  }

  function _renderContentDetailSeasons(item, metaVm) {
    const sectionEl = document.getElementById("contentDetailSeasonsSection");
    const metaEl = document.getElementById("contentDetailSeasonsMeta");
    const gridEl = document.getElementById("contentDetailSeasonGrid");

    if (!sectionEl || !metaEl || !gridEl) return;

    const seasonBreakdown = Array.isArray(metaVm?.seasonBreakdown)
      ? metaVm.seasonBreakdown
      : [];

    if (seasonBreakdown.length === 0) {
      sectionEl.hidden = true;
      metaEl.textContent = "";
      gridEl.innerHTML = "";
      return;
    }

    sectionEl.hidden = false;
    metaEl.textContent = metaVm?.seasonsSummary || "";

    gridEl.innerHTML = seasonBreakdown
      .map((season) => {
        const seasonNumber = Math.max(0, Number(season?.seasonNumber || 0) || 0);
        const seasonKey = _getDetailSeasonCacheKey(item, seasonNumber);
        const isExpandable = _canLoadDetailSeasonEpisodes(item) && !!seasonKey;
        const isExpanded = !!seasonKey && __detailExpandedSeasonKeys.has(seasonKey);
        const seasonTitle =
          _safeText(season?.name).trim() ||
          window.I18n
            .t("explore_detail_season_name")
            .replace("{number}", String(seasonNumber));
        const episodeLabel = _formatExploreCountLabel(
          season?.episodeCount || 0,
          "explore_detail_episode_single",
          "explore_detail_episode_plural"
        );
        const airYear = _safeText(season?.airDate).trim().slice(0, 4);
        const seasonMeta = [episodeLabel, airYear].filter(Boolean).join(" · ");
        const poster = _safeText(season?.poster).trim();

        return `
          <article class="content-detail-season-panel${isExpanded ? " is-open" : ""}">
            <button
              type="button"
              class="content-detail-season-card${isExpandable ? "" : " is-static"}"
              data-season-number="${seasonNumber}"
              ${isExpandable ? `aria-expanded="${isExpanded ? "true" : "false"}"` : "disabled"}
            >
              <div
                class="content-detail-season-poster${poster ? "" : " is-fallback"}"
                ${poster ? `style="background-image: url('${_escapeHtml(poster)}');"` : ""}
              >
                ${poster ? "" : `<span class="content-detail-season-initial">T${seasonNumber}</span>`}
              </div>

              <div class="content-detail-season-copy">
                <strong class="content-detail-season-title">${_escapeHtml(seasonTitle)}</strong>
                <span class="content-detail-season-meta">${_escapeHtml(seasonMeta)}</span>
              </div>

              ${
                isExpandable
                  ? `
                    <span class="content-detail-season-chevron" aria-hidden="true">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M6 9l6 6 6-6"></path>
                      </svg>
                    </span>
                  `
                  : ""
              }
            </button>

            ${isExpanded ? _renderContentDetailSeasonBody(item, seasonNumber) : ""}
          </article>
        `;
      })
      .join("");
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

    _applyExploreVisualCover(coverEl, item);

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

  function _renderContentDetailView(item) {
    return window.DetailModule?.render?.(item) || item;
  }

  function _syncActiveExploreSurfaces(targetEid = "") {
    const normalizedTargetEid = _normalizeId(targetEid);

    const activeItem = _getActiveExploreItem();
    if (
      __drawerOpen &&
      activeItem &&
      (!normalizedTargetEid || _normalizeId(activeItem.eid) === normalizedTargetEid)
    ) {
      _syncExploreDrawerFromItem(activeItem);
      _renderExploreDrawerDetails(activeItem);
    }

    const detailItem = _getActiveDetailItem();
    if (
      _isDetailViewActive() &&
      detailItem &&
      (!normalizedTargetEid || _normalizeId(detailItem.eid) === normalizedTargetEid)
    ) {
      _setActiveDetailState({
        item: detailItem,
        loading: false,
        error: false
      });
      window.DetailModule?.render?.(detailItem);
    }
  }

  function _openContentDetailView(item, { originView = "explore", triggerEl = null } = {}) {
    const detailItem = item;
    const detailEid = _normalizeId(detailItem?.eid);
    if (!detailEid) return;
    const openingFromDetail = _isDetailViewActive();
    const fallbackFocusEl = openingFromDetail
      ? (__detailViewLastFocusEl || document.getElementById("contentDetailBack") || triggerEl || document.activeElement)
      : __drawerOpen
        ? (__drawerLastFocusEl || triggerEl || document.activeElement)
        : (triggerEl || document.activeElement);

    window.DetailModule?.setDetailState?.({
      item: detailItem,
      loading: false,
      error: false,
      originView: originView || "explore",
      lastFocusEl: fallbackFocusEl
    });
    __detailListsPickerOpen = false;
    __detailCastExpanded = false;
    __detailExpandedSeasonKeys.clear();
    _nextDetailRequestSeq();
    // Eliminado: activeEid = detailEid;

    if (__drawerOpen) {
      _closeExploreDrawer({ restoreFocus: false, clearActiveEid: false });
    }

    window.DetailModule?.render?.(detailItem);
    window.Router?.showView?.("detail");

    requestAnimationFrame(() => {
      _scrollAppMainToTop();
      document.getElementById("contentDetailBack")?.focus?.();
    });

    _refreshItemLibraryState(detailItem)
      .then((freshItem) => {
        const nextItem = freshItem || detailItem;
        if (!_isDetailViewActive()) return;
        window.DetailModule?.setDetailState?.({
          item: nextItem,
          loading: false,
          error: false
        });
        window.DetailModule?.render?.(nextItem);
        return window.DetailModule?.hydrate?.(nextItem);
      })
      .catch((error) => {
        console.error("[Explore] failed to refresh detail page state", error);
        void window.DetailModule?.hydrate?.(detailItem);
      });
  }

  function _closeContentDetailView({ restoreFocus = true } = {}) {
    _nextDetailRequestSeq();

    const detailState = window.DetailModule?.getDetailState?.() || {};
    const back = detailState.lastFocusEl || null;
    const originView = detailState.originView || "explore";

    _setActiveDetailState({
      item: null,
      loading: false,
      error: false
    });
    __detailListsPickerOpen = false;
    __detailCastExpanded = false;
    __detailExpandedSeasonKeys.clear();
    _syncContentDetailFeedback();
    _syncContentDetailListPicker();

    window.DetailModule?.resetDetailState?.();
    window.DetailModule?.clearRelatedItems?.();
    // Eliminado: activeEid = null;

    window.Router?.showView?.(originView);

    if (restoreFocus && back && typeof back.focus === "function") {
      requestAnimationFrame(() => back.focus());
    }
  }

  function _getExploreListPickerRefs(scope = "drawer") {
    if (scope === "detail") {
      return {
        picker: document.getElementById("contentDetailListPicker"),
        select: document.getElementById("contentDetailListSelect"),
        confirmBtn: document.getElementById("contentDetailConfirmList"),
        addBtn: document.getElementById("contentDetailAddLists")
      };
    }

    return {
      picker: document.getElementById("exploreDrawerListPicker"),
      select: document.getElementById("exploreDrawerListSelect"),
      confirmBtn: document.getElementById("exploreDrawerConfirmList"),
      addBtn: document.getElementById("exploreDrawerAddLists")
    };
  }

  function _isExploreListPickerOpen(scope = "drawer") {
    return scope === "detail" ? __detailListsPickerOpen : __drawerListsPickerOpen;
  }

  function _setExploreListPickerOpen(scope = "drawer", isOpen = false) {
    if (scope === "detail") {
      __detailListsPickerOpen = !!isOpen;
      return;
    }

    __drawerListsPickerOpen = !!isOpen;
  }

  function _syncExploreListPickerVisibility(scope = "drawer") {
    const { picker, addBtn } = _getExploreListPickerRefs(scope);
    const isOpen = _isExploreListPickerOpen(scope);

    if (picker) {
      picker.hidden = !isOpen;
    }

    if (addBtn) {
      addBtn.setAttribute("aria-expanded", isOpen ? "true" : "false");
      addBtn.classList.toggle("is-active", isOpen);
    }
  }

  function _syncExploreDrawerListPicker() {
    _syncExploreListPickerVisibility("drawer");
  }

  function _syncContentDetailListPicker() {
    _syncExploreListPickerVisibility("detail");
  }

  async function _handleExploreDrawerAddToListClick() {
    const activeItem = _getActiveExploreItem();
    if (!activeItem) return;

    if (_isExploreListPickerOpen("drawer")) {
      _closeExploreListPicker("drawer");
      return;
    }

    await _openExploreListPicker(null, "drawer");
  }

  async function _handleContentDetailAddToListClick() {
    const activeItem = _getActiveDetailItem();
    if (!activeItem) return;

    if (_isExploreListPickerOpen("detail")) {
      _closeExploreListPicker("detail");
      return;
    }

    await _openExploreListPicker(null, "detail");
  }

  async function _populateExploreListPicker(preselectedListId = null, scope = "drawer") {
    const { select, confirmBtn } = _getExploreListPickerRefs(scope);
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

  async function _openExploreListPicker(preselectedListId = null, scope = "drawer") {
    const { picker, select, confirmBtn } = _getExploreListPickerRefs(scope);

    if (!picker) return;

    _setExploreListPickerOpen(scope, true);
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
      await _populateExploreListPicker(preselectedListId, scope);
    } catch (e) {
      console.error("Explore: no se pudo preparar el picker de listas", e);
    }

    _syncExploreListConfirmState(scope);
    _syncExploreListPickerVisibility(scope);

    requestAnimationFrame(() => select?.focus?.());
  }

  function _closeExploreListPicker(scope = "drawer") {
    const { picker, select, confirmBtn } = _getExploreListPickerRefs(scope);

    _setExploreListPickerOpen(scope, false);

    if (picker) picker.hidden = true;
    if (select) select.value = "";
    if (confirmBtn) confirmBtn.disabled = true;

    _syncExploreListPickerVisibility(scope);
  }

  function _syncExploreListConfirmState(scope = "drawer") {
    const { select, confirmBtn } = _getExploreListPickerRefs(scope);
    if (!confirmBtn) return;
    confirmBtn.disabled = !_normalizeId(select?.value);
  }

  async function _saveActiveExploreItemToList(listId, { item = null, scope = "drawer" } = {}) {
    const normalizedListId = _normalizeId(listId);
    const activeItem = item || (scope === "detail" ? _getActiveDetailItem() : _getActiveExploreItem());
    if (!activeItem || !normalizedListId) return;

    const { confirmBtn } = _getExploreListPickerRefs(scope);
    _setDrawerButtonLoading(confirmBtn, true);

    try {
      const ensured = await _ensureInLibrary(activeItem);
      if (!ensured?.ok) return;

      const freshItem = _getExploreItemByEid(activeItem.eid) || activeItem;
      const libraryItemId = _normalizeId(
        ensured.createdId ||
        freshItem?.__libraryItemId
      );

      if (!libraryItemId) {
        if (scope === "detail") {
          window.toast?.({
            title: window.I18n.t("explore_library_add_error"),
            message: window.I18n.t("explore_drawer_list_resolve_error"),
            type: "error",
            duration: 3000
          });
        } else {
          _showDrawerInlineNotePersistent(
            window.I18n.t("explore_drawer_list_resolve_error")
          );
        }
        return;
      }

      const result = await ApiClient.addLibraryItemToList(
        normalizedListId,
        libraryItemId
      );

      let feedbackMessage = "";
      let feedbackType = "success";
      let drawerNotePersistent = false;

      if (result?.ok && !result?.already) {
        feedbackMessage = window.I18n.t("explore_drawer_list_added");
      } else if (result?.already) {
        feedbackMessage = window.I18n.t("explore_drawer_list_already_added");
        feedbackType = "info";
        drawerNotePersistent = true;
      } else {
        if (scope === "detail") {
          window.toast?.({
            title: window.I18n.t("explore_library_add_error"),
            message: window.I18n.t("explore_drawer_list_add_error"),
            type: "error",
            duration: 3000
          });
        } else {
          _showDrawerInlineNotePersistent(
            window.I18n.t("explore_drawer_list_add_error")
          );
        }
        return;
      }

      await _syncInLibraryFlags();

      const syncedExploreItem = _getExploreItemByEid(activeItem.eid);
      const activeDetailItem = _getActiveDetailItem();

      const baseFresh =
        scope === "detail" && _normalizeId(activeDetailItem?.eid) === _normalizeId(activeItem.eid)
          ? activeDetailItem
          : syncedExploreItem || activeItem;

      let authoritativeListsCount = Math.max(0, Number(baseFresh?.__listsCount || 0));

      try {
        const containingLists = await ApiClient.getListsContainingItem(libraryItemId);
        authoritativeListsCount = Array.isArray(containingLists)
          ? containingLists.length
          : authoritativeListsCount;
      } catch (error) {
        console.error("[Explore] failed to refresh item lists count", error);
      }

      const fresh = {
        ...baseFresh,
        __inLibrary: true,
        __libraryItemId: libraryItemId,
        __listsCount: authoritativeListsCount
      };

      if (scope === "detail") {
        _setActiveDetailState({
          item: fresh,
          loading: false,
          error: false
        });

        window.DetailModule?.render?.(fresh);
      } else {
        _render();
        _syncActiveExploreSurfaces(activeItem.eid);
      }

      _closeExploreListPicker(scope);

      if (feedbackMessage) {
        if (scope === "detail") {
          window.toast?.({
            title: window.I18n.t("nav_detail"),
            message: feedbackMessage,
            type: feedbackType,
            duration: 2400
          });
        } else if (drawerNotePersistent) {
          _showDrawerInlineNotePersistent(feedbackMessage);
        } else {
          _showDrawerInlineNote(feedbackMessage);
        }
      }

      if (scope === "detail" && fresh) {
        _setActiveDetailState({
          item: fresh,
          loading: false,
          error: false
        });
        window.DetailModule?.render?.(fresh);
      }
    } catch (err) {
      console.error("[Explore] add item to list failed", err);

      if (scope === "detail") {
        window.toast?.({
          title: window.I18n.t("explore_library_add_error"),
          message: window.I18n.t("explore_drawer_list_add_error"),
          type: "error",
          duration: 3000
        });
      } else {
        _showDrawerInlineNotePersistent(
          window.I18n.t("explore_drawer_list_add_error")
        );
      }
    } finally {
      _setDrawerButtonLoading(confirmBtn, false);
    }
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

    const detailItem = _getActiveDetailItem();

    if (_normalizeId(detailItem?.eid) === targetEid) {
      const nextDetailItem = {
        ...detailItem,
        ...patcher(detailItem)
      };

      didChange = true;

      _setActiveDetailState({
        item: nextDetailItem,
        loading: false,
        error: false
      });

      if (_isDetailViewActive()) {
        window.DetailModule?.render?.(nextDetailItem);
      }
    }

    return didChange;
  }

  function _scheduleExploreLibraryStateSync() {
    if (__libraryStateSyncPromise) return __libraryStateSyncPromise;

    __libraryStateSyncPromise = Promise.resolve()
      .then(() => _syncInLibraryFlags())
      .then(() => {
        _applyFilters();
        _syncActiveExploreSurfaces();
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
    _syncActiveExploreSurfaces();
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
    const releaseYear = Number(item?.meta?.year || String(item?.releaseDate || "").slice(0, 4) || 0);
    const resolvedTypeLabel =
      TYPE_LABELS[normalizedType]?.() ||
      (normalizedType === "tv" ? window.I18n.t("home_type_series") : "") ||
      (normalizedType === "movie" ? window.I18n.t("home_type_movie") : "") ||
      (normalizedType === "libro" ? window.I18n.t("home_type_book") : "") ||
      (normalizedType === "videojuego" ? window.I18n.t("home_type_game") : "") ||
      window.I18n.t("lists_type_content");

    const metaParts = [
      resolvedTypeLabel,
      releaseYear > 0 ? String(releaseYear) : ""
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
          ? _formatExploreDate(item.releaseDate)
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
    const totalSeasonsNumber = Math.max(
      0,
      Number(item?.meta?.totalSeasons || item?.seasons || 0) || 0
    );
    const totalEpisodesNumber = Math.max(
      0,
      Number(item?.meta?.totalEpisodes || item?.episodes || 0) || 0
    );
    const yearNumber = Number(item?.meta?.year || 0);
    const safeOriginalTitle = _safeText(item?.originalTitle).trim();
    const safeCurrentTitle = _safeText(item?.title).trim();
    const hasAlternativeOriginalTitle =
      safeOriginalTitle &&
      _norm(safeOriginalTitle) !== _norm(safeCurrentTitle);
    const noMetaValue = window.I18n.t("explore_detail_no_meta");

    const rawSeasonBreakdown = Array.isArray(item?.meta?.seasonBreakdown)
      ? item.meta.seasonBreakdown
      : [];

    const seasonBreakdown = rawSeasonBreakdown
      .map((season) => ({
        seasonNumber: Math.max(0, Number(season?.seasonNumber || 0) || 0),
        episodeCount: Math.max(0, Number(season?.episodeCount || 0) || 0),
        name: _safeText(season?.name).trim(),
        airDate: _safeText(season?.airDate).trim(),
        poster: _safeText(season?.poster).trim()
      }))
      .filter((season) => season.seasonNumber > 0);

    const cast = (Array.isArray(item?.cast) ? item.cast : [])
      .map((entry) => ({
        name: _safeText(entry?.name).trim(),
        character: _safeText(entry?.character).trim(),
        profile: _safeText(entry?.profile).trim()
      }))
      .filter((entry) => entry.name);

    const watchProviders = (Array.isArray(item?.meta?.watchProviders?.services)
      ? item.meta.watchProviders.services
      : [])
      .map((provider) => ({
        name: _safeText(provider?.name).trim(),
        logo: _safeText(provider?.logo).trim(),
        accessType: _safeText(provider?.accessType).trim()
      }))
      .filter((provider) => provider.name);

    const watchProvidersRegion = _safeText(item?.meta?.watchProviders?.region)
      .trim()
      .toUpperCase();
    const watchProvidersLink = _safeText(item?.meta?.watchProviders?.link).trim();
    const trailerUrl = _safeText(item?.meta?.trailerUrl).trim();
    const creator = _safeText(item?.meta?.creator).trim();
    const director = _safeText(item?.meta?.director).trim();
    const writer = _safeText(item?.meta?.writer).trim();
    const lastAirDate = _safeText(item?.meta?.lastAirDate).trim();
    const formattedLastAirDate = _formatExploreDate(lastAirDate);
    const durationValue =
      runtimeNumber > 0
        ? `${runtimeNumber} ${window.I18n.t("time_minutes")}`
        : "";
    let seriesOverviewValue = "";

    let primaryLabel = window.I18n.t("explore_detail_label_meta");
    let primaryValue = window.I18n.t("explore_detail_no_meta");
    let secondaryLabel = window.I18n.t("explore_detail_label_meta");
    let secondaryValue = window.I18n.t("explore_detail_no_meta");
    let tertiaryLabel = window.I18n.t("explore_detail_label_meta");
    let tertiaryValue = window.I18n.t("explore_detail_no_meta");

    if (_norm(item?.type) !== "serie") {
      if (author) {
        primaryLabel = window.I18n.t("explore_detail_label_author");
        primaryValue = author;
      } else if (durationValue) {
        primaryLabel = window.I18n.t("explore_detail_label_duration");
        primaryValue = durationValue;
      } else if (platforms) {
        primaryLabel = window.I18n.t("explore_detail_label_platforms");
        primaryValue = platforms;
      } else if (totalPagesNumber > 0) {
        primaryLabel = window.I18n.t("explore_detail_label_pages");
        primaryValue = `${totalPagesNumber} ${window.I18n.t("library_pages")}`;
      }
    }

    if (_norm(item?.type) === "serie") {
      const seasonParts = [];

      if (totalSeasonsNumber > 0) {
        seasonParts.push(
          _formatExploreCountLabel(
            totalSeasonsNumber,
            "explore_detail_season_single",
            "explore_detail_season_plural"
          )
        );
      }

      if (totalEpisodesNumber > 0) {
        seasonParts.push(
          _formatExploreCountLabel(
            totalEpisodesNumber,
            "explore_detail_episode_single",
            "explore_detail_episode_plural"
          )
        );
      }

      seriesOverviewValue =
        seasonParts.join(" · ") || window.I18n.t("explore_detail_no_seasons");

      if (creator) {
        primaryLabel = window.I18n.t("explore_detail_label_creator");
        primaryValue = creator;
      }

      if (hasAlternativeOriginalTitle) {
        secondaryLabel = window.I18n.t("explore_detail_label_original_title");
        secondaryValue = safeOriginalTitle;
      } else if (
        formattedLastAirDate &&
        lastAirDate !== _safeText(item?.releaseDate).trim()
      ) {
        secondaryLabel = window.I18n.t("explore_detail_label_last_aired");
        secondaryValue = formattedLastAirDate;
      }

      tertiaryLabel = window.I18n.t("explore_detail_label_status");
      tertiaryValue = statusLabel || window.I18n.t("explore_detail_no_meta");
    } else {
      if (_norm(item?.type) === "pelicula" && director) {
        primaryLabel = window.I18n.t("explore_detail_label_director");
        primaryValue = director;
      }

      if (hasAlternativeOriginalTitle) {
        secondaryLabel = window.I18n.t("explore_detail_label_original_title");
        secondaryValue = safeOriginalTitle;
      } else if (_norm(item?.type) === "pelicula" && writer) {
        secondaryLabel = window.I18n.t("explore_detail_label_writer");
        secondaryValue = writer;
      } else if (yearNumber > 0) {
        secondaryLabel = window.I18n.t("explore_detail_label_year");
        secondaryValue = String(yearNumber);
      }

      if (_norm(item?.type) === "pelicula") {
        if (hasAlternativeOriginalTitle && writer) {
          tertiaryLabel = window.I18n.t("explore_detail_label_writer");
          tertiaryValue = writer;
        } else {
          tertiaryLabel = window.I18n.t("explore_detail_label_status");
          tertiaryValue = statusLabel || window.I18n.t("explore_detail_no_meta");
        }
      } else if (_norm(item?.type) === "book" && totalPagesNumber > 0) {
        tertiaryLabel = window.I18n.t("explore_detail_label_pages");
        tertiaryValue = `${totalPagesNumber} ${window.I18n.t("library_pages")}`;
      } else if (_norm(item?.type) === "game" && yearNumber > 0) {
        tertiaryLabel = window.I18n.t("explore_detail_label_year");
        tertiaryValue = String(yearNumber);
      } else if (statusLabel) {
        tertiaryLabel = window.I18n.t("explore_detail_label_status");
        tertiaryValue = statusLabel;
      }
    }

    const heroFacts = [];
    const heroFactKeys = new Set();
    const safeRatingValue =
      Number.isFinite(ratingNumber) && ratingNumber > 0
        ? ratingNumber.toFixed(1)
        : "";

    if (_norm(item?.type) === "serie") {
      if (
        seriesOverviewValue &&
        seriesOverviewValue !== window.I18n.t("explore_detail_no_seasons")
      ) {
        heroFacts.push({
          key: "series_overview",
          label: window.I18n.t("explore_detail_label_series_overview"),
          value: seriesOverviewValue
        });
        heroFactKeys.add("series_overview");
      }

      if (durationValue) {
        heroFacts.push({
          key: "series_duration",
          label: window.I18n.t("explore_detail_label_duration"),
          value: durationValue
        });
        heroFactKeys.add("series_duration");
      }
    } else {
      if (
        primaryLabel === window.I18n.t("explore_detail_label_duration") &&
        primaryValue &&
        primaryValue !== noMetaValue
      ) {
        heroFacts.push({
          key: "primary",
          label: primaryLabel,
          value: primaryValue
        });
        heroFactKeys.add("primary");
      }
    }

    return {
      genres: genres.length
        ? genres.join(", ")
        : window.I18n.t("explore_detail_no_genres"),
      rating,
      primaryLabel,
      primaryValue,
      secondaryLabel,
      secondaryValue,
      tertiaryLabel,
      tertiaryValue,
      heroFacts,
      showRatingCard: !!safeRatingValue,
      showPrimaryCard: primaryValue !== noMetaValue && !heroFactKeys.has("primary"),
      showSecondaryCard: secondaryValue !== noMetaValue && !heroFactKeys.has("secondary"),
      showTertiaryCard: tertiaryValue !== noMetaValue && !heroFactKeys.has("tertiary"),
      cast,
      watchProviders,
      watchProvidersRegion,
      watchProvidersLink,
      trailerUrl,
      seasonBreakdown,
      seasonsSummary:
        totalSeasonsNumber > 0 || totalEpisodesNumber > 0
          ? [
              totalSeasonsNumber > 0
                ? _formatExploreCountLabel(
                    totalSeasonsNumber,
                    "explore_detail_season_single",
                    "explore_detail_season_plural"
                  )
                : "",
              totalEpisodesNumber > 0
                ? _formatExploreCountLabel(
                    totalEpisodesNumber,
                    "explore_detail_episode_single",
                    "explore_detail_episode_plural"
                  )
                : ""
            ]
              .filter(Boolean)
              .join(" · ")
          : window.I18n.t("explore_detail_no_seasons")
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

    _renderExploreRating(ratingEl, item);

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
        .map(item =>[
          window.ItemIdentity?.getCanonicalContentKey?.(item) || "",
          item
        ])
        .filter(([key]) => Boolean(key))
    );

    // Matching estricto de referencias: ID directo o Identidad Canónica.
    const syncLibraryRefs = (items) =>
      items.map((x) => {
        const currentLibraryId = _normalizeId(x.__libraryItemId) || null;
        const byId = currentLibraryId ? libraryById.get(currentLibraryId) : null;
        const canonicalKey = window.ItemIdentity?.getCanonicalContentKey?.(x) || "";
        const byCanonical = byId || !canonicalKey
          ? null
          : libraryByCanonicalKey.get(canonicalKey);

        const libraryItem = byId || byCanonical || null;

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
    const activeDetailItem = _getActiveDetailItem();
    const currentOrDetail =
      current ||
      (_normalizeId(activeDetailItem?.eid) === eid ? activeDetailItem : null);

    if (currentOrDetail?.__inLibrary) {
      return {
        ok: true,
        createdId: _normalizeId(currentOrDetail.__libraryItemId) || null
      };
    }

    const pending = __pendingLibraryEnsures.get(eid);
    if (pending) {
      return pending;
    }

    const run = (async () => {

    _patchExploreItemsByEid(eid, () => ({ __saving: true }));
    _syncActiveExploreSurfaces(eid);

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
        _syncActiveExploreSurfaces(eid);

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
          _syncActiveExploreSurfaces(eid);

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
          _syncActiveExploreSurfaces(eid);

          _applyFilters();

          return {
            ok: true,
            createdId: resolvedLibraryItemId
          };
        }

        console.error(err);

        _patchExploreItemsByEid(eid, () => ({ __saving: false }));
        _syncActiveExploreSurfaces(eid);

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

  function bind() {

    const globalSearch = document.getElementById("globalSearch");

    if (globalSearch && !globalSearch.__exploreBound) {
      globalSearch.__exploreBound = true;

      globalSearch.addEventListener("input", () => {
        const isExploreActive = document.querySelector("#view-explore")?.classList.contains("is-active");
        if (!isExploreActive) return;

        searchTerm = String(globalSearch.value || "").trim();
        _scheduleApplyFilters();
      });
    }

    // Evita doble binding
    if (bind._bound) return;
    bind._bound = true;

    // CLICK "+"

    document.addEventListener("click", async (e) => {
      const detailTrigger = e.target.closest(
        '[data-action="open-item-detail"][data-eid], [data-detail-related][data-eid]'
      );
      if (detailTrigger) {
        if (_shouldSuppressContentDetailRelatedClick(detailTrigger)) {
          e.preventDefault();
          e.stopPropagation();
          return;
        }

        e.preventDefault();
        e.stopPropagation();

        const eid = _normalizeId(detailTrigger.dataset.eid);
        if (!eid) return;

        const isRelatedTrigger = !!detailTrigger.closest("#contentDetailRelatedGrid");

        const item = isRelatedTrigger
          ? window.DetailModule?.getRelatedItemByEid?.(eid)
          : _getExploreItemByEid(eid);

        if (!item) {
          console.warn("[Detail] open detail target not found", {
            eid,
            isRelatedTrigger,
            relatedKeys: "owned-by-DetailModule"
          });
          return;
        }

        window.DetailModule?.open?.(item, {
          originView: isRelatedTrigger ? "detail" : "explore",
          triggerEl: detailTrigger
        });
        return;
      }

      const seasonToggle = e.target.closest(".content-detail-season-card[data-season-number]");
      if (seasonToggle) {
        e.preventDefault();
        e.stopPropagation();

        const seasonNumber = Math.max(1, Number(seasonToggle.dataset.seasonNumber || 0) || 0);
        if (!seasonNumber) return;

        await _toggleContentDetailSeason(seasonNumber);
        return;
      }

      const castToggle = e.target.closest("#contentDetailCastToggle");
      if (castToggle) {
        e.preventDefault();
        e.stopPropagation();

        __detailCastExpanded = !__detailCastExpanded;

        const activeDetailItem = _getActiveDetailItem();
        if (activeDetailItem) {
          window.DetailModule?.render?.(activeDetailItem);
        }
        return;
      }

      const relatedPrevBtn = e.target.closest("#contentDetailRelatedPrev");
      if (relatedPrevBtn) {
        e.preventDefault();
        e.stopPropagation();
        _scrollContentDetailRelated(document.getElementById("contentDetailRelatedGrid"), -1);
        return;
      }

      const relatedNextBtn = e.target.closest("#contentDetailRelatedNext");
      if (relatedNextBtn) {
        e.preventDefault();
        e.stopPropagation();
        _scrollContentDetailRelated(document.getElementById("contentDetailRelatedGrid"), 1);
      }
    });

    document.addEventListener("keydown", async (e) => {
      const card = e.target.closest(
        '[data-action="open-item-detail"][data-eid], [data-detail-related][data-eid]'
      );
      if (!card) return;

      if (e.key !== "Enter" && e.key !== " ") return;

      e.preventDefault();

      const eid = _normalizeId(card.dataset.eid);
      if (!eid) return;

      const isRelatedTrigger = !!card.closest("#contentDetailRelatedGrid");

      const item = isRelatedTrigger
        ? window.DetailModule?.getRelatedItemByEid?.(eid)
        : _getExploreItemByEid(eid);

      if (!item) {
        console.warn("[Detail] open detail target not found", {
          eid,
          isRelatedTrigger,
          relatedKeys: "owned-by-DetailModule"
        });
        return;
      }

      window.DetailModule?.open?.(item, {
        originView: isRelatedTrigger ? "detail" : "explore",
        triggerEl: card
      });
    });

    // ESC

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        if (__drawerOpen) {
          _closeExploreDrawer();
          return;
        }

        if (_isDetailViewActive()) {
          window.DetailModule?.close?.();
        }
      }
    });

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

        await _saveActiveExploreItemToList(listId, { scope: "drawer" });
      });
    }

    const cancelListBtn = document.getElementById("exploreDrawerCancelList");

    const listSelect = document.getElementById("exploreDrawerListSelect");

    if (listSelect && !listSelect.dataset.bound) {
      listSelect.dataset.bound = "1";

      listSelect.addEventListener("change", () => {
        _syncExploreListConfirmState("drawer");
      });
    }

    if (cancelListBtn && !cancelListBtn.dataset.bound) {
      cancelListBtn.dataset.bound = "1";

      cancelListBtn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();

        _closeExploreListPicker("drawer");
      });
    }

    const detailBackBtn = document.getElementById("contentDetailBack");
    if (detailBackBtn && !detailBackBtn.dataset.bound) {
      detailBackBtn.dataset.bound = "1";

      detailBackBtn.addEventListener("click", (e) => {
        e.preventDefault();
        window.DetailModule?.close?.();
      });
    }

    const detailAddLibraryBtn = document.getElementById("contentDetailAddLibrary");
    if (detailAddLibraryBtn && !detailAddLibraryBtn.dataset.bound) {
      detailAddLibraryBtn.dataset.bound = "1";

      detailAddLibraryBtn.addEventListener("click", async (e) => {
        e.preventDefault();
        e.stopPropagation();

        const item = _getActiveDetailItem();
        if (!item) return;

        _setDrawerButtonLoading(detailAddLibraryBtn, true);

        try {
          const ensured = await _ensureInLibrary(item);
          if (!ensured?.ok) return;

          await _syncInLibraryFlags();

          const fresh = _getActiveDetailItem();
          if (fresh) {
            _setActiveDetailState({
              item: fresh
            });
            window.DetailModule?.render?.(fresh);
          }

          _render();
        } finally {
          _setDrawerButtonLoading(detailAddLibraryBtn, false);

          const fresh = _getActiveDetailItem();
          if (fresh) {
            _setActiveDetailState({
              item: fresh
            });
            window.DetailModule?.render?.(fresh);
          }
        }
      });
    }

    const detailAddListsBtn = document.getElementById("contentDetailAddLists");
    if (detailAddListsBtn && !detailAddListsBtn.dataset.bound) {
      detailAddListsBtn.dataset.bound = "1";

      detailAddListsBtn.addEventListener("click", async (e) => {
        e.preventDefault();
        e.stopPropagation();
        await _handleContentDetailAddToListClick();
      });
    }

    const detailConfirmListBtn = document.getElementById("contentDetailConfirmList");
    if (detailConfirmListBtn && !detailConfirmListBtn.dataset.bound) {
      detailConfirmListBtn.dataset.bound = "1";

      detailConfirmListBtn.addEventListener("click", async (e) => {
        e.preventDefault();
        e.stopPropagation();

        const select = document.getElementById("contentDetailListSelect");
        const listId = select?.value;

        if (!listId) {
          window.toast?.({
            title: window.I18n.t("nav_detail"),
            message: window.I18n.t("explore_list_required"),
            type: "error",
            duration: 2400
          });
          return;
        }

        await _saveActiveExploreItemToList(listId, { scope: "detail" });
      });
    }

    const detailListSelect = document.getElementById("contentDetailListSelect");
    if (detailListSelect && !detailListSelect.dataset.bound) {
      detailListSelect.dataset.bound = "1";

      detailListSelect.addEventListener("change", () => {
        _syncExploreListConfirmState("detail");
      });
    }

    const detailCancelListBtn = document.getElementById("contentDetailCancelList");
    if (detailCancelListBtn && !detailCancelListBtn.dataset.bound) {
      detailCancelListBtn.dataset.bound = "1";

      detailCancelListBtn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        _closeExploreListPicker("detail");
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

      window.DetailModule?.registerBridge?.({
        open: openContentDetail,
        close: closeContentDetail
      });

      window.DetailModule?.registerRenderDeps?.({
        normalizeId: _normalizeId,
        setActiveDetailState: _setActiveDetailState,
        buildTextModel: _buildExploreDrawerTextModel,
        buildDetailMeta: _buildExploreDrawerDetailMeta,
        applyVisualCover: _applyExploreVisualCover,
        syncTrailerLink: _syncContentDetailTrailerLink,
        renderRating: _renderExploreRating,
        renderHighlights: _renderContentDetailHighlights,
        renderProviders: _renderContentDetailProviders,
        renderRelatedItems: _renderContentDetailRelatedItems,
        renderCast: _renderContentDetailCast,
        renderSeasons: _renderContentDetailSeasons,
        syncAddLibraryButton: _syncContentDetailAddLibraryButton,
        syncFeedback: _syncContentDetailFeedback,
        syncListPicker: _syncContentDetailListPicker
      });

      window.DetailModule?.registerHydrateDeps?.({
        normalizeId: _normalizeId,
        setActiveDetailState: _setActiveDetailState,
        syncFeedback: _syncContentDetailFeedback,
        fetchHydratedDetail: _fetchHydratedExploreItemDetail,
        isDetailViewActive: _isDetailViewActive
      });

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

    const activeItem = _getActiveExploreItem();
    if (__drawerOpen && activeItem) {
      _syncExploreDrawerFromItem(activeItem);
      _renderExploreDrawerDetails(activeItem);
      _syncExploreDrawerDetailFeedback();

      if (_isExploreListPickerOpen("drawer")) {
        void _populateExploreListPicker(null, "drawer");
      }
    }

    const detailItem = _getActiveDetailItem();
    if (_isDetailViewActive() && detailItem) {
      window.DetailModule?.setDetailState?.({
        item: detailItem
      });
      window.DetailModule?.render?.(detailItem);
      _syncContentDetailFeedback();

      void window.DetailModule?.hydrate?.(detailItem);

      if (_isExploreListPickerOpen("detail")) {
        void _populateExploreListPicker(null, "detail");
      }
    }
  });

  function openContentDetail(item, options = {}) {
    if (!item) return;

    _openContentDetailView(item, {
      originView: options.originView || "explore",
      triggerEl: options.triggerEl || null
    });
  }

  function closeContentDetail(options = {}) {
    _closeContentDetailView({
      restoreFocus: options.restoreFocus !== false
    });
  }

  return {
    init,
    load,
    openContentDetail,
    closeContentDetail
  };
})();

window.ExploreModule = ExploreModule;

function openAddToLibraryModal(eid) {
  const modal = document.getElementById("addFromExploreModal");
  if (!modal) return;

  const normalizedEid = String(eid ?? "").trim();
  if (!normalizedEid) return;

  modal.dataset.eid = normalizedEid;
  modal.classList.add("open");
}

function closeAddFromExploreModal() {
  const modal = document.getElementById("addFromExploreModal");
  if (!modal) return;

  modal.classList.remove("open");
  delete modal.dataset.eid;
}

window.ExploreModule = ExploreModule;
