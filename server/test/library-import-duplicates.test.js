import assert from "node:assert/strict";
import test from "node:test";

import {
  findLibraryImportDuplicate
} from "../lib/library-import-duplicates.js";

test(
  "detecta duplicados por identidad canónica aunque cambie el título",
  () => {
    const library = [
      {
        id: "lib-1",
        title: "Dune: Parte Uno",
        type: "pelicula",
        source: "tmdb",
        externalId: "438631"
      }
    ];

    const duplicate =
      findLibraryImportDuplicate(
        library,
        {
          title: "Dune",
          type: "pelicula",
          source: "tmdb",
          externalId: "0438631"
        }
      );

    assert.equal(
      duplicate?.id,
      "lib-1"
    );
  }
);

test(
  "no considera duplicado un contenido con identidad canónica distinta",
  () => {
    const library = [
      {
        id: "lib-1",
        title: "Dune",
        type: "pelicula",
        source: "tmdb",
        externalId: "438631"
      }
    ];

    const duplicate =
      findLibraryImportDuplicate(
        library,
        {
          title: "Dune",
          type: "pelicula",
          source: "tmdb",
          externalId: "841"
        }
      );

    assert.equal(
      duplicate,
      null
    );
  }
);
