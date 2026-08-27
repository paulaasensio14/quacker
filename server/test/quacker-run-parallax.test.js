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

const PARALLAX_ASSETS = [
  "mountains.png",
  "hills.png",
  "trees.png"
];

test("existen las tres capas finales de parallax", () => {
  for (const asset of PARALLAX_ASSETS) {
    const url = new URL(
      `../../assets/img/quacker-run/parallax/${asset}`,
      import.meta.url
    );

    assert.equal(
      fs.existsSync(url),
      true,
      `debe existir ${asset}`
    );
  }
});

test("existe el tile final de suelo", () => {
  const url = new URL(
    "../../assets/img/quacker-run/tiles/ground-seamless.png",
    import.meta.url
  );

  assert.equal(
    fs.existsSync(url),
    true,
    "debe existir ground-seamless.png"
  );
});

test("Quacker Run define y actualiza las capas de profundidad", () => {
  assert.match(
    source,
    /PARALLAX_LAYERS/,
    "debe existir PARALLAX_LAYERS"
  );

  assert.match(
    source,
    /function\s+updateParallax\s*\(/,
    "debe existir updateParallax"
  );

  assert.match(
    source,
    /updateParallax\(\s*deltaSeconds\s*\)/,
    "el game loop debe actualizar el parallax"
  );
});

test("el escenario dispone de estilos para parallax y suelo continuo", () => {
  assert.match(
    css,
    /\.run-parallax-layer\s*\{/,
    "debe existir el estilo base del parallax"
  );

  assert.match(
    css,
    /ground-seamless\.png/,
    "el suelo debe utilizar ground-seamless.png"
  );
});
