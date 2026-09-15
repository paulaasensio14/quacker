import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const serverSource = fs.readFileSync(
  new URL("../server.js", import.meta.url),
  "utf8"
);

function extractFunction(source, name) {
  const start = source.indexOf(`function ${name}(`);

  assert.notEqual(
    start,
    -1,
    `no se encontró function ${name}()`
  );

  let depth = 0;
  let bodyStarted = false;

  for (let i = start; i < source.length; i += 1) {
    if (source[i] === "{") {
      depth += 1;
      bodyStarted = true;
    } else if (source[i] === "}") {
      depth -= 1;

      if (bodyStarted && depth === 0) {
        return source.slice(start, i + 1);
      }
    }
  }

  throw new Error(`no se pudo aislar function ${name}()`);
}

function makeNormalizeConsumptionEvent() {
  const snapshotFnSource = extractFunction(
    serverSource,
    "_normalizeConsumptionItemSnapshot"
  );

  const eventFnSource = extractFunction(
    serverSource,
    "_normalizeConsumptionEvent"
  );

  return Function(
    `"use strict";
${snapshotFnSource}
return (${eventFnSource});`
  )();
}

test(
  "consumptionHistory se normaliza siempre como una lista",
  () => {
    const normalizeConsumptionEvent = makeNormalizeConsumptionEvent();

    const fnSource = extractFunction(
      serverSource,
      "_normalizeConsumptionHistory"
    );

    const normalizeConsumptionHistory = Function(
      "_normalizeConsumptionEvent",
      `"use strict"; return (${fnSource});`
    )(normalizeConsumptionEvent);

    assert.deepEqual(
      normalizeConsumptionHistory(null),
      []
    );

    assert.deepEqual(
      normalizeConsumptionHistory({}),
      []
    );

    const history = [
      {
        id: "history-1",
        itemId: "movie-1",
        contentType: "pelicula",
        eventType: "watched",
        occurredAt: "2026-09-14T21:35:00.000Z",
        itemSnapshot: null,
        meta: {}
      }
    ];

    assert.deepEqual(
      normalizeConsumptionHistory(history),
      history
    );
  }
);

test(
  "_getUserBucket prepara consumptionHistory para usuarios existentes",
  () => {
    const start = serverSource.indexOf(
      "function _getUserBucket(db, userId)"
    );

    assert.notEqual(
      start,
      -1,
      "no se encontró _getUserBucket"
    );

    const block = serverSource.slice(
      start,
      serverSource.indexOf(
        "\nfunction ",
        start + 20
      )
    );

    assert.match(
      block,
      /consumptionHistory:\s*\[\]/
    );

    assert.match(
      block,
      /consumptionHistory\s*=\s*_normalizeConsumptionHistory/
    );
  }
);

test(
  "las cuentas nuevas empiezan con consumptionHistory vacío",
  () => {
    const registerStart = serverSource.indexOf(
      'app.post("/api/auth/register"'
    );

    assert.notEqual(
      registerStart,
      -1,
      "no se encontró POST /api/auth/register"
    );

    const registerBlock = serverSource.slice(
      registerStart,
      serverSource.indexOf(
        "\napp.",
        registerStart + 20
      )
    );

    assert.match(
      registerBlock,
      /consumptionHistory:\s*\[\]/
    );
  }
);

test(
  "normaliza un visionado de película",
  () => {
    const normalizeConsumptionEvent = makeNormalizeConsumptionEvent();

    assert.deepEqual(
      normalizeConsumptionEvent({
        id: " history-1 ",
        itemId: " movie-1 ",
        contentType: "pelicula",
        eventType: "watched",
        occurredAt: "2026-09-14T21:35:00.000Z",
        itemSnapshot: null,
        meta: {}
      }),
      {
        id: "history-1",
        itemId: "movie-1",
        contentType: "pelicula",
        eventType: "watched",
        occurredAt: "2026-09-14T21:35:00.000Z",
        itemSnapshot: null,
        meta: {}
      }
    );
  }
);

test(
  "normaliza temporada y episodio en un visionado de serie",
  () => {
    const normalizeConsumptionEvent = makeNormalizeConsumptionEvent();

    assert.deepEqual(
      normalizeConsumptionEvent({
        id: "history-2",
        itemId: "series-1",
        contentType: "serie",
        eventType: "episode_watched",
        occurredAt: "2026-09-14T22:00:00.000Z",
        itemSnapshot: null,
        meta: {
          season: 2,
          episode: 4
        }
      }),
      {
        id: "history-2",
        itemId: "series-1",
        contentType: "serie",
        eventType: "episode_watched",
        occurredAt: "2026-09-14T22:00:00.000Z",
        itemSnapshot: null,
        meta: {
          season: 2,
          episode: 4
        }
      }
    );
  }
);

test(
  "rechaza eventos de consumo inválidos",
  () => {
    const normalizeConsumptionEvent = makeNormalizeConsumptionEvent();

    assert.equal(
      normalizeConsumptionEvent({
        itemId: "",
        contentType: "pelicula",
        eventType: "watched",
        occurredAt: "2026-09-14T21:35:00.000Z",
        itemSnapshot: null,
      }),
      null
    );

    assert.equal(
      normalizeConsumptionEvent({
        itemId: "movie-1",
        contentType: "pelicula",
        eventType: "watched",
        occurredAt: "fecha-invalida",
        itemSnapshot: null,
      }),
      null
    );

    assert.equal(
      normalizeConsumptionEvent({
        itemId: "series-1",
        contentType: "serie",
        eventType: "episode_watched",
        occurredAt: "2026-09-14T22:00:00.000Z",
        itemSnapshot: null,
        meta: {
          season: 0,
          episode: 3
        }
      }),
      null
    );
  }
);

test(
  "consumptionHistory descarta eventos inválidos y normaliza los válidos",
  () => {
    const normalizeConsumptionEvent = makeNormalizeConsumptionEvent();

    const historyFnSource = extractFunction(
      serverSource,
      "_normalizeConsumptionHistory"
    );

    const normalizeConsumptionHistory = Function(
      "_normalizeConsumptionEvent",
      `"use strict"; return (${historyFnSource});`
    )(normalizeConsumptionEvent);

    assert.deepEqual(
      normalizeConsumptionHistory([
        {
          id: " history-1 ",
          itemId: " movie-1 ",
          contentType: "pelicula",
          eventType: "watched",
          occurredAt: "2026-09-14T21:35:00.000Z",
          itemSnapshot: null,
        },
        null,
        {
          id: "",
          itemId: "movie-2",
          contentType: "pelicula",
          eventType: "watched",
          occurredAt: "2026-09-14T22:00:00.000Z",
          itemSnapshot: null,
        },
        {
          id: "history-2",
          itemId: "series-1",
          contentType: "serie",
          eventType: "episode_watched",
          occurredAt: "2026-09-14T22:10:00.000Z",
          itemSnapshot: null,
          meta: {
            season: 1,
            episode: 3
          }
        }
      ]),
      [
        {
          id: "history-1",
          itemId: "movie-1",
          contentType: "pelicula",
          eventType: "watched",
          occurredAt: "2026-09-14T21:35:00.000Z",
          itemSnapshot: null,
          meta: {}
        },
        {
          id: "history-2",
          itemId: "series-1",
          contentType: "serie",
          eventType: "episode_watched",
          occurredAt: "2026-09-14T22:10:00.000Z",
          itemSnapshot: null,
          meta: {
            season: 1,
            episode: 3
          }
        }
      ]
    );
  }
);
