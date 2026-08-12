const OPEN_LIBRARY_BASE_URL = "https://openlibrary.org";
const OPEN_LIBRARY_USER_AGENT = "Quacker (hello@quacker.es)";
const OPEN_LIBRARY_SEARCH_CACHE_TTL_MS = 5 * 60 * 1000;
const OPEN_LIBRARY_REQUEST_TIMEOUT_MS = 5000;

const OPEN_LIBRARY_SEARCH_FIELDS = [
  "key",
  "title",
  "subtitle",
  "author_name",
  "first_publish_year",
  "cover_i",
  "number_of_pages_median",
  "ratings_average",
  "ratings_count",
  "first_sentence",
  "subject",
  "editions",
  "editions.key",
  "editions.title",
  "editions.language",
  "editions.number_of_pages",
  "editions.publish_date",
  "editions.cover_i"
].join(",");

const searchCache = new Map();

const OPEN_LIBRARY_NON_SEARCH_TOKENS = new Set([
  "a",
  "an",
  "and",
  "at",
  "by",
  "for",
  "from",
  "in",
  "not",
  "of",
  "on",
  "or",
  "the",
  "to",
  "with",
  "el",
  "la",
  "los",
  "las",
  "y",
  "e",
  "o",
  "u",
  "de",
  "del",
  "en",
  "por",
  "para",
  "con",
  "un",
  "una",
  "unos",
  "unas",
  "book",
  "books",
  "libro",
  "libros",
  "novel",
  "novela",
  "novelas"
]);

function _normalizeText(value) {
  return String(value || "").trim();
}

function _normalizeDescription(value) {
  if (typeof value === "string") {
    return value.trim();
  }

  if (value && typeof value === "object") {
    return String(value.value || "").trim();
  }

  if (Array.isArray(value)) {
    return value.map((entry) => String(entry || "").trim()).filter(Boolean).join(" ");
  }

  return "";
}

function _yearFromDate(value) {
  const raw = _normalizeText(value);
  if (!raw) return null;

  const match = raw.match(/\b(\d{4})\b/);
  if (!match) return null;

  const year = Number(match[1]);
  return Number.isFinite(year) ? year : null;
}

function _normalizeOpenLibraryId(value, prefix) {
  const raw = _normalizeText(value);
  if (!raw) return "";

  return raw
    .replace(new RegExp(`^/${prefix}/`, "i"), "")
    .replace(/\.json$/i, "")
    .trim();
}

function _openLibraryCover(coverId) {
  const safeCoverId = Number(coverId || 0);

  if (!Number.isFinite(safeCoverId) || safeCoverId <= 0) {
    return "";
  }

  return `https://covers.openlibrary.org/b/id/${safeCoverId}-L.jpg`;
}

function _getEditionDocuments(work = {}) {
  return Array.isArray(work?.editions?.docs)
    ? work.editions.docs.filter((edition) => edition && typeof edition === "object")
    : [];
}

function _selectEdition(work = {}) {
  const editions = _getEditionDocuments(work);

  if (editions.length === 0) {
    return null;
  }

  const spanishEdition = editions.find((edition) => {
    const languages = Array.isArray(edition?.language)
      ? edition.language.map((language) => _normalizeText(language).toLowerCase())
      : [];

    return languages.includes("spa");
  });

  return spanishEdition || editions[0];
}

function _normalizeAuthors(work = {}) {
  return Array.isArray(work?.author_name)
    ? work.author_name
        .map((author) => _normalizeText(author))
        .filter(Boolean)
    : [];
}

