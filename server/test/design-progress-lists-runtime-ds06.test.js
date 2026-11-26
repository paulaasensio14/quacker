import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const read = relative => fs.readFileSync(
  new URL("../../" + relative, import.meta.url),
  "utf8"
);

const home = read("assets/js/app/home-lists-ui.js");
const lists = read("assets/js/app/lists.js");

function extract(source, startMarker, endMarker) {
  const start = source.indexOf(startMarker);

  assert.ok(
    start >= 0,
    "No se encuentra: " + startMarker
  );

  const end = source.indexOf(
    endMarker,
    start + startMarker.length
  );

  assert.ok(
    end > start,
    "No se encuentra fin: " + endMarker
  );

  return source.slice(start, end);
}

// Ejecutar las funciones reales de escape,
// sin iniciar la aplicación ni cargar datos.
const homeEscapeSource = extract(
  home,
  "function _escapeHomeAttribute(value) {",
  "async function renderHomeDashboard()"
);

const escapeHome = new Function(
  homeEscapeSource +
  "\nreturn _escapeHomeAttribute;"
)();

const listEscapeSource = extract(
  lists,
  "  function _safeAttr(v) {",
  "  function _normalizeId(value) {"
);

const escapeList = new Function(
  "_safeText",
  listEscapeSource + "\nreturn _safeAttr;"
)(
  value => (value ?? "").toString()
);

const homeCards = extract(
  home,
  "    continueGrid.innerHTML = visibleItems",
  "    // Micro-feedback: resaltar el item"
);

const listCards = extract(
  lists,
  "    container.innerHTML = visibleLists",
  "  function _activeListForCollaboration()"
);

test("DS-06.2 runtime: escape HTML Continuar", () => {
  assert.equal(
    escapeHome('A&B"<>'),
    "A&amp;B&quot;&lt;&gt;"
  );
});

test("DS-06.2 runtime: escape HTML Listas", () => {
  assert.equal(
    escapeList('A&B"<>'),
    "A&amp;B&quot;&lt;&gt;"
  );
});

test("DS-06.2 runtime: etiquetas maliciosas neutralizadas", () => {
  const payload = '<img src=x onerror="alert(1)">';

  for (const escape of [escapeHome, escapeList]) {
    const result = escape(payload);

    assert.ok(result.includes("&lt;img"));
    assert.ok(result.includes("&quot;"));
    assert.ok(result.includes("&gt;"));
    assert.ok(!result.includes("<img"));
  }
});

test("DS-06.2 runtime: caracteres habituales conservados", () => {
  const value = "Málaga · Niño's — 2026";

  assert.equal(escapeHome(value), value);
  assert.equal(escapeList(value), value);

  assert.equal(escapeHome(null), "");
  assert.equal(escapeList(null), "");
});

test("DS-06.2 runtime: cadenas para atributos", () => {
  const dangerous = '123" onclick="alert(1)';

  for (const escape of [escapeHome, escapeList]) {
    const result = escape(dangerous);

    assert.ok(!result.includes('"'));
    assert.ok(result.includes("&quot;"));
  }
});

test("DS-06.2 runtime: textos visibles de Continuar", () => {
  assert.match(
    homeCards,
    /\$\{_escapeHomeAttribute\(item\.title\)\}/
  );

  assert.match(
    homeCards,
    /\$\{_escapeHomeAttribute\(item\.platform\)\}/
  );

  assert.match(
    homeCards,
    /\$\{_escapeHomeAttribute\(item\.progressLabel\)\}/
  );

  assert.match(
    homeCards,
    /\$\{_escapeHomeAttribute\(formatMetaLine\(item\)\)\}/
  );

  assert.doesNotMatch(
    homeCards,
    /\$\{item\.(?:title|platform|progressLabel)\}/
  );
});

test("DS-06.2 runtime: identificadores de Continuar", () => {
  const matches = homeCards.match(
    /data-id="\$\{_escapeHomeAttribute\(itemId\)\}"/g
  ) || [];

  assert.equal(matches.length, 2);

  assert.match(
    homeCards,
    /aria-label="\$\{_escapeHomeAttribute\(typeIconLabel\)\}"/
  );

  assert.match(
    homeCards,
    /title="\$\{_escapeHomeAttribute\(typeIconLabel\)\}"/
  );
});

