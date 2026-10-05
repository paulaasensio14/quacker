import assert from "node:assert/strict";
import test from "node:test";

import {
  hydrateLibraryImportMeta
} from "../lib/library-import-series-hydration.js";

test(
  "hidrata una serie TMDB importada con la estructura real de temporadas y episodios",
  async () => {
    const calls = [];

    const meta = await hydrateLibraryImportMeta({
      match: {
        title: "Criminal Minds",
        type: "serie",
        source: "tmdb",
        externalId: "4057"
      },
      meta: {
        year: 2005
      },
      getTmdbDetail: async (args) => {
        calls.push(args);

        return {
          type: "serie",
          source: "tmdb",
          externalId: "4057",
          meta: {
            year: 2005,
            totalSeasons: 19,
            totalEpisodes: 344,
            seasonBreakdown: [
              {
                seasonNumber: 1,
                episodeCount: 22
              },
              {
                seasonNumber: 2,
                episodeCount: 23
              }
            ]
          }
        };
      }
    });

    assert.deepEqual(calls, [
      {
        type: "serie",
        externalId: "4057"
      }
    ]);

    assert.equal(meta.year, 2005);
    assert.equal(meta.totalSeasons, 19);
    assert.equal(meta.totalEpisodes, 344);
    assert.deepEqual(meta.seasonBreakdown, [
      {
        seasonNumber: 1,
        episodeCount: 22
      },
      {
        seasonNumber: 2,
        episodeCount: 23
      }
    ]);
    assert.equal(meta.season, 1);
    assert.equal(meta.episode, 1);
  }
);

test(
  "no consulta detalle adicional para contenidos que no sean series TMDB",
  async () => {
    let calls = 0;

    const originalMeta = {
      year: 2021
    };

    const meta = await hydrateLibraryImportMeta({
      match: {
        title: "Dune",
        type: "pelicula",
        source: "tmdb",
        externalId: "438631"
      },
      meta: originalMeta,
      getTmdbDetail: async () => {
        calls += 1;
        throw new Error("no debería llamarse");
      }
    });

    assert.equal(calls, 0);
    assert.deepEqual(meta, originalMeta);
  }
);
