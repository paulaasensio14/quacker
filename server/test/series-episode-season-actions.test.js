import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(
  new URL("../server.js", import.meta.url),
  "utf8"
);

function extractPutRoute(path) {
  const marker = `"${path}"`;
  const position = source.indexOf(marker);

  assert.ok(position >= 0, `No existe ${path}`);
  assert.equal(
    source.indexOf(marker, position + marker.length),
    -1,
    `Ruta duplicada: ${path}`
  );

  const start = source.lastIndexOf("app.put(", position);
  assert.ok(start >= 0, `No existe PUT ${path}`);

  const opening = source.slice(start, position);
  assert.match(
    opening,
    /^app\.put\(\s*$/,
    `Declaración PUT incorrecta: ${path}`
  );

  const end = source.indexOf("\n);", position);
  assert.ok(end > position, `Ruta incompleta: ${path}`);

  return source.slice(start, end + 3);
}

const episodePath =
  "/api/library/:itemId/episodes/:season/:episode";

const seasonPath =
  "/api/library/:itemId/seasons/:season";

test("QA-02-002: existe ruta autenticada para episodio", () => {
  const route = extractPutRoute(episodePath);

  assert.match(route, /_requireAuth/);
  assert.match(
    route,
    /_setSeriesEpisodeWatchState\(req,\s*res,\s*false\)/
  );
});

test("QA-02-002: existe ruta autenticada para temporada", () => {
  const route = extractPutRoute(seasonPath);

  assert.match(route, /_requireAuth/);
  assert.match(
    route,
    /_setSeriesEpisodeWatchState\(req,\s*res,\s*true\)/
  );
});

function extractSharedHandler() {
  const start = source.indexOf(
    "function _setSeriesEpisodeWatchState("
  );

  assert.ok(start >= 0, "Falta función compartida");

  const end = source.indexOf("\napp.put(", start);

  assert.ok(end > start, "Falta cierre del controlador");

  return source.slice(start, end);
}

test("QA-02-002: episodio usa biblioteca del usuario", () => {
  extractPutRoute(episodePath);

  const handler = extractSharedHandler();

  assert.match(handler, /_getUserBucket\s*\(/);
  assert.match(handler, /req\.session\.userId/);
  assert.match(handler, /bucket\.library\.findIndex\s*\(/);
});

test("QA-02-002: temporada usa biblioteca del usuario", () => {
  extractPutRoute(seasonPath);

  const handler = extractSharedHandler();

  assert.match(handler, /_getUserBucket\s*\(/);
  assert.match(handler, /req\.session\.userId/);
  assert.match(handler, /bucket\.library\.findIndex\s*\(/);
});
