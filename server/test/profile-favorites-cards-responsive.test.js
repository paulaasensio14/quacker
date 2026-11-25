import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const css = fs.readFileSync(
  process.env.UX04_CSS_PATH ||
    new URL("../../assets/css/dashboard.css", import.meta.url),
  "utf8"
);

function getMediaRule(width, selector) {
  const marker =
    `@media (max-width: ${width}px) {`;

  let cursor = 0;
  let result = "";

  // Examinar TODOS los bloques del mismo breakpoint.
  while (cursor < css.length) {
    const start = css.indexOf(marker, cursor);

    if (start === -1) break;

    const opening = css.indexOf("{", start);
    let depth = 0;
    let closing = -1;

    for (let i = opening; i < css.length; i++) {
      if (css[i] === "{") depth++;
      if (css[i] === "}") depth--;

      if (depth === 0) {
        closing = i;
        break;
      }
    }

    assert.ok(
      closing > opening,
      `Media query ${width}px sin cierre`
    );

    const content = css.slice(
      opening + 1,
      closing
    );

    const selectorMarker = `${selector} {`;
    const selectorStart =
      content.indexOf(selectorMarker);

    if (selectorStart !== -1) {
      const ruleStart = content.indexOf(
        "{",
        selectorStart
      );

      const ruleEnd = content.indexOf(
        "}",
        ruleStart
      );

      assert.ok(
        ruleEnd > ruleStart,
        `Regla ${selector} sin cierre`
      );

      // Conservar la ultima regla aplicable
      // encontrada para este breakpoint.
      result = content.slice(
        ruleStart + 1,
        ruleEnd
      );
    }

    cursor = closing + 1;
  }

  return result;
}

test(
  "UX-04 RESPONSIVE: categorias a una columna hasta 1000px",
  () => {
    const rule = getMediaRule(
      1000,
      ".profile-favorites-groups"
    );

    assert.match(
      rule,
      /grid-template-columns\s*:\s*minmax\(0,\s*1fr\)/
    );
  }
);

test(
  "UX-04 RESPONSIVE: tarjetas a una columna hasta 480px",
  () => {
    const rule = getMediaRule(
      480,
      ".profile-favorites-slots"
    );

    assert.match(
      rule,
      /grid-template-columns\s*:\s*minmax\(0,\s*1fr\)/
    );
  }
);
