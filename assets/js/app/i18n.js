// assets/js/app/i18n.js
(function () {
  const STORAGE_KEY = "quacker:lang";
  const DEFAULT_LANG = "es";

  const messages = {
    es: {
      nav_home: "Inicio",
      nav_explore: "Explorar",
      nav_library: "Mi Biblioteca",
      nav_lists: "Listas personalizadas",
      nav_profile: "Mi perfil",
      nav_label: "Navegación",
      theme_light: "Modo claro",
      logout: "Cerrar sesión",

      home_summary: "Resumen de tu actividad en Quacker",
      explore_summary: "Novedades y recomendaciones para añadir a tu ocio",
      library_summary: "Resumen de tu actividad en Quacker",
      profile_summary: "Configura cómo apareces en Quacker.",

      explore_sort_recent: "Más reciente",
      explore_reset: "Restablecer",
      explore_loading: "Actualizando resultados...",
      explore_empty_title: "No hay resultados",
      explore_empty_text: "Prueba a cambiar el filtro o ajustar la búsqueda.",
      explore_empty_cta: "Restablecer filtros",
      explore_section_new: "Novedades",
      explore_section_trending: "Tendencias",
      explore_section_recommended: "Recomendados",
      explore_section_new_sub: "Lanzamientos recientes para añadir a tu ocio",
      explore_section_trending_sub: "Lo más comentado y popular en tu feed",
      explore_section_recommended_sub: "Opciones que encajan con tu biblioteca",
      explore_search_placeholder: "Buscar en Explorar...",

      pills_all: "Todo",
      pills_series: "Series",
      pills_movies: "Películas",
      pills_books: "Libros",
      pills_games: "Videojuegos",

      profile_language_label: "Idioma preferido",
      profile_language_es: "Español",
      profile_language_en: "English",
    },

    en: {
      nav_home: "Home",
      nav_explore: "Explore",
      nav_library: "My Library",
      nav_lists: "Custom Lists",
      nav_profile: "My Profile",
      nav_label: "Navigation",
      theme_light: "Light mode",
      logout: "Log out",

      home_summary: "Summary of your activity in Quacker",
      explore_summary: "News and recommendations to add to your leisure",
      library_summary: "Summary of your activity in Quacker",
      profile_summary: "Set up how you appear in Quacker.",

      explore_sort_recent: "Most recent",
      explore_reset: "Reset",
      explore_loading: "Updating results...",
      explore_empty_title: "No results found",
      explore_empty_text: "Try changing filters or adjusting your search.",
      explore_empty_cta: "Reset filters",
      explore_section_new: "New",
      explore_section_trending: "Trending",
      explore_section_recommended: "Recommended",
      explore_section_new_sub: "Recent releases to add to your leisure time",
      explore_section_trending_sub: "The most talked-about and popular in your feed",
      explore_section_recommended_sub: "Options that fit your library",
      explore_search_placeholder: "Search in Explore...",

      pills_all: "All",
      pills_series: "Series",
      pills_movies: "Movies",
      pills_books: "Books",
      pills_games: "Video games",

      profile_language_label: "Preferred language",
      profile_language_es: "Spanish",
      profile_language_en: "English",
    },
  };

  let currentLang = localStorage.getItem(STORAGE_KEY) || DEFAULT_LANG;

  function t(key) {
    return messages[currentLang]?.[key] ?? messages[DEFAULT_LANG]?.[key] ?? key;
  }

  function applyTranslations(root = document) {
    root.querySelectorAll("[data-i18n]").forEach((node) => {
      const key = node.dataset.i18n;
      node.textContent = t(key);
    });

    root.querySelectorAll("[data-i18n-placeholder]").forEach((node) => {
      const key = node.dataset.i18nPlaceholder;
      node.setAttribute("placeholder", t(key));
    });

    root.querySelectorAll("[data-lang]").forEach((btn) => {
      const isActive = btn.dataset.lang === currentLang;
      btn.classList.toggle("is-active", isActive);
      btn.setAttribute("aria-pressed", String(isActive));
    });

    document.documentElement.lang = currentLang;
  }

  function setLang(lang) {
    if (!messages[lang]) return;
    currentLang = lang;
    localStorage.setItem(STORAGE_KEY, lang);
    applyTranslations();
    document.dispatchEvent(
      new CustomEvent("quacker:lang-change", { detail: { lang } })
    );
  }

  function bindLanguageToggle() {
    document.querySelectorAll("[data-lang]").forEach((btn) => {
      btn.addEventListener("click", () => setLang(btn.dataset.lang));
    });
  }

  function init() {
    bindLanguageToggle();
    applyTranslations();
  }

  window.I18n = {
    init,
    t,
    setLang,
    getLang: () => currentLang,
    applyTranslations,
  };
})();