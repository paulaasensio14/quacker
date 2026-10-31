import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const source = fs.readFileSync(
  new URL("../../assets/js/data/api-client.js", import.meta.url),
  "utf8"
);

const start = source.indexOf(
  "  async function setSeriesSeasonWatched("
);

const end = source.indexOf(
  "  async function addConsumptionHistoryEvent(",
  start
);

assert.ok(start >= 0 && end > start);

const implementation = source.slice(start, end);

function makeFixture() {
  const timestamp = "2026-10-30T10:00:00.000Z";

  const state = {
    library: [
      {
        id: "serie-principal",
        type: "serie",
        status: "watching",
        progress: 25,
        updatedAt: timestamp,
        meta: {
          totalEpisodes: 4,
          episodeTrackingVersion: 1,
          seasonBreakdown: [
            { seasonNumber: 1, episodeCount: 2 },
            { seasonNumber: 2, episodeCount: 2 }
          ],
          episodeSeenMap: {
            "2:1": timestamp
          }
        }
      },
      {
        id: "serie-ajena",
        type: "serie",
        status: "not_started",
        progress: 0,
        updatedAt: timestamp,
        meta: {
          totalEpisodes: 1,
          seasonBreakdown: [
            { seasonNumber: 1, episodeCount: 1 }
          ]
        }
      }
    ],
    consumptionHistory: [
      {
        id: "evento-segunda-temporada",
        itemId: "serie-principal",
        contentType: "serie",
        eventType: "episode_watched",
        occurredAt: timestamp,
        meta: { season: 2, episode: 1 }
      },
      {
        id: "evento-ajeno",
        itemId: "serie-ajena",
        contentType: "serie",
        eventType: "episode_watched",
        occurredAt: timestamp,
        meta: { season: 1, episode: 1 }
      }
    ]
  };

  let saves = 0;
  const notifications = [];

  const FakeBackend = {
    getState: () => state,
    saveState: () => { saves += 1; }
  };

  const factory = Function(
    "_normalizeDataId",
    "_isHttp",
    "_httpJson",
    "_emitDataChanged",
    "FakeBackend",
    "_safeState",
    "_cloneData",
    "_makeApiError",
    `${implementation}
     return setSeriesSeasonWatched;`
  );

  const run = factory(
    (value) => String(value ?? "").trim(),
    () => false,
    async () => {
      throw new Error("No debe utilizar HTTP");
    },
    (detail) => notifications.push(detail),
    FakeBackend,
    () => FakeBackend.getState(),
    (value) => structuredClone(value),
    (code, status = 400) =>
      Object.assign(new Error(code), { status, error: code })
  );

  return {
    run,
    state,
    notifications,
    getSaves: () => saves
  };
}

test(
  "QA-02-002 LOCAL: marcar y desmarcar temporada conserva otros episodios",
  async () => {
    const fixture = makeFixture();

    const foreignItem = structuredClone(
      fixture.state.library[1]
    );

    const foreignEvent = structuredClone(
      fixture.state.consumptionHistory[1]
    );

    const marked = await fixture.run({
      itemId: "serie-principal",
      season: 1,
      watched: true
    });

    assert.equal(marked.ok, true);
    assert.equal(marked.watchedEpisodes, 3);
    assert.equal(marked.totalEpisodes, 4);
    assert.equal(marked.item.progress, 75);
    assert.equal(fixture.getSaves(), 1);

    const firstSeasonEvents = () =>
      fixture.state.consumptionHistory.filter(
        (event) =>
          event.itemId === "serie-principal" &&
          event.eventType === "episode_watched" &&
          Number(event.meta?.season) === 1
      );

    assert.equal(firstSeasonEvents().length, 2);

    assert.equal(
      marked.item.meta.episodeTrackingVersion,
      1
    );

    const repeated = await fixture.run({
      itemId: "serie-principal",
      season: 1,
      watched: true,
      expectedUpdatedAt: marked.item.updatedAt
    });

    assert.equal(repeated.ok, true);
    assert.equal(repeated.changed, 0);
    assert.equal(firstSeasonEvents().length, 2);
    assert.equal(fixture.getSaves(), 1);

    const unmarked = await fixture.run({
      itemId: "serie-principal",
      season: 1,
      watched: false
    });

    assert.equal(unmarked.ok, true);
    assert.equal(unmarked.watchedEpisodes, 1);
    assert.equal(unmarked.totalEpisodes, 4);
    assert.equal(unmarked.item.progress, 25);
    assert.equal(unmarked.item.status, "watching");
    assert.equal(firstSeasonEvents().length, 0);

    assert.deepEqual(
      Object.keys(unmarked.item.meta.episodeSeenMap),
      ["2:1"]
    );

    assert.equal(fixture.getSaves(), 2);

    assert.deepEqual(
      fixture.state.library[1],
      foreignItem
    );

    assert.deepEqual(
      fixture.state.consumptionHistory.find(
        (event) => event.id === "evento-ajeno"
      ),
      foreignEvent
    );

    assert.ok(
      fixture.notifications.some(
        (event) => event.kind === "library"
      )
    );

    assert.ok(
      fixture.notifications.some(
        (event) => event.kind === "consumptionHistory"
      )
    );
  }
);


