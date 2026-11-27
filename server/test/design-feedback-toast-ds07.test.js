import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const root = new URL("../../", import.meta.url);

function read(relative) {
  return fs.readFileSync(
    new URL(relative, root),
    "utf8"
  );
}

function feedback() {
  const file = new URL(
    "assets/css/design-feedback.css",
    root
  );

  assert.ok(
    fs.existsSync(file),
    "Falta la hoja compartida design-feedback.css"
  );

  return fs.readFileSync(file, "utf8");
}

function getRule(css, selector) {
  const escaped = selector.replace(
    /[.*+?^${}()|[\]\\]/g,
    "\\$&"
  );

  const pattern = new RegExp(
    "(?:^|\\})\\s*" +
    escaped +
    "\\s*\\{([^{}]*)\\}",
    "m"
  );

  const match = css.match(pattern);

  assert.ok(
    match,
    "Regla CSS no encontrada: " + selector
  );

  return match[1];
}

test("DS-07.1: conserva contrato publico y accesibilidad", () => {
  const js = read("assets/js/app/ui-toast.js");

  assert.match(js, /window\.toast\s*=\s*showToast/);
  assert.match(js, /aria-live",\s*"polite"/);
  assert.match(js, /role",\s*"status"/);
  assert.match(js, /toast-close/);
  assert.match(js, /toast-action/);
  assert.match(js, /await onAction\(\)/);
  assert.match(js, /escapeHtml/);
});

test("DS-07.1: hoja compartida en landing y dashboard", () => {
  feedback();

  for (const page of ["index.html", "dashboard.html"]) {
    const html = read(page);

    const links = [
      ...html.matchAll(
        /href="(assets\/css\/[^"]+\.css)"/g
      )
    ].map(match => match[1]);

    const shared = "assets/css/design-feedback.css";

    assert.equal(
      links.filter(link => link === shared).length,
      1,
      page
    );

    assert.equal(
      links.at(-1),
      shared,
      "La hoja compartida debe cargarse al final"
    );
  }
});

test("DS-07.1: superficies invertidas entre temas", () => {
  const css = feedback();

  const light = getRule(css, ".toast");
  const dark = getRule(css, "body.dark-theme .toast");

  assert.match(
    light,
    /--q-toast-bg:\s*#17181c\s*;/i
  );

  assert.match(
    light,
    /--q-toast-text:\s*#f3f0e8\s*;/i
  );

  assert.match(
    dark,
    /--q-toast-bg:\s*#f3f0e8\s*;/i
  );

  assert.match(
    dark,
    /--q-toast-text:\s*#17181c\s*;/i
  );

  assert.match(
    light,
    /background:\s*var\(--q-toast-bg\)\s*;/
  );

  assert.match(
    light,
    /color:\s*var\(--q-toast-text\)\s*;/
  );
});

test("DS-07.1: iconos semanticos circulares", () => {
  const css = feedback();

  const icon = getRule(css, ".toast-icon");

  assert.match(icon, /border-radius:\s*50%\s*;/);
  assert.match(icon, /width:\s*28px\s*;/);
  assert.match(icon, /height:\s*28px\s*;/);
  assert.match(icon, /box-sizing:\s*border-box\s*;/);
  assert.match(icon, /flex-shrink:\s*0\s*;/);

  assert.match(
    getRule(css, ".toast--success .toast-icon"),
    /background\s*:/
  );

  assert.match(
    getRule(css, ".toast--error .toast-icon"),
    /background\s*:/
  );

  assert.match(
    getRule(css, ".toast--info .toast-icon"),
    /background\s*:/
  );
});

test("DS-07.1: acciones de texto sin sombras heredadas", () => {
  const css = feedback();

  const light = getRule(css, ".toast");
  const dark = getRule(css, "body.dark-theme .toast");

  assert.match(
    light,
    /--q-toast-action:\s*var\(--q-brand\)\s*;/
  );

  assert.match(
    dark,
    /--q-toast-action:\s*#795d00\s*;/i
  );

  const action = getRule(css, ".toast-btn.toast-action");

  assert.match(
    action,
    /color:\s*var\(--q-toast-action\)\s*;/
  );

  assert.match(action, /background:\s*transparent\s*;/);
  assert.match(action, /box-shadow:\s*none\s*;/);
});

test("DS-07.1: contenido adaptable sin truncado obligatorio", () => {
  const css = feedback();

  const toast = getRule(css, ".toast");
  const content = getRule(css, ".toast-content");
  const message = getRule(css, ".toast-message");

  assert.match(toast, /min-width:\s*0\s*;/);

  assert.match(
    toast,
    /box-sizing:\s*border-box\s*;/
  );

  assert.match(content, /min-width:\s*0\s*;/);
  assert.match(message, /overflow-wrap:\s*anywhere\s*;/);
  assert.match(message, /white-space:\s*normal\s*;/);
});

test("DS-07.1: foco visible y movimiento reducido", () => {
  const css = feedback();

  const focus = getRule(css, ".toast-btn:focus-visible");

  assert.match(focus, /outline:\s*[^;]+;/);

  assert.doesNotMatch(
    focus,
    /outline:\s*none\s*;/
  );

  assert.match(
    css,
    /@media\s*\(prefers-reduced-motion:\s*reduce\)/
  );

  assert.match(
    css,
    /@media\s*\(prefers-reduced-motion:\s*reduce\)\s*\{[\s\S]*?\.toast[\s\S]*?transition:\s*none\s*;/
  );
});
