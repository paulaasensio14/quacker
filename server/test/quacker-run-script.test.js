import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const html = fs.readFileSync(
  new URL("../../404.html", import.meta.url),
  "utf8"
);

const scriptUrl = new URL(
  "../../assets/js/quacker-run.js",
  import.meta.url
);

test("la 404 carga Quacker Run desde un script externo", () => {
  assert.match(
    html,
    /<script[^>]+src=["']\/assets\/js\/quacker-run\.js["'][^>]*><\/script>/i,
    "404.html debe cargar /assets/js/quacker-run.js"
  );
});

test("existe el controlador JavaScript de Quacker Run", () => {
  assert.equal(
    fs.existsSync(scriptUrl),
    true,
    "debe existir assets/js/quacker-run.js"
  );
});
