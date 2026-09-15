import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const serverSource = fs.readFileSync(
  new URL("../server.js", import.meta.url),
  "utf8"
);

const apiSource = fs.readFileSync(
  new URL("../../assets/js/data/api-client.js", import.meta.url),
  "utf8"
);

const librarySource = fs.readFileSync(
  new URL("../../assets/js/app/library.js", import.meta.url),
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
  "el backend registra read_completed al completar un libro por primera vez",
  () => {
    const block = extractBlock(
      serverSource,
      'app.patch("/api/library/:id"',
      'app.delete("/api/library/:id"'
    );

    assert.match(block, /next\.type === "book"/);
    assert.match(block, /prevCompleted\s*===?\s*false|!prevCompleted/);
    assert.match(block, /nextCompleted\s*===?\s*true|nextCompleted/);
    assert.match(block, /eventType:\s*"read_completed"/);
    assert.match(block, /_buildConsumptionItemSnapshot\(next\)/);
  }
);

test(
  "el backend registra completed al completar un juego por primera vez",
  () => {
    const block = extractBlock(
      serverSource,
      'app.patch("/api/library/:id"',
      'app.delete("/api/library/:id"'
    );

    assert.match(block, /next\.type === "game"/);
    assert.match(block, /eventType:\s*"completed"/);
    assert.match(block, /_buildConsumptionItemSnapshot\(next\)/);
  }
);

test(
  "una sesión played de juego exige señal explícita del progreso rápido",
  () => {
    const block = extractBlock(
      serverSource,
      'app.patch("/api/library/:id"',
      'app.delete("/api/library/:id"'
    );

    assert.match(block, /rawPatch\?\.consumptionPayload/);
    assert.match(block, /eventType:\s*"played"/);
    assert.match(block, /durationHours/);
  }
);

test(
  "el progreso rápido de juego envía una sesión canónica de una hora",
  () => {
    const block = extractBlock(
      librarySource,
      "async function applyQuickProgressWithUndo",
      "async function markAsCompletedWithUndo"
    );

    assert.match(block, /nextItem\.type === "game"/);
    assert.match(block, /consumptionPayload/);
    assert.match(block, /eventType:\s*"played"/);
    assert.match(block, /durationHours:\s*1/);
  }
);

test(
  "updateLibraryItem local refleja read_completed, played y completed",
  () => {
    const block = extractBlock(
      apiSource,
      "async function updateLibraryItem",
      "async function deleteLibraryItem"
    );

    assert.match(block, /next\.type === "book"/);
    assert.match(block, /eventType:\s*"read_completed"/);

    assert.match(block, /updatedItem\?\.consumptionPayload/);
    assert.match(block, /eventType:\s*"played"/);

    assert.match(block, /next\.type === "game"/);
    assert.match(block, /eventType:\s*"completed"/);
  }
);

test(
  "completeLibraryItem local registra finalización canónica de libro y juego",
  () => {
    const block = extractBlock(
      apiSource,
      "async function completeLibraryItem",
      "function _normalizeSeriesSeasonBreakdown"
    );

    assert.match(block, /item\.type === "book"/);
    assert.match(block, /eventType:\s*"read_completed"/);

    assert.match(block, /item\.type === "game"/);
    assert.match(block, /eventType:\s*"completed"/);
  }
);

test(
  "el normalizador de juegos conserva la duración de una sesión",
  () => {
    const start = serverSource.indexOf(
      "function _normalizeConsumptionEvent"
    );

    const end = serverSource.indexOf(
      "function _normalizeConsumptionHistory",
      start
    );

    assert.notEqual(start, -1);
    assert.notEqual(end, -1);

    const block = serverSource.slice(start, end);

    assert.match(block, /contentType === "game"/);
    assert.match(block, /durationHours/);
    assert.match(block, /meta\.durationHours/);
  }
);
