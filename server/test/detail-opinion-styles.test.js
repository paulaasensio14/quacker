import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const css = fs.readFileSync(
  new URL("../../assets/css/dashboard.css", import.meta.url),
  "utf8"
);

test(
  "la tarjeta de opinión tiene estructura y espaciado propios",
  () => {
    assert.match(css, /\.content-detail-opinion-card\s*\{/);
    assert.match(
      css,
      /\.content-detail-opinion-rating-control(?:\s*,|\s*\{)/
    );
    assert.match(
      css,
      /\.content-detail-opinion-tags-control(?:\s*,|\s*\{)/
    );
    assert.match(
      css,
      /\.content-detail-opinion-review-editor(?:\s*,|\s*\{)/
    );
  }
);

test(
  "los patos muestran estados interactivos y selección",
  () => {
    assert.match(css, /\.content-detail-opinion-duck\s*\{/);
    assert.match(css, /\.content-detail-opinion-duck\.is-selected\s*\{/);
    assert.match(css, /\.content-detail-opinion-duck:hover/);
    assert.match(css, /\.content-detail-opinion-duck:focus-visible/);
  }
);

test(
  "los tags rápidos tienen estilo de píldora y estado seleccionado",
  () => {
    assert.match(css, /\.content-detail-opinion-tag\s*\{/);
    assert.match(css, /\.content-detail-opinion-tag\.is-selected\s*\{/);
    assert.match(css, /\.content-detail-opinion-tag:focus-visible/);
  }
);

test(
  "el editor de reseña estiliza textarea select y acciones",
  () => {
    assert.match(css, /\.content-detail-opinion-review-text\s*\{/);
    assert.match(css, /\.content-detail-opinion-review-privacy\s*\{/);
    assert.match(css, /\.content-detail-opinion-review-actions\s*\{/);
    assert.match(css, /\.content-detail-opinion-rating-remove\s*\{/);
  }
);

test(
  "la opinión tiene adaptación para tema oscuro",
  () => {
    assert.match(
      css,
      /body\.dark-theme \.content-detail-opinion-card/
    );

    assert.match(
      css,
      /body\.dark-theme \.content-detail-opinion-review-text/
    );

    assert.match(
      css,
      /body\.dark-theme \.content-detail-opinion-review-privacy/
    );
  }
);

test(
  "la opinión tiene ajuste específico para móvil",
  () => {
    assert.match(
      css,
      /@media \(max-width: 768px\)[\s\S]*\.content-detail-opinion-ducks/
    );

    assert.match(
      css,
      /@media \(max-width: 768px\)[\s\S]*\.content-detail-opinion-review-actions/
    );
  }
);
