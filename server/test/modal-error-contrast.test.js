import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const css = fs.readFileSync(
  new URL("../../assets/css/dashboard.css", import.meta.url),
  "utf8"
);

function getModalErrorStyles() {
  const match = css.match(
    /(?:^|\n)\s*\.modal-errors\s*\{([^{}]*)\}/m
  );

  assert.ok(match, "Debe existir la regla .modal-errors");

  const styles = {};

  for (const declaration of match[1].split(";")) {
    const separator = declaration.indexOf(":");

    if (separator === -1) continue;

    const property = declaration.slice(0, separator).trim();
    const value = declaration.slice(separator + 1).trim();

    if (property) styles[property] = value;
  }

  return styles;
}

function luminance(hex) {
  assert.match(hex, /^#[0-9a-fA-F]{3}(?:[0-9a-fA-F]{3})?$/);

  const value = hex.slice(1);

  const full = value.length === 3
    ? [...value].map((part) => part + part).join("")
    : value;

  const channels = [0, 2, 4].map((index) => {
    const channel = parseInt(full.slice(index, index + 2), 16) / 255;

    return channel <= 0.04045
      ? channel / 12.92
      : ((channel + 0.055) / 1.055) ** 2.4;
  });

  return channels[0] * 0.2126
    + channels[1] * 0.7152
    + channels[2] * 0.0722;
}

function contrastRatio(first, second) {
  const a = luminance(first);
  const b = luminance(second);

  return (Math.max(a, b) + 0.05) /
    (Math.min(a, b) + 0.05);
}

test("QA-009: los mensajes de error tienen contraste accesible", () => {
  const styles = getModalErrorStyles();

  assert.equal(
    styles.background,
    "#fff",
    "La prueba debe comprobar el fondo blanco existente"
  );

  assert.ok(
    styles.color,
    "QA-009: falta un color de texto explícito; " +
    "en tema oscuro se hereda texto claro sobre fondo blanco"
  );

  const ratio = contrastRatio(styles.color, styles.background);

  assert.ok(
    ratio >= 4.5,
    `QA-009: contraste insuficiente (${ratio.toFixed(2)}:1)`
  );
});
