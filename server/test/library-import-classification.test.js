import assert from "node:assert/strict";
import test from "node:test";

import {
  classifyLibraryImportMatch
} from "../lib/library-import-classification.js";

test(
  "clasifica como matched una coincidencia fuerte no duplicada",
  () => {
    const result =
      classifyLibraryImportMatch(
        {
          status: "matched",
          confidence: 1,
          reason: "title_type_year",
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
        },
        []
      );

    assert.equal(result.status, "matched");
    assert.equal(result.confidence, 1);
    assert.equal(result.duplicate, null);
  }
);

test(
  "clasifica como doubtful una coincidencia de baja confianza con candidatos",
  () => {
    const result =
      classifyLibraryImportMatch(
        {
          status: "unmatched",
          confidence: 0.65,
          reason: "low_confidence",
          match: null,
          candidates: [
            {
              title: "Dune",
              type: "pelicula",
              source: "tmdb",
              externalId: "438631"
            },
            {
              title: "Dune",
              type: "pelicula",
              source: "tmdb",
              externalId: "841"
            }
          ]
        },
        []
      );

    assert.equal(result.status, "doubtful");
    assert.equal(result.confidence, 0.65);
    assert.equal(result.candidates.length, 2);
  }
);

test(
  "preserva not_found cuando no hay candidatos",
  () => {
    const result =
      classifyLibraryImportMatch(
        {
          status: "not_found",
          confidence: 0,
          reason: "no_candidates",
          match: null,
          candidates: []
        },
        []
      );

    assert.deepEqual(
      result,
      {
        status: "not_found",
        confidence: 0,
        reason: "no_candidates",
        match: null,
        candidates: [],
        duplicate: null
      }
    );
  }
);

test(
  "clasifica como duplicate una coincidencia ya presente en Library",
  () => {
    const result =
      classifyLibraryImportMatch(
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
        },
        [
          {
            id: "lib-1",
            title: "Dune: Parte Uno",
            type: "pelicula",
            source: "tmdb",
            externalId: "0438631"
          }
        ]
      );

    assert.equal(result.status, "duplicate");
    assert.equal(result.duplicate?.id, "lib-1");
    assert.equal(result.match.externalId, "438631");
  }
);

test(
  "convierte ambiguous_candidates en doubtful conservando las alternativas",
  () => {
    const result =
      classifyLibraryImportMatch(
        {
          status: "unmatched",
          confidence: 1,
          reason: "ambiguous_candidates",
          match: null,
          candidates: [
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
        },
        []
      );

    assert.equal(result.status, "doubtful");
    assert.equal(
      result.reason,
      "ambiguous_candidates"
    );
    assert.equal(result.confidence, 1);
    assert.equal(result.match, null);
    assert.equal(result.candidates.length, 2);
  }
);

test(
  "un lote marca como duplicate una segunda fila que resuelve a la misma identidad",
  async () => {
    const {
      classifyLibraryImportBatch
    } = await import(
      "../lib/library-import-classification.js"
    );

    const results =
      classifyLibraryImportBatch(
        [
          {
            status: "matched",
            confidence: 1,
            reason: "title_type_year",
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
          },
          {
            status: "matched",
            confidence: 1,
            reason: "canonical_identity",
            match: {
              title: "Dune: Parte Uno",
              type: "pelicula",
              source: "tmdb",
              externalId: "0438631",
              meta: {
                year: 2021
              }
            },
            candidates: []
          }
        ],
        []
      );

    assert.equal(results.length, 2);
    assert.equal(results[0].status, "matched");
    assert.equal(results[0].duplicate, null);

    assert.equal(results[1].status, "duplicate");
    assert.equal(
      results[1].duplicate?.externalId,
      "438631"
    );
  }
);
