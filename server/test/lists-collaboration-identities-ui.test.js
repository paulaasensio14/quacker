import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

function read(path) {
  return fs.readFileSync(
    new URL(path, import.meta.url),
    "utf8"
  );
}

const server = read("../server.js");
const html = read("../../dashboard.html");
const client = read("../../assets/js/data/api-client.js");
const lists = read("../../assets/js/app/lists.js");

test("existe busqueda de usuarios reutilizable", () => {
  assert.match(client, /async function getCommunityUsers\(/);
  assert.match(server, /searchCommunityUsers\(/);
});

test("el formulario incorpora sugerencias accesibles", () => {
  assert.ok(
    html.includes('id="listMemberSuggestions"'),
    "Falta el contenedor de sugerencias"
  );
  assert.match(html, /aria-autocomplete="list"/);
});

test("ApiClient permite consultar participantes", () => {
  assert.match(
    client,
    /async function getListMembers\(/
  );
  assert.match(
    client,
    /\n\s+getListMembers,/
  );
});

test("el backend protege el directorio de participantes", () => {
  assert.ok(
    server.includes('"/api/lists/:id/members"'),
    "Falta la ruta de participantes"
  );
});

test("ListsModule integra busqueda e identidades", () => {
  assert.match(
    lists,
    /function searchListMemberSuggestions\(/
  );
  assert.match(
    lists,
    /ApiClient\.getCommunityUsers\(/
  );
  assert.match(
    lists,
    /ApiClient\.getListMembers\(/
  );
});