test(
  "QA-02-002 LOCAL: conflicto en temporada conserva el estado",
  async () => {
    const fixture = makeFixture();
    const before = structuredClone(fixture.state);

    await assert.rejects(
      fixture.run({
        itemId: "serie-principal",
        season: 1,
        watched: true,
        expectedUpdatedAt: "2020-01-01T00:00:00.000Z"
      }),
      (error) => error.status === 409
    );

    assert.deepEqual(fixture.state, before);
    assert.equal(fixture.getSaves(), 0);
    assert.equal(fixture.notifications.length, 0);
  }
);

test(
  "QA-02-002 LOCAL: serie heredada exige migración",
  async () => {
    const fixture = makeFixture();
    const item = fixture.state.library[0];

    delete item.meta.episodeTrackingVersion;

    fixture.state.consumptionHistory =
      fixture.state.consumptionHistory.filter(
        (event) => event.itemId !== "serie-principal"
      );

    item.meta.episodeSeenMap = {
      "1:1": "2026-10-01T10:00:00.000Z"
    };

    const before = structuredClone(fixture.state);

    await assert.rejects(
      fixture.run({
        itemId: "serie-principal",
        season: 1,
        watched: false
      }),
      (error) =>
        error.status === 409 &&
        error.message ===
          "legacy_episode_history_requires_migration"
    );

    assert.deepEqual(fixture.state, before);
    assert.equal(fixture.getSaves(), 0);
    assert.equal(fixture.notifications.length, 0);
  }
);

test(
  "QA-02-002 LOCAL: temporada inexistente no guarda cambios",
  async () => {
    const fixture = makeFixture();
    const before = structuredClone(fixture.state);

    await assert.rejects(
      fixture.run({
        itemId: "serie-principal",
        season: 99,
        watched: true
      }),
      (error) => error.status === 400
    );

    assert.deepEqual(fixture.state, before);
    assert.equal(fixture.getSaves(), 0);
    assert.equal(fixture.notifications.length, 0);
  }
);

test(
  "QA-02-002 LOCAL: completar todas las temporadas alcanza 100%",
  async () => {
    const fixture = makeFixture();

    const first = await fixture.run({
      itemId: "serie-principal",
      season: 1,
      watched: true
    });

    assert.equal(first.item.progress, 75);

    const second = await fixture.run({
      itemId: "serie-principal",
      season: 2,
      watched: true,
      expectedUpdatedAt: first.item.updatedAt
    });

    assert.equal(second.ok, true);
    assert.equal(second.watchedEpisodes, 4);
    assert.equal(second.totalEpisodes, 4);
    assert.equal(second.item.progress, 100);
    assert.equal(second.item.status, "completed");
    assert.equal(second.nextEpisode, null);

    const uniqueEpisodes = new Set(
      fixture.state.consumptionHistory
        .filter(
          (event) => event.itemId === "serie-principal"
        )
        .map(
          (event) =>
            `${event.meta.season}:${event.meta.episode}`
        )
    );

    assert.equal(uniqueEpisodes.size, 4);
    assert.equal(fixture.getSaves(), 2);
  }
);


test(
  "QA-02-002 LOCAL: siguiente episodio sincronizado con metadatos",
  async () => {
    const fixture = makeFixture();

    // La segunda temporada tiene visto su primer capítulo.
    // Al completar la primera, el siguiente debe ser T2E2.
    const marked = await fixture.run({
      itemId: "serie-principal",
      season: 1,
      watched: true
    });

    assert.equal(marked.ok, true);

    assert.deepEqual(marked.nextEpisode, {
      season: 2,
      episode: 2
    });

    assert.equal(
      marked.item.meta.season,
      2,
      "La temporada siguiente debe persistirse en meta"
    );

    assert.equal(
      marked.item.meta.episode,
      2,
      "El episodio siguiente debe persistirse en meta"
    );

    const stored = fixture.state.library[0];

    assert.equal(stored.meta.season, 2);
    assert.equal(stored.meta.episode, 2);

    // Al desmarcar la primera temporada, el siguiente
    // capítulo debe volver a ser T1E1.
    const unmarked = await fixture.run({
      itemId: "serie-principal",
      season: 1,
      watched: false,
      expectedUpdatedAt: marked.item.updatedAt
    });

    assert.deepEqual(unmarked.nextEpisode, {
      season: 1,
      episode: 1
    });

    assert.equal(unmarked.item.meta.season, 1);
    assert.equal(unmarked.item.meta.episode, 1);

    assert.equal(fixture.getSaves(), 2);
  }
);


