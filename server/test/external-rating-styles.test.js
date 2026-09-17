import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const css = fs.readFileSync(
  new URL("../../assets/css/dashboard.css", import.meta.url),
  "utf8"
);

test(
  "la puntuación externa tiene estilo textual propio",
  () => {
    assert.match(css, /\.explore-rating-external\s*\{/);
    assert.match(css, /\.explore-rating-external-source\s*\{/);
    assert.match(css, /\.explore-rating-external-value\s*\{/);
  }
);

test(
  "la puntuación externa tiene variante compacta",
  () => {
    assert.match(
      css,
      /\.explore-rating-external--compact\s*\{/
    );
  }
);

test(
  "la puntuación externa se adapta al tema oscuro",
  () => {
    assert.match(
      css,
      /body\.dark-theme \.explore-rating-external/
    );
  }
);

test(
  "los estilos antiguos de patos externos desaparecen",
  () => {
    assert.doesNotMatch(css, /\.explore-rating-ducks\s*\{/);
    assert.doesNotMatch(css, /\.explore-rating-duck\s*\{/);
    assert.doesNotMatch(css, /\.explore-rating-number\s*\{/);
    assert.doesNotMatch(css, /\.explore-rating-ducks--compact\s*\{/);
    assert.doesNotMatch(css, /\.explore-rating-duck--compact\s*\{/);
    assert.doesNotMatch(css, /\.explore-rating-number--compact\s*\{/);
  }
);
