import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const serverSource = fs.readFileSync(
  new URL("../server.js", import.meta.url),
  "utf8"
);

const librarySource = fs.readFileSync(
  new URL("../../assets/js/app/library.js", import.meta.url),
  "utf8"
);

const apiClientSource = fs.readFileSync(
  new URL("../../assets/js/data/api-client.js", import.meta.url),
  "utf8"
);

function extractBetween(source, startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  assert.notEqual(start, -1, `No se encontró ${startMarker}`);

  const end = source.indexOf(endMarker, start + startMarker.length);
  assert.notEqual(end, -1, `No se encontró ${endMarker}`);

  return source.slice(start, end);
}

test("el progreso rápido de series registra el episodio al que acaba de avanzar", () => {
  const helper = extractBetween(
    librarySource,
    "function buildLibrarySeriesProgressPatch",
    "async function applyQuickProgressWithUndo"
  );

  assert.match(
    helper,
    /activityPayload:\s*\{\s*season:\s*nextPosition\.season,\s*episode:\s*nextPosition\.episode/s
  );

  assert.doesNotMatch(
    helper,
    /activityPayload:\s*\{\s*season:\s*watchedPosition\.season/
  );
});

test("ApiClient usa también el episodio nuevo en el progreso rápido de series", () => {
  const helper = extractBetween(
    apiClientSource,
    "function _buildSeriesQuickProgressPatch",
    "\n  async function progressLibraryItem"
  );

  assert.match(
    helper,
    /activityPayload:\s*\{\s*season:\s*nextPosition\.season,\s*episode:\s*nextPosition\.episode/s
  );

  assert.doesNotMatch(
    helper,
    /activityPayload:\s*\{\s*season:\s*watchedPosition\.season/
  );
});

test("el fallback de progreso rápido de series envía activityPayload explícito", () => {
  const quickProgress = extractBetween(
    librarySource,
    "async function applyQuickProgressWithUndo",
    "\nasync function"
  );

  assert.match(
    quickProgress,
    /nextItem\.activityPayload\s*=\s*\{\s*season:\s*Math\.max\(1,\s*Number\(nextItem\.meta\.season/s
  );
});

test("PATCH registra episode_watched solo cuando llega activityPayload explícito", () => {
  const patchRoute = extractBetween(
    serverSource,
    'app.patch("/api/library/:id"',
    '\napp.delete("/api/library/:id"'
  );

  assert.match(
    patchRoute,
    /rawPatch\?\.activityPayload/
  );

  assert.match(
    patchRoute,
    /eventType:\s*"episode_watched"/
  );

  assert.match(
    patchRoute,
    /contentType:\s*next\.type/
  );

  assert.match(
    patchRoute,
    /occurredAt:\s*activityCreatedAt/
  );

  assert.match(
    patchRoute,
    /bucket\.consumptionHistory\.unshift/
  );
});

test("la edición manual de una serie no se convierte en historial canónico", () => {
  const saveStart = librarySource.indexOf("async function saveProgressModal");
  assert.notEqual(saveStart, -1, "No se encontró saveProgressModal");

  const seriesBranchStart = librarySource.indexOf(
    '} else if (item.type === "serie") {',
    saveStart
  );
  assert.notEqual(
    seriesBranchStart,
    -1,
    "No se encontró la rama de series en saveProgressModal"
  );

  const seriesBranchEnd = librarySource.indexOf(
    '} else if (item.type === "game") {',
    seriesBranchStart
  );
  assert.notEqual(
    seriesBranchEnd,
    -1,
    "No se encontró el final de la rama de series"
  );

  const seriesManualSave = librarySource.slice(
    seriesBranchStart,
    seriesBranchEnd
  );

  assert.doesNotMatch(
    seriesManualSave,
    /activityPayload/
  );

  const patchRoute = extractBetween(
    serverSource,
    'app.patch("/api/library/:id"',
    '\napp.delete("/api/library/:id"'
  );

  assert.match(
    patchRoute,
    /rawPatch\?\.activityPayload/
  );
});
