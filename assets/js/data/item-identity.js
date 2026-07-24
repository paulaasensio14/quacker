const ALLOWED_IDENTITY_TYPES = new Set([
  "pelicula",
  "serie",
  "game",
  "book"
]);

const ALLOWED_IDENTITY_PAIRS = new Set([
  "tmdb::pelicula",
  "tmdb::serie",
  "rawg::game",
  "open_library::book",
  "manual::pelicula",
  "manual::serie",
  "manual::game",
  "manual::book"
]);

function normalizeIdentityId(value) {
  return String(value ?? "").trim();
}

function normalizeIdentitySource(value) {
  const source = String(value ?? "").trim().toLowerCase();

  return source === "openlibrary"
    ? "open_library"
    : source;
}

function normalizeIdentityType(value) {
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

function normalizePositiveIdentityId(value) {
  const raw = String(value ?? "").trim();

  if (!raw || !/^\d+$/.test(raw)) {
    return "";
  }

  const normalized = raw.replace(/^0+(?=\d)/, "");

  return normalized && normalized !== "0"
    ? normalized
    : "";
}

function normalizeContentIdentity(item = {}) {
  const source = normalizeIdentitySource(item.source);
  const type = normalizeIdentityType(item.type);
  const rawExternalId = String(item.externalId ?? "").trim();

  const invalid = (error) => ({
    ok: false,
    error,
    source,
    type,
    externalId: "",
    key: ""
  });

  if (!source) return invalid("missing_source");
  if (!type) return invalid("missing_type");

  if (!ALLOWED_IDENTITY_TYPES.has(type)) {
    return invalid("invalid_type");
  }

  if (source === "google_books") {
    return invalid("retired_source");
  }

  if (!ALLOWED_IDENTITY_PAIRS.has(`${source}::${type}`)) {
    return invalid("invalid_source_type");
  }

  let externalId = "";

  if (source === "tmdb") {
    const prefixedMatch = rawExternalId.match(
      /^tmdb:(movie|film|tv|series|serie):(\d+)$/i
    );

    if (prefixedMatch) {
      const prefixedType = normalizeIdentityType(prefixedMatch[1]);

      if (prefixedType !== type) {
        return invalid("identity_type_conflict");
      }

      externalId = normalizePositiveIdentityId(prefixedMatch[2]);
    } else {
      externalId = normalizePositiveIdentityId(rawExternalId);
    }
  } else if (source === "rawg") {
    externalId = normalizePositiveIdentityId(
      rawExternalId.replace(/^rawg:/i, "")
    );
  } else if (source === "open_library") {
    externalId = rawExternalId
      .replace(/^https?:\/\/openlibrary\.org/i, "")
      .replace(/^\/books\//i, "")
      .toUpperCase();

    if (!/^OL[A-Z0-9]+M$/.test(externalId)) {
      return invalid(
        externalId
          ? "invalid_open_library_edition"
          : "missing_external_id"
      );
    }
  } else if (source === "manual") {
    externalId = rawExternalId.toLowerCase();

    const uuidPattern =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

    if (!uuidPattern.test(externalId)) {
      return invalid(
        externalId
          ? "invalid_manual_uuid"
          : "missing_external_id"
      );
    }
  }

  if (!externalId) {
    return invalid(
      rawExternalId
        ? "invalid_external_id"
        : "missing_external_id"
    );
  }

  return {
    ok: true,
    error: "",
    source,
    type,
    externalId,
    key: `${source}::${type}::${externalId}`
  };
}

function getLibraryItemId(item) {
  if (!item) return "";

  if (item.__libraryItemId) {
    return normalizeIdentityId(item.__libraryItemId);
  }

  if (item.id && item.__fromLibrary) {
    return normalizeIdentityId(item.id);
  }

  return "";
}

function getCanonicalContentKey(item) {
  const identity = normalizeContentIdentity(item);

  return identity.ok
    ? identity.key
    : "";
}

function getNormalizedContentKey(item) {
  if (!item) return "";

  const title = String(item.title || "")
    .trim()
    .toLowerCase();

  const type = normalizeIdentityType(item.type);

  return `${type}::${title}`;
}

function sameContentIdentity(a, b) {
  const aCanonicalKey = getCanonicalContentKey(a);
  const bCanonicalKey = getCanonicalContentKey(b);

  if (!aCanonicalKey || !bCanonicalKey) {
    return false;
  }

  return aCanonicalKey === bCanonicalKey;
}

function resolveLibraryItemIdFromCache(item, libraryCache = []) {
  const directId = getLibraryItemId(item);

  if (directId) return directId;

  const canonicalKey = getCanonicalContentKey(item);

  if (canonicalKey) {
    const canonicalMatch = (libraryCache || []).find(
      (entry) => getCanonicalContentKey(entry) === canonicalKey
    );

    if (canonicalMatch?.id) {
      return normalizeIdentityId(canonicalMatch.id);
    }
  }

  return "";
}

window.ItemIdentity = {
  normalizeContentIdentity,
  getLibraryItemId,
  getCanonicalContentKey,
  getNormalizedContentKey,
  sameContentIdentity,
  resolveLibraryItemIdFromCache
};
