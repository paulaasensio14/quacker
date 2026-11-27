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

function fixture({ confirm = true, api, uiConfirm = true } = {}) {
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
  const confirmationOptions = [];
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
        throw new Error("native_confirm_must_not_be_used");
      },

      UIConfirm: uiConfirm ? {
        async ask(options) {
          confirmations += 1;
          confirmationOptions.push(options);

          return typeof confirm === "function"
            ? await confirm(options)
            : confirm;
        }
      } : undefined,

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
    "let __detailSeasonConfirmBusy = false;\n" +
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
    get confirmationOptions() { return confirmationOptions; },
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
    },

    setUpdatedAt(value) {
      active.updatedAt = value;
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

function pendingConfirmation() {
  let release;

  const promise = new Promise(resolve => {
    release = resolve;
  });

  return { promise, release };
}

function seasonAction(watched = true) {
  return {
    season: 1,
    watched,
    wholeSeason: true
  };
}

test(
  "DS-07.5.2: aceptar temporada conserva API y tono semantico",
  async () => {
    for (const watched of [true, false]) {
      let sent;

      const f = fixture({
        api: async args => {
          sent = args;
          return successfulResponse();
        }
      });

      await f.run(seasonAction(watched));

      assert.equal(f.confirmations, 1);
      assert.equal(f.apiCalls, 1);
      assert.equal(sent.itemId, "serie-a");
      assert.equal(sent.season, 1);
      assert.equal(sent.watched, watched);
      assert.equal(sent.expectedUpdatedAt, "fecha-inicial");
      assert.equal("episode" in sent, false);

      const options = f.confirmationOptions[0];

      assert.equal(
        options.tone,
        watched ? "normal" : "danger"
      );

      assert.equal(
        options.message,
        watched
          ? "explore_detail_season_mark_confirm"
          : "explore_detail_season_unmark_confirm"
      );

      assert.equal(options.cancelLabel, "common_cancel");
      assert.equal(options.closeLabel, "common_close");
    }
  }
);

test(
  "DS-07.5.2: componente ausente no autoriza temporada",
  async () => {
    const f = fixture({
      uiConfirm: false,
      api: async () => successfulResponse()
    });

    await f.run(seasonAction());

    assert.equal(f.apiCalls, 0);
    assert.equal(f.controls[0].disabled, false);
    assert.equal(f.toasts.length, 0);
  }
);

test(
  "DS-07.5.2: fallo del dialogo no autoriza temporada",
  async () => {
    const f = fixture({
      confirm: async () => {
        throw new Error("dialog_failed");
      },
      api: async () => successfulResponse()
    });

    await f.run(seasonAction());
    await f.run(seasonAction());

    assert.equal(f.confirmations, 2);
    assert.equal(f.apiCalls, 0);
    assert.equal(f.controls[0].disabled, false);
  }
);

test(
  "DS-07.5.2: cambiar de serie durante confirmacion cancela guardado",
  async () => {
    const decision = pendingConfirmation();

    const f = fixture({
      confirm: () => decision.promise,
      api: async () => successfulResponse()
    });

    const operation = f.run(seasonAction());

    assert.equal(f.apiCalls, 0);

    f.switchSeries();

    decision.release(true);

    await operation;

    assert.equal(f.apiCalls, 0);
    assert.equal(f.item.__libraryItemId, "serie-b");
    assert.equal(f.renders, 0);
  }
);

test(
  "DS-07.5.2: cambio de version durante confirmacion cancela guardado",
  async () => {
    const decision = pendingConfirmation();

    const f = fixture({
      confirm: () => decision.promise,
      api: async () => successfulResponse()
    });

    const operation = f.run(seasonAction());

    f.setUpdatedAt("fecha-actualizada");

    decision.release(true);

    await operation;

    assert.equal(f.apiCalls, 0);
    assert.equal(f.item.updatedAt, "fecha-actualizada");
    assert.equal(f.controls[0].disabled, false);
  }
);

test(
  "DS-07.5.2: salir de la ficha durante confirmacion cancela guardado",
  async () => {
    const decision = pendingConfirmation();

    const f = fixture({
      confirm: () => decision.promise,
      api: async () => successfulResponse()
    });

    const operation = f.run(seasonAction());

    f.setVisible(false);

    decision.release(true);

    await operation;

    assert.equal(f.apiCalls, 0);
    assert.equal(f.renders, 0);
  }
);

test(
  "DS-07.5.2: no duplica ni mezcla operaciones pendientes",
  async () => {
    const decision = pendingConfirmation();

    const f = fixture({
      confirm: () => decision.promise,
      api: async () => successfulResponse()
    });

    const first = f.run(seasonAction());

    assert.equal(f.confirmations, 1);

    await f.run(seasonAction(false));

    await f.run({
      season: 1,
      episode: 1,
      watched: true
    });

    assert.equal(f.confirmations, 1);
    assert.equal(f.apiCalls, 0);

    decision.release(true);

    await first;

    assert.equal(f.apiCalls, 1);
    assert.equal(f.controls[0].disabled, false);
  }
);

test(
  "DS-07.5.2: dashboard carga UIConfirm antes de Explorar",
  () => {
    const html = fs.readFileSync(
      new URL("../../dashboard.html", import.meta.url),
      "utf8"
    );

    const css = html.indexOf(
      'href="assets/css/design-confirmations.css"'
    );

    const script = html.indexOf(
      'src="assets/js/app/ui-confirm.js"'
    );

    const explore = html.indexOf(
      'src="assets/js/app/explore.js"'
    );

    assert.ok(css >= 0);
    assert.ok(script >= 0);
    assert.ok(explore > script);
  }
);
