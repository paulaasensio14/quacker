import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const profileJs = fs.readFileSync(
  new URL("../../assets/js/app/profile.js", import.meta.url),
  "utf8"
);

const appCoreJs = fs.readFileSync(
  new URL("../../assets/js/app/app-core.js", import.meta.url),
  "utf8"
);

test("Perfil tiene un render dedicado para todas las opiniones", () => {
  assert.match(profileJs, /function\s+renderOpinionsList\s*\(/);
  assert.match(profileJs, /profileOpinionsAllList/);
  assert.match(profileJs, /profile-opinions-list-item/);
});

test("la vista completa tiene un cargador propio basado en getOpinions", () => {
  assert.match(profileJs, /async\s+function\s+loadOpinionsView\s*\(/);
  assert.match(
    profileJs,
    /loadOpinionsView[\s\S]*ApiClient\.getOpinions\(\)/
  );
});

test("la lista completa ordena explícitamente por actualización más reciente", () => {
  assert.match(
    profileJs,
    /const\s+sortedOpinions\s*=\s*\[\.\.\.safeOpinions\]/
  );
  assert.match(profileJs, /return\s+bDate\s*-\s*aDate/);
});

test("la lista completa tiene un estado vacío propio", () => {
  assert.match(profileJs, /profile-opinions-list-empty/);
  assert.match(profileJs, /profile_opinions_latest_empty/);
});

test("cada elemento de la lista usa snapshot, valoración personal y reseña", () => {
  assert.match(profileJs, /opinion\?\.itemSnapshot\?\.title/);
  assert.match(profileJs, /opinion\?\.rating/);
  assert.match(profileJs, /opinion\?\.review\?\.text/);
  assert.match(profileJs, /profile-opinions-list-review/);
});

test("app-core refresca la vista opinions al activarla", () => {
  assert.match(appCoreJs, /viewId\s*===\s*"opinions"/);
  assert.match(appCoreJs, /ProfileModule\?\.loadOpinionsView\?\.\(\)/);
});
