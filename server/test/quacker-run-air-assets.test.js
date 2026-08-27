import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const source = fs.readFileSync(
  new URL("../../assets/js/quacker-run.js", import.meta.url),
  "utf8"
);

const css = fs.readFileSync(
  new URL("../../assets/css/quacker-run.css", import.meta.url),
  "utf8"
);

const AIR_ASSETS = [
  "nightwing/nightwing-1.png",
  "nightwing/nightwing-2.png",
  "crow/crow-1.png",
  "crow/crow-2.png",
  "bat/bat-1.png",
  "bat/bat-2.png",
  "seagull/seagull-1.png",
  "seagull/seagull-2.png"
];

test("existen los ocho frames finales de enemigos aéreos", () => {
  for (const asset of AIR_ASSETS) {
    const url = new URL(
      `../../assets/img/quacker-run/enemies/air/${asset}`,
      import.meta.url
    );

    assert.equal(
      fs.existsSync(url),
      true,
      `debe existir ${asset}`
    );
  }
});

test("Quacker Run define cuatro enemigos aéreos con dos frames cada uno", () => {
  assert.match(
    source,
    /const\s+AIR_ENEMY_SPRITES\s*=\s*\[/,
    "debe existir AIR_ENEMY_SPRITES"
  );

  for (const asset of AIR_ASSETS) {
    assert.match(
      source,
      new RegExp(
        `/assets/img/quacker-run/enemies/air/${asset.replace(".", "\\.")}`
      ),
      `debe referenciar ${asset}`
    );
  }
});

test("los obstáculos aéreos crean su propio sprite visual", () => {
  assert.match(
    source,
    /className\s*=\s*["']run-air-enemy-sprite["']/,
    "debe existir run-air-enemy-sprite"
  );

  assert.match(
    source,
    /element\.appendChild\(\s*sprite\s*\)/,
    "el sprite aéreo debe insertarse en su hitbox"
  );

  assert.match(
    css,
    /\.run-air-enemy-sprite\s*\{/,
    "debe existir el CSS del enemigo aéreo"
  );
});

test("los enemigos aéreos alternan sus dos frames durante la partida", () => {
  assert.match(
    source,
    /AIR_ENEMY_FRAME_INTERVAL/,
    "debe existir un intervalo de aleteo"
  );

  assert.match(
    source,
    /function\s+updateAirEnemySprite\s*\(/,
    "debe existir updateAirEnemySprite"
  );

  assert.match(
    source,
    /updateAirEnemySprite\(\s*obstacle\s*,\s*deltaSeconds\s*\)/,
    "los enemigos aéreos deben actualizar su animación"
  );
});
