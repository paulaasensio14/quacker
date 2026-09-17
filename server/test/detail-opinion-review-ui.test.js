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
  "Tu opinión incluye un editor de reseña opcional",
  () => {
    assert.match(
      source,
      /function _buildDetailOpinionReviewEditor\(opinion = null\)/
    );

    assert.match(
      source,
      /data-opinion-review-text/
    );

    assert.match(
      source,
      /detail_opinion_review_label/
    );
  }
);

test(
  "la reseña permite elegir privacidad privada o pública",
  () => {
    assert.match(
      source,
      /data-opinion-review-privacy/
    );

    assert.match(
      source,
      /value="private"/
    );

    assert.match(
      source,
      /value="public"/
    );
  }
);

test(
  "la reseña permite marcar spoiler y ofrece guardar o eliminar",
  () => {
    assert.match(
      source,
      /data-opinion-review-spoiler/
    );

    assert.match(
      source,
      /data-action="save-opinion-review"/
    );

    assert.match(
      source,
      /data-action="delete-opinion-review"/
    );
  }
);

test(
  "los textos de reseña están internacionalizados en ES y EN",
  () => {
    const keys = [
      "detail_opinion_review_label",
      "detail_opinion_review_placeholder",
      "detail_opinion_review_privacy",
      "detail_opinion_review_private",
      "detail_opinion_review_public",
      "detail_opinion_review_spoiler",
      "detail_opinion_review_save",
      "detail_opinion_review_delete"
    ];

    for (const key of keys) {
      const matches = i18n.match(
        new RegExp(`${key}:`, "g")
      ) || [];

      assert.ok(
        matches.length >= 2,
        `${key} debe existir en español e inglés`
      );
    }
  }
);
