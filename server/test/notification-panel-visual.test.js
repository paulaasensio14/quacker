import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const css = fs.readFileSync(
  new URL("../../assets/css/dashboard.css", import.meta.url),
  "utf8"
);

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function ruleBodies(selector) {
  const escaped = escapeRegExp(selector);
  const pattern = new RegExp(
    `(?:^|\\n)\\s*${escaped}\\s*\\{([^}]*)\\}`,
    "g"
  );

  return [...css.matchAll(pattern)].map((match) => match[1]);
}

function firstRule(selector) {
  const bodies = ruleBodies(selector);

  assert.ok(
    bodies.length > 0,
    `No se encontró la regla CSS exacta ${selector}`
  );

  return bodies[0];
}

function hasDeclaration(block, property, value) {
  const pattern = new RegExp(
    `${escapeRegExp(property)}\\s*:\\s*${escapeRegExp(value)}\\s*;`
  );

  return pattern.test(block);
}

test("el panel de notificaciones tiene más espacio y ancho útil", () => {
  const panel = firstRule(".notif-panel");

  assert.equal(
    hasDeclaration(panel, "width", "380px"),
    true,
    ".notif-panel debe usar width: 380px"
  );

  assert.equal(
    hasDeclaration(panel, "max-height", "480px"),
    true,
    ".notif-panel debe usar max-height: 480px"
  );

  assert.equal(
    hasDeclaration(panel, "padding", "14px"),
    true,
    ".notif-panel debe usar padding: 14px"
  );
});

test("las tarjetas de notificación tienen una jerarquía más cómoda", () => {
  const card = firstRule(".notif-card");
  const bodyRules = ruleBodies(".notif-body");

  assert.equal(
    hasDeclaration(card, "padding", "12px"),
    true,
    ".notif-card debe usar padding: 12px"
  );

  assert.equal(
    hasDeclaration(card, "gap", "12px"),
    true,
    ".notif-card debe usar gap: 12px"
  );

  assert.equal(
    hasDeclaration(card, "align-items", "flex-start"),
    true,
    ".notif-card debe alinearse con flex-start"
  );

  assert.ok(
    bodyRules.some(
      (body) =>
        hasDeclaration(body, "min-width", "0") &&
        hasDeclaration(body, "flex", "1 1 auto")
    ),
    ".notif-body debe incluir min-width: 0 y flex: 1 1 auto"
  );
});

test("icono y acción de cada notificación tienen mayor área visual", () => {
  const icon = firstRule(".notif-icon");
  const markRules = ruleBodies(".notif-mark-btn");

  assert.equal(
    hasDeclaration(icon, "width", "34px"),
    true,
    ".notif-icon debe usar width: 34px"
  );

  assert.equal(
    hasDeclaration(icon, "height", "34px"),
    true,
    ".notif-icon debe usar height: 34px"
  );

  assert.ok(
    markRules.some(
      (rule) =>
        hasDeclaration(rule, "width", "28px") &&
        hasDeclaration(rule, "height", "28px")
    ),
    ".notif-mark-btn debe usar 28x28px"
  );
});

test("el panel móvil aprovecha el viewport sin quedar comprimido", () => {
  const match = css.match(
    /@media \(max-width:\s*640px\)\s*\{\s*\.notif-panel\s*\{([^}]*)\}/m
  );

  assert.ok(
    match,
    "No se encontró .notif-panel dentro del media query móvil"
  );

  const mobilePanel = match[1];

  assert.equal(
    hasDeclaration(mobilePanel, "right", "12px"),
    true,
    "el panel móvil debe usar right: 12px"
  );

  assert.equal(
    hasDeclaration(
      mobilePanel,
      "width",
      "min(360px, calc(100vw - 24px))"
    ),
    true,
    "el panel móvil debe aprovechar el ancho disponible"
  );
});
