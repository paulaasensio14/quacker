import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const i18nSource = fs.readFileSync(
  new URL("../../assets/js/app/i18n.js", import.meta.url),
  "utf8"
);

const cssSource = fs.readFileSync(
  new URL("../../assets/css/dashboard.css", import.meta.url),
  "utf8"
);

const I18N_KEYS = [
  "profile_privacy_title",
  "profile_privacy_description",
  "profile_privacy_master_note",
  "profile_privacy_profile_label",
  "profile_privacy_profile_help",
  "profile_privacy_activity_label",
  "profile_privacy_activity_help",
  "profile_privacy_library_label",
  "profile_privacy_library_help",
  "profile_privacy_lists_label",
  "profile_privacy_lists_help",
  "profile_privacy_reviews_label",
  "profile_privacy_reviews_help",
  "profile_privacy_stats_label",
  "profile_privacy_stats_help",
  "profile_privacy_favorites_label",
  "profile_privacy_favorites_help",
  "profile_privacy_save",
  "profile_privacy_saving",
  "profile_privacy_saved",
  "profile_privacy_load_error",
  "profile_privacy_save_error"
];

test("la privacidad de perfil tiene traducciones ES y EN", () => {
  for (const key of I18N_KEYS) {
    const occurrences = [
      ...i18nSource.matchAll(
        new RegExp(`\\b${key}\\s*:`, "g")
      )
    ];

    assert.equal(
      occurrences.length,
      2,
      `${key} debe existir una vez en ES y una vez en EN`
    );
  }
});

test("la tarjeta de privacidad tiene estilos propios", () => {
  assert.match(cssSource, /\.profile-privacy-card\b/);
  assert.match(cssSource, /\.profile-privacy-list\b/);
  assert.match(cssSource, /\.profile-privacy-row\b/);
  assert.match(
    cssSource,
    /\.profile-privacy-row\s+input\[type=["']checkbox["']\]/
  );
});

test("la privacidad soporta modo oscuro y adaptación móvil", () => {
  assert.match(
    cssSource,
    /body\.dark-theme\s+\.profile-privacy-row/
  );

  assert.match(
    cssSource,
    /@media\s*\([^)]*max-width[^)]*\)[\s\S]*\.profile-privacy-row/
  );
});
