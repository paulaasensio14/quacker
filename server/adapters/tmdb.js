const TMDB_BASE_URL = "https://api.themoviedb.org/3";
const TMDB_IMAGE_BASE = "https://image.tmdb.org/t/p/w500";
const TMDB_BACKDROP_BASE = "https://image.tmdb.org/t/p/w1280";
const TMDB_STILL_BASE = "https://image.tmdb.org/t/p/w780";

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

  console.log("[TMDB] REQUEST:", url.toString());

  const res = await fetch(url, {
    method: "GET",
    headers: _tmdbHeaders()
  });

  console.log("[TMDB] STATUS:", res.status);

  if (!res.ok) {
    const bodyText = await res.text().catch(() => "");
    console.error("[TMDB] ERROR BODY:", bodyText);

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

function _stillUrl(path) {
  return path ? `${TMDB_STILL_BASE}${path}` : "";
}

function _yearFromDate(dateStr) {
  const raw = String(dateStr || "").trim();
  if (!raw) return null;
  const year = Number(raw.slice(0, 4));
  return Number.isFinite(year) ? year : null;
}

function _profileUrl(path) {
  return path ? `${TMDB_IMAGE_BASE}${path}` : "";
}

function _mapTmdbCast(castEntries = [], limit = 8) {
  return (Array.isArray(castEntries) ? castEntries : [])
    .map((entry) => {
      const character =
        String(entry?.character || "").trim() ||
        String(entry?.roles?.[0]?.character || "").trim();

      return {
        id: String(entry?.id || entry?.credit_id || "").trim(),
        name: String(entry?.name || entry?.original_name || "").trim(),
        character,
        profile: _profileUrl(entry?.profile_path)
      };
    })
    .filter((entry) => entry.name)
    .slice(0, limit);
}

function _mapTmdbSeasonEpisodes(episodes = []) {
  return (Array.isArray(episodes) ? episodes : [])
    .map((episode) => ({
      id: String(episode?.id || "").trim(),
      episodeNumber: Number(episode?.episode_number || 0) || 0,
      name: String(episode?.name || "").trim(),
      airDate: String(episode?.air_date || "").trim(),
      runtime: Number(episode?.runtime || 0) || null,
      summary: String(episode?.overview || "").trim(),
      still: _stillUrl(episode?.still_path)
    }))
    .filter((episode) => episode.episodeNumber > 0)
    .sort((a, b) => a.episodeNumber - b.episodeNumber);
}

function _pickTmdbBackdrop(data) {
  const primaryPath = String(data?.backdrop_path || "").trim();
  const candidates = Array.isArray(data?.images?.backdrops)
    ? data.images.backdrops
    : [];

  const normalizedCandidates = candidates
    .map((entry) => ({
      path: String(entry?.file_path || "").trim(),
      locale: String(entry?.iso_639_1 || "").trim().toLowerCase(),
      voteAverage: Number(entry?.vote_average || 0) || 0,
      voteCount: Number(entry?.vote_count || 0) || 0,
      width: Number(entry?.width || 0) || 0,
      height: Number(entry?.height || 0) || 0
    }))
    .filter((entry) => entry.path && entry.width >= entry.height);

  if (normalizedCandidates.length === 0) {
    return _backdropUrl(primaryPath);
  }

  const localeScore = (locale) => {
    if (locale === "es") return 4;
    if (!locale) return 3;
    if (locale === "en") return 2;
    return 1;
  };

  normalizedCandidates.sort((a, b) => {
    const localeDiff = localeScore(b.locale) - localeScore(a.locale);
    if (localeDiff !== 0) return localeDiff;

    const voteAverageDiff = b.voteAverage - a.voteAverage;
    if (voteAverageDiff !== 0) return voteAverageDiff;

    const voteCountDiff = b.voteCount - a.voteCount;
    if (voteCountDiff !== 0) return voteCountDiff;

    return b.width - a.width;
  });

  return _backdropUrl(normalizedCandidates[0]?.path || primaryPath);
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
      year: _yearFromDate(item.release_date),
      popularity: Number(item.popularity || 0) || 0,
      rating: Number(item.vote_average || 0) || null,
      ratingCount: Number(item.vote_count || 0) || 0
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
      year: _yearFromDate(item.first_air_date),
      popularity: Number(item.popularity || 0) || 0,
      rating: Number(item.vote_average || 0) || null,
      ratingCount: Number(item.vote_count || 0) || 0
    }
  };
}

function _normalizeTmdbSearchText(value) {
  return String(value || "").trim().toLowerCase();
}

function _tokenizeTmdbSearchText(value) {
  return _normalizeTmdbSearchText(value).split(/\s+/).filter(Boolean);
}

function _scoreTmdbSearchItem(item, query) {
  const q = _normalizeTmdbSearchText(query);
  if (!q) return 0;

  const title = _normalizeTmdbSearchText(item?.title);
  const summary = _normalizeTmdbSearchText(item?.summary);
  const tokens = _tokenizeTmdbSearchText(q);

  let score = 0;

  if (title === q) {
    score += 120;
  } else if (title.startsWith(q)) {
    score += 70;
  } else if (title.includes(q)) {
    score += 40;
  }

  for (const token of tokens) {
    if (title.includes(token)) score += 12;
    if (summary.includes(token)) score += 2;
  }

  if (item?.cover) score += 6;
  if (item?.summary) score += 3;

  return score;
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
    .map((item) => ({
      ...item,
      __score: _scoreTmdbSearchItem(item, q)
    }))
    .filter((item) => item.__score > 0)
    .sort((a, b) => {
      if (b.__score !== a.__score) return b.__score - a.__score;
      const hasCoverA = Number(Boolean(a.cover));
      const hasCoverB = Number(Boolean(b.cover));
      if (hasCoverA !== hasCoverB) return hasCoverB - hasCoverA;
      const yearA = Number(a.meta?.year || 0);
      const yearB = Number(b.meta?.year || 0);
      if (yearA !== yearB) return yearB - yearA;
      return a.title.localeCompare(b.title, "es", { sensitivity: "base" });
    })
    .map(({ __score, ...item }) => item);

  return merged.slice(0, 40);
}

