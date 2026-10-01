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

function loadCreateListPoll({
  httpResponse
} = {}) {
  const source =
    extractAsyncFunction(
      apiClientSource,
      "createListPoll"
    );

  const calls = [];
  const events = [];
  let cacheInvalidations = 0;

  const fn =
    Function(
      "_normalizeDataId",
      "_httpJson",
      "_isHttp",
      "_makeApiError",
      "_emitDataChanged",
      "_invalidateListsCache",
      `"use strict"; return (${source});`
    )(
      (value) =>
        String(value || "").trim(),
      async (
        method,
        url,
        body
      ) => {
        calls.push({
          method,
          url,
          body
        });

        return httpResponse;
      },
      () => true,
      (message, status) => {
        const error =
          new Error(message);

        error.status =
          status;

        return error;
      },
      (detail) => {
        events.push(detail);
      },
      () => {
        cacheInvalidations += 1;
      }
    );

  return {
    fn,
    calls,
    events,
    getCacheInvalidations:
      () => cacheInvalidations
  };
}

test(
  "createListPoll crea una votación por HTTP e invalida la caché de listas",
  async () => {
    const poll = {
      id: "poll-1",
      title: "Qué vemos",
      createdByUserId: "user-1",
      allowMultipleVotes: false,
      options: [],
      votesByUserId: {},
      deadlineAt: null,
      closedAt: null,
      winnerContentKey: "",
      createdAt:
        "2026-09-30T10:00:00.000Z"
    };

    const {
      fn: createListPoll,
      calls,
      events,
      getCacheInvalidations
    } =
      loadCreateListPoll({
        httpResponse: {
          ok: true,
          poll
        }
      });

    const result =
      await createListPoll(
        "list-1",
        {
          title:
            "Qué vemos",
          optionContentKeys: [
            "tmdb::pelicula::123",
            "tmdb::pelicula::456"
          ],
          allowMultipleVotes:
            false,
          deadlineAt:
            null
        }
      );

    assert.deepEqual(
      calls,
      [
        {
          method: "POST",
          url:
            "/lists/list-1/polls",
          body: {
            title:
              "Qué vemos",
            optionContentKeys: [
              "tmdb::pelicula::123",
              "tmdb::pelicula::456"
            ],
            allowMultipleVotes:
              false,
            deadlineAt:
              null
          }
        }
      ]
    );

    assert.deepEqual(
      result,
      poll
    );

    assert.equal(
      getCacheInvalidations(),
      1
    );

    assert.deepEqual(
      events,
      [
        {
          kind: "lists",
          action: "create_poll",
          listId: "list-1",
          pollId: "poll-1"
        }
      ]
    );
  }
);

function loadVoteListPoll({
  httpResponse
} = {}) {
  const source =
    extractAsyncFunction(
      apiClientSource,
      "voteListPoll"
    );

  const calls = [];
  const events = [];
  let cacheInvalidations = 0;

  const fn =
    Function(
      "_normalizeDataId",
      "_httpJson",
      "_isHttp",
      "_makeApiError",
      "_emitDataChanged",
      "_invalidateListsCache",
      `"use strict"; return (${source});`
    )(
      (value) =>
        String(value || "").trim(),
      async (
        method,
        url,
        body
      ) => {
        calls.push({
          method,
          url,
          body
        });

        return httpResponse;
      },
      () => true,
      (message, status) => {
        const error =
          new Error(message);

        error.status =
          status;

        return error;
      },
      (detail) => {
        events.push(detail);
      },
      () => {
        cacheInvalidations += 1;
      }
    );

  return {
    fn,
    calls,
    events,
    getCacheInvalidations:
      () => cacheInvalidations
  };
}

test(
  "voteListPoll envía y reemplaza el voto propio por HTTP",
  async () => {
    const poll = {
      id: "poll-1",
      title: "Qué vemos",
      votesByUserId: {
        "user-1": [
          "tmdb::pelicula::456"
        ]
      }
    };

    const {
      fn: voteListPoll,
      calls,
      events,
      getCacheInvalidations
    } =
      loadVoteListPoll({
        httpResponse: {
          ok: true,
          poll
        }
      });

    const result =
      await voteListPoll(
        "list-1",
        "poll-1",
        [
          "tmdb::pelicula::456"
        ]
      );

    assert.deepEqual(
      calls,
      [
        {
          method: "PUT",
          url:
            "/lists/list-1/polls/poll-1/votes/me",
          body: {
            contentKeys: [
              "tmdb::pelicula::456"
            ]
          }
        }
      ]
    );

    assert.deepEqual(
      result,
      poll
    );

    assert.equal(
      getCacheInvalidations(),
      1
    );

    assert.deepEqual(
      events,
      [
        {
          kind: "lists",
          action: "vote_poll",
          listId: "list-1",
          pollId: "poll-1"
        }
      ]
    );
  }
);

