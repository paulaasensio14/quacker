import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const source = fs.readFileSync(
  new URL("../../assets/js/quacker-run.js", import.meta.url),
  "utf8"
);

test("Quacker Run define la mecánica de salto del pato", () => {
  assert.match(
    source,
    /function\s+jumpDuck\s*\(/,
    "debe existir una función jumpDuck"
  );

  assert.match(
    source,
    /duck\.style\.transform\s*=/,
    "el salto debe actualizar visualmente la posición del pato"
  );
});

test("Quacker Run permite saltar con teclado", () => {
  assert.match(
    source,
    /document\.addEventListener\(\s*["']keydown["']/,
    "debe escuchar el teclado"
  );

  assert.match(
    source,
    /["']Space["'][\s\S]*?["']ArrowUp["']|["']ArrowUp["'][\s\S]*?["']Space["']/,
    "debe aceptar Espacio y Flecha arriba"
  );

  assert.match(
    source,
    /jumpDuck\s*\(\s*\)/,
    "el control de teclado debe poder ejecutar jumpDuck"
  );
});

test("Quacker Run permite saltar tocando la zona de juego", () => {
  assert.match(
    source,
    /stage\.addEventListener\(\s*["']pointerdown["'][\s\S]*?handleJumpInput\s*\(\s*\)/,
    "la zona de juego debe permitir saltar con pointerdown"
  );
});
