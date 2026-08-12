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

    const bindStart = exploreSource.indexOf(
      "function _bindExploreToolbar()"
    );

    const bindEnd = exploreSource.indexOf(
      "function _openExploreDrawer",
      bindStart
    );

    assert.notEqual(
      bindStart,
      -1,
      "debe existir _bindExploreToolbar"
    );

    assert.notEqual(
      bindEnd,
      -1,
      "debe poder aislarse _bindExploreToolbar"
    );

    const bindToolbar = exploreSource.slice(bindStart, bindEnd);

    const pillsListenerStart = bindToolbar.indexOf(
      'pillsRoot.addEventListener("click"'
    );

    const sortBlockStart = bindToolbar.indexOf(
      "if (sortSelect)"
    );

    const retryBlockStart = bindToolbar.indexOf(
      "if (retryBtn)"
    );

    assert.ok(
      pillsListenerStart >= 0,
      "debe existir el listener de filtros"
    );

    assert.ok(
      sortBlockStart > pillsListenerStart,
      "el bloque de orden debe ir después del listener de filtros"
    );

    assert.ok(
      retryBlockStart > sortBlockStart,
      "Reintentar debe registrarse fuera del listener de filtros"
    );

    const pillsListenerBlock = bindToolbar.slice(
      pillsListenerStart,
      sortBlockStart
    );

    assert.doesNotMatch(
      pillsListenerBlock,
      /retryBtn/,
      "Reintentar no debe registrarse dentro del listener de filtros"
    );

    assert.match(
      bindToolbar.slice(retryBlockStart),
      /retryBtn\.addEventListener\("click",\s*\(\)\s*=>\s*\{\s*load\(\);\s*\}\);/s
    );
  }
);
