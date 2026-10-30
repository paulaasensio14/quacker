import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const source = fs.readFileSync(
  new URL("../../assets/js/app/explore.js", import.meta.url),
  "utf8"
);

function buildMapFunction() {
  const startMarker =
    "function _buildDetailEpisodeActivityMap(";

  const endMarker =
    "function _getDetailEpisodeSeenAt(";

  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start);

  assert.ok(start >= 0, "Falta la función del mapa");
  assert.ok(end > start, "No se encuentra su final");

  const functionSource = source.slice(start, end);

  return Function(
    "_safeText",
    "_getDetailSeriesLastWatchedPosition",
    "_normalizeDetailSeasonBreakdown",
    "_norm",
    `"use strict";
    ${functionSource}
    return _buildDetailEpisodeActivityMap;`
  )(
    (value) => String(value ?? ""),
    () => null,
    () => [],
    (value) => String(value ?? "").toLowerCase()
  );
}

const buildMap = buildMapFunction();

const item = {
  type: "serie",
  status: "watching",
  progress: 25,
  meta: {
    season: 1,
    episode: 2,
    episodeSeenMap: {
      "1:1": "2026-10-01T12:00:00.000Z"
    }
  }
};

const oldActivities = [{
  createdAt: "2026-10-02T12:00:00.000Z",
  payload: { season: 1, episode: 1 }
}];

test(
  "QA-02-002: historial canónico vacío no resucita vistos",
  () => {
    const map = buildMap(item, oldActivities, []);

    assert.deepEqual(map, {});
  }
);

test(
  "QA-02-002: historial canónico prevalece sobre actividades",
  () => {
    const history = [{
      itemId: "serie-1",
      eventType: "episode_watched",
      occurredAt: "2026-10-03T12:00:00.000Z",
      meta: { season: 1, episode: 2 }
    }];

    const map = buildMap(item, oldActivities, history);

    assert.deepEqual(map, {
      "1:2": "2026-10-03T12:00:00.000Z"
    });
  }
);

test(
  "QA-02-002: sin historial canónico conserva mapa heredado",
  () => {
    const map = buildMap(item, [], null);

    assert.equal(
      map["1:1"],
      "2026-10-01T12:00:00.000Z"
    );
  }
);
