import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const html = readFileSync(
  new URL("../../dashboard.html", import.meta.url),
  "utf8"
);

const css = readFileSync(
  new URL("../../assets/css/dashboard.css", import.meta.url),
  "utf8"
);

test("Listas ofrece los cuatro filtros", () => {
  for (const filter of [
    "all",
    "public",
    "private",
    "collab"
  ]) {
    assert.match(
      html,
      new RegExp(`data-filter="${filter}"`)
    );
  }
});

test("Listas no oculta los filtros Publicas y Colaborativas", () => {
  assert.doesNotMatch(
    css,
    /#view-lists\s+\.pill-filter\[data-filter="public"\]\s*,\s*#view-lists\s+\.pill-filter\[data-filter="collab"\]\s*\{\s*display\s*:\s*none\s*;/,
    "Los filtros siguen ocultos mediante CSS"
  );
});
