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
  }

  function open(item, options = {}) {
    if (!item) return;

    if (!window.ExploreModule?.openContentDetail) {
      console.error("[DetailModule] Explore detail bridge is not available");
      return;
    }

    window.ExploreModule.openContentDetail(item, {
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
    if (!window.ExploreModule?.closeContentDetail) {
      console.error("[DetailModule] Explore detail close bridge is not available");
      return;
    }

    window.ExploreModule.closeContentDetail({
      restoreFocus: options.restoreFocus !== false
    });
  }

  function render(item = __detailViewItem) {
    if (!item) return;

    if (!window.ExploreModule?.renderContentDetail) {
      console.error("[DetailModule] Explore detail render bridge is not available");
      return;
    }

    window.ExploreModule.renderContentDetail(item);
  }

  function hydrate(item = __detailViewItem) {
    if (!item) return;

    if (!window.ExploreModule?.hydrateContentDetail) {
      console.error("[DetailModule] Explore detail hydrate bridge is not available");
      return;
    }

    return window.ExploreModule.hydrateContentDetail(item);
  }

  function getRelatedItemByEid(eid) {
    if (!window.ExploreModule?.getDetailRelatedItemByEid) {
      console.error("[DetailModule] Explore related item bridge is not available");
      return null;
    }

    return window.ExploreModule.getDetailRelatedItemByEid(eid);
  }

  function init() {
    if (__bound) return;
    __bound = true;

    document.addEventListener("quacker:open-detail", openFromEvent);
  }

  return {
    init,
    open,
    close,
    render,
    hydrate,
    getRelatedItemByEid,
    setDetailState,
    getDetailState,
    nextRequestSeq,
    resetDetailState
  };
})();

window.DetailModule = DetailModule;