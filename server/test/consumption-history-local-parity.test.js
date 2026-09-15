import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const apiSource = fs.readFileSync(
  new URL("../../assets/js/data/api-client.js", import.meta.url),
  "utf8"
);

const mockSource = fs.readFileSync(
  new URL("../../assets/js/data/mock-data.js", import.meta.url),
  "utf8"
);

function getLocalUpdateBlock() {
  const updateStart = apiSource.indexOf(
    "async function updateLibraryItem"
  );

  const localStart = apiSource.indexOf(
    "// LOCAL (FakeBackend)",
    updateStart
  );

  const end = apiSource.indexOf(
    "async function deleteLibraryItem",
    localStart
  );

  assert.notEqual(updateStart, -1, "No se encontró updateLibraryItem");
  assert.notEqual(localStart, -1, "No se encontró el bloque LOCAL");
  assert.notEqual(end, -1, "No se encontró el final del bloque LOCAL");

  return apiSource.slice(localStart, end);
}

test("FakeBackend inicializa consumptionHistory vacío", () => {
  assert.match(
    mockSource,
    /consumptionHistory:\s*\[\]/
  );
});

test("FakeBackend normaliza consumptionHistory explícitamente", () => {
  assert.match(
    mockSource,
    /consumptionHistory:\s*Array\.isArray\(state\?\.consumptionHistory\)/
  );
});

test("el progreso local de series crea episode_watched solo con activityPayload explícito", () => {
  const localBlock = getLocalUpdateBlock();

  assert.match(
    localBlock,
    /state\.consumptionHistory\s*=\s*Array\.isArray/
  );

  assert.match(
    localBlock,
    /updatedItem\?\.activityPayload/
  );

  assert.match(
    localBlock,
    /eventType:\s*"episode_watched"/
  );
});

test("completar una película por primera vez en local crea watched canónico", () => {
  const localBlock = getLocalUpdateBlock();

  assert.match(
    localBlock,
    /next\.type\s*===\s*"pelicula"/
  );

  assert.match(
    localBlock,
    /eventType:\s*"watched"/
  );

  assert.match(
    localBlock,
    /prevCompleted/
  );

  assert.match(
    localBlock,
    /nextCompleted/
  );
});
