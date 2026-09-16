import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const apiSource = fs.readFileSync(
  new URL("../../assets/js/data/api-client.js", import.meta.url),
  "utf8"
);

function extractFunction(source, startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start);

  assert.notEqual(
    start,
    -1,
    `No se encontró ${startMarker}`
  );

  assert.notEqual(
    end,
    -1,
    `No se encontró ${endMarker}`
  );

  return source.slice(start, end);
}

test(
  "ApiClient expone getOpinions, saveOpinion y deleteOpinion",
  () => {
    assert.match(
      apiSource,
      /async function getOpinions\s*\(/
    );

    assert.match(
      apiSource,
      /async function saveOpinion\s*\(/
    );

    assert.match(
      apiSource,
      /async function deleteOpinion\s*\(/
    );

    assert.match(apiSource, /\bgetOpinions,/);
    assert.match(apiSource, /\bsaveOpinion,/);
    assert.match(apiSource, /\bdeleteOpinion,/);
  }
);

test(
  "getOpinions mantiene paridad entre HTTP y estado local",
  () => {
    const block = extractFunction(
      apiSource,
      "async function getOpinions",
      "async function saveOpinion"
    );

    assert.match(
      block,
      /\/opinions/
    );

    assert.match(
      block,
      /_httpJson\(\s*"GET"/
    );

    assert.match(
      block,
      /state\.opinions/
    );

    assert.match(
      block,
      /itemId/
    );

    assert.match(
      block,
      /updatedAt/
    );
  }
);

test(
  "saveOpinion usa PUT en HTTP y deriva identidad real en local",
  () => {
    const block = extractFunction(
      apiSource,
      "async function saveOpinion",
      "async function deleteOpinion"
    );

    assert.match(
      block,
      /_httpJson\(\s*"PUT"/
    );

    assert.match(
      block,
      /\/opinions\//
    );

    assert.match(
      block,
      /state\.opinions/
    );

    assert.match(
      block,
      /state\.library/
    );

    assert.match(
      block,
      /existingOpinion/
    );

    assert.match(
      block,
      /libraryItem/
    );

    assert.match(
      block,
      /contentType/
    );

    assert.match(
      block,
      /itemSnapshot/
    );

    assert.match(
      block,
      /createdAt/
    );

    assert.match(
      block,
      /updatedAt/
    );

    assert.match(
      block,
      /FakeBackend\.saveState/
    );

    assert.match(
      block,
      /kind:\s*"opinions"/
    );
  }
);

test(
  "deleteOpinion elimina la opinión en HTTP y local",
  () => {
    const start = apiSource.indexOf(
      "async function deleteOpinion"
    );

    assert.notEqual(
      start,
      -1,
      "debe existir deleteOpinion"
    );

    const end = apiSource.indexOf(
      "async function",
      start + 20
    );

    assert.notEqual(
      end,
      -1,
      "debe poder aislarse deleteOpinion"
    );

    const block = apiSource.slice(start, end);

    assert.match(
      block,
      /_httpJson\(\s*"DELETE"/
    );

    assert.match(
      block,
      /\/opinions\//
    );

    assert.match(
      block,
      /state\.opinions/
    );

    assert.match(
      block,
      /\.filter\(/
    );

    assert.match(
      block,
      /FakeBackend\.saveState/
    );

    assert.match(
      block,
      /kind:\s*"opinions"/
    );
  }
);

test(
  "saveOpinion local no convierte booleanos ni strings en rating",
  () => {
    const block = extractFunction(
      apiSource,
      "async function saveOpinion",
      "async function deleteOpinion"
    );

    assert.match(
      block,
      /typeof safeInput\.rating === "number"/,
      "el modo local debe exigir que rating ya sea numérico"
    );

    assert.doesNotMatch(
      block,
      /Number\(safeInput\.rating\)/,
      "el modo local no debe coercionar rating con Number()"
    );
  }
);

test(
  "saveOpinion local elimina la opinión si al editar queda vacía",
  () => {
    const block = extractFunction(
      apiSource,
      "async function saveOpinion",
      "async function deleteOpinion"
    );

    assert.match(
      block,
      /emptyOpinion/,
      "el modo local debe detectar una opinión existente que queda vacía"
    );

    assert.match(
      block,
      /state\.opinions\s*=\s*state\.opinions\.filter/,
      "la opinión vacía debe eliminarse del estado local"
    );

    assert.match(
      block,
      /deleted:\s*1/,
      "el resultado local debe indicar que se eliminó una opinión"
    );
  }
);
