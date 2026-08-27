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

test("Quacker Run define obstáculos terrestres y aéreos", () => {
  assert.match(
    source,
    /GROUND_OBSTACLE/
  );

  assert.match(
    source,
    /AIR_OBSTACLE/
  );

  assert.match(
    source,
    /type/
  );
});

test("los obstáculos aéreos reciben una clase propia", () => {
  assert.match(
    source,
    /is-airborne/
  );

  assert.match(
    css,
    /\.run-obstacle\.is-airborne\s*\{/
  );
});

test("el obstáculo aéreo está por encima de la hitbox agachada", () => {
  assert.match(
    css,
    /\.run-obstacle\.is-airborne\s*\{[\s\S]*?bottom:\s*108px/
  );

  assert.match(
    css,
    /\.duck-slot\.is-crouching\s*\{[\s\S]*?height:\s*56px/
  );
});
