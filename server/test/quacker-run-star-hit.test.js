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

const STAR_HIT_ASSETS = [
  "star-hit-1.png",
  "star-hit-2.png"
];

test("existen los dos frames finales de star-hit", () => {
  for (const asset of STAR_HIT_ASSETS) {
    const url = new URL(
      `../../assets/img/quacker-run/effects/star-hit/${asset}`,
      import.meta.url
    );

    assert.equal(
      fs.existsSync(url),
      true,
      `debe existir ${asset}`
    );
  }
});

test("Quacker Run define los frames del efecto de impacto", () => {
  assert.match(
    source,
    /const\s+STAR_HIT_FRAMES\s*=\s*\[/,
    "debe existir STAR_HIT_FRAMES"
  );

  for (const asset of STAR_HIT_ASSETS) {
    assert.match(
      source,
      new RegExp(asset.replace(".", "\\.")),
      `debe referenciar ${asset}`
    );
  }
});

test("el juego dispone de una capa visual para star-hit", () => {
  assert.match(
    source,
    /star-hit-sprite/,
    "debe existir star-hit-sprite"
  );

  assert.match(
    css,
    /\.star-hit-sprite\s*\{/,
    "debe existir CSS para star-hit"
  );
});

test("el efecto de estrellas se activa al terminar la partida", () => {
  assert.match(
    source,
    /function\s+startStarHit\s*\(/,
    "debe existir startStarHit"
  );

  assert.match(
    source,
    /startStarHit\(\s*\)/,
    "endGame debe activar el efecto de impacto"
  );
});
