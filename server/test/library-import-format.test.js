import assert from "node:assert/strict";
import test from "node:test";

import {
  detectLibraryImportFormat
} from "../lib/library-import-format.js";

test(
  "detecta Quacker CSV v1 por su contenido",
  () => {
    assert.deepEqual(
      detectLibraryImportFormat({
        fileName: "biblioteca.csv",
        mimeType: "text/csv",
        text: [
          "title,type,year,status,progress",
          "Dune,pelicula,2021,completed,100"
        ].join("\n")
      }),
      {
        format: "quacker_csv_v1",
        confidence: "high"
      }
    );
  }
);

test(
  "tolera BOM y no depende exclusivamente de la extensión",
  () => {
    assert.deepEqual(
      detectLibraryImportFormat({
        fileName: "datos.txt",
        mimeType: "text/plain",
        text: "\uFEFFtitle,type\nDune,pelicula"
      }),
      {
        format: "quacker_csv_v1",
        confidence: "high"
      }
    );
  }
);

test(
  "devuelve unknown cuando el contenido no cumple el contrato reconocido",
  () => {
    for (const input of [
      {
        fileName: "datos.csv",
        mimeType: "text/csv",
        text: "name,category\nDune,movie"
      },
      {
        fileName: "datos.json",
        mimeType: "application/json",
        text: '{"title":"Dune","type":"pelicula"}'
      },
      {
        fileName: "",
        mimeType: "",
        text: ""
      }
    ]) {
      assert.deepEqual(
        detectLibraryImportFormat(input),
        {
          format: "unknown",
          confidence: "none"
        }
      );
    }
  }
);
