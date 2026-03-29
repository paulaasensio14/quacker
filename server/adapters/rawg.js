import { ENV } from "../config/env.js";

const RAWG_BASE_URL = "https://api.rawg.io/api";

function _getRawgApiKey() {
  const fromEnv =
    ENV.RAWG_API_KEY ||
    process.env.RAWG_KEY ||
    "";

  return String(fromEnv || "").trim();
}

async function _rawgGet(path, params = {}) {
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

  const res = await fetch(url.toString());

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
    cover: "",
    backdrop: _rawgImageUrl(item),
    meta: {
      year: _yearFromDate(item.released),
      rating: Number(item.rating || 0) || null,
      ratingCount: Number(item.ratings_count || 0) || 0
    }
  };
}

export async function searchRawg(query) {
  const q = _safeText(query);
  if (!q) return [];

  const data = await _rawgGet("/games", {
    search: q,
    page: 1,
    page_size: 20
  });

  const results = Array.isArray(data?.results) ? data.results : [];

  const normalizedQuery = String(q).trim().toLowerCase();
  const queryTokens = normalizedQuery.split(/\s+/).filter(Boolean);

  return results
    .map(_baseSearchItemFromRawgGame)
    .filter((item) => {
      if (!item?.externalId || !item?.title) return false;

      const title = String(item.title || "").toLowerCase();

      const strongMatch =
        title === normalizedQuery ||
        title.startsWith(normalizedQuery) ||
        queryTokens.every((token) => title.includes(token));

      if (!strongMatch) return false;

      const rating = Number(item?.meta?.rating || 0);
      if (rating < 2) return false;

      if (!item.cover && !item.backdrop) return false;

      return true;
    })
    .slice(0, 20);
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