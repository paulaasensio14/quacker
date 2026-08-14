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

const homeSource = fs.readFileSync(
  new URL("../../assets/js/app/home-lists-ui.js", import.meta.url),
  "utf8"
);

test(
  "Home dispone de un estado de error del dashboard con Retry",
  () => {
    assert.match(
      dashboardSource,
      /id="homeDashboardError"[\s\S]*?role="alert"[\s\S]*?hidden/
    );

    assert.match(
      dashboardSource,
      /data-i18n="home_dashboard_error_title"/
    );

    assert.match(
      dashboardSource,
      /data-i18n="home_dashboard_error_text"/
    );

    assert.match(
      dashboardSource,
      /id="homeDashboardRetry"[\s\S]*?data-i18n="home_dashboard_error_cta"/
    );
  }
);

test(
  "Home define textos de error del dashboard en español e inglés",
  () => {
    for (const key of [
      "home_dashboard_error_title",
      "home_dashboard_error_text",
      "home_dashboard_error_cta",
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
  "Home abandona los placeholders de carga tras un fallo y permite reintentar",
  () => {
    assert.match(
      homeSource,
      /function setHomeDashboardError\s*\(/
    );

    assert.match(
      homeSource,
      /Error al renderizar el dashboard de inicio[\s\S]*?setHomeDashboardError\(true\)/
    );

    assert.match(
      homeSource,
      /setHomeDashboardError\(true\)[\s\S]*?#metricWeeklyTime[\s\S]*?#metricInProgress[\s\S]*?#metricCompletedYear[\s\S]*?#metricStreak/
    );

    assert.match(
      homeSource,
      /getElementById\("homeDashboardRetry"\)[\s\S]*?addEventListener\("click"[\s\S]*?refreshHomeIfActive\(/
    );
  }
);
