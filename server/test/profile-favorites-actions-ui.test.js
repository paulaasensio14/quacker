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

test("los slots de favoritos exponen acciones accesibles", () => {
  for (const action of [
    "pick",
    "remove",
    "move-up",
    "move-down"
  ]) {
    assert.match(
      profileSource,
      new RegExp(
        `data-favorite-action.*${action}|${action}.*data-favorite-action`
      ),
      `falta la acción ${action}`
    );
  }

  assert.match(
    profileSource,
    /button/
  );
});

test("ProfileModule enlaza una sola vez las acciones de favoritos", () => {
  assert.match(
    profileSource,
    /function bindFavoriteActions\s*\(/
  );

  assert.match(
    profileSource,
    /profileFavoritesCard/
  );

  assert.match(
    profileSource,
    /addEventListener\(["']click["']/
  );

  assert.match(
    profileSource,
    /bindFavoriteActions\(\)/
  );
});

test("eliminar un favorito usa ApiClient y vuelve a renderizar", () => {
  assert.match(
    profileSource,
    /ApiClient\.removeUserFavorite\s*\(/
  );

  assert.match(
    profileSource,
    /renderFavorites\s*\(/
  );
});

test("cambiar el orden usa la operación atómica moveUserFavorite", () => {
  assert.match(
    profileSource,
    /ApiClient\.moveUserFavorite\s*\(/
  );

  assert.match(
    profileSource,
    /move-up/
  );

  assert.match(
    profileSource,
    /move-down/
  );
});
