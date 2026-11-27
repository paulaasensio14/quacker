import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const css = fs.readFileSync(
  new URL("../../assets/css/design-feedback.css", import.meta.url),
  "utf8"
);

const marker = "/* DS-07.4: explore alignment */";
const alignment = css.split(marker)[1] || "";

test("DS-07.4: conserva correcciones aprobadas", () => {
  assert.match(css, /--q-empty-play-icon:/);
  assert.match(css, /--q-empty-list-icon:/);
  assert.match(css, /#notifRetryLoadBtn/);
  assert.match(css, /#activityErrorRetry/);
});

test("DS-07.4: explorar utiliza columna centrada", () => {
  assert.match(
    alignment,
    /#view-explore :is\(#exploreEmpty, #exploreError\)/
  );

  assert.match(alignment, /display:\s*grid\s*;/);
  assert.match(alignment, /justify-items:\s*center\s*;/);
  assert.match(alignment, /text-align:\s*center\s*;/);
  assert.match(alignment, /minmax\(0,\s*1fr\)/);
  assert.match(alignment, /text-wrap:\s*wrap\s*;/);
});

test("DS-07.4: correccion limitada exclusivamente a Explorar", () => {
  assert.ok(alignment.length > 0);

  for (const selector of [
    "#view-library",
    "#view-home",
    "#view-lists",
    "#notifErrorState",
    "#activityError"
  ]) {
    assert.ok(!alignment.includes(selector), selector);
  }

  assert.match(alignment, /justify-content:\s*center\s*;/);
  assert.match(alignment, /margin:\s*0\s*;/);
});
