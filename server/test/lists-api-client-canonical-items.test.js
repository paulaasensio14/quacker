import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const apiClientSource = fs.readFileSync(
  new URL(
    "../../assets/js/data/api-client.js",
    import.meta.url
  ),
  "utf8"
);

function extractFunction(source, name) {
  const start =
    source.indexOf(`function ${name}(`);

  assert.notEqual(
    start,
    -1,
    `No se encontró function ${name}()`
  );

  let depth = 0;
  let bodyStarted = false;

  for (
    let index = start;
    index < source.length;
    index += 1
  ) {
    if (source[index] === "{") {
      depth += 1;
      bodyStarted = true;
    } else if (source[index] === "}") {
      depth -= 1;

      if (
        bodyStarted &&
        depth === 0
      ) {
        return source.slice(
          start,
          index + 1
        );
      }
    }
  }

  throw new Error(
    `No se pudo aislar function ${name}()`
  );
}

function extractAsyncFunction(source, name) {
  const start =
    source.indexOf(
      `async function ${name}(`
    );

  assert.notEqual(
    start,
    -1,
    `No se encontró async function ${name}()`
  );

  const paramsStart =
    source.indexOf("(", start);

  assert.notEqual(
    paramsStart,
    -1,
    `No se encontraron parámetros de ${name}()`
  );

  let parenDepth = 0;
  let paramsEnd = -1;

  for (
    let index = paramsStart;
    index < source.length;
    index += 1
  ) {
    if (source[index] === "(") {
      parenDepth += 1;
    } else if (source[index] === ")") {
      parenDepth -= 1;

      if (parenDepth === 0) {
        paramsEnd = index;
        break;
      }
    }
  }

  assert.notEqual(
    paramsEnd,
    -1,
    `No se pudo cerrar la firma de ${name}()`
  );

  const bodyStart =
    source.indexOf("{", paramsEnd);

  assert.notEqual(
    bodyStart,
    -1,
    `No se encontró el cuerpo de ${name}()`
  );

  let braceDepth = 0;

  for (
    let index = bodyStart;
    index < source.length;
    index += 1
  ) {
    if (source[index] === "{") {
      braceDepth += 1;
    } else if (source[index] === "}") {
      braceDepth -= 1;

      if (braceDepth === 0) {
        return source.slice(
          start,
          index + 1
        );
      }
    }
  }

  throw new Error(
    `No se pudo aislar async function ${name}()`
  );
}

function loadSanitizer() {
  const source =
    extractFunction(
      apiClientSource,
      "_sanitizeListsForSetAll"
    );

  return Function(
    "_normalizeDataId",
    "_normalizeContentText",
    "_makeApiError",
    `"use strict"; return (${source});`
  )(
    (value) =>
      String(value || "").trim(),
    (value) =>
      String(value || "")
        .replace(/\s+/g, " ")
        .trim(),
    (message) =>
      new Error(message)
  );
}

test(
  "_sanitizeListsForSetAll conserva identidad canónica y snapshot sin romper items legacy",
  () => {
    const sanitize =
      loadSanitizer();

    const result =
      sanitize([
        {
          id: "list-1",
          name: "Lista compartida",
          visibility: "collab",
          items: [
            {
              id: "local_matrix_603",
              source: "tmdb",
              type: "pelicula",
              externalId: "603",
              itemSnapshot: {
                title:
                  "Matrix",
                cover:
                  "https://image.example.test/matrix.jpg"
              },
              addedAt:
                "2026-09-29T10:00:00.000Z"
            },
            {
              id: "legacy-item",
              addedAt:
                "2026-09-29T11:00:00.000Z"
            }
          ]
        }
      ]);

    assert.equal(
      result.length,
      1
    );

    assert.deepEqual(
      result[0].items[0],
      {
        id:
          "local_matrix_603",
        source:
          "tmdb",
        type:
          "pelicula",
        externalId:
          "603",
        itemSnapshot: {
          title:
            "Matrix",
          cover:
            "https://image.example.test/matrix.jpg"
        },
        addedAt:
          "2026-09-29T10:00:00.000Z"
      }
    );

    assert.deepEqual(
      result[0].items[1],
      {
        id:
          "legacy-item",
        addedAt:
          "2026-09-29T11:00:00.000Z"
      }
    );
  }
);

