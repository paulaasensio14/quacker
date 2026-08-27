import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const source = fs.readFileSync(
  new URL("../../assets/js/quacker-run.js", import.meta.url),
  "utf8"
);

test("Quacker Run define una función para iniciar o reiniciar la partida", () => {
  assert.match(
    source,
    /function\s+startGame\s*\(/,
    "debe existir una función startGame"
  );

  assert.match(
    source,
    /startButton\.addEventListener\(\s*["']click["'][\s\S]*?startGame/,
    "el botón debe iniciar la partida"
  );
});

test("iniciar Quacker Run reinicia puntuación y activa el estado de juego", () => {
  assert.match(
    source,
    /score\.textContent\s*=\s*["']0["']/,
    "la puntuación debe reiniciarse al empezar"
  );

  assert.match(
    source,
    /root\.classList\.add\(\s*["']is-running["']\s*\)/,
    "el juego debe marcarse como activo"
  );

  assert.match(
    source,
    /I18n\.t\(\s*["']quacker_run_restart["']\s*\)/,
    "el botón debe pasar a Reiniciar"
  );

  assert.match(
    source,
    /I18n\.t\(\s*["']quacker_run_running["']\s*\)/,
    "debe anunciarse el inicio de la partida"
  );
});
