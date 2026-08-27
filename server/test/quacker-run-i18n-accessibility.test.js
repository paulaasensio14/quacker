import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const html = fs.readFileSync(
  new URL("../../404.html", import.meta.url),
  "utf8"
);

const i18n = fs.readFileSync(
  new URL("../../assets/js/app/i18n.js", import.meta.url),
  "utf8"
);

test("los controles táctiles traducen su nombre accesible", () => {
  assert.match(
    html,
    /class=["'][^"']*run-touch-controls[^"']*["'][\s\S]*?data-i18n-aria-label=["']quacker_run_touch_controls_label["']/,
    "los controles táctiles deben usar data-i18n-aria-label"
  );
});

test("existe la etiqueta accesible de controles táctiles en español", () => {
  assert.match(
    i18n,
    /quacker_run_touch_controls_label\s*:\s*["']Controles táctiles de Quacker Run["']/,
    "debe existir la traducción española"
  );
});

test("existe la etiqueta accesible de controles táctiles en inglés", () => {
  assert.match(
    i18n,
    /quacker_run_touch_controls_label\s*:\s*["']Quacker Run touch controls["']/,
    "debe existir la traducción inglesa"
  );
});
