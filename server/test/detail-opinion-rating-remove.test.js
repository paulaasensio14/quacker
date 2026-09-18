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
      /const ratingRemoved = await _saveDetailOpinionRating\(\s*activeDetailItem,\s*null\s*\)/
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

test(
  "la valoración automática muestra feedback de éxito o error",
  () => {
    assert.match(
      source,
      /const ratingSaved = await _saveDetailOpinionRating\(\s*activeDetailItem,\s*rating\s*\)/
    );

    assert.match(
      source,
      /if\s*\(ratingSaved\)\s*\{[\s\S]*?window\.toast\?\.\(\{[\s\S]*?detail_opinion_rating_saved[\s\S]*?type:\s*"success"/
    );

    assert.match(
      source,
      /else\s*\{[\s\S]*?window\.toast\?\.\(\{[\s\S]*?detail_opinion_rating_save_error[\s\S]*?type:\s*"error"/
    );
  }
);

test(
  "quitar valoración muestra feedback de éxito o error",
  () => {
    assert.match(
      source,
      /const ratingRemoved = await _saveDetailOpinionRating\(\s*activeDetailItem,\s*null\s*\)/
    );

    assert.match(
      source,
      /if\s*\(ratingRemoved\)\s*\{[\s\S]*?window\.toast\?\.\(\{[\s\S]*?detail_opinion_rating_removed[\s\S]*?type:\s*"success"/
    );

    assert.match(
      source,
      /detail_opinion_rating_save_error/
    );
  }
);

test(
  "el feedback de valoración automática está traducido en ES y EN",
  () => {
    assert.match(
      i18n,
      /detail_opinion_rating_saved:\s*"Valoración guardada"/
    );

    assert.match(
      i18n,
      /detail_opinion_rating_removed:\s*"Valoración eliminada"/
    );

    assert.match(
      i18n,
      /detail_opinion_rating_save_error:\s*"No se pudo guardar la valoración"/
    );

    assert.match(
      i18n,
      /detail_opinion_rating_saved:\s*"Rating saved"/
    );

    assert.match(
      i18n,
      /detail_opinion_rating_removed:\s*"Rating removed"/
    );

    assert.match(
      i18n,
      /detail_opinion_rating_save_error:\s*"Could not save the rating"/
    );
  }
);
