import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const root = new URL("../../", import.meta.url);
const cssPath = new URL(
  "assets/css/design-typography.css", root
);

const css = fs.existsSync(cssPath)
  ? fs.readFileSync(cssPath, "utf8")
  : "";

function page(filename) {
  return fs.readFileSync(
    new URL(filename, root), "utf8"
  );
}

test("DS-02: hoja tipografica disponible", () => {
  assert.ok(fs.existsSync(cssPath));
});

test("DS-02: fuentes de Inter, Display y Mono", () => {
  assert.match(css, /--q-font-ui:\s*"Inter"/);
  assert.match(css, /--q-font-display:\s*"Inter"/);
  assert.match(css, /--q-font-code:\s*"JetBrains Mono"/);
  assert.match(css, /body\s*\{[^{}]*font-family:\s*var\(--q-font-ui\)/s);
});

test("DS-02: escala exacta de la guia", () => {
  const scale = {
    display: "58px",
    h1: "30px",
    h2: "22px",
    h3: "17px",
    body: "14px",
    secondary: "13px",
    label: "11.5px",
    number: "22px"
  };

  for (const [name, size] of Object.entries(scale)) {
    assert.ok(
      css.includes(`--q-type-${name}: ${size};`),
      `${name}: ${size}`
    );
  }
});

test("DS-02: titulares Inter Display optico", () => {
  assert.match(css, /font-variation-settings:\s*"opsz"\s+32/);
  assert.match(css, /\.hero-title\s*\{/);
  assert.match(css, /\.welcome-text h2\s*\{/);
  assert.match(css, /\.topbar-title\s*\{/);
});

test("DS-02: Fredoka solo para la marca", () => {
  assert.match(css, /\.brand-text,/);
  assert.match(css, /\.brand-name,/);
  assert.match(css, /\.public-profile-brand span\s*\{/);
  assert.match(css, /font-family:\s*"Fredoka"/);
  assert.match(css, /\.btn-delete-item\s*\{/);
});

test("DS-02: estadisticas tabulares y codigo", () => {
  assert.match(css, /font-variant-numeric:\s*tabular-nums/);
  assert.match(css, /\.metric-value,/);
  assert.match(css, /\.public-profile-stat-value/);
  assert.match(css, /font-family:\s*var\(--q-font-code\)/);
});

test("DS-02: tipografia adaptada al movil", () => {
  assert.match(css, /@media\s*\(max-width:\s*640px\)/);
  assert.match(css, /font-size:\s*clamp\(/);
  assert.match(css, /overflow-wrap:\s*anywhere/);
});

test("DS-02: tres paginas cargan las fuentes reales", () => {
  const pages = [
    ["dashboard.html", "design-components.css"],
    ["index.html", "landing.css"],
    ["public-profile.html", "public-profile.css"]
  ];

  for (const [filename, previousStyle] of pages) {
    const html = page(filename);

    assert.match(
      html,
      /fonts\.googleapis\.com\/css2\?family=Inter:opsz,wght@14\.\.32,400\.\.900/
    );

    assert.match(html, /JetBrains\+Mono/);
    assert.match(html, /Fredoka:wght/);

    const oldPosition = html.indexOf(previousStyle);
    const newPosition = html.indexOf(
      "design-typography.css"
    );

    assert.ok(oldPosition >= 0);
    assert.ok(newPosition > oldPosition);
  }
});

test("DS-02: sin nuevos colores ni efectos", () => {
  assert.ok(css.length > 0);
  assert.doesNotMatch(
    css,
    /(?:background|box-shadow|border-color|color)\s*:/
  );
  assert.doesNotMatch(
    css,
    /#[0-9a-fA-F]{3,8}\b/
  );
});
