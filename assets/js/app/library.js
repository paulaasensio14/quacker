// assets/js/app/library.js
// UI de “Mi Biblioteca” (filtros + búsqueda + orden + render)

let __progressModalLastFocus = null;
let __addLibraryModalLastFocus = null;
let __addToListModalLastFocus = null;

const LIBRARY_FILTERS_KEY = "quacker_library_filters";

function saveLibraryFilters() {
  try {
    const activeType = document.querySelector(".lib-type-pill.active")?.dataset.type || "all";
    const activeStatus = document.querySelector(".lib-status-pill.active")?.dataset.status || "all";
    const sort = document.getElementById("librarySort")?.value || "recent";

    localStorage.setItem(
      LIBRARY_FILTERS_KEY,
      JSON.stringify({
        type: activeType,
        status: activeStatus,
        sort
      })
    );
  } catch (_) {}
}

function loadLibraryFilters() {
  try {
    const raw = localStorage.getItem(LIBRARY_FILTERS_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (_) {
    return null;
  }
}

function _showAddLibError(msg = "") {
  const box = document.getElementById("addLib_errors");
  if (!box) return;
  box.style.display = msg ? "block" : "none";
  box.textContent = msg || "";
}

function openAddLibraryModal() {
  const modal = document.getElementById("addLibraryModal");
  if (!modal) return;

  _showAddLibError("");
  __addLibraryModalLastFocus = document.activeElement;

  const titleInput = document.getElementById("addLib_title");
  const typeSelect = document.getElementById("addLib_type");

  if (titleInput) titleInput.value = "";
  if (typeSelect) typeSelect.value = "serie";

  if (window.UIModal && typeof window.UIModal.open === "function") {
    window.UIModal.open(modal, {
      initialFocusSelector: "#addLib_title",
      lastFocusEl: __addLibraryModalLastFocus
    });
    return;
  }

  modal.classList.add("is-open");
  modal.setAttribute("aria-hidden", "false");
  document.body.classList.add("modal-open");

  requestAnimationFrame(() => {
    if (titleInput && typeof titleInput.focus === "function") {
      titleInput.focus();
    }
  });
}

function closeAddLibraryModal() {
  const modal = document.getElementById("addLibraryModal");
  if (!modal) return;

  if (window.UIModal && typeof window.UIModal.close === "function") {
    window.UIModal.close(modal);
  } else {
    modal.classList.remove("is-open");
    modal.setAttribute("aria-hidden", "true");
    document.body.classList.remove("modal-open");

    if (__addLibraryModalLastFocus && typeof __addLibraryModalLastFocus.focus === "function") {
      requestAnimationFrame(() => __addLibraryModalLastFocus.focus());
    }
  }

  __addLibraryModalLastFocus = null;
  _showAddLibError("");
}

function _showAddToListError(msg = "") {
  const box = document.getElementById("atl_errors");
  if (!box) return;
  box.style.display = msg ? "block" : "none";
  box.textContent = msg || "";
}

async function openAddToListModal(itemId) {
  const modal = document.getElementById("addToListModal");
  const optionsEl = document.getElementById("atl_listOptions");
  if (!modal || !optionsEl) return;

  _showAddToListError("");
  modal.dataset.itemId = String(itemId || "");

  // Defensivo: si el modal se abre desde un flujo que no viene de click directo
  if (!__addToListModalLastFocus) {
    __addToListModalLastFocus = document.activeElement;
  }

  let lists = [];
  try {
    lists = await ApiClient.getLists();
  } catch (e) {
    console.error(e);
    lists = [];
  }

  // Deshabilitar listas donde ya está el item
  let alreadyIn = [];
  try {
    alreadyIn = await ApiClient.getListsContainingItem(itemId);
  } catch (e) {
    console.error(e);
    alreadyIn = [];
  }
  const alreadyIds = new Set((alreadyIn || []).map(l => String(l.id)));

  optionsEl.innerHTML = "";

  if (!lists.length) {
    // Empty state dentro del modal (en vez de solo error)
    _showAddToListError("");

    optionsEl.innerHTML = `
      <div class="atl-empty" role="status" aria-live="polite">
        <div class="atl-empty-icon" aria-hidden="true">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
            <path d="M8 6h13M8 12h13M8 18h13" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
            <path d="M3.5 6h.01M3.5 12h.01M3.5 18h.01" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>
          </svg>
        </div>
        <div class="atl-empty-title">Aún no tienes listas</div>
        <div class="atl-empty-sub">Crea una lista para poder guardar este contenido y organizar tu ocio.</div>
        <button type="button" class="btn-primary" id="atlCreateListBtn">Crear lista</button>
      </div>
    `;

    const confirmBtn = document.getElementById("confirmAddToListModal");
    if (confirmBtn) confirmBtn.disabled = true;

    const createBtn = document.getElementById("atlCreateListBtn");
    createBtn?.addEventListener("click", () => {
      // 1) Cerrar este modal
      closeAddToListModal();

      // 2) Navegar a "Listas" usando el botón del sidebar para mantener el estado activo
      const listsNavBtn = document.querySelector('.nav-item-btn[data-view="lists"]');
      if (listsNavBtn) listsNavBtn.click();
      else window.Router?.showView?.("lists");

      // 3) Pedir a ListsModule que abra el modal de crear (cuando esté visible)
      requestAnimationFrame(() => {
        document.dispatchEvent(new CustomEvent("quacker:lists-create-request", {
          detail: { returnToAddToListItemId: itemId }
        }));
      });
    });

  } else {
    lists.forEach((l) => {
      const id = String(l.id);
      const name = l.name || "Sin nombre";
      const isAlready = alreadyIds.has(id);

      const row = document.createElement("label");
      row.className = "atl-option";

      const cb = document.createElement("input");
      cb.type = "checkbox";
      cb.value = id;
      cb.disabled = isAlready;
      cb.checked = false;

      // Si acabamos de crear una lista desde este flujo, la preseleccionamos
      if (window.__quackerPreselectListId && String(window.__quackerPreselectListId) === id && !isAlready) {
        cb.checked = true;
      }

      const text = document.createElement("span");
      text.className = "atl-option-text";
      text.textContent = isAlready ? `${name} (ya está)` : name;

      row.appendChild(cb);
      row.appendChild(text);
      optionsEl.appendChild(row);
    });

    const confirmBtn = document.getElementById("confirmAddToListModal");
    if (confirmBtn) confirmBtn.disabled = false;

    // Limpiamos la preselección después de pintar la lista
    window.__quackerPreselectListId = null;
  }

  window.UIModal?.open(modal, {
    initialFocusSelector: "#confirmAddToListModal",
    lastFocusEl: __addToListModalLastFocus
  });

  // foco: primera opción seleccionable si existe
  setTimeout(() => {
    const firstEnabled = optionsEl.querySelector('input[type="checkbox"]:not(:disabled)');
    firstEnabled?.focus?.();
  }, 0);
}

function closeAddToListModal() {
  const modal = document.getElementById("addToListModal");
  if (!modal) return;

  window.UIModal?.close(modal);
  modal.dataset.itemId = "";
  __addToListModalLastFocus = null;

  _showAddToListError("");
}

const LibraryUI = (() => {
  const savedFilters = loadLibraryFilters();

  if (savedFilters) {
    requestAnimationFrame(() => {
      const typeBtn = document.querySelector(`.lib-type-pill[data-type="${savedFilters.type}"]`);
      if (typeBtn) typeBtn.click();

      const statusBtn = document.querySelector(`.lib-status-pill[data-status="${savedFilters.status}"]`);
      if (statusBtn) statusBtn.click();

      const sortSelect = document.getElementById("librarySort");
      if (sortSelect && savedFilters.sort) {
        sortSelect.value = savedFilters.sort;
        sortSelect.dispatchEvent(new Event("change"));
      }
    });
  }

  const TYPE_LABELS = {
    serie: "Serie",
    pelicula: "Película",
    book: "Libro",
    game: "Videojuego"
  };

  const IN_PROGRESS = new Set(["watching", "reading", "playing", "in_progress"]);

  function logicalStatus(item) {
    const pct = Number(item?.progress ?? 0);

    // completado manda siempre
    if (pct >= 100 || item?.status === "completed") return "completed";

    // si aún no ha empezado (0%), da igual si puso "watching" por error:
    // para el usuario sigue siendo "No empezado"
    if (pct <= 0) return "not_started";

    // si hay progreso pero no está al 100, es "en progreso"
    return "in_progress";
  }

  let allItems = [];
  let itemsInAnyList = new Set();
  let typeFilter = "all";
  let statusFilter = "all";
  let sortMode = "recent";
  let searchTerm = "";

  async function _saveUIState() {
    try {
      await ApiClient.setLibraryUIState?.({
        sortMode,
        typeFilter,
        statusFilter,
        searchTerm
      });
    } catch (e) {
      console.error("LibraryUI: no se pudo guardar UI state", e);
    }
  }

  function statusToLabel(item) {
    const st = logicalStatus(item);

    if (st === "completed") return "Completado";
    if (st === "not_started") return "No empezado";
    return "En progreso";
  }

  function progressText(item) {
    const pct = Number(item.progress ?? 0);

    if (pct >= 100 || item.status === "completed") {
      if (item.type === "book") return "Libro completado";
      if (item.type === "serie") return "Serie completada";
      if (item.type === "game") return "Juego completado";
      if (item.type === "pelicula") return "Película completada";
      return "Completado";
    }

    if (item.type === "serie" && item.meta) {
      const s = item.meta.season || 1;
      const e = item.meta.episode || 1;
      return `T${s} · E${e} · ${pct}%`;
    }

    if (item.type === "book" && item.meta?.pagesRead && item.meta?.totalPages) {
      return `${item.meta.pagesRead}/${item.meta.totalPages} páginas`;
    }

    return `${pct}% completado`;
  }

  function formatLibraryMeta(item) {
    const type = item?.type || "";
    const meta = item?.meta || {};

    if (type === "serie") {
      const s = Number(meta.season || 0);
      const e = Number(meta.episode || 0);
      if (s > 0 && e > 0) return `T${s} · E${e}`;
      return "";
    }

    if (type === "book") {
      const read = Number(meta.pagesRead || 0);
      const total = Number(meta.totalPages || 0);
      if (total > 0) return `${read} / ${total} páginas`;
      return "";
    }

    if (type === "pelicula" || type === "game") {
      const pct = Math.max(0, Math.min(100, Number(item.progress ?? 0)));
      return pct ? `${pct}%` : "";
    }

    return "";
  }

  function primaryButtonLabel(item) {
    const st = logicalStatus(item);
    if (st === "completed") return "";
    if (st === "not_started") return "Empezar";
    return "Continuar";
  }

  function normalizeSearchText(value) {
    return String(value || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .trim()
      .replace(/\s+/g, " ");
  }

  function matchesFilters(item) {
    if (typeFilter !== "all" && item.type !== typeFilter) return false;

    const st = logicalStatus(item);
    if (statusFilter !== "all" && st !== statusFilter) return false;

    // búsqueda
    if (searchTerm) {
      const q = normalizeSearchText(searchTerm);
      const haystack = normalizeSearchText([
        item.title,
        item.meta?.author,
        item.meta?.studio,
        item.meta?.year
      ].filter(Boolean).join(" "));

      if (!haystack.includes(q)) return false;
    }

    return true;
  }

  function sortItems(items) {
    const arr = items.slice();

    function recentTs(item) {
      return new Date(item.updatedAt || item.createdAt || 0).getTime();
    }

    function createdTs(item) {
      return new Date(item.createdAt || 0).getTime();
    }

    function titleText(item) {
      return String(item.title || "").toLocaleLowerCase("es");
    }

    function stableCompare(a, b) {
      const byTitle = titleText(a).localeCompare(titleText(b), "es");
      if (byTitle !== 0) return byTitle;

      return String(a.id || "").localeCompare(String(b.id || ""), "es");
    }

    if (sortMode === "az") {
      arr.sort((a, b) => stableCompare(a, b));
      return arr;
    }

    if (sortMode === "progress") {
      arr.sort((a, b) => {
        const byProgress = Number(b.progress ?? 0) - Number(a.progress ?? 0);
        if (byProgress !== 0) return byProgress;

        const byRecent = recentTs(b) - recentTs(a);
        if (byRecent !== 0) return byRecent;

        return stableCompare(a, b);
      });
      return arr;
    }

    if (sortMode === "added_desc") {
      arr.sort((a, b) => {
        const byCreated = createdTs(b) - createdTs(a);
        if (byCreated !== 0) return byCreated;

        return stableCompare(a, b);
      });
      return arr;
    }

    if (sortMode === "added_asc") {
      arr.sort((a, b) => {
        const byCreated = createdTs(a) - createdTs(b);
        if (byCreated !== 0) return byCreated;

        return stableCompare(a, b);
      });
      return arr;
    }

    // recent (default): updatedAt / createdAt
    arr.sort((a, b) => {
      const byRecent = recentTs(b) - recentTs(a);
      if (byRecent !== 0) return byRecent;

      const byCreated = createdTs(b) - createdTs(a);
      if (byCreated !== 0) return byCreated;

      return stableCompare(a, b);
    });

    return arr;
  }

  function renderLibrarySkeleton(){
    const grid = document.getElementById("libraryGrid");
    if(!grid) return;

    grid.innerHTML = "";

    for(let i=0;i<8;i++){
      const card = document.createElement("div");
      card.className = "lib-card is-skeleton";

      card.innerHTML = `
        <div class="lib-cover"></div>
        <div class="lib-body">
          <div class="lib-title"></div>
          <div class="lib-meta"></div>
        </div>
      `;

      grid.appendChild(card);
    }
  }

  function render() {
    const grid = $("#libraryGrid");
    if (!grid) return;

    // 1) Filtrado + orden
    const filtered = sortItems(allItems.filter(matchesFilters));

    // 2) Contador inline en topbar (solo en biblioteca)
    const countInline = document.getElementById("libraryCountInline");
    const isLibraryActive = document.querySelector("#view-library")?.classList.contains("is-active");

    if (countInline && isLibraryActive) {
      countInline.style.display = "inline";
      countInline.textContent =
        ` · ${filtered.length} contenido${filtered.length === 1 ? "" : "s"}`;
    }

    if (!isLibraryActive) return;

    // 3) Empty state
    if (!filtered.length) {
      grid.innerHTML = `
        <div style="grid-column:1/-1;color:var(--text-muted);font-size:0.95rem;">
          No hay resultados con estos filtros.
        </div>
      `;
      return;
    }



    // 4) Render de cards
    grid.innerHTML = filtered.map((item) => {
      const pct = Math.max(0, Math.min(100, Number(item.progress ?? 0)));
      const typeName = TYPE_LABELS[item.type] || "Contenido";
      const statusLabel = statusToLabel(item);
      const pText = progressText(item);
      const btnLabel = primaryButtonLabel(item);

      const coverStyle = item.cover
        ? `style="background-image:url('${item.cover}');"`
        : "";

        const isInAnyList = itemsInAnyList.has(String(item.id));

      return `
        <article class="lib-card ${window.__lastCreatedLibraryItemId == item.id ? "is-highlight" : ""}" data-id="${item.id}">
          <div class="lib-cover" ${coverStyle}></div>
          <div class="lib-body">
            <div class="lib-title">${item.title || "Sin título"}</div>
            <div class="lib-type">${typeName}</div>
            ${formatLibraryMeta(item) ? `<div class="lib-meta">${formatLibraryMeta(item)}</div>` : ""}

            <div class="lib-progress-bar">
              <div class="lib-progress-fill" style="width:${pct}%;"></div>
            </div>
            <div class="lib-progress-text">${pText}</div>

              <div class="lib-footer">

                <!-- FILA 1: estado -->
                <div class="lib-status-row">
                  <span class="lib-status ${logicalStatus(item)}">
                    ${statusLabel}
                  </span>
                </div>

                <!-- FILA 2: botones -->
                <div class="lib-footer-actions">
                  <button
                    class="lib-list-btn ${isInAnyList ? "is-added" : ""}"
                    type="button"
                    data-action="add-to-list"
                    data-id="${item.id}"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                      stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"
                      aria-hidden="true" focusable="false">
                      <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path>
                    </svg>
                    <span class="lib-list-label">${isInAnyList ? "En listas" : "Lista"}</span>
                  </button>

                  <button
                    class="lib-edit-btn"
                    type="button"
                    data-action="edit-progress"
                    data-id="${item.id}"
                  >
                    Editar
                  </button>
                
                  ${
                    item.progress < 100
                      ? `<button
                          class="lib-complete-btn"
                          type="button"
                          data-id="${item.id}"
                        >
                          Hecho
                        </button>`
                      : ""
                  }

                  ${
                    btnLabel
                      ? `<button
                          class="lib-primary-btn"
                          type="button"
                          data-action="primary"
                          data-id="${item.id}"
                        >
                          <span>${btnLabel}</span>
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                            stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"
                            aria-hidden="true" focusable="false">
                            <path d="M5 12h13"></path>
                            <path d="M13 6l6 6-6 6"></path>
                          </svg>
                        </button>`
                      : ""
                  }
                </div>

              </div>

            </div>

          </div>
        </article>
      `;
    }).join("");

    // UX: si venimos de una acción que pudo reordenar, mantenemos la card “anclada”
    requestAnimationFrame(() => {
      try { applyLibraryAnchorIfAny(); } catch (_) {}
    });

    if (window.__lastCreatedLibraryItemId) {
      setTimeout(() => {
        window.__lastCreatedLibraryItemId = null;
      }, 1000);
    }
  }

  function setLibraryRefreshing(isRefreshing) {
    const veil = document.getElementById("libRefreshVeil");
    const isLibraryActive = document.querySelector("#view-library")?.classList.contains("is-active");
    if (!veil || !isLibraryActive) return;

    veil.hidden = !isRefreshing;

    const grid = document.getElementById("libraryGrid");
    if (grid) {
      grid.style.pointerEvents = isRefreshing ? "none" : "";
      grid.style.opacity = isRefreshing ? "0.92" : "";
      grid.style.transition = "opacity 0.15s ease";
    }
  }

  async function load() {
    try {
      setLibraryRefreshing(true);
      renderLibrarySkeleton();
      allItems = await ApiClient.getLibrary();

      // Construimos un Set con todos los itemId que ya están en alguna lista
      itemsInAnyList = new Set();
      try {
        const lists = await ApiClient.getLists();
        (lists || []).forEach((l) => {
          const arr = Array.isArray(l.items) ? l.items : [];
          arr.forEach((entry) => {
            const id = typeof entry === "string" ? entry : entry?.id;
            if (id != null) itemsInAnyList.add(String(id));
          });
        });
      } catch (err) {
        console.error("No se pudieron cargar listas para LibraryUI", err);
      }

      render();

    } catch (e) {
      console.error("LibraryUI.load error", e);
    } finally {
      setLibraryRefreshing(false);
    }
  }

  // ===== UX: anclaje para evitar saltos al reordenar (recent) =====
  let __pendingAnchor = null;

  function __getScrollContainer() {
    // Preferimos el scroller real del documento
    const docScroller = document.scrollingElement || document.documentElement;

    // Si la app usa un contenedor scrollable propio, lo detectamos
    const appScroller = document.querySelector("main.app-main");

    return appScroller || docScroller;
  }

  function captureLibraryAnchor(itemId) {
    if (!itemId) return;

    const safeId =
      (window.CSS && CSS.escape) ? CSS.escape(String(itemId)) : String(itemId);

    const card = document.querySelector(`.lib-card[data-id="${safeId}"]`);
    const scroller = __getScrollContainer();

    if (!card) {
      __pendingAnchor = { itemId: String(itemId), prevScrollTop: scroller.scrollTop, prevTop: null };
      return;
    }

    const rect = card.getBoundingClientRect();

    __pendingAnchor = {
      itemId: String(itemId),
      prevScrollTop: scroller.scrollTop,
      prevTop: rect.top
    };
  }

  function applyLibraryAnchorIfAny() {
    if (!__pendingAnchor) return;

    const { itemId, prevScrollTop, prevTop } = __pendingAnchor;
    __pendingAnchor = null;

    const safeId =
      (window.CSS && CSS.escape) ? CSS.escape(String(itemId)) : String(itemId);

    const card = document.querySelector(`.lib-card[data-id="${safeId}"]`);
    const scroller = __getScrollContainer();

    if (!card) return;

    // Si no teníamos rect previo, al menos intentamos mantener scroll estable
    if (prevTop == null) {
      scroller.scrollTop = prevScrollTop;
      flashLibraryCard(itemId);
      return;
    }

    const newTop = card.getBoundingClientRect().top;
    const delta = newTop - prevTop;

    // Ajuste para mantener la card en el mismo sitio visual
    scroller.scrollTop = scroller.scrollTop + delta;

    // Micro-feedback: el ojo la encuentra instantáneo
    flashLibraryCard(itemId);
  }

  function flashLibraryCard(itemId) {
    if (!itemId) return;

    const safeId =
      (window.CSS && CSS.escape) ? CSS.escape(String(itemId)) : String(itemId);

    const card = document.querySelector(`.lib-card[data-id="${safeId}"]`);
    if (!card) return;

    // Limpieza defensiva por si venía de una animación previa
    card.classList.remove("is-removing");
    card.dataset.busy = "0";

    // Re-disparar animación
    card.classList.remove("is-highlight");
    void card.offsetWidth;
    card.classList.add("is-highlight");

    setTimeout(() => {
      card.classList.remove("is-highlight");
    }, 950);
  }

  function setListButtonState(itemId, isAdded, { pulse = false } = {}) {
    if (!itemId) return;

    const safeId =
      (window.CSS && CSS.escape) ? CSS.escape(String(itemId)) : String(itemId);

    const btn = document.querySelector(
      `.lib-list-btn[data-action="add-to-list"][data-id="${safeId}"]`
    );
    if (!btn) return;

    btn.classList.toggle("is-added", !!isAdded);

    const label = btn.querySelector(".lib-list-label");
    if (label) label.textContent = isAdded ? "En listas" : "Lista";

    if (pulse) {
      btn.classList.remove("is-pulse");
      void btn.offsetWidth; // re-disparar animación
      btn.classList.add("is-pulse");
    }
  }

  function playLibraryQuickFx(itemId, kind = "progress") {
    if (!itemId) return;

    const safeId =
      (window.CSS && CSS.escape) ? CSS.escape(String(itemId)) : String(itemId);

    const card = document.querySelector(`.lib-card[data-id="${safeId}"]`);
    if (!card) return;

    const cls = (kind === "complete") ? "is-complete-fx" : "is-progress-fx";

    // Re-disparar animación aunque ya estuviera aplicada
    card.classList.remove(cls);
    void card.offsetWidth;
    card.classList.add(cls);

    window.setTimeout(() => {
      try { card.classList.remove(cls); } catch (_) {}
    }, 520);
  }

  async function applyQuickProgressWithUndo(itemId) {
    if (!itemId) return { ok: false };

    // Snapshot antes del progreso rápido (para Deshacer)
    let snapshotBefore = null;
    try {
      snapshotBefore = await ApiClient.getLibraryItemById(itemId);
      if (!snapshotBefore || !snapshotBefore.id) snapshotBefore = null;
    } catch (_) {
      snapshotBefore = null;
    }

    try {
      // Marcador temporal para deshacer activities creadas por ESTE click
      const sinceIso = new Date(Date.now() - 2000).toISOString();

      const res = await (ApiClient.applyQuickProgress
        ? ApiClient.applyQuickProgress(itemId)
        : ApiClient.progressLibraryItem(itemId, 5)
      );

      const justCompleted = !!res?.justCompleted;

      const title = justCompleted ? "Contenido completado" : "Progreso actualizado";
      const message = justCompleted
        ? "Se ha marcado como finalizado."
        : (res?.deltaLabel ? ("Actualizado: " + String(res.deltaLabel)) : "Progreso actualizado");

      // Micro-feedback visual en la card
      playLibraryQuickFx(itemId, justCompleted ? "complete" : "progress");

      window.toast?.({
        title,
        message,
        type: justCompleted ? "success" : "info",
        duration: 5200,
        actionLabel: snapshotBefore ? "Deshacer" : null,
        onAction: snapshotBefore
          ? async () => {
              try {
                await ApiClient.updateLibraryItem(snapshotBefore, { logActivity: false });

                // Borrar activities creadas por este progreso rápido (racha/estadísticas coherentes)
                await ApiClient.undoActivitiesForItemSince(itemId, sinceIso);

                // Feedback inmediato
                flashLibraryCard(itemId);

                window.toast?.({
                  title: "Cambios revertidos",
                  message: "Se ha restaurado el estado anterior.",
                  type: "success",
                  duration: 2400
                });
              } catch (e) {
                console.error(e);
                window.toast?.({
                  title: "No se pudo deshacer",
                  message: "Inténtalo de nuevo.",
                  type: "error",
                  duration: 3200
                });
              }
            }
          : null
      });

      return { ok: true, res };
    } catch (e) {
      console.error(e);
      window.toast?.({
        title: "No se pudo actualizar",
        message: "Inténtalo de nuevo.",
        type: "error",
        duration: 3600
      });
      return { ok: false };
    }
  }

  async function markAsCompletedWithUndo(itemId) {
    if (!itemId) return { ok: false };

    // Snapshot previo
    let snapshotBefore = null;
    try {
      snapshotBefore = await ApiClient.getLibraryItemById(itemId);
      if (!snapshotBefore || !snapshotBefore.id) snapshotBefore = null;
    } catch (_) {
      snapshotBefore = null;
    }

    try {
      const res = await ApiClient.completeLibraryItem(itemId);

      // Feedback visual inmediato
      playLibraryQuickFx(itemId, "complete");

      window.toast?.({
        title: "Contenido completado",
        message: "Se ha marcado como finalizado.",
        type: "success",
        duration: 5200,
        actionLabel: snapshotBefore ? "Deshacer" : null,
        onAction: snapshotBefore
          ? async () => {
              try {
                await ApiClient.updateLibraryItem(snapshotBefore, { logActivity: false });

                // FX de confirmación al restaurar
                flashLibraryCard(itemId);

                window.toast?.({
                  title: "Cambios revertidos",
                  message: "Se ha restaurado el estado anterior.",
                  type: "success",
                  duration: 2400
                });
              } catch (e) {
                console.error(e);
                window.toast?.({
                  title: "No se pudo deshacer",
                  message: "Inténtalo de nuevo.",
                  type: "error",
                  duration: 3200
                });
              }
            }
          : null
      });

      return { ok: true, res };
    } catch (e) {
      console.error(e);
      window.toast?.({
        title: "No se pudo completar",
        message: "Inténtalo de nuevo.",
        type: "error",
        duration: 3600
      });
      return { ok: false };
    }
  }

  function bind() {
    // Bind modales (una sola fuente de verdad: UIModal)
    window.UIModal?.bind("progressModal", {
      closeSelectors: ["#closeProgressModal", "#cancelProgressBtn"],
      initialFocusSelector: "#saveProgressBtn",
      closeOnBackdrop: true
    });

    window.UIModal?.bind("addLibraryModal", {
      closeSelectors: ["#closeAddLibraryModal", "#cancelAddLibraryModal"],
      initialFocusSelector: "#addLib_title",
      closeOnBackdrop: true
    });

    window.UIModal?.bind("addToListModal", {
      closeSelectors: ["#closeAddToListModal", "#cancelAddToListModal"],
      initialFocusSelector: "#confirmAddToListModal",
      closeOnBackdrop: true
    });

    // búsqueda
    const global = $("#globalSearch");
    if (global) {
      global.addEventListener("input", () => {
        const isLibraryActive =
          document.querySelector("#view-library")?.classList.contains("is-active");
        if (!isLibraryActive) return;

        // Centralizamos: actualiza estado + persiste + render
        setSearchTerm(global.value || "");
      });
    }
    
    // Botón "Añadir" (delegado, robusto)
    document.addEventListener("click", (e) => {
      const btn = e.target.closest("#btnAddLibraryItem");
      if (!btn) return;
      e.preventDefault();
      openAddLibraryModal();
    });

    // Abrir modal "Añadir a lista"
    document.addEventListener("click", (e) => {
      const btn = e.target.closest('[data-action="add-to-list"]');
      if (!btn) return;
      const id = btn.dataset.id;
      if (!id) return;
      __addToListModalLastFocus = btn;
      openAddToListModal(id);
    });

    // Confirmar añadir a lista
    document.getElementById("confirmAddToListModal")?.addEventListener("click", async () => {
      const modal = document.getElementById("addToListModal");
      const itemId = modal?.dataset.itemId;
      const optionsEl = document.getElementById("atl_listOptions");
      const selected = Array.from(optionsEl?.querySelectorAll('input[type="checkbox"]:checked') || [])
        .map((el) => el.value)
        .filter(Boolean);

      if (!itemId) return;

      if (!selected.length) {
        _showAddToListError("Selecciona al menos una lista.");
        return;
      }

      const btn = document.getElementById("confirmAddToListModal");
      const cancelBtn = document.getElementById("cancelAddToListModal");
      const closeBtn = document.getElementById("closeAddToListModal");

      const prevHtml = btn?.innerHTML || "Añadir";

      if (btn) {
        btn.disabled = true;
        btn.dataset.busy = "1";
        btn.innerHTML = `
          <span class="btn-spinner" aria-hidden="true"></span>
          <span>Añadiendo…</span>
        `;
      }

      if (cancelBtn) cancelBtn.disabled = true;
      if (closeBtn) closeBtn.disabled = true;

      // Snapshot de listas para Undo (antes de mutar)
      let listsSnapshot = null;
      try {
        const before = await ApiClient.getLists();
        // Copia profunda defensiva para que no se mute por referencia
        listsSnapshot = JSON.parse(JSON.stringify(before || []));
      } catch (e) {
        console.error(e);
        listsSnapshot = null;
      }

      try {
        const results = await Promise.all(
          selected.map((listId) => ApiClient.addLibraryItemToList(listId, itemId))
        );

        const addedCount = results.filter(r => r?.ok && !r?.already).length;
        const alreadyCount = results.filter(r => r?.ok && r?.already).length;
        const failedCount = results.filter(r => !r?.ok).length;

        // Si alguna falló, mostramos error y NO cerramos el modal (para que el usuario pueda reintentar)
        if (failedCount > 0) {
          _showAddToListError("No se pudieron añadir todas. Inténtalo de nuevo.");
          return;
        }

        // Mensaje de feedback (sin emojis)
        if (addedCount === 0 && alreadyCount > 0) {
          window.toast?.({
            title: "Sin cambios",
            message: "Ya estaba en las listas seleccionadas.",
            type: "info",
            duration: 2400
          });

          closeAddToListModal();
          return;
        }

        const wasInAnyList = itemsInAnyList.has(String(itemId));
        const nextIsInAnyList = wasInAnyList || addedCount > 0;

        if (nextIsInAnyList) {
          itemsInAnyList.add(String(itemId));
          setListButtonState(itemId, true, { pulse: addedCount > 0 });
        }

        const msg = addedCount === 1 ? "Añadido a 1 lista." : `Añadido a ${addedCount} listas.`;

        window.toast?.({
          title: "Lista actualizada",
          message: msg,
          type: "success",
          duration: 5200,
          actionLabel: listsSnapshot ? "Deshacer" : null,
          onAction: listsSnapshot
            ? async () => {
                try {
                  // Restaurar snapshot completo de listas
                  await ApiClient.setLists(listsSnapshot);

                  // Revertir estado optimista del botón si antes NO estaba en ninguna lista
                  if (!wasInAnyList) {
                    itemsInAnyList.delete(String(itemId));
                    setListButtonState(itemId, false, { pulse: true });
                  }

                  window.toast?.({
                    title: "Cambios revertidos",
                    message: "Se han restaurado las listas.",
                    type: "success",
                    duration: 2400
                  });
                } catch (e) {
                  console.error(e);
                  window.toast?.({
                    title: "No se pudo deshacer",
                    message: "Inténtalo de nuevo.",
                    type: "error",
                    duration: 3200
                  });
                }
              }
            : null
        });

        closeAddToListModal();

      } catch (e) {
        console.error(e);
        _showAddToListError("No se pudo añadir. Inténtalo de nuevo.");
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

    // Guardar
    document.getElementById("saveAddLibraryModal")?.addEventListener("click", async () => {
      const title = document.getElementById("addLib_title")?.value?.trim() || "";
      const type = document.getElementById("addLib_type")?.value || "pelicula";

      if (title.length < 2) {
        _showAddLibError("Escribe un título (mínimo 2 caracteres).");
        return;
      }

      const btn = document.getElementById("saveAddLibraryModal");
      const cancelBtn = document.getElementById("cancelAddLibraryModal");
      const closeBtn = document.getElementById("closeAddLibraryModal");

      const prevHtml = btn?.innerHTML || "Añadir";

      if (btn) {
        btn.disabled = true;
        btn.dataset.busy = "1";
        btn.innerHTML = `
          <span class="btn-spinner" aria-hidden="true"></span>
          <span>Guardando…</span>
        `;
      }

      if (cancelBtn) cancelBtn.disabled = true;
      if (closeBtn) closeBtn.disabled = true;

      try {
        const created = await ApiClient.createLibraryItem({ title, type });

        window.__lastCreatedLibraryItemId = created?.id || null;

        closeAddLibraryModal();

        // No refrescamos manualmente: app-core reaccionará a "quacker:data-changed"
        window.toast?.({
          title: "Guardado",
          message: `"${(created?.title || title).trim()}" añadido a tu biblioteca.`,
          type: "success",
          duration: 2400
        });

      } catch (err) {
        console.error(err);
        _showAddLibError("No se pudo añadir. Inténtalo de nuevo.");
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

    // orden
    const sort = $("#librarySort");
    if (sort) {
      sort.addEventListener("change", async () => {
        sortMode = sort.value || "recent";
        await _saveUIState();
        saveLibraryFilters();
        render();
      });
    }

    // filtros tipo
    const typeBtns = $all(".lib-type-pill");
    typeBtns.forEach((btn) => {
      btn.addEventListener("click", () => {
        typeBtns.forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        typeFilter = btn.dataset.type || "all";
        _saveUIState();
        saveLibraryFilters();
        render();
      });
    });

    // filtros estado
    const statusBtns = $all(".lib-status-pill");
    statusBtns.forEach((btn) => {
      btn.addEventListener("click", () => {
        statusBtns.forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        statusFilter = btn.dataset.status || "all";
        _saveUIState();
        saveLibraryFilters();
        render();
      });
    });

    // Acción botón principal (Empezar / Continuar)
    document.addEventListener("click", async (e) => {
      const btn = e.target.closest('.lib-primary-btn[data-action="primary"]');
      if (!btn) return;

      const id = btn.dataset.id;
      if (!id) return;

      captureLibraryAnchor(id);

      // Evitar doble click
      if (btn.dataset.busy === "1") return;
      btn.dataset.busy = "1";

      const prevHtml = btn.innerHTML;
      btn.disabled = true;
      btn.innerHTML = `
        <span class="btn-spinner" aria-hidden="true"></span>
        <span>Actualizando…</span>
      `;

      try {
        // Progreso rápido con "Deshacer"
        await applyQuickProgressWithUndo(id);

        // No hacemos load() manual:
        // ApiClient emite quacker:data-changed y app-core recarga Biblioteca si está activa.
      } finally {
        btn.disabled = false;
        btn.dataset.busy = "0";
        btn.innerHTML = prevHtml;
      }
    });

    document.addEventListener("quacker:view-change", (e) => {
      const viewId = e.detail?.viewId;

      // Limpieza defensiva: si salimos de Biblioteca, no dejamos highlight pendiente
      if (viewId !== "library" && window.__lastCreatedLibraryItemId) {
        window.__lastCreatedLibraryItemId = null;
      }

      if (viewId !== "library") return;

      const global = $("#globalSearch");
      searchTerm = (global?.value || "").trim().toLowerCase();

      const sort = $("#librarySort");
      if (sort) sort.value = sortMode; 

      render();
    });

    // Abrir modal "Editar progreso"
    document.addEventListener("click", (e) => {
      const btn = e.target.closest('[data-action="edit-progress"]');
      if (!btn) return;

      __progressModalLastFocus = btn;
      openProgressModal(btn.dataset.id);
    });

    // Cerrar/guardar modal
    document.getElementById("closeProgressModal")?.addEventListener("click", closeProgressModal);
    document.getElementById("cancelProgressBtn")?.addEventListener("click", closeProgressModal);
    document.getElementById("saveProgressBtn")?.addEventListener("click", saveProgressModal);

    // Eliminar (con animación) + Toast "Deshacer"
    document.getElementById("deleteItemBtn")?.addEventListener("click", async () => {
      const modal = document.getElementById("progressModal");
      const itemId = modal?.dataset.itemId;
      if (!itemId) return;

      const btn = document.getElementById("deleteItemBtn");
      if (btn?.dataset.busy === "1") return;

      if (btn) {
        btn.dataset.busy = "1";
        btn.disabled = true;
      }

      try {
        const itemToRestore = await ApiClient.getLibraryItemById(itemId);

        // Si no existe, borramos sin undo
        if (!itemToRestore) {
          deleteLibraryItemAnimated(itemId, { silentToast: true });
          return;
        }

        // Borrado animado (silencioso: el toast con undo lo gestionamos aquí)
        deleteLibraryItemAnimated(itemId, { silentToast: true });

        // Toast con botón deshacer
        window.toast?.({
          title: "Contenido eliminado",
          message: itemToRestore.title || "Contenido",
          type: "info",
          duration: 5000,
          actionLabel: "Deshacer",
          onAction: async () => {
            try {
              await ApiClient.createLibraryItem({
                id: itemToRestore.id,
                type: itemToRestore.type,
                title: itemToRestore.title,
                status: itemToRestore.status,
                progress: itemToRestore.progress,
                meta: itemToRestore.meta || {},
                cover: itemToRestore.cover || "",
                createdAt: itemToRestore.createdAt,
                updatedAt: itemToRestore.updatedAt
              });

              window.toast?.({
                title: "Contenido restaurado",
                message: "Se ha vuelto a añadir a tu biblioteca.",
                type: "success",
                duration: 2400
              });
            } catch (e) {
              console.error(e);
              window.toast?.({
                title: "No se pudo restaurar",
                message: "Inténtalo de nuevo.",
                type: "error",
                duration: 3000
              });
            }
          }
        });
      } catch (e) {
        console.error(e);
        window.toast?.({
          title: "No se pudo eliminar",
          message: "Inténtalo de nuevo.",
          type: "error",
          duration: 3000
        });
      } finally {
        if (btn && document.body.contains(btn)) {
          btn.dataset.busy = "0";
          btn.disabled = false;
        }
      }
    });

    document.addEventListener("click", async (e) => {
      const btn = e.target.closest(".lib-complete-btn");
      if (!btn) return;

      const itemId = btn.dataset.id;
      if (!itemId) return;

      captureLibraryAnchor(itemId);

      const card = btn.closest(".lib-card");
      if (!card) return;

      // Evitar doble click por card
      if (card.dataset.busy === "1") return;
      card.dataset.busy = "1";

      const prevBtnHtml = btn.innerHTML;

      btn.disabled = true;
      btn.innerHTML = `
        <span class="btn-spinner" aria-hidden="true"></span>
        <span>Completando…</span>
      `;

      try {
        // Completado con snapshot + undo + micro-FX (patrón unificado)
        const result = await markAsCompletedWithUndo(itemId);

        // Si la función devolvió ok:false sin lanzar, tratamos como error
        if (result && result.ok === false) {
          throw new Error("complete_failed");
        }

        // No hacemos load() manual:
        // ApiClient emite "quacker:data-changed" y app-core refresca Biblioteca si está activa.
      } catch (err) {
        window.toast?.({
          title: "No se pudo completar",
          message: "Inténtalo de nuevo.",
          type: "error",
          duration: 3600
        });

        console.error("[Library] complete failed", err);
      } finally {
        // SIEMPRE desbloquear la card y restaurar botón
        card.dataset.busy = "0";

        if (document.body.contains(btn)) {
          btn.disabled = false;
          btn.innerHTML = prevBtnHtml;
        }
      }
    });

    // Volver al flujo: si se crea una lista desde "Añadir a listas",
    // volvemos a Biblioteca y reabrimos el modal preseleccionando la lista creada.
    document.addEventListener("quacker:lists-created", (e) => {
      const detail = e?.detail || {};
      const itemId = detail.returnToAddToListItemId ? String(detail.returnToAddToListItemId) : null;
      const listId = detail.listId != null ? String(detail.listId) : null;

      if (!itemId) return;

      // Guardamos la lista a preseleccionar en la próxima apertura
      window.__quackerPreselectListId = listId;

      // Navegar a Biblioteca
      const libNavBtn = document.querySelector('.nav-item-btn[data-view="library"]');
      if (libNavBtn) libNavBtn.click();
      else window.Router?.showView?.("library");

      // Reabrir modal "Añadir a listas" para el mismo item
      requestAnimationFrame(() => {
        openAddToListModal(itemId);
      });
    });

  }

  function init() {
    (async () => {
      // 1) cargar UI state persistente (estado único)
      try {
        const ui = await ApiClient.getLibraryUIState?.();
        if (ui && typeof ui === "object") {
          if (typeof ui.sortMode === "string") sortMode = ui.sortMode;
          if (typeof ui.typeFilter === "string") typeFilter = ui.typeFilter;
          if (typeof ui.statusFilter === "string") statusFilter = ui.statusFilter;
          if (typeof ui.searchTerm === "string") searchTerm = ui.searchTerm;
        }
      } catch (e) {
        console.error("LibraryUI: no se pudo cargar UI state", e);
      }

      // 2) bind listeners
      bind();

      // 3) cargar datos y render
      await load();

      // 4) aplicar UI visual (select + pills + search local si existe)
      const sort = $("#librarySort");
      if (sort) sort.value = sortMode;

      const typeBtns = $all(".lib-type-pill");
      typeBtns.forEach((b) => b.classList.toggle("active", (b.dataset.type || "all") === typeFilter));

      const statusBtns = $all(".lib-status-pill");
      statusBtns.forEach((b) => b.classList.toggle("active", (b.dataset.status || "all") === statusFilter));

      const localInput = document.querySelector(".library-search input");
      if (localInput) localInput.value = searchTerm;

      // 5) si estamos en Biblioteca, alinear buscador global también
      const isLibraryActive = document.querySelector("#view-library")?.classList.contains("is-active");
      const global = document.getElementById("globalSearch");
      if (isLibraryActive && global) global.value = searchTerm;

      render();
    })();
  }

  // Nueva función para aplicar filtros desde fuera
  function setExternalFilters(filters = {}) {
    if (filters.type) typeFilter = filters.type;
    if (filters.status) statusFilter = filters.status;
    
    // Actualizamos visualmente los selectores (pills) para que coincidan
    const typePill = document.querySelector(`.library-pills[data-filter-type] .pill-btn[data-value="${typeFilter}"]`);
    if (typePill) {
      typePill.parentElement.querySelectorAll('.pill-btn').forEach(b => b.classList.remove('active'));
      typePill.classList.add('active');
    }
    _saveUIState();
    render(); // Dibujamos la biblioteca con el filtro aplicado
  }

  // Esta función recibe el texto del buscador global
  function setSearchTerm(text) {
    searchTerm = (text || "").toLowerCase();

    const localInput = document.querySelector(".library-search input");
    if (localInput) localInput.value = text;

    _saveUIState();
    render();
  }

  return {
    init,
    load,
    render,
    setExternalFilters,
    setSearchTerm,
    showProgressErrors,
    _captureAnchor: captureLibraryAnchor
  };
})();

// Exponer al scope global (Router lo necesita)
window.LibraryUI = LibraryUI;

// ===============================
// PROGRESS MODAL (Library)
// ===============================
async function getLibraryItemById(id) {
  try {
    return await ApiClient.getLibraryItemById(id);
  } catch (e) {
    console.error(e);
    return null;
  }
}

async function saveLibraryItem(updatedItem) {
  if (!updatedItem?.id) return { ok: false };

  // UX: evitar salto si el guardado cambia updatedAt y reordena
  try { window.LibraryUI?._captureAnchor?.(updatedItem.id); } catch (_) {}

  // Snapshot previo (para Deshacer)
  let snapshotBefore = null;
  try {
    snapshotBefore = await ApiClient.getLibraryItemById(updatedItem.id);
    if (!snapshotBefore || !snapshotBefore.id) snapshotBefore = null;
  } catch (_) {
    snapshotBefore = null;
  }

  // Marcador temporal para poder deshacer activities creadas por ESTE guardado.
  // Usamos un pequeño margen hacia atrás para cubrir el timing del addActivity interno.
  const sinceIso = new Date(Date.now() - 2000).toISOString();

  try {
    const res = await ApiClient.updateLibraryItem(updatedItem, { logActivity: true });

    closeProgressModal();

    const justCompleted =
      Number(updatedItem.progress ?? 0) >= 100 || updatedItem.status === "completed";

    // Micro-feedback visual inmediato
    playLibraryQuickFx(updatedItem.id, justCompleted ? "complete" : "progress");

    window.toast?.({
      title: justCompleted ? "Contenido completado" : "Progreso actualizado",
      message: justCompleted ? "Se ha marcado como finalizado." : "Se han actualizado los cambios.",
      type: justCompleted ? "success" : "info",
      duration: 5200,
      actionLabel: snapshotBefore ? "Deshacer" : null,
      onAction: snapshotBefore
        ? async () => {
            try {
              // 1) Restaurar item SIN volver a registrar activity
              await ApiClient.updateLibraryItem(snapshotBefore, { logActivity: false });

              // 2) Borrar activities creadas por el guardado
              // (esto además reconcilia la racha de forma defensiva)
              await ApiClient.undoActivitiesForItemSince(updatedItem.id, sinceIso);

              // Feedback inmediato
              flashLibraryCard(updatedItem.id);

              window.toast?.({
                title: "Cambios revertidos",
                message: "Se ha restaurado el estado anterior.",
                type: "success",
                duration: 2400
              });
            } catch (e) {
              console.error(e);
              window.toast?.({
                title: "No se pudo deshacer",
                message: "Inténtalo de nuevo.",
                type: "error",
                duration: 3200
              });
            }
          }
        : null
    });

    return res;
  } catch (e) {
    console.error(e);
    window.toast?.({
      title: "No se pudo guardar",
      message: "Inténtalo de nuevo.",
      type: "error",
      duration: 3000
    });
    return { ok: false };
  }
}

function deleteLibraryItemAnimated(itemId, opts = {}) {
  if (!itemId) return;

  const safeId =
    (window.CSS && CSS.escape) ? CSS.escape(String(itemId)) : String(itemId);

  const card = document.querySelector(`.lib-card[data-id="${safeId}"]`);

  if (card) card.classList.add("is-removing");

  const doDelete = async () => {
    try {
      await ApiClient.deleteLibraryItem(itemId);

      closeProgressModal();

      // Toast SOLO si no es silencioso
      if (!opts.silentToast) {
        window.toast?.({
          title: "Contenido eliminado",
          message: "Se ha eliminado de tu biblioteca.",
          type: "success",
          duration: 2400
        });
      }

    } catch (e) {
      console.error(e);

      window.toast?.({
        title: "No se pudo eliminar",
        message: "Inténtalo de nuevo.",
        type: "error",
        duration: 3000
      });

      if (card) card.classList.remove("is-removing");
    }
  };

  if (!card) {
    doDelete();
    return;
  }

  let done = false;
  const finish = () => {
    if (done) return;
    done = true;
    card.removeEventListener("transitionend", onEnd);
    doDelete();
  };

  const onEnd = (e) => {
    if (e.propertyName === "opacity") finish();
  };

  card.addEventListener("transitionend", onEnd);
  setTimeout(finish, 250);
}

function computeProgressForItem(item) {
  // Libro: % desde páginas
  if (item.type === "book") {
    const read = Number(item.meta?.pagesRead ?? 0);
    const total = Number(item.meta?.totalPages ?? 0);
    item.progress = total > 0 ? (read / total) * 100 : 0;
  }

  // Película: 0 o 100
  if (item.type === "pelicula") {
    item.progress = item.status === "completed" ? 100 : 0;
  }

  // Clamp siempre
  item.progress = Math.max(0, Math.min(100, Number(item.progress ?? 0)));
}

function normalizeStatus(item) {
  const pct = Number(item.progress ?? 0);
  if (pct >= 100) item.status = "completed";
  else if (item.status === "completed") item.status = "in_progress";
}

function showProgressErrors(errors) {
  const box = document.getElementById("progressModalErrors");
  const saveBtn = document.getElementById("saveProgressBtn");

  if (!box || !saveBtn) return;

  if (!errors || errors.length === 0) {
    box.style.display = "none";
    box.innerHTML = "";
    saveBtn.disabled = false;
    return;
  }

  box.style.display = "block";
  box.innerHTML = errors.map(e => `<div class="error-line">• ${e}</div>`).join("");
  saveBtn.disabled = true;
}

function validateProgress(item, values) {
  const errors = [];
  if (!item) return ["No se ha encontrado el contenido."];

  if (item.type === "book") {
    const pagesRead = Number(values.pagesRead);
    const totalPages = Number(values.totalPages);

    if (!Number.isFinite(totalPages) || totalPages <= 0) {
      errors.push("El total de páginas debe ser mayor que 0.");
    }
    if (!Number.isFinite(pagesRead) || pagesRead < 0) {
      errors.push("Las páginas leídas deben ser 0 o más.");
    }
    if (Number.isFinite(pagesRead) && Number.isFinite(totalPages) && pagesRead > totalPages) {
      errors.push("Las páginas leídas no pueden superar el total de páginas.");
    }
  }

  if (item.type === "serie") {
    const season = Number(values.season);
    const episode = Number(values.episode);

    if (!Number.isFinite(season) || season < 1) errors.push("La temporada debe ser 1 o más.");
    if (!Number.isFinite(episode) || episode < 1) errors.push("El episodio debe ser 1 o más.");
  }

  // Game: % obligatorio
  if (item.type === "game") {
    const pct = Number(values.progress);
    if (!Number.isFinite(pct) || pct < 0 || pct > 100) {
      errors.push("El progreso debe estar entre 0 y 100.");
    }
  }

  // Película: validamos estado (no %)
  if (item.type === "pelicula") {
    const st = String(values.movieStatus || "");
    if (!["not_started", "completed"].includes(st)) {
      errors.push("Selecciona un estado válido para la película.");
    }
  }

  return errors;
}

function wireLiveProgressValidation(item) {
  const body = document.getElementById("progressModalBody");
  if (!body) return;

  const onChange = () => {
    const values = {
      pagesRead: body?.querySelector('[name="pagesRead"]')?.value,
      totalPages: body?.querySelector('[name="totalPages"]')?.value,
      season: body?.querySelector('[name="season"]')?.value,
      episode: body?.querySelector('[name="episode"]')?.value,
      progress: body?.querySelector('[name="progress"]')?.value,
      movieStatus: body?.querySelector('[name="movieStatus"]')?.value,
    };

    const errs = validateProgress(item, values);
    showProgressErrors(errs);
  };

  body.querySelectorAll("input, select").forEach(el => {
    el.addEventListener("input", onChange);
    el.addEventListener("change", onChange);
  });

  onChange(); // validación inicial al abrir
}

async function openProgressModal(itemId) {
  const modal = document.getElementById("progressModal");
  const body = document.getElementById("progressModalBody");
  const title = document.getElementById("progressModalTitle");

  const item = await getLibraryItemById(itemId);
  if (!item || !modal || !body || !title) return;

  modal.dataset.itemId = itemId;
  title.textContent = `Editar progreso · ${item.title || ""}`;

  item.meta = item.meta || {};

  // Formularios por tipo
  if (item.type === "book") {
    const read = Number(item.meta.pagesRead ?? 0);
    const total = Number(item.meta.totalPages ?? 1);
    body.innerHTML = `
      <div class="modal-field">
        <label>Páginas leídas</label>
        <input id="pm_pagesRead" name="pagesRead" type="number" min="0" value="${read}">
      </div>
      <div class="modal-field">
        <label>Total páginas</label>
        <input id="pm_totalPages" name="totalPages" type="number" min="1" value="${total}">
      </div>
      <p style="color:var(--text-muted);font-size:.9rem;margin-top:6px;">
        El porcentaje se calcula automáticamente.
      </p>
    `;
  } else if (item.type === "serie") {
    const s = Number(item.meta.season ?? 1);
    const e = Number(item.meta.episode ?? 1);
    const pct = Number(item.progress ?? 0);
    body.innerHTML = `
      <div class="modal-field">
        <label>Temporada</label>
        <input id="pm_season" name="season" type="number" min="1" value="${s}">
      </div>
      <div class="modal-field">
        <label>Episodio</label>
        <input id="pm_episode" name="episode" type="number" min="1" value="${e}">
      </div>
      <div class="modal-field">
        <label>% (opcional)</label>
        <input id="pm_percent" name="progress" type="number" min="0" max="100" value="${pct}">
      </div>
    `;
  } else if (item.type === "game") {
    const pct = Number(item.progress ?? 0);
    const hours = Number(item.meta.hoursPlayed ?? 0);
    body.innerHTML = `
      <div class="modal-field">
        <label>% completado</label>
        <input id="pm_percent" name="progress" type="number" min="0" max="100" value="${pct}">
      </div>
      <div class="modal-field">
        <label>Horas jugadas (opcional)</label>
        <input id="pm_hours" name="hoursPlayed" type="number" min="0" value="${hours}">
      </div>
    `;
  } else if (item.type === "pelicula") {
    const isCompleted = item.status === "completed" || Number(item.progress ?? 0) >= 100;
    body.innerHTML = `
      <div class="modal-field">
        <label>Estado</label>
        <select id="pm_movieStatus" name="movieStatus">
          <option value="not_started" ${!isCompleted ? "selected" : ""}>No empezada</option>
          <option value="completed" ${isCompleted ? "selected" : ""}>Vista</option>
        </select>
      </div>
    `;
  } else {
    const pct = Number(item.progress ?? 0);
    body.innerHTML = `
      <div class="modal-field">
        <label>% completado</label>
        <input id="pm_percent" type="number" min="0" max="100" value="${pct}">
      </div>
    `;
  }

  showProgressErrors([]); 
  wireLiveProgressValidation(item);

  window.UIModal?.open(modal, {
    initialFocusSelector: "#saveProgressBtn",
    lastFocusEl: __progressModalLastFocus
  });
}

function closeProgressModal() {
  const modal = document.getElementById("progressModal");
  if (!modal) return;

  modal.dataset.itemId = "";

  showProgressErrors([]);

  const body = document.getElementById("progressModalBody");
  if (body) body.innerHTML = "";

  window.UIModal?.close(modal);
  __progressModalLastFocus = null;
}

async function saveProgressModal() {
  const modal = document.getElementById("progressModal");
  const itemId = modal?.dataset.itemId;
  if (!itemId) return;

  const item = await getLibraryItemById(itemId);
  if (!item) return;

  const body = document.getElementById("progressModalBody");

  const values = {
    pagesRead: body?.querySelector('[name="pagesRead"]')?.value,
    totalPages: body?.querySelector('[name="totalPages"]')?.value,
    season: body?.querySelector('[name="season"]')?.value,
    episode: body?.querySelector('[name="episode"]')?.value,
    progress: body?.querySelector('[name="progress"]')?.value,
  };

  const errors = validateProgress(item, values);
  showProgressErrors(errors);
  
  if (errors.length) return; // No guarda si no hay errores

  item.meta = item.meta || {};

  if (item.type === "book") {
    const read = Number(document.getElementById("pm_pagesRead")?.value ?? 0);
    const total = Number(document.getElementById("pm_totalPages")?.value ?? 1);
    item.meta.pagesRead = Math.max(0, read);
    item.meta.totalPages = Math.max(1, total);
  } else if (item.type === "serie") {
    item.meta.season = Math.max(1, Number(document.getElementById("pm_season")?.value ?? 1));
    item.meta.episode = Math.max(1, Number(document.getElementById("pm_episode")?.value ?? 1));
    const pct = Number(document.getElementById("pm_percent")?.value ?? item.progress ?? 0);
    item.progress = Math.max(0, Math.min(100, pct));
  } else if (item.type === "game") {
    const pct = Number(document.getElementById("pm_percent")?.value ?? 0);
    const hours = Number(document.getElementById("pm_hours")?.value ?? 0);
    item.progress = Math.max(0, Math.min(100, pct));
    item.meta.hoursPlayed = Math.max(0, hours);
  } else if (item.type === "pelicula") {
    item.status = document.getElementById("pm_movieStatus")?.value || "not_started";
  } else {
    const pct = Number(document.getElementById("pm_percent")?.value ?? 0);
    item.progress = Math.max(0, Math.min(100, pct));
  }

  computeProgressForItem(item);
  normalizeStatus(item);

  item.updatedAt = new Date().toISOString();
  if (!item.createdAt) item.createdAt = item.updatedAt;

  const saveBtn = document.getElementById("saveProgressBtn");
  const cancelBtn = document.getElementById("cancelProgressBtn");
  const closeBtn = document.getElementById("closeProgressModal");

  // Anti doble click / estado busy
  if (saveBtn && saveBtn.dataset.busy === "1") return;

  const prevSaveHtml = saveBtn?.innerHTML || "Guardar";

  if (saveBtn) {
    saveBtn.dataset.busy = "1";
    saveBtn.disabled = true;
    saveBtn.innerHTML = `
      <span class="btn-spinner" aria-hidden="true"></span>
      <span>Guardando…</span>
    `;
  }

  if (cancelBtn) cancelBtn.disabled = true;
  if (closeBtn) closeBtn.disabled = true;

  try {
    await saveLibraryItem(item);
  } finally {
    // Ojo: saveLibraryItem puede cerrar el modal, así que comprobamos que sigan en DOM
    if (saveBtn && document.body.contains(saveBtn)) {
      saveBtn.dataset.busy = "0";
      saveBtn.disabled = false;
      saveBtn.innerHTML = prevSaveHtml;
    }

    if (cancelBtn && document.body.contains(cancelBtn)) cancelBtn.disabled = false;
    if (closeBtn && document.body.contains(closeBtn)) closeBtn.disabled = false;
  }
}
