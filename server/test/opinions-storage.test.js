import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const serverSource = fs.readFileSync(
  new URL("../server.js", import.meta.url),
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
  "opinions se normaliza siempre como una lista",
  () => {
    const fnSource = extractFunction(
      serverSource,
      "_normalizeOpinions"
    );

    const normalizeOpinions = Function(
      `"use strict"; return (${fnSource});`
    )();

    assert.deepEqual(
      normalizeOpinions(null),
      []
    );

    assert.deepEqual(
      normalizeOpinions({}),
      []
    );

    assert.deepEqual(
      normalizeOpinions([]),
      []
    );
  }
);

test(
  "_getUserBucket prepara opinions para usuarios existentes",
  () => {
    const start = serverSource.indexOf(
      "function _getUserBucket(db, userId)"
    );

    assert.notEqual(
      start,
      -1,
      "no se encontró _getUserBucket"
    );

    const block = serverSource.slice(
      start,
      serverSource.indexOf(
        "\nfunction ",
        start + 20
      )
    );

    assert.match(
      block,
      /opinions:\s*\[\]/
    );

    assert.match(
      block,
      /opinions\s*=\s*_normalizeOpinions/
    );
  }
);

test(
  "las cuentas nuevas empiezan con opinions vacío",
  () => {
    const registerStart = serverSource.indexOf(
      'app.post("/api/auth/register"'
    );

    assert.notEqual(
      registerStart,
      -1,
      "no se encontró POST /api/auth/register"
    );

    const registerBlock = serverSource.slice(
      registerStart,
      serverSource.indexOf(
        "\napp.",
        registerStart + 20
      )
    );

    assert.match(
      registerBlock,
      /opinions:\s*\[\]/
    );
  }
);
