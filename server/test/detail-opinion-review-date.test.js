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
  "una reseña existente muestra su fecha",
  () => {
    assert.match(
      source,
      /review\?\.updatedAt \|\| review\?\.createdAt/
    );

    assert.match(
      source,
      /_formatExploreDate\(/
    );

    assert.match(
      source,
      /content-detail-opinion-review-date/
    );
  }
);

test(
  "la fecha de reseña usa un texto internacionalizado",
  () => {
    assert.match(
      source,
      /detail_opinion_review_date/
    );

    const matches = i18n.match(
      /detail_opinion_review_date:/g
    ) || [];

    assert.ok(
      matches.length >= 2,
      "detail_opinion_review_date debe existir en español e inglés"
    );
  }
);

test(
  "si no hay reseña no se muestra una fecha vacía",
  () => {
    assert.match(
      source,
      /hasReview[\s\S]*reviewDateMarkup/
    );
  }
);
