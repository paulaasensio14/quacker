import {
  normalizeFavorites
} from "./favorites.js";

import {
  normalizeProfilePrivacy
} from "./profile-privacy.js";

export function normalizePublicUsername(value) {
  if (typeof value !== "string") return "";

  const trimmed = value.trim();
  if (!trimmed) return "";

  const withoutPrefix = trimmed.startsWith("@")
    ? trimmed.slice(1)
    : trimmed;

  const username = withoutPrefix.toLowerCase();

  if (!/^[a-z0-9_]{2,20}$/.test(username)) {
    return "";
  }

  return username;
}

function _normalizePublicMediaSource(value) {
  const source = String(value || "").trim();

  if (!source) return "";

  if (
    source.startsWith("https://") ||
    source.startsWith("/assets/") ||
    source.startsWith("assets/") ||
    source.startsWith("data:image/")
  ) {
    return source;
  }

  return "";
}

function _normalizePublicProfile(profile = {}) {
  return {
    name: String(profile?.name || "").trim(),
    username: normalizePublicUsername(
      profile?.handle
    ),
    bio: String(profile?.bio || "")
      .trim()
      .slice(0, 180),
    avatar: _normalizePublicMediaSource(
      profile?.avatar
    )
  };
}

function _toPublicFavorites(value) {
  const favorites = normalizeFavorites(value);

  return Object.fromEntries(
    Object.entries(favorites).map(
      ([type, items]) => [
        type,
        items.map((item) => ({
          contentType: item.contentType,
          source: item.source,
          externalId: item.externalId,
          itemSnapshot: {
            title: item.itemSnapshot.title,
            cover: _normalizePublicMediaSource(
              item.itemSnapshot.cover
            )
          }
        }))
      ]
    )
  );
}

export function getPublicProfileByUsername(
  users,
  username
) {
  const normalizedUsername =
    normalizePublicUsername(username);

  if (
    !normalizedUsername ||
    !users ||
    typeof users !== "object" ||
    Array.isArray(users)
  ) {
    return null;
  }

  const userBucket = Object.values(users).find(
    (candidate) =>
      normalizePublicUsername(
        candidate?.profile?.handle
      ) === normalizedUsername
  );

  if (!userBucket) return null;

  const privacy = normalizeProfilePrivacy(
    userBucket.privacy
  );

  if (privacy.profile !== true) {
    return null;
  }

  const profile = _normalizePublicProfile(
    userBucket.profile
  );

  if (!profile.username) {
    return null;
  }

  const result = {
    profile
  };

  if (privacy.favorites === true) {
    result.favorites = _toPublicFavorites(
      userBucket.favorites
    );
  }

  return result;
}
