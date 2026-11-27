import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

function read(relative) {
  return fs.readFileSync(
    new URL("../../" + relative, import.meta.url),
    "utf8"
  );
}

const css = read("assets/css/design-feedback.css");

const marker = "/* DS-07.4: empty states */";

const empty = css.includes(marker)
  ? css.split(marker)[1]
  : "";

test("DS-07.4: conserva avisos alertas y carga", () => {
  assert.match(css, /--q-toast-bg:\s*#17181c/);
  assert.match(css, /\.q-alert--error/);
  assert.match(css, /--q-skeleton-base:\s*#e7e3da/);
  assert.match(css, /@keyframes qSkeletonShimmer/);
});

test("DS-07.4: superficies y tipografia compartidas", () => {
  assert.match(
    empty,
    /background:\s*var\(--q-surface\)\s*;/
  );

  assert.match(
    empty,
    /border:\s*1px solid var\(--q-border\)\s*;/
  );

  assert.match(empty, /color:\s*var\(--q-text\)\s*;/);
  assert.match(empty, /color:\s*var\(--q-text-2\)\s*;/);
  assert.match(empty, /box-shadow:\s*none\s*;/);
  assert.match(empty, /overflow-wrap:\s*anywhere\s*;/);
});

test("DS-07.4: integra estados vacios existentes", () => {
  for (const selector of [
    ".empty-state-card",
    ".lib-empty-state-card",
    ".home-empty-card",
    ".home-backlog-empty .empty-state-card",
    ".notif-empty-state",
    ".activity-empty",
    ".atl-empty-state",
    "#listDetailEmpty"
  ]) {
    assert.ok(empty.includes(selector), selector);
  }
});

test("DS-07.4: diferencia ausencia de contenido y errores", () => {
  for (const selector of [
    "#exploreError",
    ".lib-empty-state-card--error",
    "#homeDashboardError",
    "#notifErrorState",
    "#activityError",
    "#atlRetryLoadListsBtn"
  ]) {
    assert.ok(empty.includes(selector), selector);
  }

  assert.match(
    empty,
    /--q-empty-icon-bg:\s*var\(--q-alert-error-bg\)/
  );

  assert.match(
    empty,
    /--q-empty-icon-ink:\s*var\(--q-alert-error-ink\)/
  );
});

test("DS-07.4: iconos visibles y adaptados a ambos temas", () => {
  assert.match(
    empty,
    /--q-empty-accent-bg:\s*#fff3c8/
  );

  assert.match(
    empty,
    /body\.dark-theme\s*\{[^}]*--q-empty-accent-bg:\s*#352e19/s
  );

  assert.ok(empty.includes("#view-explore .empty-state-icon"));

  assert.match(empty, /width:\s*48px\s*;/);
  assert.match(empty, /height:\s*48px\s*;/);
});

test("DS-07.4: acciones adaptables y visibilidad protegida", () => {
  assert.match(empty, /@media \(max-width: 480px\)/);

  assert.match(
    empty,
    /min-width:\s*0\s*;/
  );

  assert.match(
    empty,
    /flex-wrap:\s*wrap\s*;/
  );

  assert.match(
    empty,
    /display:\s*none\s*!important\s*;/
  );

  const html = read("dashboard.html");
  const library = read("assets/js/app/library.js");

  for (const id of [
    "exploreEmptyReset",
    "exploreErrorRetry",
    "homeDashboardRetry",
    "listDetailErrorRetry"
  ]) {
    assert.ok(html.includes(`id="${id}"`), id);
  }

  for (const id of [
    "libEmptyImportBtn",
    "libEmptyResetBtn",
    "atlRetryLoadListsBtn",
    "atlCreateListBtn"
  ]) {
    assert.ok(library.includes(id), id);
  }
});
