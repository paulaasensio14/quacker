import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const url = new URL(
  "../../assets/css/design-components.css",
  import.meta.url
);

const htmlUrl = new URL(
  "../../dashboard.html",
  import.meta.url
);

const css = fs.existsSync(url)
  ? fs.readFileSync(url, "utf8")
  : "";

function rule(selector) {
  const escaped = selector.replace(
    /[.*+?^${}()|[\]\\]/g,
    "\\$&"
  );

  const expression = new RegExp(
    "(?:^|\\n)\\s*" +
    escaped +
    "\\s*\\{([^{}]*)\\}",
    "m"
  );

  return css.match(expression)?.[1] || "";
}

test("DS-01: hoja de componentes creada", () => {
  assert.ok(fs.existsSync(url));
});

test("DS-01: componentes cargados al final", () => {
  const html = fs.readFileSync(htmlUrl, "utf8");

  const tokens = html.indexOf(
    "assets/css/design-tokens.css"
  );

  const legacy = html.indexOf(
    "assets/css/dashboard.css"
  );

  const shell = html.indexOf(
    "assets/css/design-dashboard.css"
  );

  const components = html.indexOf(
    "assets/css/design-components.css"
  );

  assert.ok(tokens >= 0);
  assert.ok(legacy > tokens);
  assert.ok(shell > legacy);
  assert.ok(components > shell);
});

test("DS-01: navegacion clara y oscura", () => {
  const normal = rule(".nav-item-btn");
  const dark = rule(
    "body.dark-theme .nav-item-btn"
  );

  assert.match(
    normal,
    /background-color:\s*var\(--q-surface\)/
  );

  assert.match(
    normal,
    /color:\s*var\(--q-text\)/
  );

  assert.match(
    normal,
    /border:\s*1px solid var\(--q-border\)/
  );

  assert.match(
    dark,
    /background-color:\s*var\(--q-surface\)/
  );

  assert.match(
    rule(".nav-item-btn.is-active"),
    /background-color:\s*var\(--q-brand\)/
  );

  assert.match(
    rule("body.dark-theme .nav-item-btn.is-active"),
    /color:\s*var\(--q-bg\)/
  );

  assert.match(
    rule(
      "body.dark-theme .nav-item-btn:hover:not(.is-active)"
    ),
    /background-color:\s*var\(--q-surface-2\)/
  );
});

test("DS-01: busqueda y botones", () => {
  for (const selector of [
    ".search-input",
    ".btn-secondary",
    "body.dark-theme .search-input",
    "body.dark-theme .btn-secondary"
  ]) {
    const block = rule(selector);

    assert.match(
      block,
      /background-color:\s*var\(--q-surface\)/,
      selector
    );

    assert.match(
      block,
      /color:\s*var\(--q-text\)/,
      selector
    );
  }

  assert.match(
    rule(".btn-primary"),
    /background-color:\s*var\(--q-brand\)/
  );

  assert.match(
    rule("body.dark-theme .btn-primary"),
    /color:\s*var\(--q-bg\)/
  );
});

test("DS-01: tarjetas y colores centralizados", () => {
  for (const selector of [
    ".metric-card",
    ".content-card",
    ".list-card",
    ".profile-card",
    "body.dark-theme .profile-card"
  ]) {
    const block = rule(selector);

    assert.match(
      block,
      /background-color:\s*var\(--q-surface\)/,
      selector
    );

    assert.match(
      block,
      /border:\s*1px solid var\(--q-border\)/,
      selector
    );
  }

  assert.doesNotMatch(
    css,
    /#[\da-fA-F]{3,8}\b/,
    "Los componentes no deben duplicar hexadecimales"
  );

  // DS-01 puede cambiar los colores de Favoritos,
  // pero nunca su geometria ni la de las portadas.
  const slotRule = css.match(
    /(?:^|\n)\s*\.profile-favorite-slot\s*\{([^{}]*)\}/m
  )?.[1] || "";

  assert.match(
    slotRule,
    /background:\s*var\(--q-surface\)/
  );

  assert.doesNotMatch(
    slotRule,
    /\b(?:display|position|width|height|min-width|min-height|aspect-ratio|grid-template-columns|gap|padding|flex-direction|object-fit)\s*:/,
    "UX-04: no alterar dimensiones ni distribucion"
  );

  const coverRule = css.match(
    /(?:^|\n)\s*\.profile-favorite-cover-frame\s*\{([^{}]*)\}/m
  )?.[1] || "";

  assert.match(
    coverRule,
    /background:\s*var\(--q-surface-2\)/
  );

  assert.doesNotMatch(
    coverRule,
    /\b(?:width|height|aspect-ratio|object-fit)\s*:/,
    "UX-04: no alterar la proporcion de portadas"
  );
});
