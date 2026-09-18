import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const serverSource = fs.readFileSync(
  new URL("../server.js", import.meta.url),
  "utf8"
);

const apiSource = fs.readFileSync(
  new URL("../../assets/js/data/api-client.js", import.meta.url),
  "utf8"
);

test("el backend tiene una regla única para decidir si debe invitar a valorar", () => {
  assert.match(
    serverSource,
    /function _shouldCreateCompletionOpinionPrompt\(/
  );

  const start = serverSource.indexOf(
    "function _shouldCreateCompletionOpinionPrompt("
  );
  const end = serverSource.indexOf(
    "\nfunction ",
    start + 20
  );

  assert.notEqual(start, -1);
  assert.notEqual(end, -1);

  const block = serverSource.slice(start, end);

  assert.match(block, /prevCompleted/);
  assert.match(block, /nextCompleted/);
  assert.match(block, /bucketOpinions|opinions/);
  assert.match(block, /itemId/);
  assert.match(block, /contentType/);
  assert.match(block, /Number\.isInteger/);
  assert.match(block, /rating\s*>=\s*1/);
  assert.match(block, /rating\s*<=\s*5/);
});

test("PATCH /api/library crea una invitación rate_content solo en una transición a completado", () => {
  const start = serverSource.indexOf(
    'app.patch("/api/library/:id"'
  );
  const end = serverSource.indexOf(
    '\napp.delete("/api/library/:id"',
    start
  );

  assert.notEqual(start, -1);
  assert.notEqual(end, -1);

  const block = serverSource.slice(start, end);

  assert.match(
    block,
    /_shouldCreateCompletionOpinionPrompt/
  );
  assert.match(block, /action:\s*"rate_content"/);
  assert.match(block, /itemId:\s*id/);
  assert.match(block, /contentType:\s*next\.type/);
  assert.match(block, /bucket\.notifications/);
});

test("el cliente local puede aplicar la misma regla y consultar la opinión existente", () => {
  assert.match(
    apiSource,
    /async function _maybeAddCompletionOpinionPrompt\(/
  );

  const start = apiSource.indexOf(
    "async function _maybeAddCompletionOpinionPrompt("
  );
  const end = apiSource.indexOf(
    "\n  // === RACHA (notificación por hitos) ===",
    start
  );

  assert.notEqual(start, -1);
  assert.notEqual(end, -1);

  const block = apiSource.slice(start, end);

  assert.match(block, /getOpinions/);
  assert.match(block, /rating/);
  assert.match(block, /Number\.isInteger/);
  assert.match(block, /action:\s*"rate_content"/);
});

test("las rutas locales de completado usan la invitación común", () => {
  const updateStart = apiSource.indexOf(
    "async function updateLibraryItem("
  );
  const completeStart = apiSource.indexOf(
    "async function completeLibraryItem("
  );

  assert.notEqual(updateStart, -1);
  assert.notEqual(completeStart, -1);

  const updateBlock = apiSource.slice(
    updateStart,
    apiSource.indexOf(
      "\n  function _normalizeSeriesSeasonBreakdown",
      updateStart
    )
  );

  const completeBlock = apiSource.slice(
    completeStart,
    apiSource.indexOf(
      "\n  function _normalizeSeriesSeasonBreakdown",
      completeStart
    )
  );

  assert.match(
    updateBlock,
    /_maybeAddCompletionOpinionPrompt/
  );

  assert.match(
    completeBlock,
    /_maybeAddCompletionOpinionPrompt/
  );
});

test(
  "la invitación post-completion no incrusta un emoji de pato en el título",
  () => {
    const patchStart = serverSource.indexOf(
      'app.patch("/api/library/:id"'
    );
    const patchEnd = serverSource.indexOf(
      '\napp.delete("/api/library/:id"',
      patchStart
    );

    assert.notEqual(patchStart, -1);
    assert.notEqual(patchEnd, -1);

    const patchBlock = serverSource.slice(
      patchStart,
      patchEnd
    );

    assert.doesNotMatch(
      patchBlock,
      /🦆/
    );

    const localStart = apiSource.indexOf(
      "async function _maybeAddCompletionOpinionPrompt("
    );
    const localEnd = apiSource.indexOf(
      "\n  // === RACHA (notificación por hitos) ===",
      localStart
    );

    assert.notEqual(localStart, -1);
    assert.notEqual(localEnd, -1);

    const localBlock = apiSource.slice(
      localStart,
      localEnd
    );

    assert.doesNotMatch(
      localBlock,
      /🦆/
    );
  }
);
