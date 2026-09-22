import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const cssSource = fs.readFileSync(
  new URL(
    "../../assets/css/dashboard.css",
    import.meta.url
  ),
  "utf8"
);

test("favoritos del perfil tiene estilos para grupos y slots", () => {
  assert.match(
    cssSource,
    /\.profile-favorites-groups/
  );

  assert.match(
    cssSource,
    /\.profile-favorites-group/
  );

  assert.match(
    cssSource,
    /\.profile-favorite-slot/
  );

  assert.match(
    cssSource,
    /\.profile-favorite-slot--empty/
  );

  assert.match(
    cssSource,
    /\.profile-favorite-slot-actions/
  );
});

test("las acciones de favoritos tienen estados de interacción accesibles", () => {
  assert.match(
    cssSource,
    /\.profile-favorite-action/
  );

  assert.match(
    cssSource,
    /\.profile-favorite-pick/
  );

  assert.match(
    cssSource,
    /profile-favorite-action:focus-visible/
  );

  assert.match(
    cssSource,
    /profile-favorite-pick:focus-visible/
  );
});

test("el selector de favoritos tiene estilos propios", () => {
  assert.match(
    cssSource,
    /\.favorite-picker-search/
  );

  assert.match(
    cssSource,
    /\.favorite-picker-results/
  );

  assert.match(
    cssSource,
    /\.favorite-picker-result/
  );

  assert.match(
    cssSource,
    /\.favorite-picker-status/
  );
});

test("favoritos contempla modo oscuro", () => {
  assert.match(
    cssSource,
    /body\.dark-theme[\s\S]*profile-favorite/
  );

  assert.match(
    cssSource,
    /body\.dark-theme[\s\S]*favorite-picker/
  );
});

test("favoritos tiene adaptación móvil", () => {
  assert.match(
    cssSource,
    /@media\s*\(max-width:\s*520px\)[\s\S]*profile-favorites/
  );

  assert.match(
    cssSource,
    /@media\s*\(max-width:\s*520px\)[\s\S]*favorite-picker/
  );
});
