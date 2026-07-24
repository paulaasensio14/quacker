const ALLOWED_TYPES = new Set([
  "pelicula",
  "serie",
  "game",
  "book"
]);

const ALLOWED_SOURCE_TYPE_PAIRS = new Set([
  "tmdb::pelicula",
  "tmdb::serie",
  "rawg::game",
  "open_library::book",
  "manual::pelicula",
  "manual::serie",
  "manual::game",
  "manual::book"
]);

function normalizeText(value) {
  return String(value ?? "").trim();
}

function normalizeSource(value) {
  const source = normalizeText(value).toLowerCase();

  if (source === "openlibrary") {
    return "open_library";
  }

  return source;
}

function normalizeType(value) {
  const type = normalizeText(value).toLowerCase();

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

function normalizePositiveIntegerId(value) {
  const raw = normalizeText(value);

  if (!raw) {
    return "";
  }

  if (!/^\d+$/.test(raw)) {
    return "";
  }

  const normalized = raw.replace(/^0+(?=\d)/, "");

  if (!normalized || normalized === "0") {
    return "";
  }

  return normalized;
}

function normalizeTmdbExternalId(value, expectedType) {
  const raw = normalizeText(value);

  if (!raw) {
    return {
      externalId: "",
      error: "missing_external_id"
    };
  }

  const prefixedMatch = raw.match(
    /^tmdb:(movie|film|tv|series|serie):(\d+)$/i
  );

  if (prefixedMatch) {
    const prefixType = normalizeType(prefixedMatch[1]);

    if (prefixType !== expectedType) {
      return {
        externalId: "",
        error: "identity_type_conflict"
      };
    }

    const externalId = normalizePositiveIntegerId(
      prefixedMatch[2]
    );

    return externalId
      ? { externalId, error: "" }
      : { externalId: "", error: "invalid_external_id" };
  }

  const externalId = normalizePositiveIntegerId(raw);

  return externalId
    ? { externalId, error: "" }
    : { externalId: "", error: "invalid_external_id" };
}

function normalizeRawgExternalId(value) {
  const raw = normalizeText(value).replace(/^rawg:/i, "");
  const externalId = normalizePositiveIntegerId(raw);

  return externalId
    ? { externalId, error: "" }
    : {
        externalId: "",
        error: raw
          ? "invalid_external_id"
          : "missing_external_id"
      };
}

function normalizeOpenLibraryEditionId(value) {
  const raw = normalizeText(value)
    .replace(/^https?:\/\/openlibrary\.org/i, "")
    .replace(/^\/books\//i, "")
    .toUpperCase();

  if (!raw) {
    return {
      externalId: "",
      error: "missing_external_id"
    };
  }

  if (!/^OL[A-Z0-9]+M$/.test(raw)) {
    return {
      externalId: "",
      error: "invalid_open_library_edition"
    };
  }

  return {
    externalId: raw,
    error: ""
  };
}

function normalizeManualExternalId(value) {
  const raw = normalizeText(value).toLowerCase();

  if (!raw) {
    return {
      externalId: "",
      error: "missing_external_id"
    };
  }

  const uuidPattern =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

  if (!uuidPattern.test(raw)) {
    return {
      externalId: "",
      error: "invalid_manual_uuid"
    };
  }

  return {
    externalId: raw,
    error: ""
  };
}

function normalizeExternalId(source, type, value) {
  if (source === "tmdb") {
    return normalizeTmdbExternalId(value, type);
  }

  if (source === "rawg") {
    return normalizeRawgExternalId(value);
  }

  if (source === "open_library") {
    return normalizeOpenLibraryEditionId(value);
  }

  if (source === "manual") {
    return normalizeManualExternalId(value);
  }

  return {
    externalId: "",
    error: "invalid_source"
  };
}

export function normalizeOpenLibraryWorkId(value) {
  const raw = normalizeText(value)
    .replace(/^https?:\/\/openlibrary\.org/i, "")
    .replace(/^\/works\//i, "")
    .toUpperCase();

  if (!raw) {
    return "";
  }

  return /^OL[A-Z0-9]+W$/.test(raw) ? raw : "";
}

export function normalizeContentIdentity(input = {}) {
  const source = normalizeSource(input.source);
  const type = normalizeType(input.type);

  if (!source) {
    return {
      ok: false,
      error: "missing_source",
      source: "",
      type,
      externalId: "",
      key: ""
    };
  }

  if (!type) {
    return {
      ok: false,
      error: "missing_type",
      source,
      type: "",
      externalId: "",
      key: ""
    };
  }

  if (!ALLOWED_TYPES.has(type)) {
    return {
      ok: false,
      error: "invalid_type",
      source,
      type,
      externalId: "",
      key: ""
    };
  }

  if (source === "google_books") {
    return {
      ok: false,
      error: "retired_source",
      source,
      type,
      externalId: "",
      key: ""
    };
  }

  const pair = `${source}::${type}`;

  if (!ALLOWED_SOURCE_TYPE_PAIRS.has(pair)) {
    return {
      ok: false,
      error: "invalid_source_type",
      source,
      type,
      externalId: "",
      key: ""
    };
  }

  const normalizedExternalId = normalizeExternalId(
    source,
    type,
    input.externalId
  );

  if (normalizedExternalId.error) {
    return {
      ok: false,
      error: normalizedExternalId.error,
      source,
      type,
      externalId: "",
      key: ""
    };
  }

  const externalId = normalizedExternalId.externalId;
  const key = `${source}::${type}::${externalId}`;

  return {
    ok: true,
    error: "",
    source,
    type,
    externalId,
    key
  };
}

export function getCanonicalContentKey(input = {}) {
  const identity = normalizeContentIdentity(input);
  return identity.ok ? identity.key : "";
}

export function sameContentIdentity(a, b) {
  const aKey = getCanonicalContentKey(a);
  const bKey = getCanonicalContentKey(b);

  return Boolean(aKey && bKey && aKey === bKey);
}
