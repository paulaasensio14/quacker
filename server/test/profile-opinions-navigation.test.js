import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const html = fs.readFileSync(
  new URL("../../dashboard.html", import.meta.url),
  "utf8"
);

const profileJs = fs.readFileSync(
  new URL("../../assets/js/app/profile.js", import.meta.url),
  "utf8"
);

const routerJs = fs.readFileSync(
  new URL("../../assets/js/app/router.js", import.meta.url),
  "utf8"
);

test("existe una vista interna dedicada a todas las opiniones", () => {
  assert.match(html, /data-view-id="opinions"/);
  assert.match(html, /id="view-opinions"/);
});

test("Ver todas mis opiniones abre la vista opinions", () => {
  assert.match(profileJs, /profileOpinionsViewAll/);
  assert.match(
    profileJs,
    /(?:window\.)?Router(?:\?\.|\.)showView\(["']opinions["']\)/
  );
});

test("Router conoce el título de la vista opinions", () => {
  assert.match(routerJs, /opinions:\s*"profile_opinions_title"/);
});

test("Router conoce el subtítulo de la vista opinions", () => {
  assert.match(routerJs, /opinions:\s*"profile_opinions_all_summary"/);
});

test("la vista opinions no se añade como opción de la sidebar", () => {
  assert.doesNotMatch(
    html,
    /class="nav-item-btn"[^>]*data-view="opinions"/
  );
});
