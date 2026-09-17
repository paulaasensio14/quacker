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

const tags = [
  "masterpiece",
  "casual",
  "surprised_me",
  "made_me_cry",
  "made_me_laugh",
  "comfort",
  "thought_provoking",
  "overrated",
  "underrated",
  "would_rewatch",
  "highly_recommended"
];

test(
  "Tu opinión declara exactamente los once tags rápidos canónicos",
  () => {
    assert.match(
      source,
      /const DETAIL_OPINION_TAGS = \[/
    );

    for (const tag of tags) {
      assert.match(
        source,
        new RegExp(`"${tag}"`)
      );
    }
  }
);

test(
  "los tags se renderizan como botones accesibles con estado seleccionado",
  () => {
    assert.match(
      source,
      /function _buildDetailOpinionTagControls\(opinion = null\)/
    );

    assert.match(
      source,
      /data-opinion-tag="\$\{_escapeHtml\(tag\)\}"/
    );

    assert.match(
      source,
      /aria-pressed="\$\{selected \? "true" : "false"\}"/
    );
  }
);

test(
  "el renderer de Tu opinión incluye los tags rápidos",
  () => {
    assert.match(
      source,
      /_buildDetailOpinionTagControls\(opinion\)/
    );

    assert.match(
      source,
      /detail_opinion_tags_label/
    );
  }
);

test(
  "todos los tags tienen textos internacionalizados",
  () => {
    assert.match(i18n, /detail_opinion_tags_label:/);

    for (const tag of tags) {
      assert.match(
        i18n,
        new RegExp(`detail_opinion_tag_${tag}:`)
      );
    }
  }
);
