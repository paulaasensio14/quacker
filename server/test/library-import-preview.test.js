import assert from "node:assert/strict";
import test from "node:test";

import {
  buildLibraryImportPreview
} from "../lib/library-import-preview.js";

test(
  "construye un preview clasificado y no intenta buscar filas inválidas",
  async () => {
    const matchedTitles = [];

    const preview =
      await buildLibraryImportPreview(
        {
          text: [
            "title,type,year,source,externalId",
            "Dune,pelicula,2021,tmdb,438631",
            "Arcane,serie,2021,,",
            ",book,2020,,"
          ].join("\n"),
          library: []
        },
        {
          matchRow: async (row) => {
            matchedTitles.push(row.title);

            if (row.title === "Dune") {
              return {
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
              };
            }

            return {
              status: "unmatched",
              confidence: 0.65,
              reason: "low_confidence",
              match: null,
              candidates: [
                {
                  title: "Arcane",
                  type: "serie",
                  source: "tmdb",
                  externalId: "94605",
                  meta: {
                    year: 2021
                  }
                }
              ]
            };
          }
        }
      );

    assert.equal(
      preview.format,
      "quacker_csv_v1"
    );

    assert.equal(
      preview.formatConfidence,
      "high"
    );

    assert.deepEqual(
      matchedTitles,
      ["Dune", "Arcane"]
    );

    assert.equal(preview.rows.length, 3);

    assert.deepEqual(
      preview.rows.map((row) => ({
        rowNumber: row.rowNumber,
        status: row.status
      })),
      [
        {
          rowNumber: 2,
          status: "matched"
        },
        {
          rowNumber: 3,
          status: "doubtful"
        },
        {
          rowNumber: 4,
          status: "invalid"
        }
      ]
    );

    assert.deepEqual(
      preview.rows[2].errors,
      ["missing_title"]
    );

    assert.deepEqual(
      preview.summary,
      {
        total: 3,
        matched: 1,
        doubtful: 1,
        notFound: 0,
        duplicate: 0,
        invalid: 1
      }
    );
  }
);

test(
  "detecta duplicados contra Library y dentro del propio archivo",
  async () => {
    const preview =
      await buildLibraryImportPreview(
        {
          text: [
            "title,type,year,source,externalId",
            "Dune,pelicula,2021,tmdb,438631",
            "Arrival,pelicula,2016,tmdb,329865",
            "Arrival Again,pelicula,2016,tmdb,0329865"
          ].join("\n"),
          library: [
            {
              id: "lib-dune",
              title: "Dune",
              type: "pelicula",
              source: "tmdb",
              externalId: "438631"
            }
          ]
        }
      );

    assert.deepEqual(
      preview.rows.map((row) => row.status),
      [
        "duplicate",
        "matched",
        "duplicate"
      ]
    );

    assert.deepEqual(
      preview.summary,
      {
        total: 3,
        matched: 1,
        doubtful: 0,
        notFound: 0,
        duplicate: 2,
        invalid: 0
      }
    );
  }
);

test(
  "preserva errores concretos del parser CSV en lugar de degradarlos a formato no soportado",
  async () => {
    await assert.rejects(
      () =>
        buildLibraryImportPreview({
          text: [
            "title,type",
            "\"Dune,pelicula"
          ].join("\n"),
          library: []
        }),
      (error) => {
        assert.equal(
          error?.code,
          "csv_unclosed_quote"
        );

        return true;
      }
    );
  }
);
