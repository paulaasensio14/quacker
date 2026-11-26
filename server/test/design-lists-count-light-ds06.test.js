import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const css = fs.readFileSync(
  new URL(
    "../../assets/css/design-controls.css",
    import.meta.url
  ),
  "utf8"
);

function cssBlock(selector) {
  const escapeRegExp = (value) =>
    value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

  const matcher = new RegExp(
    escapeRegExp(selector) + "\\s*\\{([^}]*)\\}",
    "g"
  );

  const matches = [
    ...css.matchAll(matcher)
  ];

  assert.equal(
    matches.length,
    1,
    `Debe existir una regla unica para ${selector}`
  );

  return matches[0][1];
}

function declaration(block, property) {
  const escaped = property.replace(
    /[.*+?^${}()|[\]\\]/g,
    "\\$&"
  );

  const match = block.match(
    new RegExp(
      "(?:^|;)\\s*" + escaped +
      "\\s*:\\s*([^;]+)\\s*(?:;|$)"
    )
  );

  return match?.[1]?.trim() || "";
}

test(
  "DS-06.3: el contador activo en claro tiene colores inversos",
  () => {
    const block = cssBlock(
      "body:not(.dark-theme) #view-lists .pill-filter.active .count"
    );

    assert.equal(
      declaration(block, "background"),
      "var(--q-filter-selected-text)"
    );

    assert.equal(
      declaration(block, "color"),
      "var(--q-filter-selected-bg)"
    );
  }
);

test(
  "DS-06.3: el contador activo en oscuro conserva el contraste",
  () => {
    const block = cssBlock(
      "body.dark-theme #view-lists .pill-filter.active .count"
    );

    assert.equal(
      declaration(block, "background"),
      "var(--q-filter-selected-text)"
    );

    assert.equal(
      declaration(block, "color"),
      "var(--q-filter-selected-bg)"
    );
  }
);

test(
  "DS-06.3: la correccion respeta filtros inactivos",
  () => {
    const selected = cssBlock(
      ".pill-filter.active"
    );

    assert.equal(
      declaration(selected, "background"),
      "var(--q-filter-selected-bg)"
    );

    assert.equal(
      declaration(selected, "color"),
      "var(--q-filter-selected-text)"
    );

    const normalCount = cssBlock(
      ":is(.pill-filter, .pill-filter-sm) .count"
    );

    assert.match(
      normalCount,
      /font-size:\s*0\.75rem\s*;/
    );
  }
);
