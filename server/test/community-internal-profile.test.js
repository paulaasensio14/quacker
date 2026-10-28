import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

function read(relativePath) {
  return fs.readFileSync(
    new URL(relativePath, import.meta.url),
    "utf8"
  );
}

const html = read("../../dashboard.html");
const router = read("../../assets/js/app/router.js");
const appCore = read("../../assets/js/app/app-core.js");
const community = read(
  "../../assets/js/app/community.js"
);
const apiClient = read(
  "../../assets/js/data/api-client.js"
);
const i18n = read("../../assets/js/app/i18n.js");
const css = read("../../assets/css/dashboard.css");
const server = read("../server.js");

const modulePath = new URL(
  "../../assets/js/app/community-profile.js",
  import.meta.url
);

const exists = fs.existsSync(modulePath);

const profileModule = exists
  ? fs.readFileSync(modulePath, "utf8")
  : "";

test(
  "QA-012: existe el módulo de perfil integrado",
  () => {
    assert.equal(
      exists,
      true,
      "QA-012: falta assets/js/app/community-profile.js"
    );
  }
);

test(
  "QA-012: el dashboard incorpora una vista propia",
  { skip: !exists },
  () => {
    assert.match(
      html,
      /<section[^>]*id="view-community-profile"[^>]*data-view-id="community-profile"/
    );

    assert.match(
      html,
      /id="communityProfileBack"/
    );

    assert.match(
      html,
      /id="communityProfileStatus"[^>]*role="status"[^>]*aria-live="polite"/
    );

    assert.match(
      html,
      /id="communityProfileContent"/
    );

    assert.doesNotMatch(
      html,
      /<iframe[^>]*community/i,
      "No debemos insertar perfiles mediante iframes"
    );
  }
);

test(
  "QA-012: el router reconoce el perfil interno",
  { skip: !exists },
  () => {
    assert.match(
      router,
      /["']community-profile["']\s*:\s*["']community_profile_title["']/
    );

    assert.match(
      appCore,
      /window\.CommunityProfileModule\?\.init\?\.\(\)/
    );

    assert.match(
      html,
      /src="assets\/js\/app\/community-profile\.js"/
    );

    assert.match(
      profileModule,
      /window\.CommunityProfileModule\s*=/
    );

    assert.match(
      profileModule,
      /Router\.showView/
    );
  }
);

test(
  "QA-012: las tarjetas conservan el enlace compartible",
  { skip: !exists },
  () => {
    assert.match(
      community,
      /\/u\/\$\{encodeURIComponent\(username\)\}/
    );

    assert.match(
      community,
      /addEventListener\(\s*["']click["']/
    );

    assert.match(
      community,
      /preventDefault\(\)/
    );

    assert.match(
      community,
      /CommunityProfileModule/
    );

    assert.match(
      profileModule,
      /function open\s*\(/
    );
  }
);

test(
  "QA-012: el perfil utiliza la API pública existente",
  { skip: !exists },
  () => {
    assert.match(
      apiClient,
      /function getCommunityProfile\s*\(/
    );

    assert.match(
      apiClient,
      /\/public\/users\/\$\{encodeURIComponent\(username\)\}/
    );

    assert.match(
      profileModule,
      /ApiClient\.getCommunityProfile/
    );

    assert.match(
      server,
      /app\.get\(["']\/api\/public\/users\/:username["']/
    );

    assert.doesNotMatch(
      profileModule,
      /(?:localStorage|sessionStorage).*users/i,
      "No deben almacenarse perfiles completos en el navegador"
    );
  }
);

test(
  "QA-012: renderiza datos permitidos de forma segura",
  { skip: !exists },
  () => {
    // El perfil utiliza elementos predefinidos
    // en dashboard.html y los actualiza con textContent.
    assert.match(
      profileModule,
      /document\.querySelector/
    );

    for (const id of [
      "communityProfileName",
      "communityProfileUsername",
      "communityProfileAvatar",
      "communityProfileBio",
      "communityProfileStatus",
      "communityProfileContent"
    ]) {
      assert.match(
        html,
        new RegExp(`id="${id}"`),
        `Falta el elemento seguro ${id}`
      );
    }

    assert.match(
      profileModule,
      /\.textContent\s*=/
    );

    assert.doesNotMatch(
      profileModule,
      /\.innerHTML\s*=/
    );

    assert.match(
      profileModule,
      /AbortController/
    );

    assert.match(
      profileModule,
      /profile\.username/
    );
  }
);

test(
  "QA-012: traducciones ES y EN completas",
  { skip: !exists },
  () => {
    const keys = [
      "community_profile_title",
      "community_profile_back",
      "community_profile_loading",
      "community_profile_error",
      "community_profile_restricted",
      "community_profile_bio"
    ];

    for (const key of keys) {
      const matches = i18n.match(
        new RegExp(`\\b${key}:\\s*["']`, "g")
      ) || [];

      assert.equal(
        matches.length,
        2,
        `Falta traducción ES/EN: ${key}`
      );
    }
  }
);

test(
  "QA-012: estilos accesibles para móvil y modo oscuro",
  { skip: !exists },
  () => {
    assert.match(
      css,
      /\.community-profile-layout/
    );

    assert.match(
      css,
      /\.community-profile-back/
    );

    assert.match(
      css,
      /body\.dark-theme \.community-profile/
    );

    assert.match(
      css,
      /@media\s*\(max-width:\s*640px\)[\s\S]*\.community-profile/
    );

    assert.match(
      css,
      /\.community-profile-back:focus-visible/
    );
  }
);
