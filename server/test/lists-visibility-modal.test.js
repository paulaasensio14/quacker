import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const source = fs.readFileSync(
  new URL("../../assets/js/app/lists.js", import.meta.url),
  "utf8"
);

const server = fs.readFileSync(
  new URL("../server.js", import.meta.url),
  "utf8"
);

function extract(start, end) {
  const first = source.indexOf(start);
  const last = source.indexOf(end, first);

  assert.ok(first >= 0, `Falta ${start}`);
  assert.ok(last > first, `Falta ${end}`);

  return source.slice(first, last);
}

const modal = extract(
  "function openListModal(",
  "function closeListModal("
);

const edit = modal.split("// MODO EDITAR")[1]
  ?.split("// MODO CREAR")[0] || "";

const create = modal.split("// MODO CREAR")[1] || "";

const save = extract(
  "async function saveListFromModal(",
  "function _showConfirmDeleteErrors("
);

test("crear permite seleccionar visibilidad", () => {
  assert.doesNotMatch(
    create,
    /visibilitySelect\.disabled\s*=\s*true/
  );

  assert.match(
    create,
    /visibilitySelect\.disabled\s*=\s*false/
  );
});

test("editar conserva visibilidad existente", () => {
  assert.match(
    edit,
    /visibilitySelect\.value\s*=\s*list\.visibility/
  );

  assert.doesNotMatch(
    edit,
    /visibilitySelect\.disabled\s*=\s*true/
  );
});

test("guardar utiliza visibilidad seleccionada", () => {
  assert.doesNotMatch(
    save,
    /const visibility\s*=\s*["']private["']/
  );

  assert.match(
    save,
    /const visibility\s*=[\s\S]{0,200}lm_visibility/
  );
});

test("backend valida los tres tipos", () => {
  assert.match(
    server,
    /\["private", "public", "collab"\]/
  );

  assert.match(
    server,
    /app\.post\("\/api\/lists"/
  );

  assert.match(
    server,
    /app\.patch\("\/api\/lists\/:id"/
  );
});
