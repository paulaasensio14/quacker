import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const root = new URL("../../", import.meta.url);

function read(path) {
  return fs.readFileSync(
    new URL(path, root),
    "utf8"
  );
}

const index = read("index.html");
const dashboard = read("dashboard.html");
const publicProfile = read("public-profile.html");
const profileTabsJS = read(
  "assets/js/app/profile-tabs.js"
);
const css = read("assets/css/design-forms.css");

const marker =
  "/* DS-05.3 — PESTAÑAS FILTROS Y SEGMENTADOS */";

const section = css.includes(marker)
  ? css.split(marker)[1]
  : "";

function checkCss(...patterns) {
  assert.ok(
    section.trim().length > 0,
    "Falta el bloque de estilos DS-05.3"
  );

  for (const pattern of patterns) {
    assert.match(section, pattern);
  }
}

/*
 * REGRESIONES EXISTENTES:
 * Estas tres pruebas deben pasar en rojo y verde.
 */

test("DS-05.3 REG: acceso mantiene sus botones", () => {
  assert.match(
    index,
    /id="authTabs"/
  );
  assert.match(
    index,
    /<button\b(?=[^>]*\bid="tabLogin")(?=[^>]*\bdata-mode="login")[^>]*>/
  );
  assert.match(
    index,
    /<button\b(?=[^>]*\bid="tabRegister")(?=[^>]*\bdata-mode="register")[^>]*>/
  );
});

test("DS-05.3 REG: Mi perfil mantiene aria-pressed y teclado", () => {
  assert.match(
    dashboard,
    /class="profile-settings-tabs"/
  );
  assert.match(
    dashboard,
    /data-profile-tab="perfil"\s+aria-pressed="true"/
  );
  assert.match(
    dashboard,
    /data-profile-tab="privacidad"\s+aria-pressed="false"/
  );
  assert.match(
    profileTabsJS,
    /"ArrowRight"/
  );
  assert.match(
    profileTabsJS,
    /"ArrowLeft"/
  );
  assert.match(
    profileTabsJS,
    /"Home"/
  );
  assert.match(
    profileTabsJS,
    /"End"/
  );
});

test("DS-05.3 REG: pestañas ARIA siguen presentes", () => {
  assert.match(
    dashboard,
    /id="listDetailTabs"[\s\S]*?role="tablist"/
  );
  assert.match(
    dashboard,
    /id="listDetailTabContent"[\s\S]*?role="tab"/
  );
  assert.match(
    dashboard,
    /class="community-profile-favorites-tabs"[\s\S]*?role="tablist"/
  );
  assert.match(
    publicProfile,
    /id="publicProfileFavoritesTabs"[\s\S]*?role="tablist"/
  );
  assert.match(
    publicProfile,
    /id="publicProfileFavoritesTab-pelicula"[\s\S]*?role="tab"/
  );
});

/*
 * NUEVOS ESTILOS:
 * Estas doce pruebas deben estar rojas
 * hasta implementar DS-05.3.
 */

test("DS-05.3 CSS: bloque independiente", () => {
  assert.ok(
    css.includes(marker),
    "Falta el marcador DS-05.3"
  );
  assert.ok(section.trim().length > 0);
});

test("DS-05.3 CSS: pestañas de autenticación", () => {
  checkCss(
    /\.auth-tabs/,
    /\.auth-tab\s*\{/,
    /var\(--q-border\)/
  );
});

test("DS-05.3 CSS: acceso activo y foco", () => {
  checkCss(
    /\.auth-tab\.active/,
    /\.auth-tab:focus-visible/,
    /var\(--q-info\)/
  );
});

test("DS-05.3 CSS: navegación de Mi perfil", () => {
  checkCss(
    /#view-profile\s+\.profile-settings-tabs button/,
    /\[aria-pressed="true"\]/
  );
});

test("DS-05.3 CSS: foco de Mi perfil", () => {
  checkCss(
    /\.profile-settings-tabs button:focus-visible/,
    /outline-offset:/
  );
});

test("DS-05.3 CSS: filtros existentes", () => {
  checkCss(
    /\.pill-filter-sm/,
    /\.pill-filter/,
    /\.pill-btn/
  );
});

test("DS-05.3 CSS: filtros seleccionados", () => {
  checkCss(
    /\.pill-filter-sm\.active/,
    /\.pill-filter\.active/,
    /var\(--q-filter-selected-bg\)/
  );
});

test("DS-05.3 CSS: cambio de vista en listas", () => {
  checkCss(
    /\.view-toggle button/,
    /\.view-toggle button\.active/,
    /\[aria-pressed="true"\]/
  );
});

test("DS-05.3 CSS: pestañas de listas colaborativas", () => {
  checkCss(
    /#listDetailTabs/,
    /\.list-detail-tab/,
    /\.list-detail-tab\[aria-selected="true"\]/
  );
});

test("DS-05.3 CSS: favoritos de comunidad", () => {
  checkCss(
    /\.community-profile-favorites-tab/,
    /\[aria-selected="true"\]/
  );
});

test("DS-05.3 CSS: favoritos de perfil público", () => {
  checkCss(
    /\.public-profile-favorites-tab/,
    /\[aria-selected="true"\]/
  );
});

test("DS-05.3 CSS: oscuro, móvil y movimiento reducido", () => {
  checkCss(
    /body\.dark-theme/,
    /@media\s*\(max-width:\s*640px\)/,
    /@media\s*\(prefers-reduced-motion:\s*reduce\)/
  );
});
