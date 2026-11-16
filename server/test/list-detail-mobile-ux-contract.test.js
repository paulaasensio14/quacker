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

const marker = "/* QK-184-UI-MOBILE-903 */";

const newCss = css.includes(marker)
  ? css.slice(css.indexOf(marker))
  : "";

test(
  "MOBILE-01: Contenido apila encabezado y filtros",
  () => {
    assert.ok(newCss, "Faltan estilos moviles");

    assert.match(
      newCss,
      /@media\s*\(max-width:\s*640px\)/
    );

    assert.match(
      newCss,
      /\.list-detail-items \.list-items-header\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)/s
    );

    assert.match(
      newCss,
      /\.list-detail-items \.list-items-controls\s*\{[^}]*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/s
    );

    assert.match(
      newCss,
      /\.list-detail-items \.list-items-head-left\s*\{[^}]*min-width:\s*0/s
    );

    assert.match(
      newCss,
      /\.list-detail-items \.list-items-search input\s*\{[^}]*min-width:\s*0/s
    );
  }
);

test(
  "MOBILE-02: invitaciones legibles y separadas",
  () => {
    assert.ok(newCss, "Faltan estilos nuevos");

    assert.match(
      newCss,
      /#listLinkInviteOwner \.list-link-invite-help\s*\{[^}]*display:\s*grid/s
    );

    assert.match(
      newCss,
      /#listLinkInviteOwner \.list-link-invite-help\s*\{[^}]*font-size:\s*0\.88rem/s
    );

    assert.match(
      newCss,
      /#listLinkInviteOwner \.list-link-invite-help > span\s*\{[^}]*display:\s*block/s
    );
  }
);
