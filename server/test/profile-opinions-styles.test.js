import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const css = fs.readFileSync(
  new URL("../../assets/css/dashboard.css", import.meta.url),
  "utf8"
);

test("Mis opiniones usa una rejilla de tres métricas", () => {
  assert.match(css, /\.profile-opinions-metrics\s*\{/);
  assert.match(css, /grid-template-columns:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\)/);
});

test("cada métrica tiene una presentación compacta", () => {
  assert.match(css, /\.profile-opinions-metric\s*\{/);
  assert.match(css, /display:\s*flex/);
  assert.match(css, /flex-direction:\s*column/);
});

test("la última opinión tiene un bloque diferenciado", () => {
  assert.match(css, /\.profile-opinions-latest\s*\{/);
  assert.match(css, /border-radius:/);
  assert.match(css, /background:/);
});

test("la tarjeta de opiniones tiene espaciado interno coherente", () => {
  assert.match(css, /\.profile-opinions-card\s*\{/);
  assert.match(css, /display:\s*flex/);
  assert.match(css, /flex-direction:\s*column/);
  assert.match(css, /gap:/);
});

test("Mis opiniones se adapta a móvil", () => {
  assert.match(
    css,
    /@media\s*\([^)]*max-width[^)]*\)[\s\S]*\.profile-opinions-metrics/
  );
});
