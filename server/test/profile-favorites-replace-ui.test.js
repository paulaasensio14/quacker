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

test("cada favorito ocupado ofrece una acción para reemplazarlo", () => {
  assert.match(
    profileSource,
    /setAttribute\(\s*["']data-favorite-action["']\s*,\s*["']replace["']\s*\)/
  );

  assert.match(
    profileSource,
    /profile_favorites_replace/
  );
});

test("reemplazar abre el selector conservando tipo y posición", () => {
  assert.match(
    profileSource,
    /action === ["']replace["']/
  );

  assert.match(
    profileSource,
    /openFavoritePicker\s*\(/
  );

  assert.match(
    profileSource,
    /position/
  );
});

test("el contexto del selector distingue añadir de reemplazar", () => {
  assert.match(
    profileSource,
    /favoritePickerContext/
  );

  assert.match(
    profileSource,
    /mode/
  );

  assert.match(
    profileSource,
    /["']replace["']/
  );

  assert.match(
    profileSource,
    /["']add["']/
  );
});

test("al elegir contenido usa replaceUserFavorite cuando corresponde", () => {
  assert.match(
    profileSource,
    /ApiClient\.replaceUserFavorite\s*\(/
  );

  assert.match(
    profileSource,
    /favoritePickerContext\?\.position/
  );
});
