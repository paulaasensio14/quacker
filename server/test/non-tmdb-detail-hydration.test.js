import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

function extractFunction(source, functionName) {
  const start = source.indexOf(`async function ${functionName}`);
  assert.notEqual(start, -1, `${functionName} debe existir`);

  const openBrace = source.indexOf("{", start);
  assert.notEqual(openBrace, -1);

  let depth = 0;

  for (let i = openBrace; i < source.length; i += 1) {
    if (source[i] === "{") depth += 1;
    if (source[i] === "}") depth -= 1;

    if (depth === 0) {
      return source.slice(start, i + 1);
    }
  }

  throw new Error(`No se pudo extraer ${functionName}`);
}

test(
  "Explore hidrata también el detalle de fuentes no TMDB",
  () => {
    const source = fs.readFileSync(
      new URL("../../assets/js/app/explore.js", import.meta.url),
      "utf8"
    );

    const fn = extractFunction(
      source,
      "_fetchHydratedExploreItemDetail"
    );

    assert.doesNotMatch(
      fn,
      /if\s*\(\s*source\s*!==\s*["']tmdb["']\s*\)\s*return\s+item\s*;/
    );

    assert.match(
      fn,
      /ApiClient\.getExploreItemDetail\s*\(\s*\{\s*source\s*,\s*type\s*,\s*externalId\s*\}\s*\)/
    );
  }
);

test(
  "Explore usa el detalle autocontenido para contenido manual",
  () => {
    const source = fs.readFileSync(
      new URL("../../assets/js/app/explore.js", import.meta.url),
      "utf8"
    );

    const fn = extractFunction(
      source,
      "_fetchHydratedExploreItemDetail"
    );

    const manualGuardIndex = fn.search(
      /source\s*===\s*["']manual["']/
    );

    const remoteDetailIndex = fn.indexOf(
      "ApiClient.getExploreItemDetail"
    );

    assert.notEqual(
      manualGuardIndex,
      -1,
      "el detalle manual debe resolverse sin consultar el proveedor remoto"
    );

    assert.ok(
      manualGuardIndex < remoteDetailIndex,
      "el bypass manual debe ejecutarse antes de getExploreItemDetail"
    );
  }
);


test(
  "Explore refresca los metadatos de catálogo de una serie sin perder el progreso del usuario",
  async () => {
    const source = fs.readFileSync(
      new URL("../../assets/js/app/explore.js", import.meta.url),
      "utf8"
    );

    const fn = extractFunction(
      source,
      "_fetchHydratedExploreItemDetail"
    );

    const ApiClient = {
      async getExploreItemDetail() {
        return {
          eid: "tmdb:series:123",
          source: "tmdb",
          externalId: "123",
          type: "serie",
          title: "Serie de prueba",
          meta: {
            totalSeasons: 2,
            totalEpisodes: 16,
            lastAirDate: "2026-11-20",
            seasonBreakdown: [
              {
                seasonNumber: 1,
                episodeCount: 8
              },
              {
                seasonNumber: 2,
                episodeCount: 8
              }
            ]
          }
        };
      },
      async getLibraryItemActivities() {
        return [];
      }
    };

    const fetchHydrated = Function(
      "ApiClient",
      "__drawerDetailCache",
      "_safeText",
      "_normalizeId",
      "_normalizeDetailRelatedItem",
      "_getDetailEpisodeActivityCacheKey",
      "__detailEpisodeActivityCache",
      "_buildDetailEpisodeActivityMap",
      `"use strict"; return (${fn});`
    )(
      ApiClient,
      new Map(),
      (value) => String(value || ""),
      (value) => String(value || "").trim(),
      (value) => value,
      () => "",
      new Map(),
      () => ({})
    );

    const hydrated = await fetchHydrated({
      eid: "tmdb:series:123",
      source: "tmdb",
      externalId: "123",
      type: "serie",
      title: "Serie de prueba",
      meta: {
        totalSeasons: 1,
        totalEpisodes: 8,
        lastAirDate: "2026-01-01",
        seasonBreakdown: [
          {
            seasonNumber: 1,
            episodeCount: 8
          }
        ],
        season: 1,
        episode: 8,
        episodeSeenMap: {
          "1:8": "2026-01-10T20:00:00.000Z"
        }
      }
    });

    assert.equal(hydrated.meta.totalSeasons, 2);
    assert.equal(hydrated.meta.totalEpisodes, 16);
    assert.equal(hydrated.meta.lastAirDate, "2026-11-20");

    assert.deepEqual(
      hydrated.meta.seasonBreakdown,
      [
        {
          seasonNumber: 1,
          episodeCount: 8
        },
        {
          seasonNumber: 2,
          episodeCount: 8
        }
      ]
    );

    assert.equal(hydrated.meta.season, 1);
    assert.equal(hydrated.meta.episode, 8);
    assert.deepEqual(
      hydrated.meta.episodeSeenMap,
      {
        "1:8": "2026-01-10T20:00:00.000Z"
      }
    );
  }
);
