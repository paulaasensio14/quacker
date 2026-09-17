import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const source = fs.readFileSync(
  new URL("../../assets/js/app/explore.js", import.meta.url),
  "utf8"
);

const i18n = fs.readFileSync(
  new URL("../../assets/js/app/i18n.js", import.meta.url),
  "utf8"
);

test(
  "una valoración existente ofrece Quitar valoración",
  () => {
    assert.match(
      source,
      /data-action="clear-opinion-rating"/
    );

    assert.match(
      source,
      /detail_opinion_rating_remove/
    );
  }
);

test(
  "Quitar valoración solo aparece cuando existe una valoración personal",
  () => {
    assert.match(
      source,
      /currentRating !== null[\s\S]*data-action="clear-opinion-rating"/
    );
  }
);

test(
  "el guardado de valoración acepta null para eliminarla",
  () => {
    assert.match(
      source,
      /rating !== null[\s\S]*!Number\.isInteger\(rating\)/
    );

    assert.match(
      source,
      /ApiClient\.saveOpinion\(\{\s*itemId,\s*rating\s*\}\)/
    );
  }
);

test(
  "el listener de Quitar valoración guarda rating null",
  () => {
    assert.match(
      source,
      /e\.target\.closest\('\[data-action="clear-opinion-rating"\]'\)/
    );

    assert.match(
      source,
      /await _saveDetailOpinionRating\(activeDetailItem,\s*null\)/
    );

    const matches = i18n.match(
      /detail_opinion_rating_remove:/g
    ) || [];

    assert.ok(
      matches.length >= 2,
      "detail_opinion_rating_remove debe existir en español e inglés"
    );
  }
);
