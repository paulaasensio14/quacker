const TMDB_BASE_URL = "https://api.themoviedb.org/3";
const TMDB_IMAGE_BASE = "https://image.tmdb.org/t/p/w500";
const TMDB_BACKDROP_BASE = "https://image.tmdb.org/t/p/w780";

import { ENV } from "../config/env.js";

function _tmdbKey() {
  return String(ENV.TMDB_API_KEY || "").trim();
}

function _tmdbHeaders() {
  const key = _tmdbKey();

  if (!key) {
    const err = new Error("missing_tmdb_api_key");
    err.status = 500;
    throw err;
  }

  const looksLikeBearerToken = key.startsWith("eyJ");

  return looksLikeBearerToken
    ? {
        Authorization: `Bearer ${key}`,
        Accept: "application/json"
      }
    : {
        Accept: "application/json"
      };
}

async function _tmdbGet(path, params = {}) {
  const url = new URL(`${TMDB_BASE_URL}${path}`);
  const key = _tmdbKey();
  const looksLikeBearerToken = key.startsWith("eyJ");

  for (const [paramKey, value] of Object.entries(params)) {
    if (value == null || value === "") continue;
    url.searchParams.set(paramKey, String(value));
  }

  if (!key) {
    const err = new Error("missing_tmdb_api_key");
    err.status = 500;
    throw err;
  }

  if (!looksLikeBearerToken) {
    url.searchParams.set("api_key", key);
  }

  const res = await fetch(url, {
    method: "GET",
    headers: _tmdbHeaders()
  });

  if (!res.ok) {
    const bodyText = await res.text().catch(() => "");
    const err = new Error(`tmdb_request_failed:${res.status}:${bodyText}`);
    err.status = res.status;
    throw err;
  }

  return res.json();
}

function _posterUrl(path) {
  return path ? `${TMDB_IMAGE_BASE}${path}` : "";
}

function _backdropUrl(path) {
  return path ? `${TMDB_BACKDROP_BASE}${path}` : "";
}

function _yearFromDate(dateStr) {
  const raw = String(dateStr || "").trim();
  if (!raw) return null;
  const year = Number(raw.slice(0, 4));
  return Number.isFinite(year) ? year : null;
}

function _baseSearchItemFromMovie(item) {
    return {
    eid: `tmdb:movie:${String(item.id)}`,
    source: "tmdb",
    externalId: String(item.id),
    type: "pelicula",
    title: String(item.title || item.original_title || "").trim(),
    releaseDate: String(item.release_date || "").trim(),
    summary: String(item.overview || "").trim(),
    cover: _posterUrl(item.poster_path),
    meta: {
        year: _yearFromDate(item.release_date)
    }
    };
}

function _baseSearchItemFromTv(item) {
    return {
    eid: `tmdb:series:${String(item.id)}`,
    source: "tmdb",
    externalId: String(item.id),
    type: "serie",
    title: String(item.name || item.original_name || "").trim(),
    releaseDate: String(item.first_air_date || "").trim(),
    summary: String(item.overview || "").trim(),
    cover: _posterUrl(item.poster_path),
    meta: {
        year: _yearFromDate(item.first_air_date)
    }
    };
}

export async function searchTmdb(query) {
  const q = String(query || "").trim();
  if (!q) return [];

  const [moviesData, tvData] = await Promise.allSettled([
    _tmdbGet("/search/movie", {
      query: q,
      include_adult: false,
      language: "es-ES",
      page: 1
    }),
    _tmdbGet("/search/tv", {
      query: q,
      include_adult: false,
      language: "es-ES",
      page: 1
    })
  ]);

  const movies =
    moviesData.status === "fulfilled" && Array.isArray(moviesData.value?.results)
      ? moviesData.value.results.map(_baseSearchItemFromMovie)
      : [];

  const series =
    tvData.status === "fulfilled" && Array.isArray(tvData.value?.results)
      ? tvData.value.results.map(_baseSearchItemFromTv)
      : [];

  const merged = [...movies, ...series]
    .filter((item) => item.title)
    .sort((a, b) => {
      const hasCoverA = Number(Boolean(a.cover));
      const hasCoverB = Number(Boolean(b.cover));
      if (hasCoverA !== hasCoverB) return hasCoverB - hasCoverA;

      const yearA = Number(a.meta?.year || 0);
      const yearB = Number(b.meta?.year || 0);
      if (yearA !== yearB) return yearB - yearA;

      return a.title.localeCompare(b.title, "es", { sensitivity: "base" });
    });

  return merged.slice(0, 40);
}

