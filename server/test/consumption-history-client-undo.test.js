import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const apiClientSource = fs.readFileSync(
  new URL("../../assets/js/data/api-client.js", import.meta.url),
  "utf8"
);

const librarySource = fs.readFileSync(
  new URL("../../assets/js/app/library.js", import.meta.url),
  "utf8"
);

test(
  "ApiClient expone undoConsumptionHistoryForItemSince y usa DELETE con itemId + since",
  () => {
    assert.match(
      apiClientSource,
      /async function undoConsumptionHistoryForItemSince\s*\(/,
      "debe existir undoConsumptionHistoryForItemSince"
    );

    assert.match(
      apiClientSource,
      /DELETE[\s\S]*\/consumption-history\?itemId=/,
      "debe llamar a DELETE /consumption-history por itemId"
    );

    assert.match(
      apiClientSource,
      /since=\$\{encodeURIComponent\(safeSinceIso\)\}/,
      "debe enviar since codificado"
    );

    const exportStart = apiClientSource.lastIndexOf("return {");
    const exportBlock = apiClientSource.slice(exportStart);

    assert.match(
      exportBlock,
      /undoConsumptionHistoryForItemSince/,
      "debe exportarse en ApiClient"
    );
  }
);

test(
  "el progreso rápido deshace activities y consumptionHistory de la misma acción",
  () => {
    const start = librarySource.indexOf(
      "async function applyQuickProgressWithUndo"
    );

    const end = librarySource.indexOf(
      "async function markAsCompletedWithUndo",
      start
    );

    assert.notEqual(start, -1, "debe existir applyQuickProgressWithUndo");
    assert.notEqual(end, -1, "debe poder aislarse applyQuickProgressWithUndo");

    const block = librarySource.slice(start, end);

    assert.match(
      block,
      /undoActivitiesForItemSince\(normalizedItemId,\s*sinceIso\)/,
      "debe deshacer activities"
    );

    assert.match(
      block,
      /undoConsumptionHistoryForItemSince\(normalizedItemId,\s*sinceIso\)/,
      "debe deshacer consumptionHistory"
    );
  }
);

test(
  "marcar como completado guarda sinceIso y deshace activities + consumptionHistory",
  () => {
    const start = librarySource.indexOf(
      "async function markAsCompletedWithUndo"
    );

    const end = librarySource.indexOf(
      "\n  function bind()",
      start
    );

    assert.notEqual(start, -1, "debe existir markAsCompletedWithUndo");
    assert.notEqual(end, -1, "debe poder aislarse markAsCompletedWithUndo");

    const block = librarySource.slice(start, end);

    assert.match(
      block,
      /const sinceIso = new Date\(Date\.now\(\) - 2000\)\.toISOString\(\)/,
      "debe guardar un marcador temporal antes de completar"
    );

    assert.match(
      block,
      /undoActivitiesForItemSince\(normalizedItemId,\s*sinceIso\)/,
      "debe eliminar la activity creada"
    );

    assert.match(
      block,
      /undoConsumptionHistoryForItemSince\(normalizedItemId,\s*sinceIso\)/,
      "debe eliminar el watched creado"
    );
  }
);
