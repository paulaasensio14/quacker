import {
  createHash
} from "node:crypto";

const ALLOWED_TYPES = new Set([
  "pelicula",
  "serie",
  "book",
  "game"
]);

function _normalizeText(value) {
  return String(value ?? "").trim();
}

function _normalizeSearchText(value) {
  return _normalizeText(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function _createStableManualUuid(seedKey) {
  const hash = createHash("sha256")
    .update(`quacker:explore-fallback:${seedKey}`)
    .digest("hex")
    .slice(0, 32)
    .split("");

  hash[12] = "5";

  hash[16] = (
    (Number.parseInt(hash[16], 16) & 0x3) | 0x8
  ).toString(16);

  const value = hash.join("");

  return [
    value.slice(0, 8),
    value.slice(8, 12),
    value.slice(12, 16),
    value.slice(16, 20),
    value.slice(20, 32)
  ].join("-");
}

export function buildExploreFallbackItems(
  feed = [],
  options = {}
) {
  const requestedType = _normalizeText(
    options?.type
  ).toLowerCase();

  const normalizedQuery = _normalizeSearchText(
    options?.query
  );

  const queryTokens = normalizedQuery
    .split(" ")
    .filter(Boolean);

  const requestedLimit =
    Number.isFinite(Number(options?.limit)) &&
    Number(options.limit) > 0
      ? Math.floor(Number(options.limit))
      : 0;

  const sourceItems = Array.isArray(feed)
    ? feed
    : [];

  const seen = new Set();
  const fallbackItems = [];

  for (const sourceItem of sourceItems) {
    if (
      !sourceItem ||
      typeof sourceItem !== "object" ||
      Array.isArray(sourceItem)
    ) {
      continue;
    }

    if (
      _normalizeText(sourceItem.source).toLowerCase() !==
      "quacker_seed"
    ) {
      continue;
    }

    const type = _normalizeText(
      sourceItem.type
    ).toLowerCase();

    const title = _normalizeText(
      sourceItem.title
    );

    if (
      !ALLOWED_TYPES.has(type) ||
      !title
    ) {
      continue;
    }

    if (
      requestedType &&
      type !== requestedType
    ) {
      continue;
    }

    const searchableText = _normalizeSearchText([
      title,
      sourceItem.summary,
      sourceItem?.meta?.author
    ].filter(Boolean).join(" "));

    if (
      queryTokens.length > 0 &&
      !queryTokens.every(
        (token) => searchableText.includes(token)
      )
    ) {
      continue;
    }

    const originalIdentity =
      _normalizeText(sourceItem.externalId) ||
      _normalizeText(sourceItem.eid) ||
      title;

    const externalId = _createStableManualUuid(
      `${type}:${originalIdentity}`
    );

    if (seen.has(externalId)) {
      continue;
    }

    seen.add(externalId);

    const releaseYear = Number(
      sourceItem?.meta?.year ||
      _normalizeText(sourceItem.releaseDate).slice(0, 4)
    );

    const meta = {
      ...(
        sourceItem.meta &&
        typeof sourceItem.meta === "object" &&
        !Array.isArray(sourceItem.meta)
          ? sourceItem.meta
          : {}
      ),
      ...(
        Number.isFinite(releaseYear) &&
        releaseYear > 0
          ? { year: releaseYear }
          : {}
      )
    };

    fallbackItems.push({
      ...sourceItem,
      eid: `manual:${type}:${externalId}`,
      source: "manual",
      externalId,
      type,
      title,
      meta
    });

    if (
      requestedLimit > 0 &&
      fallbackItems.length >= requestedLimit
    ) {
      break;
    }
  }

  return fallbackItems;
}
