import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const css = fs.readFileSync(
  new URL(
    "../../assets/css/dashboard.css",
    import.meta.url
  ),
  "utf8"
);

const html = fs.readFileSync(
  new URL(
    "../../dashboard.html",
    import.meta.url
  ),
  "utf8"
);

const marker =
  "/* QK-184-SEC-06: LIST LINK INVITATIONS */";

const section = css.includes(marker)
  ? css.split(marker)[1].split(
      "/* ===== Importación de biblioteca:"
    )[0]
  : "";

const present =
  section.includes(".list-link-invite {");

function rule(selector) {
  const needle = selector + " {";
  const start = section.indexOf(needle);

  if (start < 0) return "";

  const body = section.slice(
    start + needle.length
  );

  return body.split("}")[0];
}

test(
  "QK-184-SEC-06 CSS: estilos del panel presentes",
  () => {
    assert.match(
      html,
      /href="assets\/css\/dashboard\.css"/
    );

    assert.ok(
      present,
      "STYLE_LINK_INVITE_AUSENTE"
    );
  }
);

test(
  "QK-184-SEC-06 CSS: panel acorde al tema",
  { skip: !present },
  () => {
    const panel = rule(".list-link-invite");

    assert.match(panel, /display:\s*grid/);
    assert.match(panel, /gap:\s*\d+px/);
    assert.match(panel, /border-radius:/);

    assert.match(
      panel,
      /var\(--border-soft\)/
    );

    assert.match(
      panel,
      /var\(--bg-card\)/
    );
  }
);

test(
  "QK-184-SEC-06 CSS: resultados ocultos realmente",
  { skip: !present },
  () => {
    for (const selector of [
      ".list-link-invite[hidden]",
      "#listLinkInviteResult[hidden]"
    ]) {
      assert.match(
        rule(selector),
        /display:\s*none\s*!important/
      );
    }
  }
);

test(
  "QK-184-SEC-06 CSS: URL completa y legible",
  { skip: !present },
  () => {
    const input = rule("#listLinkInviteUrl");

    assert.match(input, /width:\s*100%/);
    assert.match(input, /min-width:\s*0/);
    assert.match(input, /box-sizing:\s*border-box/);
    assert.match(input, /text-overflow:\s*ellipsis/);
    assert.match(
      input,
      /var\(--text-main\)/
    );
  }
);

test(
  "QK-184-SEC-06 CSS: botones accesibles",
  { skip: !present },
  () => {
    assert.match(
      rule("#listLinkInviteOwner button"),
      /min-height:\s*44px/
    );

    assert.match(
      rule("#listLinkInviteOwner button:disabled"),
      /cursor:\s*not-allowed/
    );

    assert.match(
      rule("#listLinkInviteOwner button:focus-visible"),
      /outline:\s*3px\s+solid/
    );

    assert.match(
      rule("#listLinkInviteUrl:focus-visible"),
      /outline:\s*3px\s+solid/
    );
  }
);

test(
  "QK-184-SEC-06 CSS: adaptacion movil",
  { skip: !present },
  () => {
    assert.match(
      section,
      /@media\s*\(max-width:\s*720px\)/
    );

    const mobile = section.slice(
      section.indexOf(
        "@media (max-width: 720px)"
      )
    );

    assert.match(
      mobile,
      /#listLinkInviteResult\s*\{/
    );

    assert.match(
      mobile,
      /#listLinkInviteOwner button\s*\{/
    );

    assert.match(
      mobile,
      /#listLinkInviteAcceptModal \.modal-actions/
    );
  }
);

test(
  "QK-184-SEC-06 CSS: modal adaptable",
  { skip: !present },
  () => {
    const card = rule(
      "#listLinkInviteAcceptModal .modal-card"
    );

    assert.match(card, /max-width:/);
    assert.match(card, /max-height:/);
    assert.match(card, /overflow-y:\s*auto/);

    assert.match(
      rule(
        "#listLinkInviteAcceptModal .modal-actions button"
      ),
      /min-height:\s*44px/
    );
  }
);

test(
  "QK-184-SEC-06 CSS: foco en ambos temas",
  { skip: !present },
  () => {
    assert.match(
      rule(
        "#listLinkInviteAcceptModal button:focus-visible"
      ),
      /outline:\s*3px\s+solid/
    );

    assert.match(
      rule(
        "body:not(.dark-theme) #listLinkInviteAcceptModal button:focus-visible"
      ),
      /outline-color:\s*#1d4ed8/
    );

    assert.match(
      rule("#listLinkInviteFeedback:empty"),
      /display:\s*none/
    );
  }
);
