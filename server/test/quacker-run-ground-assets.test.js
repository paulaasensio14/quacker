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

const GROUND_ASSETS = [
  "cactus.png",
  "crate.png",
  "log.png",
  "rock-small.png",
  "rock-tall.png",
  "stump.png"
];

test("existen los seis obstáculos terrestres finales", () => {
  for (const asset of GROUND_ASSETS) {
    const url = new URL(
      `../../assets/img/quacker-run/obstacles/ground/${asset}`,
      import.meta.url
    );

    assert.equal(
      fs.existsSync(url),
      true,
      `debe existir ${asset}`
    );
  }
});

test("Quacker Run conoce la colección de sprites terrestres", () => {
  assert.match(
    source,
    /const\s+GROUND_OBSTACLE_SPRITES\s*=\s*\[/,
    "debe existir GROUND_OBSTACLE_SPRITES"
  );

  for (const asset of GROUND_ASSETS) {
    assert.match(
      source,
      new RegExp(
        `/assets/img/quacker-run/obstacles/ground/${asset.replace(".", "\\.")}`
      ),
      `debe referenciar ${asset}`
    );
  }
});

test("cada obstáculo terrestre usa una imagen visual dentro del hitbox", () => {
  assert.match(
    source,
    /document\.createElement\(\s*["']img["']\s*\)/,
    "debe crearse una imagen para el sprite"
  );

  assert.match(
    source,
    /className\s*=\s*["']run-obstacle-sprite["']/,
    "la imagen debe usar run-obstacle-sprite"
  );

  assert.match(
    source,
    /element\.appendChild\(\s*sprite\s*\)/,
    "el sprite debe insertarse dentro del hitbox"
  );

  assert.match(
    css,
    /\.run-obstacle-sprite\s*\{/,
    "debe existir el estilo visual del sprite"
  );
});

test("el hitbox terrestre deja de usar el bloque provisional", () => {
  assert.match(
    css,
    /\.run-obstacle\s*\{[\s\S]*?background:\s*transparent/,
    "el hitbox debe ser transparente"
  );
});
