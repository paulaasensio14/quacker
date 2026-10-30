import test from "node:test";
import assert from "node:assert/strict";

import {
  applySeriesWatchMutation
} from "../series-watch-mutations.js";

const fixture = () => ({
  itemId: "breaking-bad",
  seasonBreakdown: [
    { seasonNumber: 1, episodeCount: 7 },
    { seasonNumber: 2, episodeCount: 13 }
  ],
  history: []
});

test("QA-02-002: marca un episodio individual", () => {
  const state = fixture();

  const result = applySeriesWatchMutation({
    ...state,
    season: 1,
    episodes: [1],
    watched: true
  });

  assert.equal(result.added.length, 1);
  assert.equal(result.removed.length, 0);
  assert.equal(result.watchedEpisodes, 1);
  assert.deepEqual(result.nextEpisode, {
    season: 1,
    episode: 2
  });
});

test("QA-02-002: marcar dos veces no duplica episodios", () => {
  const state = fixture();

  const first = applySeriesWatchMutation({
    ...state,
    season: 1,
    episodes: [1],
    watched: true
  });

  const second = applySeriesWatchMutation({
    ...state,
    history: first.history,
    season: 1,
    episodes: [1],
    watched: true
  });

  assert.equal(second.added.length, 0);
  assert.equal(second.watchedEpisodes, 1);
});

test("QA-02-002: marca una temporada completa", () => {
  const state = fixture();

  const result = applySeriesWatchMutation({
    ...state,
    season: 1,
    episodes: [1, 2, 3, 4, 5, 6, 7],
    watched: true
  });

  assert.equal(result.added.length, 7);
  assert.equal(result.watchedEpisodes, 7);
  assert.deepEqual(result.nextEpisode, {
    season: 2,
    episode: 1
  });
});

test("QA-02-002: conserva los episodios previamente vistos", () => {
  const state = fixture();

  const first = applySeriesWatchMutation({
    ...state,
    season: 1,
    episodes: [1, 2, 3],
    watched: true
  });

  const second = applySeriesWatchMutation({
    ...state,
    history: first.history,
    season: 1,
    episodes: [1, 2, 3, 4, 5, 6, 7],
    watched: true
  });

  assert.equal(second.added.length, 4);
  assert.equal(second.watchedEpisodes, 7);
});

test("QA-02-002: desmarcar un episodio respeta los demás", () => {
  const state = fixture();

  const first = applySeriesWatchMutation({
    ...state,
    season: 1,
    episodes: [1, 2, 3],
    watched: true
  });

  const second = applySeriesWatchMutation({
    ...state,
    history: first.history,
    season: 1,
    episodes: [2],
    watched: false
  });

  assert.equal(second.removed.length, 1);
  assert.equal(second.watchedEpisodes, 2);
  assert.deepEqual(second.nextEpisode, {
    season: 1,
    episode: 2
  });
});

test("QA-02-002: rechaza episodios inexistentes", () => {
  const state = fixture();

  assert.throws(() => {
    applySeriesWatchMutation({
      ...state,
      season: 1,
      episodes: [8],
      watched: true
    });
  }, /invalid_episode/);
});

test("QA-02-002: una operación inválida no altera el historial", () => {
  const state = fixture();

  const original = structuredClone(state.history);

  assert.throws(() => {
    applySeriesWatchMutation({
      ...state,
      season: 1,
      episodes: [1, 8],
      watched: true
    });
  }, /invalid_episode/);

  assert.deepEqual(state.history, original);
});

test("QA-02-002: no modifica el historial original", () => {
  const original = [{
    id: "event-1",
    itemId: "breaking-bad",
    eventType: "episode_watched",
    meta: { season: 1, episode: 1 }
  }];

  const snapshot = structuredClone(original);

  applySeriesWatchMutation({
    ...fixture(),
    history: original,
    season: 1,
    episodes: [2],
    watched: true
  });

  assert.deepEqual(original, snapshot);
});

