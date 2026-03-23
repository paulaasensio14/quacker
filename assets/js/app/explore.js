// assets/js/app/explore.js
// Explore v1 — UI → ApiClient

const ExploreModule = (() => {
  let feed = [];
  let visible = [];
  let activeEid = null;
  let dismissed = new Set();
  let expandedSection = null;

  let sectionShownCount = {
    novedades: 0,
    tendencias: 0,
    recomendados: 0
  };

  const LOAD_MORE_STEP = 6; // cuántos más se cargan cada vez

  let typeFilter = "all";
  let sortMode = "recent";
  let searchTerm = "";

  // Soft loading / debounce (Explorar)
  let __applyTimer = null;
  let __loadingMinTimer = null;
  let __loadingStartedAt = 0;

  let __drawerOpen = false;

  let __drawerExpanded = false;

  let __drawerLastFocusEl = null;

  let __drawerListsPickerOpen = false;

  let __pendingLibraryEnsures = new Map();

  function _renderDrawerAddCtaLabel() {
    const btn = document.getElementById("exploreDrawerAddLibrary");
    if (!btn) return;

    if (btn.dataset?.busy === "1") return;

    btn.textContent = "Añadir a biblioteca";
  }

  function _setExploreLoading(on) {
    const view = document.getElementById("view-explore");
    const el = document.getElementById("exploreLoading");
    if (!view || !el) return;

    if (on) {
      __loadingStartedAt = performance.now();
      view.classList.add("is-loading");
      el.hidden = false;
    } else {
      view.classList.remove("is-loading");
      el.hidden = true;
    }
  }

  function _scheduleApplyFilters() {
    if (__applyTimer) clearTimeout(__applyTimer);
    _setExploreLoading(true);

    __applyTimer = setTimeout(async () => {
      try {
        await load();
      } catch (e) {
        console.error("Explore remote search failed", e);
      } finally {
        const elapsed = performance.now() - __loadingStartedAt;
        const minMs = 180;
        const remaining = Math.max(0, minMs - elapsed);

        if (__loadingMinTimer) clearTimeout(__loadingMinTimer);
        __loadingMinTimer = setTimeout(() => {
          _setExploreLoading(false);
        }, remaining);
      }
    }, 250);
  }

  const TYPE_LABELS = window.TYPE_LABELS || {
    serie: "Serie",
    pelicula: "Película",
    book: "Libro",
    game: "Videojuego"
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

  function _normalizeExploreItem(rawItem, index = 0) {
    const raw = rawItem && typeof rawItem === "object" ? rawItem : {};
    const eid = raw.eid ?? `explore_${index + 1}`;
    const title = _safeText(raw.title).trim() || "Sin título";

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
      eid: String(eid),
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

    if (cover) {
      return `
        <div class="explore-cover">
          <img
            class="explore-cover-img"
            src="${cover}"
            alt="Portada de ${title || "contenido"}"
            loading="lazy"
            referrerpolicy="no-referrer"
          />
        </div>
      `;
    }

    return `
      <div class="explore-cover" aria-hidden="true">
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
      renderSkeletonSection("Novedades", 6),
      renderSkeletonSection("Tendencias", 6),
      renderSkeletonSection("Recomendados", 6)
    ].join("");
  }

  function _buildExploreCardViewModel(item) {
    const title = _safeText(item?.title) || "Sin título";
    const normalizedType = _norm(item?.type);
    const typeLabel =
      TYPE_LABELS[normalizedType] ||
      (normalizedType === "tv" ? "Serie" : "") ||
      (normalizedType === "movie" ? "Película" : "") ||
      (normalizedType === "libro" ? "Libro" : "") ||
      (normalizedType === "videojuego" ? "Videojuego" : "") ||
      "Contenido";

    const isNew = _isNewByDate(item?.releaseDate);
    const saved = !!item?.__inLibrary;
    const saving = !!item?.__saving;
    const eid = item?.eid ? String(item.eid) : "";

    return {
      title,
      typeLabel,
      isNew,
      saved,
      saving,
      eid
    };
  }

  function _render() {
    const container = document.querySelector("[data-explore-container]");
    const empty = document.getElementById("exploreEmpty");
    if (!container) return;

    const isActive = document.querySelector("#view-explore")?.classList.contains("is-active");
    if (!isActive) return;

  // --- Secciones Explore v1.4 (con “Ver más”) ---
  const isNewItem = (it) => !!it.__isNew;

  // Novedades: todo lo “nuevo” (<= 30 días)
  const novedadesAll = visible.filter(isNewItem);

  // Tendencias: lo más “reciente” que NO sea nuevo (base para expandir)
  const notNew = visible.filter((it) => !isNewItem(it));
  const tendenciasAll = notNew.slice(0, 8); // base “ver más” sin API aún

  // Recomendados: el resto (sin duplicar con tendencias)
  const tendenciaIdsAll = new Set(tendenciasAll.map((it) => String(it.eid)));
  const recomendadosAll = notNew.filter((it) => !tendenciaIdsAll.has(String(it.eid)));

  const SECTIONS = [

  {
  key: "novedades",
  title: "Novedades",
  subtitle: "Lanzamientos recientes para añadir a tu ocio",
  limit: 6,
  items: novedadesAll
  },

  {
  key: "tendencias",
  title: "Tendencias",
  subtitle: "Lo más comentado y popular en tu feed",
  limit: 6,
  items: tendenciasAll
  },

  {
  key: "recomendados",
  title: "Recomendados",
  subtitle: "Opciones que encajan con tu biblioteca",
  limit: 6,
  items: recomendadosAll
  }

  ];

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
    return `
    <article
      class="explore-card explore-card--poster"
      data-eid="${vm.eid}"
      data-action="open-item-detail"
      tabindex="0"
      role="button"
      aria-label="Abrir detalle de ${vm.title}">
      ${_cardCover(item)}
      <div class="explore-card-overlay">
        <span class="explore-card-type">
          ${vm.typeLabel}
        </span>
      </div>
    </article>
    `;
  };

  const renderSection = (section) => {
    const { key, title, subtitle, items, limit } = section;
    if (!items || items.length === 0) return "";

    const isExpanded = expandedSection === key;

    // En modo normal mostramos el límite.
    // En modo expandido mostramos sectionShownCount[key] y lo aumentamos con "Cargar más".
    const shownCount = isExpanded ? Math.min(items.length, sectionShownCount[key] || limit) : Math.min(items.length, limit);
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
            <span class="explore-section-count">${items.length}</span>

            ${canExpand
              ? `<button type="button" class="btn-ghost explore-section-btn" data-explore-section-action="expand" data-section="${key}">Ver más</button>`
              : ""}

            ${canLoadMore
              ? `<button type="button" class="btn-ghost explore-section-btn"
                  data-explore-section-action="load-more"
                  data-section="${key}">
                  Cargar más
                </button>`
              : ""}

            ${isExpanded
              ? `<button type="button" class="btn-ghost explore-section-btn" data-explore-section-action="collapse">Volver</button>`
              : ""}
          </div>
        </header>

        <div class="explore-section-grid">
          ${shown.map(renderCard).join("")}
        </div>
      </section>
    `;
  };

  const sectionsToRender = expandedSection
    ? SECTIONS.filter((s) => s.key === expandedSection)
    : SECTIONS;

    const hasAny = sectionsToRender.some((s) => (s.items || []).length > 0);

    // Render secciones (aunque luego ocultemos la grid, para mantener consistencia interna)
    container.innerHTML = sectionsToRender.map(renderSection).join("");

    // Si no hay resultados: ocultar grid y mostrar empty state
    container.hidden = !hasAny;
    if (empty) empty.hidden = hasAny;

  }

  function _applyFilters() {
    const t = typeFilter;
    const q = _norm(searchTerm);

    let out = [...feed];

    // quitar ocultados
    out = out.filter(x => !dismissed.has(String(x.eid)));   

    if (t !== "all") out = out.filter(x => x.type === t);

    if (q) {
      out = out.filter(x => _norm(x.title).includes(q));
    }

    if (sortMode === "title") {
      out.sort((a, b) => _safeText(a.title).localeCompare(_safeText(b.title), "es", { sensitivity: "base" }));
    } else {
      // recent: releaseDate desc (si no hay, al final)
      out.sort((a, b) => {
        const da = a.releaseDate ? new Date(a.releaseDate).getTime() : 0;
        const db = b.releaseDate ? new Date(b.releaseDate).getTime() : 0;
        return db - da;
      });
    }

    visible = out;
    _render();
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

    _syncExploreDrawerViewport();

    // Bloquear scroll (reutilizamos tu patrón existente)
    document.body.classList.add("modal-open");

    // Foco inicial (solo si abrimos desde cerrado)
    if (!wasOpen) {
      requestAnimationFrame(() => {
        (closeBtn || drawer).focus?.();
      });
    }
  }

  function _closeExploreDrawer() {
    const drawer = document.getElementById("exploreDrawer");
    const backdrop = document.getElementById("exploreDrawerBackdrop");
    if (!drawer || !backdrop) return;

    __drawerOpen = false;

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
    const confirmListBtn = document.getElementById("exploreDrawerConfirmList");

    __drawerListsPickerOpen = false;

    if (listPicker) listPicker.hidden = true;
    if (listSelect) listSelect.value = "";
    if (confirmListBtn) confirmListBtn.disabled = false;

    const back = __drawerLastFocusEl;
    __drawerLastFocusEl = null;
    if (back && typeof back.focus === "function") {
      requestAnimationFrame(() => back.focus());
    }
  }

  function _getExploreItemByEid(eid) {
    if (!eid) return null;
    return feed.find((x) => String(x.eid) === String(eid)) || null;
  }

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
      TYPE_LABELS[normalizedType] ||
      (normalizedType === "tv" ? "Serie" : "") ||
      (normalizedType === "movie" ? "Película" : "") ||
      (normalizedType === "libro" ? "Libro" : "") ||
      (normalizedType === "videojuego" ? "Videojuego" : "") ||
      "Contenido";

    const metaParts = [
      resolvedTypeLabel,
      item?.releaseDate ? _safeText(item.releaseDate) : ""
    ].filter(Boolean);

    const badgeParts = [];

    if (item?.__inLibrary) badgeParts.push("En biblioteca");
    if (count > 0) {
      badgeParts.push(`En ${count} lista${count === 1 ? "" : "s"}`);
    }

    return {
      title: _safeText(item?.title) || "Sin título",
      meta: metaParts.join(" · "),
      summary: _safeText(item?.summary) || "Sin descripción disponible.",
      detailType: resolvedTypeLabel,
      detailReleaseDate: item?.releaseDate ? _safeText(item.releaseDate) : "Sin fecha",
      detailLibraryState: item?.__inLibrary ? "En biblioteca" : "No guardado",
      detailListsCount:
        count === 0 ? "No está en listas" : `${count} lista${count === 1 ? "" : "s"}`,
      badge: badgeParts.join(" · "),
      hasBadge: badgeParts.length > 0
    };
  }

  function _renderExploreDrawerDetails(item) {
    const vm = _buildExploreDrawerTextModel(item);

    const typeEl = document.getElementById("exploreDetailType");
    const releaseEl = document.getElementById("exploreDetailReleaseDate");
    const libraryEl = document.getElementById("exploreDetailLibraryState");
    const listsEl = document.getElementById("exploreDetailListsCount");
    const summaryEl = document.getElementById("exploreDetailSummary");

    if (typeEl) typeEl.textContent = vm.detailType;
    if (releaseEl) releaseEl.textContent = vm.detailReleaseDate;
    if (libraryEl) libraryEl.textContent = vm.detailLibraryState;
    if (listsEl) listsEl.textContent = vm.detailListsCount;
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

    if (!drawer || !details || !expandBtn) return;
    drawer.classList.toggle("is-expanded", __drawerExpanded);

    details.hidden = !__drawerExpanded;

    expandBtn.setAttribute("aria-pressed", __drawerExpanded ? "true" : "false");
    expandBtn.setAttribute(
      "aria-label",
      __drawerExpanded ? "Ocultar detalles" : "Ver más detalles"
    );
    expandBtn.textContent = __drawerExpanded ? "Ocultar detalles" : "Ver más detalles";

    if (__drawerExpanded) {
      _syncExploreDrawerViewport();
    }
  }

  function _getActiveExploreItem() {
    return _getExploreItemByEid(activeEid);
  }

  function _syncExploreDrawerFromItem(item) {
    if (!item) return null;

    activeEid = String(item.eid);

    const vm = _buildExploreDrawerTextModel(item);
    const titleEl = document.getElementById("exploreDrawerTitle");
    const metaEl = document.getElementById("exploreDrawerMeta");
    const summaryEl = document.getElementById("exploreDrawerSummary");
    const coverEl = document.getElementById("exploreDrawerCover");
    const badgeEl = document.getElementById("exploreDrawerBadge");
    const addLibraryBtn = document.getElementById("exploreDrawerAddLibrary");
    const addListsBtn = document.getElementById("exploreDrawerAddLists");

    if (titleEl) titleEl.textContent = vm.title;
    if (metaEl) metaEl.textContent = vm.meta;
    if (summaryEl) {
      summaryEl.textContent = vm.summary;
      summaryEl.hidden = false;
    }

    if (coverEl) {
      const backdrop = _safeText(item?.backdrop).trim();
      const cover = _safeText(item?.cover).trim();
      const heroImage = backdrop || cover;

      if (heroImage) {
        coverEl.style.backgroundImage = `url("${heroImage}")`;
      } else {
        coverEl.style.backgroundImage = "none";
        coverEl.style.backgroundSize = "";
        coverEl.style.backgroundPosition = "";
        coverEl.style.backgroundRepeat = "";
      }
    }
    if (badgeEl) {
      badgeEl.textContent = vm.badge;
      badgeEl.hidden = !vm.hasBadge;
    }

    if (addLibraryBtn) {
      addLibraryBtn.dataset.eid = String(item.eid);
      addLibraryBtn.disabled = !!item.__saving;
    }

    if (addListsBtn) {
      addListsBtn.dataset.eid = String(item.eid);
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
    placeholderOption.textContent = "Selecciona una lista";
    select.appendChild(placeholderOption);

    for (const list of safeLists) {
      if (!list?.id) continue;

      const option = document.createElement("option");
      option.value = String(list.id);
      option.textContent = _safeText(list.name) || "Lista sin nombre";
      select.appendChild(option);
    }

    const hasLists = safeLists.length > 0;

    if (!hasLists) {
      select.innerHTML = "";

      const emptyOption = document.createElement("option");
      emptyOption.value = "";
      emptyOption.textContent = "No hay listas disponibles";
      select.appendChild(emptyOption);
    }

    if (preselectedListId && hasLists) {
      select.value = String(preselectedListId);
    }

    select.disabled = !hasLists;

    if (confirmBtn) {
      confirmBtn.disabled = !hasLists;
    }
  }

  async function _openExploreListPicker() {
    const picker = document.getElementById("exploreDrawerListPicker");
    if (!picker) return;

    await _populateExploreListPicker();

    __drawerListsPickerOpen = true;
    picker.hidden = false;

    const select = document.getElementById("exploreDrawerListSelect");
    requestAnimationFrame(() => select?.focus?.());
  }

  function _closeExploreListPicker() {
    const picker = document.getElementById("exploreDrawerListPicker");
    const select = document.getElementById("exploreDrawerListSelect");

    __drawerListsPickerOpen = false;

    if (picker) picker.hidden = true;
    if (select) select.value = "";
  }

  async function _saveActiveExploreItemToList(listId) {
    const item = _getActiveExploreItem();
    if (!item || !listId) return;

    const confirmBtn = document.getElementById("exploreDrawerConfirmList");
    _setDrawerButtonLoading(confirmBtn, true);

    try {
      const ensured = await _ensureInLibrary(item);
      if (!ensured?.ok) return;

      const freshItem = _getExploreItemByEid(item.eid);

      const libraryItemId =
        ensured.createdId ||
        freshItem?.__libraryItemId ||
        null;

      if (!libraryItemId) {
        _showDrawerInlineNotePersistent(
          "Se añadió a biblioteca, pero no se pudo resolver el item para guardarlo en la lista."
        );
        return;
      }

      const result = await ApiClient.addLibraryItemToList(
        String(listId),
        String(libraryItemId)
      );

      let drawerNoteMessage = "";
      let drawerNotePersistent = false;

      if (result?.ok && !result?.already) {
        drawerNoteMessage = "Añadido a la lista.";
        drawerNotePersistent = false;
      } else if (result?.already) {
        drawerNoteMessage = "Ese contenido ya estaba en la lista.";
        drawerNotePersistent = true;
      } else {
        _showDrawerInlineNotePersistent("No se pudo añadir a la lista.");
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
        .filter(item => item?.id)
        .map(item => [String(item.id), item])
    );

    const libraryByKey = new Map(
      lib.map(item => [
        `${_norm(item.title)}::${_safeText(item.type)}`,
        item
      ])
    );

    // Mantener el vínculo por ID si ya existe.
    // Solo usar title+type como fallback para items antiguos o aún no enlazados.
    feed = feed.map((x) => {
      const currentLibraryId = x.__libraryItemId ? String(x.__libraryItemId) : null;
      const byId = currentLibraryId ? libraryById.get(currentLibraryId) : null;
      const byKey = byId
        ? null
        : libraryByKey.get(`${_norm(x.title)}::${_safeText(x.type)}`);

      const libraryItem = byId || byKey || null;

      return {
        ...x,
        __inLibrary: !!libraryItem,
        __libraryItemId: libraryItem?.id ? String(libraryItem.id) : null
      };
    });

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

        const safeId = String(rawId);
        if (seenInList.has(safeId)) continue;
        seenInList.add(safeId);

        listsCountByLibraryId.set(
          safeId,
          Number(listsCountByLibraryId.get(safeId) || 0) + 1
        );
      }
    }

    for (const item of feed) {
      const safeLibraryId = item.__libraryItemId ? String(item.__libraryItemId) : null;
      item.__listsCount = safeLibraryId
        ? Number(listsCountByLibraryId.get(safeLibraryId) || 0)
        : 0;
    }
  }

  async function load() {
    const globalSearch = document.getElementById("globalSearch");
    if (globalSearch) {
      searchTerm = String(globalSearch.value || "").trim();
    }

    _setExploreLoading(true);
    _renderExploreSkeleton();

    try {
      const rawFeed = await ApiClient.getExploreFeed(searchTerm);
      const safeFeed = Array.isArray(rawFeed) ? rawFeed : [];

      feed = safeFeed
        .map((item, index) => _normalizeExploreItem(item, index))
        .filter((item) => item.cover);
    } catch (e) {
      console.error("ExploreModule.load error", e);
      feed = [];
    }

    // cargar ocultados persistentes
    try {
        const arr = await ApiClient.getExploreDismissed();
        dismissed = new Set((arr || []).map(String));
    } catch (e) {
        console.error(e);
        dismissed = new Set();
    }

    await _syncInLibraryFlags();
    _applyFilters();
    _setExploreLoading(false);
  }

  async function _ensureInLibrary(item) {
    const eid = item?.eid ? String(item.eid) : "";
    if (!eid) return { ok: false, createdId: null };

    const current = _getExploreItemByEid(eid);

    if (current?.__inLibrary) {
      return {
        ok: true,
        createdId: current.__libraryItemId ? String(current.__libraryItemId) : null
      };
    }

    const pending = __pendingLibraryEnsures.get(eid);
    if (pending) {
      return pending;
    }

    const run = (async () => {

      feed = feed.map((x) =>
        x.eid === eid ? { ...x, __saving: true } : x
      );

      _applyFilters();

      try {
        const payload = {
          title: item.title,
          type: item.type,
          progress: 0
        };

        const created = await ApiClient.createLibraryItem(payload);

        feed = feed.map((x) =>
          x.eid === eid
            ? {
                ...x,
                __saving: false,
                __inLibrary: true,
                __libraryItemId: created?.id
                  ? String(created.id)
                  : (x.__libraryItemId ?? null)
              }
            : x
        );

        await _syncInLibraryFlags();

        window.toast?.({
          title: "Añadido a biblioteca",
          message: "Se ha guardado en tu biblioteca.",
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
          createdId: created?.id ? String(created.id) : null
        };
      } catch (err) {
        if (err?.status === 409 || err?.error === "duplicate_item") {
          try {
            await _syncInLibraryFlags();
          } catch (syncErr) {
            console.error(syncErr);
          }

          feed = feed.map((x) =>
            x.eid === eid
              ? {
                  ...x,
                  __saving: false,
                  __inLibrary: true
                }
              : x
          );

          _applyFilters();

          const fresh = _getExploreItemByEid(eid);

          return {
            ok: true,
            createdId: fresh?.__libraryItemId
              ? String(fresh.__libraryItemId)
              : null
          };
        }

        console.error(err);

        feed = feed.map((x) =>
          x.eid === eid ? { ...x, __saving: false } : x
        );

        _applyFilters();

        window.toast?.({
          title: "No se pudo añadir",
          message: "Inténtalo de nuevo.",
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
      _setExploreDrawerExpanded(false);
      _openExploreDrawer(detailTrigger);

      const detailed = await _hydrateExploreItemDetail(item);
      if (detailed?.eid === item.eid) {
        _syncExploreDrawerFromItem(detailed);
        _renderExploreDrawerDetails(detailed);
      }
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
      _setExploreDrawerExpanded(false);
      _openExploreDrawer(card);

      const detailed = await _hydrateExploreItemDetail(item);
      if (detailed?.eid === item.eid) {
        _syncExploreDrawerFromItem(detailed);
        _renderExploreDrawerDetails(detailed);
      }
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

          _showDrawerInlineNote("Añadido a biblioteca.");
        } finally {
          _setDrawerButtonLoading(addLibraryBtn, false);
          _renderDrawerAddCtaLabel();
        }
      });
    }

    // AÑADIR A LISTA (NUEVO)

    const addListsBtn = document.getElementById("exploreDrawerAddLists");

    if (addListsBtn && !addListsBtn.dataset.bound) {
      addListsBtn.dataset.bound = "1";

      addListsBtn.addEventListener("click", async (e) => {
        e.preventDefault();
        e.stopPropagation();

        const item = _getActiveExploreItem();
        if (!item) return;

        await _openExploreListPicker();
      });
    }

    const confirmListBtn = document.getElementById("exploreDrawerConfirmList");

    if (confirmListBtn && !confirmListBtn.dataset.bound) {
      confirmListBtn.dataset.bound = "1";

      confirmListBtn.addEventListener("click", async (e) => {
        e.preventDefault();
        e.stopPropagation();

        const select = document.getElementById("exploreDrawerListSelect");
        const listId = select?.value;

        if (!listId) {
          _showDrawerInlineNotePersistent("Selecciona una lista.");
          return;
        }

        await _saveActiveExploreItemToList(listId);
      });
    }

    const cancelListBtn = document.getElementById("exploreDrawerCancelList");

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
          if (e.detail?.viewId !== "explore") {
            _closeExploreListPicker();
            _clearDrawerInlineNote();
            return;
          }

          _renderDrawerAddCtaLabel();

          const global = document.getElementById("globalSearch");
          if (global) global.value = searchTerm;

          load();
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
      if (isExplore && global) global.value = searchTerm;

      if (isExplore) load();
    })();
  }

  return { init, load };
})();

window.ExploreModule = ExploreModule;

function openAddToLibraryModal(eid) {
  const modal = document.getElementById("addFromExploreModal");
  if (!modal) return;

  modal.dataset.eid = eid;
  modal.classList.add("open");
}

function closeAddFromExploreModal() {
  const modal = document.getElementById("addFromExploreModal");
  if (!modal) return;

  modal.classList.remove("open");
  delete modal.dataset.eid;
}