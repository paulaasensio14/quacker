import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const root = new URL("../../", import.meta.url);

const css = fs.readFileSync(
  new URL("assets/css/design-tokens.css", root),
  "utf8"
);

const publicHtml = fs.readFileSync(
  new URL("public-profile.html", root),
  "utf8"
);

function variables(source) {
  return Object.fromEntries(
    [...source.matchAll(
      /(--q-[\w-]+)\s*:\s*(#[\da-fA-F]{6})\s*;/g
    )].map(match => [
      match[1],
      match[2].toUpperCase()
    ])
  );
}

function explicitDarkVariables() {
  const block = css.match(
    /body\.dark-theme\s*\{([^{}]*)\}/
  )?.[1] || "";

  return variables(block);
}

function systemDarkVariables() {
  const block = css.match(
    /@media\s*\(prefers-color-scheme:\s*dark\)\s*\{\s*body\.quacker-theme-system\s*\{([^{}]*)\}\s*\}/
  )?.[1] || "";

  return variables(block);
}

test(
  "DS-01: perfil publico identifica tema del sistema",
  () => {
    assert.match(
      publicHtml,
      /<body\s+class="quacker-theme-system"\s*>/
    );
  }
);

test(
  "DS-01: tema oscuro del sistema usa los 16 colores oficiales",
  () => {
    const explicit = explicitDarkVariables();
    const system = systemDarkVariables();

    assert.equal(
      Object.keys(explicit).length,
      16
    );

    assert.deepEqual(system, explicit);
  }
);

test(
  "DS-01: tema del sistema no afecta landing ni dashboard",
  () => {
    assert.equal(
      (
        css.match(/body\.quacker-theme-system/g) ||
        []
      ).length,
      1
    );

    for (const page of [
      "index.html",
      "dashboard.html"
    ]) {
      const html = fs.readFileSync(
        new URL(page, root),
        "utf8"
      );

      assert.doesNotMatch(
        html,
        /quacker-theme-system/
      );
    }
  }
);
