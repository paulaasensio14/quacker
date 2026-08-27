import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const html = fs.readFileSync(
  new URL("../../404.html", import.meta.url),
  "utf8"
);

const cssUrl = new URL(
  "../../assets/css/quacker-run.css",
  import.meta.url
);

test("Quacker Run usa una hoja de estilos externa compatible con CSP", () => {
  assert.match(
    html,
    /<link[^>]+rel=["']stylesheet["'][^>]+href=["']\/assets\/css\/quacker-run\.css["'][^>]*>/i,
    "404.html debe cargar /assets/css/quacker-run.css"
  );

  assert.equal(
    fs.existsSync(cssUrl),
    true,
    "debe existir assets/css/quacker-run.css"
  );
});

test("la 404 no conserva estilos inline bloqueados por CSP", () => {
  assert.doesNotMatch(
    html,
    /<style\b/i,
    "404.html no debe contener bloques <style> inline"
  );
});
