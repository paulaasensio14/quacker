import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const root = new URL("../../", import.meta.url);

const cssPath = new URL(
  "assets/css/design-forms.css",
  root
);

const css = fs.existsSync(cssPath)
  ? fs.readFileSync(cssPath, "utf8")
  : "";

const landing = fs.readFileSync(
  new URL("index.html", root), "utf8"
);

const dashboard = fs.readFileSync(
  new URL("dashboard.html", root), "utf8"
);

const publicProfile = fs.readFileSync(
  new URL("public-profile.html", root), "utf8"
);

function checkCss(...patterns) {
  assert.ok(
    css.length > 0,
    "Debe existir la hoja DS-05"
  );

  for (const pattern of patterns) {
    assert.match(css, pattern);
  }
}

function checkLink(html, previous) {
  const target =
    'href="assets/css/design-forms.css"';

  const absolute =
    'href="/assets/css/design-forms.css"';

  const count =
    html.split(target).length - 1 +
    html.split(absolute).length - 1;

  assert.equal(
    count, 1,
    "La hoja DS-05 debe cargarse una sola vez"
  );

  const position = Math.max(
    html.indexOf(target),
    html.indexOf(absolute)
  );

  assert.ok(
    position > html.indexOf(previous),
    "DS-05 debe cargarse despues de CSS previo"
  );
}

// DS-05.1 — Base y conexiones

test("DS-05.1: existe hoja de formularios", () => {
  assert.ok(fs.existsSync(cssPath));
  assert.ok(css.length > 0);
});

test("DS-05.1: hoja cargada en landing", () => {
  checkLink(
    landing,
    "design-typography.css"
  );
});

test("DS-05.1: hoja cargada en dashboard", () => {
  checkLink(
    dashboard,
    "design-controls.css"
  );
});

test("DS-05.1: hoja cargada en perfil publico", () => {
  checkLink(
    publicProfile,
    "design-typography.css"
  );
});

// Dimensiones y ambitos

test("DS-05.1: alturas 40 y 44 responsive", () => {
  checkCss(
    /--q-field-height\s*:\s*40px/,
    /--q-field-height-mobile\s*:\s*44px/,
    /@media\s*\(max-width:/
  );
});

test("DS-05.1: campos de acceso y registro", () => {
  checkCss(
    /\.form-input/,
    /\.input-field-auth/,
    /var\(--q-surface\)/,
    /var\(--q-border\)/
  );
});

test("DS-05.1: campos del perfil y modales", () => {
  checkCss(
    /\.profile-form-group/,
    /\.modal-field/,
    /var\(--q-radius-control\)/
  );
});

test("DS-05.1: campos de perfil publico", () => {
  checkCss(
    /\.public-profile-report-form/,
    /select/,
    /textarea/
  );
});

// Etiquetas y estados

test("DS-05.1: etiquetas de campo", () => {
  checkCss(
    /\.form-label/,
    /\.form-label-auth/,
    /\.profile-form-group\s+label/,
    /var\(--q-text\)/
  );
});

test("DS-05.1: foco visible accesible", () => {
  checkCss(
    /:focus-visible/,
    /:focus-within/,
    /var\(--q-info\)/
  );
});

test("DS-05.1: estado de error explicito", () => {
  checkCss(
    /\[aria-invalid=["']true["']\]/,
    /\.is-invalid/,
    /var\(--q-danger\)/
  );
});

test("DS-05.1: estado correcto explicito", () => {
  checkCss(
    /\.is-valid|data-state=["']success["']/,
    /var\(--q-success\)/
  );
});

test("DS-05.1: desactivado y solo lectura", () => {
  checkCss(
    /:disabled/,
    /:read-only|\[readonly\]/,
    /var\(--q-surface-2\)/
  );
});

test("DS-05.1: placeholder y areas de texto", () => {
  checkCss(
    /::placeholder/,
    /var\(--q-text-3\)/,
    /textarea/,
    /resize:\s*vertical/
  );
});

test("DS-05.1: selector publico conserva radio sin DS-03", () => {
  const section = css.split(
    "/* D. Select nativo de perfil publico */"
  )[1] ?? "";

  assert.match(
    section,
    /\.public-profile-report-form select\s*\{[^}]*border-radius:\s*var\(--q-field-radius\)\s*;/
  );
});
