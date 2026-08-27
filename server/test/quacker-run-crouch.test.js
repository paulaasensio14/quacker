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

test("Quacker Run registra el sprite agachado y su estado", () => {
  assert.match(
    source,
    /const\s+CROUCH_FRAME\s*=\s*["']\/assets\/img\/quacker-run\/duck-crouch\.png["']/
  );

  assert.match(
    source,
    /let\s+isCrouching\s*=\s*false/
  );
});

test("Quacker puede agacharse con ArrowDown y levantarse al soltarla", () => {
  assert.match(
    source,
    /event\.key\s*===\s*["']ArrowDown["'][\s\S]*?setCrouching\(true\)/
  );

  assert.match(
    source,
    /keyup[\s\S]*?ArrowDown[\s\S]*?setCrouching\(false\)/
  );
});

test("el sprite y la hitbox cambian al agacharse", () => {
  assert.match(
    source,
    /isCrouching[\s\S]*?duckSprite\.src\s*=\s*CROUCH_FRAME/
  );

  assert.match(
    source,
    /duck\.classList\.toggle\(\s*["']is-crouching["']/
  );

  assert.match(
    css,
    /\.duck-slot\.is-crouching\s*\{[\s\S]*?height:/
  );
});
