import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const source = fs.readFileSync(
  new URL("../../assets/js/app/library.js", import.meta.url),
  "utf8"
);

test(
  "Biblioteca mantiene un mapa de opiniones por itemId",
  () => {
    assert.match(source, /opinionsByItemId\s*=\s*new Map\(\)/);
  }
);

test(
  "Biblioteca carga las opiniones con una sola petición",
  () => {
    assert.match(source, /ApiClient\.getOpinions\(\)/);
    assert.match(source, /opinionsByItemId\.set/);
  }
);

test(
  "la tarjeta solo pinta valoración personal si existe rating válido",
  () => {
    assert.match(source, /buildLibraryPersonalRatingMarkup/);
    assert.match(source, /Number\.isInteger/);
    assert.match(source, /rating\s*<\s*1/);
    assert.match(source, /rating\s*>\s*5/);
  }
);

test(
  "la valoración compacta usa el pato de Quacker y el valor sobre cinco",
  () => {
    assert.match(source, /assets\/img\/quacker-rating\.png/);
    assert.match(source, /lib-personal-rating/);
    assert.match(source, /\/5/);
  }
);

test(
  "las tarjetas integran la valoración personal compacta",
  () => {
    assert.match(
      source,
      /const personalRatingMarkup\s*=\s*buildLibraryPersonalRatingMarkup\(itemId\)/
    );
    assert.match(source, /\$\{personalRatingMarkup\}/);
  }
);
