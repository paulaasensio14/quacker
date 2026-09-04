import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const serverSource = fs.readFileSync(
  new URL("../server.js", import.meta.url),
  "utf8"
);

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

test(
  "el backend conserva el progreso histórico dentro del payload de actividad",
  () => {
    const fnSource = extractFunction(
      serverSource,
      "_normalizeActivityPayload"
    );

    const normalizeActivityPayload = Function(
      `"use strict"; return (${fnSource});`
    )();

    assert.deepEqual(
      normalizeActivityPayload({ progress: 20 }),
      { progress: 20 }
    );

    assert.deepEqual(
      normalizeActivityPayload({
        season: 2,
        episode: 4,
        progress: 35
      }),
      {
        season: 2,
        episode: 4,
        progress: 35
      }
    );
  }
);

test(
  "el PATCH de Library registra el progreso actual dentro de la actividad",
  () => {
    const patchStart = serverSource.indexOf(
      'app.patch("/api/library/:id"'
    );

    assert.notEqual(
      patchStart,
      -1,
      "no se encontró PATCH /api/library/:id"
    );

    const patchBlock = serverSource.slice(
      patchStart,
      serverSource.indexOf(
        'app.delete("/api/library/:id"',
        patchStart
      )
    );

    assert.match(
      patchBlock,
      /progress:\s*nextProgress/,
      "la actividad debe persistir nextProgress en su payload"
    );
  }
);

test(
  "Activity usa payload.progress y no el progreso actual del item",
  () => {
    const fnSource = extractFunction(
      apiClientSource,
      "metaForActivity"
    );

    const metaForActivity = Function(
      "metaForItem",
      `"use strict"; return (${fnSource});`
    )(() => "PROGRESO_ACTUAL");

    assert.equal(
      metaForActivity(
        {
          type: "progress",
          payload: { progress: 20 }
        },
        {
          type: "game",
          progress: 30
        }
      ),
      "20%"
    );
  }
);
