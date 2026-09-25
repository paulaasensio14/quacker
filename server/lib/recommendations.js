import {
  normalizeContentIdentity
} from "./content-identity.js";

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

function _normalizeRecommendation(value) {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value)
  ) {
    return null;
  }

  const id = String(value.id || "").trim();
  const fromUserId = String(
    value.fromUserId || ""
  ).trim();

  const identity = normalizeContentIdentity({
    source: value.source,
    type: value.contentType,
    externalId: value.externalId
  });

  const itemSnapshot = _normalizeSnapshot(
    value.itemSnapshot
  );

  const createdAt = _normalizeDate(
    value.createdAt
  );

  if (
    !id ||
    !fromUserId ||
    !identity.ok ||
    !itemSnapshot ||
    !createdAt
  ) {
    return null;
  }

  return {
    id,
    fromUserId,
    contentType: identity.type,
    source: identity.source,
    externalId: identity.externalId,
    itemSnapshot,
    message: String(value.message || "")
      .trim(),
    createdAt
  };
}

export function normalizeRecommendations(value) {
  if (!Array.isArray(value)) return [];

  const seen = new Set();
  const recommendations = [];

  for (const entry of value) {
    const recommendation =
      _normalizeRecommendation(entry);

    if (!recommendation) continue;

    const identity = normalizeContentIdentity({
      source: recommendation.source,
      type: recommendation.contentType,
      externalId: recommendation.externalId
    });

    if (!identity.ok) continue;

    const duplicateKey =
      `${recommendation.fromUserId}::${identity.key}`;

    if (seen.has(duplicateKey)) continue;

    seen.add(duplicateKey);
    recommendations.push(recommendation);
  }

  return recommendations;
}

export function addRecommendation(
  recommendations,
  value,
  {
    ownerUserId = ""
  } = {}
) {
  const normalizedRecommendations =
    normalizeRecommendations(recommendations);

  const recommendation =
    _normalizeRecommendation(value);

  if (!recommendation) {
    return {
      ok: false,
      error: "invalid_recommendation"
    };
  }

  const normalizedOwnerUserId =
    String(ownerUserId || "").trim();

  if (
    normalizedOwnerUserId &&
    recommendation.fromUserId ===
      normalizedOwnerUserId
  ) {
    return {
      ok: false,
      error: "cannot_recommend_self"
    };
  }

  const recommendationIdentity =
    normalizeContentIdentity({
      source: recommendation.source,
      type: recommendation.contentType,
      externalId: recommendation.externalId
    });

  const alreadyExists =
    normalizedRecommendations.some(
      (entry) => {
        if (
          entry.fromUserId !==
          recommendation.fromUserId
        ) {
          return false;
        }

        const entryIdentity =
          normalizeContentIdentity({
            source: entry.source,
            type: entry.contentType,
            externalId: entry.externalId
          });

        return (
          entryIdentity.ok &&
          recommendationIdentity.ok &&
          entryIdentity.key ===
            recommendationIdentity.key
        );
      }
    );

  if (alreadyExists) {
    return {
      ok: false,
      error: "recommendation_already_exists"
    };
  }

  normalizedRecommendations.push(
    recommendation
  );

  return {
    ok: true,
    error: "",
    recommendation,
    recommendations:
      normalizedRecommendations
  };
}
