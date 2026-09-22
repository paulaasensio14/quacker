import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const dashboardSource = fs.readFileSync(
  new URL("../../dashboard.html", import.meta.url),
  "utf8"
);

test("existe un modal accesible para elegir favoritos", () => {
  assert.match(
    dashboardSource,
    /id="favoritePickerModal"/
  );

  assert.match(
    dashboardSource,
    /role="dialog"/
  );

  assert.match(
    dashboardSource,
    /aria-modal="true"/
  );

  assert.match(
    dashboardSource,
    /aria-labelledby="favoritePickerTitle"/
  );
});

test("el selector de favoritos incluye búsqueda y resultados", () => {
  assert.match(
    dashboardSource,
    /id="favoritePickerSearch"/
  );

  assert.match(
    dashboardSource,
    /id="favoritePickerResults"/
  );

  assert.match(
    dashboardSource,
    /id="favoritePickerStatus"/
  );

  assert.match(
    dashboardSource,
    /aria-live="polite"/
  );
});

test("el selector de favoritos dispone de controles de cierre", () => {
  assert.match(
    dashboardSource,
    /data-favorite-picker-close/
  );

  assert.match(
    dashboardSource,
    /data-i18n="common_cancel"/
  );
});
