import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const source = fs.readFileSync(
  new URL("../../assets/js/app/library.js", import.meta.url),
  "utf8"
);

function extractFunction(name) {
  const start = source.indexOf(`async function ${name}(`);

  assert.notEqual(
    start,
    -1,
    `no se encontró async function ${name}() en library.js`
  );

  const nextFunction = source.indexOf("\nasync function ", start + 1);

  return nextFunction === -1
    ? source.slice(start)
    : source.slice(start, nextFunction);
}

test(
  "el guardado manual de progreso no reenvía un lastActivityAt heredado",
  () => {
    const saveProgressModal = extractFunction("saveProgressModal");

    const updatedAtIndex = saveProgressModal.indexOf(
      "item.updatedAt = new Date().toISOString();"
    );
    const clearTimestampIndex = saveProgressModal.indexOf(
      "delete item.lastActivityAt;"
    );
    const saveIndex = saveProgressModal.indexOf(
      "await saveLibraryItem(item);"
    );

    assert.notEqual(
      updatedAtIndex,
      -1,
      "saveProgressModal debe actualizar updatedAt antes de guardar"
    );

    assert.notEqual(
      clearTimestampIndex,
      -1,
      "saveProgressModal debe eliminar lastActivityAt heredado para que el backend timestampée la nueva actividad"
    );

    assert.notEqual(
      saveIndex,
      -1,
      "saveProgressModal debe guardar el item mediante saveLibraryItem"
    );

    assert.ok(
      updatedAtIndex < clearTimestampIndex &&
        clearTimestampIndex < saveIndex,
      "lastActivityAt debe eliminarse después de actualizar el item y antes de enviarlo al backend"
    );
  }
);
