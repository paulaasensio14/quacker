// assets/js/data/mock-data.js
// Backend falso usando localStorage para desarrollo local.
// Aquí centralizamos user, library, lists, activities, goals, etc.

const FakeBackend = (() => {
  const STORAGE_KEY = "quacker_data_v1";

  const daysAgoISO = (days) =>
  new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  const DEFAULT_STATE = {
    user: {
      id: "demo-user",
      email: "demo@quacker.app",
      name: "Arnau",
      handle: "@arnauduck"
    },
    lists: [],
    library: [
  {
    id: "bbad",
    type: "serie",
    title: "Breaking Bad",
    status: "watching",
    progress: 65,
    meta: {
      season: 3,
      episode: 7
    },
    cover: "",
    createdAt: "2025-12-05T20:10:00.000Z",
    updatedAt: "2025-12-09T18:00:00.000Z"
  },
  {
    id: "dune",
    type: "book",
    title: "Dune",
    status: "reading",
    progress: 30,
    meta: {
      pagesRead: 200,
      totalPages: 650
    },
    cover: "",
    createdAt: "2025-11-30T10:00:00.000Z",
    updatedAt: "2025-12-08T21:30:00.000Z"
  },
  {
    id: "witcher3",
    type: "game",
    title: "The Witcher 3",
    status: "playing",
    progress: 45,
    meta: {
      platform: "PC"
    },
    cover: "",
    createdAt: "2025-11-25T19:00:00.000Z",
    updatedAt: "2025-12-07T22:15:00.000Z"
  },{
  id: "backlog_test_1",
  type: "book",
  title: "Libro olvidado de prueba",
  status: "reading",            // importante: estado "en progreso"
  progress: 25,                 // entre 1 y 99
  meta: {
    pagesRead: 50,
    totalPages: 200
  },
  cover: "",
  createdAt: "2024-01-01T00:00:00.000Z",
  updatedAt: "2025-12-03T00:00:00.000Z"
},
{
  id: "bk_serie_03",
  title: "The Bear",
  type: "serie",
  status: "watching",
  progress: 55,
  meta: { season: 2, episode: 1 },
  cover: "",
  createdAt: daysAgoISO(120),
  updatedAt: daysAgoISO(20)
},
{
  id: "bk_pelicula_02",
  title: "Arrival",
  type: "pelicula",
  status: "watching",
  progress: 30,
  meta: {},
  cover: "",
  createdAt: daysAgoISO(90),
  updatedAt: daysAgoISO(15)
},

// ─────────────────────────────
// Backlog olvidado (contenido de prueba)
// Progreso 1–99 + updatedAt antiguo (ISO)
// Tipos normalizados: serie | pelicula | book | game
// ─────────────────────────────
{
  id: "bk_serie_01",
  title: "Dark",
  type: "serie",
  status: "watching",
  progress: 35,
  meta: { season: 2, episode: 3 },
  cover: "",
  createdAt: daysAgoISO(120),
  updatedAt: daysAgoISO(10)
},
{
  id: "bk_serie_02",
  title: "The Expanse",
  type: "serie",
  status: "watching",
  progress: 60,
  meta: { season: 4, episode: 6 },
  cover: "",
  createdAt: daysAgoISO(160),
  updatedAt: daysAgoISO(18)
},
{
  id: "bk_pelicula_01",
  title: "Blade Runner 2049",
  type: "pelicula",
  status: "watching",
  progress: 45,
  meta: {},
  cover: "",
  createdAt: daysAgoISO(90),
  updatedAt: daysAgoISO(14)
},
{
  id: "bk_book_01",
  title: "Dune Messiah",
  type: "book",
  status: "reading",
  progress: 22,
  meta: { pagesRead: 90, totalPages: 352 },
  cover: "",
  createdAt: daysAgoISO(200),
  updatedAt: daysAgoISO(25)
},
{
  id: "bk_game_01",
  title: "Hades",
  type: "game",
  status: "playing",
  progress: 40,
  meta: { platform: "PC" },
  cover: "",
  createdAt: daysAgoISO(240),
  updatedAt: daysAgoISO(30)
}
  
],

    // Nuevo: registro de actividad
    activities: [
      {
        id: "act-demo-1",
        userId: "demo-user",
        type: "progress",
        targetType: "library_item",
        targetId: "bbad",
        minutes: 45,
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2).toISOString() // hace 2 días
      },
      {
        id: "act-demo-2",
        userId: "demo-user",
        type: "progress",
        targetType: "library_item",
        targetId: "dune",
        minutes: 30,
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 1).toISOString() // ayer
      },
      {
        id: "act-demo-3",
        userId: "demo-user",
        type: "completed",
        targetType: "library_item",
        targetId: "witcher3",
        minutes: 60,
        createdAt: new Date().toISOString() // hoy
      }
    ],

    // Nuevo: reto mensual muy simple
    goals: [
      {
        id: "goal-december-sf",
        userId: "demo-user",
        title: "Reto de diciembre: Ciencia Ficción",
        description: "Lee 3 libros de ciencia ficción este mes.",
        type: "count_completed",
        target: 3,
        current: 2,
        periodStart: "2025-12-01",
        periodEnd: "2025-12-31",
        rewardLabel: "Badge de Explorador Galáctico"
      }
    ]

        ,
    // Nuevo: notificaciones del dashboard (persistentes)
    notifications: [
      {
        id: "notif-1",
        title: "¡No olvides terminar Breaking Bad!",
        text: "Llevas 2 días sin ver el siguiente episodio.",
        time: "Hace 1 h",
        color: "#2563eb",
        createdAt: new Date().toISOString()
      },
      {
        id: "notif-2",
        title: "Reto de diciembre: Ciencia Ficción",
        text: "Has leído 2 de 3 libros de ciencia ficción.",
        time: "Hace 2 h",
        color: "#7c3aed",
        createdAt: new Date().toISOString()
      },
      {
        id: "notif-3",
        title: "Nueva recomendación: The Witcher 3",
        text: "Basado en tu amor por los JRPGs largos.",
        time: "Hace 5 h",
        color: "#f97316",
        createdAt: new Date().toISOString()
      }
    ]

  };

  // ===== migración legacy (dashboard antiguos) =====
  // Importante:
  // - FakeBackend es el único que toca localStorage.
  // - Migramos SOLO si faltan datos en el state.
  // - Limpiamos keys antiguas del dashboard, pero NO borramos quacker_theme
  //   para no romper compatibilidad con la landing legacy.
  function _migrateLegacyKeys(state) {
    let changed = false;

    try {
      // --- user.theme (legacy: quacker_theme) ---
      const hasTheme = state && state.user && (state.user.theme === "dark" || state.user.theme === "light");
      if (!hasTheme) {
        const legacyTheme = localStorage.getItem("quacker_theme");
        if (legacyTheme === "dark" || legacyTheme === "light") {
          state.user = state.user || {};
          state.user.theme = legacyTheme;
          changed = true;
        }
      }

      // --- user.language (legacy: quacker_lang_dash) ---
      const hasLang = state && state.user && (state.user.language === "en" || state.user.language === "es");
      if (!hasLang) {
        const legacyLangDash = localStorage.getItem("quacker_lang_dash");
        if (legacyLangDash === "en" || legacyLangDash === "es") {
          state.user = state.user || {};
          state.user.language = legacyLangDash;
          changed = true;
        }
      }

      // --- user.library.ui.sortMode (legacy: quacker_library_sort) ---
      const hasSortMode =
        state &&
        state.user &&
        state.user.library &&
        state.user.library.ui &&
        typeof state.user.library.ui === "object" &&
        typeof state.user.library.ui.sortMode === "string" &&
        state.user.library.ui.sortMode.trim() !== "";

      if (!hasSortMode) {
        const legacySort = localStorage.getItem("quacker_library_sort");
        if (legacySort && typeof legacySort === "string") {
          state.user = state.user || {};
          state.user.library = state.user.library || {};
          state.user.library.ui =
            (state.user.library.ui && typeof state.user.library.ui === "object")
              ? state.user.library.ui
              : {};
          state.user.library.ui.sortMode = legacySort;
          changed = true;
        }
      }

      // --- explore.ui (legacy: quacker_explore_ui_v1) ---
      const hasExploreUI =
        state &&
        state.user &&
        state.user.explore &&
        state.user.explore.ui &&
        typeof state.user.explore.ui === "object" &&
        Object.keys(state.user.explore.ui).length > 0;

      if (!hasExploreUI) {
        try {
          const rawExploreUI = localStorage.getItem("quacker_explore_ui_v1");
          if (rawExploreUI) {
            const legacyExploreUI = JSON.parse(rawExploreUI);
            if (legacyExploreUI && typeof legacyExploreUI === "object") {
              state.user = state.user || {};
              state.user.explore = state.user.explore || {};
              state.user.explore.ui = state.user.explore.ui && typeof state.user.explore.ui === "object"
                ? state.user.explore.ui
                : {};

              if (typeof legacyExploreUI.typeFilter === "string") state.user.explore.ui.typeFilter = legacyExploreUI.typeFilter;
              if (typeof legacyExploreUI.sortMode === "string") state.user.explore.ui.sortMode = legacyExploreUI.sortMode;
              if (typeof legacyExploreUI.searchTerm === "string") state.user.explore.ui.searchTerm = legacyExploreUI.searchTerm;

              changed = true;
            }
          }
        } catch (e) {
          console.warn("FakeBackend: migración legacy quacker_explore_ui_v1 falló", e);
        }
      }

      // limpieza legacy explore ui (si existe)
      try { localStorage.removeItem("quacker_explore_ui_v1"); } catch (_) {}

      // --- lists (legacy: quacker_lists) ---
      const hasLists = Array.isArray(state?.lists) && state.lists.length > 0;

      let migratedLists = false;

      if (!hasLists) {
        try {
          const stored = localStorage.getItem("quacker_lists");
          if (stored) {
            const legacyLists = JSON.parse(stored);

            if (Array.isArray(legacyLists) && legacyLists.length > 0) {
              state.lists = legacyLists.map((l, idx) => {
                const rawItems = Array.isArray(l?.items) ? l.items : [];
                const items = rawItems
                  .map((x) => {
                    const id = (typeof x === "string") ? x : x?.id;
                    if (!id) return null;
                    return {
                      id: String(id),
                      addedAt: (typeof x === "object" && x?.addedAt)
                        ? x.addedAt
                        : new Date().toISOString()
                    };
                  })
                  .filter(Boolean);

                const nowIso = new Date().toISOString();

                return {
                  id: String(l?.id ?? `${Date.now()}_${idx}`),
                  name: (l?.name ?? "Sin nombre").toString(),
                  description: (l?.description ?? "").toString(),
                  visibility: (l?.visibility === "public" || l?.visibility === "collab")
                    ? l.visibility
                    : "private",
                  items,
                  itemsCount: Number.isFinite(l?.itemsCount) ? l.itemsCount : items.length,
                  createdAt: (l?.createdAt && typeof l.createdAt === "string") ? l.createdAt : nowIso,
                  updatedAt: (l?.updatedAt && typeof l.updatedAt === "string") ? l.updatedAt : nowIso
                };
              });

              changed = true;
              migratedLists = true;
            }
          }
        } catch (e) {
          console.warn("FakeBackend: migración legacy quacker_lists falló", e);
        }
      }

      // Limpieza keys legacy del dashboard antiguo (no tocamos quacker_theme)
      try { localStorage.removeItem("quacker_lang_dash"); } catch (_) {}
      try { localStorage.removeItem("quacker_library_sort"); } catch (_) {}

      if (migratedLists) {
        try { localStorage.removeItem("quacker_lists"); } catch (_) {}
      }

    } catch (e) {
      console.warn("FakeBackend: migración legacy falló", e);
    }

    return changed;
  }

  function _load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);

      if (!raw) {
        const first = { ...DEFAULT_STATE, lists: [] };
        _save(first);
        return first;
      }

      const parsed = JSON.parse(raw);

      // Mezclamos por si ya había datos antiguos sin activities/goals
      const merged = {
        ...DEFAULT_STATE,
        ...parsed,
        user: { ...DEFAULT_STATE.user, ...(parsed.user || {}) },
        lists: parsed.lists || DEFAULT_STATE.lists.slice(),
        library: parsed.library || DEFAULT_STATE.library.slice(),
        activities: parsed.activities || DEFAULT_STATE.activities.slice(),
        goals: parsed.goals || DEFAULT_STATE.goals.slice(),
        notifications: parsed.notifications || DEFAULT_STATE.notifications.slice()
      };

      // Migración legacy (si aplica) y persistencia en el state único
      const migrated = _migrateLegacyKeys(merged);
      if (migrated) {
        _save(merged);
      }

      return merged;

    } catch (e) {
      console.warn("FakeBackend._load error", e);
      return { ...DEFAULT_STATE };
    }
  }

  function _save(data) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }

  // ===== helpers genéricos =====
  function getState() {
    return _load();
  }

  function saveState(data) {
    _save(data);
  }

  // ===== actividades =====
  function addActivity(activityData) {
    const state = _load();
    const newActivity = {
      id: activityData.id || String(Date.now()),
      userId: activityData.userId || state.user.id,
      type: activityData.type || "progress",
      targetType: activityData.targetType || "library_item",
      targetId: activityData.targetId,
      minutes: activityData.minutes ?? null,
      payload: activityData.payload || null,
      createdAt: activityData.createdAt || new Date().toISOString()
    };

    state.activities.push(newActivity);
    _save(state);
    return newActivity;
  }

  function getActivities() {
    const state = _load();
    return state.activities || [];
  }

  function getLastActivity() {
    const activities = getActivities();
    if (!activities.length) return null;
    // Ordenamos por fecha desc
    const sorted = [...activities].sort(
      (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
    );
    return sorted[0];
  }

  function removeActivitiesForItemSince(itemId, sinceIso, types = ["resume", "progress", "completed"]) {
    if (!itemId || !sinceIso) return { ok: false, removed: 0, reason: "missing_params" };

    const since = new Date(sinceIso);
    if (Number.isNaN(+since)) return { ok: false, removed: 0, reason: "invalid_since" };

    const state = _load();
    state.activities = Array.isArray(state.activities) ? state.activities : [];

    const typeSet = new Set((types || []).map(t => String(t)));

    const before = state.activities.length;

    state.activities = state.activities.filter((act) => {
      if (!act) return false;

      // Solo del item
      if (String(act.targetId) !== String(itemId)) return true;

      // Solo de los tipos indicados
      if (!typeSet.has(String(act.type || ""))) return true;

      // Solo desde la fecha indicada
      if (!act.createdAt) return true;
      const d = new Date(act.createdAt);
      if (Number.isNaN(+d)) return true;

      return d < since;
    });

    const removed = before - state.activities.length;
    _save(state);

    return { ok: true, removed };
  }

  return {
    getState,
    saveState,
    // actividades
    addActivity,
    getActivities,
    getLastActivity,
    removeActivitiesForItemSince
  };
})();
