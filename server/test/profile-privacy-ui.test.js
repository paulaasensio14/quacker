import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const dashboardSource = fs.readFileSync(
  new URL("../../dashboard.html", import.meta.url),
  "utf8"
);

const profileSource = fs.readFileSync(
  new URL("../../assets/js/app/profile.js", import.meta.url),
  "utf8"
);

const apiClientSource = fs.readFileSync(
  new URL("../../assets/js/data/api-client.js", import.meta.url),
  "utf8"
);

const PRIVACY_FIELDS = [
  "profile",
  "activity",
  "library",
  "lists",
  "reviews",
  "stats",
  "favorites"
];

test("el cliente API expone lectura y actualización de privacidad", () => {
  assert.match(
    apiClientSource,
    /async function getUserPrivacy\s*\(/
  );

  assert.match(
    apiClientSource,
    /_httpJson\("GET", "\/user\/privacy"\)/
  );

  assert.match(
    apiClientSource,
    /async function updateUserPrivacy\s*\(/
  );

  assert.match(
    apiClientSource,
    /_httpJson\("PATCH", "\/user\/privacy", patch\)/
  );

  assert.match(
    apiClientSource,
    /\bgetUserPrivacy\b[\s\S]*\bupdateUserPrivacy\b/
  );
});

test("Mi perfil incluye una tarjeta con los siete controles de privacidad", () => {
  assert.match(
    dashboardSource,
    /id="profilePrivacyCard"/
  );

  assert.match(
    dashboardSource,
    /id="profilePrivacyForm"/
  );

  assert.match(
    dashboardSource,
    /id="profilePrivacySaveBtn"/
  );

  for (const field of PRIVACY_FIELDS) {
    assert.match(
      dashboardSource,
      new RegExp(
        `data-privacy-field=["']${field}["']`
      ),
      `falta el control de privacidad ${field}`
    );
  }
});

test("el módulo de perfil carga y guarda la privacidad con su API dedicada", () => {
  assert.match(
    profileSource,
    /ApiClient\.getUserPrivacy\s*\(/
  );

  assert.match(
    profileSource,
    /ApiClient\.updateUserPrivacy\s*\(/
  );

  assert.match(
    profileSource,
    /profilePrivacyForm/
  );

  assert.match(
    profileSource,
    /profilePrivacySaveBtn/
  );

  for (const field of PRIVACY_FIELDS) {
    assert.match(
      profileSource,
      new RegExp(
        `["']${field}["']`
      ),
      `el módulo de perfil debe manejar ${field}`
    );
  }
});
