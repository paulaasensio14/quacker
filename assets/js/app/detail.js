// assets/js/app/detail.js
// Detail v1 — event boundary.
// La implementación real se migrará desde explore.js en commits separados.

const DetailModule = (() => {
  let __bound = false;

  let __detailViewItem = null;
  let __detailViewLoading = false;
  let __detailViewError = false;
  let __detailViewReqSeq = 0;
  let __detailViewLastFocusEl = null;
  let __detailOriginView = "explore";
  const __relatedItemsByEid = new Map();

  const __bridge = {
    open: null,
    close: null,
    hydrate: null
  };

  const __renderDeps = {};

  function registerRenderDeps(deps = {}) {
    Object.assign(__renderDeps, deps || {});
  }

  function registerBridge(bridge = {}) {
    if (typeof bridge.open === "function") __bridge.open = bridge.open;
    if (typeof bridge.close === "function") __bridge.close = bridge.close;
    if (typeof bridge.hydrate === "function") __bridge.hydrate = bridge.hydrate;
  }

  function setDetailState({
    item = __detailViewItem,
    loading = __detailViewLoading,
    error = __detailViewError,
    originView = __detailOriginView,
    lastFocusEl = __detailViewLastFocusEl
  } = {}) {
    __detailViewItem = item;
    __detailViewLoading = !!loading;
    __detailViewError = !!error;
    __detailOriginView = originView || "explore";
    __detailViewLastFocusEl = lastFocusEl || null;
  }

  function getDetailState() {
    return {
      item: __detailViewItem,
      loading: __detailViewLoading,
      error: __detailViewError,
      reqSeq: __detailViewReqSeq,
      originView: __detailOriginView,
      lastFocusEl: __detailViewLastFocusEl
    };
  }

  function nextRequestSeq() {
    __detailViewReqSeq += 1;
    return __detailViewReqSeq;
  }

  function resetDetailState() {
    __detailViewReqSeq += 1;
    __detailViewItem = null;
    __detailViewLoading = false;
    __detailViewError = false;
    __detailViewLastFocusEl = null;
    __detailOriginView = "explore";
    __relatedItemsByEid.clear();
  }

  function open(item, options = {}) {
    if (!item) return;

    if (!__bridge.open) {
      console.error("[DetailModule] Detail open bridge is not available");
      return;
    }

    __bridge.open(item, {
      originView: options.originView || "explore",
      triggerEl: options.triggerEl || null
    });
  }

  function openFromEvent(event) {
    const { item, originView, triggerEl } = event?.detail || {};

    open(item, {
      originView,
      triggerEl
    });
  }

  function close(options = {}) {
    if (!__bridge.close) {
      console.error("[DetailModule] Detail close bridge is not available");
      return;
    }

    __bridge.close({
      restoreFocus: options.restoreFocus !== false
    });
  }

  function render(item = __detailViewItem) {
    if (!item) return null;

    const detailEid = __renderDeps.normalizeId?.(item?.eid) || "";
    if (!detailEid) return item;

    __renderDeps.setActiveDetailState?.({
      item
    });

    const vm = __renderDeps.buildTextModel?.(item);
    const metaVm = __renderDeps.buildDetailMeta?.(item);

    if (!vm || !metaVm) {
      console.error("[DetailModule] Missing render view models");
      return item;
    }

    const titleEl = document.getElementById("contentDetailTitle");
    const metaEl = document.getElementById("contentDetailMeta");
    const coverEl = document.getElementById("contentDetailCover");
    const highlightsEl = document.getElementById("contentDetailHighlights");
    const heroActionsEl = document.getElementById("contentDetailHeroActions");
    const trailerLinkEl = document.getElementById("contentDetailTrailerLink");
    const quickGridEl = document.getElementById("contentDetailQuickGrid");
    const supportGridEl = document.getElementById("contentDetailSupportGrid");
    const metaFooterGridEl = document.getElementById("contentDetailMetaFooterGrid");
    const providersCardEl = document.getElementById("contentDetailProvidersCard");
    const providersMetaEl = document.getElementById("contentDetailProvidersMeta");
    const providersLinkEl = document.getElementById("contentDetailProvidersLink");
    const providersEl = document.getElementById("contentDetailProviders");
    const relatedSectionEl = document.getElementById("contentDetailRelatedSection");
    const relatedNavEl = document.getElementById("contentDetailRelatedNav");
    const relatedPrevBtnEl = document.getElementById("contentDetailRelatedPrev");
    const relatedNextBtnEl = document.getElementById("contentDetailRelatedNext");
    const relatedGridEl = document.getElementById("contentDetailRelatedGrid");
    const ratingCardEl = document.getElementById("contentDetailRatingCard");
    const ratingEl = document.getElementById("contentDetailRating");
    const metaPrimaryCardEl = document.getElementById("contentDetailMetaPrimaryCard");
    const metaPrimaryLabelEl = document.getElementById("contentDetailMetaPrimaryLabel");
    const metaPrimaryValueEl = document.getElementById("contentDetailMetaPrimaryValue");
    const metaSecondaryCardEl = document.getElementById("contentDetailMetaSecondaryCard");
    const metaSecondaryLabelEl = document.getElementById("contentDetailMetaSecondaryLabel");
    const metaSecondaryValueEl = document.getElementById("contentDetailMetaSecondaryValue");
    const genresCardEl = document.getElementById("contentDetailGenresCard");
    const metaTertiaryCardEl = document.getElementById("contentDetailMetaTertiaryCard");
    const metaTertiaryLabelEl = document.getElementById("contentDetailMetaTertiaryLabel");
    const metaTertiaryValueEl = document.getElementById("contentDetailMetaTertiaryValue");
    const listsCardEl = document.getElementById("contentDetailListsCard");
    const listsEl = document.getElementById("contentDetailListsCount");
    const genresEl = document.getElementById("contentDetailGenres");
    const castEl = document.getElementById("contentDetailCast");
    const castToggleBtn = document.getElementById("contentDetailCastToggle");
    const summaryEl = document.getElementById("contentDetailSummary");
    const addLibraryBtn = document.getElementById("contentDetailAddLibrary");
    const addListsBtn = document.getElementById("contentDetailAddLists");

    if (titleEl) titleEl.textContent = vm.title;
    if (metaEl) metaEl.textContent = vm.meta;

    __renderDeps.applyVisualCover?.(coverEl, item);
    __renderDeps.syncTrailerLink?.(trailerLinkEl, heroActionsEl, metaVm.trailerUrl);

    if (listsEl) listsEl.textContent = vm.detailListsCount;
    if (genresEl) genresEl.textContent = metaVm.genres;
    if (metaPrimaryLabelEl) metaPrimaryLabelEl.textContent = metaVm.primaryLabel;
    if (metaPrimaryValueEl) metaPrimaryValueEl.textContent = metaVm.primaryValue;
    if (metaSecondaryLabelEl) metaSecondaryLabelEl.textContent = metaVm.secondaryLabel;
    if (metaSecondaryValueEl) metaSecondaryValueEl.textContent = metaVm.secondaryValue;
    if (metaTertiaryLabelEl) metaTertiaryLabelEl.textContent = metaVm.tertiaryLabel;
    if (metaTertiaryValueEl) metaTertiaryValueEl.textContent = metaVm.tertiaryValue;
    if (ratingCardEl) ratingCardEl.hidden = !metaVm.showRatingCard;
    if (metaPrimaryCardEl) metaPrimaryCardEl.hidden = !metaVm.showPrimaryCard;
    if (metaSecondaryCardEl) metaSecondaryCardEl.hidden = !metaVm.showSecondaryCard;
    if (metaTertiaryCardEl) metaTertiaryCardEl.hidden = !metaVm.showTertiaryCard;

    if (quickGridEl) {
      quickGridEl.hidden = !(
        (metaPrimaryCardEl && !metaPrimaryCardEl.hidden) ||
        (metaSecondaryCardEl && !metaSecondaryCardEl.hidden)
      );
    }

    if (genresCardEl) genresCardEl.hidden = false;

    if (supportGridEl) {
      supportGridEl.hidden = !(
        (genresCardEl && !genresCardEl.hidden) ||
        (metaTertiaryCardEl && !metaTertiaryCardEl.hidden)
      );
    }

    if (listsCardEl) listsCardEl.hidden = false;

    if (metaFooterGridEl) {
      metaFooterGridEl.hidden = !(
        (ratingCardEl && !ratingCardEl.hidden) ||
        (listsCardEl && !listsCardEl.hidden)
      );
    }

    __renderDeps.renderRating?.(ratingEl, item);
    __renderDeps.renderHighlights?.(highlightsEl, metaVm.heroFacts, item);
    __renderDeps.renderProviders?.(
      providersCardEl,
      providersEl,
      providersMetaEl,
      providersLinkEl,
      metaVm.watchProviders,
      metaVm.watchProvidersRegion,
      metaVm.watchProvidersLink
    );
    __renderDeps.renderRelatedItems?.(
      relatedSectionEl,
      relatedGridEl,
      relatedNavEl,
      relatedPrevBtnEl,
      relatedNextBtnEl,
      item?.relatedItems
    );
    __renderDeps.renderCast?.(castEl, metaVm.cast, castToggleBtn);
    __renderDeps.renderSeasons?.(item, metaVm);

    if (summaryEl) {
      summaryEl.textContent = vm.summary;
    }

    if (addLibraryBtn) {
      addLibraryBtn.dataset.eid = detailEid;
      __renderDeps.syncAddLibraryButton?.(addLibraryBtn, item);
    }

    if (addListsBtn) {
      addListsBtn.dataset.eid = detailEid;
      addListsBtn.disabled = !!item.__saving;
    }

    __renderDeps.syncFeedback?.();
    __renderDeps.syncListPicker?.();

    return item;
  }

  function hydrate(item = __detailViewItem) {
    if (!item) return;

    if (!__bridge.hydrate) {
      console.error("[DetailModule] Detail hydrate bridge is not available");
      return;
    }

    return __bridge.hydrate(item);
  }

  function setRelatedItems(items = []) {
    __relatedItemsByEid.clear();

    (Array.isArray(items) ? items : []).forEach((item) => {
      const eid = String(item?.eid || "").trim();
      if (eid) __relatedItemsByEid.set(eid, item);
    });
  }

  function clearRelatedItems() {
    __relatedItemsByEid.clear();
  }

  function getRelatedItemByEid(eid) {
    const safeEid = String(eid || "").trim();
    if (!safeEid) return null;

    return __relatedItemsByEid.get(safeEid) || null;
  }

  function init() {
    if (__bound) return;
    __bound = true;

    document.addEventListener("quacker:open-detail", openFromEvent);
  }

  return {
    init,
    registerBridge,
    registerRenderDeps,
    open,
    close,
    render,
    hydrate,
    setRelatedItems,
    clearRelatedItems,
    getRelatedItemByEid,
    setDetailState,
    getDetailState,
    nextRequestSeq,
    resetDetailState
  };
})();

window.DetailModule = DetailModule;