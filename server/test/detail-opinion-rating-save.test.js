import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const source = fs.readFileSync(
  new URL("../../assets/js/app/explore.js", import.meta.url),
  "utf8"
);

test(
  "la valoración personal se guarda como parche parcial por itemId",
  () => {
    assert.match(
      source,
      /async function _saveDetailOpinionRating\(item,\s*rating\)/
    );

    assert.match(
      source,
      /const itemId = _normalizeId\(item\?\.__libraryItemId\)/
    );

    assert.match(
      source,
      /ApiClient\.saveOpinion\(\{\s*itemId,\s*rating\s*\}\)/
    );
  }
);

test(
  "solo se aceptan valoraciones enteras entre 1 y 5",
  () => {
    assert.match(
      source,
      /Number\.isInteger\(rating\)/
    );

    assert.match(
      source,
      /rating < 1 \|\| rating > 5/
    );
  }
);

test(
  "tras guardar se actualiza únicamente el estado local de opinión",
  () => {
    assert.match(
      source,
      /result\?\.ok/
    );

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
  "el listener delegado captura los cinco patos y guarda la selección",
  () => {
    assert.match(
      source,
      /e\.target\.closest\('\[data-opinion-rating\]'\)/
    );

    assert.match(
      source,
      /Number\(ratingButton\.dataset\.opinionRating\)/
    );

    assert.match(
      source,
      /const ratingSaved = await _saveDetailOpinionRating\(\s*activeDetailItem,\s*rating\s*\)/
    );
  }
);