function loadCloseListPoll({
  httpResponse
} = {}) {
  const source =
    extractAsyncFunction(
      apiClientSource,
      "closeListPoll"
    );

  const calls = [];
  const events = [];
  let cacheInvalidations = 0;

  const fn =
    Function(
      "_normalizeDataId",
      "_httpJson",
      "_isHttp",
      "_makeApiError",
      "_emitDataChanged",
      "_invalidateListsCache",
      `"use strict"; return (${source});`
    )(
      (value) =>
        String(value || "").trim(),
      async (
        method,
        url,
        body
      ) => {
        calls.push({
          method,
          url,
          body
        });

        return httpResponse;
      },
      () => true,
      (message, status) => {
        const error =
          new Error(message);

        error.status =
          status;

        return error;
      },
      (detail) => {
        events.push(detail);
      },
      () => {
        cacheInvalidations += 1;
      }
    );

  return {
    fn,
    calls,
    events,
    getCacheInvalidations:
      () => cacheInvalidations
  };
}

test(
  "closeListPoll cierra una votación por HTTP e invalida la caché",
  async () => {
    const poll = {
      id: "poll-1",
      title: "Qué vemos",
      closedAt:
        "2026-09-30T13:00:00.000Z",
      winnerContentKey:
        "tmdb::pelicula::123"
    };

    const {
      fn: closeListPoll,
      calls,
      events,
      getCacheInvalidations
    } =
      loadCloseListPoll({
        httpResponse: {
          ok: true,
          poll
        }
      });

    const result =
      await closeListPoll(
        "list-1",
        "poll-1"
      );

    assert.deepEqual(
      calls,
      [
        {
          method: "POST",
          url:
            "/lists/list-1/polls/poll-1/close",
          body: undefined
        }
      ]
    );

    assert.deepEqual(
      result,
      poll
    );

    assert.equal(
      getCacheInvalidations(),
      1
    );

    assert.deepEqual(
      events,
      [
        {
          kind: "lists",
          action: "close_poll",
          listId: "list-1",
          pollId: "poll-1"
        }
      ]
    );
  }
);

function loadGetListPollResults({
  httpResponse
} = {}) {
  const source =
    extractAsyncFunction(
      apiClientSource,
      "getListPollResults"
    );

  const calls = [];

  const fn =
    Function(
      "_normalizeDataId",
      "_httpJson",
      "_isHttp",
      "_makeApiError",
      `"use strict"; return (${source});`
    )(
      (value) =>
        String(value || "").trim(),
      async (
        method,
        url,
        body
      ) => {
        calls.push({
          method,
          url,
          body
        });

        return httpResponse;
      },
      () => true,
      (message, status) => {
        const error =
          new Error(message);

        error.status =
          status;

        return error;
      }
    );

  return {
    fn,
    calls
  };
}

test(
  "getListPollResults obtiene el recuento de una votación por HTTP",
  async () => {
    const poll = {
      id: "poll-1",
      title: "Qué vemos"
    };

    const results = {
      totalVotes: 2,
      counts: {
        "tmdb::pelicula::123": 2,
        "tmdb::pelicula::456": 0
      },
      topContentKeys: [
        "tmdb::pelicula::123"
      ],
      winnerContentKey:
        "tmdb::pelicula::123",
      tied: false
    };

    const {
      fn: getListPollResults,
      calls
    } =
      loadGetListPollResults({
        httpResponse: {
          ok: true,
          poll,
          results
        }
      });

    const result =
      await getListPollResults(
        "list-1",
        "poll-1"
      );

    assert.deepEqual(
      calls,
      [
        {
          method: "GET",
          url:
            "/lists/list-1/polls/poll-1/results",
          body: undefined
        }
      ]
    );

    assert.deepEqual(
      result,
      {
        poll,
        results
      }
    );
  }
);
