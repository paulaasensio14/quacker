import {
  normalizeContentIdentity,
  sameContentIdentity
} from "./content-identity.js";

export function findLibraryImportDuplicate(
  library = [],
  candidate = {}
) {
  const candidateIdentity =
    normalizeContentIdentity(candidate);

  if (!candidateIdentity.ok) {
    return null;
  }

  const items =
    Array.isArray(library)
      ? library
      : [];

  return (
    items.find((item) =>
      sameContentIdentity(
        item,
        candidate
      )
    ) || null
  );
}
