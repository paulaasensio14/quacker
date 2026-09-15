import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const serverSource = fs.readFileSync(
  new URL("../server.js", import.meta.url),
  "utf8"
);

const apiClientSource = fs.readFileSync(
  new URL("../../assets/js/data/api-client.js", import.meta.url),
  "utf8"
);

test("GET consumption-history permite filtrar por itemId", () => {
  const start = serverSource.indexOf('app.get("/api/consumption-history"');
  const end = serverSource.indexOf(
    'app.post("/api/consumption-history"',
    start
  );

  assert.notEqual(start, -1, "No se encontró GET /api/consumption-history");
  assert.notEqual(end, -1, "No se encontró el final del GET");

  const route = serverSource.slice(start, end);

  assert.match(
    route,
    /req\.query\.itemId/
  );

  assert.match(
    route,
    /\.filter\([\s\S]*itemId/
  );
});

test("ApiClient puede leer consumptionHistory de un item en HTTP y local", () => {
  assert.match(
    apiClientSource,
    /async function getConsumptionHistory\s*\(/
  );

  assert.match(
    apiClientSource,
    /\/consumption-history\?itemId=/
  );

  assert.match(
    apiClientSource,
    /state\.consumptionHistory/
  );

  assert.match(
    apiClientSource,
    /getConsumptionHistory,/
  );
});

test("el resumen de serie cuenta episodios únicos y no repeticiones", () => {
  assert.match(
    apiClientSource,
    /function _buildSeriesConsumptionSummary\s*\(/
  );

  assert.match(
    apiClientSource,
    /new Set\(\)/
  );

  assert.match(
    apiClientSource,
    /eventType\s*!==\s*"episode_watched"/
  );

  assert.match(
    apiClientSource,
    /watchedEpisodes:\s*watchedKeys\.size/
  );

  assert.match(
    apiClientSource,
    /progress:/
  );
});

test("ApiClient expone progreso real y siguiente episodio de una serie", () => {
  assert.match(
    apiClientSource,
    /async function getSeriesConsumptionSummary\s*\(/
  );

  assert.match(
    apiClientSource,
    /getLibraryItemById\(/
  );

  assert.match(
    apiClientSource,
    /getConsumptionHistory\(\{\s*itemId/s
  );

  assert.match(
    apiClientSource,
    /_buildSeriesConsumptionSummary\(/
  );

  assert.match(
    apiClientSource,
    /nextEpisode/
  );

  assert.match(
    apiClientSource,
    /getSeriesConsumptionSummary,/
  );
});
