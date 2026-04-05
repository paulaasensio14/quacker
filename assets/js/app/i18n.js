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
      home_today: "Hoy",
      home_metric_weekly_time: "Tiempo esta semana",
      home_metric_weekly_time_sub: "Entre series, pelis y juegos",
      home_metric_in_progress: "Contenidos en progreso",
      home_metric_in_progress_sub: "No pierdas el hilo",
      home_metric_completed_year: "Completados este año",
      home_metric_completed_year_sub: "Tu biblioteca no para de crecer",
      home_metric_streak: "Racha actual",
      home_metric_streak_sub: "Actividad diaria en Quacker",
      home_continue_title: "Continúa donde lo dejaste",
      home_continue_view_all: "Ver todo",
      home_filter_type: "Tipo",
      home_filter_status: "Estado",
      home_status_not_started_plural: "No comenzados",
      home_status_up_to_date: "Al día",
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
      explore_results_title: "Resultados para",
      explore_results_showing: "Mostrando {count} resultado(s){suffix}",
      explore_action_view_more: "Ver más",
      explore_action_load_more: "Cargar más",
      explore_action_back: "Volver",
      
      pills_all: "Todo",
      pills_series: "Series",
      pills_movies: "Películas",
      pills_books: "Libros",
      pills_games: "Videojuegos",

      profile_language_label: "Idioma preferido",
      profile_language_es: "Español",
      profile_language_en: "English",
      profile_title: "Mi perfil",
      profile_avatar_upload: "Subir foto",
      profile_avatar_pick: "Elegir avatar",
      profile_name_label: "Nombre",
      profile_handle_label: "Usuario",
      profile_email_label: "Email",
      profile_bio_label: "Bio",
      profile_bio_placeholder: "Cuenta algo sobre ti...",
      profile_save: "Guardar cambios",
      profile_quick_summary_title: "Resumen rápido",
      profile_quick_summary_text: "Un pequeño snapshot de tu cuenta.",
      profile_completed_metric: "213 contenidos completados",
      profile_lists_metric: "6 listas personalizadas",
      profile_restore_demo: "Restaurar valores demo",
      profile_avatar_modal_title: "Elige un avatar",
      profile_avatar_modal_text: "Puedes elegir uno predefinido o subir tu foto.",
      profile_avatar_modal_upload: "Subir mi foto",

      profile_error_name_short: "El nombre debe tener al menos 2 caracteres.",
      profile_error_handle_required: "El usuario es obligatorio (por ejemplo: @tacorce).",
      profile_error_handle_invalid: "El usuario solo puede tener letras, números o _ (2–20 caracteres).",
      profile_error_email_required: "El email es obligatorio.",
      profile_error_email_invalid: "El email no parece válido.",
      profile_error_bio_long: "La bio es muy larga (máx. 180 caracteres).",
      profile_error_avatar_too_large: "La imagen es demasiado grande (máx. 1.5MB).",
      profile_saving: "Guardando...",
      profile_saved: "Perfil guardado",
      profile_save_error: "No se pudo guardar el perfil. Inténtalo de nuevo.",
      profile_restored: "Perfil restaurado",
      profile_restore_error: "No se pudo restaurar el perfil.",
      profile_fallback_name: "Sin nombre",

      library_type_series: "Serie",
      library_type_movie: "Película",
      library_type_book: "Libro",
      library_type_game: "Videojuego",

      library_status_completed: "Completado",
      library_status_not_started: "No empezado",
      library_status_in_progress: "En progreso",

      library_action_start: "Empezar",
      library_action_continue: "Continuar",

      library_pages: "páginas",
      library_progress_completed_suffix: "completado",
      library_progress_book_completed: "Libro completado",
      library_progress_series_completed: "Serie completada",
      library_progress_game_completed: "Juego completado",
      library_progress_movie_completed: "Película completada",

      library_empty_results_title: "No hay resultados",
      library_empty_results_text: "No hay contenidos que coincidan con tu búsqueda y los filtros actuales.",
      library_empty_results_cta: "Limpiar búsqueda y filtros",

      library_empty_search_title: "Sin resultados para tu búsqueda",
      library_empty_search_text: "No encontramos contenidos para “{query}” en tu biblioteca.",
      library_empty_search_cta: "Limpiar búsqueda",

      library_empty_filters_title: "No hay contenidos con esos filtros",
      library_empty_filters_text: "Prueba a cambiar o restablecer los filtros para ver más contenidos.",
      library_empty_filters_cta: "Restablecer filtros",

      library_load_error_title: "No se pudo cargar tu biblioteca",
      library_load_error_text: "Revisa la conexión o vuelve a intentarlo en unos segundos.",
      library_retry: "Reintentar",

      lists_subtitle: "Organiza tu contenido como quieras",
      lists_count_created_singular: "lista creada",
      lists_count_created_plural: "listas creadas",

      lists_visibility_public: "Pública",
      lists_visibility_collab: "Colaborativa",
      lists_visibility_private: "Privada",

      lists_item_singular: "elemento",
      lists_item_plural: "elementos",
      lists_untitled: "Sin nombre",
      lists_item_untitled: "Sin título",

      lists_load_error: "No se pudieron cargar las listas. Revisa la consola.",
      lists_empty_filtered: "No hay listas que coincidan con tu búsqueda o filtro.",
      lists_empty_initial: "Todavía no tienes listas. ¡Crea tu primera lista!",

      lists_type_content: "Contenido",
      lists_detail_empty: "Esta lista está vacía.",
      lists_detail_hint: "Puedes quitar contenido desde aquí",
      lists_detail_showing: "Mostrando {shown} de {total}",
      lists_detail_empty_filtered: "No hay resultados con los filtros actuales.",
      lists_remove: "Quitar",

      lists_remove_error_title: "No se pudo quitar",
      lists_remove_error_text: "Inténtalo de nuevo.",
      lists_remove_success_title: "Contenido quitado",
      lists_remove_success_text: "Se ha eliminado de la lista.",
      lists_undo: "Deshacer",
      lists_undo_success_title: "Cambios revertidos",
      lists_undo_success_text: "Se ha vuelto a añadir a la lista.",
      lists_undo_error_title: "No se pudo deshacer",
      lists_undo_error_text: "Inténtalo de nuevo.",
      global_search_placeholder: "Buscar contenido...",

      notif_title: "Notificaciones",
      notif_mark_all: "Marcar todas",
      notif_empty_title: "Sin notificaciones",
      notif_empty_text: "No tienes notificaciones nuevas.",

      profile_menu_settings: "Ajustes",
      profile_menu_theme: "Cambiar tema",

      list_detail_add_content: "Añadir contenido",
      lists_detail_title: "Lista",
      lists_detail_search_placeholder: "Buscar en la lista",
      lists_filter_all_status: "Todos",
      lists_filter_pending: "Pendiente",

      modal_delete_list_title: "Eliminar lista",
      modal_delete_list_text: "¿Seguro que quieres eliminar esta lista?",
      modal_delete_list_note: "Podrás deshacerlo desde el toast.",

      common_cancel: "Cancelar",
      common_untitled: "Sin título",
      common_delete: "Eliminar",

      confirm_clear_notifs_text: "¿Quieres marcar todas las notificaciones como vistas?",
      confirm_clear_notifs_note: "Podrás deshacer desde el toast.",
      explore_detail_label_rating: "Puntuación",
      explore_detail_label_meta: "Detalle",
      explore_detail_label_genres: "Géneros",
      explore_detail_label_summary: "Resumen",
      explore_drawer_add_library: "Añadir a biblioteca",
      explore_drawer_add_lists: "Añadir a una lista",
      explore_drawer_list_label: "Elegir lista",
      explore_drawer_list_placeholder: "Selecciona una lista",
      explore_drawer_list_confirm: "Guardar en lista",
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
      home_today: "Today",
      home_metric_weekly_time: "This week",
      home_metric_weekly_time_sub: "Across shows, movies, and games",
      home_metric_in_progress: "In progress",
      home_metric_in_progress_sub: "Don't lose the thread",
      home_metric_completed_year: "Completed this year",
      home_metric_completed_year_sub: "Your library keeps growing",
      home_metric_streak: "Current streak",
      home_metric_streak_sub: "Daily activity on Quacker",
      home_continue_title: "Continue where you left off",
      home_continue_view_all: "View all",
      home_filter_type: "Type",
      home_filter_status: "Status",
      home_status_not_started_plural: "Not started",
      home_status_up_to_date: "Up to date",
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
      explore_results_title: "Results for",
      explore_results_showing: "Showing {count} result(s){suffix}",
      explore_action_view_more: "View more",
      explore_action_load_more: "Load more",
      explore_action_back: "Back",

      pills_all: "All",
      pills_series: "Series",
      pills_movies: "Movies",
      pills_books: "Books",
      pills_games: "Video games",

      profile_language_label: "Preferred language",
      profile_language_es: "Spanish",
      profile_language_en: "English",
      profile_title: "My profile",
      profile_avatar_upload: "Upload photo",
      profile_avatar_pick: "Choose avatar",
      profile_name_label: "Name",
      profile_handle_label: "Username",
      profile_email_label: "Email",
      profile_bio_label: "Bio",
      profile_bio_placeholder: "Tell us about yourself...",
      profile_save: "Save changes",
      profile_quick_summary_title: "Quick summary",
      profile_quick_summary_text: "A small snapshot of your account.",
      profile_completed_metric: "213 completed items",
      profile_lists_metric: "6 custom lists",
      profile_restore_demo: "Restore demo values",
      profile_avatar_modal_title: "Choose an avatar",
      profile_avatar_modal_text: "You can choose a preset one or upload your photo.",
      profile_avatar_modal_upload: "Upload my photo",

      profile_error_name_short: "Name must be at least 2 characters long.",
      profile_error_handle_required: "Username is required (for example: @tacorce).",
      profile_error_handle_invalid: "Username can only contain letters, numbers or _ (2–20 characters).",
      profile_error_email_required: "Email is required.",
      profile_error_email_invalid: "Email does not look valid.",
      profile_error_bio_long: "Bio is too long (max. 180 characters).",
      profile_error_avatar_too_large: "Image is too large (max. 1.5MB).",
      profile_saving: "Saving...",
      profile_saved: "Profile saved",
      profile_save_error: "Could not save profile. Please try again.",
      profile_restored: "Profile restored",
      profile_restore_error: "Could not restore profile.",
      profile_fallback_name: "No name",

      library_type_series: "Series",
      library_type_movie: "Movie",
      library_type_book: "Book",
      library_type_game: "Video game",

      library_status_completed: "Completed",
      library_status_not_started: "Not started",
      library_status_in_progress: "In progress",

      library_action_start: "Start",
      library_action_continue: "Continue",

      library_pages: "pages",
      library_progress_completed_suffix: "completed",
      library_progress_book_completed: "Book completed",
      library_progress_series_completed: "Series completed",
      library_progress_game_completed: "Game completed",
      library_progress_movie_completed: "Movie completed",

      library_empty_results_title: "No results found",
      library_empty_results_text: "No content matches your search and current filters.",
      library_empty_results_cta: "Clear search and filters",

      library_empty_search_title: "No results for your search",
      library_empty_search_text: "We couldn't find content for “{query}” in your library.",
      library_empty_search_cta: "Clear search",

      library_empty_filters_title: "No content for these filters",
      library_empty_filters_text: "Try changing or resetting the filters to see more content.",
      library_empty_filters_cta: "Reset filters",

      library_load_error_title: "We couldn't load your library",
      library_load_error_text: "Check your connection or try again in a few seconds.",
      library_retry: "Retry",

      lists_subtitle: "Organize your content your way",
      lists_count_created_singular: "list created",
      lists_count_created_plural: "lists created",

      lists_visibility_public: "Public",
      lists_visibility_collab: "Collaborative",
      lists_visibility_private: "Private",

      lists_item_singular: "item",
      lists_item_plural: "items",
      lists_untitled: "Untitled",
      lists_item_untitled: "Untitled item",

      lists_load_error: "We couldn't load your lists. Check the console.",
      lists_empty_filtered: "No lists match your search or filter.",
      lists_empty_initial: "You don't have any lists yet. Create your first one!",

      lists_type_content: "Content",
      lists_detail_empty: "This list is empty.",
      lists_detail_hint: "You can remove content from here",
      lists_detail_showing: "Showing {shown} of {total}",
      lists_detail_empty_filtered: "No results for the current filters.",
      lists_remove: "Remove",

      lists_remove_error_title: "Couldn't remove item",
      lists_remove_error_text: "Please try again.",
      lists_remove_success_title: "Content removed",
      lists_remove_success_text: "It has been removed from the list.",
      lists_undo: "Undo",
      lists_undo_success_title: "Changes reverted",
      lists_undo_success_text: "It has been added back to the list.",
      lists_undo_error_title: "Couldn't undo",
      lists_undo_error_text: "Please try again.",

      global_search_placeholder: "Search content...",

      notif_title: "Notifications",
      notif_mark_all: "Mark all",
      notif_empty_title: "No notifications",
      notif_empty_text: "You have no new notifications.",

      profile_menu_settings: "Settings",
      profile_menu_theme: "Change theme",

      list_detail_add_content: "Add content",
      lists_detail_title: "List",
      lists_detail_search_placeholder: "Search in list",
      lists_filter_all_status: "All",
      lists_filter_pending: "Pending",

      modal_delete_list_title: "Delete list",
      modal_delete_list_text: "Are you sure you want to delete this list?",
      modal_delete_list_note: "You’ll be able to undo it from the toast.",

      common_cancel: "Cancel",
      common_untitled: "Untitled",
      common_delete: "Delete",

      confirm_clear_notifs_text: "Do you want to mark all notifications as seen?",
      confirm_clear_notifs_note: "You will be able to undo it from the toast.",
      explore_detail_label_rating: "Rating",
      explore_detail_label_meta: "Detail",
      explore_detail_label_genres: "Genres",
      explore_detail_label_summary: "Summary",
      explore_drawer_add_library: "Add to library",
      explore_drawer_add_lists: "Add to a list",
      explore_drawer_list_label: "Choose list",
      explore_drawer_list_placeholder: "Select a list",
      explore_drawer_list_confirm: "Save to list",
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