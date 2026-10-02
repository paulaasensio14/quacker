import assert from "node:assert/strict";
import test from "node:test";

import {
  matchLibraryImportRow
} from "../lib/library-import-matcher.js";

test(
  "prioriza una identidad canónica válida sin buscar candidatos",
  async () => {
    let searchCalls = 0;

    const result = await matchLibraryImportRow(
      {
        title: "Dune",
        type: "pelicula",
        year: 2021,
        status: "completed",
        progress: 100,
        author: "",
        source: "tmdb",
        externalId: "0438631"
      },
      {
        searchCandidates: async () => {
          searchCalls += 1;
          return [];
        }
      }
    );

    assert.equal(searchCalls, 0);

    assert.deepEqual(
      result,
      {
        status: "matched",
        confidence: 1,
        reason: "canonical_identity",
        match: {
          title: "Dune",
          type: "pelicula",
          source: "tmdb",
          externalId: "438631",
          meta: {
            year: 2021
          }
        },
        candidates: []
      }
    );
  }
);

test(
  "normaliza aliases de fuente e identificador mediante content-identity",
  async () => {
    const result = await matchLibraryImportRow({
      title: "Project Hail Mary",
      type: "book",
      year: 2021,
      author: "Andy Weir",
      source: "openlibrary",
      externalId: "https://openlibrary.org/books/OL12345M"
    });

    assert.equal(result.status, "matched");
    assert.equal(result.confidence, 1);
    assert.equal(result.reason, "canonical_identity");

    assert.equal(
      result.match.source,
      "open_library"
    );

    assert.equal(
      result.match.externalId,
      "OL12345M"
    );

    assert.deepEqual(
      result.match.meta,
      {
        year: 2021,
        author: "Andy Weir"
      }
    );
  }
);

test(
  "elige por título, tipo y año el candidato más fuerte cuando no hay identidad",
  async () => {
    let searchCalls = 0;

    const result = await matchLibraryImportRow(
      {
        title: "Dune",
        type: "pelicula",
        year: 2021,
        author: "",
        source: "",
        externalId: ""
      },
      {
        searchCandidates: async (row) => {
          searchCalls += 1;

          assert.equal(row.title, "Dune");
          assert.equal(row.type, "pelicula");

          return [
            {
              title: "Dune",
              type: "pelicula",
              source: "tmdb",
              externalId: "841",
              meta: {
                year: 1984
              }
            },
            {
              title: "Dune",
              type: "pelicula",
              source: "tmdb",
              externalId: "438631",
              meta: {
                year: 2021
              }
            },
            {
              title: "Dune",
              type: "book",
              source: "open_library",
              externalId: "OL12345M",
              meta: {
                year: 1965,
                author: "Frank Herbert"
              }
            }
          ];
        }
      }
    );

    assert.equal(searchCalls, 1);
    assert.equal(result.status, "matched");
    assert.equal(result.reason, "title_type_year");
    assert.ok(result.confidence >= 0.9);

    assert.deepEqual(
      result.match,
      {
        title: "Dune",
        type: "pelicula",
        source: "tmdb",
        externalId: "438631",
        meta: {
          year: 2021
        }
      }
    );

    assert.equal(result.candidates.length, 3);
  }
);

test(
  "devuelve not_found cuando la búsqueda no aporta candidatos",
  async () => {
    const result = await matchLibraryImportRow(
      {
        title: "Contenido que no existe",
        type: "serie",
        year: 2026,
        source: "",
        externalId: ""
      },
      {
        searchCandidates: async () => []
      }
    );

    assert.deepEqual(
      result,
      {
        status: "not_found",
        confidence: 0,
        reason: "no_candidates",
        match: null,
        candidates: []
      }
    );
  }
);

test(
  "usa author para desambiguar libros con título, tipo y año iguales",
  async () => {
    const result = await matchLibraryImportRow(
      {
        title: "The Martian",
        type: "book",
        year: 2011,
        author: "Andy Weir",
        source: "",
        externalId: ""
      },
      {
        searchCandidates: async () => [
          {
            title: "The Martian",
            type: "book",
            source: "open_library",
            externalId: "OL11111M",
            meta: {
              year: 2011,
              author: "John Doe"
            }
          },
          {
            title: "The Martian",
            type: "book",
            source: "open_library",
            externalId: "OL22222M",
            meta: {
              year: 2011,
              author: "Andy Weir"
            }
          }
        ]
      }
    );

    assert.equal(result.status, "matched");
    assert.equal(
      result.reason,
      "title_type_year_author"
    );
    assert.equal(result.confidence, 1);

    assert.deepEqual(
      result.match,
      {
        title: "The Martian",
        type: "book",
        source: "open_library",
        externalId: "OL22222M",
        meta: {
          year: 2011,
          author: "Andy Weir"
        }
      }
    );
  }
);

test(
  "usa el buscador de importación por defecto cuando no se inyecta searchCandidates",
  async () => {
    const calls = [];

    const result = await matchLibraryImportRow(
      {
        title: "Dune",
        type: "pelicula",
        year: 2021,
        source: "",
        externalId: ""
      },
      {
        providers: {
          searchTmdb: async (query) => {
            calls.push(["tmdb", query]);

            return [
              {
                title: "Dune",
                type: "pelicula",
                source: "tmdb",
                externalId: "438631",
                meta: {
                  year: 2021
                }
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
        }
      }
    );

    assert.deepEqual(
      calls,
      [["tmdb", "Dune"]]
    );

    assert.equal(result.status, "matched");
    assert.equal(result.confidence, 1);
    assert.equal(result.match.source, "tmdb");
    assert.equal(result.match.externalId, "438631");
  }
);

test(
  "no elige arbitrariamente entre candidatos distintos con la misma confianza fuerte",
  async () => {
    const result = await matchLibraryImportRow(
      {
        title: "Dune",
        type: "pelicula",
        year: 2021,
        source: "",
        externalId: ""
      },
      {
        searchCandidates: async () => [
          {
            title: "Dune",
            type: "pelicula",
            source: "tmdb",
            externalId: "438631",
            meta: {
              year: 2021
            }
          },
          {
            title: "Dune",
            type: "pelicula",
            source: "tmdb",
            externalId: "999999",
            meta: {
              year: 2021
            }
          }
        ]
      }
    );

    assert.equal(result.status, "unmatched");
    assert.equal(
      result.reason,
      "ambiguous_candidates"
    );
    assert.equal(result.confidence, 1);
    assert.equal(result.match, null);
    assert.equal(result.candidates.length, 2);
  }
);
