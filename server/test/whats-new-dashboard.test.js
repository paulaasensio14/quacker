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
