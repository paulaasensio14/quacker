import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const html = fs.readFileSync(
  new URL("../../404.html", import.meta.url),
  "utf8"
);

test("la página 404 incluye la estructura base de Quacker Run", () => {
  assert.match(
    html,
    /id=["']quackerRun["']/,
    "debe existir la zona principal de Quacker Run"
  );

  assert.match(
    html,
    /id=["']quackerRunScore["']/,
    "debe existir un marcador visible"
  );

  assert.match(
    html,
    /id=["']quackerRunStart["']/,
    "debe existir un control para iniciar o reiniciar"
  );
});

test("Quacker Run mantiene navegación y ayuda accesible", () => {
  assert.match(
    html,
    /href=["']\/["']/,
    "la 404 debe seguir permitiendo volver al inicio"
  );

  assert.match(
    html,
    /id=["']quackerRunInstructions["']/,
    "deben existir instrucciones del juego"
  );

  assert.match(
    html,
    /aria-live=["']polite["']/,
    "debe existir una región para anunciar el estado del juego"
  );
});
