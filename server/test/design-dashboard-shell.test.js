import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const cssUrl = new URL(
  "../../assets/css/design-dashboard.css",
  import.meta.url
);

const htmlUrl = new URL(
  "../../dashboard.html",
  import.meta.url
);

const source = fs.existsSync(cssUrl)
  ? fs.readFileSync(cssUrl, "utf8")
  : "";

function rule(selector) {
  const escaped = selector.replace(
    /[.*+?^${}()|[\]\\]/g,
    "\\$&"
  );

  const pattern = new RegExp(
    escaped + "\\s*\\{([^{}]*)\\}"
  );

  return source.match(pattern)?.[1] || "";
}

test(
  "DS-01 DASHBOARD: existe hoja estructural",
  () => {
    assert.ok(
      fs.existsSync(cssUrl),
      "Falta design-dashboard.css"
    );
  }
);

test(
  "DS-01 DASHBOARD: estilos cargados en orden",
  () => {
    const html = fs.readFileSync(
      htmlUrl,
      "utf8"
    );

    const tokens = html.indexOf(
      "assets/css/design-tokens.css"
    );

    const legacy = html.indexOf(
      "assets/css/dashboard.css"
    );

    const design = html.indexOf(
      "assets/css/design-dashboard.css"
    );

    assert.ok(tokens >= 0);
    assert.ok(legacy > tokens);
    assert.ok(design > legacy);
  }
);

test(
  "DS-01 DASHBOARD: fondo y texto oficiales",
  () => {
    const body = rule("body");

    assert.match(
      body,
      /background-color:\s*var\(--q-bg\)/
    );

    assert.match(
      body,
      /color:\s*var\(--q-text\)/
    );
  }
);

test(
  "DS-01 DASHBOARD: barra lateral y superior",
  () => {
    const sidebar = rule("aside.sidebar");
    const topbar = rule("header.topbar");

    assert.match(
      sidebar,
      /background-color:\s*var\(--q-surface\)/
    );

    assert.match(
      sidebar,
      /border-right:\s*1px solid var\(--q-border\)/
    );

    assert.match(
      topbar,
      /background-color:\s*var\(--q-surface\)/
    );

    assert.match(
      topbar,
      /border-bottom:\s*1px solid var\(--q-border\)/
    );
  }
);

test(
  "DS-01 DASHBOARD: modo oscuro y colores sin duplicar",
  () => {
    const dark = rule(
      "body.dark-theme .topbar"
    );

    assert.match(
      dark,
      /background-color:\s*var\(--q-surface\)/
    );

    assert.match(
      dark,
      /border-bottom-color:\s*var\(--q-border\)/
    );

    assert.ok(
      source.length > 0,
      "Falta la hoja de estilos"
    );

    assert.doesNotMatch(
      source,
      /#[\da-fA-F]{3,8}\b/,
      "No introducir nuevos colores hexadecimales"
    );
  }
);
