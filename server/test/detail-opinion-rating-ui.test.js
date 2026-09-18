import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const source = fs.readFileSync(
  new URL("../../assets/js/app/explore.js", import.meta.url),
  "utf8"
);

test(
  "Tu opinión construye exactamente cinco controles de valoración personal",
  () => {
    assert.match(
      source,
      /function _buildDetailOpinionRatingControls\(opinion = null\)/
    );

    assert.match(
      source,
      /Array\.from\(\{\s*length:\s*5\s*\}/
    );

    assert.match(
      source,
      /data-opinion-rating="\$\{value\}"/
    );
  }
);

test(
  "cada pato de valoración es un botón accesible y refleja la selección",
  () => {
    assert.match(
      source,
      /type="button"/
    );

    assert.match(
      source,
      /aria-label="\$\{_escapeHtml\(ariaLabel\)\}"/
    );

    assert.match(
      source,
      /aria-pressed="\$\{selected \? "true" : "false"\}"/
    );
  }
);

test(
  "el renderer de Tu opinión incluye los cinco patos tanto con como sin opinión previa",
  () => {
    assert.match(
      source,
      /_buildDetailOpinionRatingControls\(opinion\)/
    );

    assert.match(
      source,
      /detail_opinion_rating_label/
    );
  }
);

test(
  "la valoración personal tiene textos ES y EN propios",
  () => {
    const i18n = fs.readFileSync(
      new URL("../../assets/js/app/i18n.js", import.meta.url),
      "utf8"
    );

    assert.match(i18n, /detail_opinion_rating_label:/);
    assert.match(i18n, /detail_opinion_rating_value:/);
  }
);

test(
  "la valoración usa el asset de Quacker y la selección es acumulativa",
  () => {
    const start = source.indexOf(
      "function _buildDetailOpinionRatingControls(opinion = null)"
    );
    const end = source.indexOf(
      "\n  function _renderContentDetailOpinion",
      start
    );

    assert.notEqual(start, -1);
    assert.notEqual(end, -1);

    const block = source.slice(start, end);

    assert.match(
      block,
      /assets\/img\/quacker-rating\.png/
    );

    assert.doesNotMatch(
      block,
      /🦆/
    );

    assert.match(
      block,
      /value\s*<=\s*currentRating/
    );
  }
);