function _baseSearchItemFromWork(work = {}) {
  const edition = _selectEdition(work);

  if (!edition) {
    return null;
  }

  const externalId = _normalizeOpenLibraryId(edition.key, "books");

  if (!externalId) {
    return null;
  }

  const authors = _normalizeAuthors(work);
  const releaseDate =
    Array.isArray(edition?.publish_date) && edition.publish_date.length > 0
      ? _normalizeText(edition.publish_date[0])
      : _normalizeText(work.first_publish_year);

  const coverId =
    Number(edition?.cover_i || 0) ||
    Number(work?.cover_i || 0) ||
    0;

  const totalPages =
    Number(edition?.number_of_pages || 0) ||
    Number(work?.number_of_pages_median || 0) ||
    null;

  const title =
    _normalizeText(edition?.title) ||
    _normalizeText(work?.title);

  const summary =
    _normalizeDescription(work?.first_sentence) ||
    _normalizeText(work?.subtitle);

  return {
    eid: `open_library:book:${externalId}`,
    source: "open_library",
    externalId,
    type: "book",
    title,
    releaseDate,
    summary,
    cover: _openLibraryCover(coverId),
    meta: {
      year:
        _yearFromDate(releaseDate) ||
        Number(work?.first_publish_year || 0) ||
        null,
      author: authors.join(", "),
      totalPages,
      rating: Number(work?.ratings_average || 0) || null,
      ratingCount: Number(work?.ratings_count || 0) || 0,
      workId: _normalizeOpenLibraryId(work?.key, "works")
    }
  };
}

async function _openLibraryGet(path, params = {}, options = {}) {
  const url = new URL(`${OPEN_LIBRARY_BASE_URL}${path}`);

  for (const [key, value] of Object.entries(params)) {
    if (value == null || value === "") continue;
    url.searchParams.set(key, String(value));
  }

  const maxAttempts = 2;
  const retryableStatuses = new Set([429, 500, 502, 503, 504]);
const requestedTimeout = Number(options?.timeoutMs);

const timeoutMs =
  Number.isFinite(requestedTimeout) && requestedTimeout > 0
    ? requestedTimeout
    : OPEN_LIBRARY_REQUEST_TIMEOUT_MS;

const signal = AbortSignal.timeout(timeoutMs);

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    let response;

    try {
      response = await fetch(url, {
        method: "GET",
        headers: {
          Accept: "application/json",
          "User-Agent": OPEN_LIBRARY_USER_AGENT
        },
        signal
      });
    } catch (error) {
      if (
        signal.aborted &&
        signal.reason?.name === "TimeoutError"
      ) {
        const timeoutError = new Error(
          "open_library_request_timeout"
        );

        timeoutError.status = 504;
        throw timeoutError;
      }

      throw error;
    }

    if (response.ok) {
      return response.json();
    }

    const bodyText = await response.text().catch(() => "");
    const shouldRetry =
      retryableStatuses.has(response.status) &&
      attempt < maxAttempts;

    if (shouldRetry) {
      await new Promise((resolve) => setTimeout(resolve, 500));
      continue;
    }

    const error = new Error(
      `open_library_request_failed:${response.status}:${bodyText}`
    );

    error.status = response.status;
    throw error;
  }

  return null;
}

async function _searchOpenLibrary(params = {}, options = {}) {
  const cacheKey = JSON.stringify(params);
  const cached = searchCache.get(cacheKey);

  if (
    cached &&
    Date.now() - cached.createdAt < OPEN_LIBRARY_SEARCH_CACHE_TTL_MS
  ) {
    return cached.data;
  }

const data = await _openLibraryGet(
  "/search.json",
  {
    ...params,
    fields: OPEN_LIBRARY_SEARCH_FIELDS
  },
  options
);

  searchCache.set(cacheKey, {
    createdAt: Date.now(),
    data
  });

  return data;
}

export async function searchOpenLibrary(query, options = {}) {
  const q = _normalizeText(query);

  if (!q) {
    return [];
  }

  const normalizedQuery = q.toLowerCase();

  const queryTokens = normalizedQuery
    .split(/\s+/)
    .map((token) => token.replace(/[^\p{L}\p{N}]+/gu, ""))
    .filter(Boolean)
    .filter((token) => !OPEN_LIBRARY_NON_SEARCH_TOKENS.has(token));

  const hasSearchableToken = queryTokens.some(
    (token) => token.length >= 3
  );

  if (!hasSearchableToken) {
    return [];
  }

  let data;

  try {
data = await _searchOpenLibrary(
  {
    q,
    lang: "es",
    limit: 40
  },
  options
);
  } catch (error) {
    const message = String(error?.message || "");

    const isExpectedQueryValidation =
      error?.status === 422 &&
      /query too short|queries are not allowed/i.test(message);

    if (isExpectedQueryValidation) {
      return [];
    }

    throw error;
  }

  const works = Array.isArray(data?.docs) ? data.docs : [];

  return works
    .map(_baseSearchItemFromWork)
    .filter(Boolean)
    .filter((item) => {
      if (!item.externalId || !item.title) {
        return false;
      }

      const title = _normalizeText(item.title).toLowerCase();
      const author = _normalizeText(item?.meta?.author).toLowerCase();
      const summary = _normalizeText(item.summary).toLowerCase();
      const searchableText = `${title} ${author} ${summary}`.trim();

      const strongMatch =
        queryTokens.length === 0 ||
        title === normalizedQuery ||
        title.startsWith(normalizedQuery) ||
        queryTokens.every((token) => searchableText.includes(token));

      const hasMinimumMetadata = Boolean(
        item.cover ||
        author ||
        item.releaseDate ||
        item.summary ||
        item?.meta?.totalPages
      );

      return strongMatch && hasMinimumMetadata;
    })
    .slice(0, 20);
}