export async function getTmdbDetail({ type, externalId }) {
  const safeType = String(type || "").trim().toLowerCase();
  const safeId = String(externalId || "").trim();

  if (!safeId) {
    const err = new Error("missing_external_id");
    err.status = 400;
    throw err;
  }

    if (!["pelicula", "serie"].includes(safeType)) {
    const err = new Error("invalid_tmdb_type");
    err.status = 400;
    throw err;
    }

    if (safeType === "pelicula") {
    const data = await _tmdbGet(`/movie/${encodeURIComponent(safeId)}`, {
      language: "es-ES"
    });

    const seasonBreakdown = Array.isArray(data.seasons)
      ? data.seasons
          .filter((season) => Number(season?.season_number || 0) > 0)
          .map((season) => ({
            seasonNumber: Number(season.season_number || 0) || 0,
            episodeCount: Number(season.episode_count || 0) || 0,
            name: String(season.name || "").trim()
          }))
          .filter((season) => season.seasonNumber > 0)
      : [];
      
    return {
      eid: `tmdb:series:${safeId}`,
      source: "tmdb",
      externalId: safeId,
      type: "serie",
      title: String(data.name || data.original_name || "").trim(),
      originalTitle: String(data.original_name || "").trim(),
      releaseDate: String(data.first_air_date || "").trim(),
      summary: String(data.overview || "").trim(),
      description: String(data.overview || "").trim(),
      cover: _posterUrl(data.poster_path),
      backdrop: _backdropUrl(data.backdrop_path),
      genres: Array.isArray(data.genres) ? data.genres.map((g) => g.name).filter(Boolean) : [],
      runtime: Array.isArray(data.episode_run_time) && data.episode_run_time.length > 0
        ? Number(data.episode_run_time[0] || 0) || null
        : null,
      rating: Number(data.vote_average || 0) || null,
      ratingCount: Number(data.vote_count || 0) || 0,
      statusLabel: String(data.status || "").trim(),
      seasons: Number(data.number_of_seasons || 0) || 0,
      episodes: Number(data.number_of_episodes || 0) || 0,
      seasonBreakdown,
      meta: {
        year: _yearFromDate(data.first_air_date)
      }
    };
  }

const data = await _tmdbGet(`/tv/${encodeURIComponent(safeId)}`, {
  language: "es-ES"
});

const seasonBreakdown = Array.isArray(data.seasons)
  ? data.seasons
      .map((season) => ({
        seasonNumber: Number(season?.season_number || 0) || 0,
        episodeCount: Number(season?.episode_count || 0) || 0
      }))
      .filter((season) => season.seasonNumber > 0 && season.episodeCount > 0)
      .sort((a, b) => a.seasonNumber - b.seasonNumber)
  : [];

  const totalEpisodesFromBreakdown = seasonBreakdown.reduce(
    (sum, season) => sum + season.episodeCount,
    0
  );

  return {
    eid: `tmdb:series:${safeId}`,
    source: "tmdb",
    externalId: safeId,
    type: "serie",
    title: String(data.name || data.original_name || "").trim(),
    originalTitle: String(data.original_name || "").trim(),
    releaseDate: String(data.first_air_date || "").trim(),
    summary: String(data.overview || "").trim(),
    description: String(data.overview || "").trim(),
    cover: _posterUrl(data.poster_path),
    backdrop: _backdropUrl(data.backdrop_path),
    genres: Array.isArray(data.genres) ? data.genres.map((g) => g.name).filter(Boolean) : [],
    runtime: Array.isArray(data.episode_run_time) && data.episode_run_time.length > 0
      ? Number(data.episode_run_time[0] || 0) || null
      : null,
    rating: Number(data.vote_average || 0) || null,
    ratingCount: Number(data.vote_count || 0) || 0,
    statusLabel: String(data.status || "").trim(),
    seasons: seasonBreakdown.length || (Number(data.number_of_seasons || 0) || 0),
    episodes: totalEpisodesFromBreakdown || (Number(data.number_of_episodes || 0) || 0),
    meta: {
      year: _yearFromDate(data.first_air_date),
      totalSeasons: seasonBreakdown.length || (Number(data.number_of_seasons || 0) || 0),
      totalEpisodes: totalEpisodesFromBreakdown || (Number(data.number_of_episodes || 0) || 0),
      seasonBreakdown
    }
  };
}