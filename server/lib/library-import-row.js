function _normalizeText(value) {
  return String(value ?? "").trim();
}

function _normalizeType(value) {
  const raw = _normalizeText(value).toLowerCase();

  const aliases = {
    movie: "pelicula",
    film: "pelicula",
    tv: "serie",
    series: "serie"
  };

  return aliases[raw] || raw;
}

function _normalizeOptionalNumber(value) {
  const raw = _normalizeText(value);

  if (!raw) {
    return null;
  }

  const number = Number(raw);

  return Number.isFinite(number)
    ? number
    : Number.NaN;
}

export function normalizeLibraryImportRow(row = {}) {
  return {
    title: _normalizeText(row.title),
    type: _normalizeType(row.type),
    year: _normalizeOptionalNumber(row.year),
    status: _normalizeText(row.status).toLowerCase(),
    progress: _normalizeOptionalNumber(row.progress),
    author: _normalizeText(row.author),
    source: _normalizeText(row.source).toLowerCase(),
    externalId: _normalizeText(row.externalId)
  };
}

export function validateLibraryImportRow(row = {}) {
  const errors = [];

  const title = _normalizeText(row.title);
  const type = _normalizeType(row.type);
  const status = _normalizeText(row.status).toLowerCase();

  const allowedTypes = new Set([
    "serie",
    "pelicula",
    "book",
    "game"
  ]);

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
    errors.push("missing_title");
  } else if (title.length < 2) {
    errors.push("title_too_short");
  } else if (title.length > 120) {
    errors.push("title_too_long");
  }

  if (!allowedTypes.has(type)) {
    errors.push("invalid_type");
  }

  if (
    row.year != null &&
    (
      !Number.isInteger(Number(row.year)) ||
      Number(row.year) <= 0
    )
  ) {
    errors.push("invalid_year");
  }

  if (
    status &&
    !allowedStatuses.has(status)
  ) {
    errors.push("invalid_status");
  }

  if (
    row.progress != null &&
    (
      !Number.isFinite(Number(row.progress)) ||
      Number(row.progress) < 0 ||
      Number(row.progress) > 100
    )
  ) {
    errors.push("invalid_progress");
  }

  return errors;
}
