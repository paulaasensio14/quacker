import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const css = fs.readFileSync(
  new URL("../../assets/css/dashboard.css", import.meta.url),
  "utf8"
);

test("la cabecera de la vista completa tiene layout propio", () => {
  assert.match(css, /\.profile-opinions-view-header\s*\{/);
});

test("la lista completa tiene estructura visual propia", () => {
  assert.match(css, /\.profile-opinions-list\s*\{/);
  assert.match(css, /\.profile-opinions-list-item\s*\{/);
  assert.match(css, /\.profile-opinions-list-item-header\s*\{/);
});

test("la valoración personal de la lista tiene estilo de pato compacto", () => {
  assert.match(css, /\.profile-opinions-list-rating\s*\{/);
  assert.match(css, /\.profile-opinions-list-rating-duck\s*\{/);
});

test("las reseñas y el estado vacío tienen estilos propios", () => {
  assert.match(css, /\.profile-opinions-list-review\s*\{/);
  assert.match(css, /\.profile-opinions-list-empty\s*\{/);
});

test("la vista completa contempla modo oscuro", () => {
  assert.match(
    css,
    /body\.dark-theme\s+\.profile-opinions-list-item/
  );
});

test("la vista completa contempla móvil", () => {
  assert.match(
    css,
    /@media\s*\(max-width:\s*520px\)[\s\S]*\.profile-opinions-view-header/
  );
});
