import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const explore = fs.readFileSync(
  new URL("../../assets/js/app/explore.js", import.meta.url),
  "utf8"
);

const css = fs.readFileSync(
  new URL("../../assets/css/design-cards.css", import.meta.url),
  "utf8"
);

const safeText = value =>
  (value ?? "").toString();

const escapeHtml = value =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const marker =
  "  function _renderExploreCardCaption(item, vm) {";

const nextMarker =
  "  function _getFeaturedVisible() {";

const start = explore.indexOf(marker);
const end = explore.indexOf(nextMarker, start);

assert.ok(start >= 0, "Falta helper de tarjetas");
assert.ok(end > start, "No se puede aislar el helper");

const realHelper = explore.slice(start, end);

// Se ejecuta el helper real del repositorio
// con dependencias puras y datos ficticios.
const render = new Function(
  "_safeText",
  "_escapeHtml",
  `${realHelper}
   return _renderExploreCardCaption;`
)(safeText, escapeHtml);

test("DS-06 runtime: titulo y tipo visibles", () => {
  const result = render(
    { releaseDate: "2025-03-21" },
    { title: "Marea Alta", typeLabel: "Serie" }
  );

  assert.match(
    result,
    /class="explore-card-caption"/
  );

  assert.match(
    result,
    /class="explore-card-caption-title">Marea Alta/
  );

  assert.match(
    result,
    /class="explore-card-caption-meta">Serie · 2025/
  );
});

test("DS-06 runtime: titulo peligroso escapado", () => {
  const result = render(
    { releaseDate: "2025-01-01" },
    {
      title: '<img src=x onerror="alert(1)">',
      typeLabel: "Libro"
    }
  );

  assert.ok(
    result.includes("&lt;img src=x")
  );

  assert.ok(
    result.includes("&quot;alert(1)&quot;")
  );

  assert.ok(
    !result.includes("<img src=x")
  );
});

test("DS-06 runtime: metadatos escapados", () => {
  const result = render(
    { releaseDate: "2025" },
    {
      title: "Contenido",
      typeLabel: '<script>alert("x")</script>'
    }
  );

  assert.ok(
    result.includes("&lt;script&gt;")
  );

  assert.ok(
    !result.includes("<script>")
  );
});

test("DS-06 runtime: fecha ausente o invalida", () => {
  const vm = {
    title: "Contenido",
    typeLabel: "Serie"
  };

  const absent = render({}, vm);
  const invalid = render(
    { releaseDate: "fecha desconocida" },
    vm
  );

  for (const value of [absent, invalid]) {
    assert.match(
      value,
      /explore-card-caption-meta">Serie/
    );

    assert.doesNotMatch(
      value,
      /undefined|null|NaN/
    );
  }
});

test("DS-06 runtime: titulo largo conservado", () => {
  const longTitle =
    "Una extraordinaria expedicion a las estrellas " +
    "del norte y el descubrimiento de otro universo";

  const result = render(
    { releaseDate: "2024" },
    {
      title: longTitle,
      typeLabel: "Pelicula"
    }
  );

  assert.ok(result.includes(longTitle));

  assert.match(
    css,
    /-webkit-line-clamp:\s*2/
  );
});

test("DS-06 runtime: dos tarjetas conservan apertura", () => {
  const captions = explore.match(
    /\$\{_renderExploreCardCaption\(item, vm\)\}/g
  ) || [];

  assert.equal(
    captions.length,
    2,
    "Explorar y contenido relacionado deben usar el helper"
  );

  const triggers = explore.match(
    /data-action="open-item-detail"/g
  ) || [];

  assert.ok(
    triggers.length >= 2,
    "Deben conservarse ambos disparadores"
  );

  assert.match(
    explore,
    /window\.DetailModule\?\.open\?\.\(item,/
  );
});
