import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const apiClientSource = fs.readFileSync(
  new URL("../../assets/js/data/api-client.js", import.meta.url),
  "utf8"
);

function extractFunction(source, name) {
  const start = source.indexOf(`function ${name}(`);

  assert.notEqual(
    start,
    -1,
    `no se encontró function ${name}()`
  );

  let depth = 0;
  let bodyStarted = false;

  for (let i = start; i < source.length; i += 1) {
    if (source[i] === "{") {
      depth += 1;
      bodyStarted = true;
    } else if (source[i] === "}") {
      depth -= 1;

      if (bodyStarted && depth === 0) {
        return source.slice(start, i + 1);
      }
    }
  }

  throw new Error(`no se pudo aislar function ${name}()`);
}

function loadNormalizer() {
  const fnSource = extractFunction(
    apiClientSource,
    "_normalizeActivityRecord"
  );

  return Function(
    "_normalizeDataId",
    `"use strict"; return (${fnSource});`
  )((value) => String(value || "").trim());
}

test(
  "Activity conserva payload.progress al normalizar una actividad",
  () => {
    const normalizeActivityRecord = loadNormalizer();

    const result = normalizeActivityRecord({
      id: "activity-1",
      type: "progress",
      targetId: "game-1",
      createdAt: "2026-09-04T16:24:20.374Z",
      payload: {
        progress: 30
      }
    });

    assert.deepEqual(
      result.payload,
      {
        progress: 30
      }
    );
  }
);

test(
  "Activity conserva season episode y progress cuando conviven",
  () => {
    const normalizeActivityRecord = loadNormalizer();

    const result = normalizeActivityRecord({
      id: "activity-2",
      type: "progress",
      targetId: "serie-1",
      createdAt: "2026-09-04T16:24:20.374Z",
      payload: {
        season: 2,
        episode: 4,
        progress: 35
      }
    });

    assert.deepEqual(
      result.payload,
      {
        season: 2,
        episode: 4,
        progress: 35
      }
    );
  }
);