test("QA-02-002: conserva eventos de otros contenidos", () => {
  const other = {
    id: "other-1",
    itemId: "otra-serie",
    eventType: "episode_watched",
    meta: { season: 1, episode: 1 }
  };

  const result = applySeriesWatchMutation({
    ...fixture(),
    history: [other],
    season: 1,
    episodes: [1],
    watched: true
  });

  assert.ok(result.history.some(
    (event) => event.id === "other-1"
  ));

  assert.equal(result.watchedEpisodes, 1);
});

test("QA-02-002: desmarcar elimina duplicados del mismo episodio", () => {
  const history = [1, 2].map((n) => ({
    id: `duplicate-${n}`,
    itemId: "breaking-bad",
    eventType: "episode_watched",
    meta: { season: 1, episode: 1 }
  }));

  const result = applySeriesWatchMutation({
    ...fixture(),
    history,
    season: 1,
    episodes: [1],
    watched: false
  });

  assert.equal(result.removed.length, 2);
  assert.equal(result.watchedEpisodes, 0);
  assert.equal(result.history.length, 0);
});

test("QA-02-002: rechaza temporadas duplicadas", () => {
  assert.throws(() => {
    applySeriesWatchMutation({
      ...fixture(),
      seasonBreakdown: [
        { seasonNumber: 1, episodeCount: 7 },
        { seasonNumber: 1, episodeCount: 7 }
      ],
      season: 1,
      episodes: [1],
      watched: true
    });
  }, /duplicate_season/);
});

test("QA-02-002: rechaza estados de visionado inválidos", () => {
  assert.throws(() => {
    applySeriesWatchMutation({
      ...fixture(),
      season: 1,
      episodes: [1],
      watched: "true"
    });
  }, /invalid_watched_state/);
});

test("QA-02-002: rechaza números de episodio decimales", () => {
  assert.throws(() => {
    applySeriesWatchMutation({
      ...fixture(),
      season: 1,
      episodes: [1.5],
      watched: true
    });
  }, /invalid_episode/);
});

test("QA-02-002: desmarcar temporada conserva otras temporadas", () => {
  const state = fixture();

  const first = applySeriesWatchMutation({
    ...state,
    season: 1,
    episodes: [1, 2, 3, 4, 5, 6, 7],
    watched: true
  });

  const second = applySeriesWatchMutation({
    ...state,
    history: first.history,
    season: 2,
    episodes: [1],
    watched: true
  });

  const third = applySeriesWatchMutation({
    ...state,
    history: second.history,
    season: 1,
    episodes: [1, 2, 3, 4, 5, 6, 7],
    watched: false
  });

  assert.equal(third.watchedEpisodes, 1);
  assert.deepEqual(third.nextEpisode, {
    season: 1,
    episode: 1
  });
  assert.equal(
    third.history.filter((event) =>
      event.itemId === "breaking-bad" &&
      Number(event.meta?.season) === 2
    ).length,
    1
  );
});

test(
  "QA-02-002: cada episodio nuevo recibe identificador temporal distinto",
  () => {
    const state = fixture();

    const result = applySeriesWatchMutation({
      ...state,
      season: 1,
      episodes: [1, 2, 3],
      watched: true
    });

    const ids = result.added.map((event) => event.id);

    assert.equal(ids.length, 3);
    assert.equal(new Set(ids).size, 3);
    assert.ok(ids.every((id) => id.startsWith("pending:")));
  }
);

test("QA-02-002: evita el 100 por ciento prematuro", () => {
  const result = applySeriesWatchMutation({
    itemId: "serie-larga",
    seasonBreakdown: [
      { seasonNumber: 1, episodeCount: 200 }
    ],
    history: [],
    season: 1,
    episodes: Array.from({ length: 199 }, (_, i) => i + 1),
    watched: true
  });

  assert.equal(result.totalEpisodes, 200);
  assert.equal(result.watchedEpisodes, 199);
  assert.equal(result.completed, false);
  assert.equal(result.progress, 99);
  assert.deepEqual(result.nextEpisode, {
    season: 1,
    episode: 200
  });
});
