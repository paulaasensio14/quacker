import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

function read(path) {
  return fs.readFileSync(
    new URL(path, import.meta.url),
    "utf8"
  );
}

const html = read("../../dashboard.html");
const lists = read("../../assets/js/app/lists.js");
const i18n = read("../../assets/js/app/i18n.js");
const client = read("../../assets/js/data/api-client.js");

const ownerMarker = 'id="listCollaborationOwner"';
const linkMarker = 'id="listLinkInviteOwner"';

const implemented =
  html.includes(linkMarker);

test(
  "QK-184-SEC-06 UI: existe panel de enlaces",
  () => {
    assert.ok(
      html.includes(linkMarker),
      "UI_ENLACE_PANEL_AUSENTE"
    );
  }
);

test(
  "QK-184-SEC-06 UI: panel exclusivo del propietario",
  { skip: !implemented },
  () => {
    const start = html.indexOf(ownerMarker);
    const link = html.indexOf(linkMarker);
    const end = html.indexOf(
      'id="listMembersList"'
    );

    assert.ok(start !== -1);
    assert.ok(link > start);
    assert.ok(end > link);

    assert.match(
      lists,
      /ownerControls\.hidden\s*=\s*!isOwner/
    );

    assert.match(
      lists,
      /panel\.hidden\s*=\s*!canAccess/
    );
  }
);

test(
  "QK-184-SEC-06 UI: botones de generar copiar y revocar",
  { skip: !implemented },
  () => {
    const buttons = [
      "btnCreateListLinkInvite",
      "btnCopyListLinkInvite",
      "btnRevokeListLinkInvite"
    ];

    for (const id of buttons) {
      const pattern = new RegExp(
        `<button\\b[^>]*\\bid="${id}"[^>]*>`
      );

      assert.match(
        html,
        pattern,
        `Falta boton ${id}`
      );
    }
  }
);

test(
  "QK-184-SEC-06 UI: enlace oculto hasta generarlo",
  { skip: !implemented },
  () => {
    assert.match(
      html,
      /id="listLinkInviteResult"[^>]*\bhidden\b/
    );

    assert.match(
      html,
      /id="listLinkInviteUrl"[^>]*\breadonly\b/
    );

    assert.match(
      html,
      /id="listLinkInviteUrl"[^>]*\bautocomplete="off"/
    );
  }
);

test(
  "QK-184-SEC-06 UI: mensaje accesible de resultado",
  { skip: !implemented },
  () => {
    assert.match(
      html,
      /id="listLinkInviteFeedback"[^>]*\brole="status"/
    );

    assert.match(
      html,
      /id="listLinkInviteFeedback"[^>]*\baria-live="polite"/
    );
  }
);

test(
  "QK-184-SEC-06 UI: ListsModule usa tres operaciones API",
  { skip: !implemented },
  () => {
    const methods = [
      "createListLinkInvite",
      "revokeListLinkInvite",
      "acceptListLinkInvite"
    ];

    for (const method of methods) {
      assert.match(
        client,
        new RegExp(
          `\\n\\s+${method},`
        )
      );
    }

    assert.match(
      lists,
      /ApiClient\.createListLinkInvite\(/
    );

    assert.match(
      lists,
      /ApiClient\.revokeListLinkInvite\(/
    );

    assert.match(
      lists,
      /navigator\.clipboard/
    );
  }
);

test(
  "QK-184-SEC-06 UI: botones conectados a eventos",
  { skip: !implemented },
  () => {
    const ids = [
      "btnCreateListLinkInvite",
      "btnCopyListLinkInvite",
      "btnRevokeListLinkInvite"
    ];

    for (const id of ids) {
      assert.ok(
        lists.includes(`"${id}"`),
        `Falta integracion ${id}`
      );
    }

    for (const name of [
      "createActiveListLinkInvite",
      "copyActiveListLinkInvite",
      "revokeActiveListLinkInvite"
    ]) {
      assert.ok(
        lists.includes(`function ${name}(`),
        `Falta funcion ${name}`
      );
    }
  }
);

test(
  "QK-184-SEC-06 UI: limpia enlace al cambiar de lista",
  { skip: !implemented },
  () => {
    assert.ok(
      lists.includes(
        "function resetListLinkInviteUI("
      ),
      "Falta limpieza del enlace"
    );

    assert.ok(
      lists.includes(
        'listLinkInviteUrl'
      )
    );

    assert.ok(
      lists.includes(
        "activeListId"
      )
    );

    assert.ok(
      lists.includes(
        "listLinkInviteResult"
      )
    );
  }
);

test(
  "QK-184-SEC-06 UI: traducciones ES y EN",
  { skip: !implemented },
  () => {
    const keys = [
      "lists_collab_link_title",
      "lists_collab_link_description",
      "lists_collab_link_create",
      "lists_collab_link_copy",
      "lists_collab_link_revoke",
      "lists_collab_link_created",
      "lists_collab_link_copied",
      "lists_collab_link_revoked",
      "lists_collab_link_error",
      "lists_collab_link_copy_error",
      "lists_collab_link_expiry",
      "lists_collab_link_url_label"
    ];

    for (const key of keys) {
      const pattern = new RegExp(
        "^\\s*" + key + "\\s*:",
        "gm"
      );

      const found =
        i18n.match(pattern) || [];

      assert.equal(
        found.length,
        2,
        `Traduccion ES/EN ausente: ${key}`
      );
    }
  }
);
