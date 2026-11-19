import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

function read(relative) {
  return fs.readFileSync(
    new URL("../../" + relative, import.meta.url),
    "utf8"
  );
}

function extract(source, begin, end) {
  const start = source.indexOf(begin);

  assert.notEqual(
    start,
    -1,
    `No se encuentra: ${begin}`
  );

  const finish = source.indexOf(
    end,
    start + begin.length
  );

  assert.notEqual(
    finish,
    -1,
    `No se encuentra final: ${end}`
  );

  return source.slice(start, finish);
}

const lists = read("assets/js/app/lists.js");
const explore = read("assets/js/app/explore.js");
const dashboard = read("dashboard.html");
const i18n = read("assets/js/app/i18n.js");

test(
  "NAV-06: Listas emite ID y nombre de origen",
  () => {
    const block = extract(
      lists,
      'document.getElementById("btnAddContentToList")',
      "// Clicks dentro del detalle"
    );

    assert.match(
      block,
      /new CustomEvent\(\s*["']quacker:lists-add-mode["']/
    );

    assert.match(
      block,
      /detail:\s*\{\s*listId,\s*listName\s*\}/
    );
  }
);

test(
  "NAV-06: Explorar recibe el contexto de la lista",
  () => {
    assert.match(
      explore,
      /document\.addEventListener\(\s*["']quacker:lists-add-mode["']/
    );
  }
);

test(
  "NAV-06: drawer preselecciona la lista de origen",
  () => {
    const block = extract(
      explore,
      "async function _handleExploreDrawerAddToListClick()",
      "async function _handleContentDetailAddToListClick()"
    );

    assert.doesNotMatch(
      block,
      /_openExploreListPicker\(\s*null\s*,\s*["']drawer["']/
    );

    assert.match(
      block,
      /_openExploreListPicker\(\s*[^,\n]+\s*,\s*["']drawer["']/
    );
  }
);

test(
  "NAV-06: detalle preselecciona la lista de origen",
  () => {
    const block = extract(
      explore,
      "async function _handleContentDetailAddToListClick()",
      "async function _populateExploreListPicker("
    );

    assert.doesNotMatch(
      block,
      /_openExploreListPicker\(\s*null\s*,\s*["']detail["']/
    );

    assert.match(
      block,
      /_openExploreListPicker\(\s*[^,\n]+\s*,\s*["']detail["']/
    );
  }
);

test(
  "NAV-06: existe indicador visible y traducciones",
  () => {
    assert.match(
      dashboard,
      /id=["']exploreListOriginNotice["']/
    );

    const translations = [
      ...i18n.matchAll(
        /\bexplore_list_origin_notice\s*:/g
      )
    ];

    assert.ok(
      translations.length >= 2,
      "Se requieren traducciones ES y EN"
    );
  }
);

test(
  "NAV-06: existe limpieza explicita del contexto",
  () => {
    assert.match(
      explore,
      /function _clearListOriginContext\s*\(/
    );

    assert.match(
      explore,
      /document\.addEventListener\(\s*["']quacker:view-change["']/
    );
  }
);

test("NAV-06: solo preselecciona listas disponibles", () => {
  const block = extract(
    explore,
    "async function _populateExploreListPicker(",
    "async function _openExploreListPicker("
  );

  assert.match(block, /safeLists\.some\(/);
  assert.match(block, /_normalizeId\(list\?\.id\)/);
  assert.match(block, /_clearListOriginContext\(\)/);
});

test("NAV-06: nombre de origen sin inyectar HTML", () => {
  const block = extract(
    explore,
    "function _renderListOriginContext()",
    "function _clearListOriginContext()"
  );

  assert.match(block, /nameEl\.textContent\s*=/);
  assert.doesNotMatch(block, /innerHTML\s*=/);
});

test("NAV-06: cancelar limpia seleccion anterior", () => {
  const block = extract(
    explore,
    "function _clearListOriginContext()",
    'document.addEventListener("quacker:lists-add-mode"'
  );

  assert.match(block, /__listOriginContext\s*=\s*null/);
  assert.match(block, /select\.value\s*=\s*""/);
  assert.match(block, /_syncExploreListConfirmState\(scope\)/);
});

test("NAV-06: salir de Explorar limpia el contexto", () => {
  assert.match(
    explore,
    /viewId !== "explore" && viewId !== "detail"/
  );

  assert.match(
    explore,
    /_clearListOriginContext\(\);\s*return;/
  );
});

test("NAV-06: indicador oculto no ocupa espacio", () => {
  const css = read("assets/css/dashboard.css");

  assert.match(
    css,
    /\.explore-mode-chip\[hidden\]\s*\{\s*display:\s*none/
  );

  assert.match(dashboard, /id="exploreListOriginCancel"/);
});
