import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

function read(relative) {
  return fs.readFileSync(
    new URL("../../" + relative, import.meta.url),
    "utf8"
  );
}

const html = read("dashboard.html");
const js = read("assets/js/app/lists.js");
const css = read("assets/css/dashboard.css");

const marker = "/* QK-184-UI-REFINE */";

const refinedCss = css.includes(marker)
  ? css.slice(css.indexOf(marker))
  : "";

test(
  "REFINE-01: conservar las tres acciones originales",
  () => {
    for (const action of [
      "save-poll-vote",
      "show-poll-results",
      "close-poll"
    ]) {
      assert.match(
        js,
        new RegExp(
          'data-action="' + action + '"'
        )
      );
    }
  }
);

test(
  "REFINE-02: agrupar acciones en una misma fila",
  () => {
    assert.match(
      js,
      /class="list-poll-actions"/
    );
  }
);

test(
  "REFINE-03: tres columnas para votaciones",
  () => {
    assert.ok(
      refinedCss,
      "Faltan estilos nuevos del rediseño"
    );

    assert.match(
      refinedCss,
      /\.list-poll-actions\s*\{[^}]*grid-template-columns:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\)/s
    );
  }
);

test(
  "REFINE-04: colores distintos y vista movil",
  () => {
    assert.ok(refinedCss);

    for (const selector of [
      ".list-poll-vote-save",
      ".list-poll-results-button",
      ".list-poll-close"
    ]) {
      assert.ok(
        refinedCss.includes(selector),
        `Falta estilo ${selector}`
      );
    }

    assert.match(
      refinedCss,
      /@media\s*\(max-width:\s*\d+px\)/
    );
  }
);

test(
  "REFINE-05: cabecera compacta de enlace",
  () => {
    assert.match(
      html,
      /class="list-link-invite-overview"/
    );

    for (const id of [
      "listLinkInviteOwner",
      "btnCreateListLinkInvite",
      "listLinkInviteResult",
      "btnCopyListLinkInvite",
      "btnRevokeListLinkInvite"
    ]) {
      assert.ok(html.includes(`id="${id}"`));
    }
  }
);

test(
  "REFINE-06: estilos compactos de invitacion",
  () => {
    assert.ok(refinedCss);

    assert.match(
      refinedCss,
      /\.list-link-invite-overview\s*\{/
    );
  }
);

test(
  "REFINE-07: corona accesible para propietario",
  () => {
    assert.match(
      js,
      /list-member-crown/
    );

    assert.match(
      js,
      /aria-label/
    );
  }
);

test(
  "REFINE-08: nombre y usuario diferenciados",
  () => {
    assert.match(
      js,
      /list-member-display-name/
    );

    assert.match(
      js,
      /list-member-handle/
    );

    assert.doesNotMatch(
      js,
      /lists_collab_title"\)\}\s*\$\{index\s*\+\s*1\}/
    );
  }
);

test(
  "REFINE-09: tarjetas de participantes estilizadas",
  () => {
    assert.ok(refinedCss);

    for (const selector of [
      ".list-member-crown",
      ".list-member-display-name",
      ".list-member-handle"
    ]) {
      assert.ok(
        refinedCss.includes(selector),
        `Falta estilo ${selector}`
      );
    }
  }
);

test(
  "REFINE-10: permisos originales conservados",
  () => {
    assert.match(
      js,
      /ownerControls\.hidden\s*=\s*!isOwner/
    );

    assert.match(
      js,
      /canClosePoll\s*=\s*!closed\s*&&/
    );

    assert.match(
      js,
      /ApiClient\.getListMembers/
    );

    assert.match(
      html,
      /id="listLinkInviteFeedback"/
    );
  }
);
