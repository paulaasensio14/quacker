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
    render: null,
    hydrate: null
  };

  function registerBridge(bridge = {}) {
    if (typeof bridge.open === "function") __bridge.open = bridge.open;
    if (typeof bridge.close === "function") __bridge.close = bridge.close;
    if (typeof bridge.render === "function") __bridge.render = bridge.render;
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
    if (!item) return;

    if (!__bridge.render) {
      console.error("[DetailModule] Detail render bridge is not available");
      return;
    }

    __bridge.render(item);
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