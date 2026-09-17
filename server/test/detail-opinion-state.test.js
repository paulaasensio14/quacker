import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const source = fs.readFileSync(
  new URL("../../assets/js/app/explore.js", import.meta.url),
  "utf8"
);

test(
  "Explore mantiene un estado aislado para la opinión del detalle",
  () => {
    assert.match(
      source,
      /let __detailOpinionState = \{\s*itemId:\s*"",\s*loading:\s*false,\s*opinion:\s*null,\s*error:\s*false\s*\};/s
    );

    assert.match(
      source,
      /function _resetDetailOpinionState\(\)/
    );
  }
);

test(
  "cerrar Detail limpia el estado de opinión para no reutilizar datos de otra obra",
  () => {
    const start = source.indexOf(
      "function _closeContentDetailView"
    );

    const end = source.indexOf(
      "function _getExploreListPickerRefs",
      start
    );

    assert.notEqual(start, -1);
    assert.notEqual(end, -1);

    const closeBlock = source.slice(start, end);

    assert.match(
      closeBlock,
      /_resetDetailOpinionState\(\)/
    );
  }
);
