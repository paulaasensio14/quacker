import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const dashboard = fs.readFileSync(
  new URL("../../dashboard.html", import.meta.url),
  "utf8"
);

const exploreSource = fs.readFileSync(
  new URL("../../assets/js/app/explore.js", import.meta.url),
  "utf8"
);

const i18nSource = fs.readFileSync(
  new URL("../../assets/js/app/i18n.js", import.meta.url),
  "utf8"
);

test(
  "Explore dispone de un estado de error independiente del estado sin resultados",
  () => {
    assert.match(
      dashboard,
      /id="exploreError"[^>]*hidden/
    );

    assert.match(
      dashboard,
      /data-i18n="explore_error_title"/
    );

    assert.match(
      dashboard,
      /data-i18n="explore_error_text"/
    );

    assert.match(
      dashboard,
      /id="exploreErrorRetry"/
    );
  }
);

test(
  "Explore define textos de error de carga en español e inglés",
  () => {
    assert.match(
      i18nSource,
      /explore_error_title:\s*"[^"]+"/
    );

    assert.match(
      i18nSource,
      /explore_error_text:\s*"[^"]+"/
    );

    assert.match(
      i18nSource,
      /explore_error_cta:\s*"[^"]+"/
    );

    const titleMatches =
      i18nSource.match(/explore_error_title:\s*"[^"]+"/g) || [];

    assert.ok(
      titleMatches.length >= 2,
      "debe existir explore_error_title en ES y EN"
    );
  }
);

test(
  "Explore conserva un estado explícito cuando falla la carga principal",
  () => {
    assert.match(
      exploreSource,
      /let\s+__loadError\s*=\s*false/
    );

    assert.match(
      exploreSource,
      /catch\s*\(e\)\s*\{[\s\S]*?__loadError\s*=\s*true[\s\S]*?feed\s*=\s*\[\][\s\S]*?featuredFeed\s*=\s*\[\]/
    );

    assert.match(
      exploreSource,
      /getElementById\("exploreError"\)/
    );
  }
);
