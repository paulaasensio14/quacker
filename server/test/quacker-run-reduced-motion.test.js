import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const css = fs.readFileSync(
  new URL("../../assets/css/quacker-run.css", import.meta.url),
  "utf8"
);

const source = fs.readFileSync(
  new URL("../../assets/js/quacker-run.js", import.meta.url),
  "utf8"
);

test("Quacker Run contempla prefers-reduced-motion en sus estilos", () => {
  assert.match(
    css,
    /@media\s*\(\s*prefers-reduced-motion\s*:\s*reduce\s*\)/,
    "debe existir una regla CSS para usuarios que reducen movimiento"
  );

  assert.match(
    css,
    /animation-duration\s*:\s*0\.01ms/,
    "las animaciones decorativas deben reducirse prácticamente a cero"
  );

  assert.match(
    css,
    /transition-duration\s*:\s*0\.01ms/,
    "las transiciones decorativas deben reducirse prácticamente a cero"
  );
});

test("Quacker Run conoce la preferencia de movimiento del navegador", () => {
  assert.match(
    source,
    /window\.matchMedia\(\s*["']\(prefers-reduced-motion:\s*reduce\)["']\s*\)/,
    "el controlador debe consultar prefers-reduced-motion"
  );

  assert.match(
    source,
    /prefersReducedMotion/,
    "debe conservarse el estado de preferencia de movimiento"
  );
});
