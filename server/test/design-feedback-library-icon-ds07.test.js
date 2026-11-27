import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

function read(path) {
  return fs.readFileSync(
    new URL("../../" + path, import.meta.url),
    "utf8"
  );
}

const library = read("assets/js/app/library.js");
const css = read("assets/css/design-feedback.css");

const start = library.indexOf(
  'const safeTitle = escapeHtml(t("library_empty_initial_title"));'
);

const end = library.indexOf(
  'id="libEmptyImportBtn"',
  start
);

assert.ok(start >= 0 && end > start);

const initial = library.slice(start, end);

test("DS-07.7: icono inicial de biblioteca lineal y proporcionado", () => {
  const svg = initial.match(
    /<svg\b[^>]*class="lib-empty-state-icon-svg"[^>]*>[\s\S]*?<\/svg>/
  );

  assert.ok(svg);

  assert.match(svg[0], /viewBox="0 0 24 24"/);
  assert.match(svg[0], /width="24"/);
  assert.match(svg[0], /height="24"/);
  assert.match(svg[0], /fill="none"/);
  assert.match(svg[0], /stroke="currentColor"/);
  assert.match(svg[0], /stroke-width="1\.8"/);
  assert.match(svg[0], /focusable="false"/);

  assert.match(
    initial,
    /class="lib-empty-state-icon" aria-hidden="true"/
  );
});

test("DS-07.7: dimensiones del icono limitadas al estado inicial", () => {
  const marker = "/* DS-07.7: library empty icon */";

  const index = css.indexOf(marker);

  assert.ok(index >= 0);

  const block = css.slice(index);

  assert.match(
    block,
    /\.lib-empty-state-card:not\(\.lib-empty-state-card--error\)/
  );

  assert.match(block, /width:\s*48px/);
  assert.match(block, /height:\s*48px/);
  assert.match(block, /width:\s*24px/);
  assert.match(block, /height:\s*24px/);
  assert.match(block, /max-width:\s*24px/);
  assert.match(block, /max-height:\s*24px/);
  assert.match(block, /place-items:\s*center/);
});

test("DS-07.7: error de biblioteca conserva su icono independiente", () => {
  assert.match(
    library,
    /class="lib-empty-state-icon" aria-hidden="true">!<\/div>/
  );

  assert.match(
    library,
    /id="libEmptyImportBtn"/
  );

  assert.match(
    library,
    /id="libEmptyResetBtn"/
  );
});
