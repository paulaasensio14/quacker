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
    baseUrl: "/api",
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

  const LIBRARY_CACHE_TTL_MS = 30 * 1000;
  const LISTS_CACHE_TTL_MS = 30 * 1000;

  let _libraryCache = {
    transport: "",
    timestamp: 0,
    items: null
  };

  let _listsCache = {
    transport: "",
    timestamp: 0,
    items: null
  };

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

  function _makeApiError(errorCode, status = 400, body = null) {
    const err = new Error(errorCode);
    err.status = status;
    err.error = errorCode;
    err.body = body || { error: errorCode };
    return err;
  }

  function _cloneData(value) {
    if (value == null || typeof value !== "object") return value;

    if (typeof structuredClone === "function") {
      try {
        return structuredClone(value);
      } catch (_) {}
    }

    try {
      return JSON.parse(JSON.stringify(value));
    } catch (_) {
      if (Array.isArray(value)) return value.map((entry) => _cloneData(entry));
      return { ...value };
    }
  }

  function _cloneCollection(items) {
    return (Array.isArray(items) ? items : []).map((item) => _cloneData(item));
  }

  function _extractLibraryMutationItem(response, fallbackReason = "invalid_library_response", expectedId = "") {
    const item = response?.item && typeof response.item === "object"
      ? response.item
      : response;
    const itemId = item?.id != null ? String(item.id).trim() : "";
    const safeExpectedId = expectedId != null ? String(expectedId).trim() : "";

    if (!item || typeof item !== "object" || !itemId) {
      throw _makeApiError(fallbackReason, 502);
    }

    if (safeExpectedId && itemId !== safeExpectedId) {
      throw _makeApiError(fallbackReason, 502);
    }

    return _cloneData({
      ...item,
      id: itemId
    });
  }

  function _normalizeContentText(value) {
    return String(value || "").replace(/\s+/g, " ").trim();
  }

  function _normalizeCanonicalIdentity(source, externalId) {
    const safeSource = String(source || "").trim().toLowerCase();
    const safeExternalId = String(externalId || "").trim();

    if (!safeSource || !safeExternalId) {
      return {
        source: "",
        externalId: ""
      };
    }

    return {
      source: safeSource,
      externalId: safeExternalId
    };
  }

  function _hasCanonicalIdentity(item) {
    return Boolean(
      String(item?.source || "").trim() &&
      String(item?.externalId || "").trim()
    );
  }

  function _isSameLibraryIdentity(a, b) {
    const aHasCanonical = _hasCanonicalIdentity(a);
    const bHasCanonical = _hasCanonicalIdentity(b);

    if (aHasCanonical && bHasCanonical) {
      return (
        String(a.source).trim().toLowerCase() === String(b.source).trim().toLowerCase() &&
        String(a.externalId).trim() === String(b.externalId).trim()
      );
    }

    const aTitle = _normalizeContentText(a?.title).toLocaleLowerCase("es");
    const bTitle = _normalizeContentText(b?.title).toLocaleLowerCase("es");
    const aType = String(a?.type || "").trim();
    const bType = String(b?.type || "").trim();

    return aTitle === bTitle && aType === bType;
  }

  function _sanitizeLibraryMeta(meta) {
    const allowedMetaKeys = new Set([
      "totalEpisodes",
      "totalSeasons",
      "totalPages",
      "totalChapters",
      "platform",
      "author",
      "season",
      "episode",
      "pagesRead",
      "seasonBreakdown"
    ]);

    const sanitizedMeta = {};

    if (!meta || typeof meta !== "object" || Array.isArray(meta)) {
      return sanitizedMeta;
    }

    for (const key of Object.keys(meta)) {
      if (allowedMetaKeys.has(key)) {
        sanitizedMeta[key] = meta[key];
      }
    }

    return sanitizedMeta;
  }

  function _invalidateLibraryCache() {
    _libraryCache = {
      transport: "",
      timestamp: 0,
      items: null
    };
  }

  function _invalidateListsCache() {
    _listsCache = {
      transport: "",
      timestamp: 0,
      items: null
    };
  }

  function _getLibraryCacheSnapshot() {
    const now = Date.now();
    const isFresh =
      _libraryCache.transport === __cfg.transport &&
      Array.isArray(_libraryCache.items) &&
      now - _libraryCache.timestamp < LIBRARY_CACHE_TTL_MS;

    if (!isFresh) return null;

    return _cloneCollection(_libraryCache.items);
  }

  function _getListsCacheSnapshot() {
    const now = Date.now();
    const isFresh =
      _listsCache.transport === __cfg.transport &&
      Array.isArray(_listsCache.items) &&
      now - _listsCache.timestamp < LISTS_CACHE_TTL_MS;

    if (!isFresh) return null;

    return _cloneCollection(_listsCache.items);
  }

  function _setLibraryCache(items) {
    _libraryCache = {
      transport: __cfg.transport,
      timestamp: Date.now(),
      items: _cloneCollection(items)
    };
  }

  function _normalizeListRecord(list) {
    if (!list || typeof list !== "object") return null;

    const items = Array.isArray(list.items) ? list.items.slice() : [];
    const safeVisibility = String(list.visibility || "").trim().toLowerCase();

    return {
      ...list,
      id: list.id != null ? String(list.id) : "",
      name: String(list.name || "").trim(),
      description: String(list.description || "").trim(),
      visibility: ["private", "public", "collab"].includes(safeVisibility)
        ? safeVisibility
        : "private",
      items,
      itemsCount: items.length,
      createdAt: String(list.createdAt || ""),
      updatedAt: String(list.updatedAt || "")
    };
  }

  function _normalizeListCollection(items) {
    return (Array.isArray(items) ? items : [])
      .map((entry) => _normalizeListRecord(entry))
      .filter(Boolean);
  }

  function _sanitizeListsForSetAll(nextLists = []) {
    if (!Array.isArray(nextLists)) {
      throw _makeApiError("invalid_lists_payload", 400);
    }

    const nowIso = new Date().toISOString();

    return nextLists.map((list, index) => {
      const items = Array.isArray(list?.items) ? list.items : [];
      const safeVisibility = String(list?.visibility || "").trim().toLowerCase();
      const safeItems = items
        .map((entry) => {
          const rawId = typeof entry === "string" ? entry : entry?.id;
          if (!rawId) return null;

          return {
            id: String(rawId),
            addedAt: entry?.addedAt || nowIso
          };
        })
        .filter(Boolean);

      return {
        id: list?.id ? String(list.id) : `local_list_${Date.now()}_${index}`,
        name: _normalizeContentText(list?.name) || "Sin nombre",
        description: String(list?.description || "").trim(),
        visibility: ["private", "public", "collab"].includes(safeVisibility)
          ? safeVisibility
          : "private",
        items: safeItems,
        itemsCount: safeItems.length,
        createdAt: list?.createdAt || nowIso,
        updatedAt: nowIso
      };
    });
  }

  function _normalizeListNameOrThrow(value) {
    const name = _normalizeContentText(value);

    if (!name) {
      throw _makeApiError("missing_name", 400);
    }

    if (name.length < 2) {
      throw _makeApiError("name_too_short", 400);
    }

    if (name.length > 80) {
      throw _makeApiError("name_too_long", 400);
    }

    return name;
  }

  function _normalizeListVisibilityOrThrow(value = "private") {
    const visibility = String(value || "private").trim().toLowerCase();

    if (!["private", "public", "collab"].includes(visibility)) {
      throw _makeApiError("invalid_visibility", 400);
    }

    return visibility;
  }

  function _buildListMutationResult(action, payload = {}) {
    const list =
      payload?.list && typeof payload.list === "object"
        ? _normalizeListRecord(payload.list)
        : null;

    const result = {
      ok: payload?.ok !== false,
      action: String(action || "").trim(),
      listId: String(payload?.listId || list?.id || "").trim(),
      itemId: String(payload?.itemId || "").trim()
    };

    if (Object.prototype.hasOwnProperty.call(payload, "already")) {
      result.already = Boolean(payload.already);
    }

    if (Object.prototype.hasOwnProperty.call(payload, "deleted")) {
      const deleted = Number(payload.deleted);
      result.deleted = Number.isFinite(deleted) ? Math.max(0, deleted) : 0;
    }

    if (Object.prototype.hasOwnProperty.call(payload, "removed")) {
      const removed = Number(payload.removed);
      result.removed = Number.isFinite(removed) ? Math.max(0, removed) : 0;
    }

    if (list) {
      result.list = list;
    }

    return result;
  }

  function _buildListMutationList(action, list) {
    const normalized = _normalizeListRecord(list);
    if (!normalized) return null;

    return {
      ...normalized,
      ok: true,
      action: String(action || "").trim(),
      listId: String(normalized.id || "").trim()
    };
  }

  function _setListsCache(items) {
    _listsCache = {
      transport: __cfg.transport,
      timestamp: Date.now(),
      items: _cloneCollection(_normalizeListCollection(items))
    };
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

  function _getDefaultLibraryStatus(type) {
    return type === "book"
      ? "reading"
      : type === "game"
        ? "playing"
        : type === "serie"
          ? "watching"
          : "watching";
  }

  function _normalizeLibraryStatus(status, type, progress, fallbackStatus = "") {
    const safeStatus = String(status || "").trim().toLowerCase();
    const safeType = String(type || "").trim().toLowerCase();
    const safeProgress = Number.isFinite(Number(progress))
      ? Math.max(0, Math.min(100, Number(progress)))
      : 0;
    const defaultStatus = _getDefaultLibraryStatus(safeType);

    if (safeProgress >= 100) {
      return "completed";
    }

    if (!safeStatus) {
      return String(fallbackStatus || defaultStatus).trim() || defaultStatus;
    }

    if (safeProgress <= 0) {
      if (safeStatus === "pending" || safeStatus === "not_started") {
        return "not_started";
      }

      if (safeStatus === "completed") {
        return "not_started";
      }

      if (safeStatus === "in_progress") {
        return defaultStatus;
      }

      if (safeStatus === "watching" || safeStatus === "reading" || safeStatus === "playing") {
        return safeStatus;
      }

      return String(fallbackStatus || defaultStatus).trim() || defaultStatus;
    }

    if (safeStatus === "pending" || safeStatus === "not_started") {
      return defaultStatus;
    }

    if (safeStatus === "in_progress") {
      return defaultStatus;
    }

    if (safeStatus === "watching" || safeStatus === "reading" || safeStatus === "playing") {
      return safeStatus;
    }

    if (safeStatus === "completed") {
      return defaultStatus;
    }

    return String(fallbackStatus || defaultStatus).trim() || defaultStatus;
  }

  function _emitDataChanged(detail = {}) {
    try {
      if (detail?.kind === "library") {
        _invalidateLibraryCache();
      }

      if (detail?.kind === "lists") {
        _invalidateListsCache();
      }

      document.dispatchEvent(new CustomEvent("quacker:data-changed", { detail }));
    } catch (_) {
      // defensivo: si CustomEvent falla por algún motivo, no rompemos la app
    }
  }

  function _emitItemStateChanged({
    action,
    itemId = "",
    listId = "",
    sourceView = "api-client",
    extra = {}
  } = {}) {
    _emitDataChanged({
      kind: "item_state",
      action: String(action || "").trim(),
      itemId: itemId ? String(itemId) : "",
      listId: listId ? String(listId) : "",
      sourceView: String(sourceView || "api-client"),
      ...extra
    });
  }

  async function _getItemListRelationshipState(itemId) {
    const normalizedItemId = String(itemId || "").trim();
    if (!normalizedItemId) {
      return {
        inAnyList: false,
        listsCount: 0
      };
    }

    try {
      const containingLists = await getListsContainingItem(normalizedItemId);
      const listsCount = Array.isArray(containingLists) ? containingLists.length : 0;

      return {
        inAnyList: listsCount > 0,
        listsCount
      };
    } catch (error) {
      console.error("[ApiClient] failed to compute item list relationship state", error);

      return {
        inAnyList: false,
        listsCount: 0
      };
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

  async function getExploreFeed(options = "") {
    if (_isHttp()) {
      const opts = typeof options === "string" ? { query: options } : (options && typeof options === "object" ? options : {});
      const query = String(opts.query || "").trim();
      const type = String(opts.type || "").trim();
      const sort = String(opts.sort || "").trim();
      const limit = Number.isFinite(Number(opts.limit)) && Number(opts.limit) > 0 ? String(Number(opts.limit)) : "";
      const params = new URLSearchParams();
      if (query) params.set("q", query);
      if (type) params.set("type", type);
      if (sort) params.set("sort", sort);
      if (limit) params.set("limit", limit);
      const suffix = params.toString() ? `?${params.toString()}` : "";
      const res = await _httpJson("GET", `/explore${suffix}`);
      if (Array.isArray(res)) return res;
      if (Array.isArray(res?.items)) return res.items;
      return [];
    }

    const opts = typeof options === "string" ? { query: options } : (options && typeof options === "object" ? options : {});
    const query = String(opts.query || "").trim().toLowerCase();
    const type = String(opts.type || "").trim();
    const limit = Number.isFinite(Number(opts.limit)) && Number(opts.limit) > 0 ? Number(opts.limit) : 0;

    const state = _safeState();
    const library = Array.isArray(state.library) ? state.library : [];

    let items = library.map((item) => ({
      eid: item?.id ? `library:${String(item.id)}` : String(Date.now()),
      source: "library",
      externalId: item?.id ? String(item.id) : "",
      type: String(item?.type || "").trim(),
      title: String(item?.title || "").trim(),
      year: item?.meta?.year || null,
      cover: String(item?.cover || "").trim(),
      description: "",
      meta: item?.meta || {}
    }));

    if (type) {
      items = items.filter((item) => item.type === type);
    }

    if (query) {
      items = items.filter((item) =>
        String(item.title || "").toLowerCase().includes(query)
      );
    }

    if (limit > 0) {
      items = items.slice(0, limit);
    }

    return items;
  }

  async function getWeeklyFeaturedExploreFeed() {
    if (!_isHttp()) return [];

    const now = Date.now();
    const cacheAge = now - _weeklyFeaturedCache.timestamp;

    if (
      Array.isArray(_weeklyFeaturedCache.items) &&
      _weeklyFeaturedCache.items.length > 0 &&
      cacheAge < WEEKLY_FEATURED_CACHE_TTL_MS
    ) {
      return _weeklyFeaturedCache.items.slice();
    }

    const FEATURED_REQUESTS = [
      { type: "serie", limit: 5 },
      { type: "pelicula", limit: 5 },
      { type: "game", limit: 3 }
    ];

    const results = [];

    for (const { type, limit } of FEATURED_REQUESTS) {
      try {
        const items = await getExploreFeed({ type, sort: "weekly", limit });
        results.push(Array.isArray(items) ? items : []);
      } catch (e) {
        console.warn(`[ApiClient] weekly featured failed for ${type}`, e);
        results.push([]);
      }

      await new Promise((r) => setTimeout(r, 200));
    }

    const mergedItems = results.flat();

    if (mergedItems.length > 0) {
      _weeklyFeaturedCache = {
        timestamp: Date.now(),
        items: mergedItems.slice()
      };
    }

    return mergedItems;
  }

  const WEEKLY_FEATURED_CACHE_TTL_MS = 3 * 60 * 1000;
  let _weeklyFeaturedCache = {
    timestamp: 0,
    items: []
  };

  async function getExploreItemDetail({ source, type, externalId }) {
    if (!_isHttp()) return null;
    if (!source || !type || !externalId) return null;

    return _httpJson(
      "GET",
      `/explore/item/${encodeURIComponent(source)}/${encodeURIComponent(type)}/${encodeURIComponent(externalId)}`
    );
  }

  // === listas (por ahora simplemente devuelven lo del estado) ===
  async function getLists() {
    const cachedItems = _getListsCacheSnapshot();
    if (cachedItems) {
      return cachedItems;
    }

    if (_isHttp()) {
      try {
        const res = await _httpJson("GET", "/lists");
        const items = Array.isArray(res)
          ? res
          : (res && Array.isArray(res.items) ? res.items : []);
        const normalizedItems = _normalizeListCollection(items);

        _setListsCache(normalizedItems);
        return _cloneCollection(normalizedItems);
      } catch (error) {
        console.error("[ApiClient] getLists failed", error);

        const fallbackItems = Array.isArray(_listsCache.items)
          ? _cloneCollection(_listsCache.items)
          : [];

        return fallbackItems;
      }
    }

    const state = _safeState();
    const items = _normalizeListCollection(state.lists || []);
    _setListsCache(items);
    return _cloneCollection(items);
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

  // Explore: contar listas por identidad canónica cuando exista.
  // title+type queda como compatibilidad para items legacy.
  async function getListsCountByLibraryMatch({ title, type, source = "", externalId = "" } = {}) {
    if ((!title || !type) && (!source || !externalId)) return 0;

    const lists = await getLists();
    const library = await getLibrary();

    const libId =
      window.ItemIdentity?.resolveLibraryItemIdFromCache?.(
        { title, type, source, externalId },
        library || []
      ) || "";

    if (!libId) return 0;

    let count = 0;

    for (const list of lists || []) {
      const arr = Array.isArray(list?.items) ? list.items : [];
      const has = arr.some((entry) => {
        const id = typeof entry === "string" ? entry : entry?.id;
        return String(id) === libId;
      });

      if (has) count++;
    }

    return count;
  }

  // Devuelve un mapa de conteos por identidad:
  // - canonical key "source::externalId" cuando exista
  // - legacy key "type::title" como fallback/compatibilidad
  async function getListsCountMapByLibraryKey() {
    const lists = await getLists();
    const library = await getLibrary();

    const idToKeys = new Map();

    for (const item of library || []) {
      if (!item?.id) continue;

      const keys = new Set();
      const canonicalKey = window.ItemIdentity?.getCanonicalContentKey?.(item) || "";
      const normalizedKey = window.ItemIdentity?.getNormalizedContentKey?.(item) || "";

      if (canonicalKey) keys.add(canonicalKey);
      if (normalizedKey) keys.add(normalizedKey);

      if (keys.size > 0) {
        idToKeys.set(String(item.id), [...keys]);
      }
    }

    const counts = Object.create(null);

    for (const list of lists || []) {
      const items = Array.isArray(list?.items) ? list.items : [];

      for (const entry of items) {
        const id = typeof entry === "string" ? entry : entry?.id;
        if (!id) continue;

        const keys = idToKeys.get(String(id));
        if (!Array.isArray(keys) || keys.length === 0) continue;

        for (const key of keys) {
          counts[key] = (counts[key] || 0) + 1;
        }
      }
    }

    return counts;
  }

  async function createList(listData) {
    const name = _normalizeListNameOrThrow(listData?.name);
    const description = String(listData?.description || "").trim();
    const visibility = _normalizeListVisibilityOrThrow(listData?.visibility || "private");

    if (_isHttp()) {
      const res = await _httpJson("POST", "/lists", {
        name,
        description,
        visibility
      });
      const created = _buildListMutationList("create", res);

      _emitDataChanged({
        kind: "lists",
        action: "create",
        listId: String(created?.id || "")
      });

      return created;
    }

    const state = _safeState();
    state.lists = state.lists || [];
    const nowIso = new Date().toISOString();

    const newList = _normalizeListRecord({
      id: String(Date.now()),
      name,
      description,
      visibility,
      items: [],
      createdAt: nowIso,
      updatedAt: nowIso
    });

    state.lists.push(newList);

    if (typeof FakeBackend !== "undefined") {
      FakeBackend.saveState(state);
    }

    _emitDataChanged({
      kind: "lists",
      action: "create",
      listId: String(newList.id)
    });

    return _buildListMutationList("create", newList);
  }

  async function updateList(listId, patch = {}) {
    if (!listId) {
      throw _makeApiError("not_found", 404);
    }

    const safePatch = {};

    if (Object.prototype.hasOwnProperty.call(patch, "name")) {
      safePatch.name = _normalizeListNameOrThrow(patch.name);
    }

    if (Object.prototype.hasOwnProperty.call(patch, "description")) {
      safePatch.description = String(patch.description || "").trim();
    }

    if (Object.prototype.hasOwnProperty.call(patch, "visibility")) {
      safePatch.visibility = _normalizeListVisibilityOrThrow(patch.visibility);
    }

    if (_isHttp()) {
      const res = await _httpJson(
        "PATCH",
        `/lists/${encodeURIComponent(listId)}`,
        safePatch
      );
      const updated = _buildListMutationList("update", res);

      _emitDataChanged({
        kind: "lists",
        action: "update",
        listId: String(listId)
      });

      return updated;
    }

    const state = _safeState();
    state.lists = state.lists || [];
    const lists = state.lists;

    const idx = lists.findIndex(l => String(l.id) === String(listId));
    if (idx === -1) {
      throw _makeApiError("not_found", 404);
    }

    const prev = lists[idx];
    const next = _normalizeListRecord({
      ...prev,
      ...safePatch,
      updatedAt: new Date().toISOString()
    });
    lists[idx] = next;

    if (typeof FakeBackend !== "undefined") {
      FakeBackend.saveState(state);
    }

    _emitDataChanged({
      kind: "lists",
      action: "update",
      listId: String(listId)
    });

    return _buildListMutationList("update", next);
  }

  async function deleteList(listId) {
    if (!listId) {
      throw _makeApiError("not_found", 404);
    }

    if (_isHttp()) {
      const res = await _httpJson(
        "DELETE",
        `/lists/${encodeURIComponent(listId)}`
      );
      const result = _buildListMutationResult("delete", {
        ...res,
        listId: String(listId)
      });

      if (Number(result.deleted || 0) <= 0) {
        throw _makeApiError("invalid_delete_response", 502);
      }

      _emitDataChanged({
        kind: "lists",
        action: "delete",
        listId: String(listId)
      });

      return result;
    }

    const state = _safeState();
    const before = (state.lists || []).length;

    state.lists = (state.lists || []).filter(
      l => String(l.id) !== String(listId)
    );

    const deleted = before - state.lists.length;
    if (deleted <= 0) {
      throw _makeApiError("not_found", 404);
    }

    if (typeof FakeBackend !== "undefined") {
      FakeBackend.saveState(state);
    }

    _emitDataChanged({
      kind: "lists",
      action: "delete",
      listId: String(listId)
    });

    return _buildListMutationResult("delete", {
      ok: true,
      listId: String(listId),
      deleted
    });
  }

  // === listas: añadir / quitar items ===
  async function addLibraryItemToList(listId, itemId) {
    const safeListId = String(listId || "").trim();
    const safeItemId = String(itemId || "").trim();

    if (!safeListId) {
      throw _makeApiError("list_not_found", 404);
    }

    if (!safeItemId) {
      throw _makeApiError("missing_item_id", 400);
    }

    if (_isHttp()) {
      const res = await _httpJson(
        "POST",
        `/lists/${encodeURIComponent(safeListId)}/items`,
        { itemId: safeItemId }
      );

      _emitDataChanged({
        kind: "lists",
        action: "add_item",
        listId: safeListId,
        itemId: safeItemId
      });

      const relationshipState = await _getItemListRelationshipState(safeItemId);

      _emitItemStateChanged({
        action: "list_item_added",
        itemId: safeItemId,
        listId: safeListId,
        extra: relationshipState
      });

      return _buildListMutationResult("add_item", {
        ...res,
        listId: safeListId,
        itemId: String(res?.itemId || safeItemId)
      });
    }

    ensureListsSeeded();

    const state = _safeState();
    state.lists = state.lists || [];
    const list = state.lists.find(l => String(l.id) === safeListId);
    if (!list) {
      throw _makeApiError("list_not_found", 404);
    }

    const library = _isHttp() ? await getLibrary() : (state.library || []);
    const itemExists = library.some(i => String(i.id) === safeItemId);
    if (!itemExists) {
      throw _makeApiError("item_not_found", 404);
    }

    list.items = Array.isArray(list.items) ? list.items : [];

    const already = list.items.some(x => {
      const id = (typeof x === "string") ? x : x?.id;
      return String(id) === safeItemId;
    });

    if (already) {
      return _buildListMutationResult("add_item", {
        ok: true,
        already: true,
        listId: safeListId,
        itemId: safeItemId,
        list
      });
    }

    list.items.push({
      id: safeItemId,
      addedAt: new Date().toISOString()
    });
    list.itemsCount = list.items.length;
    list.updatedAt = new Date().toISOString();

    if (typeof FakeBackend !== "undefined") {
      FakeBackend.saveState(state);
    }

    _emitDataChanged({
      kind: "lists",
      action: "add_item",
      listId: safeListId,
      itemId: safeItemId
    });

    const relationshipState = await _getItemListRelationshipState(safeItemId);

    _emitItemStateChanged({
      action: "list_item_added",
      itemId: safeItemId,
      listId: safeListId,
      extra: relationshipState
    });

    return _buildListMutationResult("add_item", {
      ok: true,
      listId: safeListId,
      itemId: safeItemId,
      list
    });
  }

  async function removeLibraryItemFromList(listId, itemId) {
    const safeListId = String(listId || "").trim();
    const safeItemId = String(itemId || "").trim();

    if (!safeListId) {
      throw _makeApiError("list_not_found", 404);
    }

    if (!safeItemId) {
      throw _makeApiError("missing_item_id", 400);
    }

    if (_isHttp()) {
      const res = await _httpJson(
        "DELETE",
        `/lists/${encodeURIComponent(safeListId)}/items/${encodeURIComponent(safeItemId)}`
      );
      const result = _buildListMutationResult("remove_item", {
        ...res,
        listId: safeListId,
        itemId: safeItemId
      });

      if (Number(result.removed || 0) <= 0) {
        throw _makeApiError("item_not_in_list", 404);
      }

      _emitDataChanged({
        kind: "lists",
        action: "remove_item",
        listId: safeListId,
        itemId: safeItemId
      });

      const relationshipState = await _getItemListRelationshipState(safeItemId);

      _emitItemStateChanged({
        action: "list_item_removed",
        itemId: safeItemId,
        listId: safeListId,
        extra: relationshipState
      });

      return result;
    }

    ensureListsSeeded();

    const state = _safeState();
    state.lists = state.lists || [];
    const list = state.lists.find(l => String(l.id) === safeListId);
    if (!list) {
      throw _makeApiError("list_not_found", 404);
    }

    list.items = Array.isArray(list.items) ? list.items : [];
    const before = list.items.length;

    list.items = list.items.filter(x => {
      const id = (typeof x === "string") ? x : x?.id;
      return String(id) !== safeItemId;
    });

    const removed = before - list.items.length;
    if (removed <= 0) {
      throw _makeApiError("item_not_in_list", 404);
    }

    list.itemsCount = list.items.length;
    list.updatedAt = new Date().toISOString();

    if (typeof FakeBackend !== "undefined") {
      FakeBackend.saveState(state);
    }

    _emitDataChanged({
      kind: "lists",
      action: "remove_item",
      listId: safeListId,
      itemId: safeItemId
    });

    const relationshipState = await _getItemListRelationshipState(safeItemId);

    _emitItemStateChanged({
      action: "list_item_removed",
      itemId: safeItemId,
      listId: safeListId,
      extra: relationshipState
    });

    return _buildListMutationResult("remove_item", {
      ok: true,
      listId: safeListId,
      itemId: safeItemId,
      removed,
      list
    });
  }

  async function setLists(nextLists = []) {
    const safeLists = _sanitizeListsForSetAll(nextLists);

    if (_isHttp()) {
      const res = await _httpJson("PUT", "/lists", {
        lists: safeLists
      });
      const lists = Array.isArray(res?.lists)
        ? _normalizeListCollection(res.lists)
        : null;

      if (!lists || lists.length !== safeLists.length) {
        throw _makeApiError("invalid_lists_response", 502);
      }

      _emitDataChanged({
        kind: "lists",
        action: "set_all"
      });

      return {
        ok: true,
        count: lists.length,
        lists
      };
    }

    const state = _safeState();
    state.lists = safeLists;

    if (typeof FakeBackend !== "undefined") {
      FakeBackend.saveState(state);
    }

    _emitDataChanged({
      kind: "lists",
      action: "set_all"
    });

    return { ok: true, count: state.lists.length, lists: _cloneCollection(state.lists) };
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
  async function getUserPreferences() {
    if (_isHttp()) {
      const user = await getUser();

      return {
        theme: user?.theme === "dark" ? "dark" : "light",
        language: user?.language === "en" ? "en" : "es"
      };
    }

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
    if (_isHttp()) {
      return {
        ok: true,
        skipped: true,
        reason: "http_not_supported",
        title: title || "Notificación",
        text,
        color,
        icon
      };
    }

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
    if (_isHttp()) {
      return { ok: true, notified: false, skipped: true, reason: "http_not_supported" };
    }

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

      if (item.type === "serie") {
        const meta = { ...(item.meta || {}) };

        const totalEpisodes = Math.max(0, Number(meta.totalEpisodes || 0));
        const totalSeasons = Math.max(1, Number(meta.totalSeasons || 1));
        const currentSeason = Math.max(1, Number(meta.season || 1));
        const currentEpisode = Math.max(1, Number(meta.episode || 1));

        const rawBreakdown = meta.seasonBreakdown;
        const seasonBreakdown = Array.isArray(rawBreakdown)
          ? rawBreakdown
          : (rawBreakdown && typeof rawBreakdown === "object")
            ? Object.entries(rawBreakdown)
                .map(([season, episodes]) => ({
                  seasonNumber: Number(season),
                  episodeCount: Number(episodes)
                }))
                .filter((x) => Number.isFinite(x.seasonNumber) && Number.isFinite(x.episodeCount))
                .sort((a, b) => a.seasonNumber - b.seasonNumber)
            : [];

        const getEpisodesInSeason = (seasonNumber) => {
          const hit = seasonBreakdown.find(
            (entry) => Number(entry?.seasonNumber) === Number(seasonNumber)
          );

          if (hit && Number(hit.episodeCount) > 0) return Number(hit.episodeCount);

          if (seasonBreakdown.length === 0 && totalEpisodes > 0) {
            return totalEpisodes;
          }

          if (totalSeasons === 1 && totalEpisodes > 0) return totalEpisodes;

          return 0;
        };

        let nextSeason = currentSeason;
        let nextEpisode = currentEpisode;
        let nextStatus = "watching";
        let justCompleted = false;

        const hasEpisodeMetadata = seasonBreakdown.length > 0 || totalEpisodes > 0;
        const currentSeasonEpisodes = getEpisodesInSeason(currentSeason);

        if (!hasEpisodeMetadata) {
          nextStatus = "watching";
        } else if (currentSeasonEpisodes > 0 && currentEpisode < currentSeasonEpisodes) {
          nextEpisode = currentEpisode + 1;
        } else if (currentSeason < totalSeasons && getEpisodesInSeason(currentSeason + 1) > 0) {
          nextSeason = currentSeason + 1;
          nextEpisode = 1;
        } else {
          justCompleted = true;
          nextStatus = "completed";
        }

        let completedEpisodes = 0;

        if (justCompleted) {
          completedEpisodes = totalEpisodes > 0 ? totalEpisodes : currentEpisode;
        } else if (hasEpisodeMetadata && totalEpisodes > 0) {
          for (let s = 1; s < nextSeason; s += 1) {
            completedEpisodes += getEpisodesInSeason(s);
          }
          completedEpisodes += nextEpisode;
        }

        const nextProgress =
        !hasEpisodeMetadata
        ? Math.max(1, Number(item.progress || 0))
        : totalEpisodes > 0
          ? Math.max(0, Math.min(100, Math.round((completedEpisodes / totalEpisodes) * 100)))
          : Number(item.progress || 0);

        const updated = {
          ...item,
          status: nextStatus,
          progress: justCompleted ? 100 : nextProgress,
          updatedAt: nowIso,
          lastActivityAt: nowIso,
          meta: {
            ...meta,
            season: justCompleted ? currentSeason : nextSeason,
            episode: justCompleted ? currentEpisode : nextEpisode
          }
        };

        await updateLibraryItem(updated, { logActivity: false });

        return {
          ok: true,
          daysSinceLast,
          itemId: item.id,
          title: item.title,
          justCompleted,
          deltaLabel: justCompleted
            ? "Serie completada"
            : `T${updated.meta.season} · E${updated.meta.episode}`
        };
      }

      let nextStatus = item.status;

      if (item.status === "not_started") {
        if (item.type === "book") nextStatus = "reading";
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

    if (item.type === "serie") {
      const meta = { ...(item.meta || {}) };

      const totalEpisodes = Math.max(0, Number(meta.totalEpisodes || 0));
      const totalSeasons = Math.max(1, Number(meta.totalSeasons || 1));
      const currentSeason = Math.max(1, Number(meta.season || 1));
      const currentEpisode = Math.max(1, Number(meta.episode || 1));

      const rawBreakdown = meta.seasonBreakdown;
      const seasonBreakdown = Array.isArray(rawBreakdown)
        ? rawBreakdown
        : (rawBreakdown && typeof rawBreakdown === "object")
          ? Object.entries(rawBreakdown)
              .map(([season, episodes]) => ({
                seasonNumber: Number(season),
                episodeCount: Number(episodes)
              }))
              .filter((x) => Number.isFinite(x.seasonNumber) && Number.isFinite(x.episodeCount))
              .sort((a, b) => a.seasonNumber - b.seasonNumber)
          : [];

      const getEpisodesInSeason = (seasonNumber) => {
        const hit = seasonBreakdown.find(
          (entry) => Number(entry?.seasonNumber) === Number(seasonNumber)
        );
        if (hit && Number(hit.episodeCount) > 0) return Number(hit.episodeCount);

        if (totalSeasons === 1 && totalEpisodes > 0) return totalEpisodes;
        return 0;
      };

      let nextSeason = currentSeason;
      let nextEpisode = currentEpisode;
      let nextStatus = "watching";

      const currentSeasonEpisodes = getEpisodesInSeason(currentSeason);

      if (currentSeasonEpisodes > 0 && currentEpisode < currentSeasonEpisodes) {
        nextEpisode = currentEpisode + 1;
      } else if (currentSeason < totalSeasons && getEpisodesInSeason(currentSeason + 1) > 0) {
        nextSeason = currentSeason + 1;
        nextEpisode = 1;
      } else {
        nextStatus = "completed";
      }

      let completedEpisodes = 0;

      if (nextStatus === "completed") {
        completedEpisodes = totalEpisodes > 0 ? totalEpisodes : currentEpisode;
      } else {
        for (let s = 1; s < nextSeason; s += 1) {
          completedEpisodes += getEpisodesInSeason(s);
        }
        completedEpisodes += nextEpisode;
      }

      item.status = nextStatus;
      item.progress =
        nextStatus === "completed"
          ? 100
          : (
              totalEpisodes > 0
                ? Math.max(0, Math.min(100, Math.round((completedEpisodes / totalEpisodes) * 100)))
                : Number(item.progress || 0)
            );

      item.meta = {
        ...meta,
        season: nextStatus === "completed" ? currentSeason : nextSeason,
        episode: nextStatus === "completed" ? currentEpisode : nextEpisode
      };

      item.updatedAt = nowIso;
      if ("lastActivityAt" in item) item.lastActivityAt = nowIso;
    } else {
      item.updatedAt = nowIso;
      if ("lastActivityAt" in item) item.lastActivityAt = nowIso;

      if (item.status === "not_started") {
        if (item.type === "book") item.status = "reading";
        else if (item.type === "game") item.status = "playing";
        else item.status = "in_progress";
      }
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
      const item = _extractLibraryMutationItem(res, "invalid_complete_response", targetId);

      _emitDataChanged({ kind: "library", action: "complete", itemId: targetId });
      return { ok: true, itemId: targetId, title: item.title || current.title };
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
    if (itemId == null) return { ok: false, reason: "missing_id" };

    const targetId = String(itemId);
    const current = await getLibraryItemById(targetId);
    if (!current) return { ok: false, reason: "not_found" };

    const prev = Math.max(0, Math.min(100, Number(current.progress ?? 0)));
    const safeDelta = Math.max(1, Math.min(100, Number(delta || 0)));
    const next = Math.min(100, Math.max(0, prev + safeDelta));
    const justCompleted = next >= 100 && prev < 100;

    const nextItem = {
      ...current,
      progress: next
    };

    if (current.type === "book") {
      const totalPages = Number(current.meta?.totalPages || 0);
      if (totalPages > 0) {
        nextItem.meta = {
          ...(current.meta || {}),
          pagesRead: Math.min(
            totalPages,
            Math.max(0, Math.round((next / 100) * totalPages))
          )
        };
      }
    }

    const updated = await updateLibraryItem(nextItem, { logActivity: true });
    if (!updated?.ok) {
      return updated || { ok: false, reason: "update_failed" };
    }

    let deltaLabel = `${Math.round(next)}%`;
    if (current.type === "book" && Number(nextItem.meta?.totalPages || 0) > 0) {
      deltaLabel = `${Number(nextItem.meta.pagesRead || 0)}/${Number(nextItem.meta.totalPages || 0)} páginas`;
    }

    return {
      ok: true,
      justCompleted,
      itemId: targetId,
      deltaLabel: justCompleted ? "Completado" : deltaLabel
    };
  }

  // === biblioteca ===
  async function getLibrary() {
    const cachedItems = _getLibraryCacheSnapshot();
    if (cachedItems) {
      return cachedItems;
    }

    if (_isHttp()) {
      try {
        // Backend real (por partes)
        const res = await _httpJson("GET", "/library");
        // Permitimos dos formatos: array directo o wrapper { items: [...] }
        const items = Array.isArray(res)
          ? res
          : (res && Array.isArray(res.items) ? res.items : []);

        _setLibraryCache(items);
        return _cloneCollection(items);
      } catch (error) {
        console.error("[ApiClient] getLibrary failed", error);

        const fallbackItems = Array.isArray(_libraryCache.items)
          ? _cloneCollection(_libraryCache.items)
          : [];

        return fallbackItems;
      }
    }

    // modo local (demo)
    const state = _safeState();
    const items = state.library || [];
    _setLibraryCache(items);
    return _cloneCollection(items);
  }

  async function getLibraryItemById(itemId) {
    if (itemId == null) return null;

    if (_isHttp()) {
      try {
        const res = await _httpJson("GET", `/library/${encodeURIComponent(String(itemId))}`);
        if (!res) return null;
        return _cloneData(res && res.item ? res.item : res);
      } catch (_) {
        return null;
      }
    }

    const state = _safeState();
    const library = state.library || [];
    const item = library.find(i => String(i.id) === String(itemId)) || null;
    return _cloneData(item);
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
      const item = _extractLibraryMutationItem(res, "invalid_update_response", itemId);

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
    const allowedPatchFields = new Set([
      "title",
      "type",
      "source",
      "externalId",
      "status",
      "progress",
      "meta",
      "cover"
    ]);
    const allowedTypes = new Set(["serie", "pelicula", "book", "game"]);
    const allowedStatuses = new Set([
      "pending",
      "not_started",
      "in_progress",
      "watching",
      "reading",
      "playing",
      "completed"
    ]);
    const patch = {};

    for (const key of Object.keys(updatedItem || {})) {
      if (allowedPatchFields.has(key)) {
        patch[key] = updatedItem[key];
      }
    }

    const next = {
      ...prev,
      ...patch,
      id: prev.id,
      createdAt: prev.createdAt,
      updatedAt: new Date().toISOString()
    };

    if (Object.prototype.hasOwnProperty.call(patch, "title")) {
      const title = _normalizeContentText(patch.title);

      if (!title) {
        throw _makeApiError("missing_title", 400);
      }

      if (title.length < 2) {
        throw _makeApiError("title_too_short", 400);
      }

      if (title.length > 120) {
        throw _makeApiError("title_too_long", 400);
      }

      next.title = title;
    }

    if (Object.prototype.hasOwnProperty.call(patch, "type")) {
      const type = String(patch.type || "").trim();

      if (!allowedTypes.has(type)) {
        throw _makeApiError("invalid_type", 400);
      }

      next.type = type;
    }

    if (
      Object.prototype.hasOwnProperty.call(patch, "source") ||
      Object.prototype.hasOwnProperty.call(patch, "externalId")
    ) {
      const canonicalIdentity = _normalizeCanonicalIdentity(
        Object.prototype.hasOwnProperty.call(patch, "source") ? patch.source : prev.source,
        Object.prototype.hasOwnProperty.call(patch, "externalId") ? patch.externalId : prev.externalId
      );

      next.source = canonicalIdentity.source;
      next.externalId = canonicalIdentity.externalId;
    } else {
      const canonicalIdentity = _normalizeCanonicalIdentity(prev.source, prev.externalId);
      next.source = canonicalIdentity.source;
      next.externalId = canonicalIdentity.externalId;
    }

    if (Object.prototype.hasOwnProperty.call(patch, "status")) {
      const status = String(patch.status || "").trim().toLowerCase();

      if (!allowedStatuses.has(status)) {
        throw _makeApiError("invalid_status", 400);
      }
    }

    const rawProgress = Object.prototype.hasOwnProperty.call(patch, "progress")
      ? Number(patch.progress)
      : Number(prev.progress ?? 0);
    const pct = Number.isFinite(rawProgress)
      ? Math.max(0, Math.min(100, rawProgress))
      : 0;
    next.progress = pct;

    next.status = _normalizeLibraryStatus(
      Object.prototype.hasOwnProperty.call(patch, "status") ? patch.status : prev.status,
      next.type,
      pct,
      prev.status
    );

    if (Object.prototype.hasOwnProperty.call(patch, "cover")) {
      next.cover = String(patch.cover || "").trim().slice(0, 500);
    }

    if (Object.prototype.hasOwnProperty.call(patch, "meta")) {
      if (patch.meta !== undefined && (typeof patch.meta !== "object" || Array.isArray(patch.meta))) {
        throw _makeApiError("invalid_meta", 400);
      }

      next.meta = patch.meta && typeof patch.meta === "object" && !Array.isArray(patch.meta)
        ? { ...(prev.meta || {}), ..._sanitizeLibraryMeta(patch.meta) }
        : { ...(prev.meta || {}) };
    } else {
      next.meta = { ...(prev.meta || {}) };
    }

    const duplicate = state.library.find((it) => {
      if (String(it?.id) === String(prev.id)) return false;

      return _isSameLibraryIdentity(it, {
        title: next.title,
        type: next.type,
        source: next.source,
        externalId: next.externalId
      });
    });

    if (duplicate) {
      throw _makeApiError("duplicate_item", 409);
    }

    if (next.progress >= 100) {
      next.progress = 100;
      next.status = "completed";
    }

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
      const res = await _httpJson("DELETE", `/library/${encodeURIComponent(idStr)}`);
      const deleted = Number(res?.deleted || 0);

      if (!Number.isFinite(deleted) || deleted <= 0) {
        throw _makeApiError("invalid_delete_response", 502);
      }

      _emitDataChanged({ kind: "library", action: "delete", itemId: idStr });

      return { ok: true, deleted };
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
      const item = _extractLibraryMutationItem(res, "invalid_create_response");

      _emitDataChanged({ kind: "library", action: "create", itemId: String(item.id) });
      return item;
    }

    const state = _safeState();
    state.library = state.library || [];

    const title = _normalizeContentText(data.title);
    const type = String(data.type || "pelicula").trim().toLowerCase();
    const canonicalIdentity = _normalizeCanonicalIdentity(
      data.source,
      data.externalId
    );
    const allowedTypes = new Set(["serie", "pelicula", "book", "game"]);
    const allowedStatuses = new Set([
      "pending",
      "not_started",
      "in_progress",
      "watching",
      "reading",
      "playing",
      "completed"
    ]);

    if (!title) {
      throw _makeApiError("missing_title", 400);
    }

    if (title.length < 2) {
      throw _makeApiError("title_too_short", 400);
    }

    if (title.length > 120) {
      throw _makeApiError("title_too_long", 400);
    }

    if (!allowedTypes.has(type)) {
      throw _makeApiError("invalid_type", 400);
    }

    if (
      Object.prototype.hasOwnProperty.call(data, "status") &&
      data.status != null &&
      String(data.status).trim() !== ""
    ) {
      const status = String(data.status || "").trim().toLowerCase();
      if (!allowedStatuses.has(status)) {
        throw _makeApiError("invalid_status", 400);
      }
    }

    const duplicate = state.library.find((it) =>
      _isSameLibraryIdentity(it, {
        title,
        type,
        source: canonicalIdentity.source,
        externalId: canonicalIdentity.externalId
      })
    );

    if (duplicate) {
      throw _makeApiError("duplicate_item", 409);
    }

    const rawProgress = Number(data.progress ?? 0);
    const safeProgress = Number.isFinite(rawProgress)
      ? Math.max(0, Math.min(100, rawProgress))
      : 0;

    const normalizedStatus = _normalizeLibraryStatus(
      data.status,
      type,
      safeProgress
    );
    const nowIso = new Date().toISOString();

    const newItem = {
      id: data.id != null ? String(data.id) : String(Date.now()),
      type,
      title,
      source: canonicalIdentity.source,
      externalId: canonicalIdentity.externalId,
      status: normalizedStatus,
      progress: safeProgress,
      meta: _sanitizeLibraryMeta(data.meta),
      cover: String(data.cover || "").trim().slice(0, 500),
      createdAt: String(data.createdAt || nowIso),
      updatedAt: String(data.updatedAt || nowIso)
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

    if (_isHttp()) {
      const library = await getLibrary();

      const filtered = (library || [])
        .map((item) => {
          const pct = Math.max(0, Math.min(100, Number(item?.progress ?? 0)));
          const type =
            pct >= 100 || item?.status === "completed"
              ? "completed"
              : pct > 0
                ? "progress"
                : null;

          if (!type) return null;

          return {
            id: item?.id ? `library:${String(item.id)}` : "",
            type,
            label: typeLabel(type),
            targetId: item?.id ? String(item.id) : "",
            itemTitle: item?.title || "Contenido",
            itemMeta: metaForItem(item),
            timeAgo: formatTimeAgo(item?.updatedAt || item?.createdAt || ""),
            createdAt: item?.updatedAt || item?.createdAt || ""
          };
        })
        .filter(Boolean)
        .filter((entry) => {
          if (filter === "all" || !filter) return true;
          return entry.type === filter;
        })
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        .slice(0, limit)
        .map(({ createdAt, ...entry }) => entry);

      return filtered;
    }

    const state = _safeState();
    const activities = Array.isArray(state.activities) ? state.activities : [];
    const library = Array.isArray(state.library) ? state.library : [];

    const filtered = activities
      .filter((a) => MEANINGFUL.has(a.type))
      .filter((a) => {
        if (filter === "all" || !filter) return true;
        return a.type === filter;
      })
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, limit)
      .map((act) => {
        const item = library.find((i) => i.id === act.targetId) || null;

        return {
          id: act.id || `${String(act.type || "activity")}:${String(act.targetId || "")}:${String(act.createdAt || "")}`,
          type: act.type,
          label: typeLabel(act.type),
          targetId: act.targetId || null,
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
    if (_isHttp()) {
      return [];
    }

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
    if (_isHttp()) {
      return [];
    }

    const state = _safeState();
    return state.notifications || [];
  }

  async function dismissNotification(notificationId) {
    if (_isHttp()) {
      return { ok: true, skipped: true, reason: "http_not_supported" };
    }

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
    if (_isHttp()) {
      return { ok: true, skipped: true, reason: "http_not_supported" };
    }

    const state = _safeState();
    state.notifications = [];

    if (typeof FakeBackend !== "undefined") {
      FakeBackend.saveState(state);
      _emitDataChanged({ kind: "notifications", action: "clear_all" });
    }

    return { ok: true };
  }

  async function setNotifications(nextList = []) {
    if (_isHttp()) {
      return { ok: true, skipped: true, reason: "http_not_supported", count: 0 };
    }

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

    const item = await getLibraryItemById(itemId);

    if (!item) {
      return { ok: false, reason: "item_not_found" };
    }

    const prevProgress = Number(item.progress || 0);
    let nextProgress = prevProgress;
    let meta = { ...(item.meta || {}) };
    let deltaLabel = "";

    switch (item.type) {

      case "serie":
        nextProgress = Math.min(100, prevProgress + 5);
        deltaLabel = `${Math.round(nextProgress)}%`;
        break;

      case "pelicula":
        nextProgress = Math.min(100, prevProgress + 10);
        deltaLabel = `${Math.round(nextProgress)}%`;
        break;

      case "book":

        const total = Number(meta.totalPages || 0);
        const prevPages = Number(meta.pagesRead || 0);

        if (total > 0) {
          const nextPages = Math.min(total, prevPages + 20);
          meta.pagesRead = nextPages;
          nextProgress = Math.round((nextPages / total) * 100);
          deltaLabel = `${nextPages}/${total} páginas`;
        } else {
          nextProgress = Math.min(100, prevProgress + 5);
          deltaLabel = `${Math.round(nextProgress)}%`;
        }

        break;

      case "game":
        nextProgress = Math.min(100, prevProgress + 5);
        deltaLabel = `${Math.round(nextProgress)}%`;
        break;

      default:
        nextProgress = Math.min(100, prevProgress + 5);
        deltaLabel = `${Math.round(nextProgress)}%`;
    }

    const justCompleted = prevProgress < 100 && nextProgress >= 100;

    const updatedItem = {
      ...item,
      progress: nextProgress,
      meta
    };

    const result = await updateLibraryItem(updatedItem, { logActivity: true });
    if (!result?.ok) {
      return result || { ok: false, reason: "update_failed" };
    }

    return {
      ok: true,
      itemId: String(itemId),
      prevProgress,
      nextProgress,
      justCompleted,
      deltaLabel: justCompleted ? "Completado" : deltaLabel
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
    getWeeklyFeaturedExploreFeed,
    dismissExploreItem,
    clearExploreDismissed,
    getListsCountByLibraryMatch,
    getExploreUIState,
    setExploreUIState,
    getExploreItemDetail,
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
