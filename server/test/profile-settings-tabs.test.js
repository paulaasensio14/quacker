import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const read = (path) => fs.readFileSync(
  new URL(path, import.meta.url),
  "utf8"
);

const html = read("../../dashboard.html");
const css = read("../../assets/css/dashboard.css");
const tabs = read("../../assets/js/app/profile-tabs.js");
const profile = read("../../assets/js/app/profile.js");
const i18n = read("../../assets/js/app/i18n.js");

test("Mi perfil tiene exactamente tres pestañas", () => {
  const matches = [
    ...html.matchAll(/data-profile-tab="([^"]+)"/g)
  ].map(match => match[1]);

  assert.deepEqual(matches, [
    "perfil",
    "privacidad",
    "ajustes"
  ]);
});

test("las pestañas tienen traducciones ES/EN", () => {
  for (const key of [
    "profile_tabs_profile",
    "profile_privacy_title",
    "profile_tabs_settings",
    "profile_tabs_navigation"
  ]) {
    assert.match(html, new RegExp(`data-i18n(?:-aria-label)?="${key}"`));
    assert.equal(
      (i18n.match(new RegExp(`\\b${key}:`, "g")) || []).length,
      2
    );
  }
});

test("los paneles existentes se distribuyen entre las pestañas", () => {
  for (const id of [
    "profilePrivacyCard",
    "profileBlockedUsersCard",
    "profileFollowRequestsCard",
    "profileRecommendationsCard",
    "profileFavoritesCard",
    "profileOpinionsCard",
    "profileWhatsNewCard"
  ]) {
    assert.match(
      html,
      new RegExp(`id="${id}"[^>]*data-profile-panel="(perfil|privacidad|ajustes)"`)
    );
  }
});

test("el idioma y el botón de Ajustes pertenecen al formulario original", () => {
  assert.match(
    html,
    /id="profileLanguage"[^>]*form="profileForm"/
  );

  assert.match(
    html,
    /id="profileSettingsSaveBtn"[\s\S]*?form="profileForm"/
  );

  assert.match(html, /id="profileSaveBtn"/);
});

test("ambos botones comparten el estado de guardado", () => {
  assert.match(profile, /profileSavePending/);
  assert.match(profile, /profileSettingsSaveBtn/);
  assert.match(profile, /updateSaveButtonState\(\)/);
  assert.match(profile, /if \(profileSavePending\) return/);
});

test("los errores de validación activan la pestaña Perfil", () => {
  assert.match(profile, /quacker:profile-show-tab/);
  assert.match(tabs, /quacker:profile-show-tab/);
  assert.match(
    html,
    /id="profileFormErrors"[^>]*role="alert"[^>]*tabindex="-1"/
  );
});

test("la navegación admite teclado", () => {
  for (const key of [
    "ArrowRight",
    "ArrowLeft",
    "Home",
    "End"
  ]) {
    assert.ok(tabs.includes(key));
  }

  assert.match(tabs, /target\.focus\(\)/);
  assert.match(tabs, /aria-pressed/);
});

test("las tarjetas con hidden siguen ocultas", () => {
  assert.match(
    css,
    /#view-profile \.profile-layout > \[hidden\]/
  );

  assert.match(
    css,
    /\[data-profile-panel\]\[hidden\]/
  );
});

test("la vista pública del perfil no recibe las nuevas pestañas", () => {
  const publicView = html.match(
    /<section[^>]*id="view-community-profile"[\s\S]*?<\/section>/
  );

  if (publicView) {
    assert.doesNotMatch(publicView[0], /data-profile-tab=/);
  }

  assert.match(html, /id="view-profile"/);
});


test("el idioma guardado se sincroniza después de actualizar la cuenta", () => {
  const updatePosition = profile.indexOf(
    "const updated = await ApiClient.updateUser(payload);"
  );

  const languagePosition = profile.indexOf(
    "const savedLanguage = updated?.language;"
  );

  const syncPosition = profile.indexOf(
    "window.I18n?.setLang?.(savedLanguage);"
  );

  assert.ok(updatePosition >= 0);
  assert.ok(languagePosition > updatePosition);
  assert.ok(syncPosition > languagePosition);

  assert.match(
    profile,
    /window\.I18n\?\.getLang\?\.\(\) !== savedLanguage/
  );
});
