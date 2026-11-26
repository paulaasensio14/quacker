import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../.."
);

const read = relative => fs.readFileSync(
  path.join(root, relative),
  "utf8"
);

const cssPath = path.join(
  root, "assets/css/design-cards.css"
);

const css = fs.existsSync(cssPath)
  ? fs.readFileSync(cssPath, "utf8")
  : "";

const dashboard = read("dashboard.html");
const publicPage = read("public-profile.html");
const explore = read("assets/js/app/explore.js");
const library = read("assets/js/app/library.js");
const publicProfile = read(
  "assets/js/app/public-profile.js"
);

// Tres contratos existentes que deben conservarse.

test("DS-06.1: Explorar conserva apertura de fichas", () => {
  assert.match(
    explore,
    /class="explore-card explore-card--poster"/
  );
  assert.match(
    explore,
    /data-action="open-item-detail"/
  );
  assert.match(
    explore,
    /explore-cover\.is-fallback|class="explore-cover is-fallback"/
  );
});

test("DS-06.1: Biblioteca conserva tarjetas y progreso", () => {
  assert.match(library, /class="lib-card /);
  assert.match(library, /class="lib-cover"/);
  assert.match(library, /class="lib-cover-progress"/);
});

test("DS-06.1: perfil publico conserva tarjetas", () => {
  assert.match(
    publicProfile,
    /function createFavoriteCard\(item\)/
  );
  assert.match(
    publicProfile,
    /public-profile-favorite/
  );
  assert.match(
    publicProfile,
    /public-profile-favorite-cover/
  );
});

// Doce requisitos nuevos, inicialmente rojos.

test("DS-06.1: existe hoja de estilos independiente", () => {
  assert.ok(
    fs.existsSync(cssPath),
    "Falta assets/css/design-cards.css"
  );
});

test("DS-06.1: dashboard carga estilos al final", () => {
  assert.match(
    dashboard,
    /href="assets\/css\/design-forms\.css"[\s\S]*href="assets\/css\/design-cards\.css"/
  );
});

test("DS-06.1: perfil publico carga estilos al final", () => {
  assert.match(
    publicPage,
    /href="\/assets\/css\/design-forms\.css"[\s\S]*href="\/assets\/css\/design-cards\.css"/
  );
});

test("DS-06.1: Explorar distingue portada y pie", () => {
  assert.match(
    explore,
    /class="explore-card-caption"/
  );
});

test("DS-06.1: Explorar muestra titulo visible", () => {
  assert.match(
    explore,
    /class="explore-card-caption-title"/
  );
});

test("DS-06.1: Explorar dispone de metadatos", () => {
  assert.match(
    explore,
    /class="explore-card-caption-meta"/
  );
});

test("DS-06.1: estilos de tarjeta Explorar", () => {
  assert.match(css, /\.explore-card--poster/);
  assert.match(css, /\.explore-card-caption/);
  assert.match(css, /var\(--q-radius-card\)/);
});

test("DS-06.1: estilos de Biblioteca y progreso", () => {
  assert.match(css, /#view-library\s+\.lib-card/);
  assert.match(css, /\.lib-cover-progress/);
});

test("DS-06.1: tarjetas de favoritos publicos", () => {
  assert.match(css, /\.public-profile-favorite/);
  assert.match(css, /\.public-profile-favorite-cover/);
});

test("DS-06.1: portada no disponible", () => {
  assert.match(
    css,
    /\.explore-cover\.is-fallback/
  );
  assert.match(
    css,
    /var\(--q-surface-2\)/
  );
});

test("DS-06.1: foco accesible en las tarjetas", () => {
  assert.match(
    css,
    /\.explore-card--poster:focus-visible/
  );
  assert.match(
    css,
    /outline-offset/
  );
});

test("DS-06.1: temas, movil y movimiento reducido", () => {
  assert.match(css, /body\.dark-theme/);
  assert.match(
    css,
    /@media\s*\(max-width:\s*640px\)/
  );
  assert.match(
    css,
    /@media\s*\(prefers-reduced-motion:\s*reduce\)/
  );
});

test("DS-06.1: perfil publico resuelve tokens ausentes", () => {
  const block = css.match(
    /\.public-profile-favorite\s*\{([^{}]*)\}/
  )?.[1] || "";

  assert.match(
    block,
    /border-radius:\s*var\(--q-radius-card,\s*14px\)/
  );

  assert.match(
    block,
    /box-shadow:\s*var\(--q-elevation-card,\s*0 2px 8px rgb\(0 0 0 \/ 8%\)\)/
  );
});
