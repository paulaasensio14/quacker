import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const source = fs.readFileSync(
  new URL("../../assets/js/quacker-run.js", import.meta.url),
  "utf8"
);

test("Quacker Run define un ciclo temporal para los cuatro frames de carrera", () => {
  assert.match(
    source,
    /const\s+DUCK_FRAME_INTERVAL\s*=/,
    "debe existir un intervalo entre frames"
  );

  assert.match(
    source,
    /let\s+duckFrameIndex\s*=\s*0/,
    "debe existir un índice del frame actual"
  );

  assert.match(
    source,
    /let\s+duckFrameElapsed\s*=\s*0/,
    "debe existir un acumulador temporal para la animación"
  );
});

test("el pato usa la pose de salto mientras está en el aire", () => {
  assert.match(
    source,
    /function\s+updateDuckSprite\s*\(\s*deltaSeconds\s*\)/,
    "debe existir updateDuckSprite"
  );

  assert.match(
    source,
    /duckY\s*<\s*0[\s\S]*?duckSprite\.src\s*=\s*JUMP_FRAME/,
    "cuando duckY es negativo debe mostrarse el frame de salto"
  );
});

test("en el suelo Quacker avanza por RUN_FRAMES y el gameLoop actualiza el sprite", () => {
  assert.match(
    source,
    /duckFrameIndex\s*=\s*\(\s*duckFrameIndex\s*\+\s*1\s*\)\s*%\s*RUN_FRAMES\.length/,
    "el índice debe recorrer circularmente los cuatro frames"
  );

  assert.match(
    source,
    /duckSprite\.src\s*=\s*RUN_FRAMES\[duckFrameIndex\]/,
    "el sprite debe usar el frame de carrera actual"
  );

  assert.match(
    source,
    /updateDuck\(deltaSeconds\)[\s\S]*?updateDuckSprite\(deltaSeconds\)/,
    "gameLoop debe actualizar la pose después de actualizar la física del pato"
  );
});
