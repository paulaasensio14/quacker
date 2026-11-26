import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const root = new URL("../../", import.meta.url);

const css = fs.readFileSync(
  new URL("assets/css/design-forms.css", root),
  "utf8"
);

const marker =
  "/* DS-05.2 — BUSCADORES SELECTORES Y PRIVACIDAD */";

const section = css.includes(marker)
  ? css.split(marker)[1]
  : "";

function checkCss(...patterns) {
  assert.ok(
    section.trim().length > 0,
    "Debe existir el bloque CSS DS-05.2"
  );

  for (const pattern of patterns) {
    assert.match(section, pattern);
  }
}

test("DS-05.2: bloque de estilos disponible", () => {
  assert.ok(css.includes(marker));
  assert.ok(section.trim().length > 0);
});

test("DS-05.2: tokens y alturas comunes", () => {
  checkCss(
    /--q-field-height/,
    /var\(--q-border\)/,
    /var\(--q-surface\)/
  );
});

test("DS-05.2: buscadores de listas", () => {
  checkCss(
    /\.lists-search input/,
    /\.list-items-search input/
  );
});

test("DS-05.2: buscador de detalle de lista", () => {
  checkCss(
    /#listDetailSearch/,
    /min-width:|width:/
  );
});

test("DS-05.2: comunidad y favoritos", () => {
  checkCss(
    /\.community-search-input/,
    /\.favorite-picker-search input/
  );
});

test("DS-05.2: foco visible de busquedas", () => {
  checkCss(
    /:focus-visible|:focus-within/,
    /var\(--q-info\)/
  );
});

test("DS-05.2: selectores de ordenacion", () => {
  checkCss(
    /\.library-sort select/,
    /var\(--q-text\)/
  );
});

test("DS-05.2: selectores de filtros de listas", () => {
  checkCss(
    /\.list-items-controls\s+\.select-wrap select/,
    /var\(--q-radius-control\)/
  );
});

test("DS-05.2: visibilidad del perfil", () => {
  checkCss(
    /\.profile-privacy-row select/,
    /var\(--q-border\)/
  );
});

test("DS-05.2: casillas nativas de privacidad", () => {
  checkCss(
    /\.profile-privacy-row\s+input\[type="checkbox"\]/,
    /accent-color:/
  );
});

test("DS-05.2: casillas marcadas y desactivadas", () => {
  checkCss(
    /:checked/,
    /:disabled/,
    /:focus-visible/
  );
});

test("DS-05.2: modo oscuro y responsive", () => {
  checkCss(
    /body\.dark-theme/,
    /@media\s*\(max-width:\s*640px\)/,
    /--q-field-height-mobile/
  );
});
