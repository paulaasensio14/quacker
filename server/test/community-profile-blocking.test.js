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
const i18n = read(
  "../../assets/js/app/i18n.js"
);
const css = read(
  "../../assets/css/dashboard.css"
);
const server = read("../server.js");

const hasBlockButton =
  html.includes('id="communityProfileBlockAction"');

test(
  "QA-012 bloqueo: existe el botón para bloquear usuarios",
  () => {
    assert.equal(
      hasBlockButton,
      true,
      "Falta communityProfileBlockAction"
    );
  }
);

test(
  "QA-012 bloqueo: estructura accesible y estado confirmado",
  { skip: !hasBlockButton },
  () => {
    assert.match(
      html,
      /id="communityProfileBlockAction"[^>]*type="button"/
    );

    assert.match(
      html,
      /id="communityProfileBlocked"/
    );

    assert.match(
      html,
      /id="communityProfileBlocked"[\s\S]*?role="status"/
    );

    assert.match(
      html,
      /id="communityProfileBlockedBack"/
    );
  }
);

test(
  "QA-012 bloqueo: reutiliza la API existente",
  { skip: !hasBlockButton },
  () => {
    assert.match(
      api,
      /function blockCommunityUser\s*\(/
    );

    assert.match(
      api,
      /\/user\/blocks\/\$\{encodeURIComponent\(/
    );

    assert.match(
      api,
      /blockCommunityUser,/
    );

    assert.match(
      profile,
      /ApiClient\.blockCommunityUser/
    );

    assert.match(
      server,
      /"\/api\/user\/blocks\/:username"/
    );
  }
);

test(
  "QA-012 bloqueo: exige confirmación explícita",
  { skip: !hasBlockButton },
  () => {
    assert.match(
      profile,
      /window\.confirm\s*\(/
    );

    assert.match(
      profile,
      /community_block_confirm/
    );

    assert.match(
      profile,
      /community_block_cancelled|if\s*\(!confirmed\)\s*return/
    );

    assert.match(
      profile,
      /communityProfileBlockAction/
    );
  }
);

test(
  "QA-012 bloqueo: protege el perfil propio",
  { skip: !hasBlockButton },
  () => {
    assert.match(
      profile,
      /"self"/
    );

    assert.match(
      profile,
      /communityProfileBlockAction/
    );

    assert.match(
      server,
      /"cannot_block_self"/
    );

    assert.match(
      server,
      /areUsersBlocked/
    );
  }
);

test(
  "QA-012 bloqueo: éxito oculta contenido y acciones",
  { skip: !hasBlockButton },
  () => {
    assert.match(
      profile,
      /communityProfileBlocked/
    );

    assert.match(
      profile,
      /communityProfileContent/
    );

    assert.match(
      profile,
      /communityProfileActions/
    );

    assert.match(
      profile,
      /blocked\s*===\s*true/
    );

    assert.match(
      profile,
      /community_block_success/
    );
  }
);

test(
  "QA-012 bloqueo: errores y operaciones antiguas",
  { skip: !hasBlockButton },
  () => {
    assert.match(
      profile,
      /blockBusy/
    );

    assert.match(
      profile,
      /activeUsername/
    );

    assert.match(
      profile,
      /blockOperationVersion/
    );

    assert.match(
      profile,
      /community_block_error/
    );

    assert.match(
      server,
      /"already_blocked"/
    );

    assert.match(
      server,
      /"social_block_rate_limited"/
    );

    assert.match(
      server,
      /"not_found"/
    );
  }
);

test(
  "QA-012 bloqueo: traducciones y accesibilidad móvil",
  { skip: !hasBlockButton },
  () => {
    const keys = [
      "community_block_button",
      "community_block_confirm",
      "community_block_success",
      "community_block_error",
      "community_block_busy",
      "community_block_back"
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

    assert.match(
      css,
      /\.community-profile-block-action/
    );

    assert.match(
      css,
      /\.community-profile-block-action:focus-visible/
    );

    assert.match(
      css,
      /body\.dark-theme \.community-profile-block-action/
    );

    assert.match(
      css,
      /@media\s*\(max-width:\s*640px\)[\s\S]*\.community-profile-block-action/
    );
  }
);
