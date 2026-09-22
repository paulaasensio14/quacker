import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const dashboardSource = fs.readFileSync(
  new URL("../../dashboard.html", import.meta.url),
  "utf8"
);

test("Mi perfil incluye la tarjeta de gestión de favoritos", () => {
  assert.match(
    dashboardSource,
    /id="profileFavoritesCard"/
  );

  assert.match(
    dashboardSource,
    /data-i18n="profile_favorites_title"/
  );

  assert.match(
    dashboardSource,
    /data-i18n="profile_favorites_description"/
  );
});

test("la tarjeta de favoritos incluye las cuatro categorías canónicas", () => {
  for (const type of [
    "pelicula",
    "serie",
    "game",
    "book"
  ]) {
    assert.match(
      dashboardSource,
      new RegExp(
        `data-favorite-type=["']${type}["']`
      ),
      `falta la categoría ${type}`
    );

    assert.match(
      dashboardSource,
      new RegExp(
        `data-favorite-slots=["']${type}["']`
      ),
      `falta el contenedor de slots de ${type}`
    );
  }
});

test("la zona de favoritos anuncia sus cambios de forma accesible", () => {
  assert.match(
    dashboardSource,
    /id="profileFavoritesStatus"/
  );

  assert.match(
    dashboardSource,
    /aria-live="polite"/
  );
});
