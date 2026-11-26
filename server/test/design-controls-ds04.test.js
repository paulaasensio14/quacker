import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const root = new URL("../../", import.meta.url);

const cssPath = new URL(
  "assets/css/design-controls.css",
  root
);

const htmlPath = new URL(
  "dashboard.html",
  root
);

const css = fs.existsSync(cssPath)
  ? fs.readFileSync(cssPath, "utf8")
  : "";

const html = fs.readFileSync(
  htmlPath,
  "utf8"
);

function checkCss(...patterns) {
  assert.ok(
    css.length > 0,
    "Debe existir la hoja CSS DS-04"
  );

  for (const pattern of patterns) {
    assert.match(css, pattern);
  }
}

test("DS-04: hoja de estilos disponible", () => {
  assert.ok(fs.existsSync(cssPath));
  assert.ok(css.length > 0);
});

test("DS-04: CSS cargado despues de DS-03", () => {
  const shape = html.indexOf(
    'href="assets/css/design-shape.css"'
  );

  const controls = html.indexOf(
    'href="assets/css/design-controls.css"'
  );

  assert.ok(shape >= 0);
  assert.ok(controls > shape);

  assert.equal(
    html.split(
      'href="assets/css/design-controls.css"'
    ).length - 1,
    1
  );
});

test("DS-04: boton principal", () => {
  checkCss(
    /\.btn-primary/,
    /var\(--q-brand\)/,
    /var\(--q-elevation-stamp\)/
  );
});

test("DS-04: boton secundario", () => {
  checkCss(
    /\.btn-secondary/,
    /var\(--q-surface\)/,
    /var\(--q-border\)/
  );
});

test("DS-04: boton fantasma", () => {
  checkCss(
    /\.btn-ghost/,
    /background:\s*transparent/
  );
});

test("DS-04: peligro y peligro suave", () => {
  checkCss(
    /\.btn-danger/,
    /\.q-btn-danger-soft/,
    /var\(--q-danger\)/
  );
});

test("DS-04: hover, pulsado y foco", () => {
  checkCss(
    /:hover/,
    /:active/,
    /:focus-visible/,
    /outline:/,
    /outline-offset:/
  );
});

test("DS-04: estados desactivados", () => {
  checkCss(
    /:disabled/,
    /\[aria-disabled="true"\]/,
    /cursor:\s*not-allowed/
  );
});

test("DS-04: estado cargando", () => {
  checkCss(
    /\.is-loading/,
    /\[aria-busy="true"\]/,
    /animation:/
  );
});

test("DS-04: tamanos y botones con icono", () => {
  checkCss(
    /\.btn-sm/,
    /\.q-btn-lg/,
    /\.q-btn-icon/,
    /min-width:/,
    /min-height:/
  );
});

test("DS-04: chips de filtro", () => {
  checkCss(
    /\.pill-filter/,
    /\.pill-filter-sm/,
    /\.active/
  );
});

test("DS-04: etiquetas de contenido y estado", () => {
  checkCss(
    /\.cw-type-chip/,
    /\.lib-status-badge/,
    /\.q-tag/
  );
});

test("DS-04: contadores e indicadores", () => {
  checkCss(
    /\.notif-badge/,
    /\.q-status-dot/,
    /var\(--q-radius-label\)/
  );
});

test("DS-04: tema oscuro y movimiento reducido", () => {
  checkCss(
    /body\.dark-theme/,
    /prefers-reduced-motion/
  );
});
