// Navegación visual de Mi perfil: no modifica formularios ni datos.
(() => {
  const view = document.getElementById("view-profile");
  const layout = view?.querySelector(".profile-layout");
  const buttons = [...(view?.querySelectorAll("[data-profile-tab]") || [])];

  if (!layout || buttons.length !== 3) return;

  function activate(tab) {
    layout.dataset.activeProfileTab = tab;
    for (const button of buttons) {
      button.setAttribute(
        "aria-pressed",
        String(button.dataset.profileTab === tab)
      );
    }
  }

  for (const [index, button] of buttons.entries()) {
    button.addEventListener("click", () => {
      activate(button.dataset.profileTab);
    });

    button.addEventListener("keydown", (event) => {
      if (event.key !== "ArrowRight" &&
          event.key !== "ArrowLeft" &&
          event.key !== "Home" &&
          event.key !== "End") {
        return;
      }

      event.preventDefault();

      let nextIndex = index;

      if (event.key === "ArrowRight") {
        nextIndex = (index + 1) % buttons.length;
      } else if (event.key === "ArrowLeft") {
        nextIndex = (index - 1 + buttons.length) % buttons.length;
      } else if (event.key === "Home") {
        nextIndex = 0;
      } else if (event.key === "End") {
        nextIndex = buttons.length - 1;
      }

      const target = buttons[nextIndex];
      activate(target.dataset.profileTab);
      target.focus();
    });
  }

  // Permitir que el formulario muestre sus errores en la pestaña correcta.
  document.addEventListener("quacker:profile-show-tab", (event) => {
    const requested = event.detail?.tab;

    if (buttons.some(button => button.dataset.profileTab === requested)) {
      activate(requested);
    }
  });

  activate("perfil");
})();