test("DS-06.2 runtime: progreso real conservado", () => {
  assert.match(
    homeCards,
    /const pct = Math\.max\(0, Math\.min\(100, item\.progressPercent \|\| 0\)\)/
  );

  assert.match(
    homeCards,
    /class="cw-progress-fill"/
  );

  assert.match(
    homeCards,
    /value="\$\{pct\}"/
  );

  assert.match(
    homeCards,
    /max="100"/
  );

  assert.match(
    homeCards,
    /class="cw-tick-btn"/
  );

  assert.match(
    home,
    /applyProgressTick\(id, btn\)/
  );
});

test("DS-06.2 runtime: datos de Listas seguros", () => {
  assert.match(
    listCards,
    /const name = _safeAttr\(list\.name\)/
  );

  assert.match(
    listCards,
    /const desc = _safeAttr\(list\.description\)/
  );

  assert.match(
    listCards,
    /const vis = _safeAttr\(_visibilityLabel\(list\.visibility\)\)/
  );

  const ids = listCards.match(
    /data-id="\$\{_safeAttr\(list\.id\)\}"/g
  ) || [];

  assert.equal(ids.length, 3);

  assert.match(
    listCards,
    /data-name="\$\{name\.replace\(\/"\/g,\s*"&quot;"\)\}"/
  );
});

test("DS-06.2 runtime: controles de Listas intactos", () => {
  assert.match(
    listCards,
    /_renderListCover\(list, count\)/
  );

  assert.match(
    listCards,
    /canManageList\s*\?\s*`/
  );

  assert.match(
    listCards,
    /data-action="edit-list"/
  );

  assert.match(
    listCards,
    /data-action="delete-list"/
  );

  assert.match(
    lists,
    /lists-grid--list/
  );

  assert.match(
    lists,
    /lists-grid--cards/
  );
});

// DS-06: regresion de seguridad del detalle de listas.
import * as ds06DetailVM from "node:vm";

{
  const source = lists;

  function extractFunction(name) {
    const expression = new RegExp(
      "^  function " + name +
      "\\([^\\n]*\\) \\{[\\s\\S]*?^  \\}",
      "m"
    );

    const match = source.match(expression);

    assert.ok(match, "Funcion no encontrada: " + name);

    return match[0];
  }

  const start = source.indexOf(
    "grid.innerHTML = filtered.map((it) => {"
  );

  assert.ok(start >= 0, "Renderizador no localizado");

  const ending = '}).join("");';

  const end = source.indexOf(ending, start);

  assert.ok(end > start, "Fin del renderizador no localizado");

  const renderer = source.slice(
    start,
    end + ending.length
  );

  const helpers = [
    extractFunction("_safeText"),
    extractFunction("_safeAttr")
  ].join("\n");

  function render(overrides = {}) {
    const grid = { innerHTML: "" };

    const item = {
      id: "demo-item-01",
      title: "Contenido de prueba",
      type: "movie",
      progress: 45,
      source: "demo",
      externalId: "demo-01",
      cover: "",
      ...overrides
    };

    const context = {
      grid,
      filtered: [item],
      t: key => key,
      _typeLabel: () => "Pelicula",
      _typeIconSvg: () => "<svg></svg>",
      _progressLabel: value => `${value}%`
    };

    ds06DetailVM.runInNewContext(
      helpers + "\n" + renderer,
      context,
      { timeout: 1000 }
    );

    return grid.innerHTML;
  }

  test("DS-06 seguridad: titulo del detalle escapado", () => {
    const title = 'A <b>texto</b> & "comillas"';

    const html = render({ title });

    assert.ok(
      html.includes(
        'A &lt;b&gt;texto&lt;/b&gt; &amp; &quot;comillas&quot;'
      ),
      "El titulo debe renderizarse como texto"
    );

    assert.ok(
      !html.includes("<b>texto</b>"),
      "No debe interpretar etiquetas procedentes del titulo"
    );
  });

  test("DS-06 seguridad: identificador del articulo escapado", () => {
    const id = 'id" & <dato>';

    const html = render({ id });

    assert.ok(
      html.includes(
        '<article class="list-item-card" data-item-id="id&quot; &amp; &lt;dato&gt;">'
      ),
      "El identificador debe conservar los limites del atributo"
    );
  });

  test("DS-06 seguridad: tarjeta normal intacta", () => {
    const html = render();

    assert.ok(
      html.includes('data-item-id="demo-item-01"')
    );

    assert.ok(
      html.includes(
        '<div class="list-item-title">Contenido de prueba</div>'
      )
    );

    assert.ok(html.includes('value="45"'));

    assert.ok(
      html.includes('data-action="remove-from-list"')
    );
  });
}
