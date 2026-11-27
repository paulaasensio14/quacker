import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const css = fs.readFileSync(
  new URL("../../assets/css/design-feedback.css", import.meta.url),
  "utf8"
);

const marker = "/* DS-07.3: loading */";

const loading = css.includes(marker)
  ? css.split(marker)[1]
  : "";

test("DS-07.3: conserva avisos y alertas aprobados", () => {
  assert.match(css, /--q-toast-bg:\s*#17181c/);
  assert.match(css, /\.toast--success\.toast--list/);
  assert.match(css, /\.q-alert--success/);
  assert.match(css, /\.q-alert--warning/);
  assert.match(css, /data-feedback-tone="success"/);
});

test("DS-07.3: paleta de skeletons adaptada a ambos temas", () => {
  assert.match(
    loading,
    /:root\s*\{[^}]*--q-skeleton-base:\s*#e7e3da\s*;/s
  );

  assert.match(
    loading,
    /body\.dark-theme\s*\{[^}]*--q-skeleton-base:\s*#292e38\s*;/s
  );

  assert.match(loading, /--q-skeleton-highlight:/);
  assert.match(loading, /--q-loading-ink:/);
});

test("DS-07.3: integra skeletons existentes", () => {
  for (const selector of [
    ".metric-value.is-skeleton",
    ".cw-card--skeleton .skel",
    ".backlog-card--skeleton .skel",
    ".lib-card.is-skeleton .lib-cover",
    ".lib-card.is-skeleton .lib-title",
    ".lib-card.is-skeleton .lib-meta",
    ".list-card--skeleton .list-skel-title",
    ".list-card--skeleton .list-skel-pill",
    ".list-card--skeleton .list-skel-icon",
    ".list-card--skeleton .list-skel-line",
    ".explore-skel-cover",
    ".explore-card-type--skeleton",
    ".explore-skel-section-title",
    ".explore-skel-section-subtitle",
    ".explore-skel-section-actions",
    ".activity-loading-row"
  ]) {
    assert.ok(
      loading.includes(selector),
      "Falta adaptar " + selector
    );
  }

  assert.match(
    loading,
    /background:\s*var\(--q-skeleton-base\)/
  );
});

test("DS-07.3: animacion compartida y movimiento reducido", () => {
  assert.match(loading, /@keyframes qSkeletonShimmer/);

  assert.match(
    loading,
    /animation:\s*qSkeletonShimmer 1600ms ease-in-out infinite/
  );

  const reduced = loading.split(
    "@media (prefers-reduced-motion: reduce)"
  )[1] || "";

  assert.match(reduced, /\.activity-loading-row::after/);
  assert.match(reduced, /\.explore-skel-cover::after/);
  assert.match(reduced, /\.metric-value\.is-skeleton::after/);
  assert.match(reduced, /animation:\s*none\s*;/);
  assert.match(reduced, /transform:\s*none\s*;/);
});

test("DS-07.3: indicadores adaptados sin alterar toasts", () => {
  assert.ok(
    loading.includes(
      ".btn-spinner:empty:not(:where(.toast-btn *))"
    )
  );

  assert.match(
    loading,
    /border:\s*2px solid currentColor\s*;/
  );

  assert.match(loading, /#contentDetailLoading::before/);
  assert.match(loading, /\.lib-refresh-veil-inner/);

  assert.match(
    loading,
    /border-right-color:\s*transparent\s*;/
  );
});

test("DS-07.3: respeta estados ocultos", () => {
  for (const selector of [
    ".activity-loading[hidden]",
    ".lib-refresh-veil[hidden]",
    "#contentDetailLoading[hidden]"
  ]) {
    assert.ok(loading.includes(selector), selector);
  }

  assert.match(
    loading,
    /#contentDetailLoading\[hidden\]\s*\{[^}]*display:\s*none\s*!important\s*;/s
  );
});
