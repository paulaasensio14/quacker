// assets/js/app/ui-theme.js
// Modo claro/oscuro dentro de la app (dashboard).
// Regla: UI → ApiClient → FakeBackend (nunca localStorage directo).

const UITheme = (() => {
  function _apply(mode) {
    const isDark = mode === "dark";
    document.body.classList.toggle("dark-theme", isDark);

    // si existe el toggle tipo píldora, marcamos estado visual
    const toggle = document.querySelector("[data-theme-toggle]");
    if (toggle) toggle.classList.toggle("is-dark", isDark);
  }

  async function init() {
    try {
      const prefs = await ApiClient.getUserPreferences?.();
      const theme = prefs?.theme === "dark" ? "dark" : "light";
      _apply(theme);

      const toggle = document.querySelector("[data-theme-toggle]");
      if (toggle && !toggle.__quackerBound) {
        toggle.__quackerBound = true;

        toggle.addEventListener("click", async () => {
          const next = document.body.classList.contains("dark-theme") ? "light" : "dark";

          // feedback inmediato (UX)
          _apply(next);

          // persistencia vía ApiClient
          try {
            await ApiClient.setUserTheme(next);

            window.toast?.({
              title: "Tema actualizado",
              message: next === "dark" ? "Modo oscuro activado." : "Modo claro activado.",
              type: "success",
              duration: 2200
            });
          } catch (e) {
            console.error(e);

            // rollback si falla
            const rollback = next === "dark" ? "light" : "dark";
            _apply(rollback);

            window.toast?.({
              title: "No se pudo guardar el tema",
              message: "Inténtalo de nuevo.",
              type: "error",
              duration: 3000
            });
          }
        });
      }
    } catch (e) {
      console.error("UITheme.init error", e);
      // fallback defensivo
      _apply("light");
    }
  }

  return { init };
})();
