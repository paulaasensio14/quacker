import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const source = fs.readFileSync(
  new URL("../../assets/js/quacker-run.js", import.meta.url),
  "utf8"
);

test("una colisión no incrementa la puntuación después de terminar la partida", () => {
  const match = source.match(
    /function\s+gameLoop\s*\([^)]*\)\s*\{([\s\S]*?)\n\s*\}\n\n\s*function\s+startGame/
  );

  assert.ok(match, "debe encontrarse el cuerpo de gameLoop");

  const body = match[1];

  const obstaclesIndex = body.indexOf("updateObstacles(deltaSeconds)");
  const stoppedCheckIndex = body.indexOf("if (!isRunning)");
  const scoreIndex = body.indexOf("updateScore(deltaSeconds)");

  assert.notEqual(
    obstaclesIndex,
    -1,
    "gameLoop debe actualizar los obstáculos"
  );

  assert.notEqual(
    stoppedCheckIndex,
    -1,
    "gameLoop debe comprobar si la partida terminó"
  );

  assert.notEqual(
    scoreIndex,
    -1,
    "gameLoop debe actualizar la puntuación"
  );

  assert.ok(
    obstaclesIndex < stoppedCheckIndex,
    "la comprobación de fin debe ocurrir después de actualizar obstáculos"
  );

  assert.ok(
    stoppedCheckIndex < scoreIndex,
    "si hubo colisión, gameLoop debe salir antes de sumar otro frame de puntuación"
  );
});
