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
const i18n = read("../../assets/js/app/i18n.js");
const api = read("../../assets/js/data/api-client.js");
const core = read("../../assets/js/app/app-core.js");
const entry = read(
  "../../assets/js/app/list-link-invite-entry.js"
);

const promptPath = new URL(
  "../../assets/js/app/list-link-invite-prompt.js",
  import.meta.url
);

const promptExists =
  fs.existsSync(promptPath);

const prompt = promptExists
  ? fs.readFileSync(promptPath, "utf8")
  : "";

const modalId = 'id="listLinkInviteAcceptModal"';

const implemented =
  html.includes(modalId);

function findTagById(id) {
  const pattern = new RegExp(
    `<([a-z][a-z0-9-]*)\\b[^>]*\\bid="${id}"[^>]*>`,
    "i"
  );

  return html.match(pattern)?.[0] || "";
}

test(
  "QK-184-SEC-06 ACCEPT UI: existe ventana de invitacion",
  () => {
    assert.ok(
      implemented,
      "ACCEPT_UI_MODAL_AUSENTE"
    );
  }
);

test(
  "QK-184-SEC-06 ACCEPT UI: dialogo accesible",
  { skip: !implemented },
  () => {
    const modal = findTagById(
      "listLinkInviteAcceptModal"
    );

    assert.match(
      modal,
      /class="modal-overlay"/
    );

    assert.match(
      modal,
      /aria-hidden="true"/
    );

    const start = html.indexOf(modalId);
    const fragment = html.slice(
      start,
      start + 2000
    );

    assert.match(
      fragment,
      /role="dialog"/
    );

    assert.match(
      fragment,
      /aria-modal="true"/
    );

    assert.match(
      fragment,
      /aria-labelledby="listLinkInviteAcceptTitle"/
    );

    assert.match(
      fragment,
      /aria-describedby="listLinkInviteAcceptDescription"/
    );
  }
);

test(
  "QK-184-SEC-06 ACCEPT UI: controles de decision",
  { skip: !implemented },
  () => {
    const buttons = [
      "btnAcceptListLinkInvite",
      "btnDeclineListLinkInvite",
      "btnCloseListLinkInvite"
    ];

    for (const id of buttons) {
      const tag = findTagById(id);

      assert.ok(
        tag,
        `Falta boton: ${id}`
      );

      assert.match(
        tag,
        /type="button"/
      );
    }
  }
);

test(
  "QK-184-SEC-06 ACCEPT UI: texto de invitacion",
  { skip: !implemented },
  () => {
    const title = findTagById(
      "listLinkInviteAcceptTitle"
    );

    const description = findTagById(
      "listLinkInviteAcceptDescription"
    );

    assert.match(
      title,
      /data-i18n="lists_collab_link_accept_title"/
    );

    assert.match(
      description,
      /data-i18n="lists_collab_link_accept_description"/
    );

    assert.match(
      findTagById("btnAcceptListLinkInvite"),
      /data-i18n="lists_collab_link_accept_confirm"/
    );

    assert.match(
      findTagById("btnDeclineListLinkInvite"),
      /data-i18n="lists_collab_link_accept_decline"/
    );
  }
);

test(
  "QK-184-SEC-06 ACCEPT UI: estado accesible de errores",
  { skip: !implemented },
  () => {
    const feedback = findTagById(
      "listLinkInviteAcceptFeedback"
    );

    assert.match(
      feedback,
      /role="status"/
    );

    assert.match(
      feedback,
      /aria-live="polite"/
    );
  }
);

test(
  "QK-184-SEC-06 ACCEPT UI: token no visible en HTML",
  { skip: !implemented },
  () => {
    assert.doesNotMatch(
      html,
      /id="listLinkInviteAcceptToken"/
    );

    assert.doesNotMatch(
      html,
      /name="listInviteToken"/
    );

    assert.doesNotMatch(
      html,
      /data-list-invite-token=/
    );
  }
);

test(
  "QK-184-SEC-06 ACCEPT UI: cliente API permite aceptar",
  { skip: !implemented },
  () => {
    assert.match(
      api,
      /async function acceptListLinkInvite\(/
    );

    assert.match(
      api,
      /\n\s+acceptListLinkInvite,/
    );

    assert.match(
      entry,
      /getPendingToken/
    );

    assert.match(
      entry,
      /clearPendingToken/
    );
  }
);

test(
  "QK-184-SEC-06 ACCEPT UI: modulo cargado antes de core",
  { skip: !implemented },
  () => {
    const entryScript =
      '<script src="assets/js/app/list-link-invite-entry.js"></script>';

    const promptScript =
      '<script src="assets/js/app/list-link-invite-prompt.js"></script>';

    const coreScript =
      '<script src="assets/js/app/app-core.js"></script>';

    const entryPos =
      html.indexOf(entryScript);

    const promptPos =
      html.indexOf(promptScript);

    const corePos =
      html.indexOf(coreScript);

    assert.ok(
      entryPos >= 0 &&
      promptPos > entryPos &&
      corePos > promptPos
    );

    assert.equal(
      html.split(promptScript).length - 1,
      1
    );
  }
);

test(
  "QK-184-SEC-06 ACCEPT UI: inicializa tras autenticacion",
  { skip: !implemented },
  () => {
    assert.ok(
      promptExists,
      "Falta modulo de confirmacion"
    );

    assert.match(
      prompt,
      /window\.ListLinkInvitePrompt/
    );

    assert.match(
      prompt,
      /UIModal\.bind\(/
    );

    assert.match(
      prompt,
      /UIModal\.open\(/
    );

    assert.match(
      prompt,
      /ApiClient\.acceptListLinkInvite\(/
    );

    assert.match(
      core,
      /window\.ListLinkInvitePrompt\?\.init\?\.\(/
    );

    assert.ok(
      core.indexOf("getCurrentSession()") <
      core.indexOf("ListLinkInvitePrompt?.init?.()")
    );
  }
);

test(
  "QK-184-SEC-06 ACCEPT UI: traducciones ES y EN",
  { skip: !implemented },
  () => {
    const keys = [
      "lists_collab_link_accept_title",
      "lists_collab_link_accept_description",
      "lists_collab_link_accept_confirm",
      "lists_collab_link_accept_decline",
      "lists_collab_link_accept_loading",
      "lists_collab_link_accept_success",
      "lists_collab_link_accept_error",
      "lists_collab_link_accept_invalid",
      "lists_collab_link_accept_already"
    ];

    for (const key of keys) {
      const pattern = new RegExp(
        "^\\s*" + key + "\\s*:",
        "gm"
      );

      const matches =
        i18n.match(pattern) || [];

      assert.equal(
        matches.length,
        2,
        `Falta traduccion ES/EN: ${key}`
      );
    }
  }
);
