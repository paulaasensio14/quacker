// assets/js/app/lists.js
// Paso 1: Carga + render usando ApiClient (sin crear/editar aún)

const ListsModule = (() => {
  const t = (key) => window.I18n?.t?.(key) ?? key;

  let allLists = [];
  let visibleLists = [];
  let listsOverviewLibrary = [];
  let currentUserId = "";
  let listsFilter = "all";     // "all" | "public" | "private" | "collab"
  
  let pendingDeleteListId = null;
  let lastDeletedListSnapshot = null;
  let editingListId = null;
  let searchTerm = "";         // texto en minúsculas
  let listsViewMode = "cards"; // "cards" | "list"

  let activeListId = null;
  let __returnToAddToListItemId = null;

  // Filtros del detalle de lista
  let detailSearch = "";         // en minúsculas
  let detailType = "all";        // all | serie | pelicula | book | game
  let detailStatus = "all";      // all | pending | inprogress | completed
  let __detailSearchTimer = null;

  function _getEl(id) {
    return document.getElementById(id);
  }

  function _setHidden(el, hidden) {
    if (!el) return;
    el.hidden = !!hidden;
  }

  function _itemsCount(list) {
    // soporta ambos formatos: itemsCount o items[]
    if (Number.isFinite(list.itemsCount)) return list.itemsCount;
    if (Array.isArray(list.items)) return list.items.length;
    return 0;
  }

  function _safeText(v) {
    return (v ?? "").toString();
  }

  function _safeAttr(v) {
    return _safeText(v)
      .replace(/&/g, "&amp;")
      .replace(/"/g, "&quot;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function _normalizeId(value) {
    return String(value || "").trim();
  }

  async function _ensureCurrentUserId() {
    if (currentUserId) return currentUserId;

    try {
      const session =
        await ApiClient.getCurrentSession();

      currentUserId =
        _normalizeId(session?.user?.id);
    } catch (error) {
      console.error(
        "ListsModule: failed to resolve current user",
        error
      );

      currentUserId = "";
    }

    return currentUserId;
  }


  function _visibilityLabel(v) {
    if (v === "public") return t("lists_visibility_public");
    if (v === "collab") return t("lists_visibility_collab");
    return t("lists_visibility_private");
  }

  function _syncListsToolbarUI() {
    const search = document.getElementById("listsSearch");
    if (search && search.value !== searchTerm) {
      search.value = searchTerm;
    }

    document.querySelectorAll(".pill-filter").forEach((btn) => {
      const isActive = (btn.dataset.filter || "all") === listsFilter;
      btn.classList.toggle("active", isActive);
    });

    document.querySelectorAll("[data-lists-view-mode]").forEach((btn) => {
      const isActive = String(btn.dataset.listsViewMode || "cards") === listsViewMode;
      btn.classList.toggle("active", isActive);
      btn.setAttribute("aria-pressed", isActive ? "true" : "false");
    });

    const grid = _getEl("listsGrid");
    if (grid) {
      grid.classList.toggle("lists-grid--list", listsViewMode === "list");
      grid.classList.toggle("lists-grid--cards", listsViewMode !== "list");
    }
  }

  async function _saveUIState() {
    try {
      await ApiClient.setListsUIState?.({
        visibilityFilter: listsFilter,
        searchTerm,
        listsViewMode,
        detailSearch,
        detailType,
        detailStatus
      });
    } catch (e) {
      console.error("ListsModule: failed to persist UI state", e);
    }
  }

  async function _loadUIState() {
    try {
      const ui = await ApiClient.getListsUIState?.();
      if (!ui || typeof ui !== "object") return;

      listsFilter = typeof ui.visibilityFilter === "string" ? ui.visibilityFilter : "all";
      searchTerm = typeof ui.searchTerm === "string" ? ui.searchTerm : "";
      listsViewMode = ui.listsViewMode === "list" ? "list" : "cards";
      detailSearch = typeof ui.detailSearch === "string" ? ui.detailSearch : "";
      detailType = typeof ui.detailType === "string" ? ui.detailType : "all";
      detailStatus = typeof ui.detailStatus === "string" ? ui.detailStatus : "all";
      _syncListsToolbarUI();
    } catch (e) {
      console.error("ListsModule: failed to load UI state", e);
    }
  }

  function _syncListDetailFiltersUI() {
    const qInput = _getEl("listDetailSearch");
    if (qInput && qInput.value !== detailSearch) {
      qInput.value = detailSearch;
    }

    const typeSel = _getEl("listDetailTypeFilter");
    if (typeSel && typeSel.value !== detailType) {
      typeSel.value = detailType;
    }

    const statusSel = _getEl("listDetailStatusFilter");
    if (statusSel && statusSel.value !== detailStatus) {
      statusSel.value = detailStatus;
    }
  }

  function _setListsOverviewControlsHidden(hidden) {
    const isHidden = !!hidden;
    const listsView = _getEl("view-lists");

    if (listsView) {
      listsView.classList.toggle("is-detail-open", isHidden);
    }

    const overviewControls = [
      _getEl("listsSearch")?.closest(".lists-toolbar"),
      _getEl("listsSearch")?.closest(".search-box"),
      _getEl("countAll")?.closest(".library-pills"),
      _getEl("countAll")?.closest(".lists-filters"),
      document.querySelector("#view-lists .view-toggle"),
      document.querySelector("#view-lists .layout-toggle"),
      document.querySelector("#view-lists [data-lists-layout-toggle]")
    ];

    overviewControls
      .filter(Boolean)
      .forEach((el) => {
        el.hidden = isHidden;
      });
  }

  function _formatCreatedListsCount(total) {
    return total === 1
      ? ` · 1 ${t("lists_count_created_singular")}`
      : ` · ${total} ${t("lists_count_created_plural")}`;
  }

  function _formatItemsCount(count) {
    return count === 1
      ? `1 ${t("lists_item_singular")}`
      : `${count} ${t("lists_item_plural")}`;
  }

  async function _loadListsOverviewLibrary() {
    try {
      const library = await ApiClient.getLibrary();
      listsOverviewLibrary = Array.isArray(library) ? library : [];
    } catch (e) {
      console.error("ListsModule: failed to load library previews", e);
      listsOverviewLibrary = [];
    }
  }

  function _getListPreviewItems(list) {
    const entries =
      Array.isArray(list?.items)
        ? list.items
        : [];

    if (!entries.length) return [];

    return entries
      .map(
        (entry) =>
          _resolveListItemEntry(
            entry,
            listsOverviewLibrary
          )
      )
      .filter((item) => item?.cover)
      .slice(0, 4);
  }

  function _renderListCover(list, count) {
    const previewItems = _getListPreviewItems(list);

    if (!previewItems.length) {
      return `
        <div class="list-cover list-cover--empty" aria-hidden="true">
          <div class="list-cover-empty-mark">☰</div>
          <div class="list-cover-badges">
            <span class="cover-count-pill">${_formatItemsCount(count)}</span>
          </div>
        </div>
      `;
    }

    const covers = previewItems
      .map((item) => `
        <img
          src="${_safeAttr(item.cover)}"
          alt=""
          loading="lazy"
          aria-hidden="true"
        >
      `)
      .join("");

    return `
      <div class="list-cover list-cover--${previewItems.length}" aria-hidden="true">
        <div class="list-cover-collage">
          ${covers}
        </div>

        <div class="list-cover-badges">
          <span class="cover-count-pill">${_formatItemsCount(count)}</span>
        </div>
      </div>
    `;
  }

  function _sleep(ms) {
    return new Promise((res) => setTimeout(res, ms));
  }

  function createListMutationError(result, fallbackReason = "mutation_failed") {
    const reason =
      result?.body?.error ||
      result?.reason ||
      result?.error ||
      fallbackReason;
    const err = new Error(reason);

    err.error = reason;
    err.reason = reason;
    err.body = result?.body || { error: reason };
    err.result = result;

    return err;
  }

  function assertListMutationOk(result, fallbackReason = "mutation_failed") {
    if (result && result.ok !== false) return result;
    throw createListMutationError(result, fallbackReason);
  }

  function assertListWithId(result, fallbackReason = "missing_list_id") {
    const list = assertListMutationOk(result, fallbackReason);
    const listId = _normalizeId(list?.id);

    if (!listId) {
      throw createListMutationError({ ok: false, reason: fallbackReason }, fallbackReason);
    }

    return {
      ...list,
      id: listId
    };
  }

  function _getListItemEntryId(entry) {
    return _normalizeId(typeof entry === "string" ? entry : entry?.id);
  }

  function _resolveListItemEntry(entry, library = []) {
    const entryId =
      _getListItemEntryId(entry);

    if (!entryId) return null;

    const safeLibrary =
      Array.isArray(library)
        ? library
        : [];

    const directMatch =
      safeLibrary.find(
        (item) =>
          _normalizeId(item?.id) ===
          entryId
      );

    if (directMatch) {
      return directMatch;
    }

    if (
      entry &&
      typeof entry === "object" &&
      !Array.isArray(entry)
    ) {
      const getCanonicalContentKey =
        window.ItemIdentity
          ?.getCanonicalContentKey;

      if (
        typeof getCanonicalContentKey ===
        "function"
      ) {
        const entryKey =
          getCanonicalContentKey(entry);

        if (entryKey) {
          const canonicalMatch =
            safeLibrary.find(
              (item) =>
                getCanonicalContentKey(item) ===
                entryKey
            );

          if (canonicalMatch) {
            return canonicalMatch;
          }
        }
      }

      const snapshot =
        entry.itemSnapshot;

      if (
        snapshot &&
        typeof snapshot === "object" &&
        !Array.isArray(snapshot)
      ) {
        const title =
          String(
            snapshot.title || ""
          ).trim();

        if (title) {
          return {
            id: entryId,
            source:
              String(
                entry.source || ""
              ).trim(),
            type:
              String(
                entry.type || ""
              )
                .trim()
                .toLowerCase(),
            externalId:
              String(
                entry.externalId || ""
              ).trim(),
            title,
            cover:
              String(
                snapshot.cover || ""
              ).trim(),
            progress: 0,
            __listSnapshot: true
          };
        }
      }
    }

    return null;
  }

  function _patchListMembership(listId, itemId, action) {
    const normalizedListId = _normalizeId(listId);
    const normalizedItemId = _normalizeId(itemId);
    const normalizedAction = String(action || "").trim();

    if (!normalizedListId || !normalizedItemId) return false;
    if (normalizedAction !== "list_item_added" && normalizedAction !== "list_item_removed") return false;

    const list = (allLists || []).find((entry) => _normalizeId(entry?.id) === normalizedListId);
    if (!list) return false;

    if (!Array.isArray(list.items)) {
      list.items = [];
    }

    const exists = list.items.some((entry) => _getListItemEntryId(entry) === normalizedItemId);
    let didChange = false;

    if (normalizedAction === "list_item_added" && !exists) {
      list.items.push({
        id: normalizedItemId,
        addedAt: new Date().toISOString()
      });
      didChange = true;
    }

    if (normalizedAction === "list_item_removed" && exists) {
      list.items = list.items.filter((entry) => _getListItemEntryId(entry) !== normalizedItemId);
      didChange = true;
    }

    if (!didChange) return false;

    list.itemsCount = list.items.length;
    list.updatedAt = new Date().toISOString();

    return true;
  }

  async function _handleListsItemStateChanged(event) {
    const detail = event?.detail || {};
    if (detail.kind !== "item_state") return;

    const action = String(detail.action || "").trim();
    const listId = _normalizeId(detail.listId);
    const itemId = _normalizeId(detail.itemId);

    const didChange = _patchListMembership(listId, itemId, action);
    if (!didChange) return;

    const isListsActive = document.querySelector("#view-lists")?.classList.contains("is-active");
    if (!isListsActive) return;

    const detailOpen = !_getEl("listDetail")?.hidden && !!activeListId;
    const normalizedActiveListId = _normalizeId(activeListId);

    if (detailOpen && normalizedActiveListId === listId) {
      const activeList = allLists.find((entry) => _normalizeId(entry.id) === normalizedActiveListId);
      if (activeList) {
        _renderActiveListDetailHeader(activeList);
        await renderActiveListItems();
      }
      return;
    }

    render(false);
  }

  function flashListItemCard(itemId) {
    const normalizedItemId = _normalizeId(itemId);
    if (!normalizedItemId) return;

    const safe = (window.CSS && CSS.escape) ? CSS.escape(normalizedItemId) : normalizedItemId;
    const el = document.querySelector(`.list-item-card[data-item-id="${safe}"]`);
    if (!el) return;

    el.classList.remove("is-highlight");
    void el.offsetWidth; // reflow para reiniciar animación
    el.classList.add("is-highlight");

    setTimeout(() => el.classList.remove("is-highlight"), 950);
  }

  function _findListCardById(id) {
    const normalizedId = _normalizeId(id);
    if (!normalizedId) return null;

    // CSS.escape no existe en algunos navegadores viejos, pero aquí casi seguro que sí.
    const safe = (window.CSS && CSS.escape) ? CSS.escape(normalizedId) : normalizedId;
    return document.querySelector(`.list-card[data-id="${safe}"]`);
  }

  function renderListsSkeleton(count = 6) {
    const container = document.querySelector("[data-lists-container]");
    if (!container) return;

    const isListsActive = document.querySelector("#view-lists")?.classList.contains("is-active");
    if (!isListsActive) return;

    container.innerHTML = Array.from({ length: count }).map(() => `
      <article class="list-card list-card--skeleton" aria-hidden="true">
        <div class="list-card-header">
          <div class="list-skel-title"></div>

          <div class="list-card-header-actions">
            <span class="list-skel-pill"></span>
            <span class="list-skel-icon"></span>
            <span class="list-skel-icon"></span>
          </div>
        </div>

        <div class="list-skel-line md"></div>
        <div class="list-skel-line sm"></div>
      </article>
    `).join("");
  }

  async function load() {
    await _loadUIState();
    await _ensureCurrentUserId();
    renderListsSkeleton();

    try {
      allLists = await ApiClient.getLists();
      if (!Array.isArray(allLists)) allLists = [];

      await _loadListsOverviewLibrary();

      visibleLists = [...allLists]; // lo que se muestra
      updateFilterCounts();
      _syncListsToolbarUI();
      applyFilters();

      requestAnimationFrame(() => {
        const isListsActive = document.querySelector("#view-lists")?.classList.contains("is-active");
        if (isListsActive) {
          render(false);
        }
      });

      const detailOpen = !_getEl("listDetail")?.hidden && !!activeListId;
      const normalizedActiveListId = _normalizeId(activeListId);

      if (detailOpen) {
        const activeList = allLists.find((l) => _normalizeId(l.id) === normalizedActiveListId);

        if (!activeList) {
          closeListDetail();
        } else {
          _renderActiveListDetailHeader(activeList);
          await renderActiveListPolls();
          await renderActiveListItems();
        }
      }

      function updateFilterCounts() {
        const cAll = document.getElementById("countAll");
        const cPublic = document.getElementById("countPublic");
        const cPrivate = document.getElementById("countPrivate");
        const cCollab = document.getElementById("countCollab");

        const total = allLists.length;
        const pub = allLists.filter(l => (l.visibility || "private") === "public").length;
        const priv = allLists.filter(l => (l.visibility || "private") === "private").length;
        const col = allLists.filter(l => (l.visibility || "private") === "collab").length;

        if (cAll) cAll.textContent = total;
        if (cPublic) cPublic.textContent = pub;
        if (cPrivate) cPrivate.textContent = priv;
        if (cCollab) cCollab.textContent = col;
      }

    } catch (e) {
      console.error("ListsModule.load error", e);
      allLists = [];
      visibleLists = [];
      render(true);
    }
  }


  function render(hasError = false) {
    const container = document.querySelector("[data-lists-container]");
    if (!container) return;
    const isListsActive = document.querySelector("#view-lists")?.classList.contains("is-active");
    if (!isListsActive) return;

    // ===== Topbar: contador de listas creadas =====
    const subtitleText = document.getElementById("sectionSubtitleText");
    const listsInline = document.getElementById("listsCountInline");
    const libraryInline = document.getElementById("libraryCountInline");

    if (subtitleText && listsInline) {
      const total = allLists.length;
      subtitleText.textContent = t("lists_subtitle");
      listsInline.textContent = _formatCreatedListsCount(total);
      listsInline.classList.remove("is-initially-hidden");
      if (libraryInline) libraryInline.classList.add("is-initially-hidden");
    }

    if (hasError) {
      container.innerHTML = `
        <div class="lib-empty-state">
          <div class="lib-empty-state-card lib-empty-state-card--error" role="status" aria-live="polite">
            <div class="lib-empty-state-icon" aria-hidden="true">!</div>
            <div class="lib-empty-state-title">${t("lists_load_error")}</div>
            <div class="lib-empty-state-actions">
              <button type="button" class="btn btn-primary" id="listsRetryLoadBtn">
                ${t("library_retry")}
              </button>
            </div>
          </div>
        </div>
      `;

      requestAnimationFrame(() => {
        document.getElementById("listsRetryLoadBtn")?.addEventListener("click", () => {
          load();
        });
      });

      return;
    }

    _syncListsToolbarUI();

    if (!visibleLists.length) {
      const isFiltering = listsFilter !== "all" || (searchTerm || "").trim().length > 0;

      container.innerHTML = isFiltering
        ? `
          <div class="lib-empty-state">
            <div class="lib-empty-state-card" role="status" aria-live="polite">
              <h3 class="lib-empty-state-title">${t("lists_empty_filtered")}</h3>
            </div>
          </div>
        `
        : `
          <div class="lib-empty-state">
            <div class="lib-empty-state-card" role="status" aria-live="polite">
              <div class="lib-empty-state-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" class="lib-empty-state-icon-svg">
                  <path d="M7.5 4.75A2.75 2.75 0 0 1 10.25 2h6A2.75 2.75 0 0 1 19 4.75v10.5A2.75 2.75 0 0 1 16.25 18h-6A2.75 2.75 0 0 1 7.5 15.25V4.75Zm2.75-1.25A1.25 1.25 0 0 0 9 4.75v10.5c0 .69.56 1.25 1.25 1.25h6c.69 0 1.25-.56 1.25-1.25V4.75c0-.69-.56-1.25-1.25-1.25h-6Z"/>
                  <path d="M11 7h4.5v1.5H11V7Zm0 3.25h4.5v1.5H11v-1.5Zm0 3.25h3v1.5h-3v-1.5Z"/>
                  <path d="M4 7.75h1.5v8.5H4v-8.5Zm0 10h1.5v1.5H4v-1.5Z"/>
                </svg>
              </div>
              <div class="lib-empty-state-kicker">Quacker</div>
              <h3 class="lib-empty-state-title">${t("lists_empty_initial")}</h3>
              <p class="lib-empty-state-text">${t("lists_subtitle")}</p>
              <div class="lib-empty-state-actions">
                <button type="button" class="btn btn-primary" id="listsEmptyCreateBtn">
                  + ${t("common_create")}
                </button>
              </div>
            </div>
          </div>
        `;

      requestAnimationFrame(() => {
        document.getElementById("listsEmptyCreateBtn")?.addEventListener("click", () => {
          openListModal();
        });
      });

      return;
    }

    _syncListsToolbarUI();

    container.innerHTML = visibleLists
      .map((list) => {
        const name = _safeText(list.name) || t("lists_untitled");
        const desc = _safeText(list.description);
        const count = _itemsCount(list);
        const vis = _visibilityLabel(list.visibility);
        const cover = _renderListCover(list, count);
        const canManageList =
          _normalizeId(list?.ownerUserId) === currentUserId;

        return `

          <article class="list-card" data-id="${_safeText(list.id)}">
            ${cover}

            <div class="list-card-header">

            <h3>${name}</h3>

            <div class="list-card-header-actions">
              <span class="list-visibility">${vis}</span>

              ${
                canManageList ? `              <button
                type="button"
                class="list-edit-btn"
                data-action="edit-list"
                data-id="${_safeText(list.id)}"
                aria-label="${t("lists_edit")}"
                title="${t("lists_edit")}"
              >
                <svg class="icon" width="16" height="16" viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                  <path d="M12 20h9"/>
                  <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z"/>
                </svg>
              </button>

              <button
                type="button"
                class="list-delete-btn"
                data-action="delete-list"
                data-id="${_safeText(list.id)}"
                data-name="${name.replace(/"/g, "&quot;")}"
                aria-label="${t("lists_delete")}"
                title="${t("lists_delete")}"
              >

                <svg class="icon" width="16" height="16" viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                  <path d="M3 6h18"/>
                  <path d="M8 6V4h8v2"/>
                  <path d="M6 6l1 14h10l1-14"/>
                  <path d="M10 11v6"/>
                  <path d="M14 11v6"/>
                </svg>
              </button>
                ` : ""
              }
            </div>
          </div>

          ${desc ? `<p class="list-meta">${desc}</p>` : ""}
          <p class="list-count">
            <strong>${count}</strong> ${count === 1 ? t("lists_item_singular") : t("lists_item_plural")}
          </p>
        </article>
      `;
      })
    .join("");
  }

  function _renderActiveListDetailHeader(list) {
    if (!list) return;

    const titleEl = _getEl("listDetailTitle");
    const visibilityEl = _getEl("listDetailVisibility");
    const descriptionEl = _getEl("listDetailDescription");
    const countEl = _getEl("listDetailCount");

    if (titleEl) titleEl.textContent = _safeText(list.name) || t("lists_untitled");
    if (visibilityEl) visibilityEl.textContent = _visibilityLabel(list.visibility);
    if (descriptionEl) descriptionEl.textContent = _safeText(list.description) || "";

    const count = _itemsCount(list);
    if (countEl) {
      countEl.textContent = _formatItemsCount(count);
    }
  }

  async function openListDetail(listId) {
    const normalizedListId = _normalizeId(listId);
    if (!normalizedListId) return;

    activeListId = normalizedListId;

    const list = allLists.find(l => _normalizeId(l.id) === activeListId);
    if (!list) return;

    const detail = _getEl("listDetail");
    const grid = _getEl("listsGrid");

    // Ocultamos grid, mostramos detalle
    _setHidden(grid, true);
    _setHidden(detail, false);
    _setListsOverviewControlsHidden(true);

    _renderActiveListDetailHeader(list);
    _syncListDetailFiltersUI();

    const showing2 = _getEl("listDetailShowing");
    if (showing2) showing2.textContent = "";

    await renderActiveListPolls();
    await renderActiveListItems();
  }

  function closeListDetail() {
    activeListId = null;

    const detail = _getEl("listDetail");
    const grid = _getEl("listsGrid");

    _setHidden(detail, true);
    _setHidden(grid, false);
    _setListsOverviewControlsHidden(false);
  }

  function _typeLabel(tpe){
    if (tpe === "serie") return t("library_type_series");
    if (tpe === "pelicula") return t("library_type_movie");
    if (tpe === "book") return t("library_type_book");
    if (tpe === "game") return t("library_type_game");
    return t("lists_type_content");
  }

  function _progressLabel(pct){
    const n = Number(pct ?? 0);
    if (n >= 100) return t("library_status_completed");
    if (n <= 0) return t("library_status_not_started");
    return `${n}%`;
  }

  function _typeIconSvg(type) {
    if (type === "serie") {
      return `
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"
          aria-hidden="true" focusable="false">
          <rect x="3" y="4" width="18" height="14" rx="2"></rect>
          <path d="M8 20h8"></path>
          <path d="M12 18v2"></path>
        </svg>
      `;
    }

    if (type === "pelicula") {
      return `
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"
          aria-hidden="true" focusable="false">
          <rect x="3" y="5" width="18" height="14" rx="2"></rect>
          <path d="M7 5v14"></path>
          <path d="M17 5v14"></path>
          <path d="M3 9h4"></path>
          <path d="M3 15h4"></path>
          <path d="M17 9h4"></path>
          <path d="M17 15h4"></path>
        </svg>
      `;
    }

    if (type === "book") {
      return `
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"
          aria-hidden="true" focusable="false">
          <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v16H6.5A2.5 2.5 0 0 0 4 21.5v-16Z"></path>
          <path d="M4 19a2.5 2.5 0 0 1 2.5-2.5H20"></path>
        </svg>
      `;
    }

    if (type === "game") {
      return `
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"
          aria-hidden="true" focusable="false">
          <path d="M6 12h4"></path>
          <path d="M8 10v4"></path>
          <path d="M15 13h.01"></path>
          <path d="M18 11h.01"></path>
          <path d="M7 7h10a4 4 0 0 1 3.9 3.1l1 4.5a3 3 0 0 1-5 2.8L15 15H9l-1.9 2.4a3 3 0 0 1-5-2.8l1-4.5A4 4 0 0 1 7 7Z"></path>
        </svg>
      `;
    }

    return `
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none"
        stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"
        aria-hidden="true" focusable="false">
        <circle cx="12" cy="12" r="8"></circle>
      </svg>
    `;
  }

  async function renderActiveListPolls() {
    const container =
      _getEl("listDetailPollsList");

    const pollsSection =
      _getEl("listDetailPolls");

    if (!container) return;

    const list =
      allLists.find(
        (entry) =>
          _normalizeId(entry?.id) ===
          _normalizeId(activeListId)
      );

    if (!list) {
      if (pollsSection) {
        pollsSection.hidden = true;
      }

      container.innerHTML = "";
      return;
    }

    if (list.visibility !== "collab") {
      if (pollsSection) {
        pollsSection.hidden = true;
      }

      container.innerHTML = "";
      return;
    }

    if (pollsSection) {
      pollsSection.hidden = false;
    }

    const polls =
      Array.isArray(list.polls)
        ? list.polls
        : [];

    if (!polls.length) {
      container.innerHTML =
        `<p class="list-polls-empty">${t("lists_poll_empty")}</p>`;
      return;
    }

    container.innerHTML =
      polls
        .map((poll) => {
          const pollId =
            _safeAttr(poll?.id);

          const title =
            _safeAttr(
              poll?.title ||
              t("lists_poll_untitled")
            );

          const options =
            Array.isArray(poll?.options)
              ? poll.options
              : [];

          const closed =
            !!String(
              poll?.closedAt || ""
            ).trim();

          const isListOwner = _normalizeId(list?.ownerUserId) === currentUserId;
          const isPollCreator = _normalizeId(poll?.createdByUserId) === currentUserId;
          const canClosePoll = !closed && (isListOwner || isPollCreator);

          const ownVotes =
            Array.isArray(
              poll?.votesByUserId?.[currentUserId]
            )
              ? poll.votesByUserId[currentUserId]
              : [];

          const inputType =
            poll?.allowMultipleVotes
              ? "checkbox"
              : "radio";

          const optionsMarkup =
            options
              .map((option) => {
                const contentKey =
                  _safeAttr(
                    option?.contentKey
                  );

                const optionTitle =
                  _safeAttr(
                    option?.itemSnapshot
                      ?.title ||
                    option?.contentKey
                  );

                const checked =
                  ownVotes.includes(
                    option?.contentKey
                  );

                return `
                  <li
                    class="list-poll-option"
                    data-content-key="${contentKey}"
                  >
                    <label class="list-poll-option-label">
                      <input
                        type="${inputType}"
                        name="listPollVote-${pollId}"
                        value="${contentKey}"
                        data-poll-option-key="${contentKey}"
                        ${checked ? "checked" : ""}
                        ${closed ? "disabled" : ""}
                      />
                      <span>${optionTitle}</span>
                    </label>
                  </li>
                `;
              })
              .join("");

          return `
            <article
              class="list-poll-card"
              data-poll-id="${pollId}"
            >
              <div class="list-poll-card-head">
                <h4 class="list-poll-card-title">
                  ${title}
                </h4>

                <span
                  class="list-poll-status"
                  data-poll-closed="${closed ? "1" : "0"}"
                >
                  ${closed ? t("lists_poll_status_closed") : t("lists_poll_status_open")}
                </span>
              </div>

              <ul class="list-poll-options">
                ${optionsMarkup}
              </ul>

              ${
                closed
                  ? ""
                  : `
                    <button
                      type="button"
                      class="btn-secondary list-poll-vote-save"
                      data-action="save-poll-vote"
                      data-poll-id="${pollId}"
                    >
                      ${t("lists_poll_save_vote")}
                    </button>
                  `
              }

              ${
                canClosePoll
                  ? `
                    <button
                      type="button"
                      class="btn-secondary list-poll-close"
                      data-action="close-poll"
                      data-poll-id="${pollId}"
                    >
                      ${t("lists_poll_close")}
                    </button>
                  `
                  : ""
              }

              <button
                type="button"
                class="btn-secondary list-poll-results-button"
                data-action="show-poll-results"
                data-poll-id="${pollId}"
              >
                ${t("lists_poll_show_results")}
              </button>

              <div
                class="list-poll-results"
                data-poll-results-for="${pollId}"
                aria-live="polite"
              ></div>
            </article>
          `;
        })
        .join("");
  }


  async function renderActiveListItems(){
    const grid = _getEl("listDetailItemsGrid");
    const empty = _getEl("listDetailEmpty");
    const error = _getEl("listDetailError");
    const hint = _getEl("listDetailHint");
    if (!grid || !empty || !error) return;

    const list = allLists.find(l => _normalizeId(l.id) === _normalizeId(activeListId));
    if (!list){
      grid.innerHTML = "";
      error.hidden = true;
      error.classList.add("is-initially-hidden");
      empty.classList.remove("is-initially-hidden");
      empty.textContent = t("lists_detail_empty");
      if (hint) hint.textContent = "";
      return;
    }

    const ids = Array.isArray(list.items)
      ? list.items.map((x) => _getListItemEntryId(x)).filter(Boolean)
      : [];

    if (!ids.length){
      grid.innerHTML = "";
      error.hidden = true;
      error.classList.add("is-initially-hidden");
      empty.classList.remove("is-initially-hidden");
      empty.textContent = t("lists_detail_empty");
      if (hint) hint.textContent = "";
      return;
    }

    empty.classList.add("is-initially-hidden");
    error.hidden = true;
    error.classList.add("is-initially-hidden");
    if (hint) hint.textContent = t("lists_detail_hint");

    // Cargamos biblioteca para resolver ids -> datos reales
    let library = [];
    try{
      library = await ApiClient.getLibrary();
    }catch(e){
      console.error(e);
      grid.innerHTML = "";
      empty.classList.add("is-initially-hidden");
      error.hidden = false;
      error.classList.remove("is-initially-hidden");
      if (hint) hint.textContent = "";

      const showing = _getEl("listDetailShowing");
      if (showing) showing.textContent = "";

      return;
    }

    const items =
      (Array.isArray(list.items) ? list.items : [])
        .map(
          (entry) =>
            _resolveListItemEntry(
              entry,
              library
            )
        )
        .filter(Boolean);

    // Aplicar filtros (búsqueda / tipo / estado)
    const q = String(detailSearch || "").trim().toLowerCase();

    const filtered = (items || []).filter((it) => {
      // Search por título
      if (q) {
        const t = String(it?.title || "").toLowerCase();
        if (!t.includes(q)) return false;
      }

      // Tipo
      if (detailType !== "all") {
        if (String(it?.type || "") !== detailType) return false;
      }

      // Estado por progreso
      if (detailStatus !== "all") {
        const p = Number(it?.progress ?? 0);
        const pending = p <= 0;
        const completed = p >= 100;
        const inprogress = p > 0 && p < 100;

        if (detailStatus === "pending" && !pending) return false;
        if (detailStatus === "inprogress" && !inprogress) return false;
        if (detailStatus === "completed" && !completed) return false;
      }

      return true;
    });

    // “Mostrando X de Y”
    const showing = _getEl("listDetailShowing");
    if (showing) {
      showing.textContent = t("lists_detail_showing")
        .replace("{shown}", filtered.length)
        .replace("{total}", items.length);
    }

    // Si hay items en la lista pero los filtros no devuelven resultados
    if (!filtered.length) {
      grid.innerHTML = "";
      empty.classList.remove("is-initially-hidden");
      empty.textContent = t("lists_detail_empty_filtered");
      if (hint) hint.textContent = "";
      return;
    }

    grid.innerHTML = filtered.map((it) => {
      const cover = _safeAttr(it.cover);
      const coverMarkup = cover
        ? `<img class="list-item-cover-image" src="${cover}" alt="" loading="lazy" decoding="async">`
        : "";
      const title = _safeText(it.title) || t("lists_item_untitled");
      const type = _typeLabel(it.type);
      const rawProgress = Number(it.progress ?? 0);
      const progressValue = Number.isFinite(rawProgress)
        ? Math.max(0, Math.min(100, rawProgress))
        : 0;
      const prog = _progressLabel(progressValue);
      const canUndo =
        it?.__listSnapshot !== true;
      const itemSource =
        _safeAttr(it?.source);
      const itemType =
        _safeAttr(it?.type);
      const itemExternalId =
        _safeAttr(it?.externalId);

      return `
        <article class="list-item-card" data-item-id="${_safeText(it.id)}">
          <div class="list-item-cover">
            ${coverMarkup}
            <span class="list-item-type-badge" aria-label="${type}" title="${type}">
              ${_typeIconSvg(it.type)}
            </span>

            <progress
              class="lib-cover-progress"
              value="${progressValue}"
              max="100"
              aria-label="${_safeAttr(prog)}"
            ></progress>
          </div>

          <div class="list-item-body">
            <div class="list-item-title">${title}</div>

            <div class="list-item-actions">
              <button
                type="button"
                class="list-item-remove"
                data-action="remove-from-list"
                data-item-id="${_safeAttr(it.id)}"
                data-can-undo="${canUndo ? "1" : "0"}"
                data-item-source="${itemSource}"
                data-item-type="${itemType}"
                data-item-external-id="${itemExternalId}"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                     stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"
                     aria-hidden="true" focusable="false">
                  <path d="M3 6h18"/>
                  <path d="M8 6V4h8v2"/>
                  <path d="M6 6l1 14h10l1-14"/>
                  <path d="M10 11v6"/>
                  <path d="M14 11v6"/>
                </svg>
                ${t("lists_remove")}
              </button>
            </div>
          </div>
        </article>
      `;
    }).join("");
  }

  async function removeItemFromActiveList(
    itemId,
    {
      canUndo = true,
      source = "",
      type = "",
      externalId = ""
    } = {}
  ){
    if (!activeListId || !itemId) return;

    const listId = _normalizeId(activeListId);
    const id = _normalizeId(itemId);
    if (!listId || !id) return;

    const getCanonicalContentKey =
      window.ItemIdentity
        ?.getCanonicalContentKey;

    const targetCanonicalKey =
      typeof getCanonicalContentKey === "function"
        ? getCanonicalContentKey({
            source,
            type,
            externalId
          })
        : "";

    // Animación de salida (optimista)
    const card = document.querySelector(
      `.list-item-card[data-item-id="${(window.CSS && CSS.escape) ? CSS.escape(id) : id}"]`
    );

    if (card){
      if (card.dataset.busy === "1") return;
      card.dataset.busy = "1";
      card.classList.add("is-leaving");
      await _sleep(160);
    }

    try{
      assertListMutationOk(
        await ApiClient.removeLibraryItemFromList(listId, id),
        "remove_failed"
      );

      // Actualizamos estado en memoria (sin tocar DOM manualmente)
      const listRef = (allLists || []).find(l => _normalizeId(l.id) === listId);
      if (listRef && Array.isArray(listRef.items)) {
        listRef.items = listRef.items.filter((x) => {
          const entryId =
            typeof x === "string"
              ? x
              : x?.id;

          if (
            _normalizeId(entryId) === id
          ) {
            return false;
          }

          if (
            !targetCanonicalKey ||
            typeof x === "string" ||
            !x ||
            typeof x !== "object" ||
            typeof getCanonicalContentKey !== "function"
          ) {
            return true;
          }

          const entryCanonicalKey =
            getCanonicalContentKey(x);

          return (
            !entryCanonicalKey ||
            entryCanonicalKey !==
              targetCanonicalKey
          );
        });

        listRef.itemsCount = listRef.items.length;
        listRef.updatedAt = new Date().toISOString();
      }

      // Repintamos el detalle para reflejar el cambio al instante
      await renderActiveListItems();

      window.toast?.({
        title: t("lists_remove_success_title"),
        message: t("lists_remove_success_text"),
        type: "success",
        duration: 5200,
        actionLabel:
          canUndo
            ? t("lists_undo")
            : null,
        onAction: canUndo ? async () => {
          try{
            assertListMutationOk(
              await ApiClient.addLibraryItemToList(listId, id),
              "undo_failed"
            );

            window.toast?.({
              title: t("lists_undo_success_title"),
              message: t("lists_undo_success_text"),
              type: "success",
              duration: 2400
            });

            // Estado en memoria + repintado instantáneo del detalle
            const listRef = (allLists || []).find(l => _normalizeId(l.id) === listId);
            if (listRef && Array.isArray(listRef.items)) {
              // Evitar duplicados si el usuario deshace dos veces rápido
              const exists = listRef.items.some((x) => {
                const entryId = typeof x === "string" ? x : x?.id;
                return _normalizeId(entryId) === id;
              });

              if (!exists) {
                listRef.items.push({
                  id,
                  addedAt: new Date().toISOString()
                });
              }

              listRef.itemsCount = listRef.items.length;
              listRef.updatedAt = new Date().toISOString();
            }

            await renderActiveListItems();
            flashListItemCard(id);
          }catch(e){
            console.error(e);
            window.toast?.({
              title: t("lists_undo_error_title"),
              message: t("lists_undo_error_text"),
              type: "error",
              duration: 3200
            });
          }
        } : null
      });

      // Nota: no sincronizamos LibraryUI ni disparamos events manuales.
      // ApiClient emite quacker:data-changed y app-core coordina el resto.

    }catch(e){
      console.error(e);

      window.toast?.({
        title: t("lists_remove_error_title"),
        message: t("lists_remove_error_text"),
        type: "error",
        duration: 3200
      });

      // Si falló, re-render para asegurar estado consistente
      await renderActiveListItems();
    }
  }

  function applyFilters() {
    const term = (searchTerm || "").trim().toLowerCase();

    visibleLists = allLists.filter((l) => {
      // filtro por visibilidad
      if (listsFilter !== "all" && l.visibility !== listsFilter) return false;

      // filtro por búsqueda
      if (!term) return true;

      const name = (l.name || "").toLowerCase();
      const desc = (l.description || "").toLowerCase();
      const tags = Array.isArray(l.tags) ? l.tags.join(" ").toLowerCase() : "";

      return name.includes(term) || desc.includes(term) || tags.includes(term);
    });

    render();
  }

  function openListPollModal() {
    const modal =
      document.getElementById("listPollModal");

    const optionsContainer =
      document.getElementById("lpm_options");

    if (!modal || !optionsContainer) return;

    const listId =
      _normalizeId(activeListId);

    const list =
      (allLists || []).find(
        (entry) =>
          _normalizeId(entry?.id) === listId
      );

    if (!list) return;

    if (list.visibility !== "collab") {
      return;
    }

    const titleInput =
      document.getElementById("lpm_title");

    const multipleInput =
      document.getElementById("lpm_multiple");

    const deadlineInput =
      document.getElementById("lpm_deadline");

    const errors =
      document.getElementById("listPollModalErrors");

    if (titleInput) titleInput.value = "";
    if (multipleInput) multipleInput.checked = false;
    if (deadlineInput) deadlineInput.value = "";

    if (errors) {
      errors.textContent = "";
      errors.classList.add("is-initially-hidden");
    }

    const getCanonicalContentKey =
      window.ItemIdentity
        ?.getCanonicalContentKey;

    const seenContentKeys =
      new Set();

    const options =
      (Array.isArray(list.items) ? list.items : [])
        .map(
          (entry) =>
            _resolveListItemEntry(
              entry,
              listsOverviewLibrary
            )
        )
        .filter(Boolean)
        .map((item) => {
          const contentKey =
            typeof getCanonicalContentKey === "function"
              ? getCanonicalContentKey(item)
              : "";

          return {
            item,
            contentKey:
              String(contentKey || "").trim()
          };
        })
        .filter(({ contentKey }) => {
          if (
            !contentKey ||
            seenContentKeys.has(contentKey)
          ) {
            return false;
          }

          seenContentKeys.add(contentKey);
          return true;
        });

    optionsContainer.innerHTML =
      options.length
        ? options
            .map(({ item, contentKey }) => {
              const title =
                _safeAttr(
                  item?.title ||
                  contentKey
                );

              return `
                <label class="list-poll-modal-option">
                  <input
                    type="checkbox"
                    name="listPollOption"
                    value="${_safeAttr(contentKey)}"
                  />
                  <span>${title}</span>
                </label>
              `;
            })
            .join("")
        : `<p class="list-polls-empty">${t("lists_poll_modal_no_options")}</p>`;

    window.UIModal?.open(modal, {
      initialFocusSelector: "#lpm_title"
    });
  }


  async function saveListPollFromModal() {
    const listId =
      _normalizeId(activeListId);

    if (!listId) return;

    const modal =
      document.getElementById("listPollModal");

    const titleInput =
      document.getElementById("lpm_title");

    const errors =
      document.getElementById("listPollModalErrors");

    const saveBtn =
      document.getElementById("saveListPollModal");

    const cancelBtn =
      document.getElementById("cancelListPollModal");

    const closeBtn =
      document.getElementById("closeListPollModal");

    const title =
      String(titleInput?.value || "")
        .replace(/\s+/g, " ")
        .trim();

    if (titleInput && titleInput.value !== title) {
      titleInput.value = title;
    }

    const optionContentKeys =
      Array.from(
        document.querySelectorAll(
          'input[name="listPollOption"]:checked'
        )
      )
        .map((input) =>
          String(input.value || "").trim()
        )
        .filter(Boolean);

    const allowMultipleVotes =
      document.getElementById("lpm_multiple")?.checked === true;

    const deadlineRaw =
      String(
        document.getElementById("lpm_deadline")?.value || ""
      ).trim();

    let deadlineAt = null;

    const showError = (message) => {
      if (!errors) return;
      errors.textContent = message;
      errors.classList.remove("is-initially-hidden");
    };

    if (errors) {
      errors.textContent = "";
      errors.classList.add("is-initially-hidden");
    }

    if (!title) {
      showError(t("lists_poll_modal_title_required"));
      titleInput?.focus?.();
      return;
    }

    if (title.length > 120) {
      showError(t("lists_poll_modal_title_too_long"));
      titleInput?.focus?.();
      return;
    }

    if (optionContentKeys.length < 2) {
      showError(t("lists_poll_modal_min_options"));
      return;
    }

    if (deadlineRaw) {
      try {
        deadlineAt =
          new Date(deadlineRaw).toISOString();
      } catch {
        showError(t("lists_poll_modal_invalid_deadline"));
        return;
      }
    }

    const prevHtml =
      saveBtn?.innerHTML || t("common_create");

    if (saveBtn) {
      if (saveBtn.dataset.busy === "1") return;

      saveBtn.disabled = true;
      saveBtn.dataset.busy = "1";
      saveBtn.textContent = t("lists_poll_creating");
    }

    if (cancelBtn) cancelBtn.disabled = true;
    if (closeBtn) closeBtn.disabled = true;

    try {
      await ApiClient.createListPoll(
        listId,
        {
          title,
          optionContentKeys,
          allowMultipleVotes,
          deadlineAt
        }
      );

      window.UIModal?.close(modal);

      await load();
      await openListDetail(listId);
    } catch (error) {
      console.error(error);

      const code =
        error?.body?.error ||
        error?.error ||
        error?.reason ||
        "";

      if (code === "missing_poll_title") {
        showError(t("lists_poll_modal_title_required"));
      } else if (code === "poll_title_too_long") {
        showError(t("lists_poll_modal_title_too_long"));
      } else if (
        code === "invalid_poll_option" ||
        code === "invalid_poll_options"
      ) {
        showError(t("lists_poll_modal_invalid_options"));
      } else if (code === "invalid_poll_deadline") {
        showError(t("lists_poll_modal_invalid_deadline"));
      } else {
        showError(t("lists_poll_modal_create_error"));
      }
    } finally {
      if (saveBtn) {
        saveBtn.disabled = false;
        saveBtn.dataset.busy = "0";
        saveBtn.innerHTML = prevHtml;
      }

      if (cancelBtn) cancelBtn.disabled = false;
      if (closeBtn) closeBtn.disabled = false;
    }
  }


  function openListModal(listId = null) {
    const modal = document.getElementById("listModal");
    if (!modal) return;

    const titleEl = document.getElementById("listModalTitle");
    const saveBtn = document.getElementById("saveListModal");

    hideListErrors();

    const normalizedListId = _normalizeId(listId);

    if (normalizedListId) {

      // MODO EDITAR
      editingListId = normalizedListId;
      const list = allLists.find(l => _normalizeId(l.id) === editingListId);

      if (!list) return;
      if (titleEl) titleEl.textContent = t("lists_modal_edit_title");
      if (saveBtn) saveBtn.textContent = t("common_save");

      document.getElementById("lm_name").value = list.name || "";
      document.getElementById("lm_desc").value = list.description || "";

      const visibilitySelect = document.getElementById("lm_visibility");
      if (visibilitySelect) {
        visibilitySelect.value = "private";
        visibilitySelect.disabled = true;
      }

    } else {

      // MODO CREAR
      editingListId = null;

      if (titleEl) titleEl.textContent = t("lists_modal_create_title");
      if (saveBtn) saveBtn.textContent = t("common_create");

      document.getElementById("lm_name").value = "";
      document.getElementById("lm_desc").value = "";

      const visibilitySelect = document.getElementById("lm_visibility");
      if (visibilitySelect) {
        visibilitySelect.value = "private";
        visibilitySelect.disabled = true;
      }
    }

    window.UIModal?.open(modal, { initialFocusSelector: "#lm_name" });
  }


  function closeListModal() {
    const modal = document.getElementById("listModal");
    if (!modal) return;

    window.UIModal?.close(modal);
    editingListId = null;
  }

  function showListErrors(msg) {
    const box = document.getElementById("listModalErrors");
    if (!box) return;
    box.classList.remove("is-initially-hidden");
    box.textContent = msg;
  }

  function hideListErrors() {
    const box = document.getElementById("listModalErrors");
    if (!box) return;
    box.classList.add("is-initially-hidden");
    box.textContent = "";
  }

  function getListModalErrorMessage(err) {
    const code = err?.body?.error || err?.error || err?.reason || "";

    if (code === "missing_name") return t("lists_modal_name_required");
    if (code === "name_too_short") return t("lists_modal_name_too_short");
    if (code === "name_too_long") return t("lists_modal_name_too_long");
    if (code === "invalid_visibility") return t("lists_modal_invalid_visibility");
    if (code === "not_found") return t("lists_modal_not_found");

    return t("lists_modal_save_error");
  }

  async function saveListFromModal() {
    const nameInput = document.getElementById("lm_name");
    const name = (nameInput?.value || "").replace(/\s+/g, " ").trim();
    const description = (document.getElementById("lm_desc")?.value || "").trim();
    const visibility = "private";

    if (nameInput && nameInput.value !== name) {
      nameInput.value = name;
    }

    if (!name) {
      showListErrors(t("lists_modal_name_required"));
      nameInput?.focus?.();
      return;
    }

    if (name.length < 2) {
      showListErrors(t("lists_modal_name_too_short"));
      nameInput?.focus?.();
      return;
    }

    if (name.length > 80) {
      showListErrors(t("lists_modal_name_too_long"));
      nameInput?.focus?.();
      return;
    }

    const saveBtn = document.getElementById("saveListModal");
    const cancelBtn = document.getElementById("cancelListModal");
    const closeBtn = document.getElementById("closeListModal");
    const prevHtml = saveBtn?.innerHTML || (editingListId ? t("common_save") : t("common_create"));

    if (saveBtn) {
      // Evitar doble click.
      if (saveBtn.dataset.busy === "1") return;
      saveBtn.disabled = true;
      saveBtn.dataset.busy = "1";
      saveBtn.innerHTML = `  ${t("lists_modal_saving")} `;
    }

    if (cancelBtn) cancelBtn.disabled = true;
    if (closeBtn) closeBtn.disabled = true;

    try {
      if (editingListId) {
        assertListMutationOk(
          await ApiClient.updateList(editingListId, { name, description, visibility }),
          "update_failed"
        );
      } else {
        const created = assertListWithId(
          await ApiClient.createList({ name, description, visibility, items: [] }),
          "create_failed"
        );

        if (__returnToAddToListItemId) {
          const createdListId = _normalizeId(created.id);
          const returnItemId = _normalizeId(__returnToAddToListItemId);

          document.dispatchEvent(new CustomEvent("quacker:lists-created", {
            detail: { listId: createdListId, returnToAddToListItemId: returnItemId }
          }));
          __returnToAddToListItemId = null;
        }
      }

      closeListModal();
      await load();
    } catch (e) {
      console.error(e);
      showListErrors(getListModalErrorMessage(e));
    } finally {
      if (saveBtn) {
        saveBtn.disabled = false;
        saveBtn.dataset.busy = "0";
        saveBtn.innerHTML = prevHtml;
      }
      if (cancelBtn) cancelBtn.disabled = false;
      if (closeBtn) closeBtn.disabled = false;
    }
  }

  function _showConfirmDeleteErrors(msg) {
    const box = document.getElementById("confirmDeleteListErrors");
    if (!box) return;
    box.classList.toggle("is-initially-hidden", !msg);
    box.textContent = msg || "";
  }

  async function saveListPollVote(pollId) {
    const listId =
      _normalizeId(activeListId);

    const safePollId =
      _normalizeId(pollId);

    if (!listId || !safePollId) return;

    const container =
      document.getElementById("listDetailPollsList");

    if (!container) return;

    const pollCard =
      Array.from(
        container.querySelectorAll(
          ".list-poll-card"
        )
      ).find(
        (card) =>
          _normalizeId(card?.dataset?.pollId) ===
          safePollId
      );

    if (!pollCard) return;

    const button =
      pollCard.querySelector(
        '[data-action="save-poll-vote"]'
      );

    if (!button) return;

    if (button.dataset.busy === "1") return;

    const contentKeys =
      Array.from(
        pollCard.querySelectorAll(
          'input[data-poll-option-key]:checked'
        )
      )
        .map((input) =>
          String(
            input.dataset.pollOptionKey || ""
          ).trim()
        )
        .filter(Boolean);

    const previousText =
      button.textContent;

    button.dataset.busy = "1";
    button.disabled = true;
    button.textContent = t("lists_poll_saving");

    try {
      await ApiClient.voteListPoll(
        listId,
        safePollId,
        contentKeys
      );

      await load();
      await openListDetail(listId);
    } catch (error) {
      console.error(
        "ListsModule: failed to save poll vote",
        error
      );

      button.disabled = false;
      button.dataset.busy = "0";
      button.textContent =
        previousText || t("lists_poll_save_vote");
    }
  }


  async function loadListPollResults(pollId) {
    const listId = _normalizeId(activeListId);
    const safePollId = _normalizeId(pollId);

    if (!listId || !safePollId) return;

    const container =
      document.getElementById("listDetailPollsList");

    if (!container) return;

    const pollCard =
      Array.from(
        container.querySelectorAll(
          ".list-poll-card"
        )
      ).find(
        (card) =>
          _normalizeId(card?.dataset?.pollId) ===
          safePollId
      );

    if (!pollCard) return;

    const resultsBox =
      Array.from(
        pollCard.querySelectorAll(
          "[data-poll-results-for]"
        )
      ).find(
        (element) =>
          _normalizeId(
            element?.dataset?.pollResultsFor
          ) === safePollId
      );

    const button =
      pollCard.querySelector(
        '[data-action="show-poll-results"]'
      );

    if (!resultsBox || !button) return;
    if (button.dataset.busy === "1") return;

    const previousText =
      button.textContent;

    button.dataset.busy = "1";
    button.disabled = true;
    button.textContent = t("lists_poll_loading");
    resultsBox.textContent = "";

    try {
      const response =
        await ApiClient.getListPollResults(
          listId,
          safePollId
        );

      const results =
        response?.results || {};

      const resultPoll =
        response?.poll || {};

      const totalVotes =
        Number(results.totalVotes) || 0;

      const counts =
        results.counts &&
        typeof results.counts === "object"
          ? results.counts
          : {};

      const winnerContentKey =
        _normalizeId(
          results.winnerContentKey
        );

      const tied =
        results.tied === true;

      const options =
        Array.isArray(resultPoll?.options)
          ? resultPoll.options
          : [];

      const rows =
        options
          .map((option) => {
            const optionKey =
              _normalizeId(
                option?.contentKey
              );

            const optionTitle =
              _safeAttr(
                option?.itemSnapshot?.title ||
                optionKey
              );

            const votes =
              Number(counts[optionKey]) || 0;

            const isWinner =
              !!winnerContentKey &&
              optionKey === winnerContentKey;

            return `
              <li class="list-poll-result-row">
                <span>${optionTitle}</span>
                <strong>${votes}</strong>
                ${isWinner ? '<span class="list-poll-winner">' + t("lists_poll_winner") + '</span>' : ""}
              </li>
            `;
          })
          .join("");

      const outcome =
        winnerContentKey
          ? t("lists_poll_result_has_winner")
          : tied
            ? t("lists_poll_result_tied")
            : t("lists_poll_result_no_winner");

      resultsBox.innerHTML = `
        <div class="list-poll-results-summary">
          <strong>${t("lists_poll_results_total").replace("{count}", String(totalVotes))}</strong>
          <span>${outcome}</span>
        </div>
        <ul class="list-poll-results-list">
          ${rows}
        </ul>
      `;
    } catch (error) {
      console.error(
        "ListsModule: failed to load poll results",
        error
      );

      resultsBox.textContent =
        t("lists_poll_results_error");
    } finally {
      button.dataset.busy = "0";
      button.disabled = false;
      button.textContent =
        previousText || t("lists_poll_show_results");
    }
  }


  async function closeListPollFromDetail(pollId) {
    const listId = _normalizeId(activeListId);
    const safePollId = _normalizeId(pollId);

    if (!listId || !safePollId) return;

    const container =
      document.getElementById("listDetailPollsList");

    if (!container) return;

    const pollCard =
      Array.from(
        container.querySelectorAll(
          ".list-poll-card"
        )
      ).find(
        (card) =>
          _normalizeId(card?.dataset?.pollId) ===
          safePollId
      );

    if (!pollCard) return;

    const button =
      pollCard.querySelector(
        '[data-action="close-poll"]'
      );

    if (!button) return;
    if (button.dataset.busy === "1") return;

    const previousText =
      button.textContent;

    button.dataset.busy = "1";
    button.disabled = true;
    button.textContent = t("lists_poll_closing");

    try {
      await ApiClient.closeListPoll(
        listId,
        safePollId
      );

      await load();
      await openListDetail(listId);
    } catch (error) {
      console.error(
        "ListsModule: failed to close poll",
        error
      );

      button.disabled = false;
      button.dataset.busy = "0";
      button.textContent =
        previousText || t("lists_poll_close");
    }
  }


  function openConfirmDeleteListModal() {
    const modal = document.getElementById("confirmDeleteListModal");
    if (!modal) return;

    _showConfirmDeleteErrors("");
    window.UIModal?.open(modal, { initialFocusSelector: "#confirmDeleteList" });
  }

  function closeConfirmDeleteListModal() {
    const modal = document.getElementById("confirmDeleteListModal");
    if (!modal) return;

    window.UIModal?.close(modal);
    pendingDeleteListId = null;
    _showConfirmDeleteErrors("");
  }

  function init() {

    // Bind modales (una sola fuente de verdad: UIModal)
    window.UIModal?.bind("listModal", {
      closeSelectors: ["#closeListModal", "#cancelListModal"],
      initialFocusSelector: "#lm_name",
      closeOnBackdrop: true
    });

    window.UIModal?.bind("listPollModal", {
      closeSelectors: [
        "#closeListPollModal",
        "#cancelListPollModal"
      ],
      initialFocusSelector: "#lpm_title",
      closeOnBackdrop: true
    });

    window.UIModal?.bind("confirmDeleteListModal", {
      closeSelectors: ["#closeConfirmDeleteList", "#cancelDeleteList"],
      initialFocusSelector: "#confirmDeleteList",
      closeOnBackdrop: true
    });

    const search = document.getElementById("listsSearch");
    if (search) {
      search.addEventListener("input", () => {
        searchTerm = search.value;
        applyFilters();
        _saveUIState();
      });
    }

    document.addEventListener("quacker:view-change", (e) => {
      const viewId = e.detail?.viewId;

      // Cuando entramos en "lists", recargamos y pintamos
      if (viewId === "lists") {
        _loadUIState().then(() => load()).catch(console.error);
        return;
      }

      // Cuando salimos de "lists", ocultamos el contador de listas
      const subtitleText = document.getElementById("sectionSubtitleText");
      const listsInline = document.getElementById("listsCountInline");

      if (listsInline) listsInline.classList.add("is-initially-hidden");
      if (subtitleText) subtitleText.textContent = t("home_summary");
    });

    document.addEventListener("quacker:lang-change", async () => {
      const isListsActive = document.querySelector("#view-lists")?.classList.contains("is-active");
      if (!isListsActive) return;

      render(false);

      const detailOpen = !_getEl("listDetail")?.hidden && !!activeListId;
      if (detailOpen) {
        const normalizedActiveListId = _normalizeId(activeListId);
        const activeList = allLists.find((l) => _normalizeId(l.id) === normalizedActiveListId);
        if (activeList) {
          _renderActiveListDetailHeader(activeList);
          await renderActiveListPolls();
          await renderActiveListItems();
        }
      }
    });

    document.addEventListener("quacker:data-changed", _handleListsItemStateChanged);

    // Volver desde Explore a un detalle de lista concreto
    document.addEventListener("quacker:lists-open-detail", async (e) => {
      const listId = _normalizeId(e?.detail?.listId);
      const highlightItemId = _normalizeId(e?.detail?.highlightItemId);
      if (!listId) return;

      // Aseguramos vista + datos antes de abrir detalle
      window.Router?.showView("lists");
      await load();
      await openListDetail(listId);

      if (highlightItemId) {
        // Esperar un frame para asegurar DOM pintado
        requestAnimationFrame(() => {
          const safe = (window.CSS && CSS.escape) ? CSS.escape(highlightItemId) : highlightItemId;
          const el = document.querySelector(`.list-item-card[data-item-id="${safe}"]`);
          if (el) {
            el.scrollIntoView({ behavior: "smooth", block: "center" });
          }
          // Reutiliza tu helper (ya existe porque el highlight al deshacer funciona)
          if (typeof flashListItemCard === "function") {
            flashListItemCard(highlightItemId);
          }
        });
      }
    });

    document.querySelectorAll(".pill-filter").forEach((btn) => {
      btn.addEventListener("click", () => {
        document.querySelectorAll(".pill-filter").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");

        listsFilter = btn.dataset.filter || "all";
        applyFilters();
        _saveUIState();
      });
    });

    document.querySelectorAll("[data-lists-view-mode]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const nextMode = btn.dataset.listsViewMode === "list" ? "list" : "cards";
        if (listsViewMode === nextMode) return;

        listsViewMode = nextMode;
        _syncListsToolbarUI();
        _saveUIState();
      });
    });

    const grid = document.getElementById("listsGrid");
    if (grid) {
      grid.addEventListener("click", async (e) => {
        // Si clico en "editar"
        const editBtn = e.target.closest('[data-action="edit-list"]');
        if (editBtn) {
          e.stopPropagation();
          const id = _normalizeId(editBtn.dataset.id);
          if (!id) return;
          openListModal(id);
          return;
        }

        // Si clico en "eliminar"
        const delBtn = e.target.closest('[data-action="delete-list"]');
        if (delBtn) {
          e.stopPropagation();

          const id = _normalizeId(delBtn.dataset.id);
          const name = String(delBtn.dataset.name || "").trim();
          if (!id) return;

          pendingDeleteListId = id;

          const text = document.getElementById("confirmDeleteListText");
          if (text) {
            text.textContent = name
              ? t("modal_delete_list_text_named").replace("{name}", name)
              : t("modal_delete_list_text");
          }

          openConfirmDeleteListModal();

          return;
        }

        // Click normal en la card: abrir detalle
        const card = e.target.closest(".list-card");
        if (card) {
          const id = _normalizeId(card.dataset.id);
          if (!id) return;
          await openListDetail(id);
        }

      });
    }

    document.getElementById("btnCreateListPoll")?.addEventListener("click", openListPollModal);

    document.getElementById("listDetailPollsList")?.addEventListener("click", (event) => {
      const voteButton =
        event.target.closest(
          '[data-action="save-poll-vote"]'
        );

      if (voteButton) {
        const pollId =
          _normalizeId(
            voteButton.dataset.pollId
          );

        if (!pollId) return;

        saveListPollVote(pollId)
          .catch(console.error);

        return;
      }

      const closeButton =
        event.target.closest(
          '[data-action="close-poll"]'
        );

      if (closeButton) {
        const pollId =
          _normalizeId(
            closeButton.dataset.pollId
          );

        if (!pollId) return;

        closeListPollFromDetail(pollId)
          .catch(console.error);

        return;
      }

      const resultsButton =
        event.target.closest(
          '[data-action="show-poll-results"]'
        );

      if (resultsButton) {
        const pollId =
          _normalizeId(
            resultsButton.dataset.pollId
          );

        if (!pollId) return;

        loadListPollResults(pollId)
          .catch(console.error);
      }
    });

    document.getElementById("btnBackToLists")?.addEventListener("click", () => {
      closeListDetail();
    });

    document.getElementById("listDetailErrorRetry")?.addEventListener("click", () => {
      renderActiveListItems().catch(console.error);
    });

    // Filtros del detalle (búsqueda / tipo / estado)
    const qInput = _getEl("listDetailSearch");
    if (qInput) {
      qInput.addEventListener("input", () => {
        const v = String(qInput.value || "").trim().toLowerCase();
        detailSearch = v;
        _saveUIState();

        // Debounce suave para no repintar en cada tecla
        if (__detailSearchTimer) clearTimeout(__detailSearchTimer);
        __detailSearchTimer = setTimeout(() => {
          renderActiveListItems();
        }, 140);
      });
    }

    const typeSel = _getEl("listDetailTypeFilter");
    if (typeSel) {
      typeSel.addEventListener("change", () => {
        detailType = String(typeSel.value || "all");
        _saveUIState();
        renderActiveListItems();
      });
    }

    const statusSel = _getEl("listDetailStatusFilter");
    if (statusSel) {
      statusSel.addEventListener("change", () => {
        detailStatus = String(statusSel.value || "all");
        _saveUIState();
        renderActiveListItems();
      });
    }

    // Desde el detalle: ir a Explorar en modo "añadir a esta lista"
    document.getElementById("btnAddContentToList")?.addEventListener("click", () => {
      const listId = _normalizeId(activeListId);
      if (!listId) return;

      const current = (allLists || []).find(l => _normalizeId(l.id) === listId);
      const listName = current?.name ? String(current.name) : null;

      // Emitimos el modo para Explore (incluimos nombre para UI inmediata)
      document.dispatchEvent(new CustomEvent("quacker:lists-add-mode", {
        detail: { listId, listName }
      }));

      // Navegamos a Explorar
      window.Router?.showView("explore");
      window.toast?.({
        title: t("lists_add_content_to_list_title"),
        message: t("lists_add_content_to_list_message"),
        type: "info",
        duration: 2600
      });
    });

    // Clicks dentro del detalle (quitar item)
    const detail = document.getElementById("listDetail");
    if (detail) {
      detail.addEventListener("click", async (e) => {
        const rm = e.target.closest('[data-action="remove-from-list"]');
        if (!rm) return;

        const itemId = _normalizeId(rm.dataset.itemId);
        if (!itemId) return;

        await removeItemFromActiveList(
          itemId,
          {
            canUndo:
              rm.dataset.canUndo !== "0",
            source:
              rm.dataset.itemSource || "",
            type:
              rm.dataset.itemType || "",
            externalId:
              rm.dataset.itemExternalId || ""
          }
        );
      });
    }


    // Botón "+ Nueva lista"
    document.getElementById("btnNewList")?.addEventListener("click", () => openListModal(null));

    // Crear
    document.getElementById("saveListPollModal")?.addEventListener("click", saveListPollFromModal);

    document.getElementById("saveListModal")?.addEventListener("click", saveListFromModal);

    // Confirmar eliminar (CON toast y deshacer)
    document.getElementById("confirmDeleteList")?.addEventListener("click", async () => {
      const targetListId = _normalizeId(pendingDeleteListId);
      if (!targetListId) return;

      const btn = document.getElementById("confirmDeleteList");
      const cancelBtn = document.getElementById("cancelDeleteList");
      const closeBtn = document.getElementById("closeConfirmDeleteList");

      const prevHtml = btn?.innerHTML || t("common_delete");

      if (btn) {
        if (btn.dataset.busy === "1") return; // evitar doble click
        btn.disabled = true;
        btn.dataset.busy = "1";
        btn.innerHTML = `
          <span class="btn-spinner" aria-hidden="true"></span>
          <span>${t("lists_delete_loading")}</span>
        `;
      }

      if (cancelBtn) cancelBtn.disabled = true;
      if (closeBtn) closeBtn.disabled = true;

      // Snapshot para poder deshacer.
      lastDeletedListSnapshot = {
        deletedId: targetListId,
        deletedName: (() => {
          const found = allLists.find(l => _normalizeId(l.id) === targetListId);
          return found?.name ? String(found.name) : t("lists_detail_title");
        })(),
        lists: JSON.parse(JSON.stringify(allLists || []))
      };

      try {
        const card = _findListCardById(targetListId);
        if (card) {
          card.classList.add("is-removing");
          await _sleep(200);
        }

        assertListMutationOk(
          await ApiClient.deleteList(targetListId),
          "delete_failed"
        );

        closeConfirmDeleteListModal();
        await load();

        const snap = lastDeletedListSnapshot;

        if (snap?.lists?.length || Array.isArray(snap?.lists)) {
          window.toast?.({
            title: t("lists_delete_success_title"),
            message: t("lists_delete_success_text").replace("{name}", snap.deletedName),
            type: "info",
            duration: 5000,
            actionLabel: t("lists_undo"),
            onAction: async () => {
              if (!lastDeletedListSnapshot?.lists) return;

              const snapshotToRestore = lastDeletedListSnapshot;

              try {
                assertListMutationOk(
                  await ApiClient.setLists(snapshotToRestore.lists),
                  "restore_failed"
                );
                lastDeletedListSnapshot = null;
              } catch (e) {
                console.error(e);
                lastDeletedListSnapshot = snapshotToRestore;

                window.toast?.({
                  title: t("lists_delete_undo_error_title"),
                  message: t("lists_delete_undo_error_text"),
                  type: "error",
                  duration: 3200
                });
                return;
              }

              const isListsActive = document.querySelector("#view-lists")?.classList.contains("is-active");
              if (isListsActive) {
                await load();

                requestAnimationFrame(() => {
                  const card = _findListCardById(snapshotToRestore.deletedId);
                  if (card) {
                    card.scrollIntoView({ behavior: "smooth", block: "center" });
                    card.classList.remove("is-pop");
                    requestAnimationFrame(() => card.classList.add("is-pop"));
                  }
                });
              }

              window.toast?.({
                title: t("lists_delete_undo_success_title"),
                message: t("lists_delete_undo_success_text").replace("{name}", snapshotToRestore.deletedName),
                type: "success",
                duration: 2200
              });
            }
          });
        }
      } catch (err) {
        console.error(err);
        _showConfirmDeleteErrors(t("lists_delete_error_text"));
      } finally {
        if (btn) {
          btn.disabled = false;
          btn.dataset.busy = "0";
          btn.innerHTML = prevHtml;
        }
        if (cancelBtn) cancelBtn.disabled = false;
        if (closeBtn) closeBtn.disabled = false;
      }
    });

    // Abrir "Nueva lista" desde otros módulos (ej: modal "Añadir a listas" de Biblioteca)
    document.addEventListener("quacker:lists-create-request", (e) => {
      __returnToAddToListItemId = _normalizeId(e?.detail?.returnToAddToListItemId) || null;

      try {
        openListModal(null); // modo crear
      } catch (err) {
        console.error(err);
      }
    });

    requestAnimationFrame(() => {
      const isListsActive = document.querySelector("#view-lists")?.classList.contains("is-active");
      if (isListsActive) {
        load().catch(console.error);
      }
    });

  }

  return { init, load, render };
})();

// Exponer al scope global
window.ListsModule = ListsModule;
