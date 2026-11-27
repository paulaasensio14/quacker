import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const root = new URL("../../", import.meta.url);

const html = fs.readFileSync(
  new URL("dashboard.html", root), "utf8"
);

const cssPath = new URL(
  "assets/css/design-navigation.css", root
);

const css = fs.existsSync(cssPath)
  ? fs.readFileSync(cssPath, "utf8")
  : "";

function rule(selector) {
  const escaped = selector.replace(
    /[.*+?^${}()|[\]\\]/g, "\\$&"
  );

  return css.match(
    new RegExp(escaped + "\\s*\\{([^{}]*)\\}")
  )?.[1] || "";
}

test("DS-08.1: hoja de navegacion antes de feedback y despues de confirmations", () => {
  const previous = html.indexOf(
    "assets/css/design-confirmations.css"
  );

  const feedback = html.indexOf(
    "assets/css/design-feedback.css"
  );

  const navigation = html.indexOf(
    "assets/css/design-navigation.css"
  );

  assert.ok(previous >= 0);
  assert.ok(navigation > previous);
  assert.ok(feedback > navigation);
  assert.ok(css.length > 0);

  const links = [
    ...html.matchAll(
      /href="(assets\/css\/[^"]+\.css)"/g
    )
  ].map(match => match[1]);

  assert.equal(
    links.filter(
      link => link === "assets/css/design-navigation.css"
    ).length,
    1
  );

  assert.equal(
    links.at(-1),
    "assets/css/design-feedback.css"
  );
});

test("DS-08.1: navegacion de escritorio discreta y proporcionada", () => {
  assert.match(css, /@media \(min-width: 1025px\)/);

  const base = rule(
    "body #sidebar:not(.collapsed) .nav-item-btn"
  );

  assert.match(base, /min-height:\s*44px/);
  assert.match(base, /background:\s*transparent/);
  assert.match(base, /box-shadow:\s*none/);
  assert.match(base, /color:\s*var\(--q-text-2\)/);

  const active = rule(
    "body #sidebar:not(.collapsed) .nav-item-btn.is-active"
  );

  assert.match(active, /background:\s*color-mix\(/);
  assert.match(active, /color:\s*var\(--q-text\)/);
  assert.match(active, /border-inline-start-color:\s*var\(--q-brand\)/);
});

test("DS-08.1: foco visible y colores oficiales", () => {
  assert.match(css, /:focus-visible/);
  assert.match(css, /outline:\s*2px solid var\(--q-info\)/);
  assert.match(css, /prefers-reduced-motion:\s*reduce/);
  assert.doesNotMatch(css, /#[0-9a-fA-F]{3,8}\b/);
});

test("DS-08.1: conserva los destinos y controles actuales", () => {
  for (const view of [
    "home", "explore", "library", "lists",
    "community", "profile", "moderation"
  ]) {
    assert.match(
      html,
      new RegExp(`data-view="${view}"`)
    );
  }

  for (const id of [
    "sidebarToggle",
    "themeToggle",
    "moderationNavItem",
    "globalSearch",
    "profileChip",
    "notifButton"
  ]) {
    assert.ok(html.includes(`id="${id}"`), id);
  }

  assert.match(html, /id="moderationNavItem" hidden/);
  assert.match(html, /class="logout-btn"/);
});
