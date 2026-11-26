import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const read = relative => fs.readFileSync(
  new URL("../../" + relative, import.meta.url),
  "utf8"
);

const library = read("assets/js/app/library.js");
const cards = read("assets/css/design-cards.css");

function getButtonMarkup() {
  const start = library.indexOf(
    'class="lib-cover-list-btn lib-list-btn'
  );

  assert.ok(start >= 0, "Boton no localizado");

  const end = library.indexOf("</button>", start);

  assert.ok(end > start, "Cierre de boton no localizado");

  return library.slice(start, end + 9);
}

function getRule(selector) {
  const escaped = selector.replace(
    /[.*+?^${}()|[\]\\]/g,
    "\\$&"
  );

  const pattern = new RegExp(
    "(?:^|\\})\\s*" +
    escaped +
    "\\s*\\{([^}]*)\\}",
    "m"
  );

  const match = cards.match(pattern);

  assert.ok(
    match,
    "Regla CSS no encontrada: " + selector
  );

  return match[1];
}

const baseSelector =
  "#view-library .lib-cover .lib-cover-list-btn";

test("DS-06.3: conserva accion y estado de listas", () => {
  const button = getButtonMarkup();

  assert.ok(
    button.includes('data-action="add-to-list"')
  );

  assert.ok(
    button.includes('data-id="${safeItemId}"')
  );

  assert.ok(
    button.includes('aria-label="${safeListAriaLabel}"')
  );

  assert.ok(
    button.includes('isInAnyList ? "is-added"')
  );

  assert.ok(
    library.includes(
      'btn.classList.toggle("is-added", !!isAdded)'
    )
  );
});

test("DS-06.3: marcador SVG accesible", () => {
  const button = getButtonMarkup();

  assert.match(button, /<svg\b/);
  assert.match(button, /viewBox="0 0 24 24"/);
  assert.match(button, /aria-hidden="true"/);
  assert.match(button, /<path\b/);

  assert.match(button, /lib-list-label sr-only/);
});

test("DS-06.3: geometria circular estable", () => {
  const rule = getRule(baseSelector);

  assert.match(rule, /width:\s*33px\s*;/);
  assert.match(rule, /height:\s*33px\s*;/);
  assert.match(rule, /border-radius:\s*50%\s*;/);
  assert.match(rule, /box-sizing:\s*border-box\s*;/);
  assert.match(rule, /clip-path:\s*none\s*;/);
  assert.match(rule, /padding:\s*0\s*;/);
  assert.match(rule, /top:\s*4px\s*;/);
  assert.match(rule, /left:\s*10px\s*;/);
});

test("DS-06.3: estado activo conserva geometria", () => {
  const rule = getRule(
    baseSelector + ".is-added"
  );

  assert.match(
    rule,
    /background:\s*var\(--q-brand\)\s*;/
  );

  assert.doesNotMatch(
    rule,
    /(?:^|;)\s*(?:width|height|padding|border-radius|clip-path)\s*:/
  );

  const icon = getRule(
    baseSelector + ".is-added svg"
  );

  assert.match(icon, /fill:\s*currentColor\s*;/);
});

test("DS-06.3: icono proporcionado y centrado", () => {
  const rule = getRule(baseSelector + " svg");

  assert.match(rule, /width:\s*18px\s*;/);
  assert.match(rule, /height:\s*18px\s*;/);
  assert.match(rule, /fill:\s*none\s*;/);

  const button = getRule(baseSelector);

  assert.match(
    button,
    /align-items:\s*center\s*;/
  );

  assert.match(
    button,
    /justify-content:\s*center\s*;/
  );
});

test("DS-06.3: modo oscuro conserva forma circular", () => {
  const rule = getRule(
    "body.dark-theme " + baseSelector
  );

  assert.match(rule, /border-radius:\s*50%\s*;/);
  assert.match(rule, /box-shadow:\s*0 1px 3px/);
});

test("DS-06.3: pulsacion sin animacion de escala", () => {
  const rule = getRule(
    baseSelector + ".is-pulse"
  );

  assert.match(rule, /animation:\s*none\s*;/);
  assert.match(rule, /transform:\s*none\s*;/);
});
