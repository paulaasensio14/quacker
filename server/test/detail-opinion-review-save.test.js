import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const source = fs.readFileSync(
  new URL("../../assets/js/app/explore.js", import.meta.url),
  "utf8"
);

test(
  "la reseña se guarda como parche parcial por itemId",
  () => {
    assert.match(
      source,
      /async function _saveDetailOpinionReview\(item,\s*review\)/
    );

    assert.match(
      source,
      /const itemId = _normalizeId\(item\?\.__libraryItemId\)/
    );

    assert.match(
      source,
      /ApiClient\.saveOpinion\(\{\s*itemId,\s*review\s*\}\)/
    );
  }
);

test(
  "Guardar reseña recoge texto, privacidad y spoiler del editor",
  () => {
    assert.match(
      source,
      /e\.target\.closest\('\[data-action="save-opinion-review"\]'\)/
    );

    assert.match(
      source,
      /querySelector\("\[data-opinion-review-text\]"\)/
    );

    assert.match(
      source,
      /querySelector\("\[data-opinion-review-privacy\]"\)/
    );

    assert.match(
      source,
      /querySelector\("\[data-opinion-review-spoiler\]"\)/
    );

    assert.match(
      source,
      /privacy === "public" \? "public" : "private"/
    );

    assert.match(
      source,
      /spoiler:\s*spoilerInput\?\.checked === true/
    );
  }
);

test(
  "una reseña vacía no crea una opinión inválida",
  () => {
    assert.match(
      source,
      /const text = _safeText\(textInput\?\.value\)\.trim\(\)/
    );

    assert.match(
      source,
      /if \(!text\) return/
    );
  }
);

test(
  "Eliminar reseña envía review null y conserva el resto de la opinión",
  () => {
    assert.match(
      source,
      /e\.target\.closest\('\[data-action="delete-opinion-review"\]'\)/
    );

    assert.match(
      source,
      /await _saveDetailOpinionReview\(activeDetailItem,\s*null\)/
    );

    assert.match(
      source,
      /opinion:\s*result\.opinion\s*\|\|\s*null/
    );
  }
);

const i18nSource = fs.readFileSync(
  new URL("../../assets/js/app/i18n.js", import.meta.url),
  "utf8"
);

test(
  "Guardar reseña muestra feedback de éxito o error según el resultado",
  () => {
    assert.match(
      source,
      /const reviewSaved = await _saveDetailOpinionReview\(\s*activeDetailItem,\s*review\s*\)/
    );

    assert.match(
      source,
      /if\s*\(reviewSaved\)\s*\{[\s\S]*?window\.toast\?\.\(\{[\s\S]*?detail_opinion_review_saved[\s\S]*?type:\s*"success"/
    );

    assert.match(
      source,
      /else\s*\{[\s\S]*?window\.toast\?\.\(\{[\s\S]*?detail_opinion_review_save_error[\s\S]*?type:\s*"error"/
    );
  }
);

test(
  "el feedback de guardado de reseña está traducido en ES y EN",
  () => {
    assert.match(
      i18nSource,
      /detail_opinion_review_saved:\s*"Reseña guardada"/
    );

    assert.match(
      i18nSource,
      /detail_opinion_review_save_error:\s*"No se pudo guardar la reseña"/
    );

    assert.match(
      i18nSource,
      /detail_opinion_review_saved:\s*"Review saved"/
    );

    assert.match(
      i18nSource,
      /detail_opinion_review_save_error:\s*"Could not save the review"/
    );
  }
);
