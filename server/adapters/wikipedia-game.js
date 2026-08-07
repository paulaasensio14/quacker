const WIKIPEDIA_API_URL =
  "https://en.wikipedia.org/w/api.php";

const WIKIPEDIA_SUMMARY_URL =
  "https://en.wikipedia.org/api/rest_v1/page/summary";

const WIKIPEDIA_REQUEST_TIMEOUT_MS = 5000;

const WIKIPEDIA_USER_AGENT =
  "Quacker/1.0 (hello@quacker.es)";

function _safeText(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim();
}

function _normalizePageId(value) {
  const raw = _safeText(value)
    .replace(/^wikipedia_game:/i, "");

  if (!/^\d+$/.test(raw)) {
    return "";
  }

  const normalized = raw.replace(/^0+(?=\d)/, "");

  if (!normalized || normalized === "0") {
    return "";
  }

  return normalized;
}

function _normalizeForSearch(value) {
  return _safeText(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function _extractYear(...values) {
  for (const value of values) {
    const match = _safeText(value).match(
      /\b(19|20)\d{2}\b/
    );

    if (match) {
      return Number(match[0]);
    }
  }

  return null;
}

function _imageFromSummary(summary = {}) {
  return _safeText(
    summary?.thumbnail?.source ||
    summary?.originalimage?.source
  );
}

function _createTimeoutError() {
  const error = new Error(
    "wikipedia_game_request_timeout"
  );

  error.status = 504;

  return error;
}

async function _fetchJson(url, signal) {
  let response;

  try {
    response = await fetch(url, {
      headers: {
        Accept: "application/json",
        "User-Agent": WIKIPEDIA_USER_AGENT
      },
      signal
    });
  } catch (error) {
    if (
      signal?.aborted ||
      error?.name === "AbortError" ||
      error?.name === "TimeoutError"
    ) {
      throw _createTimeoutError();
    }

    throw error;
  }

  if (!response.ok) {
    const error = new Error(
      `wikipedia_game_http_${response.status}`
    );

    error.status = response.status;

    throw error;
  }

  return response.json();
}

function _buildApiUrl(params = {}) {
  const url = new URL(WIKIPEDIA_API_URL);

  for (const [key, value] of Object.entries(params)) {
    if (
      value === undefined ||
      value === null ||
      value === ""
    ) {
      continue;
    }

    url.searchParams.set(key, String(value));
  }

  return url.toString();
}

function _buildSummaryUrl(title) {
  const safeTitle = _safeText(title);

  return `${WIKIPEDIA_SUMMARY_URL}/${encodeURIComponent(
    safeTitle.replace(/\s+/g, "_")
  )}`;
}

async function _getSummaryByTitle(
  title,
  signal
) {
  return _fetchJson(
    _buildSummaryUrl(title),
    signal
  );
}

function _looksLikeVideoGame(summary = {}) {
  const title = _safeText(summary?.title);
  const description = _safeText(
    summary?.description
  ).toLowerCase();

  const extract = _safeText(
    summary?.extract
  ).toLowerCase();

  if (!title) {
    return false;
  }

  if (
    /\(series\)$/i.test(title) ||
    /\blist of\b/i.test(title)
  ) {
    return false;
  }

  const rejectedDescriptionTokens = [
    "video game series",
    "video game developer",
    "video game publisher",
    "video game company",
    "video game studio",
    "video game franchise"
  ];

  if (
    rejectedDescriptionTokens.some(
      (token) => description.includes(token)
    )
  ) {
    return false;
  }

  if (
    /\bvideo game\b/.test(description) ||
    /\bcomputer game\b/.test(description)
  ) {
    return true;
  }

  const rejectedExtractTokens = [
    "video game developer",
    "video game publisher",
    "video game company",
    "video game studio",
    "video game series"
  ];

  if (
    rejectedExtractTokens.some(
      (token) => extract.includes(token)
    )
  ) {
    return false;
  }

  return (
    /\bis an? .*?\bgame\b/.test(extract) ||
    /\bgame developed by\b/.test(extract) ||
    /\bgame published by\b/.test(extract)
  );
}

function _toExploreItem(summary = {}) {
  const externalId = _normalizePageId(
    summary?.pageid
  );

  if (!externalId) {
    return null;
  }

  const title = _safeText(summary?.title);
  const description = _safeText(
    summary?.extract
  );

  const year = _extractYear(
    summary?.description,
    description
  );

  const image = _imageFromSummary(summary);

  return {
    eid: `wikipedia_game:game:${externalId}`,
    source: "wikipedia_game",
    externalId,
    type: "game",
    title,
    originalTitle: title,
    releaseDate: year ? String(year) : "",
    summary: description,
    description,
    cover: image,
    backdrop: image,
    genres: [],
    rating: null,
    ratingCount: 0,
    statusLabel: "",
    meta: {
      year,
      wikipediaTitle: title
    }
  };
}

function _scoreSearchItem(item, query) {
  const normalizedTitle =
    _normalizeForSearch(item?.title);

  const normalizedQuery =
    _normalizeForSearch(query);

  if (!normalizedTitle || !normalizedQuery) {
    return 0;
  }

  const queryTokens = normalizedQuery
    .split(/\s+/)
    .filter(Boolean);

  let score = 0;

  if (normalizedTitle === normalizedQuery) {
    score += 100;
  } else if (
    normalizedTitle.startsWith(normalizedQuery)
  ) {
    score += 70;
  } else if (
    queryTokens.every(
      (token) => normalizedTitle.includes(token)
    )
  ) {
    score += 50;
  } else {
    return 0;
  }

  if (item?.cover) {
    score += 10;
  }

  if (item?.summary) {
    score += 5;
  }

  return score;
}

export async function searchWikipediaGames(
  query
) {
  const q = _safeText(query);

  if (!q) {
    return [];
  }

  const signal = AbortSignal.timeout(
    WIKIPEDIA_REQUEST_TIMEOUT_MS
  );

  const searchUrl = _buildApiUrl({
    action: "query",
    generator: "search",
    gsrsearch: `${q} video game`,
    gsrnamespace: 0,
    gsrlimit: 10,
    prop: "extracts",
    exintro: 1,
    explaintext: 1,
    exsentences: 3,
    format: "json",
    formatversion: 2
  });

  const data = await _fetchJson(
    searchUrl,
    signal
  );

  const pages = Array.isArray(
    data?.query?.pages
  )
    ? data.query.pages
    : [];

  const normalizedQuery =
    _normalizeForSearch(q);

  const queryTokens = normalizedQuery
    .split(/\s+/)
    .filter(Boolean);

  const candidates = [...pages]
    .sort(
      (left, right) =>
        Number(left?.index ?? 9999) -
        Number(right?.index ?? 9999)
    )
    .filter((page) => {
      const title = _normalizeForSearch(
        page?.title
      );

      if (!title) {
        return false;
      }

      return queryTokens.every(
        (token) => title.includes(token)
      );
    })
    .slice(0, 8);

  const summaryResults =
    await Promise.allSettled(
      candidates.map((page) =>
        _getSummaryByTitle(
          page.title,
          signal
        )
      )
    );

  return summaryResults
    .filter(
      (result) =>
        result.status === "fulfilled"
    )
    .map((result) => result.value)
    .filter(_looksLikeVideoGame)
    .map(_toExploreItem)
    .filter(Boolean)
    .map((item) => ({
      ...item,
      __score: _scoreSearchItem(
        item,
        q
      )
    }))
    .filter((item) => item.__score > 0)
    .sort((left, right) => {
      if (right.__score !== left.__score) {
        return right.__score - left.__score;
      }

      return String(left.title).localeCompare(
        String(right.title),
        "en",
        {
          sensitivity: "base"
        }
      );
    })
    .map(
      ({
        __score,
        ...item
      }) => item
    )
    .slice(0, 20);
}

export async function getWikipediaGameDetail(
  externalId
) {
  const safeId = _normalizePageId(
    externalId
  );

  if (!safeId) {
    const error = new Error(
      "invalid_external_id"
    );

    error.status = 400;

    throw error;
  }

  const signal = AbortSignal.timeout(
    WIKIPEDIA_REQUEST_TIMEOUT_MS
  );

  const pageData = await _fetchJson(
    _buildApiUrl({
      action: "query",
      pageids: safeId,
      prop: "info",
      format: "json",
      formatversion: 2
    }),
    signal
  );

  const page = Array.isArray(
    pageData?.query?.pages
  )
    ? pageData.query.pages[0]
    : null;

  const title = _safeText(page?.title);

  if (
    !title ||
    page?.missing === true
  ) {
    const error = new Error(
      "wikipedia_game_not_found"
    );

    error.status = 404;

    throw error;
  }

  const summary = await _getSummaryByTitle(
    title,
    signal
  );

  if (!_looksLikeVideoGame(summary)) {
    const error = new Error(
      "wikipedia_page_is_not_game"
    );

    error.status = 404;

    throw error;
  }

  const item = _toExploreItem({
    ...summary,
    pageid: safeId
  });

  if (!item) {
    const error = new Error(
      "wikipedia_game_invalid_response"
    );

    error.status = 502;

    throw error;
  }

  return item;
}
