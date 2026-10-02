import {
  searchTmdb
} from "../adapters/tmdb.js";

import {
  searchOpenLibrary
} from "../adapters/open-library.js";

import {
  searchRawg
} from "../adapters/rawg.js";

import {
  searchWikipediaGames
} from "../adapters/wikipedia-game.js";

const DEFAULT_PROVIDERS = {
  searchTmdb,
  searchOpenLibrary,
  searchRawg,
  searchWikipediaGames
};

function _normalizeText(value) {
  return String(value ?? "").trim();
}

function _normalizeType(value) {
  return _normalizeText(value).toLowerCase();
}

function _filterByType(items, type) {
  return Array.isArray(items)
    ? items.filter(
        (item) =>
          _normalizeType(item?.type) === type
      )
    : [];
}

export async function searchLibraryImportCandidates(
  row = {},
  providers = DEFAULT_PROVIDERS
) {
  const title =
    _normalizeText(row.title);

  const type =
    _normalizeType(row.type);

  if (!title || !type) {
    return [];
  }

  if (
    type === "pelicula" ||
    type === "serie"
  ) {
    const items =
      await providers.searchTmdb(title);

    return _filterByType(
      items,
      type
    );
  }

  if (type === "book") {
    const items =
      await providers.searchOpenLibrary(
        title
      );

    return _filterByType(
      items,
      type
    );
  }

  if (type === "game") {
    try {
      const items =
        await providers.searchRawg(
          title,
          {
            timeoutMs: 1500
          }
        );

      return _filterByType(
        items,
        type
      );
    } catch {
      const fallbackItems =
        await providers.searchWikipediaGames(
          title
        );

      return _filterByType(
        fallbackItems,
        type
      );
    }
  }

  return [];
}