test(
  "QA-02-002 LOCAL: rechaza temporadas duplicadas",
  async () => {
    const fixture = makeFixture();

    fixture.state.library[0].meta.seasonBreakdown = [
      { seasonNumber: 1, episodeCount: 2 },
      { seasonNumber: 1, episodeCount: 2 }
    ];

    const before = structuredClone(fixture.state);

    await assert.rejects(
      fixture.run({
        itemId: "serie-principal",
        season: 1,
        watched: true
      }),
      (error) => error.status === 400
    );

    assert.deepEqual(fixture.state, before);
    assert.equal(fixture.getSaves(), 0);
    assert.equal(fixture.notifications.length, 0);
  }
);

test(
  "QA-02-002 LOCAL: rechaza otra temporada inválida",
  async () => {
    const fixture = makeFixture();

    fixture.state.library[0].meta.seasonBreakdown = [
      { seasonNumber: 1, episodeCount: 2 },
      { seasonNumber: 2, episodeCount: 0 }
    ];

    const before = structuredClone(fixture.state);

    await assert.rejects(
      fixture.run({
        itemId: "serie-principal",
        season: 1,
        watched: true
      }),
      (error) => error.status === 400
    );

    assert.deepEqual(fixture.state, before);
    assert.equal(fixture.getSaves(), 0);
    assert.equal(fixture.notifications.length, 0);
  }
);

test(
  "QA-02-002 LOCAL: rechaza número de temporada inválido",
  async () => {
    const fixture = makeFixture();

    fixture.state.library[0].meta.seasonBreakdown = [
      { seasonNumber: 1, episodeCount: 2 },
      { seasonNumber: 0, episodeCount: 2 }
    ];

    const before = structuredClone(fixture.state);

    await assert.rejects(
      fixture.run({
        itemId: "serie-principal",
        season: 1,
        watched: true
      }),
      (error) => error.status === 400
    );

    assert.deepEqual(fixture.state, before);
    assert.equal(fixture.getSaves(), 0);
    assert.equal(fixture.notifications.length, 0);
  }
);


test(
  "QA-02-002 LOCAL: serie completada vuelve a pendiente al desmarcar",
  async () => {
    const fixture = makeFixture();

    const first = await fixture.run({
      itemId: "serie-principal",
      season: 1,
      watched: true
    });

    assert.equal(first.item.progress, 75);
    assert.deepEqual(first.nextEpisode, {
      season: 2,
      episode: 2
    });

    const completed = await fixture.run({
      itemId: "serie-principal",
      season: 2,
      watched: true,
      expectedUpdatedAt: first.item.updatedAt
    });

    assert.equal(completed.ok, true);
    assert.equal(completed.watchedEpisodes, 4);
    assert.equal(completed.item.progress, 100);
    assert.equal(completed.item.status, "completed");
    assert.equal(completed.nextEpisode, null);

    // Sin siguiente capítulo, la posición conservada
    // corresponde al último episodio de la serie.
    assert.equal(completed.item.meta.season, 2);
    assert.equal(completed.item.meta.episode, 2);

    const reopened = await fixture.run({
      itemId: "serie-principal",
      season: 1,
      watched: false,
      expectedUpdatedAt: completed.item.updatedAt
    });

    assert.equal(reopened.ok, true);
    assert.equal(reopened.item.progress, 50);
    assert.equal(reopened.item.status, "watching");
    assert.equal(reopened.watchedEpisodes, 2);
    assert.equal(reopened.totalEpisodes, 4);

    assert.deepEqual(reopened.nextEpisode, {
      season: 1,
      episode: 1
    });

    assert.equal(reopened.item.meta.season, 1);
    assert.equal(reopened.item.meta.episode, 1);
    assert.equal(reopened.item.meta.episodeTrackingVersion, 1);

    const watchedKeys = new Set(
      fixture.state.consumptionHistory
        .filter(
          (event) => event.itemId === "serie-principal"
        )
        .map(
          (event) =>
            `${event.meta.season}:${event.meta.episode}`
        )
    );

    assert.deepEqual(
      [...watchedKeys].sort(),
      ["2:1", "2:2"]
    );

    assert.equal(fixture.getSaves(), 3);
  }
);
