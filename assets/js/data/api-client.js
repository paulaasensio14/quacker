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

  async function _httpJson(method, path, body, options = {}) {
    const url = `${__cfg.baseUrl}${path.startsWith("/") ? path : `/${path}`}`;

    const ctrl = new AbortController();

const candidateSignal = options?.signal;

const externalSignal =
  candidateSignal &&
  typeof candidateSignal === "object" &&
  typeof candidateSignal.addEventListener === "function" &&
  typeof candidateSignal.removeEventListener === "function" &&
  typeof candidateSignal.aborted === "boolean"
    ? candidateSignal
    : null;

let abortedByExternal = false;

const abortFromExternal = () => {
  abortedByExternal = true;

  if (!ctrl.signal.aborted) {
    ctrl.abort();
  }
};

if (externalSignal?.aborted) {
  abortFromExternal();
} else if (externalSignal) {
  externalSignal.addEventListener(
    "abort",
    abortFromExternal,
    { once: true }
  );
}

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
        if (
          ctrl.signal.aborted ||
          e?.name === "AbortError"
        ) {
          throw e;
        }

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

      if (abortedByExternal) {
        const abortErr = new Error("aborted");
        abortErr.status = 0;
        abortErr.body = { error: "aborted" };
        abortErr.error = "aborted";
        throw abortErr;
      }

      if (
        ctrl.signal.aborted ||
        err?.name === "AbortError"
      ) {
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
      if (externalSignal) {
        externalSignal.removeEventListener(
         "abort",
         abortFromExternal
       );
     }

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

  function _getCurrentUiLang() {
    return window.I18n?.getLang?.() === "en" ? "en" : "es";
  }

  function _resolveMonthlyChallengeText(value, lang, fallback = "") {
    if (typeof value === "string") {
      return String(value).trim() || fallback;
    }

    if (value && typeof value === "object" && !Array.isArray(value)) {
      const localizedValue =
        value[lang] ??
        value.es ??
        value.en ??
        "";

      return String(localizedValue || "").trim() || fallback;
    }

    return fallback;
  }

  function _buildDefaultMonthlyChallenge(monthIndex = 0, lang = "es") {
    const monthNumber = Math.max(1, Math.min(12, Number(monthIndex) + 1));
    const target = monthNumber === 7 || monthNumber === 12 ? 3 : monthNumber === 1 || monthNumber === 4 || monthNumber === 8 ? 1 : 2;

    if (lang === "en") {
      return {
        id: `goal-${monthNumber}`,
        title: "Monthly challenge",
        description: `Complete ${target} ${target === 1 ? "item" : "items"} this month.`,
        target,
        rewardLabel: "Quacker monthly badge"
      };
    }

    return {
      id: `goal-${monthNumber}`,
      title: "Reto del mes",
      description: `Completa ${target} ${target === 1 ? "contenido" : "contenidos"} este mes.`,
      target,
      rewardLabel: "Insignia mensual de Quacker"
    };
  }

  function _getEditorialMonthlyChallenges() {
    return Array.isArray(window.QuackerMonthlyChallenges) ? window.QuackerMonthlyChallenges : [];
  }

  function _resolveMonthlyChallengeConfig(monthIndex = 0) {
    const lang = _getCurrentUiLang();
    const currentMonth = Math.max(1, Math.min(12, Number(monthIndex) + 1));
    const currentEntry = _getEditorialMonthlyChallenges().find((entry) => Number(entry?.month) === currentMonth);
    const fallback = _buildDefaultMonthlyChallenge(monthIndex, lang);

    if (!currentEntry || typeof currentEntry !== "object") {
      return fallback;
    }

    const targetNumber = Number(currentEntry.target ?? fallback.target);
    const safeTarget = Number.isFinite(targetNumber)
      ? Math.max(1, Math.min(6, Math.round(targetNumber)))
      : fallback.target;

    return {
      id: _normalizeDataId(currentEntry.id) || fallback.id,
      title: _resolveMonthlyChallengeText(currentEntry.title, lang, fallback.title),
      description: _resolveMonthlyChallengeText(currentEntry.description, lang, fallback.description),
      target: safeTarget,
      rewardLabel: _resolveMonthlyChallengeText(currentEntry.rewardLabel, lang, fallback.rewardLabel)
    };
  }

  function _extractLibraryMutationItem(response, fallbackReason = "invalid_library_response", expectedId = "") {
    const item = response?.item && typeof response.item === "object"
      ? response.item
      : response;
    const itemId = _normalizeDataId(item?.id);
    const safeExpectedId = _normalizeDataId(expectedId);

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

  function _normalizeDataId(value) {
    return String(value || "").trim();
  }

  function _normalizeNotificationId(value) {
    return _normalizeDataId(value);
  }

  function _normalizeActivityRecord(entry) {
    if (!entry || typeof entry !== "object") return null;

    const targetId = _normalizeDataId(entry.targetId);
    const rawType = String(entry.type || "").trim().toLowerCase();
    const type = rawType === "completed" ? "completed" : rawType === "progress" ? "progress" : "";
    const createdAtRaw = String(entry.createdAt || "").trim();
    const createdAtDate = createdAtRaw ? new Date(createdAtRaw) : null;
    const createdAt =
      createdAtDate && !Number.isNaN(createdAtDate.getTime())
        ? createdAtDate.toISOString()
        : "";

    if (!targetId || !type || !createdAt) return null;

    const rawPayload = entry?.payload && typeof entry.payload === "object"
      ? entry.payload
      : null;
    const payloadSeason = Math.max(0, Number(rawPayload?.season || 0) || 0);
    const payloadEpisode = Math.max(0, Number(rawPayload?.episode || 0) || 0);
    const payload =
      payloadSeason > 0 && payloadEpisode > 0
        ? { season: payloadSeason, episode: payloadEpisode }
        : null;

    return {
      ...entry,
      id: _normalizeDataId(entry.id) || `${type}:${targetId}:${createdAt}`,
      type,
      targetId,
      targetType: "library_item",
      minutes: Number.isFinite(Number(entry.minutes))
        ? Math.max(0, Number(entry.minutes))
        : 0,
      createdAt,
      payload
    };
  }

  async function _getHttpActivities({ limit = 0, filter = "all", itemId = "" } = {}) {
    if (!_isHttp()) return [];

    const params = new URLSearchParams();

    if (Number(limit) > 0) {
      params.set("limit", String(Math.max(1, Number(limit))));
    }

    if (filter && filter !== "all") {
      params.set("filter", String(filter).trim().toLowerCase());
    }

    const normalizedItemId = _normalizeDataId(itemId);
    if (normalizedItemId) {
      params.set("itemId", normalizedItemId);
    }

    try {
      const res = await _httpJson(
        "GET",
        `/activities${params.toString() ? `?${params.toString()}` : ""}`
      );

      const items = Array.isArray(res?.activities)
        ? res.activities
        : Array.isArray(res)
          ? res
          : [];

      return items
        .map((entry) => _normalizeActivityRecord(entry))
        .filter(Boolean);
    } catch (error) {
      if (error?.status === 404) {
        return [];
      }

      throw error;
    }
  }

  async function getLibraryItemActivities(itemId, { limit = 0, filter = "all" } = {}) {
    const normalizedItemId = _normalizeDataId(itemId);
    if (!normalizedItemId) return [];

    if (_isHttp()) {
      return _getHttpActivities({ limit, filter, itemId: normalizedItemId });
    }

    const state = _safeState();
    const activities = Array.isArray(state.activities) ? state.activities : [];

    return activities
      .map((entry) => _normalizeActivityRecord(entry))
      .filter(Boolean)
      .filter((entry) => entry.targetId === normalizedItemId)
      .filter((entry) => {
        if (filter === "all" || !filter) return true;
        return entry.type === filter;
      })
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, limit > 0 ? limit : undefined);
  }

  function _getDashboardActivityStatus(item) {
    const progress = Math.max(0, Math.min(100, Number(item?.progress ?? 0)));
    const status =
      progress >= 100 || item?.status === "completed"
        ? "completed"
        : progress <= 0
          ? "not_started"
          : "in_progress";

    return { progress, status };
  }

  function _buildSyntheticActivitiesFromLibrary(library) {
    return (Array.isArray(library) ? library : [])
      .map((item) => {
        const itemId = _normalizeDataId(item?.id);
        const activityState = _getDashboardActivityStatus(item);
        const type = activityState.status === "completed"
          ? "completed"
          : activityState.status === "in_progress"
            ? "progress"
            : "";
        const createdAt =
          String(item?.lastActivityAt || item?.updatedAt || item?.createdAt || "").trim();

        if (!itemId || !type || !createdAt) return null;

        return _normalizeActivityRecord({
          id: `library:${itemId}`,
          type,
          targetId: itemId,
          targetType: "library_item",
          minutes: 20,
          createdAt
        });
      })
      .filter(Boolean);
  }

  function _normalizeNotificationsList(items) {
    const seen = new Set();

    return (Array.isArray(items) ? items : [])
      .map((entry) => {
        if (!entry || typeof entry !== "object") return null;

        const notificationId = _normalizeNotificationId(entry.id);
        if (!notificationId) return null;

        return {
          ...entry,
          id: notificationId
        };
      })
      .filter((entry) => {
        if (!entry || seen.has(entry.id)) return false;
        seen.add(entry.id);
        return true;
      })
      .slice(0, 30);
  }

  const _allowedIdentityTypes = new Set([
    "pelicula",
    "serie",
    "game",
    "book"
  ]);

  const _allowedIdentityPairs = new Set([
    "tmdb::pelicula",
    "tmdb::serie",
    "rawg::game",
    "wikipedia_game::game",
    "open_library::book",
    "manual::pelicula",
    "manual::serie",
    "manual::game",
    "manual::book"
  ]);

  function _normalizeIdentitySource(value) {
    const source = String(value ?? "").trim().toLowerCase();

    return source === "openlibrary"
      ? "open_library"
      : source;
  }

  function _normalizeIdentityType(value) {
    const type = String(value ?? "").trim().toLowerCase();

    const aliases = {
      movie: "pelicula",
      film: "pelicula",
      tv: "serie",
      series: "serie",
      game: "game",
      book: "book"
    };

    return aliases[type] || type;
  }

  function _normalizePositiveIdentityId(value) {
    const raw = String(value ?? "").trim();

    if (!raw || !/^\d+$/.test(raw)) {
      return "";
    }

    const normalized = raw.replace(/^0+(?=\d)/, "");

    return normalized && normalized !== "0"
      ? normalized
      : "";
  }

  function _normalizeCanonicalIdentity(source, type, externalId) {
    const safeSource = _normalizeIdentitySource(source);
    const safeType = _normalizeIdentityType(type);
    const rawExternalId = String(externalId ?? "").trim();

    const invalid = (error) => ({
      source: safeSource,
      type: safeType,
      externalId: "",
      key: "",
      error
    });

    if (!safeSource) return invalid("missing_source");
    if (!safeType) return invalid("missing_type");

    if (!_allowedIdentityTypes.has(safeType)) {
      return invalid("invalid_type");
    }

    if (safeSource === "google_books") {
      return invalid("retired_source");
    }

    if (!_allowedIdentityPairs.has(`${safeSource}::${safeType}`)) {
      return invalid("invalid_source_type");
    }

    let safeExternalId = "";

    if (safeSource === "tmdb") {
      const prefixedMatch = rawExternalId.match(
        /^tmdb:(movie|film|tv|series|serie):(\d+)$/i
      );

      if (prefixedMatch) {
        const prefixedType = _normalizeIdentityType(prefixedMatch[1]);

        if (prefixedType !== safeType) {
          return invalid("identity_type_conflict");
        }

        safeExternalId = _normalizePositiveIdentityId(prefixedMatch[2]);
      } else {
        safeExternalId = _normalizePositiveIdentityId(rawExternalId);
      }
    } else if (safeSource === "rawg") {
      safeExternalId = _normalizePositiveIdentityId(
        rawExternalId.replace(/^rawg:/i, "")
      );
    } else if (safeSource === "wikipedia_game") {
      safeExternalId = _normalizePositiveIdentityId(
        rawExternalId.replace(/^wikipedia_game:/i, "")
      );
    } else if (safeSource === "open_library") {
      safeExternalId = rawExternalId
        .replace(/^https?:\/\/openlibrary\.org/i, "")
        .replace(/^\/books\//i, "")
        .toUpperCase();

      if (!/^OL[A-Z0-9]+M$/.test(safeExternalId)) {
        return invalid(
          safeExternalId
            ? "invalid_open_library_edition"
            : "missing_external_id"
        );
      }
    } else if (safeSource === "manual") {
      safeExternalId = rawExternalId.toLowerCase();

      const uuidPattern =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

      if (!uuidPattern.test(safeExternalId)) {
        return invalid(
          safeExternalId
            ? "invalid_manual_uuid"
            : "missing_external_id"
        );
      }
    }

    if (!safeExternalId) {
      return invalid(
        rawExternalId
          ? "invalid_external_id"
          : "missing_external_id"
      );
    }

    return {
      source: safeSource,
      type: safeType,
      externalId: safeExternalId,
      key: `${safeSource}::${safeType}::${safeExternalId}`,
      error: ""
    };
  }

  function _hasCanonicalIdentity(item) {
    const identity = _normalizeCanonicalIdentity(
      item?.source,
      item?.type,
      item?.externalId
    );

    return Boolean(
      identity.source &&
      identity.type &&
      identity.externalId
    );
  }

  function _isSameLibraryIdentity(a, b) {
    if (!_hasCanonicalIdentity(a) || !_hasCanonicalIdentity(b)) {
      return false;
    }

    const aIdentity = _normalizeCanonicalIdentity(
      a?.source,
      a?.type,
      a?.externalId
    );

    const bIdentity = _normalizeCanonicalIdentity(
      b?.source,
      b?.type,
      b?.externalId
    );

    return (
      aIdentity.source === bIdentity.source &&
      aIdentity.type === bIdentity.type &&
      aIdentity.externalId === bIdentity.externalId
    );
  }

  function _sanitizeLibraryMeta(meta) {
    const allowedMetaKeys = new Set([
      "totalEpisodes",
      "totalSeasons",
      "totalPages",
      "totalChapters",
      "year",
      "platform",
      "author",
      "season",
      "episode",
      "episodeSeenMap",
      "hoursPlayed",
      "pagesRead",
      "seasonBreakdown"
    ]);

    const sanitizedMeta = {};

    if (!meta || typeof meta !== "object" || Array.isArray(meta)) {
      return sanitizedMeta;
    }

    for (const key of Object.keys(meta)) {
      if (allowedMetaKeys.has(key)) {
        sanitizedMeta[key] = key === "episodeSeenMap"
          ? _sanitizeEpisodeSeenMap(meta[key])
          : meta[key];
      }
    }

    return sanitizedMeta;
  }

  function _sanitizeEpisodeSeenMap(value) {
    const safeMap = {};

    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return safeMap;
    }

    for (const [rawKey, rawIso] of Object.entries(value)) {
      const match = String(rawKey || "").trim().match(/^(\d+):(\d+)$/);
      if (!match) continue;

      const season = Math.max(0, Number(match[1] || 0) || 0);
      const episode = Math.max(0, Number(match[2] || 0) || 0);
      const iso = _safeText(rawIso).trim();
      const parsed = iso ? new Date(iso) : null;

      if (
        season <= 0 ||
        episode <= 0 ||
        !parsed ||
        Number.isNaN(parsed.getTime())
      ) {
        continue;
      }

      safeMap[`${season}:${episode}`] = parsed.toISOString();
    }

    return safeMap;
  }

  function _normalizeExploreDismissedIds(items) {
    const seen = new Set();

    return (Array.isArray(items) ? items : [])
      .map((entry) => String(entry || "").trim())
      .filter((entry) => {
        if (!entry || seen.has(entry)) return false;
        seen.add(entry);
        return true;
      })
      .slice(0, 500);
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

  function _getCachedLibraryItemById(itemId) {
    const safeItemId = _normalizeDataId(itemId);
    if (
      !safeItemId ||
      _libraryCache.transport !== __cfg.transport ||
      !Array.isArray(_libraryCache.items)
    ) {
      return null;
    }

    const item = _libraryCache.items.find((entry) => _normalizeDataId(entry?.id) === safeItemId) || null;
    return _cloneData(item);
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

  function _normalizeListItemEntry(entry) {
    const rawId = typeof entry === "string" ? entry : entry?.id;
    const itemId = _normalizeDataId(rawId);
    if (!itemId) return null;

    if (entry && typeof entry === "object" && !Array.isArray(entry)) {
      return {
        ...entry,
        id: itemId
      };
    }

    return itemId;
  }

  function _normalizeListRecord(list) {
    if (!list || typeof list !== "object") return null;

    const items = (Array.isArray(list.items) ? list.items : [])
      .map((entry) => _normalizeListItemEntry(entry))
      .filter(Boolean);
    const safeVisibility = String(list.visibility || "").trim().toLowerCase();
    const listId = _normalizeDataId(list.id);

    return {
      ...list,
      id: listId,
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
      const fallbackListId = _normalizeDataId(`local_list_${Date.now()}_${index}`);
      const safeItems = items
        .map((entry) => {
          const rawId = typeof entry === "string" ? entry : entry?.id;
          const itemId = _normalizeDataId(rawId);
          if (!itemId) return null;

          return {
            id: itemId,
            addedAt: entry?.addedAt || nowIso
          };
        })
        .filter(Boolean);

      return {
        id: _normalizeDataId(list?.id) || fallbackListId,
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
      listId: _normalizeDataId(payload?.listId || list?.id),
      itemId: _normalizeDataId(payload?.itemId)
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
      listId: _normalizeDataId(normalized.id)
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

    if (!safeStatus && safeProgress <= 0 && !fallbackStatus) {
      return "not_started";
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

  function _t(key, params = null, fallback = "") {
    try {
      const translate = window.I18n?.t;
      if (typeof translate === "function") {
        const translated = translate(key, params || undefined);
        if (typeof translated === "string" && translated) {
          if (translated !== key || !fallback) return translated;
        }
      }
    } catch (_) {
      // Si i18n no está lista, seguimos con el fallback.
    }

    return fallback || key;
  }

  function _completedLabelForType(type) {
    switch (String(type || "").trim()) {
      case "book":
        return _t("library_progress_book_completed", null, "Libro completado");
      case "serie":
        return _t("library_progress_series_completed", null, "Serie completada");
      case "game":
        return _t("library_progress_game_completed", null, "Juego completado");
      case "pelicula":
        return _t("library_progress_movie_completed", null, "Película completada");
      default:
        return _t("library_status_completed", null, "Completado");
    }
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
    const normalizedItemId = _normalizeDataId(itemId);
    const normalizedListId = _normalizeDataId(listId);

    _emitDataChanged({
      kind: "item_state",
      action: String(action || "").trim(),
      itemId: normalizedItemId,
      listId: normalizedListId,
      sourceView: String(sourceView || "api-client"),
      ...extra
    });
  }

  async function _getItemListRelationshipState(itemId) {
    const normalizedItemId = _normalizeDataId(itemId);
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

  async function register(email, password, name, language = "es") {
    const safeLanguage = language === "en" ? "en" : "es";

    if (_isHttp()) {
      const res = await _httpJson("POST", "/auth/register", {
        email,
        password,
        name,
        language: safeLanguage
      });
      return res;
    }

    // modo local (demo)
    console.log("ApiClient.register", email);
    return {
      userId: "demo-user",
      email,
      name,
      language: safeLanguage
    };
  }

  async function requestPasswordReset(email) {
    if (_isHttp()) {
      return _httpJson(
        "POST",
        "/auth/password-reset/request",
        {
          email
        }
      );
    }

    return {
      ok: true
    };
  }

  async function confirmPasswordReset(
    token,
    password
  ) {
    if (_isHttp()) {
      return _httpJson(
        "POST",
        "/auth/password-reset/confirm",
        {
          token,
          password
        }
      );
    }

    return {
      ok: true
    };
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
      const res = await _httpJson(
        "GET",
        `/explore${suffix}`,
        null,
        { signal: opts.signal }
      );

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

    let items = library.map((item, index) => {
      const libraryItemId = _normalizeDataId(item?.id);
      const fallbackEid = `library:${Date.now()}_${index}`;

      return {
        eid: libraryItemId ? `library:${libraryItemId}` : fallbackEid,
        source: "library",
        externalId: libraryItemId,
        type: String(item?.type || "").trim(),
        title: String(item?.title || "").trim(),
        year: item?.meta?.year || null,
        cover: String(item?.cover || "").trim(),
        description: "",
        meta: item?.meta || {}
      };
    });

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
      { type: "serie", limit: 4 },
      { type: "pelicula", limit: 4 },
      { type: "game", limit: 3 },
      { type: "book", limit: 3 }
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

  async function getExploreItemSeasonDetail({ source, type, externalId, seasonNumber }) {
    if (!_isHttp()) return null;
    if (!source || !type || !externalId || !seasonNumber) return null;

    return _httpJson(
      "GET",
      `/explore/item/${encodeURIComponent(source)}/${encodeURIComponent(type)}/${encodeURIComponent(externalId)}/season/${encodeURIComponent(seasonNumber)}`
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

        const fallbackItems =
          _listsCache.transport === __cfg.transport && Array.isArray(_listsCache.items)
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
    const target = _normalizeDataId(itemId);
    if (!target) return [];

    const lists = await getLists();

    return (lists || []).filter((l) => {
      const arr = Array.isArray(l.items) ? l.items : [];
      return arr.some((entry) => {
        const id = typeof entry === "string" ? entry : entry?.id;
        return _normalizeDataId(id) === target;
      });
    });
  }

  // Explore: contar listas por identidad canónica.
  async function getListsCountByLibraryMatch({
    source = "",
    type = "",
    externalId = ""
  }) {
    const canonical = _normalizeCanonicalIdentity(
      source,
      type,
      externalId
    );

    if (
      !canonical.source ||
      !canonical.type ||
      !canonical.externalId
    ) {
      return 0;
    }

    const lists = await getLists();
    const library = await getLibrary();

    const libItem = (library || []).find((item) => {
      const itemIdentity = _normalizeCanonicalIdentity(
        item?.source,
        item?.type,
        item?.externalId
      );

      return (
        itemIdentity.source === canonical.source &&
        itemIdentity.type === canonical.type &&
        itemIdentity.externalId === canonical.externalId
      );
    });

    if (!libItem?.id) return 0;

    const libId = _normalizeDataId(libItem.id);
    let count = 0;

    for (const list of lists || []) {
      const arr = Array.isArray(list?.items) ? list.items : [];

      const has = arr.some((entry) => {
        const id = typeof entry === "string" ? entry : entry?.id;
        return _normalizeDataId(id) === libId;
      });

      if (has) count++;
    }

    return count;
  }

  // Devuelve un mapa de conteos por identidad "source::type::externalId".
  async function getListsCountMapByLibraryKey() {
    const lists = await getLists();
    const library = await getLibrary();

    const idToKey = new Map();

    for (const item of library || []) {
      const itemId = _normalizeDataId(item?.id);
      if (!itemId) continue;

      const identity = _normalizeCanonicalIdentity(
        item?.source,
        item?.type,
        item?.externalId
      );

      if (
        !identity.source ||
        !identity.type ||
        !identity.externalId
      ) {
        continue;
      }

      idToKey.set(
        itemId,
        `${identity.source}::${identity.type}::${identity.externalId}`
      );
    }

    const counts = Object.create(null);

    for (const list of lists || []) {
      const items = Array.isArray(list?.items) ? list.items : [];

      for (const entry of items) {
        const id = typeof entry === "string" ? entry : entry?.id;
        const itemId = _normalizeDataId(id);
        if (!itemId) continue;

        const key = idToKey.get(itemId);
        if (!key) continue;

        counts[key] = (counts[key] || 0) + 1;
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
      const createdId = _normalizeDataId(created?.id);

      if (!createdId) {
        throw _makeApiError("invalid_list_response", 502);
      }

      _emitDataChanged({
        kind: "lists",
        action: "create",
        listId: createdId
      });

      return created;
    }

    const state = _safeState();
    state.lists = state.lists || [];
    const nowIso = new Date().toISOString();
    const createdListId = _normalizeDataId(String(Date.now()));

    if (!createdListId) {
      throw _makeApiError("invalid_list_response", 500);
    }

    const newList = _normalizeListRecord({
      id: createdListId,
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
      listId: _normalizeDataId(newList.id)
    });

    return _buildListMutationList("create", newList);
  }

  async function updateList(listId, patch = {}) {
    if (!listId) {
      throw _makeApiError("not_found", 404);
    }
    const targetId = _normalizeDataId(listId);
    if (!targetId) {
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
        `/lists/${encodeURIComponent(targetId)}`,
        safePatch
      );
      const updated = _buildListMutationList("update", res);
      const updatedId = _normalizeDataId(updated?.id);

      if (!updatedId || updatedId !== targetId) {
        throw _makeApiError("invalid_list_response", 502);
      }

      _emitDataChanged({
        kind: "lists",
        action: "update",
        listId: targetId
      });

      return updated;
    }

    const state = _safeState();
    state.lists = state.lists || [];
    const lists = state.lists;

    const idx = lists.findIndex((l) => _normalizeDataId(l?.id) === targetId);
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
      listId: targetId
    });

    return _buildListMutationList("update", next);
  }

  async function deleteList(listId) {
    if (!listId) {
      throw _makeApiError("not_found", 404);
    }
    const targetId = _normalizeDataId(listId);
    if (!targetId) {
      throw _makeApiError("not_found", 404);
    }

    if (_isHttp()) {
      const res = await _httpJson(
        "DELETE",
        `/lists/${encodeURIComponent(targetId)}`
      );
      const result = _buildListMutationResult("delete", {
        ...res,
        listId: targetId
      });

      if (Number(result.deleted || 0) <= 0) {
        throw _makeApiError("invalid_delete_response", 502);
      }

      _emitDataChanged({
        kind: "lists",
        action: "delete",
        listId: targetId
      });

      return result;
    }

    const state = _safeState();
    const before = (state.lists || []).length;

    state.lists = (state.lists || []).filter(
      (l) => _normalizeDataId(l?.id) !== targetId
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
      listId: targetId
    });

    return _buildListMutationResult("delete", {
      ok: true,
      listId: targetId,
      deleted
    });
  }

  // === listas: añadir / quitar items ===
  async function addLibraryItemToList(listId, itemId) {
    const safeListId = _normalizeDataId(listId);
    const safeItemId = _normalizeDataId(itemId);

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
      const result = _buildListMutationResult("add_item", {
        ...res,
        listId: safeListId,
        itemId: _normalizeDataId(res?.itemId || safeItemId)
      });
      const listItems = Array.isArray(result.list?.items) ? result.list.items : [];
      const itemInList = listItems.some((entry) => {
        const id = typeof entry === "string" ? entry : entry?.id;
        return _normalizeDataId(id) === safeItemId;
      });

      if (!result.ok || result.listId !== safeListId || result.itemId !== safeItemId || !itemInList) {
        throw _makeApiError("invalid_add_item_response", 502);
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

      return result;
    }

    ensureListsSeeded();

    const state = _safeState();
    state.lists = state.lists || [];
    const list = state.lists.find((l) => _normalizeDataId(l?.id) === safeListId);
    if (!list) {
      throw _makeApiError("list_not_found", 404);
    }

    const library = _isHttp() ? await getLibrary() : (state.library || []);
    const itemExists = library.some((i) => _normalizeDataId(i?.id) === safeItemId);
    if (!itemExists) {
      throw _makeApiError("item_not_found", 404);
    }

    list.items = Array.isArray(list.items) ? list.items : [];

    const already = list.items.some(x => {
      const id = (typeof x === "string") ? x : x?.id;
      return _normalizeDataId(id) === safeItemId;
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
    const safeListId = _normalizeDataId(listId);
    const safeItemId = _normalizeDataId(itemId);

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
    const list = state.lists.find((l) => _normalizeDataId(l?.id) === safeListId);
    if (!list) {
      throw _makeApiError("list_not_found", 404);
    }

    list.items = Array.isArray(list.items) ? list.items : [];
    const before = list.items.length;

    list.items = list.items.filter(x => {
      const id = (typeof x === "string") ? x : x?.id;
      return _normalizeDataId(id) !== safeItemId;
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
      const res = await _httpJson("POST", "/notifications", {
        title: title || "Notificación",
        text,
        color,
        icon
      });

      const notif = _normalizeNotificationsList([res?.notification || res])[0] || null;

      if (notif) {
        _emitDataChanged({
          kind: "notifications",
          action: "add",
          notificationId: _normalizeNotificationId(notif?.id)
        });
      }

      return _cloneData(notif);
    }

    const state = _safeState();
    state.notifications = _normalizeNotificationsList(state.notifications);

    const nowIso = new Date().toISOString();
    const notificationId = _normalizeNotificationId(`notif-${Date.now()}`);

    const notif = {
      id: notificationId,
      title: title || "Notificación",
      text,
      color,
      icon,
      time: "Ahora",
      createdAt: nowIso
    };

    // Insertar al principio (más reciente arriba)
    state.notifications = _normalizeNotificationsList([notif, ...state.notifications]);

    if (typeof FakeBackend !== "undefined") {
      FakeBackend.saveState(state);
      _emitDataChanged({
        kind: "notifications",
        action: "add",
        notificationId: _normalizeNotificationId(notif?.id)
      });
    }

    return _cloneData({
      ...notif,
      id: _normalizeNotificationId(notif.id)
    });
  }

  // === RACHA (notificación por hitos) ===
  async function maybeNotifyStreak() {
    const state = _isHttp()
      ? { user: (await getUser()) || {} }
      : _safeState();
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
    const icon = hot ? "flame" : "streak";

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
    const normalizedItemId = _normalizeDataId(itemId);
    if (!normalizedItemId) return { ok: false, reason: "missing_params" };

    if (_isHttp()) {
      const safeSinceIso = String(sinceIso || "").trim();
      const res = await _httpJson(
        "DELETE",
        `/activities?itemId=${encodeURIComponent(normalizedItemId)}&since=${encodeURIComponent(safeSinceIso)}`
      );
      const removed = Number(res?.removed || 0);

      _emitDataChanged({
        kind: "activities",
        action: "undo_since",
        itemId: normalizedItemId,
        removed
      });

      try {
        const stats = await getHomeStats();
        const streak = Number(stats?.streakDays || 0);

        const milestones = [3, 7, 14, 30];
        const achievedNow = milestones.filter((m) => streak >= m).pop() || 0;

        const user = (await getUser()) || {};
        const lastNotified = Number(user.lastStreakNotified || 0);

        if (lastNotified > achievedNow) {
          await updateUser({ lastStreakNotified: achievedNow });
        }
      } catch (e) {
        console.error("undoActivitiesForItemSince: reconcile streak failed", e);
      }

      return { ok: true, removed, mode: "http" };
    }

    if (typeof FakeBackend === "undefined" || typeof FakeBackend.removeActivitiesForItemSince !== "function") {
      return { ok: false, reason: "backend_not_available" };
    }

    const state = _safeState();
    state.user = state.user || {};

    const res = FakeBackend.removeActivitiesForItemSince(
      normalizedItemId,
      String(sinceIso),
      ["resume", "progress", "completed"]
    );

    const removed = Number(res?.removed || 0);

    _emitDataChanged({
      kind: "activities",
      action: "undo_since",
      itemId: normalizedItemId,
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
    if (itemId == null) return { ok: false, reason: "missing_id" };
    const targetId = _normalizeDataId(itemId);
    if (!targetId) return { ok: false, reason: "missing_id" };

    // =========================
    // HTTP (backend real)
    // =========================
    if (_isHttp()) {
      const item = await getLibraryItemById(targetId);
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

        const watchedActivityPayload = hasEpisodeMetadata
          ? {
            season: currentSeason,
            episode: currentEpisode
          }
          : null;

        await updateLibraryItem(
          {
            ...updated,
            activityPayload: watchedActivityPayload
          },
          { logActivity: true }
        );

        if (daysSinceLast >= 7) {
          const hot = daysSinceLast >= 14;

          await addNotification({
            title: `Retomado: ${item.title}`,
            text: `Volviste después de ${daysSinceLast} días.`,
            color: hot ? "#f97316" : "#2563eb",
            icon: hot ? "flame" : "resume"
          });
        }

        return {
          ok: true,
          daysSinceLast,
          itemId: targetId,
          title: item.title,
          justCompleted,
          deltaLabel: justCompleted
            ? _completedLabelForType("serie")
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

      if (daysSinceLast >= 7) {
        const hot = daysSinceLast >= 14;

        await addNotification({
          title: `Retomado: ${item.title}`,
          text: `Volviste después de ${daysSinceLast} días.`,
          color: hot ? "#f97316" : "#2563eb",
          icon: hot ? "flame" : "resume"
        });
      }

      return {
        ok: true,
        daysSinceLast,
        itemId: targetId,
        title: item.title
      };
    }

    // =========================
    // LOCAL (FakeBackend)
    // =========================
    const state = _safeState();
    state.library = state.library || [];
    state.activities = state.activities || [];

    const item = state.library.find((i) => _normalizeDataId(i?.id) === targetId);
    if (!item) return { ok: false, reason: "not_found" };

    const now = new Date();
    let lastDate = null;

    (state.activities || []).forEach((act) => {
      if (_normalizeDataId(act?.targetId) !== targetId) return;
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
    let watchedActivityPayload = null;

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
      watchedActivityPayload = {
        season: currentSeason,
        episode: currentEpisode
      };

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
        type: "progress",
        targetType: "library_item",
        targetId,
        minutes: 20,
        payload: item.type === "serie" ? watchedActivityPayload : null
      });

      await maybeNotifyStreak();
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

    _emitDataChanged({ kind: "library", action: "resume", itemId: targetId });
    return { ok: true, daysSinceLast, itemId: targetId, title: item.title };
  }

  // Completar contenido (desde Biblioteca / Home)
  async function completeLibraryItem(itemId) {
    if (itemId == null) return { ok: false, reason: "missing_id" };
    const targetId = _normalizeDataId(itemId);
    if (!targetId) return { ok: false, reason: "missing_id" };

    // =========================
    // HTTP (backend real)
    // =========================
    if (_isHttp()) {
      const current = await _httpJson("GET", `/library/${encodeURIComponent(targetId)}`);
      if (!current) return { ok: false, reason: "not_found" };

      if (Number(current.progress ?? 0) >= 100 || current.status === "completed") {
        return { ok: true, alreadyCompleted: true };
      }

      const nowIso = new Date().toISOString();
      let seriesActivities = [];
      if (current.type === "serie") {
        try {
          seriesActivities = await getLibraryItemActivities(targetId, { filter: "all" });
        } catch (error) {
          console.warn("[ApiClient] completeLibraryItem could not load series activities", error);
          seriesActivities = [];
        }
      }

      let completedSeriesMeta = null;
      if (current.type === "serie") {
        try {
          completedSeriesMeta = _buildSeriesCompletionMeta(current, seriesActivities, nowIso);
        } catch (error) {
          console.warn("[ApiClient] completeLibraryItem could not build series completion meta", error);
          completedSeriesMeta = null;
        }
      }

      const payload = {
        progress: 100,
        status: "completed",
        lastActivityAt: nowIso,
        ...(completedSeriesMeta ? { meta: completedSeriesMeta } : {})
      };

      const res = await _httpJson("PATCH", `/library/${encodeURIComponent(targetId)}`, payload);
      const item = _extractLibraryMutationItem(res, "invalid_complete_response", targetId);

      _emitDataChanged({ kind: "library", action: "complete", itemId: targetId });

      try {
        await addNotification({
          title: _t("library_status_completed", null, "Completado"),
          text: item.title || current.title,
          color: "#16a34a",
          icon: "check"
        });
      } catch (error) {
        console.warn("[ApiClient] completeLibraryItem notification failed", error);
      }

      try {
        await maybeNotifyStreak();
      } catch (error) {
        console.warn("[ApiClient] completeLibraryItem streak notification failed", error);
      }

      return { ok: true, itemId: targetId, title: item.title || current.title };
    }

    // =========================
    // LOCAL (FakeBackend)
    // =========================
    const state = _safeState();
    state.library = state.library || [];
    state.activities = state.activities || [];

    const item = state.library.find((i) => _normalizeDataId(i?.id) === targetId);
    if (!item) return { ok: false, reason: "not_found" };

    // Si ya estaba completado, no hacemos nada
    if (item.progress >= 100 || item.status === "completed") {
      return { ok: true, alreadyCompleted: true };
    }

    const nowIso = new Date().toISOString();
    const completedSeriesMeta = item.type === "serie"
      ? _buildSeriesCompletionMeta(
        item,
        (Array.isArray(state.activities) ? state.activities : [])
          .map((entry) => _normalizeActivityRecord(entry))
          .filter(Boolean)
          .filter((entry) => entry.targetId === targetId),
        nowIso
      )
      : null;

    // Marcar como completado
    item.progress = 100;
    item.status = "completed";
    item.updatedAt = nowIso;
    item.lastActivityAt = nowIso;
    if (completedSeriesMeta) {
      item.meta = _sanitizeLibraryMeta(completedSeriesMeta);
    }

    // Guardar estado
    if (typeof FakeBackend !== "undefined") FakeBackend.saveState(state);

    // Registrar actividad
    if (typeof FakeBackend !== "undefined" && typeof FakeBackend.addActivity === "function") {
      const activityPayload = item.type === "serie"
        ? {
          season: item?.meta?.season,
          episode: item?.meta?.episode
        }
        : null;

      FakeBackend.addActivity({
        type: "completed",
        targetType: "library_item",
        targetId,
        minutes: 0,
        payload: activityPayload
      });
    }

    // Notificación automática
    await addNotification({
      title: _t("library_status_completed", null, "Completado"),
      text: item.title,
      color: "#16a34a",
      icon: "check"
    });

    await maybeNotifyStreak();

    _emitDataChanged({ kind: "library", action: "complete", itemId: targetId });
    return { ok: true, itemId: targetId, title: item.title };
  }

  function _normalizeSeriesSeasonBreakdown(meta = {}) {
    return (Array.isArray(meta.seasonBreakdown) ? meta.seasonBreakdown : [])
      .map((season) => ({
        seasonNumber: Math.max(1, Number(season?.seasonNumber || 0) || 0),
        episodeCount: Math.max(0, Number(season?.episodeCount || 0) || 0)
      }))
      .filter((season) => season.seasonNumber > 0 && season.episodeCount > 0)
      .sort((a, b) => a.seasonNumber - b.seasonNumber);
  }

  function _getSeriesAbsoluteEpisodeFromMeta(meta = {}, seasonBreakdown = []) {
    const safeSeason = Math.max(1, Number(meta.season || 1) || 1);
    const safeEpisode = Math.max(0, Number(meta.episode || 0) || 0);
    let episodesBeforeSeason = 0;

    for (const season of seasonBreakdown) {
      if (season.seasonNumber === safeSeason) {
        return episodesBeforeSeason + safeEpisode;
      }

      episodesBeforeSeason += season.episodeCount;
    }

    return safeEpisode;
  }

  function _getSeriesPositionFromAbsoluteEpisode(seasonBreakdown = [], absoluteEpisode = 1) {
    let remaining = Math.max(1, Number(absoluteEpisode || 1) || 1);

    for (const season of seasonBreakdown) {
      if (remaining <= season.episodeCount) {
        return {
          season: season.seasonNumber,
          episode: remaining
        };
      }

      remaining -= season.episodeCount;
    }

    const lastSeason = seasonBreakdown[seasonBreakdown.length - 1];

    return {
      season: lastSeason?.seasonNumber || 1,
      episode: lastSeason?.episodeCount || 1
    };
  }

  function _setEpisodeSeenMapEntry(targetMap, key, iso) {
    const safeKey = String(key || "").trim();
    const safeIso = _safeText(iso).trim();

    if (!safeKey || !safeIso) return;

    if (!targetMap[safeKey] || new Date(safeIso) > new Date(targetMap[safeKey])) {
      targetMap[safeKey] = safeIso;
    }
  }

  function _buildEpisodeSeenMapFromActivities(activities = []) {
    const safeMap = {};

    (Array.isArray(activities) ? activities : []).forEach((activity) => {
      const season = Math.max(0, Number(activity?.payload?.season || 0) || 0);
      const episode = Math.max(0, Number(activity?.payload?.episode || 0) || 0);
      const createdAt = _safeText(activity?.createdAt).trim();

      if (season <= 0 || episode <= 0 || !createdAt) return;

      _setEpisodeSeenMapEntry(safeMap, `${season}:${episode}`, createdAt);
    });

    return safeMap;
  }

  function _buildSeriesCompletionMeta(item, activities = [], completedAt = "") {
    const meta = item?.meta && typeof item.meta === "object" ? item.meta : {};
    const normalizedCompletedAt = _safeText(completedAt).trim() || new Date().toISOString();
    let seasonBreakdown = _normalizeSeriesSeasonBreakdown(meta);
    const totalEpisodesFromBreakdown = seasonBreakdown.reduce(
      (sum, season) => sum + season.episodeCount,
      0
    );
    const totalEpisodes = totalEpisodesFromBreakdown || Math.max(0, Number(meta.totalEpisodes || 0) || 0);

    if (!seasonBreakdown.length && totalEpisodes > 0) {
      seasonBreakdown = [
        {
          seasonNumber: Math.max(1, Number(meta.season || 1) || 1),
          episodeCount: totalEpisodes
        }
      ];
    }

    if (!seasonBreakdown.length || totalEpisodes <= 0) {
      return null;
    }

    const mergedSeenMap = _sanitizeEpisodeSeenMap(meta.episodeSeenMap);
    const activitySeenMap = _buildEpisodeSeenMapFromActivities(activities);

    Object.entries(activitySeenMap).forEach(([key, iso]) => {
      _setEpisodeSeenMapEntry(mergedSeenMap, key, iso);
    });

    seasonBreakdown.forEach((season) => {
      for (let episode = 1; episode <= season.episodeCount; episode += 1) {
        const key = `${season.seasonNumber}:${episode}`;
        if (!mergedSeenMap[key]) {
          mergedSeenMap[key] = normalizedCompletedAt;
        }
      }
    });

    const lastSeason = seasonBreakdown[seasonBreakdown.length - 1];

    return {
      ...meta,
      season: lastSeason?.seasonNumber || Math.max(1, Number(meta.season || 1) || 1),
      episode: lastSeason?.episodeCount || Math.max(1, Number(meta.episode || 1) || 1),
      totalEpisodes,
      episodeSeenMap: mergedSeenMap
    };
  }

  function _buildSeriesQuickProgressPatch(item) {
    const meta = item?.meta && typeof item.meta === "object" ? item.meta : {};
    const seasonBreakdown = _normalizeSeriesSeasonBreakdown(meta);
    const totalEpisodesFromBreakdown = seasonBreakdown.reduce(
      (sum, season) => sum + season.episodeCount,
      0
    );
    const totalEpisodes = totalEpisodesFromBreakdown || Math.max(0, Number(meta.totalEpisodes || 0) || 0);

    if (!seasonBreakdown.length || totalEpisodes <= 0) {
      return null;
    }

    const prevProgress = Math.max(0, Math.min(100, Number(item.progress || 0)));
    const progressAbsoluteEpisode = prevProgress > 0
      ? Math.round((prevProgress / 100) * totalEpisodes)
      : 0;
    const metaAbsoluteEpisode = prevProgress > 0
      ? _getSeriesAbsoluteEpisodeFromMeta(meta, seasonBreakdown)
      : 0;

    const currentAbsoluteEpisode = Math.max(
      0,
      Math.min(totalEpisodes, Math.max(progressAbsoluteEpisode, metaAbsoluteEpisode))
    );
    const nextAbsoluteEpisode = Math.min(totalEpisodes, currentAbsoluteEpisode + 1);
    const nextPosition = _getSeriesPositionFromAbsoluteEpisode(
      seasonBreakdown,
      nextAbsoluteEpisode
    );
    const watchedPosition = _getSeriesPositionFromAbsoluteEpisode(
      seasonBreakdown,
      currentAbsoluteEpisode > 0 ? currentAbsoluteEpisode : nextAbsoluteEpisode
    );
    const nextProgress = Math.round((nextAbsoluteEpisode / totalEpisodes) * 100);
    const justCompleted = nextAbsoluteEpisode >= totalEpisodes;

    return {
      progress: justCompleted ? 100 : Math.max(1, Math.min(99, nextProgress)),
      status: justCompleted ? "completed" : "watching",
      meta: {
        ...meta,
        season: nextPosition.season,
        episode: nextPosition.episode,
        totalEpisodes
      },
      activityPayload: {
        season: watchedPosition.season,
        episode: watchedPosition.episode
      },
      deltaLabel: justCompleted
        ? _t("library_status_completed", null, "Completado")
        : `T${nextPosition.season} · E${nextPosition.episode}`,
      justCompleted
    };
  }

  async function progressLibraryItem(itemId, delta = 5) {
    if (itemId == null) return { ok: false, reason: "missing_id" };

    const targetId = _normalizeDataId(itemId);
    if (!targetId) return { ok: false, reason: "missing_id" };
    const current = await getLibraryItemById(targetId);
    if (!current) return { ok: false, reason: "not_found" };

    const seriesPatch = current.type === "serie"
      ? _buildSeriesQuickProgressPatch(current)
      : null;

    const prev = Math.max(0, Math.min(100, Number(current.progress ?? 0)));
    const safeDelta = Math.max(1, Math.min(100, Number(delta || 0)));
    const next = seriesPatch
      ? seriesPatch.progress
      : Math.min(100, Math.max(0, prev + safeDelta));
    const justCompleted = seriesPatch
      ? seriesPatch.justCompleted
      : next >= 100 && prev < 100;

    const nextItem = seriesPatch
      ? {
        ...current,
        status: seriesPatch.status,
        progress: seriesPatch.progress,
        meta: seriesPatch.meta,
        activityPayload: seriesPatch.activityPayload
      }
      : {
        ...current,
        progress: next
      };

    if (!seriesPatch && current.type === "book") {
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

    let deltaLabel = seriesPatch?.deltaLabel || `${Math.round(next)}%`;
    if (!seriesPatch && current.type === "book" && Number(nextItem.meta?.totalPages || 0) > 0) {
      deltaLabel = `${Number(nextItem.meta.pagesRead || 0)}/${Number(nextItem.meta.totalPages || 0)} ${_t("library_pages", null, "páginas")}`;
    }

    return {
      ok: true,
      justCompleted,
      itemId: targetId,
      deltaLabel: justCompleted ? _t("library_status_completed", null, "Completado") : deltaLabel
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

        const fallbackItems =
          _libraryCache.transport === __cfg.transport && Array.isArray(_libraryCache.items)
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
    const safeItemId = _normalizeDataId(itemId);
    if (!safeItemId) return null;

    if (_isHttp()) {
      try {
        const res = await _httpJson("GET", `/library/${encodeURIComponent(safeItemId)}`);
        if (!res) return null;
        return _cloneData(res && res.item ? res.item : res);
      } catch (error) {
        if (error?.status === 401 || error?.status === 404) {
          return null;
        }
        console.error("[ApiClient] getLibraryItemById failed", error);
        return _getCachedLibraryItemById(safeItemId);
      }
    }

    const cachedItem = _getCachedLibraryItemById(safeItemId);
    if (cachedItem) {
      return cachedItem;
    }

    const state = _safeState();
    const library = state.library || [];
    const item = library.find((i) => _normalizeDataId(i?.id) === safeItemId) || null;
    return _cloneData(item);
  }

  async function updateLibraryItem(updatedItem, { logActivity = true } = {}) {
    if (!updatedItem?.id) return { ok: false, reason: "missing_id" };
    const itemId = _normalizeDataId(updatedItem.id);
    if (!itemId) return { ok: false, reason: "missing_id" };

    // =========================
    // HTTP (backend real)
    // =========================
    if (_isHttp()) {
      // Nota: el backend debe decidir si registra activity (progress/completed) según logActivity
      // para mantener racha coherente sin que el cliente toque /activities directamente.
      const payload = {
        ...updatedItem,
        id: itemId,
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

    const idx = state.library.findIndex((i) => _normalizeDataId(i?.id) === itemId);
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
      id: itemId,
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

    const canonicalIdentity = _normalizeCanonicalIdentity(
      Object.prototype.hasOwnProperty.call(patch, "source")
        ? patch.source
        : prev.source,
      next.type,
      Object.prototype.hasOwnProperty.call(patch, "externalId")
        ? patch.externalId
        : prev.externalId
    );

    if (
      canonicalIdentity.error ||
      !canonicalIdentity.source ||
      !canonicalIdentity.type ||
      !canonicalIdentity.externalId
    ) {
      throw _makeApiError(
        canonicalIdentity.error || "missing_identity",
        400
      );
    }

    next.source = canonicalIdentity.source;
    next.externalId = canonicalIdentity.externalId;

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
      if (_normalizeDataId(it?.id) === itemId) return false;

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
          const rawActivityPayload = updatedItem?.activityPayload && typeof updatedItem.activityPayload === "object"
            ? updatedItem.activityPayload
            : next.type === "serie"
              ? {
                season: next?.meta?.season,
                episode: next?.meta?.episode
              }
              : null;
          const activitySeason = Math.max(0, Number(rawActivityPayload?.season || 0) || 0);
          const activityEpisode = Math.max(0, Number(rawActivityPayload?.episode || 0) || 0);
          const activityPayload =
            activitySeason > 0 && activityEpisode > 0
              ? {
                season: activitySeason,
                episode: activityEpisode
              }
              : null;
          FakeBackend.addActivity({
            type: actType,
            targetType: "library_item",
            targetId: itemId,
            minutes: 20,
            payload: activityPayload
          });

          await maybeNotifyStreak();
        }
      }
    }

    _emitDataChanged({ kind: "library", action: "update", itemId });

    return { ok: true, item: next };
  }

  async function deleteLibraryItem(itemId) {
    if (itemId == null) return { ok: false, reason: "missing_id" };

    const idStr = _normalizeDataId(itemId);
    if (!idStr) return { ok: false, reason: "missing_id" };

    // =========================
    // HTTP (backend real)
    // =========================
    if (_isHttp()) {
      const res = await _httpJson("DELETE", `/library/${encodeURIComponent(idStr)}`);
      const deleted = Number(res?.deleted || 0);

      if (!Number.isFinite(deleted) || deleted <= 0) {
        throw _makeApiError("invalid_delete_response", 502);
      }

      _invalidateListsCache();
      _emitDataChanged({ kind: "library", action: "delete", itemId: idStr });

      return { ok: true, deleted };
    }

    // =========================
    // LOCAL (FakeBackend)
    // =========================
    const state = _safeState();
    state.library = state.library || [];
    state.lists = state.lists || [];

    const idx = state.library.findIndex((i) => _normalizeDataId(i?.id) === idStr);
    if (idx === -1) return { ok: false, reason: "not_found" };

    const removed = state.library[idx];

    state.library.splice(idx, 1);

    // integridad: quitar de listas donde aparezca
    state.lists.forEach((list) => {
      const arr = Array.isArray(list.items) ? list.items : [];
      const before = arr.length;

      const filtered = arr.filter((entry) => {
        const id = (typeof entry === "string") ? entry : entry?.id;
        return _normalizeDataId(id) !== idStr;
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

    _invalidateListsCache();
    _emitDataChanged({ kind: "library", action: "delete", itemId: idStr });

    return { ok: true, removed };
  }

  async function restoreLibraryItem(item, { toFront = true } = {}) {
    if (!item?.id) return { ok: false, reason: "missing_id" };
    const restoredItemId = _normalizeDataId(item.id);
    if (!restoredItemId) return { ok: false, reason: "missing_id" };

    if (_isHttp()) {
      const res = await _httpJson("POST", "/library/restore", {
        item,
        toFront
      });
      const restored = _extractLibraryMutationItem(res, "invalid_restore_response", restoredItemId);

      _emitDataChanged({ kind: "library", action: "restore", itemId: restoredItemId });

      return {
        ok: true,
        already: !!res?.already,
        item: restored
      };
    }

    const state = _safeState();
    state.library = state.library || [];

    const exists = state.library.find(
      (i) => _normalizeDataId(i?.id) === restoredItemId
    );

    if (exists) {
      return {
        ok: true,
        already: true,
        item: {
          ...exists,
          alreadyExists: true
        }
      };
    }

    const title = _normalizeContentText(item.title);
    const type = String(item.type || "pelicula").trim().toLowerCase();
    const canonicalIdentity = _normalizeCanonicalIdentity(
      item.source,
      type,
      item.externalId
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

    if (!canonicalIdentity.source || !canonicalIdentity.externalId) {
      throw _makeApiError("missing_identity", 400);
    }

    if (
      Object.prototype.hasOwnProperty.call(item, "status") &&
      item.status != null &&
      String(item.status).trim() !== ""
    ) {
      const status = String(item.status || "").trim().toLowerCase();
      if (!allowedStatuses.has(status)) {
        throw _makeApiError("invalid_status", 400);
      }
    }

    const duplicate = state.library.find((entry) =>
      _isSameLibraryIdentity(entry, {
        title,
        type,
        source: canonicalIdentity.source,
        externalId: canonicalIdentity.externalId
      })
    );

    if (duplicate) {
      return {
        ok: true,
        already: true,
        item: {
          ...duplicate,
          alreadyExists: true
        }
      };
    }

    const rawProgress = Number(item.progress ?? 0);
    const safeProgress = Number.isFinite(rawProgress)
      ? Math.max(0, Math.min(100, rawProgress))
      : 0;
    const nowIso = new Date().toISOString();

    const restored = {
      id: restoredItemId,
      type,
      title,
      source: canonicalIdentity.source,
      externalId: canonicalIdentity.externalId,
      status: _normalizeLibraryStatus(item.status, type, safeProgress),
      progress: safeProgress,
      meta: _sanitizeLibraryMeta(item.meta),
      cover: String(item.cover || "").trim().slice(0, 500),
      createdAt: String(item.createdAt || nowIso),
      updatedAt: nowIso
    };

    if (toFront) state.library.unshift(restored);
    else state.library.push(restored);

    if (typeof FakeBackend !== "undefined") {
      FakeBackend.saveState(state);
      _emitDataChanged({ kind: "library", action: "restore", itemId: restoredItemId });
    }

    return { ok: true, item: restored };
  }

  // === EXPLORE: ocultados (persistente en user) ===
  function _ensureExploreUserState(state) {
    state.user = state.user || {};
    state.user.explore = state.user.explore || {};
    state.user.explore.dismissed = _normalizeExploreDismissedIds(
      state.user.explore.dismissed
    );
    return state.user.explore;
  }

  // === EXPLORE: UI state (filtros/orden/búsqueda) persistente en user ===
  function _ensureExploreUIState(state) {
    const explore = _ensureExploreUserState(state);
    explore.ui = explore.ui && typeof explore.ui === "object" ? explore.ui : {};
    return explore.ui;
  }

  async function getExploreUIState() {
    if (_isHttp()) {
      return _httpJson("GET", "/user/ui/explore");
    }

    const state = _safeState();
    const ui = _ensureExploreUIState(state);

    return {
      typeFilter: (ui.typeFilter && typeof ui.typeFilter === "string") ? ui.typeFilter : "all",
      sortMode: (ui.sortMode && typeof ui.sortMode === "string") ? ui.sortMode : "recent",
      searchTerm: (ui.searchTerm && typeof ui.searchTerm === "string") ? ui.searchTerm : ""
    };
  }

  async function setExploreUIState(patch = {}) {
    if (_isHttp()) {
      return _httpJson("PATCH", "/user/ui/explore", patch);
    }

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

  async function getLibraryUIState() {
    if (_isHttp()) {
      return _httpJson("GET", "/user/ui/library");
    }

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
    if (_isHttp()) {
      return _httpJson("PATCH", "/user/ui/library", patch);
    }

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

  // === LISTS: UI state (filtro + búsqueda) persistente en user ===
  function _ensureListsUIState(state) {
    state.user = state.user || {};
    state.user.lists = state.user.lists && typeof state.user.lists === "object" && !Array.isArray(state.user.lists)
      ? state.user.lists
      : {};
    state.user.lists.ui = state.user.lists.ui && typeof state.user.lists.ui === "object"
      ? state.user.lists.ui
      : {};
    return state.user.lists.ui;
  }

  async function getListsUIState() {
    if (_isHttp()) {
      return _httpJson("GET", "/user/ui/lists");
    }

    const state = _safeState();
    const ui = _ensureListsUIState(state);

    return {
      visibilityFilter: (ui.visibilityFilter && typeof ui.visibilityFilter === "string") ? ui.visibilityFilter : "all",
      searchTerm: (ui.searchTerm && typeof ui.searchTerm === "string") ? ui.searchTerm : "",
      detailSearch: (ui.detailSearch && typeof ui.detailSearch === "string") ? ui.detailSearch : "",
      detailType: (ui.detailType && typeof ui.detailType === "string") ? ui.detailType : "all",
      detailStatus: (ui.detailStatus && typeof ui.detailStatus === "string") ? ui.detailStatus : "all"
    };
  }

  async function setListsUIState(patch = {}) {
    if (_isHttp()) {
      return _httpJson("PATCH", "/user/ui/lists", patch);
    }

    const state = _safeState();
    const ui = _ensureListsUIState(state);

    const next = { ...ui, ...patch };
    if (typeof next.visibilityFilter !== "string") next.visibilityFilter = "all";
    if (typeof next.searchTerm !== "string") next.searchTerm = "";
    if (typeof next.detailSearch !== "string") next.detailSearch = "";
    if (typeof next.detailType !== "string") next.detailType = "all";
    if (typeof next.detailStatus !== "string") next.detailStatus = "all";

    state.user.lists.ui = next;
    if (typeof FakeBackend !== "undefined") FakeBackend.saveState(state);

    return { ok: true, ui: next };
  }

  async function getExploreDismissed() {
    if (_isHttp()) {
      const res = await _httpJson("GET", "/user/explore/dismissed");
      return Array.isArray(res?.dismissed) ? res.dismissed : [];
    }

    const state = _safeState();
    const explore = _ensureExploreUserState(state);
    return [...explore.dismissed];
  }

  async function dismissExploreItem(eid) {
    const key = _normalizeDataId(eid);
    if (!key) return { ok: false };

    if (_isHttp()) {
      return _httpJson("POST", "/user/explore/dismissed", { eid: key });
    }

    const state = _safeState();
    const explore = _ensureExploreUserState(state);

    explore.dismissed = _normalizeExploreDismissedIds([key, ...explore.dismissed]);

    if (typeof FakeBackend !== "undefined") {
      FakeBackend.saveState(state);
    }

    return { ok: true };
  }

  async function clearExploreDismissed() {
    if (_isHttp()) {
      return _httpJson("DELETE", "/user/explore/dismissed");
    }

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

      _emitDataChanged({ kind: "library", action: "create", itemId: item.id });
      return item;
    }

    const state = _safeState();
    state.library = state.library || [];

    const title = _normalizeContentText(data.title);
    const type = String(data.type || "pelicula").trim().toLowerCase();
    const canonicalIdentity = _normalizeCanonicalIdentity(
      data.source,
      type,
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

    if (!canonicalIdentity.source || !canonicalIdentity.externalId) {
      throw _makeApiError("missing_identity", 400);
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
      return {
        ...duplicate,
        alreadyExists: true
      };
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
    const createdId = data.id != null
      ? _normalizeDataId(data.id)
      : _normalizeDataId(String(Date.now()));

    if (!createdId) {
      throw _makeApiError("missing_id", 400);
    }

    const newItem = {
      id: createdId,
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

    _emitDataChanged({ kind: "library", action: "create", itemId: createdId });

    return newItem;
  }

  // === DASHBOARD HOME: métricas ===
  async function getHomeStats() {
    let library = [];
    let activities = [];

    if (_isHttp()) {
      [library, activities] = await Promise.all([
        getLibrary(),
        _getHttpActivities()
      ]);

      if (activities.length === 0) {
        activities = _buildSyntheticActivitiesFromLibrary(library);
      }
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
      const activityState = _getDashboardActivityStatus(item);
      return activityState.status === "in_progress";
    }).length;

    if (_isHttp()) {
      const completedYearIds = new Set();
      const completedTodayIds = new Set();

      activities.forEach((act) => {
        if (act?.type !== "completed") return;

        const targetId = _normalizeDataId(act?.targetId);
        if (!targetId || !act.createdAt) return;

        const activityDate = new Date(act.createdAt);
        if (Number.isNaN(activityDate.getTime())) return;

        if (activityDate.getFullYear() === now.getFullYear()) {
          completedYearIds.add(targetId);
        }

        if (_dateKeyLocal(activityDate) === todayKey) {
          completedTodayIds.add(targetId);
        }
      });

      library.forEach((item) => {
        if (item.status !== "completed") return;

        const itemId = _normalizeDataId(item?.id);
        const completedAt = item?.lastActivityAt || item?.updatedAt || "";
        const completedDate = completedAt ? new Date(completedAt) : null;

        if (!itemId || !completedDate || Number.isNaN(completedDate.getTime())) return;

        if (completedDate.getFullYear() === now.getFullYear()) {
          completedYearIds.add(itemId);
        }

        if (_dateKeyLocal(completedDate) === todayKey) {
          completedTodayIds.add(itemId);
        }
      });

      completedThisYear = completedYearIds.size;
      completedToday = completedTodayIds.size;
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
    let library = [];
    let activities = [];

    if (_isHttp()) {
      [library, activities] = await Promise.all([
        getLibrary(),
        _getHttpActivities({ limit: 50 })
      ]);
    } else {
      if (typeof FakeBackend === "undefined") return null;

      const state = _safeState();
      library = Array.isArray(state.library) ? state.library : [];
      activities = Array.isArray(state.activities) ? state.activities : [];
    }

    const normalizedActivities = (Array.isArray(activities) ? activities : [])
      .map((entry) => _normalizeActivityRecord(entry))
      .filter(Boolean);

    const syntheticActivities = _buildSyntheticActivitiesFromLibrary(library);

    const libraryActivityCandidates = (Array.isArray(library) ? library : [])
      .map((entry) => {
        const itemId = _normalizeDataId(entry?.id);
        if (!itemId) return null;

        const activityState = _getDashboardActivityStatus(entry);
        if (activityState.status !== "in_progress" && activityState.status !== "completed") {
          return null;
        }

        const createdAtRaw = String(entry?.lastActivityAt || entry?.updatedAt || entry?.createdAt || "").trim();
        if (!createdAtRaw) return null;

        const createdAtDate = new Date(createdAtRaw);
        if (Number.isNaN(createdAtDate.getTime())) return null;

        return {
          id: `library-direct:${itemId}`,
          type: activityState.status === "completed" ? "completed" : "progress",
          targetType: "library_item",
          targetId: itemId,
          minutes: 0,
          createdAt: createdAtDate.toISOString()
        };
      })
      .filter(Boolean);

    const candidates = [
      ...normalizedActivities,
      ...syntheticActivities,
      ...libraryActivityCandidates
    ]
      .filter((entry) => entry && _normalizeDataId(entry.targetId) && entry.createdAt)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    let item = null;
    let activityDate = null;

    for (const candidate of candidates) {
      const candidateTargetId = _normalizeDataId(candidate.targetId);
      const matchedItem = library.find((entry) => (
        _normalizeDataId(entry?.id) === candidateTargetId
      ));

      if (!matchedItem) continue;

      item = matchedItem;
      activityDate = candidate.createdAt;
      break;
    }

    if (!item || !activityDate) return null;

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
        meta = `${pr} / ${tp} ${_t("home_pages", null, "páginas")}`;
      } else {
        meta = "";
      }
    }

    if (item.type === "game") {
      const hours = Math.max(0, Number(item.meta?.hoursPlayed || 0));
      meta = hours > 0 ? `${hours} h` : "";
    }

    if (item.type === "pelicula") {
      meta = "";
    }

    const progressPercent = Math.max(0, Math.min(100, Number(item.progress ?? 0)));
    const progressLabel = item.type === "game" && Number(item.meta?.hoursPlayed || 0) > 0
      ? `${Math.max(0, Number(item.meta.hoursPlayed || 0))} h`
      : `${Math.round(progressPercent)}%`;

    return {
      id: _normalizeDataId(item.id),
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
      if (t === "progress") return _t("home_activity_filter_progress", null, "Progreso");
      if (t === "completed") return _t("home_last_activity_button_completed", null, "Completado");
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
        if (Number.isFinite(pr) && pr > 0 && Number.isFinite(tp) && tp > 0) {
          return `${pr} / ${tp} ${_t("home_pages", null, "páginas")}`;
        }
        return "";
      }

      // Película / Juego: % real
      if (item.type === "pelicula" || item.type === "game") {
        const pct = Math.max(0, Math.min(100, Number(item.progress ?? 0)));
        return `${Math.round(pct)}%`;
      }

      return "";
    }

    function metaForActivity(activity, item) {
      if (item?.type === "serie") {
        const season = Math.max(0, Number(activity?.payload?.season || 0) || 0);
        const episode = Math.max(0, Number(activity?.payload?.episode || 0) || 0);

        if (season > 0 && episode > 0) {
          return `T${season} · E${episode}`;
        }
      }

      return metaForItem(item);
    }

    if (_isHttp()) {
      const [library, activities] = await Promise.all([
        getLibrary(),
        _getHttpActivities({ limit, filter })
      ]);
      const effectiveActivities = activities.length > 0
        ? activities
        : _buildSyntheticActivitiesFromLibrary(library)
            .filter((entry) => {
              if (filter === "all" || !filter) return true;
              return entry.type === filter;
            });

      if (effectiveActivities.length > 0) {
        return effectiveActivities
          .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
          .slice(0, limit)
          .map((act) => {
            const targetId = _normalizeDataId(act?.targetId);
            const item = library.find((i) => _normalizeDataId(i?.id) === targetId) || null;

            return {
              id: _normalizeDataId(act.id) || `${String(act.type || "activity")}:${targetId}:${String(act.createdAt || "")}`,
              type: act.type,
              label: typeLabel(act.type),
              targetId: targetId || null,
              itemTitle: item?.title || _t("library_item_fallback_title", null, "Contenido"),
              itemMeta: metaForActivity(act, item),
              timeAgo: _formatTimeAgo(act.createdAt)
            };
          });
      }

      const filtered = (library || [])
        .map((item) => {
          const itemId = _normalizeDataId(item?.id);
          const activityState = _getDashboardActivityStatus(item);
          const type = activityState.status === "completed"
            ? "completed"
            : activityState.status === "in_progress"
              ? "progress"
              : null;

          if (!type || !itemId) return null;

          return {
            id: `library:${itemId}`,
            type,
            label: typeLabel(type),
            targetId: itemId,
            itemTitle: item?.title || _t("library_item_fallback_title", null, "Contenido"),
            itemMeta: metaForItem(item),
            timeAgo: formatTimeAgo(item?.lastActivityAt || item?.updatedAt || item?.createdAt || ""),
            createdAt: item?.lastActivityAt || item?.updatedAt || item?.createdAt || ""
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
        const targetId = _normalizeDataId(act?.targetId);
        const item = library.find((i) => _normalizeDataId(i?.id) === targetId) || null;

        return {
          id: _normalizeDataId(act.id) || `${String(act.type || "activity")}:${targetId}:${String(act.createdAt || "")}`,
          type: act.type,
          label: typeLabel(act.type),
          targetId: targetId || null,
          itemTitle: item?.title || _t("library_item_fallback_title", null, "Contenido"),
          itemMeta: metaForActivity(act, item),
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

    const fallback = _resolveMonthlyChallengeConfig(month);
    const fallbackGoalId = _normalizeDataId(fallback?.id) || `goal-${year}-${month + 1}`;

    let completedThisMonth = 0;

    if (_isHttp()) {
      const activities = await _getHttpActivities({ filter: "completed" });
      const completedIds = new Set();

      activities.forEach((act) => {
        const targetId = _normalizeDataId(act?.targetId);
        if (!targetId || !act.createdAt) return;

        const activityDate = new Date(act.createdAt);
        if (Number.isNaN(activityDate.getTime())) return;
        if (activityDate.getFullYear() !== year || activityDate.getMonth() !== month) return;

        completedIds.add(targetId);
      });

      library.forEach((item) => {
        if (item.status !== "completed") return;

        const itemId = _normalizeDataId(item?.id);
        const completedAt = item?.lastActivityAt || item?.updatedAt || "";
        const completedDate = completedAt ? new Date(completedAt) : null;

        if (!itemId || !completedDate || Number.isNaN(completedDate.getTime())) return;
        if (completedDate.getFullYear() !== year || completedDate.getMonth() !== month) return;

        completedIds.add(itemId);
      });

      completedThisMonth = completedIds.size;
    } else {
      completedThisMonth = library.filter((item) => {
        if (item.status !== "completed") return false;
        const updatedAt = item.updatedAt ? new Date(item.updatedAt) : null;
        if (!updatedAt || Number.isNaN(updatedAt.getTime())) return false;
        return updatedAt.getFullYear() === year && updatedAt.getMonth() === month;
      }).length;
    }

    return {
      id: fallbackGoalId,
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
    const safeLimit = Math.max(1, Number(limit) || 4);
    const safeMinDays = Math.max(0, Number(minDays) || 0);

    let library = [];
    let activities = [];

    if (_isHttp()) {
      [library, activities] = await Promise.all([
        getLibrary(),
        _getHttpActivities()
      ]);
    } else {
      const state = _safeState();
      library = state.library || [];
      activities = state.activities || [];
    }

    const lastActivityMap = new Map();

    activities.forEach((act) => {
      const targetId = _normalizeDataId(act?.targetId);
      if (!targetId || !act.createdAt) return;

      const curr = new Date(act.createdAt);
      if (Number.isNaN(curr.getTime())) return;

      const prev = lastActivityMap.get(targetId);
      if (!prev || curr > prev) {
        lastActivityMap.set(targetId, curr);
      }
    });

    function isActiveLibraryItem(item) {
      const pct = Number(item?.progress ?? 0);
      const status = String(item?.status || "").trim().toLowerCase();
      const type = String(item?.type || "").trim();

      if (type === "pelicula") return false;
      if (pct >= 100 || status === "completed") return false;

      return (
        pct > 0 ||
        status === "in_progress" ||
        status === "watching" ||
        status === "reading" ||
        status === "playing"
      );
    }

    function progressLabelFor(item) {
      const pct = Math.max(0, Math.min(100, Number(item.progress ?? 0)));
      const meta = item.meta || {};

      if (item.type === "serie" && meta) {
        const s = meta.season || 1;
        const e = meta.episode || 1;
        return `T${s} · E${e}`;
      }

      if (item.type === "book") {
        const pagesRead = Number(meta.pagesRead || 0);
        const totalPages = Number(meta.totalPages || 0);

        if (Number.isFinite(pagesRead) && Number.isFinite(totalPages) && totalPages > 0) {
          return `${Math.max(0, Math.min(totalPages, pagesRead))}/${totalPages} ${_t("home_pages", null, "páginas")}`;
        }
      }

      if (item.type === "game") {
        const hours = Math.max(0, Number(meta.hoursPlayed || 0));

        if (hours > 0 && pct > 0) return `${hours} h · ${pct}%`;
        if (hours > 0) return `${hours} h`;
      }

      return `${pct}% ${_t("library_progress_completed_suffix", null, "completado")}`;
    }

    const candidates = library
      .filter(isActiveLibraryItem)
      .map((item) => {
        const itemId = _normalizeDataId(item?.id);
        if (!itemId) return null;

        const activityDate = lastActivityMap.get(itemId);
        const fallbackIso = item.lastActivityAt || item.createdAt || "";
        const fallbackDate = fallbackIso ? new Date(fallbackIso) : null;

        const lastDate =
          activityDate ||
          (fallbackDate && !Number.isNaN(fallbackDate.getTime()) ? fallbackDate : null);

        const days = lastDate
          ? Math.max(0, Math.floor((now - lastDate) / (1000 * 60 * 60 * 24)))
          : safeMinDays;

        if (days < safeMinDays) return null;

        return {
          id: itemId,
          type: item.type,
          title: item.title,
          daysSinceLast: days,
          progressPercent: Math.max(0, Math.min(100, Number(item.progress ?? 0))),
          progressLabel: progressLabelFor(item),
          cover: item.cover || "",
          source: item.source || "",
          externalId: item.externalId || ""
        };
      })
      .filter(Boolean);

    candidates.sort((a, b) => b.daysSinceLast - a.daysSinceLast);

    return candidates.slice(0, safeLimit);
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
    return library
      .slice(0, 3)
      .map((item) => {
        const itemId = _normalizeDataId(item?.id);
        if (!itemId) return null;

        return {
          id: itemId,
          title: item.title,
          note:
            item.status === "watching"
              ? "Serie en progreso."
              : item.status === "reading"
              ? "Lectura en curso."
              : item.status === "playing"
              ? "Partida abierta."
              : "En tu biblioteca."
        };
      })
      .filter(Boolean);
  }

  // === NOTIFICACIONES (dashboard) ===
  async function getNotifications() {
    if (_isHttp()) {
      const res = await _httpJson("GET", "/notifications");
      const list = Array.isArray(res?.notifications)
        ? res.notifications
        : Array.isArray(res)
          ? res
          : [];
      return _cloneCollection(_normalizeNotificationsList(list));
    }

    const state = _safeState();
    state.notifications = _normalizeNotificationsList(state.notifications);
    return _cloneCollection(state.notifications);
  }

  async function dismissNotification(notificationId) {
    if (_isHttp()) {
      const targetNotificationId = _normalizeNotificationId(notificationId);
      if (!targetNotificationId) {
        return { ok: false, reason: "missing_id" };
      }

      await _httpJson("DELETE", `/notifications/${encodeURIComponent(targetNotificationId)}`);
      _emitDataChanged({
        kind: "notifications",
        action: "dismiss",
        notificationId: targetNotificationId
      });
      return { ok: true };
    }

    const targetNotificationId = _normalizeNotificationId(notificationId);
    if (!targetNotificationId) {
      return { ok: false, reason: "missing_id" };
    }

    const state = _safeState();
    state.notifications = _normalizeNotificationsList(state.notifications).filter(
      (n) => _normalizeNotificationId(n.id) !== targetNotificationId
    );

    if (typeof FakeBackend !== "undefined") {
      FakeBackend.saveState(state);
      _emitDataChanged({
        kind: "notifications",
        action: "dismiss",
        notificationId: targetNotificationId
      });
    }

    return { ok: true };
  }

  async function clearNotifications() {
    if (_isHttp()) {
      await _httpJson("DELETE", "/notifications");
      _emitDataChanged({ kind: "notifications", action: "clear_all" });
      return { ok: true };
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
      const safeList = _normalizeNotificationsList(nextList);
      const res = await _httpJson("PUT", "/notifications", {
        notifications: safeList
      });
      const list = Array.isArray(res?.notifications)
        ? _normalizeNotificationsList(res.notifications)
        : safeList;

      _emitDataChanged({ kind: "notifications", action: "set_all" });
      return { ok: true, count: list.length };
    }

    const state = _safeState();
    state.notifications = _normalizeNotificationsList(nextList);

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
        return _completedLabelForType(item.type);
      }

      if (item.type === "serie" && item.meta) {
        const s = item.meta.season || 1;
        const e = item.meta.episode || 1;
        return `T${s} · E${e} · ${pct}%`;
      }

      if (item.type === "book" && item.meta?.pagesRead && item.meta?.totalPages) {
        return `${item.meta.pagesRead}/${item.meta.totalPages} ${_t("home_pages", null, "páginas")}`;
      }

      if (item.type === "game") {
        return `${pct}% ${_t("library_progress_completed_suffix", null, "completado")}`;
      }

      return `${pct}% ${_t("library_progress_completed_suffix", null, "completado")}`;
    }

    return library.map((item) => {
      const itemId = _normalizeDataId(item?.id);
      const pct = Number(item.progress ?? 0);

      const status =
        (pct >= 100 || item.status === "completed")
          ? "completed"
          : (pct <= 0)
            ? "not_started"
            : "in_progress";

      if (!itemId) return null;

      return {
        id: itemId,
        type: item.type,
        title: item.title,
        status,
        progressPercent: pct,
        progressLabel: progressLabelFor(item),
        lastActivityAt: item.lastActivityAt || item.updatedAt || item.createdAt,
        platform: item.meta?.platform || null,
        cover: item.cover || null
      };
    }).filter(Boolean);
  }

  async function applyQuickProgress(itemId) {

    if (itemId == null) {
      return { ok: false, reason: "missing_id" };
    }

    const targetId = _normalizeDataId(itemId);
    if (!targetId) {
      return { ok: false, reason: "missing_id" };
    }

    const item = await getLibraryItemById(targetId);

    if (!item) {
      return { ok: false, reason: "item_not_found" };
    }

    const prevProgress = Number(item.progress || 0);
    const seriesPatch = item.type === "serie"
      ? _buildSeriesQuickProgressPatch(item)
      : null;
    let nextProgress = seriesPatch ? seriesPatch.progress : prevProgress;
    let meta = seriesPatch ? seriesPatch.meta : { ...(item.meta || {}) };
    let nextStatus = seriesPatch ? seriesPatch.status : item.status;
    let deltaLabel = seriesPatch?.deltaLabel || "";

    switch (item.type) {

      case "serie":
        if (!seriesPatch) {
          nextProgress = Math.min(100, prevProgress + 5);
          deltaLabel = `${Math.round(nextProgress)}%`;
        }
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
          deltaLabel = `${nextPages}/${total} ${_t("library_pages", null, "páginas")}`;
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

    const justCompleted = seriesPatch
      ? seriesPatch.justCompleted
      : prevProgress < 100 && nextProgress >= 100;

    const updatedItem = {
      ...item,
      status: nextStatus,
      progress: nextProgress,
      meta,
      ...(seriesPatch?.activityPayload ? { activityPayload: seriesPatch.activityPayload } : {})
    };

    const result = await updateLibraryItem(updatedItem, { logActivity: true });
    if (!result?.ok) {
      return result || { ok: false, reason: "update_failed" };
    }

    return {
      ok: true,
      itemId: targetId,
      prevProgress,
      nextProgress,
      justCompleted,
      deltaLabel: justCompleted ? _t("library_status_completed", null, "Completado") : deltaLabel
    };

  }

  return {
    login,
    register,
    requestPasswordReset,
    confirmPasswordReset,
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
    getExploreItemSeasonDetail,
    getListsCountMapByLibraryKey,
    getLibraryUIState,
    setLibraryUIState,
    getListsUIState,
    setListsUIState,
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
    getLibraryItemActivities,
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
