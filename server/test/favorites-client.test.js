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

function extractBlock(source, startMarker, endMarker) {
  const start = source.indexOf(startMarker);

  assert.notEqual(
    start,
    -1,
    `No se encontró ${startMarker}`
  );

  const end = source.indexOf(
    endMarker,
    start + startMarker.length
  );

  assert.notEqual(
    end,
    -1,
    `No se encontró ${endMarker}`
  );

  return source.slice(start, end);
}

test(
  "ApiClient define y expone las operaciones de favoritos",
  () => {
    for (const name of [
      "getUserFavorites",
      "addUserFavorite",
      "replaceUserFavorite",
      "removeUserFavorite"
    ]) {
      assert.match(
        apiSource,
        new RegExp(`async function ${name}\\s*\\(`),
        `debe existir ${name}`
      );

      assert.match(
        apiSource,
        new RegExp(`\\b${name},`),
        `ApiClient debe exponer ${name}`
      );
    }

    assert.match(
      apiSource,
      /function normalizeUserFavorites\s*\(/
    );
  }
);

test(
  "normalizeUserFavorites conserva cuatro categorías, identidad canónica, orden y máximo cuatro",
  () => {
    const block = extractBlock(
      apiSource,
      "function normalizeUserFavorites",
      "async function getUserFavorites"
    );

    for (const type of [
      "pelicula",
      "serie",
      "game",
      "book"
    ]) {
      assert.match(
        block,
        new RegExp(`\\b${type}\\b`),
        `debe normalizar ${type}`
      );
    }

    assert.match(
      block,
      /_normalizeCanonicalIdentity/,
      "debe reutilizar la identidad canónica del cliente"
    );

    assert.match(
      block,
      /\.slice\(0,\s*4\)/,
      "debe limitar cada categoría a cuatro favoritos"
    );

    assert.match(
      block,
      /Set/,
      "debe eliminar identidades duplicadas"
    );

    assert.match(
      block,
      /itemSnapshot/,
      "debe conservar el snapshot visual"
    );

    assert.match(
      block,
      /addedAt/,
      "debe conservar una fecha válida"
    );
  }
);

test(
  "getUserFavorites mantiene paridad entre HTTP y estado local",
  () => {
    const block = extractBlock(
      apiSource,
      "async function getUserFavorites",
      "async function addUserFavorite"
    );

    assert.match(
      block,
      /_httpJson\(\s*"GET",\s*"\/user\/favorites"/
    );

    assert.match(
      block,
      /state\.favorites/
    );

    assert.match(
      block,
      /normalizeUserFavorites/
    );
  }
);

test(
  "addUserFavorite usa POST y aplica las mismas reglas en local",
  () => {
    const block = extractBlock(
      apiSource,
      "async function addUserFavorite",
      "async function replaceUserFavorite"
    );

    assert.match(
      block,
      /_httpJson\(\s*"POST"/
    );

    assert.match(
      block,
      /\/user\/favorites\//
    );

    assert.match(
      block,
      /_normalizeCanonicalIdentity/
    );

    assert.match(
      block,
      /favorite_already_exists/
    );

    assert.match(
      block,
      /favorites_limit_reached/
    );

    assert.match(
      block,
      /new Date\(\)\.toISOString\(\)/
    );

    assert.match(
      block,
      /FakeBackend\.saveState/
    );

    assert.match(
      block,
      /kind:\s*"favorites"/
    );

    assert.match(
      block,
      /action:\s*"add"/
    );
  }
);

test(
  "replaceUserFavorite usa PATCH, posición 1-4 y evita duplicados en local",
  () => {
    const block = extractBlock(
      apiSource,
      "async function replaceUserFavorite",
      "async function removeUserFavorite"
    );

    assert.match(
      block,
      /_httpJson\(\s*"PATCH"/
    );

    assert.match(
      block,
      /\/user\/favorites\//
    );

    assert.match(
      block,
      /invalid_favorite_position/
    );

    assert.match(
      block,
      /favorite_not_found/
    );

    assert.match(
      block,
      /favorite_already_exists/
    );

    assert.match(
      block,
      /FakeBackend\.saveState/
    );

    assert.match(
      block,
      /kind:\s*"favorites"/
    );

    assert.match(
      block,
      /action:\s*"replace"/
    );
  }
);

test(
  "removeUserFavorite usa DELETE y elimina por posición también en local",
  () => {
    const block = extractBlock(
      apiSource,
      "async function removeUserFavorite",
      "// === preferencias (dashboard) ==="
    );

    assert.match(
      block,
      /_httpJson\(\s*"DELETE"/
    );

    assert.match(
      block,
      /\/user\/favorites\//
    );

    assert.match(
      block,
      /invalid_favorite_position/
    );

    assert.match(
      block,
      /favorite_not_found/
    );

    assert.match(
      block,
      /\.splice\(/
    );

    assert.match(
      block,
      /FakeBackend\.saveState/
    );

    assert.match(
      block,
      /kind:\s*"favorites"/
    );

    assert.match(
      block,
      /action:\s*"remove"/
    );
  }
);

test(
  "FakeBackend inicializa y normaliza explícitamente las cuatro categorías de favoritos",
  () => {
    assert.match(
      mockSource,
      /function normalizeMockFavorites|const normalizeMockFavorites/
    );

    const normalizeBlock = extractBlock(
      mockSource,
      "const normalizeMockState",
      "// ===== migración legacy"
    );

    assert.match(
      normalizeBlock,
      /favorites:\s*normalizeMockFavorites\(/
    );

    for (const type of [
      "pelicula",
      "serie",
      "game",
      "book"
    ]) {
      assert.match(
        mockSource,
        new RegExp(`${type}:\\s*\\[\\]`),
        `FakeBackend debe iniciar ${type} vacío`
      );
    }
  }
);
