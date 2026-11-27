import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

function read(path) {
  return fs.readFileSync(
    new URL("../../" + path, import.meta.url),
    "utf8"
  );
}

const css = read("assets/css/design-feedback.css");
const html = read("dashboard.html");

const marker = "/* DS-07.5.1: confirmations */";
const confirmation = css.split(marker)[1] || "";

function rule(selector) {
  const start = confirmation.indexOf(selector + " {");

  assert.ok(start >= 0, "Falta selector: " + selector);

  const open = confirmation.indexOf("{", start);
  const end = confirmation.indexOf("}", open);

  assert.ok(end > open);

  return confirmation.slice(open + 1, end);
}

test("DS-07.5.1: conserva modales y acciones existentes", () => {
  for (const name of [
    "confirmDeleteList",
    "confirmClearNotifs"
  ]) {
    assert.ok(html.includes(`id="${name}Modal"`));
    assert.ok(html.includes(`id="${name}"`));
  }

  assert.match(
    html,
    /aria-labelledby="confirmDeleteListTitle"/
  );

  assert.match(
    html,
    /aria-labelledby="confirmClearNotifsTitle"/
  );

  assert.match(
    css,
    /\/\* DS-07.4: explore alignment \*\//
  );
});

test("DS-07.5.1: superficie compartida y adaptable", () => {
  const card = rule(
    "body :is(#confirmDeleteListModal, #confirmClearNotifsModal) .modal-card"
  );

  assert.match(card, /background:\s*var\(--q-surface\)/);
  assert.match(card, /color:\s*var\(--q-text\)/);
  assert.match(card, /border:\s*1px solid var\(--q-border\)/);
  assert.match(card, /width:\s*min\(100%, 440px\)/);
  assert.match(card, /overflow-y:\s*auto/);

  assert.match(
    confirmation,
    /@media \(max-width: 480px\)/
  );
});

test("DS-07.5.1: accion destructiva roja en ambos temas", () => {
  const button = rule("body #confirmDeleteList");

  assert.match(
    button,
    /background:\s*var\(--q-confirm-danger-bg\)/
  );

  assert.match(
    button,
    /color:\s*var\(--q-confirm-danger-text\)/
  );

  const light = rule(":root");
  const dark = rule("body.dark-theme");

  assert.match(light, /--q-confirm-danger-bg:\s*#ad2c22/);
  assert.match(light, /--q-confirm-danger-text:\s*#ffffff/);
  assert.match(dark, /--q-confirm-danger-bg:\s*#ff7a6b/);
  assert.match(dark, /--q-confirm-danger-text:\s*#17181c/);
});

test("DS-07.5.1: confirmacion ordinaria amarilla", () => {
  const button = rule("body #confirmClearNotifs");

  assert.match(button, /background:\s*var\(--q-brand\)/);
  assert.match(button, /color:\s*#17181c/);
});

test("DS-07.5.1: acciones accesibles y visibilidad conservada", () => {
  assert.match(confirmation, /min-height:\s*44px/);
  assert.match(confirmation, /:focus-visible/);
  assert.match(confirmation, /:disabled/);
  assert.match(confirmation, /prefers-reduced-motion:\s*reduce/);

  assert.match(
    confirmation,
    /:not\(\.is-open\)\s*\{[^}]*display:\s*none/s
  );

  assert.match(
    confirmation,
    /--q-confirm-trash-icon:/
  );

  assert.match(
    confirmation,
    /--q-confirm-bell-icon:/
  );

  assert.match(
    confirmation,
    /border-top:\s*1px solid var\(--q-border\)/
  );
});

test("DS-07.5.1: el simbolo decorativo se genera realmente", () => {
  const icon = rule(
    "body :is(#confirmDeleteListModal, #confirmClearNotifsModal) .modal-header::after"
  );

  assert.match(icon, /content:\s*""\s*;/);
  assert.match(icon, /mask:\s*var\(--q-confirm-icon\)/);
  assert.match(icon, /pointer-events:\s*none/);
});
