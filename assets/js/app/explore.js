// assets/js/app/explore.js
// Explore v1 (mock feed) — UI → ApiClient (sin tocar FakeBackend directo)

const ExploreModule = (() => {
  let feed = [];
  let visible = [];
  let activeEid = null;
  let dismissed = new Set();
  let expandedSection = null;
  let __listsChangedBound = false;
  let __viewChangeBound = false;

  // Modo: añadir automáticamente a una lista concreta
  let __addToListMode = null; // { listId, listName, addedCount }

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
  let __drawerLastFocusEl = null;

  function _renderAddToListModeChip() {
    const wrap = document.getElementById("exploreAddToListMode");
    const text = document.getElementById("exploreAddToListModeText");
    if (!wrap || !text) return;

    if (!__addToListMode?.listId) {
      wrap.hidden = true;
      return;
    }

    const name = __addToListMode.listName ? String(__addToListMode.listName) : "Lista";
    const added = Number(__addToListMode.addedCount || 0);
    const suffix = added > 0
      ? ` · ${added} ${added === 1 ? "añadido" : "añadidos"}`
      : "";

    text.textContent = `Añadiendo a: ${name}${suffix}`;

    wrap.hidden = false;

    // micro feedback al mostrarse
    wrap.classList.remove("is-pop");
    requestAnimationFrame(() => wrap.classList.add("is-pop"));
  }

  function _exitAddToListMode({ clearLastAdd = true } = {}) {
    __addToListMode = null;
    if (clearLastAdd) window.__quackerLastListAdd = null;

    _renderAddToListModeChip();
    _renderDrawerAddCtaLabel();
    _clearDrawerInlineNote();
  }

  function _renderDrawerAddCtaLabel() {
    const btn = document.getElementById("exploreDrawerAddLibrary");
    if (!btn) return;

    // Si el botón está en estado busy ("Guardando…"), no tocamos el contenido
    if (btn.dataset?.busy === "1") return;

    btn.textContent = __addToListMode?.listId
      ? "Añadir y guardar en lista"
      : "Añadir a biblioteca";
  }

  async function _hydrateAddToListModeName() {
    // Si no hay modo o ya tenemos nombre, no hacemos nada
    if (!__addToListMode?.listId) return;
    if (__addToListMode.listName) return;

    try {
      const lists = await ApiClient.getLists();
      const found = (lists || []).find(l => String(l.id) === String(__addToListMode.listId));
      if (found?.name) __addToListMode.listName = String(found.name);
    } catch (e) {
      console.error("Explore: no se pudo resolver nombre de lista", e);
    } finally {
      _renderAddToListModeChip();
    }
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
    // Debounce: evita re-render por cada tecla
    if (__applyTimer) clearTimeout(__applyTimer);

    _setExploreLoading(true);

    __applyTimer = setTimeout(() => {
      _applyFilters();

      // Duración mínima para que no parpadee
      const elapsed = performance.now() - __loadingStartedAt;
      const minMs = 180;
      const remaining = Math.max(0, minMs - elapsed);

      if (__loadingMinTimer) clearTimeout(__loadingMinTimer);
      __loadingMinTimer = setTimeout(() => {
        _setExploreLoading(false);
      }, remaining);
    }, 150);
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

  function _chipSvgNew() {
    // pequeño “spark” sin emojis
    return `
      <span class="explore-chip" title="Nuevo">
        <svg class="explore-chip-ico" width="14" height="14" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M12 2l1.8 6.2L20 10l-6.2 1.8L12 18l-1.8-6.2L4 10l6.2-1.8L12 2z"></path>
        </svg>
        <span>Nuevo</span>
      </span>
    `;
  }

  function _cardCover(title) {
    const t = _safeText(title).trim();
    const initials = t ? t.slice(0, 1).toUpperCase() : "Q";

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
        <div class="explore-card-cover explore-skel-cover"></div>

        <div class="explore-card-body">
          <div class="explore-skel-title"></div>

          <div class="explore-skel-meta-row">
            <span class="explore-skel-chip"></span>
            <span class="explore-skel-chip short"></span>
          </div>

          <div class="explore-skel-line"></div>
          <div class="explore-skel-line short"></div>

          <div class="explore-card-actions">
            <span class="explore-skel-btn"></span>
            <span class="explore-skel-btn ghost"></span>
            <span class="explore-skel-btn icon"></span>
          </div>
        </div>
      </article>
    `;

    const renderSkeletonSection = (title, count) => `
      <section class="explore-section explore-section--skeleton" aria-hidden="true">
        <header class="explore-section-head">
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
      renderSkeletonSection("Novedades", 4),
      renderSkeletonSection("Tendencias", 4),
      renderSkeletonSection("Recomendados", 6)
    ].join("");
  }

  function _render() {
    const container = document.querySelector("[data-explore-container]");
    const empty = document.getElementById("exploreEmpty");
    if (!container) return;

    const isActive = document.querySelector("#view-explore")?.classList.contains("is-active");
    if (!isActive) return;

  // --- Secciones Explore v1.4 (con “Ver más”) ---
  const isNewItem = (it) => _isNewByDate(it.releaseDate);

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
      limit: 4,
      items: novedadesAll
    },
    {
      key: "tendencias",
      title: "Tendencias",
      subtitle: "Lo más comentado y popular en tu feed",
      limit: 4,
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
    const title = _safeText(item.title);
    const typeLabel = TYPE_LABELS[item.type] || "Contenido";
    const isNew = _isNewByDate(item.releaseDate);

    const saved = !!item.__inLibrary;
    const saving = !!item.__saving;

    return `
      <article class="explore-card" data-eid="${item.eid}" tabindex="0" role="button" aria-haspopup="dialog">
        ${_cardCover(title)}

        <div class="explore-body">
          <div class="explore-top">
            <div class="explore-title-row">
              <h3 class="explore-title">${title}</h3>

              <div class="explore-badges">
                ${isNew ? _chipSvgNew() : ""}
                ${item.__inLibrary ? `<span class="explore-chip">En biblioteca</span>` : ""}
                ${item.__listsCount > 0
                  ? `<span class="explore-chip">En ${item.__listsCount} lista${item.__listsCount > 1 ? "s" : ""}</span>`
                  : ""}
              </div>
            </div>

            <div class="explore-meta">
              <span class="explore-type">${typeLabel}</span>
              ${item.releaseDate ? `<span class="explore-dot" aria-hidden="true"></span><span class="explore-date">${_safeText(item.releaseDate)}</span>` : ""}
            </div>

            ${item.summary ? `<p class="explore-summary">${_safeText(item.summary)}</p>` : ""}
          </div>

          <div class="explore-actions">
            <button class="btn-primary explore-add-lib"
              type="button"
              data-action="add-library"
              ${saved ? "disabled" : ""}
              ${saving ? "disabled" : ""}>
              ${saving ? "Añadiendo..." : (saved ? "En biblioteca" : (__addToListMode?.listId ? "Añadir y guardar" : "Añadir a biblioteca"))}
            </button>

            <button class="btn-ghost explore-add-list"
              type="button"
              data-action="add-lists"
              ${(saving || __addToListMode?.listId) ? "disabled" : ""}>
              ${__addToListMode?.listId ? "Modo lista activo" : "Añadir a listas"}
            </button>

            <button class="btn-ghost explore-hide"
              type="button"
              data-action="dismiss"
              ${saving ? "disabled" : ""}>
              Ocultar
            </button>
          </div>
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

    const back = __drawerLastFocusEl;
    __drawerLastFocusEl = null;
    if (back && typeof back.focus === "function") {
      requestAnimationFrame(() => back.focus());
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

    const keySet = new Set(
      lib.map(i => `${_norm(i.title)}::${_safeText(i.type)}`)
    );

    // marcar si está en biblioteca
    feed = feed.map(x => {
      const key = `${_norm(x.title)}::${_safeText(x.type)}`;
      return { ...x, __inLibrary: keySet.has(key) };
    });

    // contar listas (en bloque, sin 1 llamada por item)
    let countMap = {};
    try {
      countMap = await ApiClient.getListsCountMapByLibraryKey();
      if (!countMap || typeof countMap !== "object") countMap = {};
    } catch (e) {
      console.error(e);
      countMap = {};
    }

    for (const item of feed) {
      if (!item.__inLibrary) {
        item.__listsCount = 0;
        continue;
      }

      const key = `${_norm(item.title)}::${_safeText(item.type)}`;
      item.__listsCount = Number(countMap[key] || 0);
    }
  }

  async function load() {
    _setExploreLoading(true);
    _renderExploreSkeleton();

    try {
      feed = await ApiClient.getExploreFeed();
      if (!Array.isArray(feed)) feed = [];
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
    // si ya está guardado, no hacemos nada
    if (item.__inLibrary) return { ok: true, createdId: null };

    const cardElBefore = document.querySelector(`.explore-card[data-eid="${String(item.eid)}"]`);

    const eid = item.eid;
    feed = feed.map(x => x.eid === eid ? { ...x, __saving: true } : x);
    _applyFilters();

    try {
      // Creamos item en biblioteca desde Explore
      const payload = {
        title: item.title,
        type: item.type,
        progress: 0
      };

      const created = await ApiClient.createLibraryItem(payload);

      // refrescamos flags
      await _syncInLibraryFlags();

      // toast
      window.toast?.({
        title: "Añadido a biblioteca",
        message: "Se ha guardado en tu biblioteca.",
        type: "success",
        duration: 2400
      });

      // Refrescar Biblioteca para que se vea sin F5
      if (window.LibraryUI?.load) {
        try {
          await window.LibraryUI.load();
        } catch (e) {
          console.error("No se pudo refrescar LibraryUI tras añadir desde Explore", e);
        }
      }

      // quitar saving
      feed = feed.map(x => x.eid === eid ? { ...x, __saving: false } : x);
      _applyFilters();

      // UX: animar badge "En biblioteca" en la card
      requestAnimationFrame(() => {
        const cardElAfter = document.querySelector(`.explore-card[data-eid="${String(item.eid)}"]`);
        _popExploreBadge(cardElAfter || cardElBefore);
      });

      return { ok: true, createdId: created?.id ?? null };

    } catch (err) {
      console.error(err);

      feed = feed.map(x => x.eid === eid ? { ...x, __saving: false } : x);
      _applyFilters();

      window.toast?.({
        title: "No se pudo añadir",
        message: "Inténtalo de nuevo.",
        type: "error",
        duration: 3000
      });

      return { ok: false, createdId: null };
    }
  }

  async function _findLibraryItemIdByTitleType(title, type) {
    try {
      const lib = await ApiClient.getLibrary();
      const hit = (lib || []).find(i =>
        _norm(i.title) === _norm(title) && _safeText(i.type) === _safeText(type)
      );
      return hit?.id ?? null;
    } catch (e) {
      console.error(e);
      return null;
    }
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

  function _popExploreBadge(cardEl) {
    if (!cardEl) return;
    const badge = cardEl.querySelector(".explore-chip");
    if (!badge) return;

    badge.classList.remove("is-pop");
    // forzar reflow para reiniciar animación
    void badge.offsetWidth;
    badge.classList.add("is-pop");
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
    // Activar modo "añadir a lista" cuando venimos desde Listas
    document.addEventListener("quacker:lists-add-mode", (e) => {
      const listId = e?.detail?.listId ? String(e.detail.listId) : null;
      const listName = e?.detail?.listName ? String(e.detail.listName) : null;

      __addToListMode = listId ? { listId, listName, addedCount: 0 } : null;

      _renderAddToListModeChip();
      _renderDrawerAddCtaLabel();

      // Si no viene nombre, lo resolvemos
      if (__addToListMode?.listId && !__addToListMode.listName) {
        _hydrateAddToListModeName();
      }
    });

    // Botón "Cancelar" del chip
    const cancel = document.getElementById("exploreAddToListCancel");
    if (cancel && !cancel.dataset.bound) {
      cancel.dataset.bound = "1";
      cancel.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();

        _exitAddToListMode({ clearLastAdd: true });

        window.toast?.({
          title: "Modo cancelado",
          message: "Ya no se añadirá contenido a una lista automáticamente.",
          type: "info",
          duration: 2200
        });
      });
    }

    // Botón "Volver" del chip (vuelve a la lista y reabre detalle)
    const back = document.getElementById("exploreAddToListBack");
    if (back && !back.dataset.bound) {
      back.dataset.bound = "1";
      back.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();

        if (!__addToListMode?.listId) return;

        const last = window.__quackerLastListAdd;

        // UX: si el drawer está abierto, lo cerramos antes de saltar a Listas
        _closeExploreDrawer();

        document.dispatchEvent(new CustomEvent("quacker:lists-open-detail", {
          detail: {
            listId: String(__addToListMode.listId),
            highlightItemId: (last && String(last.listId) === String(__addToListMode.listId))
              ? String(last.itemId)
              : null
          }
        }));
      });
    }

    // Botón "Finalizar" del chip (vuelve a la lista y apaga el modo)
    const finish = document.getElementById("exploreAddToListFinish");
    if (finish && !finish.dataset.bound) {
      finish.dataset.bound = "1";
      finish.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();

        if (!__addToListMode?.listId) return;

        const listId = String(__addToListMode.listId);
        const last = window.__quackerLastListAdd;

        // UX: cerrar drawer si está abierto
        _closeExploreDrawer();

        // Preparamos el highlight antes de apagar el modo
        const highlightItemId =
          (last && String(last.listId) === listId) ? String(last.itemId) : null;

        _exitAddToListMode({ clearLastAdd: true });

        // Volver a la lista con highlight
        document.dispatchEvent(new CustomEvent("quacker:lists-open-detail", {
          detail: { listId, highlightItemId }
        }));

        window.toast?.({
          title: "Modo finalizado",
          message: "Ya no se añadirá contenido a una lista automáticamente.",
          type: "info",
          duration: 2200
        });
      });
    }

    // filtros pills
    document.addEventListener("click", (e) => {
    const btn = e.target.closest('.explore-pills .pill-btn[data-value]');
    if (!btn) return;

    typeFilter = btn.dataset.value || "all";
    btn.parentElement.querySelectorAll(".pill-btn").forEach(b => b.classList.toggle("active", b === btn));
    expandedSection = null;
    sectionShownCount = { novedades: 0, tendencias: 0, recomendados: 0 };
    _saveUIState(); // no esperamos; guardado en segundo plano
    _scheduleApplyFilters();
    });

    // secciones: Ver más / Volver
    document.addEventListener("click", (e) => {
      const btn = e.target.closest("button[data-explore-section-action]");
      if (!btn) return;

      const action = btn.dataset.exploreSectionAction;

      if (action === "expand") {
        expandedSection = btn.dataset.section || null;
        _render();

        const sectionEl = document.querySelector(`.explore-section[data-section="${expandedSection}"]`);
        sectionEl?.scrollIntoView({ behavior: "smooth", block: "start" });

        return;
      }

      if (action === "load-more") {
        const key = btn.dataset.section;
        if (!key) return;

        sectionShownCount[key] = (sectionShownCount[key] || 0) + LOAD_MORE_STEP;
        _render();

        // mantener el scroll en la sección
        const sectionEl = document.querySelector(`.explore-section[data-section="${key}"]`);
        sectionEl?.scrollIntoView({ behavior: "smooth", block: "start" });

        return;
      }

      if (action === "collapse") {
        expandedSection = null;
        _render();
        return;
      }
    });

    // Evita que clicks dentro del panel afecten a listeners globales
    document.getElementById("exploreDrawer")?.addEventListener("click", (e) => {
      e.stopPropagation();
    });

    // Drawer: focus trap (Tab se queda dentro)
    if (!document.documentElement.dataset.drawerTrapBound) {
      document.documentElement.dataset.drawerTrapBound = "1";
      document.addEventListener("keydown", _trapFocusKeydown, true);
    }

    // Drawer: cerrar (evitar que el click “caiga” en la card de debajo y lo reabra)
    document.getElementById("exploreDrawerClose")?.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      _closeExploreDrawer();
    });

    document.getElementById("exploreDrawerBackdrop")?.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      _closeExploreDrawer();
    });

    // Drawer: cerrar con Escape
    if (!document.documentElement.dataset.drawerEscBound) {
      document.documentElement.dataset.drawerEscBound = "1";
      document.addEventListener("keydown", (e) => {
        if (!__drawerOpen) return;
        if (e.key === "Escape") {
          e.preventDefault();
          _closeExploreDrawer();
        }
      });
    }

    // Explorar: abrir drawer con teclado en la card (Enter / Espacio)
    const exploreRoot = document.getElementById("view-explore");
    if (exploreRoot && !exploreRoot.dataset.keyOpenBound) {
      exploreRoot.dataset.keyOpenBound = "1";

      exploreRoot.addEventListener("keydown", (e) => {
        // Solo cuando el foco está en una card
        const card = e.target?.closest?.(".explore-card");
        if (!card) return;

        // Si el evento viene desde un control interactivo, no hacemos nada
        if (e.target.closest("button, a, input, select, textarea")) return;

        const key = e.key;

        if (key === "Enter" || key === " ") {
          e.preventDefault();
          e.stopPropagation();

          // Simular el mismo flujo que el click en la card:
          // 1) localizar item por eid
          const eid = card.dataset.eid;
          const item = feed.find((x) => _safeText(x.eid) === _safeText(eid));
          if (!item) return;

          // 2) reusar el mismo render de drawer que ya usas en click
          //    Si tu click handler ya llama a una función tipo _renderDrawer(item),
          //    aquí llama a esa misma.
          //    Si no, esto delega: dispara un click programático en la card.
          card.click();
        }
      });
    }

    // busqueda global (topbar) - solo cuando Explore esta activo
    const global = document.getElementById("globalSearch");
    if (global) { 
        global.addEventListener("input", (e) => {
            const isExploreActive = document.querySelector("#view-explore")?.classList.contains("is-active");
            if (!isExploreActive) return;

            searchTerm = (e.target.value || "").trim();
            expandedSection = null;
            sectionShownCount = { novedades: 0, tendencias: 0, recomendados: 0 };
            _saveUIState(); // no esperamos; guardado en segundo plano
            _scheduleApplyFilters();
        });
    }
    
    // sort
    const sort = document.getElementById("exploreSort");
    if (sort) {
    sort.addEventListener("change", (e) => {
        sortMode = e.target.value || "recent";
        expandedSection = null;
        sectionShownCount = { novedades: 0, tendencias: 0, recomendados: 0 };
        _saveUIState(); // no esperamos; guardado en segundo plano
        _scheduleApplyFilters();
    });
    }

    // acciones cards (delegación)
    document.addEventListener("click", async (e) => {

    const cardClick = e.target.closest(".explore-card");
    if (cardClick && !e.target.closest("button")) {
      const eid = cardClick.dataset.eid;
      const item = feed.find(x => _safeText(x.eid) === _safeText(eid));
      if (!item) return;

      // Guardamos activo para botones del drawer
      activeEid = item.eid;

      // Pintar contenido del drawer usando tus IDs actuales
      const cover = document.getElementById("exploreDrawerCover");
      const title = document.getElementById("exploreDrawerTitle");
      const meta = document.getElementById("exploreDrawerMeta");
      const summary = document.getElementById("exploreDrawerSummary");
      const badge = document.getElementById("exploreDrawerBadge");

      if (cover) {
        const initials = (item.title || "Q").trim().slice(0, 1).toUpperCase();
        cover.textContent = initials;
      }
      if (title) title.textContent = item.title || "Sin título";

      const typeLabel = (TYPE_LABELS[item.type] || "Contenido");
      const dateLabel = item.releaseDate ? item.releaseDate : "";

      if (meta) {
        meta.innerHTML = `
          <span class="explore-chip">${typeLabel}</span>
          ${dateLabel ? `<span class="explore-chip">${_safeText(dateLabel)}</span>` : ""}
        `;
      }

      if (summary) summary.textContent = item.summary || "Sin descripción.";
      if (badge) badge.innerHTML = _isNewByDate(item.releaseDate) ? _chipSvgNew() : "";

      // Reset nota inline del drawer antes de pintar contenido
      _clearDrawerInlineNote();

      // Nota: en modo "añadir a lista", avisamos dónde se guardará
      if (__addToListMode?.listId) {
        const name = (__addToListMode.listName || "la lista").trim();
        _showDrawerInlineNotePersistent(`Se guardará en: ${name}`);
      }

      const btnLib = document.getElementById("exploreDrawerAddLibrary");
      const btnLists = document.getElementById("exploreDrawerAddLists");
      if (btnLib) {
        const saved = !!item.__inLibrary;
        const saving = !!item.__saving;
        btnLib.disabled = saved || saving;
        btnLib.textContent = saving ? "Añadiendo..." : (saved ? "En biblioteca" : "Añadir a biblioteca");
      }
      _renderDrawerAddCtaLabel();
      if (btnLists) {
        btnLists.disabled = !!item.__saving || !!__addToListMode?.listId;
      }

      // Abrir drawer premium y devolver foco al cerrar
      _openExploreDrawer(cardClick);
      return;
    }

    const actionBtn = e.target.closest(".explore-card button[data-action]");
    if (!actionBtn) return;

    const card = actionBtn.closest(".explore-card");
    const eid = card?.dataset?.eid;
    if (!eid) return;

    const item = feed.find(x => _safeText(x.eid) === _safeText(eid));
    if (!item) return;

    const action = actionBtn.dataset.action;

    if (action === "add-library") {
      const res = await _ensureInLibrary(item);
      if (!res?.ok) return;

      // Feedback inmediato en la card (sin esperar a un re-render completo)
      const cardEl = actionBtn.closest(".explore-card");
      if (cardEl) {
        cardEl.classList.remove("is-pop");
        requestAnimationFrame(() => cardEl.classList.add("is-pop"));
      }

      // Actualizar CTA de la card con tick temporal y luego "En biblioteca"
      if (actionBtn) {
        actionBtn.disabled = true;
        actionBtn.innerHTML = `  Guardado `;
        window.setTimeout(() => {
          if (!document.body.contains(actionBtn)) return;
          actionBtn.innerHTML = "En biblioteca";
        }, 650);
      }

      // Si estamos en modo "añadir a lista", añadimos automáticamente
      if (__addToListMode?.listId) {
        const libraryId =
          res.createdId ||
          await _findLibraryItemIdByTitleType(item.title, item.type);

        if (libraryId) {
          try {
            await ApiClient.addLibraryItemToList(__addToListMode.listId, libraryId);

            if (__addToListMode?.listId) {
              __addToListMode.addedCount = Number(__addToListMode.addedCount || 0) + 1;
              _renderAddToListModeChip();
            }

            const listName = (__addToListMode?.listName || "la lista").trim();
            const total = Number(__addToListMode?.addedCount || 0);

            window.toast?.({
              title: "Guardado en lista",
              message: `Se ha guardado en: ${listName}. Total en esta sesión: ${total}.`,
              type: "success",
              duration: 3200
            });

            window.__quackerLastListAdd = {
              listId: String(__addToListMode.listId),
              itemId: String(libraryId)
            };

          } catch (e) {
            console.error(e);
            window.toast?.({
              title: "No se pudo añadir a la lista",
              message: "Inténtalo de nuevo.",
              type: "error",
              duration: 3000
            });
          }
        }
      }

      return;
    }

    if (action === "dismiss") {
      try {
        await ApiClient.dismissExploreItem(item.eid);
        dismissed.add(String(item.eid));

        // Si había un debounce pendiente (tecleo/filtros), lo cancelamos para evitar re-render extra
        if (__applyTimer) {
          clearTimeout(__applyTimer);
          __applyTimer = null;
        }
        if (__loadingMinTimer) {
          clearTimeout(__loadingMinTimer);
          __loadingMinTimer = null;
        }
        _setExploreLoading(false);

        // animación rápida de salida
        const cardEl = document.querySelector(`.explore-card[data-eid="${String(item.eid)}"]`);
        if (cardEl) {
          cardEl.style.transition = "transform 160ms ease, opacity 160ms ease";
          cardEl.style.opacity = "0";
          cardEl.style.transform = "translateY(6px)";
          setTimeout(() => {
            _applyFilters();
          }, 170);
        } else {
          _applyFilters();
        }

        window.toast?.({
          title: "Actualizado",
          message: "Ocultado de Explorar.",
          type: "success",
          duration: 2200
        });
      } catch (e) {
        console.error(e);
        window.toast?.({
          title: "No se pudo ocultar",
          message: "Inténtalo de nuevo.",
          type: "error",
          duration: 3000
        });
      }
      return;
    }

    if (action === "add-lists") {
      // 1) asegurar biblioteca
      const res = await _ensureInLibrary(item);
      if (!res.ok) return;

      // 2) buscar id real de library (por si createLibraryItem no devuelve id)
      const id = res.createdId || await _findLibraryItemIdByTitleType(item.title, item.type);
      if (!id) {
      window.toast?.({
        title: "No se pudo preparar",
        message: "Inténtalo de nuevo.",
        type: "error",
        duration: 3000
      });
      return;
      }

      // 3) abrir modal multi-lista existente (lo tienes en library.js)
      if (typeof window.openAddToListModal === "function") {
      window.openAddToListModal(id);
      } else if (typeof openAddToListModal === "function") {
      openAddToListModal(id);
      } else {
      window.toast?.({
        title: "No disponible",
        message: "No se encontró el selector de listas.",
        type: "error",
        duration: 3000
      });
      }
      return;
    }
    });

    document.getElementById("exploreDrawerAddLibrary")?.addEventListener("click", async () => {
      if (!activeEid) return;

      const btnLib = document.getElementById("exploreDrawerAddLibrary");
      if (!btnLib) return;

      const item = feed.find(x => _safeText(x.eid) === _safeText(activeEid));
      if (!item || item.__saving) return;

      // Preparar botón
      btnLib.classList.add("drawer-btn");
      const originalText = btnLib.textContent;

      // Loading ON
      _setDrawerButtonLoading(btnLib, true);
      btnLib.textContent = "Guardando…";
      btnLib.dataset.busy = "1";

      try {
        await _ensureInLibrary(item);
        // Si estamos en modo "añadir a lista", añadir automáticamente
        if (__addToListMode?.listId) {
          const libraryId =
            await _findLibraryItemIdByTitleType(item.title, item.type);

          if (libraryId) {
            try {
              await ApiClient.addLibraryItemToList(__addToListMode.listId, libraryId);

              if (__addToListMode?.listId) {
                __addToListMode.addedCount = Number(__addToListMode.addedCount || 0) + 1;
                _renderAddToListModeChip();
              }

              const listName = (__addToListMode?.listName || "la lista").trim();
              _showDrawerInlineNote(`Guardado en: ${listName}`);

              const total = Number(__addToListMode?.addedCount || 0);

              window.toast?.({
                title: "Guardado en lista",
                message: `Se ha guardado en: ${listName}. Total en esta sesión: ${total}.`,
                type: "success",
                duration: 3200
              });

              // Mantener el modo activo para permitir añadir varios contenidos seguidos.
              // Guardamos el último item añadido para poder resaltarlo al volver a la lista.
              window.__quackerLastListAdd = {
                listId: String(__addToListMode.listId),
                itemId: String(libraryId)
              };
            } catch (e) {
              console.error(e);
              window.toast?.({
                title: "No se pudo añadir a la lista",
                message: "Inténtalo de nuevo.",
                type: "error",
                duration: 3000
              });
            }
          }
        }
      } finally {
        // Loading OFF
        _setDrawerButtonLoading(btnLib, false);
        btnLib.dataset.busy = "0";

        // Estado final real
        const refreshed = feed.find(x => _safeText(x.eid) === _safeText(activeEid));
        btnLib.textContent = refreshed?.__inLibrary
          ? "En biblioteca"
          : originalText;

        _renderDrawerAddCtaLabel();
        btnLib.disabled = !!refreshed?.__inLibrary;
        if (refreshed?.__inLibrary) _showDrawerInlineNote("Añadido a tu biblioteca");
      }
    });

    document.getElementById("exploreDrawerAddLists")?.addEventListener("click", async () => {
        if (!activeEid) return;
        const item = feed.find(x => _safeText(x.eid) === _safeText(activeEid));
        if (!item) return;

        const res = await _ensureInLibrary(item);
        if (!res.ok) return;

        const id = res.createdId || await _findLibraryItemIdByTitleType(item.title, item.type);
        if (!id) {
            window.toast?.({
              title: "No se pudo preparar",
              message: "Inténtalo de nuevo.",
              type: "error",
              duration: 3000
            });
            return;
        }

        _closeExploreDrawer();

        if (typeof window.openAddToListModal === "function") {
            window.openAddToListModal(id);
        } else {
            window.toast?.({
              title: "No disponible",
              message: "No se encontró el selector de listas.",
              type: "error",
              duration: 3000
            });
        }
    });

    document.getElementById("exploreClearDismissed")?.addEventListener("click", async () => {
        try {
            await ApiClient.clearExploreDismissed();
            dismissed = new Set();
            await load();
            window.toast?.({
              title: "Explorar restablecido",
              message: "Se han recuperado los contenidos ocultados.",
              type: "success",
              duration: 2200
            });
        } catch (e) {
          console.error(e);
          window.toast?.({
            title: "No se pudo restablecer",
            message: "Inténtalo de nuevo.",
            type: "error",
            duration: 3000
          });
        }
    });

    // Cuando cambian listas desde otras vistas (Biblioteca / Listas),
    // refrescamos contadores "En X listas" sin recargar el feed.
    if (!__listsChangedBound) {
      __listsChangedBound = true;

      document.addEventListener("quacker:lists-changed", async () => {
        try {
          const isExploreActive =
            document.querySelector("#view-explore")?.classList.contains("is-active");
          if (!isExploreActive) return;

          await _syncInLibraryFlags();
          _scheduleApplyFilters();
        } catch (e) {
          console.error("Explore: no se pudo refrescar tras lists-changed", e);
        }
      });
    }

    // Empty state: restablecer filtros + búsqueda
    const emptyReset = document.getElementById("exploreEmptyReset");
    if (emptyReset && !emptyReset.dataset.bound) {
      emptyReset.dataset.bound = "1";

      emptyReset.addEventListener("click", () => {
        // Reset estado
        typeFilter = "all";
        sortMode = "recent";
        searchTerm = "";
        expandedSection = null;
        sectionShownCount = { novedades: 0, tendencias: 0, recomendados: 0 };

        // Reset UI (pills)
        document.querySelectorAll(".explore-pills .pill-btn[data-value]").forEach((b) => {
          b.classList.toggle("active", (b.dataset.value || "all") === "all");
        });

        // Reset UI (sort)
        const sortSel = document.getElementById("exploreSort");
        if (sortSel) sortSel.value = "recent";

        // Reset UI (buscador global cuando estamos en Explorar)
        const global = document.getElementById("globalSearch");
        if (global) global.value = "";

        _saveUIState();
        _scheduleApplyFilters();

        // UX: volver arriba
        const view = document.getElementById("view-explore");
        view?.scrollTo?.({ top: 0, behavior: "smooth" });
        view?.scrollIntoView?.({ behavior: "smooth", block: "start" });
      });
    }

  }

  function init() {
    // Cargamos UI state persistente (async) y luego bindeamos/renderizamos
    (async () => {
      await _loadUIState();
      bind();

      // Cargar Explore cuando el router active la vista
      if (!__viewChangeBound) {
        __viewChangeBound = true;

        document.addEventListener("quacker:view-change", (e) => {
          // Si salimos de Explorar, limpiamos el modo "añadir a lista" y ocultamos el chip
          if (e.detail?.viewId !== "explore") {
            _exitAddToListMode({ clearLastAdd: true });
            return;
          }

          // Entramos en Explorar: pintar chip + CTA según el modo actual
          _renderAddToListModeChip();
          _renderDrawerAddCtaLabel();
          _hydrateAddToListModeName();

          if (e.detail?.viewId !== "explore") return;

          // Sincroniza el buscador global con el término actual de Explore
          const global = document.getElementById("globalSearch");
          if (global) global.value = searchTerm;

          // Carga feed + render
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
