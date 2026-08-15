import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const dashboardSource = fs.readFileSync(
  new URL("../../dashboard.html", import.meta.url),
  "utf8"
);

const i18nSource = fs.readFileSync(
  new URL("../../assets/js/app/i18n.js", import.meta.url),
  "utf8"
);

test(
  "List Detail search dispone de nombre accesible",
  () => {
    assert.match(
      dashboardSource,
      /id="listDetailSearch"[\s\S]*?data-i18n-aria-label="lists_detail_search_label"/
    );
  }
);

test(
  "el botón cerrar notificaciones dispone de nombre accesible",
  () => {
    assert.match(
      dashboardSource,
      /id="notifClose"[\s\S]*?data-i18n-aria-label="notif_close_label"/
    );
  }
);

test(
  "los campos del modal de listas están asociados a sus labels",
  () => {
    assert.match(
      dashboardSource,
      /<label[^>]*for="lm_name"[^>]*>[\s\S]*?id="lm_name"/
    );

    assert.match(
      dashboardSource,
      /<label[^>]*for="lm_desc"[^>]*>[\s\S]*?id="lm_desc"/
    );

    assert.match(
      dashboardSource,
      /<label[^>]*for="lm_visibility"[^>]*>[\s\S]*?id="lm_visibility"/
    );
  }
);

test(
  "los campos del modal añadir a biblioteca están asociados a sus labels",
  () => {
    assert.match(
      dashboardSource,
      /<label[^>]*for="addLib_title"[^>]*>[\s\S]*?id="addLib_title"/
    );

    assert.match(
      dashboardSource,
      /<label[^>]*for="addLib_type"[^>]*>[\s\S]*?id="addLib_type"/
    );
  }
);

test(
  "las nuevas etiquetas accesibles existen en español e inglés",
  () => {
    for (const key of [
      "lists_detail_search_label",
      "notif_close_label",
    ]) {
      const matches =
        i18nSource.match(
          new RegExp(`${key}:\\s*"[^"]+"`, "g")
        ) || [];

      assert.ok(
        matches.length >= 2,
        `debe existir ${key} en ES y EN`
      );
    }
  }
);
