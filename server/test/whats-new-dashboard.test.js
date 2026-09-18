import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const dashboardSource = fs.readFileSync(
  new URL("../../dashboard.html", import.meta.url),
  "utf8"
);

const i18nSource = fs.readFileSync(
  new URL(
    "../../assets/js/app/i18n.js",
    import.meta.url
  ),
  "utf8"
);

test(
  "el menú de perfil permite abrir Qué hay de nuevo manualmente",
  () => {
    assert.match(
      dashboardSource,
      /class="profile-menu-item"[^>]*data-profile-action="whats-new"/
    );

    assert.match(
      dashboardSource,
      /data-i18n="profile_menu_whats_new"/
    );
  }
);

test(
  "Qué hay de nuevo dispone de un modal accesible",
  () => {
    assert.match(
      dashboardSource,
      /id="whatsNewModal"[^>]*aria-hidden="true"/
    );

    assert.match(
      dashboardSource,
      /id="whatsNewModal"[\s\S]*?<div class="modal-card[^"]*"[^>]*role="dialog"[^>]*aria-modal="true"[^>]*aria-labelledby="whatsNewTitle"/
    );

    assert.match(
      dashboardSource,
      /<h3[^>]*id="whatsNewTitle"[^>]*data-i18n="whats_new_title"/
    );

    assert.match(
      dashboardSource,
      /id="whatsNewVersion"/
    );

    assert.match(
      dashboardSource,
      /id="whatsNewReleaseTitle"/
    );

    assert.match(
      dashboardSource,
      /id="whatsNewItems"/
    );

    assert.match(
      dashboardSource,
      /id="closeWhatsNewModal"/
    );
  }
);

test(
  "las etiquetas de Qué hay de nuevo existen en español e inglés",
  () => {
    for (const key of [
      "profile_menu_whats_new",
      "whats_new_title",
      "whats_new_close"
    ]) {
      const matches =
        i18nSource.match(
          new RegExp(
            `${key}:\\s*"[^"]+"`,
            "g"
          )
        ) || [];

      assert.ok(
        matches.length >= 2,
        `debe existir ${key} en ES y EN`
      );
    }
  }
);

test(
  "dashboard carga el módulo de Qué hay de nuevo",
  () => {
    assert.match(
      dashboardSource,
      /<script src="assets\/js\/app\/whats-new\.js"><\/script>/
    );
  }
);

test(
  "Mi perfil ofrece un acceso a Qué hay de nuevo cuando existe una release",
  () => {
    const profileStart =
      dashboardSource.indexOf('id="view-profile"');

    assert.notEqual(
      profileStart,
      -1,
      "debe existir la vista de perfil"
    );

    const profileBlock =
      dashboardSource.slice(profileStart);

    assert.match(
      profileBlock,
      /id="profileWhatsNewCard"[^>]*hidden/
    );

    assert.match(
      profileBlock,
      /id="profileWhatsNewBtn"/
    );

    assert.match(
      profileBlock,
      /data-i18n="profile_whats_new_title"/
    );

    assert.match(
      profileBlock,
      /data-i18n="profile_whats_new_description"/
    );

    assert.match(
      profileBlock,
      /data-i18n="profile_whats_new_cta"/
    );
  }
);

test(
  "las etiquetas del acceso de perfil a Qué hay de nuevo existen en español e inglés",
  () => {
    for (const key of [
      "profile_whats_new_title",
      "profile_whats_new_description",
      "profile_whats_new_cta"
    ]) {
      const matches =
        i18nSource.match(
          new RegExp(
            `${key}:\\s*"[^"]+"`,
            "g"
          )
        ) || [];

      assert.ok(
        matches.length >= 2,
        `debe existir ${key} en ES y EN`
      );
    }
  }
);

test(
  "la tarjeta Qué hay de nuevo mantiene un espaciado vertical legible",
  () => {
    const cssSource = fs.readFileSync(
      new URL("../../assets/css/dashboard.css", import.meta.url),
      "utf8"
    );

    const cardMatch = cssSource.match(
      /\.profile-whats-new-card\s*\{([\s\S]*?)\}/
    );

    assert.ok(
      cardMatch,
      "debe existir un bloque CSS específico para profile-whats-new-card"
    );

    const cardBlock = cardMatch[1];

    assert.match(cardBlock, /display:\s*flex/);
    assert.match(cardBlock, /flex-direction:\s*column/);
    assert.match(cardBlock, /gap:\s*14px/);

    assert.match(
      cssSource,
      /\.profile-whats-new-card\s*>\s*\.btn-secondary\s*\{[\s\S]*?align-self:\s*flex-start/
    );
  }
);
