import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const exploreSource = fs.readFileSync(
  new URL("../../assets/js/app/explore.js", import.meta.url),
  "utf8"
);

const detailSource = fs.readFileSync(
  new URL("../../assets/js/app/detail.js", import.meta.url),
  "utf8"
);

const i18nSource = fs.readFileSync(
  new URL("../../assets/js/app/i18n.js", import.meta.url),
  "utf8"
);

test("la ficha de videojuegos usa lanzamiento y desarrolladora", () => {
  assert.match(
    exploreSource,
    /const\s+developers\s*=\s*_safeText\(item\?\.meta\?\.developers\)\.trim\(\)/
  );

  assert.match(
    exploreSource,
    /explore_detail_label_release_date/
  );

  assert.match(
    exploreSource,
    /explore_detail_label_developer/
  );
});

test("i18n define las etiquetas específicas de videojuegos", () => {
  assert.match(
    i18nSource,
    /explore_detail_label_release_date:\s*"Fecha de lanzamiento"/
  );

  assert.match(
    i18nSource,
    /explore_detail_label_developer:\s*"Desarrolladora"/
  );

  assert.match(
    i18nSource,
    /explore_detail_label_release_date:\s*"Release date"/
  );

  assert.match(
    i18nSource,
    /explore_detail_label_developer:\s*"Developer"/
  );
});

test("los videojuegos no renderizan la tarjeta de reparto", () => {
  assert.match(
    detailSource,
    /\["book",\s*"game"\]\.includes\([\s\S]{0,150}item\?\.type/
  );

  assert.match(
    detailSource,
    /castCardEl\.hidden\s*=\s*hidesCastDetail/
  );
});
