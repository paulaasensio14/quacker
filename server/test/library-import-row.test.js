import assert from "node:assert/strict";
import test from "node:test";

import {
  normalizeLibraryImportRow,
  validateLibraryImportRow
} from "../lib/library-import-row.js";

test(
  "normaliza una fila Quacker CSV v1 para el Matcher",
  () => {
    assert.deepEqual(
      normalizeLibraryImportRow({
        title: "  Dune  ",
        type: " movie ",
        year: "2021",
        status: " completed ",
        progress: "100",
        author: "  ",
        source: " TMDB ",
        externalId: " 438631 "
      }),
      {
        title: "Dune",
        type: "pelicula",
        year: 2021,
        status: "completed",
        progress: 100,
        author: "",
        source: "tmdb",
        externalId: "438631"
      }
    );
  }
);

test(
  "normaliza aliases de tipo compatibles con Quacker",
  () => {
    const cases = new Map([
      ["pelicula", "pelicula"],
      ["movie", "pelicula"],
      ["film", "pelicula"],
      ["serie", "serie"],
      ["series", "serie"],
      ["tv", "serie"],
      ["book", "book"],
      ["game", "game"]
    ]);

    for (const [input, expected] of cases) {
      assert.equal(
        normalizeLibraryImportRow({
          title: "Contenido",
          type: input
        }).type,
        expected,
        input
      );
    }
  }
);

test(
  "los campos opcionales vacíos se normalizan sin inventar valores",
  () => {
    assert.deepEqual(
      normalizeLibraryImportRow({
        title: "Project Hail Mary",
        type: "book",
        year: "",
        status: "",
        progress: "",
        author: "Andy Weir",
        source: "",
        externalId: ""
      }),
      {
        title: "Project Hail Mary",
        type: "book",
        year: null,
        status: "",
        progress: null,
        author: "Andy Weir",
        source: "",
        externalId: ""
      }
    );
  }
);

test(
  "valida una fila normalizada compatible con Biblioteca",
  async () => {
    const {
      validateLibraryImportRow
    } = await import("../lib/library-import-row.js");

    assert.deepEqual(
      validateLibraryImportRow({
        title: "Dune",
        type: "pelicula",
        year: 2021,
        status: "completed",
        progress: 100,
        author: "",
        source: "",
        externalId: ""
      }),
      []
    );
  }
);

test(
  "detecta errores semánticos antes de llegar al Matcher",
  async () => {
    const {
      validateLibraryImportRow
    } = await import("../lib/library-import-row.js");

    assert.deepEqual(
      validateLibraryImportRow({
        title: "X",
        type: "music",
        year: 20.5,
        status: "abandoned",
        progress: 150,
        author: "",
        source: "",
        externalId: ""
      }),
      [
        "title_too_short",
        "invalid_type",
        "invalid_year",
        "invalid_status",
        "invalid_progress"
      ]
    );
  }
);

test(
  "los campos opcionales ausentes no generan errores",
  async () => {
    const {
      validateLibraryImportRow
    } = await import("../lib/library-import-row.js");

    assert.deepEqual(
      validateLibraryImportRow({
        title: "Project Hail Mary",
        type: "book",
        year: null,
        status: "",
        progress: null,
        author: "Andy Weir",
        source: "",
        externalId: ""
      }),
      []
    );
  }
);

test(
  "no confunde números inválidos con campos opcionales vacíos",
  () => {
    const row = normalizeLibraryImportRow({
      title: "Dune",
      type: "book",
      year: "abc",
      progress: "mucho"
    });

    assert.deepEqual(
      validateLibraryImportRow(row),
      [
        "invalid_year",
        "invalid_progress"
      ]
    );
  }
);
