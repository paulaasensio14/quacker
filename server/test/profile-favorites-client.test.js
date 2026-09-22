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

test("ProfileModule define las cuatro categorías y cuatro posiciones de favoritos", () => {
  for (const type of [
    "pelicula",
    "serie",
    "game",
    "book"
  ]) {
    assert.match(
      profileSource,
      new RegExp(`["']${type}["']`)
    );
  }

  assert.match(
    profileSource,
    /FAVORITES_PER_TYPE\s*=\s*4/
  );
});

test("ProfileModule carga los favoritos mediante ApiClient", () => {
  assert.match(
    profileSource,
    /async function loadFavoritesIntoProfile\s*\(/
  );

  assert.match(
    profileSource,
    /ApiClient\.getUserFavorites\s*\(/
  );
});

test("ProfileModule renderiza cuatro slots por categoría", () => {
  assert.match(
    profileSource,
    /function renderFavoriteSlots\s*\(/
  );

  assert.match(
    profileSource,
    /data-favorite-slots/
  );

  assert.match(
    profileSource,
    /FAVORITES_PER_TYPE/
  );

  assert.match(
    profileSource,
    /profile-favorite-slot/
  );

  assert.match(
    profileSource,
    /profile-favorite-slot--empty/
  );
});

test("la carga del perfil incluye los favoritos", () => {
  assert.match(
    profileSource,
    /loadFavoritesIntoProfile\(\)/
  );
});
