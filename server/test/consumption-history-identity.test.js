import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const serverSource = fs.readFileSync(
  new URL("../server.js", import.meta.url),
  "utf8"
);

const apiSource = fs.readFileSync(
  new URL("../../assets/js/data/api-client.js", import.meta.url),
  "utf8"
);

function extractFunction(source, startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start);

  assert.notEqual(start, -1, `No se encontró ${startMarker}`);
  assert.notEqual(end, -1, `No se encontró ${endMarker}`);

  return source.slice(start, end);
}

test("el evento canónico conserva itemSnapshot normalizado y acepta eventos legacy", () => {
  const helperSource = extractFunction(
    serverSource,
    "function _normalizeConsumptionItemSnapshot",
    "function _normalizeConsumptionEvent"
  );

  const eventSource = extractFunction(
    serverSource,
    "function _normalizeConsumptionEvent",
    "function _normalizeConsumptionHistory"
  );

  const normalize = new Function(`
    ${helperSource}
    ${eventSource}
    return _normalizeConsumptionEvent;
  `)();

  const withSnapshot = normalize({
    id: "evt_1",
    itemId: "item_1",
    contentType: "pelicula",
    eventType: "watched",
    occurredAt: "2026-09-14T12:00:00.000Z",
    itemSnapshot: {
      title: "  Arrival  ",
      source: "tmdb",
      externalId: "329865"
    },
    meta: {}
  });

  assert.deepEqual(withSnapshot.itemSnapshot, {
    title: "Arrival",
    source: "tmdb",
    externalId: "329865"
  });

  const legacy = normalize({
    id: "evt_legacy",
    itemId: "item_legacy",
    contentType: "pelicula",
    eventType: "watched",
    occurredAt: "2026-09-14T12:00:00.000Z",
    meta: {}
  });

  assert.ok(legacy);
  assert.equal(legacy.itemSnapshot, null);
});

test("POST deriva itemSnapshot del elemento real de Library", () => {
  const start = serverSource.indexOf(
    'app.post("/api/consumption-history"'
  );

  const end = serverSource.indexOf(
    'app.delete("/api/consumption-history"',
    start
  );

  assert.notEqual(start, -1);
  assert.notEqual(end, -1);

  const block = serverSource.slice(start, end);

  assert.match(
    block,
    /itemSnapshot:\s*_buildConsumptionItemSnapshot\(libraryItem\)/
  );

  assert.doesNotMatch(
    block,
    /req\.body\?\.itemSnapshot/
  );
});

test("los eventos automáticos del servidor guardan itemSnapshot", () => {
  const matches = serverSource.match(
    /itemSnapshot:\s*_buildConsumptionItemSnapshot\(/g
  ) || [];

  assert.ok(
    matches.length >= 3,
    `Se esperaban al menos 3 usos del snapshot y hay ${matches.length}`
  );
});

test("el modo local deriva itemSnapshot del item real y no del payload", () => {
  const start = apiSource.indexOf(
    "async function addConsumptionHistoryEvent"
  );

  const end = apiSource.indexOf(
    "async function undoConsumptionHistoryForItemSince",
    start
  );

  assert.notEqual(start, -1);
  assert.notEqual(end, -1);

  const block = apiSource.slice(start, end);

  assert.match(block, /itemSnapshot:/);
  assert.match(block, /title:\s*String\(item\.title/);
  assert.match(block, /source:\s*String\(item\.source/);
  assert.match(block, /externalId:\s*String\(item\.externalId/);

  assert.doesNotMatch(
    block,
    /itemSnapshot:\s*payload\.itemSnapshot/
  );
});

test("borrar de Library no elimina consumptionHistory", () => {
  const start = serverSource.indexOf(
    'app.delete("/api/library/:id"'
  );

  const end = serverSource.indexOf(
    "// ===== STATIC",
    start
  );

  assert.notEqual(start, -1);
  assert.notEqual(end, -1);

  const block = serverSource.slice(start, end);

  assert.doesNotMatch(
    block,
    /consumptionHistory\s*=|consumptionHistory\.splice|consumptionHistory\.filter/
  );
});
