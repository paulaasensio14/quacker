import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const homeSource = fs.readFileSync(
  new URL("../../assets/js/app/home-lists-ui.js", import.meta.url),
  "utf8"
);

const match = homeSource.match(
  /function _normalizeHomeCoverUrl\s*\([^)]*\)\s*\{[\s\S]*?\n\}/
);

assert.ok(match, "debe existir _normalizeHomeCoverUrl");

const normalizeHomeCoverUrl = new Function(
  `${match[0]}; return _normalizeHomeCoverUrl;`
)();

test("Home acepta el proxy same-origin de portada legacy", () => {
  assert.equal(
    normalizeHomeCoverUrl("/api/library/u_legacy_book/legacy-cover"),
    "/api/library/u_legacy_book/legacy-cover"
  );
});

test("Home mantiene las portadas HTTPS normales", () => {
  assert.equal(
    normalizeHomeCoverUrl("https://covers.openlibrary.org/b/id/123-L.jpg"),
    "https://covers.openlibrary.org/b/id/123-L.jpg"
  );
});

test("Home rechaza rutas relativas que no sean el proxy legacy exacto", () => {
  for (const value of [
    "/foo/bar.jpg",
    "/api/library/u_legacy_book/other",
    "/api/library/u_legacy_book/legacy-cover?x=1",
    "//evil.example/cover.jpg",
    "http://example.com/cover.jpg"
  ]) {
    assert.equal(normalizeHomeCoverUrl(value), "");
  }
});
