import assert from "node:assert/strict";
import test from "node:test";

import {
  searchLibraryImportCandidates
} from "../lib/library-import-search.js";

test(
  "peliculas y series consultan TMDB y filtran por el tipo solicitado",
  async () => {
    const calls = [];

    const providers = {
      searchTmdb: async (query) => {
        calls.push(["tmdb", query]);

        return [
          {
            title: "Dune",
            type: "pelicula",
            source: "tmdb",
            externalId: "438631"
          },
          {
            title: "Dune: Prophecy",
            type: "serie",
            source: "tmdb",
            externalId: "90228"
          }
        ];
      },
      searchOpenLibrary: async () => {
        throw new Error("open_library_no_debe_ejecutarse");
      },
      searchRawg: async () => {
        throw new Error("rawg_no_debe_ejecutarse");
      },
      searchWikipediaGames: async () => {
        throw new Error("wikipedia_no_debe_ejecutarse");
      }
    };

    const movieResults =
      await searchLibraryImportCandidates(
        {
          title: "Dune",
          type: "pelicula"
        },
        providers
      );

    assert.deepEqual(
      calls,
      [["tmdb", "Dune"]]
    );

    assert.deepEqual(
      movieResults.map((item) => item.type),
      ["pelicula"]
    );
  }
);

test(
  "los libros consultan únicamente Open Library",
  async () => {
    const calls = [];

    const results =
      await searchLibraryImportCandidates(
        {
          title: "The Martian",
          type: "book"
        },
        {
          searchTmdb: async () => {
            throw new Error("tmdb_no_debe_ejecutarse");
          },
          searchOpenLibrary: async (query) => {
            calls.push(["open_library", query]);

            return [
              {
                title: "The Martian",
                type: "book",
                source: "open_library",
                externalId: "OL22222M",
                meta: {
                  author: "Andy Weir"
                }
              }
            ];
          },
          searchRawg: async () => {
            throw new Error("rawg_no_debe_ejecutarse");
          },
          searchWikipediaGames: async () => {
            throw new Error("wikipedia_no_debe_ejecutarse");
          }
        }
      );

    assert.deepEqual(
      calls,
      [["open_library", "The Martian"]]
    );

    assert.equal(results.length, 1);
    assert.equal(results[0].source, "open_library");
  }
);

test(
  "los juegos usan RAWG y caen a Wikipedia si RAWG falla",
  async () => {
    const calls = [];

    const results =
      await searchLibraryImportCandidates(
        {
          title: "Portal 2",
          type: "game"
        },
        {
          searchTmdb: async () => {
            throw new Error("tmdb_no_debe_ejecutarse");
          },
          searchOpenLibrary: async () => {
            throw new Error("open_library_no_debe_ejecutarse");
          },
          searchRawg: async (query) => {
            calls.push(["rawg", query]);
            throw new Error("rawg_unavailable");
          },
          searchWikipediaGames: async (query) => {
            calls.push(["wikipedia_game", query]);

            return [
              {
                title: "Portal 2",
                type: "game",
                source: "wikipedia_game",
                externalId: "12345"
              }
            ];
          }
        }
      );

    assert.deepEqual(
      calls,
      [
        ["rawg", "Portal 2"],
        ["wikipedia_game", "Portal 2"]
      ]
    );

    assert.equal(results.length, 1);
    assert.equal(
      results[0].source,
      "wikipedia_game"
    );
  }
);
