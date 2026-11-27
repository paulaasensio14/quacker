import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const css = fs.readFileSync(
  new URL("../../assets/css/design-feedback.css", import.meta.url),
  "utf8"
);

const marker = "/* DS-07.4: visual refinements */";

const refinement = css.includes(marker)
  ? css.split(marker)[1]
  : "";

test("DS-07.4: conserva estilos aprobados anteriores", () => {
  assert.match(css, /--q-toast-bg:\s*#17181c/);
  assert.match(css, /\.q-alert--error/);
  assert.match(css, /@keyframes qSkeletonShimmer/);
  assert.match(css, /\/\* DS-07.4: empty states \*\//);
});

test("DS-07.4: nuevos iconos de continuar y listas", () => {
  assert.ok(refinement.includes("--q-empty-play-icon:"));
  assert.ok(refinement.includes("--q-empty-list-icon:"));

  assert.ok(
    refinement.includes(
      ".home-continue-empty .empty-state-icon::after"
    )
  );

  assert.ok(
    refinement.includes(
      "#view-lists .lib-empty-state-card:not(.lib-empty-state-card--error)"
    )
  );

  assert.match(
    refinement,
    /mask-image:\s*var\(--q-empty-play-icon\)/
  );

  assert.match(
    refinement,
    /mask-image:\s*var\(--q-empty-list-icon\)/
  );
});

test("DS-07.4: errores centrados con icono semantico", () => {
  assert.ok(refinement.includes("#homeDashboardError"));
  assert.ok(refinement.includes("#notifErrorState"));

  assert.match(
    refinement,
    /text-align:\s*center\s*;/
  );

  assert.match(
    refinement,
    /justify-items:\s*center\s*;/
  );

  assert.match(
    refinement,
    /background-color:\s*var\(--q-alert-error-bg\)/
  );
});

test("DS-07.4: texto de explorar centrado", () => {
  assert.match(
    refinement,
    /#view-explore \.empty-state-text\s*\{[^}]*text-align:\s*center/s
  );

  assert.match(refinement, /text-wrap:\s*balance/);
});

test("DS-07.4: botones de reintento de al menos 44px", () => {
  for (const id of [
    "#homeDashboardRetry",
    "#notifRetryLoadBtn",
    "#activityErrorRetry"
  ]) {
    assert.ok(refinement.includes(id), id);
  }

  assert.match(
    refinement,
    /min-height:\s*44px\s*;/
  );

  assert.match(refinement, /box-shadow:\s*none\s*;/);
  assert.match(refinement, /:focus-visible/);
});

test("DS-07.4: biblioteca excluida de correcciones", () => {
  assert.doesNotMatch(refinement, /#view-library/);

  assert.doesNotMatch(
    refinement,
    /#libEmptyImportBtn|#libEmptyResetBtn|#libRetryLoadBtn/
  );
});