export async function getWeeklyFeaturedOpenLibrary(limit = 3) {
  const maxItems =
    Number.isFinite(Number(limit)) && Number(limit) > 0
      ? Number(limit)
      : 3;

  const requestLimit = Math.max(maxItems * 5, 15);

  const requests = [
    {
      q: "subject:fiction",
      lang: "es",
      sort: "new",
      limit: requestLimit
    },
    {
      q: "subject:fiction",
      lang: "es",
      limit: requestLimit
    },
    {
      q: "literature",
      lang: "es",
      limit: requestLimit
    }
  ];

  let lastError = null;

  for (const params of requests) {
    try {
      const data = await _searchOpenLibrary(params);
      const works = Array.isArray(data?.docs) ? data.docs : [];

      const seen = new Set();

      const items = works
        .map(_baseSearchItemFromWork)
        .filter(Boolean)
        .filter((item) => {
          if (!item.externalId || !item.title) {
            return false;
          }

          if (seen.has(item.externalId)) {
            return false;
          }

          seen.add(item.externalId);

          return Boolean(
            item.cover ||
            item.releaseDate ||
            item.summary ||
            item?.meta?.author
          );
        })
        .sort((a, b) =>
          String(b.releaseDate || "").localeCompare(
            String(a.releaseDate || "")
          )
        );

      if (items.length > 0) {
        return items.slice(0, maxItems);
      }
    } catch (error) {
      lastError = error;
    }
  }

  if (lastError) {
    throw lastError;
  }

  return [];
}

export async function getOpenLibraryBookDetail(externalId) {
  const safeId = _normalizeOpenLibraryId(externalId, "books");

  if (!safeId) {
    const error = new Error("missing_external_id");
    error.status = 400;
    throw error;
  }

  const edition = await _openLibraryGet(
    `/books/${encodeURIComponent(safeId)}.json`
  );

  const workKey =
    Array.isArray(edition?.works) && edition.works.length > 0
      ? _normalizeText(edition.works[0]?.key)
      : "";

  let work = null;

  if (workKey) {
    await new Promise((resolve) => setTimeout(resolve, 350));
    work = await _openLibraryGet(`${workKey}.json`);
  }

  const title =
    _normalizeText(edition?.title) ||
    _normalizeText(work?.title);

  const description =
    _normalizeDescription(work?.description) ||
    _normalizeDescription(edition?.description);

  const coverId =
    Array.isArray(edition?.covers) && edition.covers.length > 0
      ? Number(edition.covers[0] || 0)
      : 0;

  const author =
    _normalizeText(edition?.by_statement);

  const subjects = Array.isArray(work?.subjects)
    ? work.subjects
        .map((subject) => _normalizeText(subject))
        .filter(Boolean)
    : [];

  const releaseDate = _normalizeText(edition?.publish_date);

  return {
    eid: `open_library:book:${safeId}`,
    source: "open_library",
    externalId: safeId,
    type: "book",
    title,
    originalTitle: title,
    releaseDate,
    summary: description,
    description,
    cover: _openLibraryCover(coverId),
    backdrop: "",
    genres: subjects,
    runtime: null,
    rating: null,
    ratingCount: 0,
    statusLabel: "",
    seasons: null,
    episodes: null,
    meta: {
      year: _yearFromDate(releaseDate),
      author,
      totalPages: Number(edition?.number_of_pages || 0) || null,
      workId: _normalizeOpenLibraryId(workKey, "works")
    }
  };
}
