import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const source = fs.readFileSync(
  new URL("../../assets/js/data/api-client.js", import.meta.url),
  "utf8"
);

function extract(name) {
  const marker = `  async function ${name}(`;
  const start = source.indexOf(marker);

  assert.ok(start >= 0, `Falta ${name}`);

  const end = source.indexOf(
    "\n  async function ",
    start + marker.length
  );

  assert.ok(end > start, `No se encontró el final de ${name}`);

  return source.slice(start, end);
}

test(
  "QA-02-002 LOCAL: marcar episodio persiste biblioteca e historial",
  async () => {
    const state = {
      library: [{
        id: "serie-local-1",
        type: "serie",
        title: "Serie de prueba",
        status: "not_started",
        progress: 0,
        updatedAt: "2026-10-30T10:00:00.000Z",
        meta: {
          totalEpisodes: 3,
          seasonBreakdown: [{
            seasonNumber: 1,
            episodeCount: 3
          }]
        }
      }],
      consumptionHistory: []
    };

    let saves = 0;
    const notifications = [];

    const FakeBackend = {
      getState: () => state,
      saveState: () => {
        saves += 1;
      }
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
      `${extract("setSeriesEpisodeWatched")}
       return setSeriesEpisodeWatched;`
    );

    const setSeriesEpisodeWatched = factory(
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

    const result = await setSeriesEpisodeWatched({
      itemId: "serie-local-1",
      season: 1,
      episode: 1,
      watched: true
    });

    assert.equal(result.ok, true);
    assert.equal(state.library[0].meta.episodeTrackingVersion, 1);

    assert.equal(
      state.consumptionHistory.filter(
        (event) =>
          event.eventType === "episode_watched" &&
          event.itemId === "serie-local-1" &&
          Number(event.meta?.season) === 1 &&
          Number(event.meta?.episode) === 1
      ).length,
      1
    );

    assert.equal(state.library[0].progress, 33);

    assert.deepEqual(result.nextEpisode, {
      season: 1,
      episode: 2
    });

    assert.equal(state.library[0].meta.season, 1);
    assert.equal(state.library[0].meta.episode, 2);

    assert.equal(saves, 1);

    assert.ok(
      notifications.some(
        (detail) => detail.kind === "library"
      )
    );

    assert.ok(
      notifications.some(
        (detail) => detail.kind === "consumptionHistory"
      )
    );
  }
);