export async function getWeeklyTrendingTmdb() {

 const [moviesData, tvData] = await Promise.all([

 _tmdbGet("/trending/movie/week", {

 language: "es-ES",

 page: 1

 }),

 _tmdbGet("/trending/tv/week", {

 language: "es-ES",

 page: 1

 })

 ]);

 const movies = Array.isArray(moviesData?.results)

 ? moviesData.results

 .map(_baseSearchItemFromMovie)

 .filter((item) => item.title && item.cover)

 .slice(0, 3)

 : [];

 const series = Array.isArray(tvData?.results)

 ? tvData.results
 .map(_baseSearchItemFromTv)

 .filter((item) => item.title && item.cover)

 .slice(0, 3)

 : [];

 return { movies, series };

}

export async function getWeeklyTrendingTmdbByType(type, limit = 3) {
 const safeType = String(type || "").trim().toLowerCase();
 const maxItems =
 Number.isFinite(Number(limit)) && Number(limit) > 0 ? Number(limit) : 3;

 if (safeType === "pelicula") {
 const data = await _tmdbGet("/trending/movie/week", {
 language: "es-ES",
 page: 1
 });

 return Array.isArray(data?.results)
 ? data.results
 .map(_baseSearchItemFromMovie)
 .filter((item) => item.title && item.cover)
 .slice(0, maxItems)
 : [];
 }

 if (safeType === "serie") {
 const data = await _tmdbGet("/trending/tv/week", {
 language: "es-ES",
 page: 1
 });

 return Array.isArray(data?.results)
 ? data.results
 .map(_baseSearchItemFromTv)
 .filter((item) => item.title && item.cover)
 .slice(0, maxItems)
 : [];
 }

 const err = new Error("invalid_tmdb_weekly_type");
 err.status = 400;
 throw err;
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
      language: "es-ES",
      append_to_response: "credits,images",
      include_image_language: "es,en,null"
    });

    return {
      eid: `tmdb:movie:${safeId}`,
      source: "tmdb",
      externalId: safeId,
      type: "pelicula",
      title: String(data.title || data.original_title || "").trim(),
      originalTitle: String(data.original_title || "").trim(),
      releaseDate: String(data.release_date || "").trim(),
      summary: String(data.overview || "").trim(),
      description: String(data.overview || "").trim(),
      cover: _posterUrl(data.poster_path),
      backdrop: _pickTmdbBackdrop(data),
      genres: Array.isArray(data.genres) ? data.genres.map((g) => g.name).filter(Boolean) : [],
      runtime: Number(data.runtime || 0) || null,
      rating: Number(data.vote_average || 0) || null,
      ratingCount: Number(data.vote_count || 0) || 0,
      statusLabel: String(data.status || "").trim(),
      cast: _mapTmdbCast(data?.credits?.cast || []),
      meta: {
        year: _yearFromDate(data.release_date)
      }
    };
  }

  const data = await _tmdbGet(`/tv/${encodeURIComponent(safeId)}`, {
    language: "es-ES",
    append_to_response: "aggregate_credits,images",
    include_image_language: "es,en,null"
  });

const seasonBreakdown = Array.isArray(data.seasons)
  ? data.seasons
      .map((season) => ({
        seasonNumber: Number(season?.season_number || 0) || 0,
        episodeCount: Number(season?.episode_count || 0) || 0,
        name: String(season?.name || "").trim(),
        airDate: String(season?.air_date || "").trim(),
        poster: _posterUrl(season?.poster_path)
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
    backdrop: _pickTmdbBackdrop(data),
    genres: Array.isArray(data.genres) ? data.genres.map((g) => g.name).filter(Boolean) : [],
    runtime: Array.isArray(data.episode_run_time) && data.episode_run_time.length > 0
      ? Number(data.episode_run_time[0] || 0) || null
      : null,
    rating: Number(data.vote_average || 0) || null,
    ratingCount: Number(data.vote_count || 0) || 0,
    statusLabel: String(data.status || "").trim(),
    cast: _mapTmdbCast(data?.aggregate_credits?.cast || []),
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

export async function getTmdbSeasonDetail({ externalId, seasonNumber }) {
  const safeId = String(externalId || "").trim();
  const safeSeasonNumber = Math.max(1, Number(seasonNumber || 0) || 0);

  if (!safeId) {
    const err = new Error("missing_tmdb_external_id");
    err.status = 400;
    throw err;
  }

  if (!safeSeasonNumber) {
    const err = new Error("invalid_tmdb_season_number");
    err.status = 400;
    throw err;
  }

  const data = await _tmdbGet(
    `/tv/${encodeURIComponent(safeId)}/season/${encodeURIComponent(safeSeasonNumber)}`,
    { language: "es-ES" }
  );

  return {
    seasonNumber: Number(data?.season_number || safeSeasonNumber) || safeSeasonNumber,
    name: String(data?.name || "").trim(),
    airDate: String(data?.air_date || "").trim(),
    summary: String(data?.overview || "").trim(),
    poster: _posterUrl(data?.poster_path),
    episodes: _mapTmdbSeasonEpisodes(data?.episodes || [])
  };
}
