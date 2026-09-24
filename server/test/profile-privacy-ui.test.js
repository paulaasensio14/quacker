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

const i18nSource = fs.readFileSync(
  new URL("../../assets/js/app/i18n.js", import.meta.url),
  "utf8"
);

const dashboardCssSource = fs.readFileSync(
  new URL("../../assets/css/dashboard.css", import.meta.url),
  "utf8"
);

const PRIVACY_FIELDS = [
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

test("el cliente API expone la bandeja y gestión de solicitudes de seguimiento", () => {
  assert.match(
    apiClientSource,
    /async function getFollowRequests\s*\(/
  );

  assert.match(
    apiClientSource,
    /_httpJson\("GET", "\/user\/follow-requests"\)/
  );

  assert.match(
    apiClientSource,
    /async function acceptFollowRequest\s*\(/
  );

  assert.match(
    apiClientSource,
    /\/user\/follow-requests\/\$\{encodeURIComponent\([^)]*\)\}\/accept/
  );

  assert.match(
    apiClientSource,
    /async function rejectFollowRequest\s*\(/
  );

  assert.match(
    apiClientSource,
    /_httpJson\("DELETE",[^\n]*follow-requests/
  );

  assert.match(
    apiClientSource,
    /\bgetFollowRequests\b[\s\S]*\bacceptFollowRequest\b[\s\S]*\brejectFollowRequest\b/
  );
});

test("Mi perfil incluye los seis controles de privacidad por sección", () => {
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

test("Mi perfil incluye una bandeja de solicitudes de seguimiento", () => {
  assert.match(
    dashboardSource,
    /id=["']profileFollowRequestsCard["']/
  );

  assert.match(
    dashboardSource,
    /id=["']profileFollowRequestsList["']/
  );

  assert.match(
    dashboardSource,
    /id=["']profileFollowRequestsStatus["']/
  );
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

test("el módulo de perfil carga y gestiona solicitudes de seguimiento", () => {
  assert.match(
    profileSource,
    /async function loadFollowRequests\s*\(/
  );

  assert.match(
    profileSource,
    /function bindFollowRequests\s*\(/
  );

  assert.match(
    profileSource,
    /ApiClient\.getFollowRequests\s*\(/
  );

  assert.match(
    profileSource,
    /ApiClient\.acceptFollowRequest\s*\(/
  );

  assert.match(
    profileSource,
    /ApiClient\.rejectFollowRequest\s*\(/
  );

  assert.match(
    profileSource,
    /profileFollowRequestsList/
  );

  assert.match(
    profileSource,
    /bindFollowRequests\s*\(\)/
  );

  assert.match(
    profileSource,
    /loadFollowRequests\s*\(\)/
  );
});

test("la bandeja de solicitudes está traducida en ES y EN", () => {
  const keys = [
    "profile_follow_requests_title",
    "profile_follow_requests_description",
    "profile_follow_requests_loading",
    "profile_follow_requests_empty",
    "profile_follow_requests_accept",
    "profile_follow_requests_reject",
    "profile_follow_requests_load_error",
    "profile_follow_requests_update_error"
  ];

  for (const key of keys) {
    const matches = i18nSource.match(
      new RegExp(`\\b${key}\\s*:`, "g")
    ) || [];

    assert.equal(
      matches.length,
      2,
      `${key} debe existir en ES y EN`
    );
  }

  assert.match(
    dashboardSource,
    /data-i18n=["']profile_follow_requests_title["']/
  );

  assert.match(
    dashboardSource,
    /data-i18n=["']profile_follow_requests_description["']/
  );

  assert.match(
    dashboardSource,
    /data-i18n=["']profile_follow_requests_loading["']/
  );
});

test("la bandeja de solicitudes tiene estilos propios y responsive", () => {
  const selectors = [
    ".profile-follow-requests-card",
    ".profile-follow-requests-list",
    ".profile-follow-request-row",
    ".profile-follow-request-identity",
    ".profile-follow-request-avatar",
    ".profile-follow-request-actions",
    ".profile-follow-request-action"
  ];

  for (const selector of selectors) {
    assert.match(
      dashboardCssSource,
      new RegExp(
        selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
      ),
      `falta el estilo ${selector}`
    );
  }

  assert.match(
    dashboardCssSource,
    /body\.dark-theme\s+\.profile-follow-request-row/
  );

  assert.match(
    dashboardCssSource,
    /@media\s*\(max-width:\s*640px\)[\s\S]*\.profile-follow-request-row/
  );
});

test(
  "el cliente API conserva profileVisibility y la compatibilidad legacy de profile",
  () => {
    const start = apiClientSource.indexOf(
      "function normalizeUserPrivacy(value)"
    );

    assert.notEqual(
      start,
      -1,
      "debe existir normalizeUserPrivacy"
    );

    const end = apiClientSource.indexOf(
      "\n  async function getUserPrivacy",
      start
    );

    assert.notEqual(
      end,
      -1,
      "debe poder aislarse normalizeUserPrivacy"
    );

    const block = apiClientSource.slice(start, end);

    assert.match(
      block,
      /profileVisibility/,
      "el normalizador debe conservar profileVisibility"
    );

    for (const visibility of [
      "public",
      "followers",
      "friends",
      "hidden"
    ]) {
      assert.match(
        block,
        new RegExp(`["']${visibility}["']`),
        `el normalizador debe reconocer ${visibility}`
      );
    }

    assert.match(
      block,
      /source\.profile\s*===\s*true/,
      "debe mantener compatibilidad con profile legacy"
    );
  }
);

test(
  "Mi perfil permite elegir los cuatro niveles de visibilidad del perfil",
  () => {
    assert.match(
      dashboardSource,
      /<select[^>]*data-privacy-field=["']profileVisibility["']/,
      "debe existir un selector para profileVisibility"
    );

    for (const visibility of [
      "public",
      "followers",
      "friends",
      "hidden"
    ]) {
      assert.match(
        dashboardSource,
        new RegExp(
          `<option[^>]*value=["']${visibility}["']`
        ),
        `falta la opción ${visibility}`
      );
    }
  }
);

test(
  "el módulo de perfil lee profileVisibility como valor del selector",
  () => {
    const start = profileSource.indexOf(
      "function getPrivacyFormData()"
    );

    assert.notEqual(
      start,
      -1,
      "debe existir getPrivacyFormData"
    );

    const end = profileSource.indexOf(
      "\n  function samePrivacy",
      start
    );

    assert.notEqual(
      end,
      -1,
      "debe poder aislarse getPrivacyFormData"
    );

    const block = profileSource.slice(start, end);

    assert.match(
      block,
      /profileVisibility/,
      "debe incluir profileVisibility en el payload"
    );

    assert.match(
      block,
      /\.value/,
      "profileVisibility debe leerse mediante value"
    );
  }
);


test(
  "la visibilidad del perfil está traducida en ES y EN con sus cuatro opciones",
  () => {
    const expectedKeys = [
      "profile_privacy_visibility_public",
      "profile_privacy_visibility_followers",
      "profile_privacy_visibility_friends",
      "profile_privacy_visibility_hidden"
    ];

    assert.match(
      i18nSource,
      /profile_privacy_profile_label:\s*"Visibilidad del perfil"/
    );

    assert.match(
      i18nSource,
      /profile_privacy_profile_help:\s*"Elige quién puede acceder a tu perfil\."/
    );

    assert.match(
      i18nSource,
      /profile_privacy_master_note:\s*"Las secciones activadas solo serán visibles para quienes tengan acceso a tu perfil\."/
    );

    assert.match(
      i18nSource,
      /profile_privacy_profile_label:\s*"Profile visibility"/
    );

    assert.match(
      i18nSource,
      /profile_privacy_profile_help:\s*"Choose who can access your profile\."/
    );

    assert.match(
      i18nSource,
      /profile_privacy_master_note:\s*"Enabled sections are only visible to people who have access to your profile\."/
    );

    for (const key of expectedKeys) {
      assert.match(
        i18nSource,
        new RegExp(`${key}:`),
        `falta la traducción ${key}`
      );

      assert.match(
        dashboardSource,
        new RegExp(
          `<option[^>]*data-i18n=["']${key}["']`
        ),
        `la opción debe usar ${key}`
      );
    }
  }
);
