import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const librarySource = fs.readFileSync(
  new URL("../../assets/js/app/library.js", import.meta.url),
  "utf8"
);

const apiSource = fs.readFileSync(
  new URL("../../assets/js/data/api-client.js", import.meta.url),
  "utf8"
);

function extractBlock(source, startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start + startMarker.length);

  assert.notEqual(start, -1, `no se encontró ${startMarker}`);
  assert.notEqual(end, -1, `no se encontró ${endMarker}`);

  return source.slice(start, end);
}

test(
  "el helper de Library acepta el resumen canónico y usa nextEpisode",
  () => {
    const block = extractBlock(
      librarySource,
      "function buildLibrarySeriesProgressPatch",
      "async function applyQuickProgressWithUndo"
    );

    assert.match(
      block,
      /buildLibrarySeriesProgressPatch\s*\(\s*item\s*,\s*summary\s*=\s*null\s*\)/
    );

    assert.match(block, /summary\?\.nextEpisode/);
    assert.match(block, /summary\?\.watchedEpisodes/);
    assert.match(block, /summary\?\.totalEpisodes/);
  }
);

test(
  "Continuar desde Library obtiene el resumen canónico antes de avanzar",
  () => {
    const block = extractBlock(
      librarySource,
      "async function applyQuickProgressWithUndo",
      "async function markAsCompletedWithUndo"
    );

    assert.match(
      block,
      /await ApiClient\.getSeriesConsumptionSummary\(normalizedItemId\)/
    );

    assert.match(
      block,
      /buildLibrarySeriesProgressPatch\(\s*nextItem\s*,\s*seriesConsumptionSummary\s*\)/
    );
  }
);

test(
  "el helper de ApiClient acepta el resumen canónico y usa nextEpisode",
  () => {
    const block = extractBlock(
      apiSource,
      "function _buildSeriesQuickProgressPatch",
      "async function progressLibraryItem"
    );

    assert.match(
      block,
      /_buildSeriesQuickProgressPatch\s*\(\s*item\s*,\s*summary\s*=\s*null\s*\)/
    );

    assert.match(block, /summary\?\.nextEpisode/);
    assert.match(block, /summary\?\.watchedEpisodes/);
    assert.match(block, /summary\?\.totalEpisodes/);
  }
);

test(
  "progressLibraryItem obtiene el resumen canónico antes de avanzar una serie",
  () => {
    const block = extractBlock(
      apiSource,
      "async function progressLibraryItem",
      "// === biblioteca ==="
    );

    assert.match(
      block,
      /await getSeriesConsumptionSummary\(targetId\)/
    );

    assert.match(
      block,
      /_buildSeriesQuickProgressPatch\(\s*current\s*,\s*seriesConsumptionSummary\s*\)/
    );
  }
);

test(
  "el backend registra progreso explícito de serie aunque el porcentaje no cambie",
  () => {
    const serverSource = fs.readFileSync(
      new URL("../server.js", import.meta.url),
      "utf8"
    );

    const start = serverSource.indexOf(
      'app.patch("/api/library/:id"'
    );

    const end = serverSource.indexOf(
      'app.delete("/api/library/:id"',
      start
    );

    assert.notEqual(start, -1, "no se encontró PATCH /api/library/:id");
    assert.notEqual(end, -1, "no se encontró el final del PATCH");

    const route = serverSource.slice(start, end);

    assert.match(
      route,
      /else if\s*\(\s*next\.type\s*===\s*"serie"\s*&&\s*explicitSeriesActivityPayload\s*\)\s*\{\s*activityType\s*=\s*"progress"/s
    );
  }
);
