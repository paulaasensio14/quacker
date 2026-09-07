import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const source = fs.readFileSync(
  new URL("../adapters/open-library.js", import.meta.url),
  "utf8"
);

function extractFunction(sourceText, name) {
  const start = sourceText.indexOf(`function ${name}(`);

  assert.notEqual(
    start,
    -1,
    `no se encontró function ${name}()`
  );

  let depth = 0;
  let bodyStarted = false;

  for (let i = start; i < sourceText.length; i += 1) {
    if (sourceText[i] === "{") {
      depth += 1;
      bodyStarted = true;
    } else if (sourceText[i] === "}") {
      depth -= 1;

      if (bodyStarted && depth === 0) {
        return sourceText.slice(start, i + 1);
      }
    }
  }

  throw new Error(`no se pudo aislar function ${name}()`);
}

test(
  "los destacados semanales de Open Library requieren portada",
  () => {
    const fnSource = extractFunction(
      source,
      "_isWeeklyFeaturedOpenLibraryItem"
    );

    const isEligible = Function(
      `"use strict"; return (${fnSource});`
    )();

    assert.equal(
      isEligible({
        externalId: "OL1M",
        title: "Libro sin portada",
        cover: "",
        releaseDate: "2026",
        summary: "Tiene metadatos",
        meta: { author: "Autor" }
      }),
      false
    );

    assert.equal(
      isEligible({
        externalId: "OL2M",
        title: "Libro con portada",
        cover: "https://covers.openlibrary.org/b/id/123-L.jpg",
        releaseDate: "",
        summary: "",
        meta: {}
      }),
      true
    );
  }
);

test(
  "getWeeklyFeaturedOpenLibrary aplica el filtro de portada",
  () => {
    const start = source.indexOf(
      "export async function getWeeklyFeaturedOpenLibrary"
    );

    const end = source.indexOf(
      "export async function getOpenLibraryBookDetail",
      start
    );

    assert.notEqual(start, -1);
    assert.notEqual(end, -1);

    const block = source.slice(start, end);

    assert.match(
      block,
      /_isWeeklyFeaturedOpenLibraryItem/,
      "el feed semanal debe aplicar el filtro de elegibilidad con portada"
    );
  }
);
