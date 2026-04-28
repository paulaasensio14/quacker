// assets/js/app/detail.js
// Detail v1 — event boundary.
// La implementación real se migrará desde explore.js en commits separados.

const DetailModule = (() => {
  let __bound = false;

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
    getRelatedItemByEid
  };
})();

window.DetailModule = DetailModule;