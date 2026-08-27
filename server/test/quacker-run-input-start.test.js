import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const source = fs.readFileSync(
  new URL("../../assets/js/quacker-run.js", import.meta.url),
  "utf8"
);

test("Quacker Run centraliza el salto y arranque desde los controles", () => {
  assert.match(
    source,
    /function\s+handleJumpInput\s*\(/,
    "debe existir un manejador común para iniciar o saltar"
  );

  assert.match(
    source,
    /if\s*\(\s*!isRunning\s*\)[\s\S]*?startGame\s*\(\s*\)/,
    "el primer control de salto debe poder iniciar la partida"
  );

  assert.match(
    source,
    /startGame\s*\(\s*\)[\s\S]*?jumpDuck\s*\(\s*\)/,
    "al iniciar mediante salto, el pato debe saltar inmediatamente"
  );
});

test("Espacio o Flecha arriba usan el manejador común", () => {
  assert.match(
    source,
    /document\.addEventListener\(\s*["']keydown["'][\s\S]*?handleJumpInput\s*\(\s*\)/,
    "el teclado debe iniciar o saltar mediante handleJumpInput"
  );
});

test("tocar la pista también puede iniciar o reiniciar la partida", () => {
  assert.match(
    source,
    /stage\.addEventListener\(\s*["']pointerdown["'][\s\S]*?handleJumpInput\s*\(\s*\)/,
    "pointerdown debe iniciar o saltar mediante handleJumpInput"
  );
});

test("Espacio sobre el botón de inicio no dispara también el manejador global", () => {
  assert.match(
    source,
    /if\s*\(\s*event\.code\s*===\s*["']Space["']\s*&&\s*event\.target\s*===\s*startButton\s*\)\s*\{\s*return;\s*\}/,
    "Space sobre el botón debe dejar actuar únicamente al click nativo"
  );
});
