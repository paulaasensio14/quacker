import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(
  new URL("../../", import.meta.url)
);

const tokenPath = path.join(
  root,
  "assets/css/design-tokens.css"
);

const light = {
  "--q-bg": "#F6F4EF",
  "--q-surface": "#FFFFFF",
  "--q-surface-2": "#F1EEE7",
  "--q-border": "#E2DDD2",
  "--q-text": "#17181C",
  "--q-text-2": "#565A63",
  "--q-text-3": "#868A93",
  "--q-brand": "#FFC928",
  "--q-success": "#17804A",
  "--q-danger": "#C8362A",
  "--q-warning": "#9A5B00",
  "--q-info": "#2449C7",
  "--q-series": "#6D4AE8",
  "--q-movie": "#D9472F",
  "--q-book": "#0B8574",
  "--q-game": "#2A62D8"
};

const dark = {
  "--q-bg": "#0F1115",
  "--q-surface": "#171A20",
  "--q-surface-2": "#1E222A",
  "--q-border": "#2A2F39",
  "--q-text": "#F3F0E8",
  "--q-text-2": "#AAB0BB",
  "--q-text-3": "#7C839F",
  "--q-brand": "#FFC928",
  "--q-success": "#43C982",
  "--q-danger": "#FF7A6B",
  "--q-warning": "#F2B84B",
  "--q-info": "#8FB0FF",
  "--q-series": "#A88BFF",
  "--q-movie": "#FF8A73",
  "--q-book": "#3DD1BC",
  "--q-game": "#7EA8FF"
};

function tokenCss() {
  if (!fs.existsSync(tokenPath)) return "";
  return fs.readFileSync(tokenPath, "utf8");
}

function readVariables(selector) {
  const css = tokenCss();

  const escapedSelector = selector.replace(
    /[.*+?^${}()|[\]\\]/g,
    "\\$&"
  );

  const rule = new RegExp(
    escapedSelector + "\\s*\\{([^{}]*)\\}"
  );

  const block = css.match(rule)?.[1] || "";
  const values = {};

  for (
    const match of block.matchAll(
      /(--q-[\w-]+)\s*:\s*(#[\da-fA-F]{6})\s*;/g
    )
  ) {
    values[match[1]] = match[2];
  }

  return values;
}

test(
  "DS-01: existe un archivo de tokens compartidos",
  () => {
    assert.ok(
      fs.existsSync(tokenPath),
      "Falta design-tokens.css"
    );
  }
);

test(
  "DS-01: modo claro conserva los 16 colores exactos",
  () => {
    assert.deepEqual(readVariables(":root"), light);
  }
);

test(
  "DS-01: modo oscuro conserva los 16 colores exactos",
  () => {
    assert.deepEqual(
      readVariables("body.dark-theme"),
      dark
    );
  }
);

test(
  "DS-01: las tres paginas cargan los tokens",
  () => {
    const pages = [
      ["index.html", "assets/css/landing.css"],
      ["dashboard.html", "assets/css/dashboard.css"],
      [
        "public-profile.html",
        "assets/css/public-profile.css"
      ]
    ];

    for (const [page, stylesheet] of pages) {
      const html = fs.readFileSync(
        path.join(root, page),
        "utf8"
      );

      const tokenPosition = html.indexOf(
        "assets/css/design-tokens.css"
      );

      const pagePosition = html.indexOf(
        stylesheet
      );

      assert.ok(
        tokenPosition >= 0,
        `${page}: no carga design-tokens.css`
      );

      assert.ok(
        pagePosition > tokenPosition,
        `${page}: orden de estilos incorrecto`
      );
    }
  }
);
