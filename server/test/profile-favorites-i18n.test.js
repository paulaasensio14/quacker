import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const i18nSource = fs.readFileSync(
  new URL(
    "../../assets/js/app/i18n.js",
    import.meta.url
  ),
  "utf8"
);

const FAVORITES_I18N_KEYS = [
  "profile_favorites_title",
  "profile_favorites_description",
  "profile_favorites_movies",
  "profile_favorites_series",
  "profile_favorites_games",
  "profile_favorites_books",
  "profile_favorites_empty_slot",
  "profile_favorites_unknown_title",
  "profile_favorites_load_error",
  "profile_favorites_move_up",
  "profile_favorites_move_down",
  "profile_favorites_remove",
  "profile_favorites_replace",
  "profile_favorites_update_error",
  "profile_favorites_duplicate",
  "profile_favorites_picker_title",
  "profile_favorites_picker_description",
  "profile_favorites_picker_search_label",
  "profile_favorites_picker_search_placeholder",
  "profile_favorites_picker_hint",
  "profile_favorites_picker_loading",
  "profile_favorites_picker_empty",
  "profile_favorites_picker_search_error"
];

test("favoritos del perfil tiene traducciones ES y EN", () => {
  for (const key of FAVORITES_I18N_KEYS) {
    const matches = i18nSource.match(
      new RegExp(`\\b${key}\\s*:`, "g")
    ) || [];

    assert.equal(
      matches.length,
      2,
      `${key} debe existir una vez en ES y una vez en EN`
    );
  }
});
