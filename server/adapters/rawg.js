import { ENV } from "../config/env.js";

const RAWG_BASE_URL = "https://api.rawg.io/api";
const RAWG_REQUEST_TIMEOUT_MS = 5000;

function _getRawgApiKey() {
  const fromEnv =
    ENV.RAWG_API_KEY ||
    process.env.RAWG_KEY ||
    "";

  return String(fromEnv || "").trim();
}

async function _rawgGet(path, params = {}, options = {}) {
  const apiKey = _getRawgApiKey();

  if (!apiKey) {
    const err = new Error("rawg_api_key_missing");
    err.status = 500;
    throw err;
  }

  const url = new URL(`${RAWG_BASE_URL}${path}`);

  Object.entries({ ...params, key: apiKey }).forEach(([k, v]) => {
    if (v === undefined || v === null || v === "") return;
    url.searchParams.set(k, String(v));
  });

  const requestedTimeout = Number(options?.timeoutMs);

  const timeoutMs =
    Number.isFinite(requestedTimeout) && requestedTimeout > 0
      ? requestedTimeout
      : RAWG_REQUEST_TIMEOUT_MS;

  const signal = AbortSignal.timeout(timeoutMs);

  let res;

  try {
    res = await fetch(url.toString(), { signal });
  } catch (error) {
    if (signal.aborted && signal.reason?.name === "TimeoutError") {
      const timeoutError = new Error("rawg_request_timeout");
      timeoutError.status = 504;
      throw timeoutError;
    }

    throw error;
  }

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    const err = new Error(`rawg_http_${res.status}${text ? `: ${text}` : ""}`);
    err.status = res.status;
    throw err;
  }

  return res.json();
}

function _safeText(value) {
  return String(value || "").trim();
}

function _yearFromDate(value) {
  const text = _safeText(value);
  const match = text.match(/^(\d{4})/);
  return match ? Number(match[1]) : null;
}

function _rawgImageUrl(item) {
  return _safeText(item?.background_image);
}

function _stripHtml(html) {
  return _safeText(html).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function _baseSearchItemFromRawgGame(item) {
  return {
    eid: `rawg:game:${String(item.id)}`,
    source: "rawg",
    externalId: String(item.id),
    type: "game",
    title: _safeText(item.name),
    releaseDate: _safeText(item.released),
    summary: _safeText(item.slug),
    cover: _rawgImageUrl(item),
    backdrop: _rawgImageUrl(item),
    meta: {
      year: _yearFromDate(item.released),
      rating: Number(item.rating || 0) || null,
      ratingCount: Number(item.ratings_count || 0) || 0
    }
  };
}

export async function searchRawg(query, options = {}) {
 const q = _safeText(query);

 if (!q) return [];

 const data = await _rawgGet(
   "/games",
   {
     search: q,
     page: 1,
     page_size: 20
   },
   options
 );

 const results = Array.isArray(data?.results) ? data.results : [];
 const normalizedQuery = String(q).trim().toLowerCase();
 const queryTokens = normalizedQuery.split(/\s+/).filter(Boolean);

 return results
  .map(_baseSearchItemFromRawgGame)
  .filter((item) => {
    if (!item?.externalId || !item?.title) return false;
    const title = String(item.title || "").toLowerCase();
    const exactMatch = title === normalizedQuery;
    const strongMatch =
      exactMatch ||
      title.startsWith(normalizedQuery) ||
      queryTokens.every((token) => title.includes(token));
    if (!strongMatch) return false;
    const rating = Number(item?.meta?.rating || 0);
    if (!exactMatch && rating < 2) return false;
    if (!item.cover && !item.backdrop) return false;
    return true;
  })

 .slice(0, 20);
}

function _dateToIso(date) {
 return new Date(date).toISOString().slice(0, 10);
}

export async function getWeeklyFeaturedRawg(limit = 3) {
 const maxItems =
 Number.isFinite(Number(limit)) && Number(limit) > 0 ? Number(limit) : 3;

 const today = new Date();
 const sixtyDaysAgo = new Date(today);
 sixtyDaysAgo.setDate(today.getDate() - 60);

 const data = await _rawgGet("/games", {
 dates: `${_dateToIso(sixtyDaysAgo)},${_dateToIso(today)}`,
 ordering: "-added",
 page: 1,
 page_size: Math.max(maxItems * 4, 12)
 });

 const results = Array.isArray(data?.results) ? data.results : [];

 return results
 .map(_baseSearchItemFromRawgGame)
 .map((item) => ({
 ...item,
 cover: item.cover || item.backdrop || ""
 }))
 .filter((item) => {
 if (!item?.externalId || !item?.title) return false;
 const rating = Number(item?.meta?.rating || 0);
 if (rating < 2) return false;
 return Boolean(item.cover || item.backdrop);
 })
 .slice(0, maxItems);
}

export async function getRawgDetail(externalId) {
  const safeId = _safeText(externalId);

  if (!safeId) {
    const err = new Error("missing_external_id");
    err.status = 400;
    throw err;
  }

  const data = await _rawgGet(`/games/${encodeURIComponent(safeId)}`);

  return {
    eid: `rawg:game:${safeId}`,
    source: "rawg",
    externalId: safeId,
    type: "game",
    title: _safeText(data.name),
    originalTitle: _safeText(data.name_original || data.name),
    releaseDate: _safeText(data.released),
    summary: _stripHtml(data.description_raw || data.description || ""),
    description: _stripHtml(data.description_raw || data.description || ""),
    cover: _rawgImageUrl(data),
    backdrop: _rawgImageUrl(data),
    genres: Array.isArray(data?.genres)
      ? data.genres.map((g) => _safeText(g?.name)).filter(Boolean)
      : [],
    rating: Number(data.rating || 0) || null,
    ratingCount: Number(data.ratings_count || 0) || 0,
    statusLabel: _safeText(data.released ? "Released" : ""),
    meta: {
      year: _yearFromDate(data.released),
      rating: Number(data.rating || 0) || null,
      platforms: Array.isArray(data?.platforms)
        ? data.platforms
            .map((p) => _safeText(p?.platform?.name))
            .filter(Boolean)
            .join(", ")
        : "",
      developers: Array.isArray(data?.developers)
        ? data.developers.map((d) => _safeText(d?.name)).filter(Boolean).join(", ")
        : ""
    }
  };
}