function loadGetListsContainingItem({
  lists = [],
  library = []
} = {}) {
  const source =
    extractAsyncFunction(
      apiClientSource,
      "getListsContainingItem"
    );

  return Function(
    "_normalizeDataId",
    "getLists",
    "getLibrary",
    "_normalizeCanonicalIdentity",
    `"use strict"; return (${source});`
  )(
    (value) =>
      String(value || "").trim(),
    async () => lists,
    async () => library,
    (source, type, externalId) => ({
      source:
        String(source || "")
          .trim()
          .toLowerCase(),
      type:
        String(type || "")
          .trim()
          .toLowerCase(),
      externalId:
        String(externalId || "")
          .trim()
    })
  );
}

function loadGetListsCountByLibraryMatch({
  lists = [],
  library = []
} = {}) {
  const source =
    extractAsyncFunction(
      apiClientSource,
      "getListsCountByLibraryMatch"
    );

  return Function(
    "_normalizeDataId",
    "getLists",
    "getLibrary",
    "_normalizeCanonicalIdentity",
    `"use strict"; return (${source});`
  )(
    (value) =>
      String(value || "").trim(),
    async () => lists,
    async () => library,
    (source, type, externalId) => ({
      source:
        String(source || "")
          .trim()
          .toLowerCase(),
      type:
        String(type || "")
          .trim()
          .toLowerCase(),
      externalId:
        String(externalId || "")
          .trim()
    })
  );
}

test(
  "getListsContainingItem reconoce el mismo contenido canónico aunque el id local sea distinto",
  async () => {
    const getListsContainingItem =
      loadGetListsContainingItem({
        library: [
          {
            id: "collaborator-local-603",
            source: "tmdb",
            type: "pelicula",
            externalId: "603",
            title: "Matrix"
          }
        ],
        lists: [
          {
            id: "shared-list",
            items: [
              {
                id: "owner-local-603",
                source: "tmdb",
                type: "pelicula",
                externalId: "603",
                itemSnapshot: {
                  title: "Matrix",
                  cover: ""
                }
              }
            ]
          }
        ]
      });

    const result =
      await getListsContainingItem(
        "collaborator-local-603"
      );

    assert.equal(
      result.length,
      1
    );

    assert.equal(
      result[0].id,
      "shared-list"
    );
  }
);

test(
  "getListsCountByLibraryMatch cuenta una entrada compartida por identidad canónica aunque use otro id local",
  async () => {
    const getListsCountByLibraryMatch =
      loadGetListsCountByLibraryMatch({
        library: [
          {
            id: "collaborator-local-603",
            source: "tmdb",
            type: "pelicula",
            externalId: "603"
          }
        ],
        lists: [
          {
            id: "shared-list",
            items: [
              {
                id: "owner-local-603",
                source: "tmdb",
                type: "pelicula",
                externalId: "603"
              }
            ]
          }
        ]
      });

    const count =
      await getListsCountByLibraryMatch({
        source: "tmdb",
        type: "pelicula",
        externalId: "603"
      });

    assert.equal(
      count,
      1
    );
  }
);

function loadGetListsCountMapByLibraryKey({
  lists = [],
  library = []
} = {}) {
  const source =
    extractAsyncFunction(
      apiClientSource,
      "getListsCountMapByLibraryKey"
    );

  return Function(
    "getLists",
    "getLibrary",
    "_normalizeDataId",
    "_normalizeCanonicalIdentity",
    `"use strict"; return (${source});`
  )(
    async () => lists,
    async () => library,
    (value) =>
      String(value || "").trim(),
    (source, type, externalId) => ({
      source:
        String(source || "")
          .trim()
          .toLowerCase(),
      type:
        String(type || "")
          .trim()
          .toLowerCase(),
      externalId:
        String(externalId || "")
          .trim()
    })
  );
}

test(
  "getListsCountMapByLibraryKey cuenta contenido compartido por identidad canónica aunque el id local sea distinto",
  async () => {
    const getListsCountMapByLibraryKey =
      loadGetListsCountMapByLibraryKey({
        library: [
          {
            id:
              "collaborator-local-603",
            source:
              "tmdb",
            type:
              "pelicula",
            externalId:
              "603",
            title:
              "Matrix"
          }
        ],
        lists: [
          {
            id:
              "shared-list",
            items: [
              {
                id:
                  "owner-local-603",
                source:
                  "tmdb",
                type:
                  "pelicula",
                externalId:
                  "603",
                itemSnapshot: {
                  title:
                    "Matrix",
                  cover: ""
                }
              }
            ]
          }
        ]
      });

    const counts =
      await getListsCountMapByLibraryKey();

    assert.equal(
      counts["tmdb::pelicula::603"],
      1
    );
  }
);
