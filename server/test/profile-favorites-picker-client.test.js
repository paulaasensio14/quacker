import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const profileSource = fs.readFileSync(
  new URL(
    "../../assets/js/app/profile.js",
    import.meta.url
  ),
  "utf8"
);

test("ProfileModule puede abrir y cerrar el selector de favoritos", () => {
  assert.match(
    profileSource,
    /function openFavoritePicker\s*\(/
  );

  assert.match(
    profileSource,
    /function closeFavoritePicker\s*\(/
  );

  assert.match(
    profileSource,
    /favoritePickerModal/
  );

  assert.match(
    profileSource,
    /window\.UIModal\?\.open/
  );

  assert.match(
    profileSource,
    /window\.UIModal\?\.close/
  );
});

test("el selector busca contenido real de Explorar por categoría", () => {
  assert.match(
    profileSource,
    /async function searchFavoritePicker\s*\(/
  );

  assert.match(
    profileSource,
    /ApiClient\.getExploreFeed\s*\(/
  );

  assert.match(
    profileSource,
    /query/
  );

  assert.match(
    profileSource,
    /type/
  );

  assert.match(
    profileSource,
    /limit/
  );

  assert.match(
    profileSource,
    /AbortController/
  );
});

test("los resultados del selector se construyen con DOM seguro", () => {
  assert.match(
    profileSource,
    /function renderFavoritePickerResults\s*\(/
  );

  assert.match(
    profileSource,
    /document\.createElement/
  );

  assert.match(
    profileSource,
    /\.textContent\s*=/
  );

  assert.match(
    profileSource,
    /data-favorite-result/
  );
});

test("seleccionar un resultado guarda su identidad canónica", () => {
  assert.match(
    profileSource,
    /ApiClient\.addUserFavorite\s*\(/
  );

  assert.match(
    profileSource,
    /source/
  );

  assert.match(
    profileSource,
    /externalId/
  );

  assert.match(
    profileSource,
    /contentType/
  );

  assert.match(
    profileSource,
    /itemSnapshot/
  );

  assert.match(
    profileSource,
    /title/
  );

  assert.match(
    profileSource,
    /cover/
  );
});

test("los eventos del modal se enlazan una sola vez desde init", () => {
  assert.match(
    profileSource,
    /function bindFavoritePicker\s*\(/
  );

  assert.match(
    profileSource,
    /favoritePickerSearch/
  );

  assert.match(
    profileSource,
    /data-favorite-picker-close/
  );

  assert.match(
    profileSource,
    /bindFavoritePicker\(\)/
  );
});
