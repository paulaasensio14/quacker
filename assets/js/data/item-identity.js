export function getLibraryItemId(item) {
  if (!item) return "";

  if (item.__libraryItemId) {
    return String(item.__libraryItemId);
  }

  if (item.id && item.__fromLibrary) {
    return String(item.id);
  }

  return "";
}

export function getNormalizedContentKey(item) {
  if (!item) return "";

  const title = String(item.title || "")
    .trim()
    .toLowerCase();

  const type = String(item.type || "")
    .trim()
    .toLowerCase();

  return `${type}::${title}`;
}

export function sameContentIdentity(a, b) {
  return getNormalizedContentKey(a) === getNormalizedContentKey(b);
}

export function resolveLibraryItemIdFromCache(item, libraryCache = []) {
  const directId = getLibraryItemId(item);
  if (directId) return directId;

  const key = getNormalizedContentKey(item);
  if (!key) return "";

  const match = (libraryCache || []).find(
    (entry) => getNormalizedContentKey(entry) === key
  );

  return match?.id ? String(match.id) : "";
}