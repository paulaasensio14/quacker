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
const apiClient = read("../../assets/js/data/api-client.js");
const i18n = read("../../assets/js/app/i18n.js");
const css = read("../../assets/css/dashboard.css");

const modulePath = new URL(
  "../../assets/js/app/community.js",
  import.meta.url
);

const moduleExists = fs.existsSync(modulePath);

const community = moduleExists
  ? fs.readFileSync(modulePath, "utf8")
  : "";

test(
  "QA-011: existe el módulo visual de Comunidad",
  () => {
    assert.equal(
      moduleExists,
      true,
      "QA-011: falta implementar assets/js/app/community.js"
    );
  }
);

test(
  "QA-011: Comunidad está en el menú y router",
  { skip: !moduleExists },
  () => {
    const lists = html.indexOf('data-view="lists"');
    const communityNav =
      html.indexOf('data-view="community"');
    const profile = html.indexOf('data-view="profile"');

    assert.ok(lists >= 0);
    assert.ok(
      communityNav > lists &&
      communityNav < profile,
      "Comunidad debe figurar entre Listas y Mi perfil"
    );

    assert.match(
      html,
      /data-view="community"[^>]*type="button"|type="button"[^>]*data-view="community"/
    );

    assert.match(router, /community:\s*"nav_community"/);
    assert.match(
      router,
      /community:\s*"community_summary"/
    );
  }
);

test(
  "QA-011: búsqueda y resultados tienen estructura accesible",
  { skip: !moduleExists },
  () => {
    assert.match(
      html,
      /<section[^>]*id="view-community"[^>]*data-view-id="community"/
    );

    assert.match(
      html,
      /<label[^>]*for="communitySearchInput"/
    );

    assert.match(
      html,
      /<input[^>]*id="communitySearchInput"[^>]*type="search"/
    );

    assert.match(
      html,
      /id="communitySearchStatus"[^>]*role="status"[^>]*aria-live="polite"/
    );

    assert.match(
      html,
      /id="communityResults"[^>]*role="list"/
    );
  }
);

test(
  "QA-011: el módulo arranca y usa ApiClient",
  { skip: !moduleExists },
  () => {
    assert.match(
      html,
      /src="assets\/js\/app\/community\.js"/
    );

    assert.match(
      appCore,
      /window\.CommunityModule\?\.init\?\.\(\)/
    );

    assert.match(
      community,
      /window\.CommunityModule\s*=/
    );

    assert.match(
      community,
      /ApiClient\.getCommunityUsers/
    );

    assert.match(
      apiClient,
      /(?:async\s+)?function getCommunityUsers\s*\(/
    );

    assert.match(
      apiClient,
      /getCommunityUsers,/
    );

    assert.match(
      apiClient,
      /encodeURIComponent/
    );

    assert.match(
      apiClient,
      /\/community\/users\?q=/
    );
  }
);

test(
  "QA-011: todos los textos de Comunidad existen en ES y EN",
  { skip: !moduleExists },
  () => {
    const keys = [
      "nav_community",
      "community_summary",
      "community_search_label",
      "community_search_placeholder",
      "community_idle",
      "community_loading",
      "community_no_results",
      "community_error",
      "community_rate_limited",
      "community_view_profile"
    ];

    for (const key of keys) {
      const matches = i18n.match(
        new RegExp(
          `\\b${key}:\\s*["'\x60]`,
          "g"
        )
      ) || [];

      assert.equal(
        matches.length,
        2,
        `Falta traducción ES/EN para ${key}`
      );
    }
  }
);

test(
  "QA-011: renderiza identidades sin HTML inyectado",
  { skip: !moduleExists },
  () => {
    assert.match(
      community,
      /document\.createElement/
    );

    assert.match(
      community,
      /\.textContent\s*=/
    );

    assert.doesNotMatch(
      community,
      /\.innerHTML\s*=/
    );

    assert.doesNotMatch(
      community,
      /target\s*=\s*["']_blank["']/
    );

    assert.match(
      community,
      /encodeURIComponent/
    );
  }
);

test(
  "QA-011: estilos de Comunidad incluyen modo oscuro y móvil",
  { skip: !moduleExists },
  () => {
    assert.match(css, /\.community-layout/);
    assert.match(css, /\.community-results/);
    assert.match(css, /\.community-user-card/);

    assert.match(
      css,
      /body\.dark-theme \.community/
    );

    assert.match(
      css,
      /@media\s*\(max-width:\s*640px\)[\s\S]*\.community/
    );
  }
);
