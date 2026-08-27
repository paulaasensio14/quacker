import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const html = fs.readFileSync(
  new URL("../../404.html", import.meta.url),
  "utf8"
);

const css = fs.readFileSync(
  new URL("../../assets/css/quacker-run.css", import.meta.url),
  "utf8"
);

const source = fs.readFileSync(
  new URL("../../assets/js/quacker-run.js", import.meta.url),
  "utf8"
);

test("Quacker Run usa un contenedor de movimiento y una imagen para el sprite", () => {
  assert.match(
    html,
    /id=["']quackerRunDuck["'][\s\S]*?<img[^>]+id=["']quackerRunDuckSprite["']/i,
    "el pato debe mantener un contenedor y una imagen interna para los frames"
  );

  assert.match(
    html,
    /src=["']\/assets\/img\/quacker-run\/duck-idle\.png["']/i,
    "el frame inicial debe ser duck-idle.png"
  );
});

test("el controlador conoce los cuatro frames de carrera y el frame de salto", () => {
  for (const asset of [
    "duck-run-1.png",
    "duck-run-2.png",
    "duck-run-3.png",
    "duck-run-4.png",
    "duck-jump.png"
  ]) {
    assert.match(
      source,
      new RegExp(
        `/assets/img/quacker-run/${asset.replace(".", "\\.")}`
      ),
      `debe referenciar ${asset}`
    );
  }

  assert.match(
    source,
    /RUN_FRAMES/,
    "debe existir una colección RUN_FRAMES"
  );

  assert.match(
    source,
    /JUMP_FRAME/,
    "debe existir una referencia JUMP_FRAME"
  );
});

test("desaparece el placeholder provisional del pato", () => {
  assert.doesNotMatch(
    css,
    /\.duck-slot::after\s*\{/,
    "no debe mantenerse el recuadro provisional"
  );
});
