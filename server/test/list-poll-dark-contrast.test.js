import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const css = fs.readFileSync(
  new URL("../../assets/css/dashboard.css", import.meta.url),
  "utf8"
);

const html = fs.readFileSync(
  new URL("../../dashboard.html", import.meta.url),
  "utf8"
);

function rule(selector) {
  const start = css.indexOf(`${selector} {`);
  assert.notEqual(start, -1, `Falta regla: ${selector}`);
  const end = css.indexOf("}", start);
  assert.ok(end > start);
  return css.slice(start, end + 1);
}

test("modal de votaciones conserva sus controles", () => {
  for (const id of [
    "listPollModal",
    "lpm_title",
    "lpm_deadline",
    "lpm_multiple",
    "lpm_options"
  ]) {
    assert.ok(html.includes(`id="${id}"`), `Falta ${id}`);
  }
});

test("campos de votacion legibles en modo oscuro", () => {
  const text = rule(
    'body.dark-theme #listPollModal .modal-field input:not([type="checkbox"])'
  );
  assert.match(text, /background:\s*#081523;/);
  assert.match(text, /color:\s*var\(--text-main\);/);
  assert.match(text, /color-scheme:\s*dark;/);
});

test("placeholder visible en modo oscuro", () => {
  const text = rule(
    'body.dark-theme #listPollModal .modal-field input:not([type="checkbox"])::placeholder'
  );
  assert.match(text, /color:\s*#cbd5e1;/);
  assert.match(text, /opacity:\s*1;/);
});

test("campos tienen indicador de foco", () => {
  const text = rule(
    'body.dark-theme #listPollModal .modal-field input:not([type="checkbox"]):focus-visible'
  );
  assert.match(text, /outline:\s*3px solid var\(--bg-yellow\);/);
});

test("casilla de voto multiple conserva tamaño", () => {
  const text = rule("#listPollModal #lpm_multiple");
  assert.match(text, /width:\s*18px;/);
  assert.match(text, /height:\s*18px;/);
});

test("boton cerrar conserva contraste", () => {
  const text = rule(
    "body.dark-theme #listPollModal .modal-close"
  );
  assert.match(text, /background:\s*#f9fafb;/);
  assert.match(text, /color:\s*#111827;/);
});

test("opciones seleccionadas contrastan en modo oscuro", () => {
  const text = rule(
    "body.dark-theme :is(.list-poll-option-label, .list-poll-modal-option):has(input:checked)"
  );
  assert.match(text, /background:\s*#18344b;/);
  assert.match(text, /color:\s*var\(--text-main\);/);
  assert.match(text, /border-color:\s*var\(--bg-yellow\);/);
});

test("opciones admiten foco visible de teclado", () => {
  const text = rule(
    "body.dark-theme :is(.list-poll-option-label, .list-poll-modal-option):focus-within"
  );
  assert.match(text, /outline:\s*3px solid var\(--bg-yellow\);/);
});


test("elimina las vinetas de votaciones", () => {
  const text = rule(".list-poll-options");
  assert.match(text, /list-style:\s*none;/);
  assert.match(text, /padding:\s*0;/);
  assert.match(text, /margin:\s*0;/);
});
