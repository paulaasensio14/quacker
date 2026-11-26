import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const root = new URL("../../", import.meta.url);

const controls = fs.readFileSync(
  new URL("assets/css/design-controls.css", root),
  "utf8"
);

/*
 * Verificar que cada control real dispone
 * de una definicion DS-04 que utilice
 * los tokens semanticos oficiales.
 *
 * Estas pruebas comprueban la estructura CSS.
 * La cascada efectiva se validara en Safari.
 */

const cases = [
  ["Biblioteca: accion principal", "lib-primary-btn"],
  ["Biblioteca: completar", "lib-complete-btn"],
  ["Biblioteca: agregar a lista", "lib-list-btn"],
  ["Inicio: retomar", "btn-retomar"],

  ["Votaciones: guardar voto", "list-poll-vote-save"],
  ["Votaciones: resultados", "list-poll-results-button"],
  ["Votaciones: cerrar", "list-poll-close"],

  ["Detalle: volver", "content-detail-back"],

  ["Favoritos: mover", "profile-favorite-action"],
  ["Favoritos: seleccionar", "profile-favorite-pick"],

  ["Eliminar contenido", "btn-delete-item"],

  ["Cabecera: botones de icono", "icon-button"],
  ["Botones compactos de icono", "icon-btn"],
  ["Cerrar ventanas", "modal-close"],
];

function hasSemanticRule(className) {
  const escaped = className.replace(
    /[.*+?^${}()|[\]\\]/g,
    "\\$&"
  );

  const classPattern = new RegExp(
    "\\." + escaped + "(?![A-Za-z0-9_-])"
  );

  const rules = controls.matchAll(
    /([^{}]+)\{([^{}]*)\}/gs
  );

  for (const match of rules) {
    const selector = match[1];
    const declarations = match[2];

    if (
      classPattern.test(selector) &&
      /var\(--q-[a-z0-9-]+/.test(declarations)
    ) {
      return true;
    }
  }

  return false;
}

for (const [description, className] of cases) {
  test("DS-04 especial: " + description, () => {
    assert.ok(
      hasSemanticRule(className),
      "Falta definicion semantica DS-04 para ." +
        className
    );
  });
}


// DS-04 DARK CASCADE REGRESSION 1132
// Comprobar que la regla del modo oscuro
// tenga especificidad contextual suficiente.

function darkRuleHasTokens(selector, tokens) {
  for (const match of controls.replace(
    /\/\*[\s\S]*?\*\//g, ""
  ).matchAll(
    /([^{}]+)\{([^{}]*)\}/gs
  )) {
    const selectors = match[1]
      .split(",")
      .map(value => value.trim());

    if (!selectors.includes(selector)) {
      continue;
    }

    if (tokens.every(token => match[2].includes(token))) {
      return true;
    }
  }

  return false;
}

test("DS-04: completar Biblioteca prevalece en oscuro", () => {
  assert.ok(
    darkRuleHasTokens(
      "body.dark-theme #view-library .lib-complete-btn",
      [
        "background: var(--q-success-soft)",
        "color: var(--q-success)"
      ]
    ),
    "Falta regla oscura especifica para completar"
  );
});

test("DS-04: guardar voto mantiene fondo de marca oscuro", () => {
  assert.ok(
    darkRuleHasTokens(
      "body.dark-theme .list-poll-actions .list-poll-vote-save",
      [
        "background: var(--q-brand)",
        "border-color: var(--q-brand)"
      ]
    ),
    "La variante primaria oscura pierde el fondo de marca"
  );
});


// DS-04 WHATS NEW CLOSE 1135
// Comprobar la especificidad del modal de novedades.

test("DS-04: cerrar novedades sin sombra heredada", () => {
  assert.ok(
    darkRuleHasTokens(
      "#whatsNewModal .modal-close",
      [
        "background: var(--q-surface)",
        "box-shadow: var(--q-elevation-flat)"
      ]
    ),
    "El modal de novedades conserva una sombra antigua"
  );
});

test("DS-04: hover de novedades usa superficie oficial", () => {
  assert.ok(
    darkRuleHasTokens(
      "#whatsNewModal .modal-close:hover:not(:disabled)",
      [
        "background: var(--q-surface-2)",
        "box-shadow: var(--q-elevation-flat)"
      ]
    ),
    "El hover del modal de novedades no esta unificado"
  );
});
