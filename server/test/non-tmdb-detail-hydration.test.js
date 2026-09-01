import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

function extractFunction(source, functionName) {
  const start = source.indexOf(`async function ${functionName}`);
  assert.notEqual(start, -1, `${functionName} debe existir`);

  const openBrace = source.indexOf("{", start);
  assert.notEqual(openBrace, -1);

  let depth = 0;

  for (let i = openBrace; i < source.length; i += 1) {
    if (source[i] === "{") depth += 1;
    if (source[i] === "}") depth -= 1;

    if (depth === 0) {
      return source.slice(start, i + 1);
    }
  }

  throw new Error(`No se pudo extraer ${functionName}`);
}

test(
  "Explore hidrata también el detalle de fuentes no TMDB",
  () => {
    const source = fs.readFileSync(
      new URL("../../assets/js/app/explore.js", import.meta.url),
      "utf8"
    );

    const fn = extractFunction(
      source,
      "_fetchHydratedExploreItemDetail"
    );

    assert.doesNotMatch(
      fn,
      /if\s*\(\s*source\s*!==\s*["']tmdb["']\s*\)\s*return\s+item\s*;/
    );

    assert.match(
      fn,
      /ApiClient\.getExploreItemDetail\s*\(\s*\{\s*source\s*,\s*type\s*,\s*externalId\s*\}\s*\)/
    );
  }
);
