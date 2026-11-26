import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

function read(relative) {
  return fs.readFileSync(
    new URL("../../" + relative, import.meta.url),
    "utf8"
  );
}

const css = read("assets/css/design-cards.css");
const home = read("assets/js/app/home-lists-ui.js");
const lists = read("assets/js/app/lists.js");

// Cuatro contratos existentes que deben mantenerse.

test("DS-06.2: Continuar mantiene tarjetas y progreso", () => {
  assert.match(home, /function renderContinueWatching\(\)/);
  assert.match(home, /class="cw-card\$\{completedClass\}"/);
  assert.match(home, /class="cw-progress-fill"/);
});

test("DS-06.2: Continuar mantiene accion real", () => {
  assert.match(
    home,
    /continueGrid\.querySelectorAll\("\.cw-tick-btn"\)/
  );
  assert.match(home, /applyProgressTick\(id, btn\)/);
});

test("DS-06.2: Listas mantiene mosaicos y vacios", () => {
  assert.match(lists, /function _renderListCover\(/);
  assert.match(lists, /class="list-cover-collage"/);
  assert.match(lists, /class="list-cover list-cover--empty"/);
  assert.match(lists, /class="cover-count-pill"/);
});

test("DS-06.2: Listas conserva modos y visibilidad", () => {
  assert.match(lists, /lists-grid--list/);
  assert.match(lists, /lists-grid--cards/);
  assert.match(lists, /class="list-card"/);
  assert.match(lists, /_visibilityLabel\(list.visibility\)/);
});

// Diecisiete requisitos nuevos.

test("DS-06.2: superficie de tarjetas Continuar", () => {
  assert.match(css, /#view-home\s+\.cw-card\s*\{/);
  assert.match(css, /var\(--q-surface\)/);
});

test("DS-06.2: portada de Continuar", () => {
  assert.match(css, /#view-home\s+\.cw-cover\s*\{/);
});

test("DS-06.2: titulos de Continuar", () => {
  assert.match(css, /#view-home\s+\.cw-title\s*\{/);
  assert.match(css, /-webkit-line-clamp:\s*2/);
});

test("DS-06.2: barra de progreso", () => {
  assert.match(css, /#view-home\s+\.cw-progress-bar\s*\{/);
});

test("DS-06.2: accion de avance", () => {
  assert.match(css, /#view-home\s+\.cw-tick-btn\s*\{/);
});

test("DS-06.2: estado completado", () => {
  assert.match(css, /#view-home\s+\.cw-card--completed\s*\{/);
});

test("DS-06.2: superficie de tarjetas de listas", () => {
  assert.match(css, /#view-lists\s+\.list-card\s*\{/);
});

test("DS-06.2: portada de lista", () => {
  assert.match(css, /#view-lists\s+\.list-cover\s*\{/);
});

test("DS-06.2: mosaico de portadas", () => {
  assert.match(css, /#view-lists\s+\.list-cover-collage\s*\{/);
});

test("DS-06.2: lista sin portada", () => {
  assert.match(css, /#view-lists\s+\.list-cover--empty\s*\{/);
});

test("DS-06.2: modo lista horizontal", () => {
  assert.match(
    css,
    /#listsGrid\.lists-grid--list\s+\.list-card\s*\{/
  );
});

test("DS-06.2: estado de visibilidad", () => {
  assert.match(css, /#view-lists\s+\.list-visibility\s*\{/);
});

test("DS-06.2: adaptacion movil", () => {
  assert.match(
    css,
    /@media\s*\(max-width:\s*640px\)[\s\S]*?#view-home\s+\.cw-card/
  );
  assert.match(
    css,
    /@media\s*\(max-width:\s*640px\)[\s\S]*?#listsGrid\.lists-grid--list/
  );
});

test("DS-06.2: tema oscuro", () => {
  assert.match(
    css,
    /body\.dark-theme\s+#view-home\s+\.cw-card/
  );
  assert.match(
    css,
    /body\.dark-theme\s+#view-lists\s+\.list-card/
  );
});

test("DS-06.2: movimiento reducido", () => {
  assert.match(
    css,
    /@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*?#view-home\s+\.cw-card/
  );
});

test("DS-06.2: textos dinamicos de Continuar seguros", () => {
  assert.match(
    home,
    /\$\{_escapeHomeAttribute\(item\.title\)\}/
  );
  assert.match(
    home,
    /\$\{_escapeHomeAttribute\(item\.progressLabel\)\}/
  );
  assert.match(
    home,
    /_escapeHomeAttribute\(item\.platform\)/
  );
});

test("DS-06.2: nombres y descripciones de listas seguros", () => {
  assert.match(
    lists,
    /const name = _safeAttr\(list\.name\)/
  );
  assert.match(
    lists,
    /const desc = _safeAttr\(list\.description\)/
  );
  assert.match(
    lists,
    /data-id="\$\{_safeAttr\(list\.id\)\}"/
  );
});
