import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const dashboard = fs.readFileSync(
  new URL("../../dashboard.html", import.meta.url),
  "utf8"
);

const activitySource = fs.readFileSync(
  new URL(
    "../../assets/js/app/home-lists-ui.js",
    import.meta.url
  ),
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
  "Activity dispone de un estado de error independiente del estado vacío",
  () => {
    assert.match(
      dashboard,
      /id="activityError"[^>]*hidden/
    );

    assert.match(
      dashboard,
      /data-i18n="home_activity_error_title"/
    );

    assert.match(
      dashboard,
      /data-i18n="home_activity_error_text"/
    );

    assert.match(
      dashboard,
      /id="activityErrorRetry"/
    );

    assert.match(
      dashboard,
      /data-i18n="home_activity_error_cta"/
    );
  }
);

test(
  "Activity define textos de error de carga en español e inglés",
  () => {
    assert.match(
      i18nSource,
      /home_activity_error_title:\s*"[^"]+"/
    );

    assert.match(
      i18nSource,
      /home_activity_error_text:\s*"[^"]+"/
    );

    assert.match(
      i18nSource,
      /home_activity_error_cta:\s*"[^"]+"/
    );

    const titleMatches =
      i18nSource.match(
        /home_activity_error_title:\s*"[^"]+"/g
      ) || [];

    assert.ok(
      titleMatches.length >= 2,
      "debe existir home_activity_error_title en ES y EN"
    );
  }
);

test(
  "Activity muestra error de carga sin presentarlo como actividad vacía",
  () => {
    const renderStart = activitySource.indexOf(
      "async function __renderActivityModal"
    );

    const renderEnd = activitySource.indexOf(
      "function __openActivityModal",
      renderStart
    );

    assert.notEqual(
      renderStart,
      -1,
      "debe existir __renderActivityModal"
    );

    assert.notEqual(
      renderEnd,
      -1,
      "debe poder aislarse __renderActivityModal"
    );

    const renderActivity = activitySource.slice(
      renderStart,
      renderEnd
    );

    assert.match(
      renderActivity,
      /getElementById\("activityError"\)/
    );

    assert.match(
      renderActivity,
      /catch\s*\(err\)\s*\{[\s\S]*?activityEmpty\.hidden\s*=\s*true[\s\S]*?activityError\.hidden\s*=\s*false/
    );

    assert.match(
      renderActivity,
      /typeof ApiClient[\s\S]*?activityEmpty\.hidden\s*=\s*true[\s\S]*?activityError\.hidden\s*=\s*false/
    );

    assert.match(
      activitySource,
      /getElementById\("activityErrorRetry"\)\?\.addEventListener\("click"[\s\S]*?__renderActivityModal\(\)\.catch\(console\.error\)/
    );
  }
);
