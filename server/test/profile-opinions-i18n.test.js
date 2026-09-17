import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const i18n = fs.readFileSync(
  new URL("../../assets/js/app/i18n.js", import.meta.url),
  "utf8"
);

const requiredKeys = [
  "profile_opinions_title",
  "profile_opinions_description",
  "profile_opinions_count_label",
  "profile_opinions_average_label",
  "profile_reviews_count_label",
  "profile_opinions_latest_empty",
  "profile_opinions_unknown_title",
  "profile_opinions_view_all",
  "profile_opinions_back",
  "profile_opinions_all_summary"
];

test("Mis opiniones tiene todas las claves de traducción necesarias", () => {
  requiredKeys.forEach((key) => {
    const matches = i18n.match(new RegExp(`\\b${key}\\s*:`, "g")) || [];

    assert.equal(
      matches.length,
      2,
      `La clave ${key} debe existir una vez en ES y una vez en EN`
    );
  });
});

test("las traducciones españolas de Mis opiniones están definidas", () => {
  assert.match(i18n, /profile_opinions_title:\s*"Mis opiniones"/);
  assert.match(i18n, /profile_opinions_count_label:\s*"Opiniones"/);
  assert.match(i18n, /profile_opinions_average_label:\s*"Media"/);
  assert.match(i18n, /profile_reviews_count_label:\s*"Reseñas"/);
  assert.match(i18n, /profile_opinions_view_all:\s*"Ver todas mis opiniones"/);
  assert.match(i18n, /profile_opinions_back:\s*"Volver al perfil"/);
  assert.match(
    i18n,
    /profile_opinions_all_summary:\s*"Todas tus valoraciones y reseñas en Quacker\."/
  );
});

test("las traducciones inglesas de Mis opiniones están definidas", () => {
  assert.match(i18n, /profile_opinions_title:\s*"My opinions"/);
  assert.match(i18n, /profile_opinions_count_label:\s*"Opinions"/);
  assert.match(i18n, /profile_opinions_average_label:\s*"Average"/);
  assert.match(i18n, /profile_reviews_count_label:\s*"Reviews"/);
  assert.match(i18n, /profile_opinions_view_all:\s*"View all my opinions"/);
  assert.match(i18n, /profile_opinions_back:\s*"Back to profile"/);
  assert.match(
    i18n,
    /profile_opinions_all_summary:\s*"All your ratings and reviews on Quacker\."/
  );
});
