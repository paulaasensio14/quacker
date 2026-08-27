import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const source = fs.readFileSync(
  new URL("../../assets/js/quacker-run.js", import.meta.url),
  "utf8"
);

test("Quacker Run escucha los cambios de visibilidad de la página", () => {
  assert.match(
    source,
    /document\.addEventListener\(\s*["']visibilitychange["']/,
    "debe escuchar visibilitychange"
  );

  assert.match(
    source,
    /document\.hidden/,
    "debe comprobar si la página está oculta"
  );
});

test("Quacker Run pausa la partida al ocultarse la página", () => {
  assert.match(
    source,
    /let\s+isPaused\s*=\s*false/,
    "debe existir un estado explícito de pausa"
  );

  assert.match(
    source,
    /cancelAnimationFrame\(\s*animationFrameId\s*\)/,
    "la pausa debe detener el animation frame activo"
  );

  assert.match(
    source,
    /root\.classList\.add\(\s*["']is-paused["']\s*\)/,
    "debe marcarse visualmente el estado pausado"
  );
});

test("Quacker Run reanuda de forma segura al volver a la pestaña", () => {
  assert.match(
    source,
    /root\.classList\.remove\(\s*["']is-paused["']\s*\)/,
    "debe retirarse el estado visual de pausa"
  );

  assert.match(
    source,
    /lastFrameTime\s*=\s*0/,
    "debe reiniciarse el reloj para evitar un salto temporal"
  );

  assert.match(
    source,
    /requestAnimationFrame\(\s*gameLoop\s*\)/,
    "debe poder reanudar el bucle del juego"
  );
});

test("Quacker Run libera el crouch al pausar la partida", () => {
  const pauseStart = source.indexOf("function pauseGame()");
  const resumeStart = source.indexOf("function resumeGame()");

  assert.notEqual(
    pauseStart,
    -1,
    "debe existir pauseGame"
  );

  assert.notEqual(
    resumeStart,
    -1,
    "debe existir resumeGame"
  );

  const pauseSource = source.slice(pauseStart, resumeStart);

  assert.match(
    pauseSource,
    /setCrouching\(\s*false\s*\)/,
    "pauseGame debe liberar el crouch para evitar que quede pegado"
  );
});
