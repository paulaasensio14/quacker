// assets/js/app/lists.js
// Paso 1: Carga + render usando ApiClient (sin crear/editar aún)

const ListsModule = (() => {
  const t = (key) => window.I18n?.t?.(key) ?? key;

  let allLists = [];
  let visibleLists = [];
  let listsFilter = "all";     // "all" | "public" | "private" | "collab"
  
  let pendingDeleteListId = null;
  let lastDeletedListSnapshot = null;
  let editingListId = null;
  let searchTerm = "";         // texto en minúsculas

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

  function _visibilityLabel(v) {
    if (v === "public") return t("lists_visibility_public");
    if (v === "collab") return t("lists_visibility_collab");
    return t("lists_visibility_private");
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

  function _sleep(ms) {
    return new Promise((res) => setTimeout(res, ms));
  }

  function flashListItemCard(itemId) {
    if (!itemId) return;

    const safe = (window.CSS && CSS.escape) ? CSS.escape(String(itemId)) : String(itemId);
    const el = document.querySelector(`.list-item-card[data-item-id="${safe}"]`);
    if (!el) return;

    el.classList.remove("is-highlight");
    void el.offsetWidth; // reflow para reiniciar animación
    el.classList.add("is-highlight");

    setTimeout(() => el.classList.remove("is-highlight"), 950);
  }

  function _findListCardById(id) {
    // CSS.escape no existe en algunos navegadores viejos, pero aquí casi seguro que sí.
    const safe = (window.CSS && CSS.escape) ? CSS.escape(String(id)) : String(id);
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
    renderListsSkeleton();

    try {
      allLists = await ApiClient.getLists();
      if (!Array.isArray(allLists)) allLists = [];

      visibleLists = [...allLists]; // lo que se muestra
      updateFilterCounts();
      applyFilters();

      const detailOpen = !_getEl("listDetail")?.hidden && !!activeListId;

      if (detailOpen) {
        const activeList = allLists.find(l => String(l.id) === String(activeListId));

        if (!activeList) {
          closeListDetail();
        } else {
          _renderActiveListDetailHeader(activeList);
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
      listsInline.style.display = "inline";
      if (libraryInline) libraryInline.style.display = "none";
    }

    if (hasError) {
      container.innerHTML = `
        <div class="lists-empty-state">
          ${t("lists_load_error")}
        </div>
      `;
      return;
    }

    if (!visibleLists.length) {
      const isFiltering = listsFilter !== "all" || (searchTerm || "").trim().length > 0;
      container.innerHTML = `
        <div class="lists-empty-state">
          ${isFiltering ? t("lists_empty_filtered") : t("lists_empty_initial")}
        </div>
      `;
      return;
    }

    container.innerHTML = visibleLists
      .map((list) => {
        const name = _safeText(list.name) || t("lists_untitled");
        const desc = _safeText(list.description);
        const count = _itemsCount(list);
        const vis = _visibilityLabel(list.visibility);

        return `
          <article class="list-card" data-id="${_safeText(list.id)}">
            <div class="list-card-header">
              <h3>${name}</h3>

              <div class="list-card-header-actions">
                <span class="list-visibility">${vis}</span>
                <button
                  type="button"
                  class="list-edit-btn"
                  data-action="edit-list"
                  data-id="${_safeText(list.id)}"
                  aria-label="Editar lista"
                  title="Editar lista"
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
                  aria-label="Eliminar lista"
                  title="Eliminar lista"
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
              </div>
            </div>

            ${desc ? `<p class="list-meta">${desc}</p>` : ""}

            <p class="list-count">
              <strong>${count}</strong> elemento${count === 1 ? "" : "s"}
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
    activeListId = String(listId);

    const list = allLists.find(l => String(l.id) === activeListId);
    if (!list) return;

    const detail = _getEl("listDetail");
    const grid = _getEl("listsGrid");

    // Ocultamos grid, mostramos detalle
    _setHidden(grid, true);
    _setHidden(detail, false);

    _renderActiveListDetailHeader(list);

    // Reset filtros al entrar al detalle
    detailSearch = "";
    detailType = "all";
    detailStatus = "all";

    const qInput2 = _getEl("listDetailSearch");
    if (qInput2) qInput2.value = "";

    const typeSel2 = _getEl("listDetailTypeFilter");
    if (typeSel2) typeSel2.value = "all";

    const statusSel2 = _getEl("listDetailStatusFilter");
    if (statusSel2) statusSel2.value = "all";

    const showing2 = _getEl("listDetailShowing");
    if (showing2) showing2.textContent = "";

    await renderActiveListItems();
  }

  function closeListDetail() {
    activeListId = null;

    const detail = _getEl("listDetail");
    const grid = _getEl("listsGrid");

    _setHidden(detail, true);
    _setHidden(grid, false);
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

  async function renderActiveListItems(){
    const grid = _getEl("listDetailItemsGrid");
    const empty = _getEl("listDetailEmpty");
    const hint = _getEl("listDetailHint");
    if (!grid || !empty) return;

    const list = allLists.find(l => String(l.id) === String(activeListId));
    if (!list){
      grid.innerHTML = "";
      empty.style.display = "block";
      empty.textContent = t("lists_detail_empty");
      if (hint) hint.textContent = "";
      return;
    }

    const ids = Array.isArray(list.items) ? list.items.map(x => String(typeof x === "string" ? x : x?.id)).filter(Boolean) : [];

    if (!ids.length){
      grid.innerHTML = "";
      empty.style.display = "block";
      empty.textContent = t("lists_detail_empty");
      if (hint) hint.textContent = "";
      return;
    }

    empty.style.display = "none";
    if (hint) hint.textContent = t("lists_detail_hint");

    // Cargamos biblioteca para resolver ids -> datos reales
    let library = [];
    try{
      library = await ApiClient.getLibrary();
    }catch(e){
      console.error(e);
      library = [];
    }

    const byId = new Map((library || []).map(it => [String(it.id), it]));
    const items = ids.map(id => byId.get(id)).filter(Boolean);

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
      empty.style.display = "block";
      empty.textContent = t("lists_detail_empty_filtered");
      if (hint) hint.textContent = "";
      return;
    }

    grid.innerHTML = filtered.map((it) => {
      const coverStyle = it.cover ? `style="background-image:url('${it.cover}');"` : "";
      const title = _safeText(it.title) || t("lists_item_untitled");
      const type = _typeLabel(it.type);
      const prog = _progressLabel(it.progress);

      return `
        <article class="list-item-card" data-item-id="${_safeText(it.id)}">
          <div class="list-item-cover" ${coverStyle}></div>
          <div class="list-item-body">
            <div class="list-item-title">${title}</div>
            <div class="list-item-sub">
              <span>${type}</span>
              <span>${prog}</span>
            </div>
            <div class="list-item-actions">
              <button type="button" class="list-item-remove" data-action="remove-from-list" data-item-id="${_safeText(it.id)}">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                     stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"
                     aria-hidden="true" focusable="false">
                  <path d="M3 6h18"/>
                  <path d="M8 6V4h8v2"/>
                  <path d="M6 6l1 14h10l1-14"/>
                  <path d="M10 11v6"/>
                  <path d="M14 11v6"/>
                </svg>
                Quitar
              </button>
            </div>
          </div>
        </article>
      `;
    }).join("");
  }

  async function removeItemFromActiveList(itemId){
    if (!activeListId || !itemId) return;

    const listId = String(activeListId);
    const id = String(itemId);

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
      const res = await ApiClient.removeLibraryItemFromList(listId, id);

      if (!res?.ok){
        if (card){
          card.classList.remove("is-leaving");
          card.dataset.busy = "0";
        }
        window.toast?.({
          title: t("lists_remove_error_title"),
          message: t("lists_remove_error_text"),
          type: "error",
          duration: 3200
        });
        return;
      }

      // Actualizamos estado en memoria (sin tocar DOM manualmente)
      const listRef = (allLists || []).find(l => String(l.id) === String(listId));
      if (listRef && Array.isArray(listRef.items)) {
        listRef.items = listRef.items.filter((x) => {
          const entryId = typeof x === "string" ? x : x?.id;
          return String(entryId) !== String(id);
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
        actionLabel: t("lists_undo"),
        onAction: async () => {
          try{
            const addRes = await ApiClient.addLibraryItemToList(listId, id);
            if (!addRes?.ok) throw new Error("add_failed");

            window.toast?.({
              title: t("lists_undo_success_title"),
              message: t("lists_undo_success_text"),
              type: "success",
              duration: 2400
            });

            // Estado en memoria + repintado instantáneo del detalle
            const listRef = (allLists || []).find(l => String(l.id) === String(listId));
            if (listRef && Array.isArray(listRef.items)) {
              // Evitar duplicados si el usuario deshace dos veces rápido
              const exists = listRef.items.some((x) => {
                const entryId = typeof x === "string" ? x : x?.id;
                return String(entryId) === String(id);
              });

              if (!exists) {
                listRef.items.push({
                  id: String(id),
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
        }
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

  function openListModal(listId = null) {
    const modal = document.getElementById("listModal");
    if (!modal) return;

    const titleEl = document.getElementById("listModalTitle");
    const saveBtn = document.getElementById("saveListModal");

    hideListErrors();

    if (listId) {
      // MODO EDITAR
      editingListId = String(listId);

      const list = allLists.find(l => String(l.id) === editingListId);
      if (!list) return;

      if (titleEl) titleEl.textContent = "Editar lista";
      if (saveBtn) saveBtn.textContent = "Guardar";

      document.getElementById("lm_name").value = list.name || "";
      document.getElementById("lm_desc").value = list.description || "";
      document.getElementById("lm_visibility").value = list.visibility || "private";
    } else {
      // MODO CREAR
      editingListId = null;

      if (titleEl) titleEl.textContent = "Nueva lista";
      if (saveBtn) saveBtn.textContent = "Crear";

      document.getElementById("lm_name").value = "";
      document.getElementById("lm_desc").value = "";
      document.getElementById("lm_visibility").value = "private";
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
    box.style.display = "block";
    box.textContent = msg;
  }

  function hideListErrors() {
    const box = document.getElementById("listModalErrors");
    if (!box) return;
    box.style.display = "none";
    box.textContent = "";
  }

  async function saveListFromModal() {
    const name = (document.getElementById("lm_name")?.value || "").trim();
    const description = (document.getElementById("lm_desc")?.value || "").trim();
    const visibility = document.getElementById("lm_visibility")?.value || "private";

    if (!name) {
      showListErrors("Ponle un nombre a la lista.");
      return;
    }

    const saveBtn = document.getElementById("saveListModal");
    const cancelBtn = document.getElementById("cancelListModal");
    const closeBtn = document.getElementById("closeListModal");

    const prevHtml = saveBtn?.innerHTML || (editingListId ? "Guardar" : "Crear");

    if (saveBtn) {
      // Evitar doble click si ya está guardando
      if (saveBtn.dataset.busy === "1") return;

      saveBtn.disabled = true;
      saveBtn.dataset.busy = "1";
      saveBtn.innerHTML = `
        <span class="btn-spinner" aria-hidden="true"></span>
        <span>Guardando…</span>
      `;
    }

    if (cancelBtn) cancelBtn.disabled = true;
    if (closeBtn) closeBtn.disabled = true;

    try {
      if (editingListId) {
        // EDITAR
        await ApiClient.updateList(editingListId, { name, description, visibility });
      } else {
        // CREAR
        const created = await ApiClient.createList({ name, description, visibility, items: [] });

        // Si venimos desde "Añadir a listas" (Biblioteca), avisamos para volver al flujo
        if (__returnToAddToListItemId) {
          document.dispatchEvent(new CustomEvent("quacker:lists-created", {
            detail: {
              listId: created?.id ?? null,
              returnToAddToListItemId: __returnToAddToListItemId
            }
          }));
          __returnToAddToListItemId = null;
        }
      }

      closeListModal();
      await load();
    } catch (e) {
      console.error(e);
      showListErrors("No se pudo guardar la lista. Mira la consola.");
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
    box.style.display = msg ? "block" : "none";
    box.textContent = msg || "";
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
      });
    }

    document.addEventListener("quacker:view-change", (e) => {
      const viewId = e.detail?.viewId;

      // Cuando entramos en "lists", recargamos y pintamos
      if (viewId === "lists") {
        load();
        return;
      }

      // Cuando salimos de "lists", ocultamos el contador de listas
      const subtitleText = document.getElementById("sectionSubtitleText");
      const listsInline = document.getElementById("listsCountInline");

      if (listsInline) listsInline.style.display = "none";
      if (subtitleText) subtitleText.textContent = "Resumen de tu actividad en Quacker";
    });

    document.addEventListener("quacker:lang-change", async () => {
      const isListsActive = document.querySelector("#view-lists")?.classList.contains("is-active");
      if (!isListsActive) return;

      render(false);

      const detailOpen = !_getEl("listDetail")?.hidden && !!activeListId;
      if (detailOpen) {
        const activeList = allLists.find((l) => String(l.id) === String(activeListId));
        if (activeList) {
          _renderActiveListDetailHeader(activeList);
          await renderActiveListItems();
        }
      }
    });

    // Volver desde Explore a un detalle de lista concreto
    document.addEventListener("quacker:lists-open-detail", async (e) => {
      const listId = e?.detail?.listId ? String(e.detail.listId) : null;
      const highlightItemId = e?.detail?.highlightItemId ? String(e.detail.highlightItemId) : null;
      if (!listId) return;

      // Aseguramos vista + datos antes de abrir detalle
      window.Router?.showView("lists");
      await load();
      await openListDetail(listId);

      if (highlightItemId) {
        // Esperar un frame para asegurar DOM pintado
        requestAnimationFrame(() => {
          const safe = (window.CSS && CSS.escape) ? CSS.escape(String(highlightItemId)) : String(highlightItemId);
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
      });
    });

    const grid = document.getElementById("listsGrid");
    if (grid) {
      grid.addEventListener("click", async (e) => {
        // Si clico en "editar"
        const editBtn = e.target.closest('[data-action="edit-list"]');
        if (editBtn) {
          e.stopPropagation();
          const id = editBtn.dataset.id;
          if (!id) return;
          openListModal(id);
          return;
        }

        // Si clico en "eliminar"
        const delBtn = e.target.closest('[data-action="delete-list"]');
        if (delBtn) {
          e.stopPropagation();

          const id = delBtn.dataset.id;
          const name = delBtn.dataset.name || "esta lista";

          pendingDeleteListId = id;

          const text = document.getElementById("confirmDeleteListText");
          if (text) {
            text.textContent = `¿Seguro que quieres eliminar "${name}"?`;
          }

          openConfirmDeleteListModal();

          return;
        }

        // Click normal en la card: abrir detalle
        const card = e.target.closest(".list-card");
        if (card) {
          const id = card.dataset.id;
          if (!id) return;
          await openListDetail(id);
        }

      });
    }

    document.getElementById("btnBackToLists")?.addEventListener("click", () => {
      closeListDetail();
    });

    // Filtros del detalle (búsqueda / tipo / estado)
    const qInput = _getEl("listDetailSearch");
    if (qInput) {
      qInput.addEventListener("input", () => {
        const v = String(qInput.value || "").trim().toLowerCase();
        detailSearch = v;

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
        renderActiveListItems();
      });
    }

    const statusSel = _getEl("listDetailStatusFilter");
    if (statusSel) {
      statusSel.addEventListener("change", () => {
        detailStatus = String(statusSel.value || "all");
        renderActiveListItems();
      });
    }

    // Desde el detalle: ir a Explorar en modo "añadir a esta lista"
    document.getElementById("btnAddContentToList")?.addEventListener("click", () => {
      if (!activeListId) return;

      const current = (allLists || []).find(l => String(l.id) === String(activeListId));
      const listName = current?.name ? String(current.name) : null;

      // Emitimos el modo para Explore (incluimos nombre para UI inmediata)
      document.dispatchEvent(new CustomEvent("quacker:lists-add-mode", {
        detail: { listId: String(activeListId), listName }
      }));

      // Navegamos a Explorar
      window.Router?.showView("explore");

      window.toast?.({
        title: "Añadir a lista",
        message: "Selecciona contenido en Explorar para añadirlo a esta lista.",
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

        const itemId = rm.dataset.itemId;
        if (!itemId) return;

        await removeItemFromActiveList(itemId);
      });
    }


    // Botón "+ Nueva lista"
    document.getElementById("btnNewList")?.addEventListener("click", () => openListModal(null));

    // Crear
    document.getElementById("saveListModal")?.addEventListener("click", saveListFromModal);

    // Confirmar eliminar (CON toast y deshacer)
    document.getElementById("confirmDeleteList")?.addEventListener("click", async () => {
      if (!pendingDeleteListId) return;

      const btn = document.getElementById("confirmDeleteList");
      const cancelBtn = document.getElementById("cancelDeleteList");
      const closeBtn = document.getElementById("closeConfirmDeleteList");

      const prevHtml = btn?.innerHTML || "Eliminar";

      if (btn) {
        if (btn.dataset.busy === "1") return; // evitar doble click
        btn.disabled = true;
        btn.dataset.busy = "1";
        btn.innerHTML = `
          <span class="btn-spinner" aria-hidden="true"></span>
          <span>Eliminando…</span>
        `;
      }

      if (cancelBtn) cancelBtn.disabled = true;
      if (closeBtn) closeBtn.disabled = true;

      // 1) Snapshot COMPLETO de listas (para deshacer perfecto: ids/orden/items)
      lastDeletedListSnapshot = {
        deletedId: String(pendingDeleteListId),
        deletedName: (() => {
          const found = allLists.find(l => String(l.id) === String(pendingDeleteListId));
          return found?.name ? String(found.name) : "Lista";
        })(),
        lists: JSON.parse(JSON.stringify(allLists || []))
      };

      try {
        // Animación de salida (antes de borrar)
        const card = _findListCardById(pendingDeleteListId);
        if (card) {
          card.classList.add("is-removing");
          await _sleep(200);
        }

        // 2) Borramos la lista
        await ApiClient.deleteList(pendingDeleteListId);

        // 3) Cerramos modal y recargamos
        closeConfirmDeleteListModal();
        await load();

        // 4) Mostramos toast con "Deshacer" (restauración perfecta vía snapshot)
        const snap = lastDeletedListSnapshot;

        if (snap?.lists?.length || Array.isArray(snap?.lists)) {
          window.toast?.({
            title: "Lista eliminada",
            message: `Se ha eliminado: ${snap.deletedName}`,
            type: "info",
            duration: 5000,
            actionLabel: "Deshacer",
            onAction: async () => {
              // Si ya no hay snapshot, no hacemos nada
              if (!lastDeletedListSnapshot?.lists) return;

              const snapshotToRestore = lastDeletedListSnapshot;
              // Consumimos el snapshot para evitar dobles “deshacer”
              lastDeletedListSnapshot = null;

              await ApiClient.setLists(snapshotToRestore.lists);

              // Defensivo: si estamos en la vista de Listas, recargamos para que sea inmediato
              const isListsActive = document.querySelector("#view-lists")?.classList.contains("is-active");
              if (isListsActive) {
                await load();

                // micro-FX + scroll a la tarjeta restaurada (premium y claro)
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
                title: "Cambios deshechos",
                message: `Se restauró: ${snapshotToRestore.deletedName}`,
                type: "success",
                duration: 2200
              });
            }
          });
        }
      } catch (err) {
        console.error(err);
        _showConfirmDeleteErrors("No se pudo eliminar la lista. Inténtalo de nuevo.");
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
      __returnToAddToListItemId = e?.detail?.returnToAddToListItemId ? String(e.detail.returnToAddToListItemId) : null;

      try {
        openListModal(null); // modo crear
      } catch (err) {
        console.error(err);
      }
    });

  }

  return { init, load, render };
})();

// Exponer al scope global
window.ListsModule = ListsModule;