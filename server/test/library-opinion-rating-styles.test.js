import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const css = fs.readFileSync(
  new URL("../../assets/css/dashboard.css", import.meta.url),
  "utf8"
);

test(
  "la valoración personal de Biblioteca tiene layout compacto",
  () => {
    assert.match(css, /\.lib-personal-rating\s*\{/);
    assert.match(css, /display:\s*inline-flex/);
    assert.match(css, /align-items:\s*center/);
  }
);

test(
  "el pato personal de Biblioteca tiene tamaño compacto",
  () => {
    assert.match(css, /\.lib-personal-rating-duck\s*\{/);
    assert.match(css, /width:\s*18px/);
    assert.match(css, /height:\s*18px/);
  }
);

test(
  "el valor personal de Biblioteca queda destacado",
  () => {
    assert.match(css, /\.lib-personal-rating-value\s*\{/);
    assert.match(css, /font-weight:\s*700/);
  }
);

test(
  "la valoración personal respeta el color del tema",
  () => {
    const start = css.indexOf(".lib-personal-rating {");
    const end = css.indexOf("}", start);

    assert.ok(start >= 0 && end > start);

    const block = css.slice(start, end + 1);

    assert.match(block, /color:\s*var\(--text/);
  }
);
