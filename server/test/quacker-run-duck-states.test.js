import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const html = fs.readFileSync(
  new URL("../../404.html", import.meta.url),
  "utf8"
);

const source = fs.readFileSync(
  new URL("../../assets/js/quacker-run.js", import.meta.url),
  "utf8"
);

const assetUrl = (name) =>
  new URL(`../../assets/img/quacker-run/${name}`, import.meta.url);

test("existen los sprites idle, hit y game-over de Quacker", () => {
  for (const asset of [
    "duck-idle.png",
    "duck-hit.png",
    "duck-game-over.png"
  ]) {
    assert.equal(
      fs.existsSync(assetUrl(asset)),
      true,
      `debe existir ${asset}`
    );
  }
});

test("la 404 muestra a Quacker idle antes de iniciar la partida", () => {
  assert.match(
    html,
    /id=["']quackerRunDuckSprite["'][^>]+src=["']\/assets\/img\/quacker-run\/duck-idle\.png["']/i,
    "el sprite inicial debe ser duck-idle.png"
  );

  assert.match(
    source,
    /const\s+IDLE_FRAME\s*=\s*["']\/assets\/img\/quacker-run\/duck-idle\.png["']/,
    "debe existir IDLE_FRAME"
  );
});

test("una colisión muestra hit antes de pasar a game-over", () => {
  assert.match(
    source,
    /const\s+HIT_FRAME\s*=\s*["']\/assets\/img\/quacker-run\/duck-hit\.png["']/,
    "debe existir HIT_FRAME"
  );

  assert.match(
    source,
    /const\s+GAME_OVER_FRAME\s*=\s*["']\/assets\/img\/quacker-run\/duck-game-over\.png["']/,
    "debe existir GAME_OVER_FRAME"
  );

  assert.match(
    source,
    /duckSprite\.src\s*=\s*HIT_FRAME/,
    "la colisión debe mostrar el sprite hit"
  );

  assert.match(
    source,
    /duckSprite\.src\s*=\s*GAME_OVER_FRAME/,
    "el final debe mostrar el sprite game-over"
  );
});
