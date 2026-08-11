const TMDB_BASE_URL = "https://api.themoviedb.org/3";
const TMDB_IMAGE_BASE = "https://image.tmdb.org/t/p/w500";
const TMDB_BACKDROP_BASE = "https://image.tmdb.org/t/p/w1280";
const TMDB_STILL_BASE = "https://image.tmdb.org/t/p/w780";
const TMDB_LOGO_BASE = "https://image.tmdb.org/t/p/w154";
const TMDB_REQUEST_TIMEOUT_MS = 5000;

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

  const signal = AbortSignal.timeout(TMDB_REQUEST_TIMEOUT_MS);

  let res;

  try {
    res = await fetch(url, {
      method: "GET",
      headers: _tmdbHeaders(),
      signal
    });
  } catch (error) {
    if (error?.name === "TimeoutError") {
      const timeoutError = new Error("tmdb_request_timeout");
      timeoutError.status = 504;
      throw timeoutError;
    }

    throw error;
  }

if (!res.ok) {
  // Consumimos la respuesta, pero no almacenamos su contenido en logs.
  await res.text().catch(() => "");

  const err = new Error(`tmdb_request_failed:${res.status}`);
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

function _logoUrl(path) {
  return path ? `${TMDB_LOGO_BASE}${path}` : "";
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

function _mapTmdbCast(castEntries = [], limit = 16) {
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

function _joinTmdbCrewNames(crewEntries = [], jobs = [], limit = 2) {
  const allowedJobs = (Array.isArray(jobs) ? jobs : [])
    .map((job) => String(job || "").trim().toLowerCase())
    .filter(Boolean);

  return (Array.isArray(crewEntries) ? crewEntries : [])
    .filter((entry) => allowedJobs.includes(String(entry?.job || "").trim().toLowerCase()))
    .map((entry) => String(entry?.name || "").trim())
    .filter(Boolean)
    .filter((name, index, arr) => arr.indexOf(name) === index)
    .slice(0, limit)
    .join(", ");
}

function _joinTmdbNamedEntries(entries = [], limit = 2) {
  return (Array.isArray(entries) ? entries : [])
    .map((entry) => String(entry?.name || "").trim())
    .filter(Boolean)
    .slice(0, limit)
    .join(", ");
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

function _extractTmdbWatchProviders(results, preferredRegions = ["ES", "US"]) {
  const safeResults = results && typeof results === "object" ? results : {};
  const bucketOrder = ["flatrate", "free", "ads", "rent", "buy"];

  const regions = Object.entries(safeResults)
    .map(([region, payload]) => ({
      region: String(region || "").trim().toUpperCase(),
      link: String(payload?.link || "").trim(),
      entries: bucketOrder.reduce((acc, bucket) => {
        acc[bucket] = Array.isArray(payload?.[bucket]) ? payload[bucket] : [];
        return acc;
      }, {})
    }))
    .filter((entry) =>
      bucketOrder.some((bucket) => Array.isArray(entry.entries[bucket]) && entry.entries[bucket].length > 0)
    );

  if (regions.length === 0) {
    return {
      region: "",
      link: "",
      services: []
    };
  }

  const preferredRegion = preferredRegions
    .map((region) => String(region || "").trim().toUpperCase())
    .map((region) => regions.find((entry) => entry.region === region))
    .find(Boolean);

  const selectedRegion =
    preferredRegion ||
    regions.find((entry) => Array.isArray(entry.entries.flatrate) && entry.entries.flatrate.length > 0) ||
    regions[0];

  const seenProviders = new Set();
  const services = [];

  for (const bucket of bucketOrder) {
    const bucketEntries = Array.isArray(selectedRegion.entries[bucket])
      ? [...selectedRegion.entries[bucket]]
      : [];

    bucketEntries
      .sort(
        (a, b) =>
          (Number(a?.display_priority || Number.MAX_SAFE_INTEGER) || Number.MAX_SAFE_INTEGER) -
          (Number(b?.display_priority || Number.MAX_SAFE_INTEGER) || Number.MAX_SAFE_INTEGER)
      )
      .forEach((entry) => {
        const providerId = String(entry?.provider_id || "").trim();
        const providerName = String(entry?.provider_name || "").trim();
        const dedupeKey = providerId || `${bucket}:${providerName}`;

        if (!providerName || !dedupeKey || seenProviders.has(dedupeKey)) return;

        seenProviders.add(dedupeKey);
        services.push({
          id: dedupeKey,
          name: providerName,
          logo: _logoUrl(entry?.logo_path),
          accessType: bucket
        });
      });
  }

  return {
    region: selectedRegion.region,
    link: selectedRegion.link,
    services: services.slice(0, 10)
  };
}

function _pickTmdbVideoUrl(results = [], preferredLocales = ["es", "", "en"]) {
  const safeResults = Array.isArray(results) ? results : [];

  const candidates = safeResults
    .map((entry) => ({
      key: String(entry?.key || "").trim(),
      site: String(entry?.site || "").trim().toLowerCase(),
      type: String(entry?.type || "").trim().toLowerCase(),
      official: !!entry?.official,
      locale: String(entry?.iso_639_1 || "").trim().toLowerCase(),
      publishedAt: String(entry?.published_at || "").trim()
    }))
    .filter((entry) => entry.key && entry.site === "youtube");

  if (candidates.length === 0) return "";

  const typeScore = (type) => {
    if (type === "trailer") return 4;
    if (type === "teaser") return 3;
    if (type === "clip") return 2;
    return 1;
  };

  const localeScore = (locale) => {
    const index = preferredLocales.indexOf(locale);
    return index === -1 ? 0 : preferredLocales.length - index;
  };

  candidates.sort((a, b) => {
    const officialDiff = Number(b.official) - Number(a.official);
    if (officialDiff !== 0) return officialDiff;

    const typeDiff = typeScore(b.type) - typeScore(a.type);
    if (typeDiff !== 0) return typeDiff;

    const localeDiff = localeScore(b.locale) - localeScore(a.locale);
    if (localeDiff !== 0) return localeDiff;

    return String(b.publishedAt).localeCompare(String(a.publishedAt));
  });

  return `https://www.youtube.com/watch?v=${encodeURIComponent(candidates[0].key)}`;
}

function _baseSearchItemFromMovie(item) {
    return {
    eid: `tmdb:movie:${String(item.id)}`,
    source: "tmdb",
    externalId: String(item.id),
    type: "pelicula",
    title: String(item.title || item.original_title || "").trim(),
    originalTitle: String(item.original_title || "").trim(),
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
    originalTitle: String(item.original_name || "").trim(),
    releaseDate: String(item.first_air_date || "").trim(),
    cover: _posterUrl(item.poster_path),
    meta: {
      year: _yearFromDate(item.first_air_date),
      popularity: Number(item.popularity || 0) || 0,
      rating: Number(item.vote_average || 0) || null,
      ratingCount: Number(item.vote_count || 0) || 0
    }
  };
}

function _extractTmdbRelatedItems(results = [], type = "pelicula", currentId = "") {
  const safeType = String(type || "").trim().toLowerCase();
  const targetId = String(currentId || "").trim();
  const mapper = safeType === "serie" ? _baseSearchItemFromTv : _baseSearchItemFromMovie;

  return (Array.isArray(results) ? results : [])
    .map((item) => mapper(item))
    .filter((item) => item.title && item.externalId && item.externalId !== targetId)
    .slice(0, 8);
}

function _normalizeTmdbSearchText(value) {
  return String(value || "").trim().toLowerCase();
}

function _tokenizeTmdbSearchText(value) {
  return _normalizeTmdbSearchText(value).split(/\s+/).filter(Boolean);
}

function _scoreTmdbTitleMatch(title, query) {
  if (!title || !query) return 0;

  if (title === query) {
    return 120;
  }

  if (title.startsWith(query)) {
    return 70;
  }

  if (title.includes(query)) {
    return 40;
  }

  return 0;
}

function _scoreTmdbSearchItem(item, query) {
  const q = _normalizeTmdbSearchText(query);
  if (!q) return 0;

  const title = _normalizeTmdbSearchText(item?.title);
  const originalTitle = _normalizeTmdbSearchText(item?.originalTitle);
  const summary = _normalizeTmdbSearchText(item?.summary);
  const tokens = _tokenizeTmdbSearchText(q);

  let score = Math.max(
    _scoreTmdbTitleMatch(title, q),
    _scoreTmdbTitleMatch(originalTitle, q)
  );

  for (const token of tokens) {
    if (title.includes(token) || originalTitle.includes(token)) {
      score += 12;
    }

    if (summary.includes(token)) {
      score += 2;
    }
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
    const [detailData, watchProvidersData, relatedData] = await Promise.allSettled([
      _tmdbGet(`/movie/${encodeURIComponent(safeId)}`, {
        language: "es-ES",
        append_to_response: "credits,images,videos",
        include_image_language: "es,en,null"
      }),
      _tmdbGet(`/movie/${encodeURIComponent(safeId)}/watch/providers`),
      _tmdbGet(`/movie/${encodeURIComponent(safeId)}/recommendations`, {
        language: "es-ES",
        page: 1
      })
    ]);

    if (detailData.status !== "fulfilled") {
      throw detailData.reason;
    }

    const data = detailData.value;
    const watchProviders =
      watchProvidersData.status === "fulfilled"
        ? _extractTmdbWatchProviders(watchProvidersData.value?.results)
        : { region: "", link: "", services: [] };
    const relatedItems =
      relatedData.status === "fulfilled"
        ? _extractTmdbRelatedItems(relatedData.value?.results, "pelicula", safeId)
        : [];

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
      relatedItems,
      meta: {
        year: _yearFromDate(data.release_date),
        director: _joinTmdbCrewNames(data?.credits?.crew, ["Director"], 2),
        writer: _joinTmdbCrewNames(data?.credits?.crew, ["Writer", "Screenplay"], 2),
        watchProviders,
        trailerUrl: _pickTmdbVideoUrl(data?.videos?.results)
      }
    };
  }

  const [detailData, watchProvidersData, relatedData] = await Promise.allSettled([
    _tmdbGet(`/tv/${encodeURIComponent(safeId)}`, {
      language: "es-ES",
      append_to_response: "aggregate_credits,images,videos",
      include_image_language: "es,en,null"
    }),
    _tmdbGet(`/tv/${encodeURIComponent(safeId)}/watch/providers`),
    _tmdbGet(`/tv/${encodeURIComponent(safeId)}/recommendations`, {
      language: "es-ES",
      page: 1
    })
  ]);

  if (detailData.status !== "fulfilled") {
    throw detailData.reason;
  }

  const data = detailData.value;
  const watchProviders =
    watchProvidersData.status === "fulfilled"
      ? _extractTmdbWatchProviders(watchProvidersData.value?.results)
      : { region: "", link: "", services: [] };
  const relatedItems =
    relatedData.status === "fulfilled"
      ? _extractTmdbRelatedItems(relatedData.value?.results, "serie", safeId)
      : [];

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
    relatedItems,
    seasons: seasonBreakdown.length || (Number(data.number_of_seasons || 0) || 0),
    episodes: totalEpisodesFromBreakdown || (Number(data.number_of_episodes || 0) || 0),
    meta: {
      year: _yearFromDate(data.first_air_date),
      creator: _joinTmdbNamedEntries(data?.created_by, 2),
      lastAirDate: String(data?.last_air_date || "").trim(),
      totalSeasons: seasonBreakdown.length || (Number(data.number_of_seasons || 0) || 0),
      totalEpisodes: totalEpisodesFromBreakdown || (Number(data.number_of_episodes || 0) || 0),
      seasonBreakdown,
      watchProviders,
      trailerUrl: _pickTmdbVideoUrl(data?.videos?.results)
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
