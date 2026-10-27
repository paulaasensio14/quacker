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
const profile = read(
  "../../assets/js/app/community-profile.js"
);
const api = read(
  "../../assets/js/data/api-client.js"
);
const css = read(
  "../../assets/css/dashboard.css"
);
const i18n = read(
  "../../assets/js/app/i18n.js"
);
const server = read("../server.js");

const hasFollowAction =
  html.includes('id="communityProfileFollowAction"');

test(
  "QA-012 social: existe botón para seguir usuarios",
  () => {
    assert.equal(
      hasFollowAction,
      true,
      "Falta communityProfileFollowAction"
    );
  }
);

test(
  "QA-012 social: controles accesibles y estado separado",
  { skip: !hasFollowAction },
  () => {
    assert.match(
      html,
      /id="communityProfileActions"/
    );

    assert.match(
      html,
      /id="communityProfileFollowAction"[^>]*type="button"/
    );

    assert.match(
      html,
      /id="communityProfileSocialStatus"[^>]*role="status"[^>]*aria-live="polite"/
    );
  }
);

test(
  "QA-012 social: la API cliente usa endpoints existentes",
  { skip: !hasFollowAction },
  () => {
    assert.match(
      api,
      /function updateCommunityFollowing\s*\(/
    );

    assert.match(
      api,
      /\/user\/following\/\$\{encodeURIComponent\(/
    );

    assert.match(
      api,
      /updateCommunityFollowing,/
    );

    assert.match(
      api,
      /_httpJson\s*\(/
    );

    assert.match(
      server,
      /socialRateLimits\.consumeFollow/
    );
  }
);

test(
  "QA-012 social: utiliza el estado real del visitante",
  { skip: !hasFollowAction },
  () => {
    assert.match(profile, /viewer\.state/);

    for (const state of [
      "none",
      "requested",
      "following",
      "friend",
      "self"
    ]) {
      assert.ok(
        profile.includes(`"${state}"`),
        `Falta estado social ${state}`
      );
    }

    assert.match(
      profile,
      /communityProfileFollowAction/
    );

    assert.match(
      profile,
      /communityProfileActions/
    );
  }
);

test(
  "QA-012 social: distingue seguimiento y solicitud pendiente",
  { skip: !hasFollowAction },
  () => {
    assert.match(
      profile,
      /ApiClient\.updateCommunityFollowing/
    );

    assert.match(
      profile,
      /requested/
    );

    assert.match(
      profile,
      /following/
    );

    assert.match(
      profile,
      /community_follow_requested/
    );

    assert.match(
      profile,
      /community_follow_unfollow/
    );
  }
);

test(
  "QA-012 social: protege cambios de usuario y doble clic",
  { skip: !hasFollowAction },
  () => {
    assert.match(
      profile,
      /requestVersion/
    );

    assert.match(
      profile,
      /activeUsername/
    );

    assert.match(
      profile,
      /disabled\s*=/
    );

    assert.match(
      profile,
      /addEventListener\(\s*"click"/
    );

    assert.match(
      profile,
      /community_follow_error/
    );
  }
);

test(
  "QA-012 social: no modifica las protecciones del servidor",
  { skip: !hasFollowAction },
  () => {
    assert.match(
      server,
      /"cannot_follow_self"/
    );

    assert.match(
      server,
      /"already_following"/
    );

    assert.match(
      server,
      /"follow_request_exists"/
    );

    assert.match(
      server,
      /"social_follow_rate_limited"/
    );

    assert.match(
      server,
      /areUsersBlocked/
    );
  }
);

test(
  "QA-012 social: textos ES/EN y diseño accesible",
  { skip: !hasFollowAction },
  () => {
    const keys = [
      "community_follow_follow",
      "community_follow_request",
      "community_follow_requested",
      "community_follow_unfollow",
      "community_follow_self",
      "community_follow_error",
      "community_follow_busy"
    ];

    for (const key of keys) {
      const matches = i18n.match(
        new RegExp(
          `\\b${key}:\\s*["']`,
          "g"
        )
      ) || [];

      assert.equal(
        matches.length,
        2,
        `Falta traducción ES/EN: ${key}`
      );
    }

    assert.match(
      css,
      /\.community-profile-follow-action/
    );

    assert.match(
      css,
      /\.community-profile-follow-action:focus-visible/
    );

    assert.match(
      css,
      /body\.dark-theme \.community-profile-follow-action/
    );

    assert.match(
      css,
      /@media\s*\(max-width:\s*640px\)[\s\S]*\.community-profile-follow-action/
    );
  }
);
