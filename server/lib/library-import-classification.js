import {
  findLibraryImportDuplicate
} from "./library-import-duplicates.js";

export function classifyLibraryImportMatch(
  matchResult = {},
  library = []
) {
  const candidates =
    Array.isArray(matchResult.candidates)
      ? matchResult.candidates
      : [];

  const base = {
    status: String(
      matchResult.status || ""
    ),
    confidence:
      Number.isFinite(
        Number(matchResult.confidence)
      )
        ? Number(matchResult.confidence)
        : 0,
    reason: String(
      matchResult.reason || ""
    ),
    match:
      matchResult.match &&
      typeof matchResult.match === "object" &&
      !Array.isArray(matchResult.match)
        ? matchResult.match
        : null,
    candidates,
    duplicate: null
  };

  if (
    base.status === "matched" &&
    base.match
  ) {
    const duplicate =
      findLibraryImportDuplicate(
        library,
        base.match
      );

    if (duplicate) {
      return {
        ...base,
        status: "duplicate",
        duplicate
      };
    }

    return base;
  }

  if (
    base.status === "unmatched" &&
    candidates.length > 0
  ) {
    return {
      ...base,
      status: "doubtful"
    };
  }

  if (
    base.status === "not_found" ||
    candidates.length === 0
  ) {
    return {
      ...base,
      status: "not_found"
    };
  }

  return base;
}

export function classifyLibraryImportBatch(
  matchResults = [],
  library = []
) {
  const occupied = Array.isArray(library)
    ? [...library]
    : [];

  const results = [];

  for (const matchResult of Array.isArray(matchResults) ? matchResults : []) {
    const classified =
      classifyLibraryImportMatch(
        matchResult,
        occupied
      );

    results.push(classified);

    if (
      classified.status === "matched" &&
      classified.match
    ) {
      occupied.push(classified.match);
    }
  }

  return results;
}
