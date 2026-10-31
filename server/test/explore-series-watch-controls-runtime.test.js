import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const source = fs.readFileSync(
  new URL("../../assets/js/app/explore.js", import.meta.url),
  "utf8"
);

const startMarker =
  "  async function _setContentDetailSeriesWatchState(";

const endMarker =
  "  async function _toggleContentDetailSeason(";

const start = source.indexOf(startMarker);
const end = source.indexOf(endMarker, start);

assert.ok(start >= 0, "Falta el controlador");
assert.ok(end > start, "Límite del controlador incorrecto");

const handlerSource = source.slice(start, end);

function fixture({ confirm = true, api } = {}) {
  let active = {
    eid: "serie-a-eid",
    type: "serie",
    __libraryItemId: "serie-a",
    updatedAt: "fecha-inicial",
    progress: 0,
    status: "not_started",
    meta: { seasonBreakdown: [{ seasonNumber: 1, episodeCount: 2 }] }
  };

  let visible = true;
  let apiCalls = 0;
  let renders = 0;
  let confirmations = 0;
  let stateUpdates = 0;

  const toasts = [];
  const cache = new Map();

  let controls = [{
    disabled: false,
    setAttribute() {},
    removeAttribute() {}
  }];

  const context = {
    console: { error() {} },

    Map,

    __detailEpisodeActivityCache: cache,

    document: {
      querySelectorAll() {
        return controls;
      }
    },

    window: {
      I18n: {
        t(key) {
          return key;
        }
      },

      confirm() {
        confirmations += 1;
        return confirm;
      },

      toast(message) {
        toasts.push(message);
      },

      DetailModule: {
        render() {
          renders += 1;
        }
      }
    },

    _getActiveDetailItem() {
      return active;
    },

    _isDetailViewActive() {
      return visible;
    },

    _normalizeId(value) {
      return String(value || "").trim();
    },

    _norm(value) {
      return String(value || "").trim().toLowerCase();
    },

    _getDetailEpisodeActivityCacheKey(item) {
      return `detail_episode_activity:${item.__libraryItemId}`;
    },

    _setActiveDetailState({ item }) {
      active = item;
      stateUpdates += 1;
    },

    ApiClient: {
      async setSeriesEpisodeWatched(args) {
        apiCalls += 1;
        return api(args);
      },

      async setSeriesSeasonWatched(args) {
        apiCalls += 1;
        return api(args);
      }
    }
  };

  vm.runInNewContext(
    "let __detailEpisodeWatchBusy = false;\n" +
    handlerSource +
    "\nglobalThis.runWatch = _setContentDetailSeriesWatchState;",
    context,
    { filename: "explore-series-watch-handler.js" }
  );

  return {
    run: context.runWatch,
    get item() { return active; },
    get apiCalls() { return apiCalls; },
    get renders() { return renders; },
    get confirmations() { return confirmations; },
    get stateUpdates() { return stateUpdates; },
    get toasts() { return toasts; },
    get controls() { return controls; },
    get cache() { return cache; },

    switchSeries() {
      active = {
        ...active,
        eid: "serie-b-eid",
        __libraryItemId: "serie-b"
      };
    },

    setVisible(value) {
      visible = value;
    }
  };
}

function successfulResponse() {
  return {
    ok: true,
    item: {
      status: "watching",
      progress: 50,
      updatedAt: "fecha-nueva",
      meta: {
        episodeSeenMap: {
          "1:1": "2026-10-30T17:00:00.000Z"
        },
        season: 1,
        episode: 2,
        episodeTrackingVersion: 1
      }
    }
  };
}

test(
  "QA-02-002 UI runtime: cancelar temporada no llama a API",
  async () => {
    const f = fixture({
      confirm: false,
      api: async () => successfulResponse()
    });

    await f.run({
      season: 1,
      watched: true,
      wholeSeason: true
    });

    assert.equal(f.confirmations, 1);
    assert.equal(f.apiCalls, 0);
    assert.equal(f.renders, 0);
    assert.equal(f.toasts.length, 0);
  }
);

