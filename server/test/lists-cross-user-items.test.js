import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const listsSource = fs.readFileSync(
  new URL(
    "../../assets/js/app/lists.js",
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

function loadResolver() {
  const source =
    extractFunction(
      listsSource,
      "_resolveListItemEntry"
    );

  const getCanonicalContentKey =
    (item = {}) => {
      const source =
        String(item.source || "")
          .trim()
          .toLowerCase();

      const type =
        String(item.type || "")
          .trim()
          .toLowerCase();

      const externalId =
        String(item.externalId || "")
          .trim();

      return (
        source &&
        type &&
        externalId
      )
        ? `${source}::${type}::${externalId}`
        : "";
    };

  const normalizeId =
    (value) =>
      String(value || "").trim();

  return Function(
    "_normalizeId",
    "_getListItemEntryId",
    "window",
    `"use strict"; return (${source});`
  )(
    normalizeId,
    (entry) =>
      normalizeId(
        typeof entry === "string"
          ? entry
          : entry?.id
      ),
    {
      ItemIdentity: {
        getCanonicalContentKey
      }
    }
  );
}

test(
  "_resolveListItemEntry prioriza ID local, identidad canónica y después snapshot",
  () => {
    const resolve =
      loadResolver();

    const localExact = {
      id: "local-exact",
      source: "tmdb",
      type: "pelicula",
      externalId: "11",
      title: "Exacta",
      cover: "exact.jpg",
      progress: 70
    };

    const localCanonical = {
      id: "owner-local-603",
      source: "tmdb",
      type: "pelicula",
      externalId: "603",
      title: "Matrix local",
      cover: "local.jpg",
      progress: 50
    };

    const library = [
      localExact,
      localCanonical
    ];

    assert.equal(
      resolve(
        {
          id: "local-exact"
        },
        library
      ),
      localExact
    );

    assert.equal(
      resolve(
        {
          id: "collaborator-local-603",
          source: "tmdb",
          type: "pelicula",
          externalId: "603",
          itemSnapshot: {
            title: "Matrix compartida",
            cover: "shared.jpg"
          }
        },
        library
      ),
      localCanonical
    );

    assert.deepEqual(
      resolve(
        {
          id: "remote-only-999",
          source: "tmdb",
          type: "pelicula",
          externalId: "999",
          itemSnapshot: {
            title: "Contenido remoto",
            cover: "remote.jpg"
          }
        },
        library
      ),
      {
        id: "remote-only-999",
        source: "tmdb",
        type: "pelicula",
        externalId: "999",
        title: "Contenido remoto",
        cover: "remote.jpg",
        progress: 0,
        __listSnapshot: true
      }
    );
  }
);

test(
  "overview y detalle resuelven los items de lista con el resolver cross-user",
  () => {
    const previewStart =
      listsSource.indexOf(
        "function _getListPreviewItems"
      );

    const previewEnd =
      listsSource.indexOf(
        "function _renderListCover",
        previewStart
      );

    assert.notEqual(previewStart, -1);
    assert.notEqual(previewEnd, -1);

    const previewBlock =
      listsSource.slice(
        previewStart,
        previewEnd
      );

    assert.match(
      previewBlock,
      /_resolveListItemEntry/
    );

    const detailStart =
      listsSource.indexOf(
        "async function renderActiveListItems"
      );

    const detailEnd =
      listsSource.indexOf(
        "async function removeItemFromActiveList",
        detailStart
      );

    assert.notEqual(detailStart, -1);
    assert.notEqual(detailEnd, -1);

    const detailBlock =
      listsSource.slice(
        detailStart,
        detailEnd
      );

    assert.match(
      detailBlock,
      /_resolveListItemEntry/
    );
  }
);

test(
  "los items resueltos solo por snapshot no ofrecen un Undo que requiera Library local",
  () => {
    const detailStart =
      listsSource.indexOf(
        "async function renderActiveListItems"
      );

    const detailEnd =
      listsSource.indexOf(
        "async function removeItemFromActiveList",
        detailStart
      );

    assert.notEqual(detailStart, -1);
    assert.notEqual(detailEnd, -1);

    const detailBlock =
      listsSource.slice(
        detailStart,
        detailEnd
      );

    assert.match(
      detailBlock,
      /data-can-undo=/
    );

    assert.match(
      detailBlock,
      /__listSnapshot/
    );

    const removeStart =
      listsSource.indexOf(
        "async function removeItemFromActiveList"
      );

    const removeEnd =
      listsSource.indexOf(
        "function applyFilters",
        removeStart
      );

    assert.notEqual(removeStart, -1);
    assert.notEqual(removeEnd, -1);

    const removeBlock =
      listsSource.slice(
        removeStart,
        removeEnd
      );

    assert.match(
      removeBlock,
      /canUndo/
    );

    assert.match(
      removeBlock,
      /actionLabel:\s*canUndo\s*\?/
    );
  }
);

test(
  "la eliminación local de un item compartido contempla identidad canónica y no solo id",
  () => {
    const removeStart =
      listsSource.indexOf(
        "async function removeItemFromActiveList"
      );

    const removeEnd =
      listsSource.indexOf(
        "function applyFilters",
        removeStart
      );

    assert.notEqual(removeStart, -1);
    assert.notEqual(removeEnd, -1);

    const removeBlock =
      listsSource.slice(
        removeStart,
        removeEnd
      );

    assert.match(
      removeBlock,
      /sameContentIdentity|getCanonicalContentKey/
    );
  }
);
