import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const source = fs.readFileSync(
  new URL("../../assets/js/quacker-run.js", import.meta.url),
  "utf8"
);

test("Quacker Run detecta colisiones entre el pato y los obstáculos", () => {
  assert.match(
    source,
    /function\s+hasCollision\s*\(/,
    "debe existir una función hasCollision"
  );

  assert.match(
    source,
    /duck\.getBoundingClientRect\s*\(\s*\)/,
    "la colisión debe usar los límites reales del pato"
  );

  assert.match(
    source,
    /obstacle\.element\.getBoundingClientRect\s*\(\s*\)/,
    "la colisión debe usar los límites reales del obstáculo"
  );
});

test("Quacker Run define un estado de fin de partida", () => {
  assert.match(
    source,
    /function\s+endGame\s*\(/,
    "debe existir una función endGame"
  );

  assert.match(
    source,
    /isRunning\s*=\s*false/,
    "endGame debe detener la partida"
  );

  assert.match(
    source,
    /root\.classList\.remove\(\s*["']is-running["']\s*\)/,
    "debe retirarse el estado visual de partida activa"
  );

  assert.match(
    source,
    /root\.classList\.add\(\s*["']is-game-over["']\s*\)/,
    "debe marcarse visualmente el fin de partida"
  );

  assert.match(
    source,
    /I18n\.t\(\s*["']quacker_run_game_over["']\s*\)/,
    "el fin de partida debe anunciarse de forma accesible"
  );
});

test("una colisión durante el movimiento termina la partida", () => {
  assert.match(
    source,
    /updateObstacles\s*\([\s\S]*?hasCollision\s*\(\s*obstacle\s*\)[\s\S]*?endGame\s*\(\s*\)/,
    "updateObstacles debe terminar la partida cuando detecta una colisión"
  );
});
