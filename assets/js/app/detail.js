// assets/js/app/detail.js
// Detail v1 — placeholder module.
// La lógica real se migrará desde explore.js en commits separados.

const DetailModule = (() => {
  function init() {
    // Placeholder intencionado.
  }

  function open(item, options = {}) {
    console.warn("[DetailModule] open() not implemented yet", { item, options });
  }

  function close() {
    console.warn("[DetailModule] close() not implemented yet");
  }

  return {
    init,
    open,
    close
  };
})();

window.DetailModule = DetailModule;