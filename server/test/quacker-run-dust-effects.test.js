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

const RUN_DUST_ASSETS = [
  "dust-run-1.png",
  "dust-run-2.png",
  "dust-run-3.png"
];

const JUMP_DUST_ASSETS = [
  "jump-dust-1.png",
  "jump-dust-2.png",
  "jump-dust-3.png"
];

test("existen los tres frames de polvo de carrera", () => {
  for (const asset of RUN_DUST_ASSETS) {
    const url = new URL(
      `../../assets/img/quacker-run/effects/dust-run/${asset}`,
      import.meta.url
    );

    assert.equal(
      fs.existsSync(url),
      true,
      `debe existir ${asset}`
    );
  }
});

test("existen los tres frames de polvo de salto", () => {
  for (const asset of JUMP_DUST_ASSETS) {
    const url = new URL(
      `../../assets/img/quacker-run/effects/jump-dust/${asset}`,
      import.meta.url
    );

    assert.equal(
      fs.existsSync(url),
      true,
      `debe existir ${asset}`
    );
  }
});

test("Quacker Run define las colecciones de polvo", () => {
  assert.match(
    source,
    /const\s+RUN_DUST_FRAMES\s*=\s*\[/,
    "debe existir RUN_DUST_FRAMES"
  );

  assert.match(
    source,
    /const\s+JUMP_DUST_FRAMES\s*=\s*\[/,
    "debe existir JUMP_DUST_FRAMES"
  );

  for (const asset of [
    ...RUN_DUST_ASSETS,
    ...JUMP_DUST_ASSETS
  ]) {
    assert.match(
      source,
      new RegExp(asset.replace(".", "\\.")),
      `debe referenciar ${asset}`
    );
  }
});

test("el juego dispone de capas visuales para ambos efectos", () => {
  assert.match(
    source,
    /run-dust-sprite/,
    "debe existir el sprite de polvo de carrera"
  );

  assert.match(
    source,
    /jump-dust-sprite/,
    "debe existir el sprite de polvo de salto"
  );

  assert.match(
    css,
    /\.run-dust-sprite\s*\{/,
    "debe existir CSS para el polvo de carrera"
  );

  assert.match(
    css,
    /\.jump-dust-sprite\s*\{/,
    "debe existir CSS para el polvo de salto"
  );
});
