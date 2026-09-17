import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const source = fs.readFileSync(
  new URL("../../assets/js/app/explore.js", import.meta.url),
  "utf8"
);

test(
  "Explore define un renderer específico para Tu opinión",
  () => {
    assert.match(
      source,
      /function _renderContentDetailOpinion\(opinionEl,\s*opinionCardEl,\s*item\)/
    );

    assert.match(
      source,
      /renderOpinion:\s*_renderContentDetailOpinion/
    );
  }
);

test(
  "el renderer contempla loading, error, vacío y opinión existente",
  () => {
    assert.match(
      source,
      /__detailOpinionState\.loading/
    );

    assert.match(
      source,
      /__detailOpinionState\.error/
    );

    assert.match(
      source,
      /__detailOpinionState\.opinion/
    );

    assert.match(
      source,
      /opinionCardEl\.hidden/
    );
  }
);

test(
  "la tarjeta de opinión usa textos internacionalizados",
  () => {
    const i18n = fs.readFileSync(
      new URL("../../assets/js/app/i18n.js", import.meta.url),
      "utf8"
    );

    assert.match(i18n, /detail_opinion_title:/);
    assert.match(i18n, /detail_opinion_loading:/);
    assert.match(i18n, /detail_opinion_empty:/);
    assert.match(i18n, /detail_opinion_error:/);
  }
);
