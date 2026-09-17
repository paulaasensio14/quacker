import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const source = fs.readFileSync(
  new URL("../../assets/js/app/explore.js", import.meta.url),
  "utf8"
);

test(
  "Explore carga la opinión del detalle usando el itemId real de Library",
  () => {
    assert.match(
      source,
      /async function _loadDetailOpinion\(item\)/
    );

    assert.match(
      source,
      /const itemId = _normalizeId\(item\?\.__libraryItemId\)/
    );

    assert.match(
      source,
      /ApiClient\.getOpinions\(\{\s*itemId\s*\}\)/
    );

    assert.match(
      source,
      /opinion:\s*opinions\[0\]\s*\|\|\s*null/
    );
  }
);

test(
  "la carga de opinión evita peticiones duplicadas para el mismo itemId",
  () => {
    assert.match(
      source,
      /__detailOpinionState\.itemId === itemId/
    );

    assert.match(
      source,
      /__detailOpinionState\.loading/
    );
  }
);

test(
  "la carga de opinión conserva un estado de error controlado",
  () => {
    assert.match(
      source,
      /catch\s*\(error\)/
    );

    assert.match(
      source,
      /error:\s*true/
    );
  }
);