test(
  "QA-02-002 UI runtime: guardado actualiza ficha y caché",
  async () => {
    let sent;

    const f = fixture({
      api: async (args) => {
        sent = args;
        return successfulResponse();
      }
    });

    await f.run({
      season: 1,
      episode: 1,
      watched: true
    });

    assert.equal(f.apiCalls, 1);
    assert.equal(sent.itemId, "serie-a");
    assert.equal(sent.season, 1);
    assert.equal(sent.episode, 1);
    assert.equal(sent.expectedUpdatedAt, "fecha-inicial");

    assert.equal(f.item.progress, 50);
    assert.equal(f.item.status, "watching");
    assert.equal(f.item.meta.season, 1);
    assert.equal(f.item.meta.episode, 2);
    assert.equal(f.renders, 1);
    assert.equal(f.stateUpdates, 1);

    assert.equal(
      f.cache.get("detail_episode_activity:serie-a")["1:1"],
      "2026-10-30T17:00:00.000Z"
    );

    assert.equal(f.controls[0].disabled, false);
    assert.equal(f.toasts.length, 1);
  }
);

test(
  "QA-02-002 UI runtime: doble clic no duplica guardado",
  async () => {
    let release;

    const pending = new Promise((resolve) => {
      release = resolve;
    });

    const f = fixture({
      api: async () => pending
    });

    const first = f.run({
      season: 1,
      episode: 1,
      watched: true
    });

    assert.equal(f.controls[0].disabled, true);

    await f.run({
      season: 1,
      episode: 1,
      watched: true
    });

    assert.equal(f.apiCalls, 1);

    release(successfulResponse());
    await first;

    assert.equal(f.apiCalls, 1);
    assert.equal(f.controls[0].disabled, false);
    assert.equal(f.renders, 1);
  }
);

test(
  "QA-02-002 UI runtime: error de serie A no aparece en serie B",
  async () => {
    let rejectPending;

    const pending = new Promise((_, reject) => {
      rejectPending = reject;
    });

    const f = fixture({
      api: async () => pending
    });

    const operation = f.run({
      season: 1,
      episode: 1,
      watched: true
    });

    f.switchSeries();

    rejectPending(
      Object.assign(new Error("stale_library_update"), {
        status: 409
      })
    );

    await operation;

    assert.equal(f.apiCalls, 1);
    assert.equal(f.item.__libraryItemId, "serie-b");
    assert.equal(f.renders, 0);
    assert.equal(f.stateUpdates, 0);

    // Un error de A no debe mostrarse sobre la ficha B.
    assert.equal(f.toasts.length, 0);
  }
);


test(
  "QA-02-002 UI runtime: resultado de A no modifica la ficha B",
  async () => {
    let resolvePending;

    const pending = new Promise((resolve) => {
      resolvePending = resolve;
    });

    const f = fixture({
      api: async () => pending
    });

    const operation = f.run({
      season: 1,
      episode: 1,
      watched: true
    });

    assert.equal(f.controls[0].disabled, true);

    f.switchSeries();

    resolvePending(successfulResponse());
    await operation;

    assert.equal(f.apiCalls, 1);
    assert.equal(f.item.__libraryItemId, "serie-b");
    assert.equal(f.item.progress, 0);
    assert.equal(f.renders, 0);
    assert.equal(f.stateUpdates, 0);
    assert.equal(f.toasts.length, 0);
    assert.equal(f.controls[0].disabled, false);
    assert.equal(f.cache.size, 0);
  }
);

test(
  "QA-02-002 UI runtime: conflicto 409 desbloquea controles",
  async () => {
    const f = fixture({
      api: async () => {
        throw Object.assign(
          new Error("stale_library_update"),
          { status: 409 }
        );
      }
    });

    await f.run({
      season: 1,
      episode: 1,
      watched: true
    });

    assert.equal(f.apiCalls, 1);
    assert.equal(f.item.progress, 0);
    assert.equal(f.stateUpdates, 0);
    assert.equal(f.renders, 0);
    assert.equal(f.controls[0].disabled, false);

    assert.equal(f.toasts.length, 1);
    assert.equal(f.toasts[0].type, "error");
    assert.equal(
      f.toasts[0].message,
      "explore_detail_watch_conflict"
    );
  }
);

test(
  "QA-02-002 UI runtime: error general no altera el progreso",
  async () => {
    const f = fixture({
      api: async () => {
        throw new Error("network_failure");
      }
    });

    await f.run({
      season: 1,
      watched: true,
      wholeSeason: true
    });

    assert.equal(f.confirmations, 1);
    assert.equal(f.apiCalls, 1);
    assert.equal(f.item.progress, 0);
    assert.equal(f.item.status, "not_started");
    assert.equal(f.stateUpdates, 0);
    assert.equal(f.renders, 0);
    assert.equal(f.cache.size, 0);
    assert.equal(f.controls[0].disabled, false);

    assert.equal(f.toasts.length, 1);
    assert.equal(f.toasts[0].type, "error");
    assert.equal(
      f.toasts[0].message,
      "explore_detail_watch_error"
    );
  }
);
