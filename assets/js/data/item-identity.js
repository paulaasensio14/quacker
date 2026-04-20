function getLibraryItemId(item) {
  if (!item) return "";

  if (item.__libraryItemId) {
    return String(item.__libraryItemId);
  }

  if (item.id && item.__fromLibrary) {
    return String(item.id);
  }

  return "";
}

function getCanonicalContentKey(item) {
  if (!item) return "";

  const source = String(item.source || "")
    .trim()
    .toLowerCase();

  const externalId = String(item.externalId || "")
    .trim();

  if (!source || !externalId) return "";

  return `${source}::${externalId}`;
}

function getNormalizedContentKey(item) {
  if (!item) return "";

  const title = String(item.title || "")
    .trim()
    .toLowerCase();

  const type = String(item.type || "")
    .trim()
    .toLowerCase();

  return `${type}::${title}`;
}

function sameContentIdentity(a, b) {
  const aCanonicalKey = getCanonicalContentKey(a);
  const bCanonicalKey = getCanonicalContentKey(b);

  if (aCanonicalKey && bCanonicalKey) {
    return aCanonicalKey === bCanonicalKey;
  }

  return getNormalizedContentKey(a) === getNormalizedContentKey(b);
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
      return String(canonicalMatch.id);
    }
  }

  const key = getNormalizedContentKey(item);
  if (!key) return "";

  const match = (libraryCache || []).find(
    (entry) => getNormalizedContentKey(entry) === key
  );

  return match?.id ? String(match.id) : "";
}

window.ItemIdentity = {
  getLibraryItemId,
  getCanonicalContentKey,
  getNormalizedContentKey,
  sameContentIdentity,
  resolveLibraryItemIdFromCache
};
