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
      /window\.UIConfirm\?\.ask\?\.\(/
    );

    assert.match(
      profile,
      /community_block_confirm/
    );

    assert.match(
      profile,
      /if\s*\(confirmed !== true\)\s*return/
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

test("DS-07.5.2 comunidad: confirmacion y contexto seguros", async () => {
  const vm = await import("node:vm");

  const start = profile.indexOf(
    "  async function performBlockAction()"
  );

  const end = profile.indexOf(
    "  function open(username,",
    start
  );

  assert.ok(start >= 0 && end > start);

  const handler = profile.slice(start, end);

  function fixture(answer) {
    const calls = [];
    const options = [];

    const button = {
      hidden: false,
      disabled: false
    };

    const follow = { disabled: false };
    const status = { textContent: "" };
    const content = { hidden: false };
    const blocked = { hidden: true };

    const view = {
      active: true,
      classList: {
        contains(name) {
          return name === "is-active" && view.active;
        }
      }
    };

    const elements = {
      "#view-community-profile": view,
      "#communityProfileBlockAction": button,
      "#communityProfileFollowAction": follow,
      "#communityProfileSocialStatus": status,
      "#communityProfileContent": content,
      "#communityProfileBlocked": blocked
    };

    const context = {
      activeUsername: "bob",
      requestVersion: 1,
      blockOperationVersion: 0,
      followOperationVersion: 0,
      blockBusy: false,
      blockConfirmBusy: false,
      followBusy: false,
      currentViewerState: "none",
      currentViewerAccess: "full",

      $(selector) {
        return elements[selector] || null;
      },

      t(key, fallback) {
        return fallback || key;
      },

      normalizeUsername(value) {
        return value;
      },

      cancelRequest() {
        context.requestVersion++;
      },

      clearProfile() {
        content.hidden = true;
      },

      renderFollowAction() {
        button.disabled = false;
      },

      window: {
        confirm() {
          throw new Error("native_confirm_must_not_be_used");
        },

        UIConfirm: {
          async ask(value) {
            options.push(value);
            return await answer();
          }
        }
      },

      ApiClient: {
        async blockCommunityUser(username) {
          calls.push(username);

          return {
            blocked: true,
            username
          };
        }
      }
    };

    vm.runInNewContext(
      handler + "\nglobalThis.run = performBlockAction;",
      context
    );

    return { context, calls, options, button, view, blocked };
  }

  const accepted = fixture(async () => true);

  await accepted.context.run();

  assert.deepEqual(accepted.calls, ["bob"]);
  assert.equal(accepted.options[0].tone, "danger");
  assert.match(accepted.options[0].message, /@bob/);
  assert.equal(accepted.blocked.hidden, false);

  const cancelled = fixture(async () => false);

  await cancelled.context.run();

  assert.equal(cancelled.calls.length, 0);

  const invalid = fixture(async () => "true");

  await invalid.context.run();

  assert.equal(invalid.calls.length, 0);

  const missing = fixture(async () => true);
  delete missing.context.window.UIConfirm;

  await missing.context.run();

  assert.equal(missing.calls.length, 0);

  const failed = fixture(async () => {
    throw new Error("dialog_failed");
  });

  await failed.context.run();
  await failed.context.run();

  assert.equal(failed.calls.length, 0);
  assert.equal(failed.options.length, 2);

  for (const change of [
    f => { f.context.activeUsername = "alice"; },
    f => { f.context.requestVersion++; },
    f => { f.context.blockOperationVersion++; },
    f => { f.context.followOperationVersion++; },
    f => { f.context.followBusy = true; },
    f => { f.context.currentViewerState = "self"; },
    f => { f.button.hidden = true; },
    f => { f.button.disabled = true; },
    f => { f.view.active = false; }
  ]) {
    let release;

    const pending = new Promise(resolve => {
      release = resolve;
    });

    const f = fixture(() => pending);
    const operation = f.context.run();

    await f.context.run();

    assert.equal(f.options.length, 1);

    change(f);
    release(true);

    await operation;

    assert.equal(f.calls.length, 0);
  }
});
