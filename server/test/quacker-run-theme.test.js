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

test("Quacker Run reutiliza la preferencia pública de tema de Quacker", () => {
  assert.match(
    source,
    /localStorage\.getItem\(\s*["']quacker_theme["']\s*\)/,
    "debe leer la misma preferencia quacker_theme que la landing"
  );

  assert.match(
    source,
    /classList\.toggle\(\s*["']dark-theme["']/,
    "debe aplicar el patrón body.dark-theme de Quacker"
  );
});

test("Quacker Run define su tema oscuro mediante body.dark-theme", () => {
  assert.match(
    css,
    /body\.dark-theme\s*\{/,
    "el CSS debe definir variables oscuras bajo body.dark-theme"
  );
});

test("el tema explícito de Quacker no queda sobrescrito por el sistema", () => {
  assert.doesNotMatch(
    css,
    /@media\s*\(\s*prefers-color-scheme\s*:\s*dark\s*\)/,
    "no debe mantenerse prefers-color-scheme: dark si existe una preferencia explícita de Quacker"
  );
});
