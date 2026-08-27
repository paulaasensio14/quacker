import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const html = fs.readFileSync(
  new URL("../../404.html", import.meta.url),
  "utf8"
);

const source = fs.readFileSync(
  new URL("../../assets/js/quacker-run.js", import.meta.url),
  "utf8"
);

test("Quacker Run muestra puntuación y récord", () => {
  assert.match(
    html,
    /id=["']quackerRunScore["']/,
    "debe mantenerse el marcador de puntuación"
  );

  assert.match(
    html,
    /id=["']quackerRunBest["']/,
    "debe existir un marcador para el récord"
  );
});

test("Quacker Run actualiza la puntuación durante la partida", () => {
  assert.match(
    source,
    /let\s+currentScore\s*=\s*0/,
    "debe existir un estado numérico de puntuación"
  );

  assert.match(
    source,
    /function\s+updateScore\s*\(/,
    "debe existir una función updateScore"
  );

  assert.match(
    source,
    /currentScore\s*\+=/,
    "la puntuación debe avanzar durante la partida"
  );

  assert.match(
    source,
    /score\.textContent\s*=/,
    "el marcador visible debe actualizarse"
  );

  assert.match(
    source,
    /gameLoop\s*\([\s\S]*?updateScore\s*\(/,
    "el bucle principal debe actualizar la puntuación"
  );
});

test("Quacker Run conserva el récord en localStorage", () => {
  assert.match(
    source,
    /localStorage\.getItem\(/,
    "debe recuperar el récord guardado"
  );

  assert.match(
    source,
    /localStorage\.setItem\(/,
    "debe guardar un nuevo récord"
  );

  assert.match(
    source,
    /function\s+updateBestScore\s*\(/,
    "debe existir una función para actualizar el récord"
  );

  assert.match(
    source,
    /endGame\s*\([\s\S]*?updateBestScore\s*\(/,
    "el récord debe comprobarse al terminar la partida"
  );
});
