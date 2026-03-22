// assets/js/data/api-client.js
// Capa de abstracción para futuras llamadas a API / backend real.
// Ahora usa FakeBackend como fuente de datos local.

const ApiClient = (() => {

  // =========================
  // TRANSPORT (local | http)
  // =========================
  // =========================
  // AUTO-TRANSPORT (dev)
  // =========================
  // Regla:
  // - file:// o servidor estático local (Live Server, etc.): local
  // - backend Node local en :3000: http
  // - despliegue normal same-origin con /api: http
  const __hostname = String(window.location.hostname || "").toLowerCase();
  const __port = String(window.location.port || "");
  const __protocol = String(window.location.protocol || "").toLowerCase();

  const __isFileProtocol = __protocol === "file:";
  const __isLocalHost = __hostname === "localhost" || __hostname === "127.0.0.1";
  const __isNodeServer = __isLocalHost && __port === "3000";
  const __isStaticLocalDev = __isLocalHost && __port !== "3000";

  const __cfg = {
    transport: (__isFileProtocol || __isStaticLocalDev) ? "local" : "http",
    baseUrl: "/api",      // prefijo del backend. Ej: "https://api.quacker.app"
    timeoutMs: 12000
  };

  function setTransport(mode) {
    __cfg.transport = (mode === "http") ? "http" : "local";
    return { ok: true, transport: __cfg.transport };
  }

  function setBaseUrl(url) {
    if (typeof url === "string" && url.trim()) __cfg.baseUrl = url.trim().replace(/\/+$/, "");
    return { ok: true, baseUrl: __cfg.baseUrl };
  }

  function getTransportInfo() {
    return { ...__cfg };
  }

  async function getCurrentSession() {
    if (_isHttp()) {
      try {
        const res = await _httpJson("GET", "/auth/me");
        return res; // { user: {...} }
      } catch (err) {
        return null;
      }
    }

    // modo local siempre válido
    return { user: { id: "demo-user" } };
  }

  function _isHttp() {
    return __cfg.transport === "http";
  }

  async function _httpJson(method, path, body) {
    const url = `${__cfg.baseUrl}${path.startsWith("/") ? path : `/${path}`}`;

    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), __cfg.timeoutMs);

    try {
      let res;
      try {
        res = await fetch(url, {
          method,
          headers: { "Content-Type": "application/json" },
          credentials: "include", // IMPORTANTE: cookies httpOnly para sesión
          body: body == null ? undefined : JSON.stringify(body),
          signal: ctrl.signal
        });
      } catch (e) {
        const err = new Error("network_error");
        err.status = 0;
        err.error = "network_error";
        throw err;
      }

      const text = await res.text();
      let json = null;

      try {
        json = text ? JSON.parse(text) : null;
      } catch (_) {
        json = { raw: text };
      }

      if (res.status === 401) {
        const isLandingPage =
          window.location.pathname === "/" ||
          window.location.pathname.endsWith("/index.html");

        if (!isLandingPage) {
          window.location.href = "/index.html";
        }

        const err = new Error("unauthenticated");
        err.status = 401;
        err.body = json;
        err.error = "unauthenticated";
        throw err;
      }

      if (!res.ok) {

        const errorCode = json?.error || "";
        const errorMessage = json?.message || "";
        const msg = errorCode || errorMessage || `HTTP ${res.status}`;

        const err = new Error(msg);
        err.status = res.status;
        err.body = json;
        err.error = errorCode || msg;

        throw err;

      }

      return json;
    
    } catch (err) {

      if (err?.name === "AbortError") {
        const timeoutErr = new Error("timeout");
        timeoutErr.status = 0;
        timeoutErr.body = { error: "timeout" };
        timeoutErr.error = "timeout";
        throw timeoutErr;
      }

      if (err instanceof TypeError) {
        const networkErr = new Error("network_error");
        networkErr.status = 0;
        networkErr.body = { error: "network_error" };
        networkErr.error = "network_error";
        throw networkErr;
      }

      throw err;
    } finally {
      clearTimeout(t);
    }
  }

  // === helpers internos ===
  function _safeState() {
    if (typeof FakeBackend === "undefined") {
      return {
        user: null,
        lists: [],
        library: [],
        activities: [],
        goals: []
      };
    }
    return FakeBackend.getState();
  }

  function _formatTimeAgo(iso) {
    if (!iso) return "";
    const now = new Date();
    const date = new Date(iso);
    const diffMs = now - date;
    const diffMin = Math.round(diffMs / 60000);
    if (diffMin < 1) return "Hace un momento";
    if (diffMin < 60) return `Hace ${diffMin} min`;
    const diffH = Math.round(diffMin / 60);
    if (diffH < 24) return `Hace ${diffH} h`;
    const diffD = Math.round(diffH / 24);
    if (diffD === 1) return "Hace 1 día";
    return `Hace ${diffD} días`;
  }

  function _emitDataChanged(detail = {}) {
    try {
      document.dispatchEvent(new CustomEvent("quacker:data-changed", { detail }));
    } catch (_) {
      // defensivo: si CustomEvent falla por algún motivo, no rompemos la app
    }
  }

  // === auth (de momento fake) ===
  async function login(email, password) {
    if (_isHttp()) {
      // Backend real: sesión por cookie httpOnly
      const res = await _httpJson("POST", "/auth/login", { email, password });
      return res;
    }

    // modo local (demo)
    console.log("ApiClient.login", email);
    return { userId: "demo-user", email };
  }

  async function register(email, password, name) {
    if (_isHttp()) {
      const res = await _httpJson("POST", "/auth/register", { email, password, name });
      return res;
    }

    // modo local (demo)
    console.log("ApiClient.register", email);
    return { userId: "demo-user", email, name };
  }

  async function logout() {
    if (_isHttp()) {
      await _httpJson("POST", "/auth/logout");
      return { ok: true };
    }

    // modo local (demo)
    return { ok: true };
  }

  function ensureListsSeeded() {
    if (typeof FakeBackend === "undefined") return;

    const state = _safeState();
    state.lists = Array.isArray(state.lists) ? state.lists : [];

    // Si ya hay listas, nada que hacer.
    // La migración legacy de "quacker_lists" se hace en FakeBackend._load().
    if (state.lists.length > 0) return;

    // Guardamos estado consistente (listas vacías)
    FakeBackend.saveState(state);
  }

  async function getExploreFeed() {
    if (_isHttp()) {
      const res = await _httpJson("GET", "/explore");

      if (Array.isArray(res)) return res;
      if (Array.isArray(res?.items)) return res.items;

      return [];
    }

    return [];
  }

  // === listas (por ahora simplemente devuelven lo del estado) ===
  async function getLists() {
    ensureListsSeeded();

    const state = _safeState();
    state.lists = Array.isArray(state.lists) ? state.lists : [];

    return state.lists;
  }

  // Devuelve las listas donde está un item (para deshabilitar opciones y pintar estado)
  async function getListsContainingItem(itemId) {
    if (itemId == null) return [];

    const lists = await getLists();
    const target = String(itemId);

    return (lists || []).filter((l) => {
      const arr = Array.isArray(l.items) ? l.items : [];
      return arr.some((entry) => {
        const id = typeof entry === "string" ? entry : entry?.id;
        return String(id) === target;
      });
    });
  }

  // Explore: contar listas por título + tipo (helper)
  async function getListsCountByLibraryMatch({ title, type }) {
    if (!title || !type) return 0;

    const state = _safeState();
    const lists = state.lists || [];
    const library = _isHttp() ? await getLibrary() : (state.library || []);

    const libItem = (library || []).find(
      (i) =>
        String(i?.title || "").trim().toLowerCase() === String(title).trim().toLowerCase() &&
        String(i?.type || "") === String(type)
    );

    if (!libItem) return 0;

    const libId = String(libItem.id);
    let count = 0;

    for (const list of lists) {
      const arr = Array.isArray(list.items) ? list.items : [];

      const has = arr.some((entry) => {
        const id = (typeof entry === "string") ? entry : entry?.id;
        return String(id) === libId;
      });

      if (has) count++;
    }

    return count;
  }

  // Devuelve un mapa de conteos por key "title::type" para toda la biblioteca.
  // Esto evita hacer 1 llamada por item desde Explore.
  async function getListsCountMapByLibraryKey() {
    const state = _safeState();
    const lists = Array.isArray(state.lists) ? state.lists : [];
    const library = _isHttp() ? await getLibrary() : (Array.isArray(state.library) ? state.library : []);

    const idToKey = new Map();

    for (const item of (library || [])) {
      if (!item?.id) continue;
      const key = `${String(item?.title || "").trim().toLowerCase()}::${String(item?.type || "")}`;
      idToKey.set(String(item.id), key);
    }

    const counts = Object.create(null);

    for (const list of lists) {
      const items = Array.isArray(list.items) ? list.items : [];

      for (const entry of items) {
        const id = (typeof entry === "string") ? entry : entry?.id;
        if (!id) continue;

        const key = idToKey.get(String(id));
        if (!key) continue;

        counts[key] = (counts[key] || 0) + 1;
      }
    }

    return counts;
  }

  async function createList(listData) {
    const state = _safeState();
    state.lists = state.lists || [];

    const newList = {
      id: String(Date.now()),
      name: listData.name,
      description: listData.description || "",
      visibility: listData.visibility || "private",
      items: listData.items || [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    state.lists.push(newList);

    if (typeof FakeBackend !== "undefined") {
      FakeBackend.saveState(state);
    }

    _emitDataChanged({ kind: "lists", action: "create", listId: String(newList.id) });

    return newList;
  }

  async function updateList(listId, patch = {}) {
    const state = _safeState();
    state.lists = state.lists || [];
    const lists = state.lists;

    const idx = lists.findIndex(l => String(l.id) === String(listId));
    if (idx === -1) return null;

    const prev = lists[idx];
    const next = {
      ...prev,
      ...patch,
      updatedAt: new Date().toISOString()
    };

    lists[idx] = next;

    if (typeof FakeBackend !== "undefined") {
      FakeBackend.saveState(state);
    }

    _emitDataChanged({ kind: "lists", action: "update", listId: String(listId) });

    return next;
  }

  async function deleteList(listId) {
    const state = _safeState();
    const before = (state.lists || []).length;

    state.lists = (state.lists || []).filter(l => String(l.id) !== String(listId));

    if (typeof FakeBackend !== "undefined") {
      FakeBackend.saveState(state);
    }

    _emitDataChanged({ kind: "lists", action: "delete", listId: String(listId) });

    return { ok: true, deleted: before - state.lists.length };
  }

  // === listas: añadir / quitar items ===
  async function addLibraryItemToList(listId, itemId) {
    if (!listId || !itemId) return { ok: false };

    ensureListsSeeded();
    const state = _safeState();
    state.lists = state.lists || [];

    const list = state.lists.find(l => String(l.id) === String(listId));
    if (!list) return { ok: false, reason: "list_not_found" };

    const library = _isHttp() ? await getLibrary() : (state.library || []);
    const itemExists = library.some(i => String(i.id) === String(itemId));
    if (!itemExists) return { ok: false, reason: "item_not_found" };

    list.items = Array.isArray(list.items) ? list.items : [];

    const already = list.items.some(x => {
      const id = (typeof x === "string") ? x : x?.id;
      return String(id) === String(itemId);
    });

    if (already) {
      return { ok: true, already: true };
    }

    list.items.push({ id: String(itemId), addedAt: new Date().toISOString() });
    list.itemsCount = list.items.length;
    list.updatedAt = new Date().toISOString();

    if (typeof FakeBackend !== "undefined") {
      FakeBackend.saveState(state);
    }

    _emitDataChanged({
      kind: "lists",
      action: "add_item",
      listId: String(listId),
      itemId: String(itemId)
    });

    return { ok: true, listId: String(listId), itemId: String(itemId) };
  }

  async function removeLibraryItemFromList(listId, itemId) {
    if (!listId || !itemId) return { ok: false };

    ensureListsSeeded();

    const state = _safeState();
    state.lists = state.lists || [];

    const list = state.lists.find(l => String(l.id) === String(listId));
    if (!list) return { ok: false, reason: "list_not_found" };

    list.items = Array.isArray(list.items) ? list.items : [];

    const before = list.items.length;
    list.items = list.items.filter(x => {
      const id = (typeof x === "string") ? x : x?.id;
      return String(id) !== String(itemId);
    });

    list.itemsCount = list.items.length;
    list.updatedAt = new Date().toISOString();

    if (typeof FakeBackend !== "undefined") {
      FakeBackend.saveState(state);
    }

    _emitDataChanged({
      kind: "lists",
      action: "remove_item",
      listId: String(listId),
      itemId: String(itemId)
    });

    return { ok: true, removed: before - list.items.length };
  }

  async function setLists(nextLists = []) {
    const state = _safeState();
    state.lists = Array.isArray(nextLists) ? nextLists : [];

    if (typeof FakeBackend !== "undefined") {
      FakeBackend.saveState(state);
    }

    _emitDataChanged({
      kind: "lists",
      action: "set_all"
    });

    return { ok: true, count: state.lists.length };
  }

  // === perfil / usuario ===
  async function getUser() {
    if (_isHttp()) {
      // Backend real (por partes)
      const res = await _httpJson("GET", "/user");
      return res; // esperado: { id, name, handle, email, ... }
    }

    const state = _safeState();
    return state.user || null;
  }

  async function updateUser(patch = {}) {
    if (_isHttp()) {
      const res = await _httpJson("PATCH", "/user", patch);
      const user = res && res.user ? res.user : res;

      _emitDataChanged({
        kind: "user",
        action: "update"
      });

      return user;
    }

    const state = _safeState();
    state.user = { ...(state.user || {}), ...patch };

    if (typeof FakeBackend !== "undefined") {
      FakeBackend.saveState(state);
    }

    _emitDataChanged({
      kind: "user",
      action: "update"
    });

    return state.user;
  }

  // === preferencias (dashboard) ===
  // Regla: la UI NO toca localStorage. Migraciones legacy ocurren solo en FakeBackend.
  function getUserPreferences() {
    const state = _safeState();
    state.user = state.user || {};

    // Preferencias ya migradas por FakeBackend (si existían keys legacy)
    let theme = state.user.theme;
    let language = state.user.language;

    // Defaults defensivos
    theme = (theme === "dark" || theme === "light") ? theme : "light";
    language = (language === "en" || language === "es") ? language : "es";

    // Persistir en el estado si faltaba (sin tocar localStorage aquí)
    const patch = {};
    if (!state.user.theme) patch.theme = theme;
    if (!state.user.language) patch.language = language;

    if (Object.keys(patch).length > 0) {
      state.user = { ...state.user, ...patch };
      if (typeof FakeBackend !== "undefined") FakeBackend.saveState(state);
    }

    return { theme, language };
  }

  async function setUserTheme(theme) {
    const mode = (theme === "dark" || theme === "light") ? theme : "light";
    await updateUser({ theme: mode });
    return { ok: true, theme: mode };
  }

  async function setUserLanguage(language) {
    const lang = (language === "en" || language === "es") ? language : "es";
    await updateUser({ language: lang });
    return { ok: true, language: lang };
  }

  // === NOTIFICACIONES ===
  async function addNotification({ title, text = "", color = "#2563eb", icon = "check" } = {}) {
    const state = _safeState();
    state.notifications = state.notifications || [];

    const nowIso = new Date().toISOString();

    const notif = {
      id: `notif-${Date.now()}`,
      title: title || "Notificación",
      text,
      color,
      icon,
      time: "Ahora",
      createdAt: nowIso
    };

    // Insertar al principio (más reciente arriba)
    state.notifications.unshift(notif);

    // Limitar para que no crezcan infinito (UX + rendimiento)
    if (state.notifications.length > 30) {
      state.notifications = state.notifications.slice(0, 30);
    }

    if (typeof FakeBackend !== "undefined") {
      FakeBackend.saveState(state);
      _emitDataChanged({ kind: "notifications", action: "add", notificationId: String(notif?.id || "") });
    }

    return notif;
  }

  // === RACHA (notificación por hitos) ===
  async function maybeNotifyStreak() {
    const state = _safeState();
    state.user = state.user || {};

    // racha actual
    const stats = await getHomeStats();
    const streak = Number(stats?.streakDays || 0);

    // guardamos el último hito notificado para NO spamear
    const lastNotified = Number(state.user.lastStreakNotified || 0);

    // hitos (puedes cambiarlos)
    const milestones = [3, 7, 14, 30];

    // buscamos el mayor hito alcanzado
    const achieved = milestones.filter((m) => streak >= m).pop() || 0;

    // si no hay hito, o ya lo notificamos, salimos
    if (achieved <= 0) return { ok: true, notified: false };
    if (achieved <= lastNotified) return { ok: true, notified: false };

    // actualizar marca (regla de oro: UI→ApiClient→FakeBackend, con evento oficial)
    await updateUser({ lastStreakNotified: achieved });

    // Coherencia con Home:
    // - warm desde 3 (check)
    // - hot desde 7 (flame)
    const hot = achieved >= 7;
    const color = hot ? "#f97316" : "#2563eb";
    const icon = hot ? "flame" : "check";

    await addNotification({
      title: `Racha de ${achieved} días`,
      text: "Sigue así. Hoy también cuenta.",
      color,
      icon
    });

    return { ok: true, notified: true, streak: achieved };
  }

  async function undoActivitiesForItemSince(itemId, sinceIso) {
    if (!itemId || !sinceIso) return { ok: false, reason: "missing_params" };

    // En HTTP aún no existe Activities real en backend.
    // El undo visual/persistente del item se hace restaurando snapshot con updateLibraryItem().
    if (_isHttp()) {
      _emitDataChanged({
        kind: "activities",
        action: "undo_since",
        itemId: String(itemId),
        removed: 0
      });

      return { ok: true, removed: 0, mode: "http_noop" };
    }

    if (typeof FakeBackend === "undefined" || typeof FakeBackend.removeActivitiesForItemSince !== "function") {
      return { ok: false, reason: "backend_not_available" };
    }

    const state = _safeState();
    state.user = state.user || {};

    const res = FakeBackend.removeActivitiesForItemSince(
      String(itemId),
      String(sinceIso),
      ["resume", "progress", "completed"]
    );

    const removed = Number(res?.removed || 0);

    _emitDataChanged({
      kind: "activities",
      action: "undo_since",
      itemId: String(itemId),
      removed
    });

    try {
      const stats = await getHomeStats();
      const streak = Number(stats?.streakDays || 0);

      const milestones = [3, 7, 14, 30];
      const achievedNow = milestones.filter((m) => streak >= m).pop() || 0;

      const lastNotified = Number(state.user.lastStreakNotified || 0);

      if (lastNotified > achievedNow) {
        await updateUser({ lastStreakNotified: achievedNow });
      }
    } catch (e) {
      console.error("undoActivitiesForItemSince: reconcile streak failed", e);
    }

    return { ok: true, removed };
  }

  async function resumeLibraryItem(itemId) {
    if (!itemId) return { ok: false };

    // =========================
    // HTTP (backend real)
    // =========================
    if (_isHttp()) {
      const item = await getLibraryItemById(itemId);
      if (!item || !item.id) return { ok: false, reason: "not_found" };

      const now = new Date();
      const nowIso = now.toISOString();

      const fallbackIso =
        item.lastActivityAt ||
        item.updatedAt ||
        item.createdAt ||
        nowIso;

      const lastDate = new Date(fallbackIso);
      const daysSinceLast = Math.max(
        0,
        Math.floor((now - lastDate) / (1000 * 60 * 60 * 24))
      );

      let nextStatus = item.status;

      if (item.status === "not_started") {
        if (item.type === "serie") nextStatus = "watching";
        else if (item.type === "book") nextStatus = "reading";
        else if (item.type === "game") nextStatus = "playing";
        else nextStatus = "in_progress";
      }

      const updated = {
        ...item,
        status: nextStatus,
        updatedAt: nowIso,
        lastActivityAt: nowIso
      };

      await updateLibraryItem(updated, { logActivity: false });

      return {
        ok: true,
        daysSinceLast,
        itemId: item.id,
        title: item.title
      };
    }

    // =========================
    // LOCAL (FakeBackend)
    // =========================
    const state = _safeState();
    state.library = state.library || [];
    state.activities = state.activities || [];

    const item = state.library.find((i) => String(i.id) === String(itemId));
    if (!item) return { ok: false };

    const now = new Date();
    let lastDate = null;

    (state.activities || []).forEach((act) => {
      if (String(act.targetId) !== String(itemId)) return;
      if (!act.createdAt) return;
      const d = new Date(act.createdAt);
      if (!lastDate || d > lastDate) lastDate = d;
    });

    if (!lastDate) {
      const fallbackIso = item.updatedAt || item.createdAt;
      lastDate = fallbackIso ? new Date(fallbackIso) : now;
    }

    const daysSinceLast = Math.floor((now - lastDate) / (1000 * 60 * 60 * 24));

    const nowIso = now.toISOString();
    item.updatedAt = nowIso;
    if ("lastActivityAt" in item) item.lastActivityAt = nowIso;

    if (item.status === "not_started") {
      if (item.type === "serie") item.status = "watching";
      else if (item.type === "book") item.status = "reading";
      else if (item.type === "game") item.status = "playing";
      else item.status = "in_progress";
    }

    if (typeof FakeBackend !== "undefined") {
      FakeBackend.saveState(state);
    }

    if (typeof FakeBackend !== "undefined" && typeof FakeBackend.addActivity === "function") {
      FakeBackend.addActivity({
        type: "resume",
        targetType: "library_item",
        targetId: item.id,
        minutes: 0
      });
    }

    if (daysSinceLast >= 7) {
      const hot = daysSinceLast >= 14;

      await addNotification({
        title: `Retomado: ${item.title}`,
        text: `Volviste después de ${daysSinceLast} días.`,
        color: hot ? "#f97316" : "#2563eb",
        icon: hot ? "flame" : "resume"
      });
    }

    _emitDataChanged({ kind: "library", action: "resume", itemId: String(item.id) });
    return { ok: true, daysSinceLast, itemId: item.id, title: item.title };
  }

  // Completar contenido (desde Biblioteca / Home)
  async function completeLibraryItem(itemId) {
    if (!itemId) return { ok: false };

    // =========================
    // HTTP (backend real)
    // =========================
    if (_isHttp()) {
      const targetId = String(itemId);

      const current = await _httpJson("GET", `/library/${encodeURIComponent(targetId)}`);
      if (!current) return { ok: false, reason: "not_found" };

      if (Number(current.progress ?? 0) >= 100 || current.status === "completed") {
        return { ok: true, alreadyCompleted: true };
      }

      const payload = {
        progress: 100,
        status: "completed"
      };

      const res = await _httpJson("PATCH", `/library/${encodeURIComponent(targetId)}`, payload);
      const item = (res && res.item) ? res.item : res;

      _emitDataChanged({ kind: "library", action: "complete", itemId: targetId });
      return { ok: true, itemId: targetId, title: item?.title || current.title };
    }

    // =========================
    // LOCAL (FakeBackend)
    // =========================
    const state = _safeState();
    state.library = state.library || [];
    state.activities = state.activities || [];

    const item = state.library.find(i => String(i.id) === String(itemId));
    if (!item) return { ok: false };

    // Si ya estaba completado, no hacemos nada
    if (item.progress >= 100 || item.status === "completed") {
      return { ok: true, alreadyCompleted: true };
    }

    // Marcar como completado
    item.progress = 100;
    item.status = "completed";
    item.updatedAt = new Date().toISOString();

    // Guardar estado
    if (typeof FakeBackend !== "undefined") FakeBackend.saveState(state);

    // Registrar actividad
    if (typeof FakeBackend !== "undefined" && typeof FakeBackend.addActivity === "function") {
      FakeBackend.addActivity({
        type: "completed",
        targetType: "library_item",
        targetId: item.id,
        minutes: 0
      });
    }

    // Notificación automática
    await addNotification({
      title: "Completado",
      text: item.title,
      color: "#16a34a",
      icon: "check"
    });

    await maybeNotifyStreak();

    _emitDataChanged({ kind: "library", action: "complete", itemId: String(itemId) });
    return { ok: true, itemId: item.id, title: item.title };
  }

  async function progressLibraryItem(itemId, delta = 5) {
    
    // =========================
    // HTTP (backend real)
    // =========================
    if (_isHttp()) {
      const targetId = String(itemId);

      // Traemos item actual del backend
      const current = await _httpJson("GET", `/library/${encodeURIComponent(targetId)}`);
      if (!current) return { ok: false, reason: "not_found" };

      const prev = Number(current.progress ?? 0);
      const safeDelta = Math.max(1, Math.min(100, Number(delta || 0)));
      const next = Math.min(100, Math.max(0, prev + safeDelta));

      const justCompleted = next >= 100 && prev < 100;

      const payload = {
        progress: next,
        status: next >= 100 ? "completed" : current.status
      };

      const res = await _httpJson(
        "PATCH",
        `/library/${encodeURIComponent(targetId)}`,
        payload
      );

      _emitDataChanged({ kind: "library", action: "progress", itemId: targetId });

      return { ok: true, justCompleted, itemId: targetId };
    }

    if (itemId == null) return { ok: false, reason: "missing_id" };

    const state = _safeState();

    _emitDataChanged({ kind: "library", action: "progress", itemId: targetId });

    return { ok: true, justCompleted, itemId: targetId };
  }

  // === biblioteca ===
  async function getLibrary() {
    if (_isHttp()) {
      // Backend real (por partes)
      const res = await _httpJson("GET", "/library");
      // Permitimos dos formatos: array directo o wrapper { items: [...] }
      if (Array.isArray(res)) return res;
      if (res && Array.isArray(res.items)) return res.items;
      return [];
    }

    // modo local (demo)
    const state = _safeState();
    return state.library || [];
  }

  async function getLibraryItemById(itemId) {
    if (itemId == null) return null;

    if (_isHttp()) {
      try {
        const res = await _httpJson("GET", `/library/${encodeURIComponent(String(itemId))}`);
        if (!res) return null;
        return res && res.item ? res.item : res;
      } catch (_) {
        return null;
      }
    }

    const state = _safeState();
    const library = state.library || [];
    return library.find(i => String(i.id) === String(itemId)) || null;
  }

  async function updateLibraryItem(updatedItem, { logActivity = true } = {}) {
    if (!updatedItem?.id) return { ok: false, reason: "missing_id" };

    // =========================
    // HTTP (backend real)
    // =========================
    if (_isHttp()) {
      // Nota: el backend debe decidir si registra activity (progress/completed) según logActivity
      // para mantener racha coherente sin que el cliente toque /activities directamente.
      const itemId = String(updatedItem.id);

      const payload = {
        ...updatedItem,
        logActivity: !!logActivity
      };

      const res = await _httpJson("PATCH", `/library/${encodeURIComponent(itemId)}`, payload);

      // Permitimos que el backend devuelva { item } o el item directo
      const item = (res && res.item) ? res.item : res;

      _emitDataChanged({ kind: "library", action: "update", itemId });

      return { ok: true, item };
    }

    // =========================
    // LOCAL (FakeBackend)
    // =========================
    const state = _safeState();
    state.library = state.library || [];

    const idx = state.library.findIndex(i => String(i.id) === String(updatedItem.id));
    if (idx === -1) return { ok: false, reason: "not_found" };

    const prev = state.library[idx];
    const next = {
      ...prev,
      ...updatedItem,
      meta: { ...(prev.meta || {}), ...(updatedItem.meta || {}) },
      updatedAt: new Date().toISOString()
    };

    const pct = Math.max(0, Math.min(100, Number(next.progress ?? 0)));
    next.progress = pct;

    if (pct >= 100) next.status = "completed";
    if (pct <= 0 && next.status === "completed") next.status = "not_started";

    state.library[idx] = next;

    if (typeof FakeBackend !== "undefined") {
      FakeBackend.saveState(state);

      if (logActivity) {
        const actType =
          pct >= 100 ? "completed" :
          pct > 0 ? "progress" :
          null;

        if (actType) {
          FakeBackend.addActivity({
            type: actType,
            targetType: "library_item",
            targetId: next.id,
            minutes: 20
          });

          await maybeNotifyStreak();
        }
      }
    }

    _emitDataChanged({ kind: "library", action: "update", itemId: String(next.id) });

    return { ok: true, item: next };
  }

  async function deleteLibraryItem(itemId) {
    if (itemId == null) return { ok: false, reason: "missing_id" };

    const idStr = String(itemId);

    // =========================
    // HTTP (backend real)
    // =========================
    if (_isHttp()) {
      await _httpJson("DELETE", `/library/${encodeURIComponent(idStr)}`);

      _emitDataChanged({ kind: "library", action: "delete", itemId: idStr });

      return { ok: true };
    }

    // =========================
    // LOCAL (FakeBackend)
    // =========================
    const state = _safeState();
    state.library = state.library || [];
    state.lists = state.lists || [];

    const idx = state.library.findIndex(i => String(i.id) === idStr);
    if (idx === -1) return { ok: false, reason: "not_found" };

    const removed = state.library[idx];

    state.library.splice(idx, 1);

    // integridad: quitar de listas donde aparezca
    state.lists.forEach((list) => {
      const arr = Array.isArray(list.items) ? list.items : [];
      const before = arr.length;

      const filtered = arr.filter((entry) => {
        const id = (typeof entry === "string") ? entry : entry?.id;
        return String(id) !== idStr;
      });

      if (filtered.length !== before) {
        list.items = filtered;
        list.itemsCount = filtered.length;
        list.updatedAt = new Date().toISOString();
      }
    });

    if (typeof FakeBackend !== "undefined") {
      FakeBackend.saveState(state);
    }

    _emitDataChanged({ kind: "library", action: "delete", itemId: idStr });

    return { ok: true, removed };
  }

  async function restoreLibraryItem(item, { toFront = true } = {}) {
    if (!item?.id) return { ok: false, reason: "missing_id" };

    const state = _safeState();
    state.library = state.library || [];

    const exists = state.library.some(i => String(i.id) === String(item.id));
    if (exists) return { ok: true, already: true, item };

    const restored = {
      ...item,
      updatedAt: new Date().toISOString()
    };
    if (!restored.createdAt) restored.createdAt = restored.updatedAt;

    if (toFront) state.library.unshift(restored);
    else state.library.push(restored);

    if (typeof FakeBackend !== "undefined") {
      FakeBackend.saveState(state);
      _emitDataChanged({ kind: "library", action: "restore", itemId: String(item.id) });
    }

    return { ok: true, item: restored };
  }

  // === EXPLORE: ocultados (persistente en user) ===
  function _ensureExploreUserState(state) {
    state.user = state.user || {};
    state.user.explore = state.user.explore || {};
    state.user.explore.dismissed = Array.isArray(state.user.explore.dismissed)
      ? state.user.explore.dismissed
      : [];
    return state.user.explore;
  }

  // === EXPLORE: UI state (filtros/orden/búsqueda) persistente en user ===
  function _ensureExploreUIState(state) {
    const explore = _ensureExploreUserState(state);
    explore.ui = explore.ui && typeof explore.ui === "object" ? explore.ui : {};
    return explore.ui;
  }

  async function getExploreUIState() {
    const state = _safeState();
    const ui = _ensureExploreUIState(state);

    return {
      typeFilter: (ui.typeFilter && typeof ui.typeFilter === "string") ? ui.typeFilter : "all",
      sortMode: (ui.sortMode && typeof ui.sortMode === "string") ? ui.sortMode : "recent",
      searchTerm: (ui.searchTerm && typeof ui.searchTerm === "string") ? ui.searchTerm : ""
    };
  }

  async function setExploreUIState(patch = {}) {
    const state = _safeState();
    const ui = _ensureExploreUIState(state);

    const next = {
      ...ui,
      ...patch
    };

    // defensivo: solo strings
    if (typeof next.typeFilter !== "string") next.typeFilter = "all";
    if (typeof next.sortMode !== "string") next.sortMode = "recent";
    if (typeof next.searchTerm !== "string") next.searchTerm = "";

    state.user.explore.ui = next;

    if (typeof FakeBackend !== "undefined") FakeBackend.saveState(state);

    return { ok: true, ui: next };
  }

  // === LIBRARY: UI state (orden) persistente en user ===
  function _ensureLibraryUIState(state) {
    state.user = state.user || {};
    state.user.library = state.user.library || {};
    state.user.library.ui = state.user.library.ui && typeof state.user.library.ui === "object"
      ? state.user.library.ui
      : {};
    return state.user.library.ui;
  }

  function getLibraryUIState() {
    const state = _safeState();
    const ui = _ensureLibraryUIState(state);

    // La migración de keys legacy se hace en FakeBackend._load()
    return {
      sortMode: (ui.sortMode && typeof ui.sortMode === "string") ? ui.sortMode : "recent",
      typeFilter: (ui.typeFilter && typeof ui.typeFilter === "string") ? ui.typeFilter : "all",
      statusFilter: (ui.statusFilter && typeof ui.statusFilter === "string") ? ui.statusFilter : "all",
      searchTerm: (ui.searchTerm && typeof ui.searchTerm === "string") ? ui.searchTerm : ""
    };
  }

  async function setLibraryUIState(patch = {}) {
    const state = _safeState();
    const ui = _ensureLibraryUIState(state);

    const next = { ...ui, ...patch };
    if (typeof next.sortMode !== "string") next.sortMode = "recent";
    if (typeof next.typeFilter !== "string") next.typeFilter = "all";
    if (typeof next.statusFilter !== "string") next.statusFilter = "all";
    if (typeof next.searchTerm !== "string") next.searchTerm = "";

    state.user.library.ui = next;
    if (typeof FakeBackend !== "undefined") FakeBackend.saveState(state);

    return { ok: true, ui: next };
  }

  async function getExploreDismissed() {
    const state = _safeState();
    const explore = _ensureExploreUserState(state);
    return explore.dismissed;
  }

  async function dismissExploreItem(eid) {
    if (!eid) return { ok: false };

    const state = _safeState();
    const explore = _ensureExploreUserState(state);

    const key = String(eid);
    if (!explore.dismissed.includes(key)) {
      explore.dismissed.unshift(key);
      // límite razonable para no crecer infinito
      if (explore.dismissed.length > 500) {
        explore.dismissed = explore.dismissed.slice(0, 500);
      }
    }

    if (typeof FakeBackend !== "undefined") {
      FakeBackend.saveState(state);
    }

    return { ok: true };
  }

  async function clearExploreDismissed() {
    const state = _safeState();
    const explore = _ensureExploreUserState(state);
    explore.dismissed = [];

    if (typeof FakeBackend !== "undefined") {
      FakeBackend.saveState(state);
    }

    return { ok: true };
  }

  // === biblioteca ===
  async function createLibraryItem(data = {}) {

    if (_isHttp()) {
      const res = await _httpJson("POST", "/library", data);
      _emitDataChanged({ kind: "library", action: "create", itemId: String(res?.id || "") });
      return res;
    }

    const state = _safeState();
    state.library = state.library || [];

    const type = data.type || "pelicula";

    const defaultStatus =
      type === "book" ? "reading" :
      type === "game" ? "playing" :
      type === "serie" ? "watching" :
      "watching";

    const newItem = {
      id: String(Date.now()),
      type,
      title: (data.title || "").trim(),
      status: defaultStatus,
      progress: 0,
      meta: data.meta || {},
      cover: data.cover || "",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    state.library.push(newItem);

    if (typeof FakeBackend !== "undefined") {
      FakeBackend.saveState(state);
    }

    _emitDataChanged({ kind: "library", action: "create", itemId: String(newItem.id) });

    return newItem;
  }

  // === DASHBOARD HOME: métricas ===
  async function getHomeStats() {
    let library = [];
    let activities = [];

    if (_isHttp()) {
      library = await getLibrary();
      activities = [];
    } else {
      const state = _safeState();
      library = state.library || [];
      activities = state.activities || [];
    }

    const now = new Date();

    const weekAgo = new Date(now);
    weekAgo.setDate(now.getDate() - 7);

    function _dateKeyLocal(d) {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      return `${y}-${m}-${day}`;
    }

    const todayKey = _dateKeyLocal(now);

    let weeklyMinutes = 0;
    let todayMinutes = 0;
    let completedThisYear = 0;
    let completedToday = 0;

    const MEANINGFUL_ACTIVITY_TYPES = new Set(["progress", "completed"]); // (resume NO cuenta)

    activities.forEach((act) => {
      if (!MEANINGFUL_ACTIVITY_TYPES.has(act.type)) return;
      const d = new Date(act.createdAt);
      const dateKey = _dateKeyLocal(d);

      // minutos esta semana
      if (act.minutes && d >= weekAgo && d <= now) {
        weeklyMinutes += act.minutes;
      }

      // minutos hoy
      if (act.minutes && dateKey === todayKey) {
        todayMinutes += act.minutes;
      }

      // completados este año / hoy
      if (act.type === "completed") {
        if (d.getFullYear() === now.getFullYear()) {
          completedThisYear += 1;
        }
        if (dateKey === todayKey) {
          completedToday += 1;
        }
      }
    });

    const inProgressCount = library.filter((item) => {
      const pct = Number(item.progress ?? 0);

      // En progreso = progreso real, no solo status
      if (pct <= 0) return false;
      if (pct >= 100) return false;
      if (item.status === "completed") return false;

      return true;
    }).length;

    if (_isHttp()) {
      completedThisYear = library.filter((item) => {
        if (item.status !== "completed") return false;
        const updatedAt = item.updatedAt ? new Date(item.updatedAt) : null;
        if (!updatedAt || Number.isNaN(updatedAt.getTime())) return false;
        return updatedAt.getFullYear() === now.getFullYear();
      }).length;

      completedToday = library.filter((item) => {
        if (item.status !== "completed") return false;
        const updatedAt = item.updatedAt ? new Date(item.updatedAt) : null;
        if (!updatedAt || Number.isNaN(updatedAt.getTime())) return false;
        return _dateKeyLocal(updatedAt) === todayKey;
      }).length;
    }

    // racha: días seguidos con al menos una actividad
    const activeDays = new Set(
      activities
        .filter((a) => MEANINGFUL_ACTIVITY_TYPES.has(a.type))
        .map((a) => _dateKeyLocal(new Date(a.createdAt)))
    );

    let streakDays = 0;
    const cursor = new Date();
    cursor.setHours(0, 0, 0, 0);

    while (true) {
      const key = _dateKeyLocal(cursor);
      if (activeDays.has(key)) {
        streakDays += 1;
        cursor.setDate(cursor.getDate() - 1);
      } else {
        break;
      }
    }

    return {
      weeklyMinutes,
      todayMinutes,
      inProgressCount,
      completedThisYear,
      completedToday,
      streakDays
    };
  }


  // === DASHBOARD HOME: última actividad ===
  async function getLastActivityDetailed() {
    let item = null;
    let activityDate = null;

    if (_isHttp()) {
      const library = await getLibrary();

      item = [...library]
        .filter((it) => {
          const pct = Number(it.progress ?? 0);
          return pct > 0 || it.status === "completed";
        })
        .sort((a, b) => {
          const aTime = a?.updatedAt ? new Date(a.updatedAt).getTime() : 0;
          const bTime = b?.updatedAt ? new Date(b.updatedAt).getTime() : 0;
          return bTime - aTime;
        })[0] || null;

      activityDate = item?.updatedAt || null;
      if (!item || !activityDate) return null;
    } else {
      if (typeof FakeBackend === "undefined") return null;

      const state = _safeState();
      const activities = Array.isArray(state.activities) ? state.activities : [];
      const MEANINGFUL = new Set(["progress", "completed"]);

      const last = [...activities]
        .filter((a) => a && MEANINGFUL.has(a.type) && a.targetId && a.createdAt)
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0] || null;

      if (!last) return null;

      const library = state.library || [];
      item = library.find((i) => i.id === last.targetId) || null;
      activityDate = last.createdAt;

      if (!item) {
        return {
          id: null,
          title: "Actividad reciente",
          meta: "",
          timeAgo: _formatTimeAgo(last.createdAt),
          progressPercent: 0,
          progressLabel: ""
        };
      }
    }

    let meta = "";

    if (item.type === "serie") {
      const s = Number(item.meta?.season);
      const e = Number(item.meta?.episode);

      if (Number.isFinite(s) && s > 0 && Number.isFinite(e) && e > 0) {
        meta = `T${s} · E${e}`;
      } else {
        meta = "";
      }
    }

    if (item.type === "book") {
      const pr = Number(item.meta?.pagesRead);
      const tp = Number(item.meta?.totalPages);

      if (Number.isFinite(pr) && pr > 0 && Number.isFinite(tp) && tp > 0) {
        meta = `${pr} / ${tp} páginas`;
      } else {
        meta = "";
      }
    }

    if (item.type === "pelicula" || item.type === "game") {
      const pct = Math.max(0, Math.min(100, Number(item.progress ?? 0)));
      meta = `${Math.round(pct)}%`;
    }

    const progressPercent = Math.max(0, Math.min(100, Number(item.progress ?? 0)));
    const progressLabel = `${Math.round(progressPercent)}%`;

    return {
      id: item.id,
      type: item.type,
      title: item.title,
      meta,
      timeAgo: _formatTimeAgo(activityDate),
      progressPercent,
      progressLabel,
      cover: item.cover || null
    };
  }

  // === DASHBOARD HOME: feed de actividad (lista) ===
  async function getRecentActivitiesDetailed(limit = 30, filter = "all") {
    const state = _safeState();
    const activities = Array.isArray(state.activities) ? state.activities : [];
    const library = Array.isArray(state.library) ? state.library : [];

    const MEANINGFUL = new Set(["progress", "completed"]); // resume NO cuenta

    function typeLabel(t) {
      if (t === "progress") return "Progreso";
      if (t === "completed") return "Completado";
      return "Actividad";
    }

    function formatTimeAgo(iso) {
      return _formatTimeAgo(iso);
    }

    function metaForItem(item) {
      if (!item) return "";

      // Serie: T# · E# (sin fallback)
      if (item.type === "serie") {
        const s = Number(item.meta?.season);
        const e = Number(item.meta?.episode);
        if (Number.isFinite(s) && s > 0 && Number.isFinite(e) && e > 0) return `T${s} · E${e}`;
        return "";
      }

      // Libro: X / Y páginas (sin fallback)
      if (item.type === "book") {
        const pr = Number(item.meta?.pagesRead);
        const tp = Number(item.meta?.totalPages);
        if (Number.isFinite(pr) && pr > 0 && Number.isFinite(tp) && tp > 0) return `${pr} / ${tp} páginas`;
        return "";
      }

      // Película / Juego: % real
      if (item.type === "pelicula" || item.type === "game") {
        const pct = Math.max(0, Math.min(100, Number(item.progress ?? 0)));
        return `${Math.round(pct)}%`;
      }

      return "";
    }

    const filtered = activities
      .filter((a) => MEANINGFUL.has(a.type))
      .filter((a) => {
        if (filter === "all") return true;
        return a.type === filter;
      })
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, limit)
      .map((act) => {
        const item = library.find((i) => i.id === act.targetId) || null;

        return {
          id: act.id,

          // TIPO DE ACTIVIDAD (no de contenido)
          activityType: act.type, // "progress" | "completed"

          // Tipo real del contenido (para iconos secundarios si quieres)
          itemType: item?.type || "other",

          itemId: act.targetId || null,
          itemTitle: item?.title || "Contenido",
          itemMeta: metaForItem(item),
          timeAgo: _formatTimeAgo(act.createdAt)
        };
      });

    return filtered;
  }

  // === DASHBOARD HOME: reto mensual ===
  async function getMonthlyChallenge() {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();

    const fallbackChallenges = [
      {
        id: "jan-reset",
        title: "Reto de enero: Nuevo comienzo",
        description: "Completa 1 contenido este mes.",
        target: 1,
        rewardLabel: "Insignia Nuevo Comienzo"
      },
      {
        id: "feb-focus",
        title: "Reto de febrero: Mes en foco",
        description: "Completa 2 contenidos este mes.",
        target: 2,
        rewardLabel: "Insignia Mes en Foco"
      },
      {
        id: "mar-momentum",
        title: "Reto de marzo: Coge ritmo",
        description: "Completa 2 contenidos este mes.",
        target: 2,
        rewardLabel: "Insignia Coge Ritmo"
      },
      {
        id: "apr-spring",
        title: "Reto de abril: Primavera activa",
        description: "Completa 1 contenido este mes.",
        target: 1,
        rewardLabel: "Insignia Primavera Activa"
      },
      {
        id: "may-streak",
        title: "Reto de mayo: Sigue avanzando",
        description: "Completa 2 contenidos este mes.",
        target: 2,
        rewardLabel: "Insignia Sigue Avanzando"
      },
      {
        id: "jun-summer",
        title: "Reto de junio: Empieza el verano",
        description: "Completa 2 contenidos este mes.",
        target: 2,
        rewardLabel: "Insignia Inicio de Verano"
      },
      {
        id: "jul-marathon",
        title: "Reto de julio: Maratón de verano",
        description: "Completa 3 contenidos este mes.",
        target: 3,
        rewardLabel: "Insignia Maratón de Verano"
      },
      {
        id: "aug-chill",
        title: "Reto de agosto: Relax con ritmo",
        description: "Completa 1 contenido este mes.",
        target: 1,
        rewardLabel: "Insignia Relax con Ritmo"
      },
      {
        id: "sep-back",
        title: "Reto de septiembre: Vuelta al hábito",
        description: "Completa 2 contenidos este mes.",
        target: 2,
        rewardLabel: "Insignia Vuelta al Hábito"
      },
      {
        id: "oct-spooky",
        title: "Reto de octubre: Especial de otoño",
        description: "Completa 2 contenidos este mes.",
        target: 2,
        rewardLabel: "Insignia Especial de Otoño"
      },
      {
        id: "nov-push",
        title: "Reto de noviembre: Último empujón",
        description: "Completa 2 contenidos este mes.",
        target: 2,
        rewardLabel: "Insignia Último Empujón"
      },
      {
        id: "dec-finish",
        title: "Reto de diciembre: Cierra el año",
        description: "Completa 3 contenidos este mes.",
        target: 3,
        rewardLabel: "Insignia Cierre del Año"
      }
    ];

    const end = new Date(year, month + 1, 0, 23, 59, 59);
    const diffMs = end - now;
    const diffD = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));

    let library = [];
    let state = null;

    if (_isHttp()) {
      library = await getLibrary();
    } else {
      state = _safeState();
      library = state.library || [];
    }

    const persistedGoal = state?.goals?.[0] || null;
    if (persistedGoal) {
      const goalEnd = new Date(persistedGoal.periodEnd + "T23:59:59");
      const goalDiffMs = goalEnd - now;
      const goalDiffD = Math.max(0, Math.ceil(goalDiffMs / (1000 * 60 * 60 * 24)));

      return {
        id: persistedGoal.id,
        title: persistedGoal.title,
        description: persistedGoal.description,
        current: persistedGoal.current,
        target: persistedGoal.target,
        daysRemaining: goalDiffD,
        rewardLabel: persistedGoal.rewardLabel
      };
    }

    const fallback = fallbackChallenges[month];

    const completedThisMonth = library.filter((item) => {
      if (item.status !== "completed") return false;
      const updatedAt = item.updatedAt ? new Date(item.updatedAt) : null;
      if (!updatedAt || Number.isNaN(updatedAt.getTime())) return false;
      return updatedAt.getFullYear() === year && updatedAt.getMonth() === month;
    }).length;

    return {
      id: fallback.id,
      title: fallback.title,
      description: fallback.description,
      current: Math.min(completedThisMonth, fallback.target),
      target: fallback.target,
      daysRemaining: diffD,
      rewardLabel: fallback.rewardLabel
    };
  }

  // Backlog
  async function getBacklogItems(limit = 4, minDays = 5) {
    const now = new Date();

    let library = [];
    let activities = [];

    if (_isHttp()) {
      library = await getLibrary();
      activities = [];
    } else {
      const state = _safeState();
      library = state.library || [];
      activities = state.activities || [];
    }

    const BACKLOG_MIN_DAYS_BY_TYPE = {
      serie: 3,
      book: 5,
      game: 7,
      pelicula: 10,
      default: minDays
    };

    function minDaysForType(type) {
      return BACKLOG_MIN_DAYS_BY_TYPE[type] ?? BACKLOG_MIN_DAYS_BY_TYPE.default;
    }

    const lastActivityMap = new Map();

    if (!_isHttp()) {
      activities.forEach((act) => {
        if (!act.targetId || !act.createdAt) return;
        const prev = lastActivityMap.get(act.targetId);
        const curr = new Date(act.createdAt);
        if (!prev || curr > prev) {
          lastActivityMap.set(act.targetId, curr);
        }
      });
    }

    function progressLabelFor(item) {
      const pct = item.progress ?? 0;

      if (item.type === "serie" && item.meta) {
        const s = item.meta.season || 1;
        const e = item.meta.episode || 1;
        return `T${s} · E${e}`;
      }

      if (item.type === "book" && item.meta?.pagesRead && item.meta?.totalPages) {
        return `${item.meta.pagesRead}/${item.meta.totalPages} páginas`;
      }

      if (item.type === "game") {
        return `${pct}% completado`;
      }

      return `${pct}% completado`;
    }

    const candidates = library
      .filter((item) => {
        const pct = Number(item.progress ?? 0);
        return pct > 0 && pct < 100 && item.status !== "completed";
      })
      .map((item) => {
        const fallbackIso =
          item.lastActivityAt ||
          item.updatedAt ||
          item.createdAt ||
          now.toISOString();

        const lastDate = _isHttp()
          ? new Date(fallbackIso)
          : (lastActivityMap.get(item.id) || new Date(fallbackIso));

        const diffMs = now - lastDate;
        const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));

        return {
          id: item.id,
          type: item.type,
          title: item.title,
          daysSinceLast: days,
          progressPercent: item.progress ?? 0,
          progressLabel: progressLabelFor(item),
          cover: item.cover || ""
        };
      })
      .filter((row) => row.daysSinceLast >= minDaysForType(row.type));

    candidates.sort((a, b) => b.daysSinceLast - a.daysSinceLast);

    return candidates.slice(0, limit);
  }

  // === DASHBOARD HOME: sugerencias ===
  async function getSuggestions() {
    const state = _safeState();
    const library = state.library || [];
    if (!library.length) return [];

    // Por ahora: coger los 3 primeros como “sugerencias”
    return library.slice(0, 3).map((item) => ({
      id: item.id,
      title: item.title,
      note:
        item.status === "watching"
          ? "Serie en progreso."
          : item.status === "reading"
          ? "Lectura en curso."
          : item.status === "playing"
          ? "Partida abierta."
          : "En tu biblioteca."
    }));
  }

  // === NOTIFICACIONES (dashboard) ===
  async function getNotifications() {
    const state = _safeState();
    return state.notifications || [];
  }

  async function dismissNotification(notificationId) {
    const state = _safeState();
    state.notifications = (state.notifications || []).filter(
      (n) => String(n.id) !== String(notificationId)
    );

    if (typeof FakeBackend !== "undefined") {
      FakeBackend.saveState(state);
      _emitDataChanged({ kind: "notifications", action: "dismiss", notificationId: String(notificationId) });
    }

    return { ok: true };
  }

  async function clearNotifications() {
    const state = _safeState();
    state.notifications = [];

    if (typeof FakeBackend !== "undefined") {
      FakeBackend.saveState(state);
      _emitDataChanged({ kind: "notifications", action: "clear_all" });
    }

    return { ok: true };
  }

  async function setNotifications(nextList = []) {
    const state = _safeState();
    state.notifications = Array.isArray(nextList) ? nextList : [];

    if (typeof FakeBackend !== "undefined") {
      FakeBackend.saveState(state);
      _emitDataChanged({ kind: "notifications", action: "set_all" });
    }

    return { ok: true, count: state.notifications.length };
  }

  // === DASHBOARD HOME: "Continúa donde lo dejaste" ===
  async function getContinueWatchingItems() {
    const library = await getLibrary();

    function progressLabelFor(item) {
      const pct = item.progress ?? 0;

      if (pct >= 100) {
        if (item.type === "book") return "Libro completado";
        if (item.type === "serie") return "Serie completada";
        if (item.type === "game") return "Juego completado";
        return "Completado";
      }

      if (item.type === "serie" && item.meta) {
        const s = item.meta.season || 1;
        const e = item.meta.episode || 1;
        return `T${s} · E${e} · ${pct}%`;
      }

      if (item.type === "book" && item.meta?.pagesRead && item.meta?.totalPages) {
        return `${item.meta.pagesRead}/${item.meta.totalPages} páginas`;
      }

      if (item.type === "game") {
        return `${pct}% completado`;
      }

      return `${pct}% completado`;
    }

    return library.map((item) => {
      const pct = Number(item.progress ?? 0);

      const status =
        (pct >= 100 || item.status === "completed")
          ? "completed"
          : (pct <= 0)
            ? "not_started"
            : "in_progress";

      return {
        id: item.id,
        type: item.type,
        title: item.title,
        status,
        progressPercent: pct,
        progressLabel: progressLabelFor(item),
        lastActivityAt: item.lastActivityAt || item.updatedAt || item.createdAt,
        platform: item.meta?.platform || null,
        cover: item.cover || null
      };
    });
  }

  async function applyQuickProgress(itemId) {

    if (!itemId) {
      return { ok: false };
    }

    let item = null;

    if (_isHttp()) {
      item = await getLibraryItemById(itemId);
    } else {
      const state = _safeState();
      item = (state.library || []).find(i => String(i.id) === String(itemId));
    }

    if (!item) {
      return { ok: false, reason: "item_not_found" };
    }

    const prevProgress = Number(item.progress || 0);
    let nextProgress = prevProgress;
    let meta = { ...(item.meta || {}) };

    switch (item.type) {

      case "serie":
        nextProgress = Math.min(100, prevProgress + 5);
        break;

      case "pelicula":
        nextProgress = Math.min(100, prevProgress + 10);
        break;

      case "book":

        const total = Number(meta.totalPages || 0);
        const prevPages = Number(meta.pagesRead || 0);

        if (total > 0) {
          const nextPages = Math.min(total, prevPages + 20);
          meta.pagesRead = nextPages;
          nextProgress = Math.round((nextPages / total) * 100);
        } else {
          nextProgress = Math.min(100, prevProgress + 5);
        }

        break;

      case "game":
        nextProgress = Math.min(100, prevProgress + 5);
        break;

      default:
        nextProgress = Math.min(100, prevProgress + 5);
    }

    const updatedItem = {
      ...item,
      progress: nextProgress,
      meta,
      updatedAt: new Date().toISOString()
    };

    if (_isHttp()) {
      await updateLibraryItem(updatedItem, { logActivity: true });
    } else {
      const state = _safeState();
      const idx = state.library.findIndex(i => String(i.id) === String(itemId));
      if (idx !== -1) {
        state.library[idx] = updatedItem;
        FakeBackend.saveState(state);
      }
    }

    window.dispatchEvent(
      new CustomEvent("quacker:data-changed", {
        detail: {
          kind: "library",
          action: "quick_progress",
          itemId: String(itemId)
        }
      })
    );

    return {
      ok: true,
      itemId: String(itemId),
      prevProgress,
      nextProgress
    };

  }

  return {
    login,
    register,
    logout,
    // transport (local/http)
    setTransport,
    setBaseUrl,
    getTransportInfo,
    getCurrentSession,
    // perfil
    getUser,
    updateUser,
    getUserPreferences,
    setUserTheme,
    setUserLanguage,
    // explorar
    getExploreFeed,
    getExploreDismissed,
    dismissExploreItem,
    clearExploreDismissed,
    getListsCountByLibraryMatch,
    getExploreUIState,
    setExploreUIState,
    getListsCountMapByLibraryKey,
    getLibraryUIState,
    setLibraryUIState,
    // listas
    getLists,
    getListsContainingItem,
    createList,
    updateList,
    deleteList,
    addLibraryItemToList,
    removeLibraryItemFromList,
    setLists,
    getRecentActivitiesDetailed,
    // libreria
    createLibraryItem,
    getLibrary,
    getLibraryItemById,
    updateLibraryItem,
    deleteLibraryItem,
    restoreLibraryItem,
    // dashboard
    getHomeStats,
    getLastActivityDetailed,
    getMonthlyChallenge,
    getSuggestions,
    getContinueWatchingItems,
    getBacklogItems,

    // notificaciones
    getNotifications,
    dismissNotification,
    clearNotifications,
    setNotifications,
    addNotification,
    
    // acciones 
    completeLibraryItem,
    resumeLibraryItem,
    progressLibraryItem,
    applyQuickProgress,
    undoActivitiesForItemSince,
    maybeNotifyStreak
  };
})();
