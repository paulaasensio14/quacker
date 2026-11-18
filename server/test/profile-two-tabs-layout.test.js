import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

function read(relativePath) {
  return readFileSync(
    new URL(`../../${relativePath}`, import.meta.url),
    "utf8"
  );
}

const html = read("dashboard.html");
const profile = read("assets/js/app/profile.js");
const tabs = read("assets/js/app/profile-tabs.js");
const core = read("assets/js/app/app-core.js");
const css = read("assets/css/dashboard.css");
const i18n = read("assets/js/app/i18n.js");

test(
  "Mi perfil muestra solamente Perfil y Privacidad",
  () => {
    const actual = [
      ...html.matchAll(/data-profile-tab="([^"]+)"/g)
    ].map(match => match[1]);

    assert.deepEqual(actual, [
      "perfil",
      "privacidad"
    ]);

    assert.doesNotMatch(
      html,
      /data-profile-tab="ajustes"/
    );
  }
);

test(
  "el menu superior elimina Ajustes y conserva novedades",
  () => {
    assert.doesNotMatch(
      html,
      /data-profile-action="settings"/
    );

    assert.doesNotMatch(
      core,
      /case "settings"/
    );

    for (const action of [
      "profile",
      "whats-new",
      "theme",
      "logout"
    ]) {
      assert.match(
        html,
        new RegExp(
          `data-profile-action="${action}"`
        )
      );
    }
  }
);

test(
  "Ajustes y recomendaciones desaparecen de la interfaz",
  () => {
    for (const id of [
      "profileLanguageCard",
      "profileSettingsSaveBtn",
      "profileRecommendationsCard",
      "profileRecommendationsStatus",
      "profileRecommendationsList"
    ]) {
      assert.doesNotMatch(
        html,
        new RegExp(`id="${id}"`)
      );
    }

    assert.match(
      profile,
      /ApiClient\.getRecommendations\(\)/
    );

    assert.match(
      profile,
      /ApiClient\.resolveRecommendation\(/
    );
  }
);

test(
  "el formulario conserva internamente el idioma de la cuenta",
  () => {
    const form = html.match(
      /<form id="profileForm">([\s\S]*?)<\/form>/
    );

    assert.ok(form);

    assert.match(
      form[1],
      /<input\b[^>]*type="hidden"[^>]*id="profileLanguage"[^>]*name="language"/
    );

    assert.match(
      profile,
      /language:\s*\$\("#profileLanguage"\)\?\.value/
    );

    assert.match(
      profile,
      /\$\("#profileLanguage"\)\.value = user\.language/
    );

    assert.match(
      html,
      /id="profileSaveBtn"/
    );
  }
);

test(
  "la navegacion y los estilos utilizan dos pestañas",
  () => {
    assert.match(
      tabs,
      /buttons\.length !== 2/
    );

    assert.doesNotMatch(
      css,
      /data-active-profile-tab="ajustes"/
    );

    for (const key of [
      "ArrowRight",
      "ArrowLeft",
      "Home",
      "End"
    ]) {
      assert.ok(tabs.includes(key));
    }

    assert.match(
      tabs,
      /target\.focus\(\)/
    );

    assert.match(
      tabs,
      /quacker:profile-show-tab/
    );
  }
);

test(
  "las recomendaciones no generan peticiones sin interfaz",
  () => {
    const start = profile.indexOf(
      "async function loadRecommendations()"
    );

    const end = profile.indexOf(
      "\n  function bindRecommendations()",
      start
    );

    assert.ok(start >= 0);
    assert.ok(end > start);

    const block = profile.slice(start, end);

    assert.match(
      block,
      /if\s*\(!\$\("#profileRecommendationsList"\)\)\s*return;/
    );

    assert.match(
      profile,
      /function bindRecommendations\(\)/
    );
  }
);

test(
  "guardar el perfil no restablece el idioma visual elegido arriba",
  () => {
    assert.match(
      html,
      /data-lang="en"/
    );

    assert.match(
      html,
      /data-lang="es"/
    );

    assert.match(
      i18n,
      /localStorage\.setItem\(STORAGE_KEY, lang\)/
    );

    assert.doesNotMatch(
      profile,
      /window\.I18n\?\.setLang\?\.\(savedLanguage\)/
    );

    assert.match(
      profile,
      /ApiClient\.updateUser\(payload\)/
    );
  }
);
