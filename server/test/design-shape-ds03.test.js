import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const root = new URL("../../", import.meta.url);
const cssPath = new URL(
  "assets/css/design-shape.css",
  root
);

const css = fs.existsSync(cssPath)
  ? fs.readFileSync(cssPath, "utf8")
  : "";

const html = fs.readFileSync(
  new URL("dashboard.html", root),
  "utf8"
);

test("DS-03: hoja de estilos disponible", () => {
  assert.ok(fs.existsSync(cssPath));
});

test("DS-03: espaciados en escala de cuatro", () => {
  for (const [name, value] of [
    ["1", "4px"],
    ["2", "8px"],
    ["3", "12px"],
    ["4", "16px"],
    ["5", "20px"],
    ["6", "24px"],
    ["8", "32px"],
    ["12", "48px"]
  ]) {
    assert.ok(
      css.includes(`--q-space-${name}: ${value};`)
    );
  }
});

test("DS-03: radios oficiales", () => {
  for (const [name, value] of [
    ["label", "6px"],
    ["control", "10px"],
    ["card", "14px"],
    ["overlay", "20px"]
  ]) {
    assert.ok(
      css.includes(`--q-radius-${name}: ${value};`)
    );
  }
});

test("DS-03: niveles de elevacion", () => {
  assert.match(css, /--q-elevation-flat:/);
  assert.match(css, /--q-elevation-card:/);
  assert.match(css, /--q-elevation-overlay:/);
  assert.match(css, /--q-elevation-stamp:/);
});

test("DS-03: iconos de trazo uniforme", () => {
  assert.match(css, /\.nav-item-btn\s*>\s*svg/);
  assert.match(css, /\.sidebar-toggle\s*>\s*svg/);
  assert.match(css, /\.search-icon\s*>\s*svg/);
  assert.match(css, /stroke-width:\s*1\.8/);
  assert.match(css, /stroke-linecap:\s*round/);
  assert.match(css, /stroke-linejoin:\s*round/);
});

test("DS-03: navegacion y controles", () => {
  assert.match(css, /\.sidebar:not\(\.collapsed\) \.nav-item-btn/);
  assert.match(css, /\.search-input/);
  assert.match(css, /var\(--q-radius-control\)/);
});

test("DS-03: tarjetas y banner", () => {
  assert.match(css, /\.metric-card/);
  assert.match(css, /\.content-card/);
  assert.match(css, /\.welcome-banner/);
  assert.match(css, /var\(--q-radius-card\)/);
  assert.match(css, /var\(--q-elevation-card\)/);
});

test("DS-03: modales y menus", () => {
  assert.match(css, /\.modal-card/);
  assert.match(css, /\.notif-panel/);
  assert.match(css, /var\(--q-radius-overlay\)/);
  assert.match(css, /var\(--q-elevation-overlay\)/);
});

test("DS-03: CSS cargado despues de DS-02", () => {
  const before = html.indexOf(
    "assets/css/design-typography.css"
  );
  const after = html.indexOf(
    "assets/css/design-shape.css"
  );

  assert.ok(before >= 0);
  assert.ok(after > before);
});

test("DS-03: sin cambiar colores ni circulos", () => {
  assert.ok(css.length > 0);
  assert.doesNotMatch(
    css,
    /#[0-9a-fA-F]{3,8}\b/
  );
  assert.doesNotMatch(
    css,
    /\.theme-toggle|\.theme-knob|\.avatar-circle/
  );
});
