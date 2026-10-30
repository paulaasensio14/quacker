import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const source = fs.readFileSync(
  new URL("../../assets/js/data/api-client.js", import.meta.url),
  "utf8"
);

const start = source.indexOf(
  "  async function setSeriesEpisodeWatched("
);

const end = source.indexOf(
  "  async function setSeriesSeasonWatched(",
  start
);

assert.ok(start >= 0 && end > start);

const implementation = source.slice(start, end);

function createFixture({
  legacy = false,
  initialHistory = []
} = {}) {
  const state = {
    library: [
      {
        id: "serie-a",
        type: "serie",
        status: "not_started",
        progress: 0,
        updatedAt: "2026-10-30T10:00:00.000Z",
        meta: {
          totalEpisodes: 3,
          seasonBreakdown: [
            { seasonNumber: 1, episodeCount: 3 }
          ],
          ...(legacy
            ? {
                episodeSeenMap: {
                  "1:1": "2026-10-01T10:00:00.000Z"
                }
              }
            : {})
        }
      },
      {
        id: "serie-b",
        type: "serie",
        status: "watching",
        progress: 50,
        updatedAt: "2026-10-29T10:00:00.000Z",
        meta: {
          totalEpisodes: 2,
          seasonBreakdown: [
            { seasonNumber: 1, episodeCount: 2 }
          ]
        }
      }
    ],
    consumptionHistory: [
      {
        id: "foreign-event",
        itemId: "serie-b",
        eventType: "episode_watched",
        occurredAt: "2026-10-29T10:00:00.000Z",
        meta: { season: 1, episode: 1 }
      },
      ...initialHistory
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
     return setSeriesEpisodeWatched;`
  );

  const run = factory(
    (id) => String(id ?? "").trim(),
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
  "QA-02-002 LOCAL: marcar y desmarcar elimina el evento",
  async () => {
    const fixture = createFixture();

    const first = await fixture.run({
      itemId: "serie-a",
      season: 1,
      episode: 2,
      watched: true
    });

    assert.equal(first.ok, true);
    assert.equal(first.watchedEpisodes, 1);
    assert.equal(first.item.progress, 33);

    const second = await fixture.run({
      itemId: "serie-a",
      season: 1,
      episode: 2,
      watched: false,
      expectedUpdatedAt: first.item.updatedAt
    });

    assert.equal(second.ok, true);
    assert.equal(second.watchedEpisodes, 0);
    assert.equal(second.item.progress, 0);
    assert.equal(second.item.status, "not_started");

    assert.deepEqual(
      second.item.meta.episodeSeenMap,
      {}
    );

    assert.equal(
      fixture.state.consumptionHistory.filter(
        (event) => event.itemId === "serie-a"
      ).length,
      0
    );

    assert.equal(second.item.meta.episodeTrackingVersion, 1);
    assert.equal(fixture.getSaves(), 2);

    const repeated = await fixture.run({
      itemId: "serie-a",
      season: 1,
      episode: 2,
      watched: false
    });

    assert.equal(repeated.changed, 0);
    assert.equal(fixture.getSaves(), 2);
  }
);

test(
  "QA-02-002 LOCAL: ninguna operación modifica otra serie",
  async () => {
    const fixture = createFixture();

    const foreignBefore = structuredClone(
      fixture.state.library[1]
    );

    const foreignEventBefore = structuredClone(
      fixture.state.consumptionHistory[0]
    );

    await fixture.run({
      itemId: "serie-a",
      season: 1,
      episode: 1,
      watched: true
    });

    assert.deepEqual(
      fixture.state.library[1],
      foreignBefore
    );

    assert.deepEqual(
      fixture.state.consumptionHistory.find(
        (event) => event.id === "foreign-event"
      ),
      foreignEventBefore
    );
  }
);

test(
  "QA-02-002 LOCAL: conflicto no modifica estado",
  async () => {
    const fixture = createFixture();

    const before = structuredClone(fixture.state);

    await assert.rejects(
      fixture.run({
        itemId: "serie-a",
        season: 1,
        episode: 1,
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
  "QA-02-002 LOCAL: historial heredado exige migración",
  async () => {
    const fixture = createFixture({ legacy: true });
    const before = structuredClone(fixture.state);

    await assert.rejects(
      fixture.run({
        itemId: "serie-a",
        season: 1,
        episode: 1,
        watched: false
      }),
      /legacy_episode_history_requires_migration/
    );

    assert.deepEqual(fixture.state, before);
    assert.equal(fixture.getSaves(), 0);
    assert.equal(fixture.notifications.length, 0);
  }
);


test(
  "QA-02-002 LOCAL: episodio rechaza temporadas duplicadas",
  async () => {
    const fixture = createFixture();

    fixture.state.library[0].meta.seasonBreakdown = [
      { seasonNumber: 1, episodeCount: 2 },
      { seasonNumber: 1, episodeCount: 2 }
    ];

    const before = structuredClone(fixture.state);

    await assert.rejects(
      fixture.run({
        itemId: "serie-a",
        season: 1,
        episode: 1,
        watched: true
      }),
      (error) =>
        error.status === 400 &&
        error.message === "duplicate_season"
    );

    assert.deepEqual(fixture.state, before);
    assert.equal(fixture.getSaves(), 0);
    assert.equal(fixture.notifications.length, 0);
  }
);
