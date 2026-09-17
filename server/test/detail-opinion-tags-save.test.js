import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const source = fs.readFileSync(
  new URL("../../assets/js/app/explore.js", import.meta.url),
  "utf8"
);

test(
  "los tags se guardan como parche parcial por itemId",
  () => {
    assert.match(
      source,
      /async function _saveDetailOpinionTags\(item,\s*tags\)/
    );

    assert.match(
      source,
      /const itemId = _normalizeId\(item\?\.__libraryItemId\)/
    );

    assert.match(
      source,
      /ApiClient\.saveOpinion\(\{\s*itemId,\s*tags:\s*normalizedTags\s*\}\)/
    );
  }
);

test(
  "solo se guardan tags canónicos sin duplicados",
  () => {
    assert.match(
      source,
      /DETAIL_OPINION_TAGS\.includes\(tag\)/
    );

    assert.match(
      source,
      /new Set\(/
    );
  }
);

test(
  "tras guardar tags se actualiza el estado local de opinión",
  () => {
    assert.match(
      source,
      /opinion:\s*result\.opinion\s*\|\|\s*null/
    );

    assert.match(
      source,
      /window\.DetailModule\?\.render\?\.\(activeItem\)/
    );
  }
);

test(
  "el listener delegado alterna el tag pulsado",
  () => {
    assert.match(
      source,
      /e\.target\.closest\('\[data-opinion-tag\]'\)/
    );

    assert.match(
      source,
      /const currentTags = Array\.isArray\(__detailOpinionState\.opinion\?\.tags\)/
    );

    assert.match(
      source,
      /await _saveDetailOpinionTags\(activeDetailItem,\s*nextTags\)/
    );
  }
);
