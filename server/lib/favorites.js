import {
  normalizeContentIdentity
} from "./content-identity.js";

export const FAVORITE_TYPES = Object.freeze([
  "pelicula",
  "serie",
  "game",
  "book"
]);

export const MAX_FAVORITES_PER_TYPE = 4;

function _normalizeDate(value) {
  const safeValue = String(value || "").trim();
  if (!safeValue) return "";

  const parsed = new Date(safeValue);
  if (Number.isNaN(parsed.getTime())) return "";

  return parsed.toISOString();
}

function _normalizeSnapshot(value) {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value)
  ) {
    return null;
  }

  const title = String(value.title || "")
    .trim()
    .slice(0, 120);

  if (!title) return null;

  return {
    title,
    cover: String(value.cover || "")
      .trim()
      .slice(0, 500)
  };
}

function _normalizeFavorite(value, expectedType) {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value)
  ) {
    return null;
  }

  const identity = normalizeContentIdentity({
    source: value.source,
    type: value.contentType,
    externalId: value.externalId
  });

  if (!identity.ok) return null;
  if (identity.type !== expectedType) return null;

  const itemSnapshot = _normalizeSnapshot(
    value.itemSnapshot
  );

  if (!itemSnapshot) return null;

  const addedAt = _normalizeDate(value.addedAt);
  if (!addedAt) return null;

  return {
    contentType: identity.type,
    source: identity.source,
    externalId: identity.externalId,
    itemSnapshot,
    addedAt
  };
}

export function normalizeFavorites(value) {
  const source =
    value &&
    typeof value === "object" &&
    !Array.isArray(value)
      ? value
      : {};

  const normalized = {
    pelicula: [],
    serie: [],
    game: [],
    book: []
  };

  for (const type of FAVORITE_TYPES) {
    const rawEntries = Array.isArray(source[type])
      ? source[type]
      : [];

    const seen = new Set();

    for (const rawEntry of rawEntries) {
      const favorite = _normalizeFavorite(
        rawEntry,
        type
      );

      if (!favorite) continue;

      const identity = normalizeContentIdentity({
        source: favorite.source,
        type: favorite.contentType,
        externalId: favorite.externalId
      });

      if (!identity.ok || seen.has(identity.key)) {
        continue;
      }

      seen.add(identity.key);
      normalized[type].push(favorite);

      if (
        normalized[type].length >=
        MAX_FAVORITES_PER_TYPE
      ) {
        break;
      }
    }
  }

  return normalized;
}

function _isFavoriteType(type) {
  return FAVORITE_TYPES.includes(
    String(type || "").trim()
  );
}

function _normalizePosition(position) {
  const numericPosition = Number(position);

  if (
    !Number.isInteger(numericPosition) ||
    numericPosition < 1 ||
    numericPosition > MAX_FAVORITES_PER_TYPE
  ) {
    return 0;
  }

  return numericPosition;
}

function _favoriteIdentityKey(favorite) {
  const identity = normalizeContentIdentity({
    source: favorite?.source,
    type: favorite?.contentType,
    externalId: favorite?.externalId
  });

  return identity.ok ? identity.key : "";
}

export function addFavorite(
  favorites,
  type,
  value
) {
  const safeType = String(type || "").trim();

  if (!_isFavoriteType(safeType)) {
    return {
      ok: false,
      error: "invalid_favorite_type"
    };
  }

  const normalizedFavorites =
    normalizeFavorites(favorites);

  const favorite = _normalizeFavorite(
    value,
    safeType
  );

  if (!favorite) {
    return {
      ok: false,
      error: "invalid_favorite"
    };
  }

  const favoriteKey =
    _favoriteIdentityKey(favorite);

  const alreadyExists =
    normalizedFavorites[safeType].some(
      (entry) =>
        _favoriteIdentityKey(entry) ===
        favoriteKey
    );

  if (alreadyExists) {
    return {
      ok: false,
      error: "favorite_already_exists"
    };
  }

  if (
    normalizedFavorites[safeType].length >=
    MAX_FAVORITES_PER_TYPE
  ) {
    return {
      ok: false,
      error: "favorites_limit_reached"
    };
  }

  normalizedFavorites[safeType].push(
    favorite
  );

  return {
    ok: true,
    error: "",
    favorite,
    favorites: normalizedFavorites
  };
}

export function replaceFavorite(
  favorites,
  type,
  position,
  value
) {
  const safeType = String(type || "").trim();

  if (!_isFavoriteType(safeType)) {
    return {
      ok: false,
      error: "invalid_favorite_type"
    };
  }

  const safePosition =
    _normalizePosition(position);

  if (!safePosition) {
    return {
      ok: false,
      error: "invalid_favorite_position"
    };
  }

  const normalizedFavorites =
    normalizeFavorites(favorites);

  const index = safePosition - 1;

  if (!normalizedFavorites[safeType][index]) {
    return {
      ok: false,
      error: "favorite_not_found"
    };
  }

  const favorite = _normalizeFavorite(
    value,
    safeType
  );

  if (!favorite) {
    return {
      ok: false,
      error: "invalid_favorite"
    };
  }

  const favoriteKey =
    _favoriteIdentityKey(favorite);

  const duplicate =
    normalizedFavorites[safeType].some(
      (entry, entryIndex) =>
        entryIndex !== index &&
        _favoriteIdentityKey(entry) ===
          favoriteKey
    );

  if (duplicate) {
    return {
      ok: false,
      error: "favorite_already_exists"
    };
  }

  normalizedFavorites[safeType][index] =
    favorite;

  return {
    ok: true,
    error: "",
    favorite,
    favorites: normalizedFavorites
  };
}

export function removeFavorite(
  favorites,
  type,
  position
) {
  const safeType = String(type || "").trim();

  if (!_isFavoriteType(safeType)) {
    return {
      ok: false,
      error: "invalid_favorite_type"
    };
  }

  const safePosition =
    _normalizePosition(position);

  if (!safePosition) {
    return {
      ok: false,
      error: "invalid_favorite_position"
    };
  }

  const normalizedFavorites =
    normalizeFavorites(favorites);

  const index = safePosition - 1;

  if (!normalizedFavorites[safeType][index]) {
    return {
      ok: false,
      error: "favorite_not_found"
    };
  }

  const [removed] =
    normalizedFavorites[safeType].splice(
      index,
      1
    );

  return {
    ok: true,
    error: "",
    removed,
    favorites: normalizedFavorites
  };
}
