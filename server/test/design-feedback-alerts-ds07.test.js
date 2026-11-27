import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const css = fs.readFileSync(
  new URL("../../assets/css/design-feedback.css", import.meta.url),
  "utf8"
);

function getRule(selector) {
  const escaped = selector.replace(
    /[.*+?^${}()|[\]\\]/g,
    "\\$&"
  );

  const match = css.match(
    new RegExp(
      "(?:^|\\})\\s*" +
      escaped +
      "\\s*\\{([^{}]*)\\}",
      "m"
    )
  );

  assert.ok(match, "Regla no encontrada: " + selector);

  return match[1];
}

function luminance(hex) {
  const rgb = hex.slice(1).match(/.{2}/g).map(value => {
    const c = parseInt(value, 16) / 255;

    return c <= 0.04045
      ? c / 12.92
      : ((c + 0.055) / 1.055) ** 2.4;
  });

  return rgb[0] * 0.2126
    + rgb[1] * 0.7152
    + rgb[2] * 0.0722;
}

function contrast(a, b) {
  const first = luminance(a);
  const second = luminance(b);

  return (
    Math.max(first, second) + 0.05
  ) / (
    Math.min(first, second) + 0.05
  );
}

function token(rule, name) {
  const match = rule.match(
    new RegExp(name + ":\\s*(#[a-f0-9]{6})\\s*;", "i")
  );

  assert.ok(match, "Token ausente: " + name);

  return match[1];
}

test("DS-07.2: conserva avisos emergentes aprobados", () => {
  assert.match(
    css,
    /--q-toast-bg:\s*#17181c\s*;/i
  );

  assert.match(
    css,
    /\.toast--success\.toast--list \.toast-icon/
  );
});

test("DS-07.2: cuatro estados semanticos en ambos temas", () => {
  const light = getRule(":root");
  const dark = getRule("body.dark-theme");

  for (const state of ["info", "success", "warning", "error"]) {
    for (const theme of [light, dark]) {
      token(theme, "--q-alert-" + state + "-bg");
      token(theme, "--q-alert-" + state + "-ink");
    }

    const rule = getRule(".q-alert--" + state);

    assert.match(
      rule,
      new RegExp(
        "--q-alert-bg:\\s*var\\(--q-alert-" +
        state + "-bg\\)"
      )
    );
  }
});

test("DS-07.2: contraste AA de las cuatro variantes", () => {
  for (const selector of [":root", "body.dark-theme"]) {
    const rule = getRule(selector);

    for (const state of ["info", "success", "warning", "error"]) {
      const bg = token(rule, "--q-alert-" + state + "-bg");
      const ink = token(rule, "--q-alert-" + state + "-ink");

      const ratio = contrast(bg, ink);

      assert.ok(
        ratio >= 4.5,
        selector + " " + state + ": " + ratio.toFixed(2)
      );
    }
  }
});

test("DS-07.2: base adaptable y sin sombras heredadas", () => {
  const rule = getRule(".q-alert");

  assert.match(rule, /box-sizing:\s*border-box\s*;/);
  assert.match(rule, /border-radius:\s*12px\s*;/);
  assert.match(rule, /overflow-wrap:\s*anywhere\s*;/);
  assert.match(rule, /min-width:\s*0\s*;/);
  assert.match(rule, /box-shadow:\s*none\s*;/);
  assert.doesNotMatch(rule, /height:\s*\d+px\s*;/);
});

test("DS-07.2: errores existentes conectados a la variante error", () => {
  const selectors = [
    ".modal-errors",
    ".profile-form-errors",
    ".form-errors",
    ".auth-error",
    ".content-detail-feedback--error"
  ];

  const errorRules = css.match(
    /[^{}]+\{[^{}]*--q-alert-bg:\s*var\(--q-alert-error-bg\)[^{}]*\}/g
  ) || [];

  for (const selector of selectors) {
    assert.ok(
      errorRules.some(rule =>
        rule.split("{")[0].includes(selector)
      ),
      "Falta adaptar " + selector
    );
  }
});

test("DS-07.2: respeta estados ocultos y vacios", () => {
  assert.match(
    css,
    /\.q-alert\[hidden\]/
  );

  assert.match(
    css,
    /\.q-alert:empty/
  );

  assert.match(
    css,
    /\.q-alert\[hidden\][^{]*\{[^}]*display:\s*none/
  );
});

test("DS-07.2: iconografia decorativa sin texto duplicado", () => {
  const rule = getRule(".q-alert::before");

  assert.match(rule, /content:\s*""\s*;/);
  assert.match(rule, /pointer-events:\s*none\s*;/);
  assert.match(rule, /width:\s*20px\s*;/);
  assert.match(rule, /height:\s*20px\s*;/);
  assert.match(
    rule,
    /^\s*mask-image:\s*var\(--q-alert-icon,\s*var\(--q-alert-info-icon\)\)\s*;/m,
    "La propiedad estandar debe conservar el icono de respaldo"
  );

  assert.match(
    rule,
    /^\s*-webkit-mask-image:\s*var\(--q-alert-icon,\s*var\(--q-alert-info-icon\)\)\s*;/m,
    "WebKit debe conservar el mismo icono de respaldo"
  );
});
