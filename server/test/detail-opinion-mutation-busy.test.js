import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const exploreJs = fs.readFileSync(
  new URL("../../assets/js/app/explore.js", import.meta.url),
  "utf8"
);

test("las mutaciones de opinión tienen un estado busy separado", () => {
  assert.match(
    exploreJs,
    /let\s+__detailOpinionMutationBusy\s*=\s*false\s*;/
  );
});

test("existe un helper común que bloquea mutaciones concurrentes", () => {
  assert.match(
    exploreJs,
    /async\s+function\s+_runDetailOpinionMutation\s*\(/
  );

  assert.match(
    exploreJs,
    /if\s*\(\s*__detailOpinionMutationBusy\s*\)\s*return\s+false\s*;/
  );

  assert.match(
    exploreJs,
    /finally\s*\{[\s\S]*_setDetailOpinionMutationBusy\(false\)/
  );
});

test("el estado busy deshabilita los controles de opinión", () => {
  assert.match(
    exploreJs,
    /function\s+_setDetailOpinionMutationBusy\s*\(/
  );

  assert.match(
    exploreJs,
    /contentDetailOpinion/
  );

  assert.match(
    exploreJs,
    /\.disabled\s*=\s*__detailOpinionMutationBusy/
  );
});

test("review, tags y rating usan el mismo guard de mutación", () => {
  const reviewBlock = exploreJs.match(
    /async function _saveDetailOpinionReview[\s\S]*?(?=async function _saveDetailOpinionTags)/
  );

  const tagsBlock = exploreJs.match(
    /async function _saveDetailOpinionTags[\s\S]*?(?=async function _saveDetailOpinionRating)/
  );

  const ratingBlock = exploreJs.match(
    /async function _saveDetailOpinionRating[\s\S]*?(?=function _buildDetailOpinionTagControls)/
  );

  assert.ok(reviewBlock);
  assert.ok(tagsBlock);
  assert.ok(ratingBlock);

  assert.match(reviewBlock[0], /_runDetailOpinionMutation/);
  assert.match(tagsBlock[0], /_runDetailOpinionMutation/);
  assert.match(ratingBlock[0], /_runDetailOpinionMutation/);
});
