import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const source = fs.readFileSync(
  new URL(
    "../../assets/js/app/home-notifications.js",
    import.meta.url
  ),
  "utf8"
);

const renderStart = source.indexOf(
  "async function renderNotifications("
);

const renderEnd = source.indexOf(
  "// Modal confirmar",
  renderStart
);

assert.ok(renderStart >= 0);
assert.ok(renderEnd > renderStart);

const render = source.slice(
  renderStart,
  renderEnd
);

test("el render acepta un modo de actualizacion en segundo plano", () => {
  assert.match(
    render,
    /async function renderNotifications\(\{\s*background\s*=\s*false\s*\}\s*=\s*\{\s*\}\)/
  );
});

test("se descartan respuestas anteriores cuando se abre el panel", () => {
  const network = render.indexOf("await Promise.all(");
  const painting = render.indexOf(
    "if (errorStateEl) errorStateEl.hidden = true;"
  );

  assert.ok(network >= 0);
  assert.ok(painting > network);

  const afterNetwork = render.slice(
    network,
    painting
  );

  assert.match(
    afterNetwork,
    /__notifPanelInteractionVersion/
  );

  assert.match(
    afterNetwork,
    /background/
  );

  assert.match(
    afterNetwork,
    /classList\.contains\("is-open"\)/
  );
});

test("el sondeo automatico utiliza el modo protegido", () => {
  assert.match(
    source,
    /await renderNotifications\(\{\s*background:\s*true\s*\}\)/
  );

  assert.match(
    source,
    /__notifPanelInteractionVersion\s*\+=\s*1/
  );
});
