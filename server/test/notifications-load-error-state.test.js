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

const notificationsSource = fs.readFileSync(
  new URL("../../assets/js/app/home-notifications.js", import.meta.url),
  "utf8"
);

test(
  "Notificaciones dispone de un estado de error independiente del estado vacío",
  () => {
    assert.match(
      dashboardSource,
      /id="notifErrorState"[\s\S]*?role="alert"[\s\S]*?hidden/
    );

    assert.match(
      dashboardSource,
      /data-i18n="notif_load_error_title"/
    );

    assert.match(
      dashboardSource,
      /data-i18n="notif_load_error_text"/
    );

    assert.match(
      dashboardSource,
      /id="notifRetryLoadBtn"[\s\S]*?data-i18n="notif_load_error_cta"/
    );
  }
);

test(
  "Notificaciones define textos de error de carga en español e inglés",
  () => {
    for (const key of [
      "notif_load_error_title",
      "notif_load_error_text",
      "notif_load_error_cta",
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

test(
  "Notificaciones muestra el fallo de carga y permite reintentar",
  () => {
    assert.match(
      notificationsSource,
      /const errorStateEl = document\.getElementById\("notifErrorState"\)/
    );

    assert.match(
      notificationsSource,
      /catch\s*\([^)]*\)\s*\{[\s\S]*?errorStateEl\.hidden = false[\s\S]*?return/
    );

    assert.match(
      notificationsSource,
      /getElementById\("notifRetryLoadBtn"\)[\s\S]*?addEventListener\("click"[\s\S]*?renderNotifications\(\)/
    );
  }
);
