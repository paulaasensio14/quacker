import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const librarySource = fs.readFileSync(
  new URL("../../assets/js/app/library.js", import.meta.url),
  "utf8"
);

function getSaveProgressModalSource() {
  const start = librarySource.indexOf("async function saveProgressModal()");
  const end = librarySource.indexOf("\n}", start);

  assert.notEqual(
    start,
    -1,
    "debe existir saveProgressModal"
  );

  assert.notEqual(
    end,
    -1,
    "debe poder aislarse saveProgressModal"
  );

  return librarySource.slice(start, end + 2);
}

test(
  "guardar un videojuego manualmente a 0% y 0 horas lo devuelve a not_started",
  () => {
    const saveProgressModal = getSaveProgressModalSource();

    assert.match(
      saveProgressModal,
      /item\.type === "game"[\s\S]*?item\.progress\s*=\s*Math\.max\(0,\s*Math\.min\(100,\s*pct\)\)[\s\S]*?item\.meta\.hoursPlayed\s*=[\s\S]*?item\.progress\s*<=\s*0[\s\S]*?item\.meta\.hoursPlayed\s*<=\s*0[\s\S]*?item\.status\s*=\s*"not_started"/,
      "un juego guardado explícitamente con 0% y 0 horas debe dejar de permanecer en playing"
    );
  }
);
