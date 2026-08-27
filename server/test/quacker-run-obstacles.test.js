import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const source = fs.readFileSync(
  new URL("../../assets/js/quacker-run.js", import.meta.url),
  "utf8"
);

test("Quacker Run puede crear obstáculos dentro de la pista", () => {
  assert.match(
    source,
    /function\s+createObstacle\s*\(/,
    "debe existir una función createObstacle"
  );

  assert.match(
    source,
    /document\.createElement\(\s*["']div["']\s*\)/,
    "los obstáculos deben crearse como elementos de la interfaz"
  );

  assert.match(
    source,
    /className\s*=\s*["'][^"']*run-obstacle[^"']*["']/,
    "los obstáculos deben usar la clase run-obstacle"
  );

  assert.match(
    source,
    /stage\.appendChild\(/,
    "los obstáculos deben añadirse a la zona de juego"
  );
});

test("Quacker Run desplaza y elimina los obstáculos que abandonan la pista", () => {
  assert.match(
    source,
    /function\s+updateObstacles\s*\(/,
    "debe existir una función updateObstacles"
  );

  assert.match(
    source,
    /obstacle\.x\s*-=/,
    "cada obstáculo debe avanzar hacia la izquierda"
  );

  assert.match(
    source,
    /obstacle\.element\.style\.transform\s*=/,
    "la posición visual del obstáculo debe actualizarse"
  );

  assert.match(
    source,
    /obstacle\.element\.remove\s*\(\s*\)/,
    "los obstáculos fuera de pantalla deben eliminarse"
  );
});

test("el bucle principal actualiza los obstáculos durante la partida", () => {
  assert.match(
    source,
    /gameLoop\s*\([\s\S]*?updateObstacles\s*\(/,
    "gameLoop debe actualizar los obstáculos"
  );
});
