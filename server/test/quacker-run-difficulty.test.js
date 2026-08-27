import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const source = fs.readFileSync(
  new URL("../../assets/js/quacker-run.js", import.meta.url),
  "utf8"
);

test("Quacker Run define una dificultad progresiva con límites", () => {
  assert.match(
    source,
    /const\s+MAX_OBSTACLE_SPEED\s*=/,
    "debe existir una velocidad máxima de obstáculos"
  );

  assert.match(
    source,
    /const\s+MIN_SPAWN_INTERVAL\s*=/,
    "debe existir un intervalo mínimo entre obstáculos"
  );

  assert.match(
    source,
    /function\s+getDifficulty\s*\(/,
    "debe existir una función getDifficulty"
  );
});

test("la dificultad aumenta en función de la puntuación", () => {
  assert.match(
    source,
    /currentScore/,
    "la dificultad debe depender de la puntuación actual"
  );

  assert.match(
    source,
    /Math\.min\(\s*MAX_OBSTACLE_SPEED/,
    "la velocidad debe quedar limitada por MAX_OBSTACLE_SPEED"
  );

  assert.match(
    source,
    /Math\.max\(\s*MIN_SPAWN_INTERVAL/,
    "la frecuencia debe quedar limitada por MIN_SPAWN_INTERVAL"
  );
});

test("los obstáculos utilizan la dificultad actual", () => {
  assert.match(
    source,
    /updateObstacles\s*\([\s\S]*?const\s+difficulty\s*=\s*getDifficulty\s*\(\s*\)/,
    "updateObstacles debe obtener la dificultad actual"
  );

  assert.match(
    source,
    /obstacle\.x\s*-=\s*difficulty\.obstacleSpeed\s*\*\s*deltaSeconds/,
    "el movimiento debe usar la velocidad dinámica"
  );

  assert.match(
    source,
    /nextObstacleIn\s*=\s*difficulty\.spawnMin/,
    "el siguiente obstáculo debe usar el intervalo dinámico"
  );
});
