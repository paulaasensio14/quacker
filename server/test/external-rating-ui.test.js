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
  "la puntuación externa no usa patos",
  () => {
    const start = source.indexOf("function _buildExploreRatingMarkup");
    const end = source.indexOf("const DETAIL_OPINION_TAGS", start);
    const fn = source.slice(start, end);

    assert.ok(start >= 0 && end > start);
    assert.doesNotMatch(fn, /quacker-rating\.png/);
    assert.doesNotMatch(fn, /explore-rating-duck/);
  }
);

test(
  "la puntuación externa identifica la fuente",
  () => {
    assert.match(source, /TMDB/);
    assert.match(source, /RAWG/);
    assert.match(source, /Open Library/);
  }
);

test(
  "TMDB muestra explícitamente su escala sobre 10",
  () => {
    assert.match(
      source,
      /\/10/
    );
  }
);

test(
  "existe una etiqueta internacionalizada de fallback",
  () => {
    assert.match(source, /external_rating_label/);

    const matches = i18n.match(
      /external_rating_label:/g
    ) || [];

    assert.ok(
      matches.length >= 2,
      "external_rating_label debe existir en español e inglés"
    );
  }
);

test(
  "la puntuación externa mantiene variante compacta sin patos",
  () => {
    assert.match(
      source,
      /explore-rating-external--compact/
    );
  }
);
