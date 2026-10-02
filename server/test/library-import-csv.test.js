import assert from "node:assert/strict";
import test from "node:test";

import {
  parseLibraryImportCsv
} from "../lib/library-import-csv.js";

test(
  "parsea Quacker CSV v1 con cabecera y filas",
  () => {
    const result = parseLibraryImportCsv(
      [
        "title,type,year,status,progress,author,source,externalId",
        "Dune,pelicula,2021,completed,100,,,",
        "Project Hail Mary,book,2021,reading,42,Andy Weir,,"
      ].join("\n")
    );

    assert.deepEqual(
      result.headers,
      [
        "title",
        "type",
        "year",
        "status",
        "progress",
        "author",
        "source",
        "externalId"
      ]
    );

    assert.deepEqual(
      result.rows,
      [
        {
          title: "Dune",
          type: "pelicula",
          year: "2021",
          status: "completed",
          progress: "100",
          author: "",
          source: "",
          externalId: ""
        },
        {
          title: "Project Hail Mary",
          type: "book",
          year: "2021",
          status: "reading",
          progress: "42",
          author: "Andy Weir",
          source: "",
          externalId: ""
        }
      ]
    );
  }
);

test(
  "tolera BOM, comas, comillas escapadas y saltos de línea entrecomillados",
  () => {
    const result = parseLibraryImportCsv(
      '\uFEFFtitle,type,author\n' +
      '"Tomorrow, and Tomorrow, and Tomorrow",book,"Gabrielle Zevin"\n' +
      '"The ""Special"" Edition",book,"Autor\ncon dos líneas"'
    );

    assert.deepEqual(
      result.headers,
      ["title", "type", "author"]
    );

    assert.deepEqual(
      result.rows,
      [
        {
          title: "Tomorrow, and Tomorrow, and Tomorrow",
          type: "book",
          author: "Gabrielle Zevin"
        },
        {
          title: 'The "Special" Edition',
          type: "book",
          author: "Autor\ncon dos líneas"
        }
      ]
    );
  }
);

test(
  "rechaza CSV con comillas sin cerrar",
  () => {
    assert.throws(
      () => parseLibraryImportCsv(
        'title,type\n"Dune,pelicula'
      ),
      (error) => {
        assert.equal(
          error?.code,
          "csv_unclosed_quote"
        );
        return true;
      }
    );
  }
);

test(
  "rechaza un archivo CSV vacío",
  () => {
    assert.throws(
      () => parseLibraryImportCsv(""),
      (error) => {
        assert.equal(
          error?.code,
          "csv_empty"
        );
        return true;
      }
    );
  }
);

test(
  "Quacker CSV v1 exige title y type",
  () => {
    for (const csv of [
      "type,year\npelicula,2021",
      "title,year\nDune,2021"
    ]) {
      assert.throws(
        () => parseLibraryImportCsv(csv),
        (error) => {
          assert.equal(
            error?.code,
            "csv_missing_required_headers"
          );
          return true;
        }
      );
    }
  }
);

test(
  "rechaza cabeceras duplicadas",
  () => {
    assert.throws(
      () => parseLibraryImportCsv(
        "title,type,title\nDune,pelicula,Dune"
      ),
      (error) => {
        assert.equal(
          error?.code,
          "csv_duplicate_header"
        );
        return true;
      }
    );
  }
);

test(
  "rechaza cabeceras vacías",
  () => {
    assert.throws(
      () => parseLibraryImportCsv(
        "title,,type\nDune,,pelicula"
      ),
      (error) => {
        assert.equal(
          error?.code,
          "csv_empty_header"
        );
        return true;
      }
    );
  }
);

test(
  "rechaza filas con un número de columnas distinto a la cabecera",
  () => {
    for (const csv of [
      "title,type,year\nDune,pelicula",
      "title,type\nDune,pelicula,2021"
    ]) {
      assert.throws(
        () => parseLibraryImportCsv(csv),
        (error) => {
          assert.equal(
            error?.code,
            "csv_column_count_mismatch"
          );
          return true;
        }
      );
    }
  }
);

test(
  "Quacker CSV v1 rechaza cabeceras no soportadas",
  () => {
    for (const csv of [
      "title,type,progess\nDune,pelicula,100",
      "title,type,unknownField\nDune,pelicula,valor"
    ]) {
      assert.throws(
        () => parseLibraryImportCsv(csv),
        (error) => {
          assert.equal(
            error?.code,
            "csv_unsupported_header"
          );
          return true;
        }
      );
    }
  }
);
