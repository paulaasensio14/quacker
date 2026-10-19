import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import vm from "node:vm";

async function waitFor(predicate, attempts = 80) {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const value = await predicate();

    if (value) {
      return value;
    }

    await new Promise((resolve) => setImmediate(resolve));
  }

  throw new Error("condition_not_met");
}

function createJsonResponse(body, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    async text() {
      return JSON.stringify(body);
    }
  };
}

function loadApiClient({
  consumptionHistoryOverride = null,
  episodeSeenMapOverride = null,
  lifecycleGate = null,
  libraryItemOverride = null,
  remoteLifecycleOverride = null,
  rejectStaleExpectedUpdatedAt = false
} = {}) {
  const source = fs.readFileSync(
    new URL("../../assets/js/data/api-client.js", import.meta.url),
    "utf8"
  );

  const libraryItem = {
    id: "series-dynamic-1",
    title: "Serie dinámica",
    type: "serie",
    source: "tmdb",
    externalId: "123",
    status: "completed",
    progress: 100,
    updatedAt: "2026-11-05T10:00:00.000Z",
    meta: {
      season: 1,
      episode: 8,
      episodeSeenMap:
        episodeSeenMapOverride ?? {
          "1:1": "2026-01-01T20:00:00.000Z",
          "1:8": "2026-01-08T20:00:00.000Z"
        },
      totalSeasons: 1,
      totalEpisodes: 8,
      seasonBreakdown: [
        {
          seasonNumber: 1,
          episodeCount: 8
        }
      ],
      seriesStatus: "Returning Series",
      inProduction: true,
      lastEpisodeToAir: {
        season: 1,
        episode: 8,
        airDate: "2026-01-08"
      }
    }
  };

  Object.assign(libraryItem, libraryItemOverride || {});

  const remoteLifecycle = remoteLifecycleOverride || {
    totalSeasons: 2,
    totalEpisodes: 16,
    seasonBreakdown: [
      {
        seasonNumber: 1,
        episodeCount: 8
      },
      {
        seasonNumber: 2,
        episodeCount: 8
      }
    ],
    lastAirDate: "2026-11-05",
    seriesStatus: "Returning Series",
    inProduction: true,
    lastEpisodeToAir: {
      season: 2,
      episode: 1,
      airDate: "2026-11-05"
    },
    nextEpisodeToAir: {
      season: 2,
      episode: 2,
      airDate: "2026-11-12"
    }
  };

  const consumptionHistory =
    consumptionHistoryOverride ??
    Array.from(
    { length: 8 },
    (_, index) => ({
      id: `event-${index + 1}`,
      itemId: "series-dynamic-1",
      contentType: "serie",
      eventType: "episode_watched",
      occurredAt: `2026-01-${String(index + 1).padStart(2, "0")}T20:00:00.000Z`,
      meta: {
        season: 1,
        episode: index + 1
      }
    })
  );

  const requests = [];
  const consoleErrors = [];

  const context = {
    window: {
      location: {
        hostname: "quacker.test",
        port: "",
        protocol: "https:",
        pathname: "/library.html",
        href: "/library.html"
      },
      I18n: {
        getLang() {
          return "es";
        },
        t(key, _params, fallback) {
          return fallback || key;
        }
      },
      QuackerMonthlyChallenges: []
    },
    document: {
      dispatchEvent() {}
    },
    console: {
      ...console,
      error(...args) {
        consoleErrors.push(args);
      }
    },
    URLSearchParams,
    AbortController,
    setTimeout,
    clearTimeout,
    structuredClone,
    fetch: async (url, options = {}) => {
      const safeUrl = String(url);
      const method = String(options.method || "GET").toUpperCase();

      requests.push({
        url: safeUrl,
        method,
        body: options.body ? JSON.parse(options.body) : null
      });

      if (safeUrl === "/api/library" && method === "GET") {
        return createJsonResponse({ items: [libraryItem] });
      }

      if (
        safeUrl === "/api/explore/item/tmdb/serie/123/lifecycle" &&
        method === "GET"
      ) {
        if (lifecycleGate) {
          await lifecycleGate;
        }

        return createJsonResponse(remoteLifecycle);
      }

      if (
        safeUrl ===
          "/api/consumption-history?itemId=series-dynamic-1" &&
        method === "GET"
      ) {
        return createJsonResponse({
          consumptionHistory
        });
      }

      if (
        safeUrl === "/api/library/series-dynamic-1" &&
        method === "PATCH"
      ) {
        const patch = JSON.parse(options.body || "{}");

        if (
          rejectStaleExpectedUpdatedAt &&
          Object.prototype.hasOwnProperty.call(
            patch,
            "expectedUpdatedAt"
          ) &&
          String(patch.expectedUpdatedAt || "") !==
            String(libraryItem.updatedAt || "")
        ) {
          return createJsonResponse(
            {
              error: "stale_library_update"
            },
            409
          );
        }

        const {
          expectedUpdatedAt: _expectedUpdatedAt,
          logActivity: _logActivity,
          id: _patchId,
          ...persistedPatch
        } = patch;

        Object.assign(
          libraryItem,
          persistedPatch,
          {
            meta: {
              ...libraryItem.meta,
              ...(persistedPatch.meta || {})
            },
            updatedAt: "2026-11-05T10:10:00.000Z"
          }
        );

        return createJsonResponse({
          ...libraryItem
        });
      }

      throw new Error(
        `Unexpected request: ${method} ${safeUrl}`
      );
    }
  };

  vm.createContext(context);
  vm.runInContext(
    `${source}\n;globalThis.__ApiClientForTest = ApiClient;`,
    context,
    { filename: "assets/js/data/api-client.js" }
  );

  return {
    ApiClient: context.__ApiClientForTest,
    requests,
    libraryItem,
    consoleErrors
  };
}

test(
  "getLibrary reabre silenciosamente una serie TMDB cuando se estrena un episodio nuevo",
  async () => {
    const { ApiClient, requests } = loadApiClient();

    const initialItems = await ApiClient.getLibrary();

    assert.equal(initialItems.length, 1);
    assert.equal(initialItems[0].progress, 100);
    assert.equal(initialItems[0].status, "completed");

    const items = await waitFor(async () => {
      const snapshot = await ApiClient.getLibrary();

      return snapshot?.[0]?.progress === 89
        ? snapshot
        : null;
    });

    assert.equal(items[0].progress, 89);
    assert.equal(items[0].status, "watching");

    assert.equal(items[0].meta.totalSeasons, 2);
    assert.equal(items[0].meta.totalEpisodes, 16);
    assert.deepEqual(
      items[0].meta.lastEpisodeToAir,
      {
        season: 2,
        episode: 1,
        airDate: "2026-11-05"
      }
    );

    assert.equal(items[0].meta.season, 1);
    assert.equal(items[0].meta.episode, 8);
    assert.deepEqual(
      items[0].meta.episodeSeenMap,
      {
        "1:1": "2026-01-01T20:00:00.000Z",
        "1:8": "2026-01-08T20:00:00.000Z"
      }
    );

    const detailRequest = requests.find(
      (request) =>
        request.method === "GET" &&
        request.url === "/api/explore/item/tmdb/serie/123/lifecycle"
    );

    const historyRequest = requests.find(
      (request) =>
        request.method === "GET" &&
        request.url ===
          "/api/consumption-history?itemId=series-dynamic-1"
    );

    const patchRequest = requests.find(
      (request) =>
        request.method === "PATCH" &&
        request.url === "/api/library/series-dynamic-1"
    );

    assert.ok(detailRequest);
    assert.ok(historyRequest);
    assert.ok(patchRequest);

    assert.equal(patchRequest.body.logActivity, false);
    assert.equal(patchRequest.body.progress, 89);
    assert.equal(patchRequest.body.status, "watching");

    assert.equal(
      Object.prototype.hasOwnProperty.call(
        patchRequest.body.meta,
        "season"
      ),
      false
    );

    assert.equal(
      Object.prototype.hasOwnProperty.call(
        patchRequest.body.meta,
        "episode"
      ),
      false
    );

    assert.equal(
      Object.prototype.hasOwnProperty.call(
        patchRequest.body.meta,
        "episodeSeenMap"
      ),
      false
    );

    assert.deepEqual(
      patchRequest.body.meta.lastEpisodeToAir,
      {
        season: 2,
        episode: 1,
        airDate: "2026-11-05"
      }
    );
  }
);


test(
  "el refresco conserva el progreso histórico de una serie antigua usando episodeSeenMap como fallback",
  async () => {
    const fullSeenMap = Object.fromEntries(
      Array.from(
        { length: 8 },
        (_, index) => [
          `1:${index + 1}`,
          `2026-01-${String(index + 1).padStart(2, "0")}T20:00:00.000Z`
        ]
      )
    );

    const { ApiClient } = loadApiClient({
      consumptionHistoryOverride: [],
      episodeSeenMapOverride: fullSeenMap
    });

    const initialItems = await ApiClient.getLibrary();

    assert.equal(initialItems.length, 1);
    assert.equal(initialItems[0].progress, 100);
    assert.equal(initialItems[0].status, "completed");

    const items = await waitFor(async () => {
      const snapshot = await ApiClient.getLibrary();

      return snapshot?.[0]?.progress === 89
        ? snapshot
        : null;
    });

    assert.equal(items[0].progress, 89);
    assert.equal(items[0].status, "watching");
  }
);


test(
  "getLibrary no bloquea la biblioteca mientras el refresco lifecycle sigue pendiente",
  async () => {
    let releaseLifecycle;

    const lifecycleGate = new Promise((resolve) => {
      releaseLifecycle = resolve;
    });

    const { ApiClient, requests } = loadApiClient({
      lifecycleGate
    });

    let settled = false;
    let resolvedItems = null;

    const libraryPromise = ApiClient.getLibrary().then((items) => {
      settled = true;
      resolvedItems = items;
      return items;
    });

    await new Promise((resolve) => setImmediate(resolve));
    await new Promise((resolve) => setImmediate(resolve));

    const lifecycleRequest = requests.find(
      (request) =>
        request.method === "GET" &&
        request.url ===
          "/api/explore/item/tmdb/serie/123/lifecycle"
    );

    assert.ok(lifecycleRequest);
    assert.equal(
      settled,
      true,
      "getLibrary no debe esperar a que termine lifecycle"
    );
    assert.equal(resolvedItems?.[0]?.progress, 100);

    releaseLifecycle();
    await libraryPromise;
  }
);


test(
  "una serie ya reabierta sigue actualizando episodios disponibles cuando se estrenan más",
  async () => {
    const { ApiClient, requests } = loadApiClient({
      libraryItemOverride: {
        status: "watching",
        progress: 89,
        meta: {
          season: 1,
          episode: 8,
          totalSeasons: 2,
          totalEpisodes: 16,
          seasonBreakdown: [
            {
              seasonNumber: 1,
              episodeCount: 8
            },
            {
              seasonNumber: 2,
              episodeCount: 8
            }
          ],
          seriesStatus: "Returning Series",
          inProduction: true,
          lastEpisodeToAir: {
            season: 2,
            episode: 1,
            airDate: "2026-11-05"
          },
          nextEpisodeToAir: {
            season: 2,
            episode: 2,
            airDate: "2026-11-12"
          }
        }
      },
      remoteLifecycleOverride: {
        totalSeasons: 2,
        totalEpisodes: 16,
        seasonBreakdown: [
          {
            seasonNumber: 1,
            episodeCount: 8
          },
          {
            seasonNumber: 2,
            episodeCount: 8
          }
        ],
        lastAirDate: "2026-11-12",
        seriesStatus: "Returning Series",
        inProduction: true,
        lastEpisodeToAir: {
          season: 2,
          episode: 2,
          airDate: "2026-11-12"
        },
        nextEpisodeToAir: {
          season: 2,
          episode: 3,
          airDate: "2026-11-19"
        }
      }
    });

    const initialItems = await ApiClient.getLibrary();

    assert.equal(initialItems[0].progress, 89);
    assert.equal(initialItems[0].status, "watching");

    await waitFor(async () => {
      return requests.some(
        (request) =>
          request.method === "PATCH" &&
          request.url === "/api/library/series-dynamic-1"
      );
    });

    const patchRequest = requests.find(
      (request) =>
        request.method === "PATCH" &&
        request.url === "/api/library/series-dynamic-1"
    );

    assert.ok(patchRequest);
    assert.equal(patchRequest.body.progress, 80);
    assert.equal(patchRequest.body.status, "watching");
    assert.deepEqual(
      patchRequest.body.meta.lastEpisodeToAir,
      {
        season: 2,
        episode: 2,
        airDate: "2026-11-12"
      }
    );
  }
);


test(
  "el refresco automático envía la versión leída para impedir sobrescrituras concurrentes",
  async () => {
    let releaseLifecycle;

    const lifecycleGate = new Promise((resolve) => {
      releaseLifecycle = resolve;
    });

    const {
      ApiClient,
      requests,
      libraryItem
    } = loadApiClient({
      lifecycleGate
    });

    const originalUpdatedAt = libraryItem.updatedAt;

    await ApiClient.getLibrary();

    await waitFor(async () => {
      return requests.some(
        (request) =>
          request.method === "GET" &&
          request.url ===
            "/api/explore/item/tmdb/serie/123/lifecycle"
      );
    });

    libraryItem.updatedAt =
      "2026-11-05T10:05:00.000Z";

    releaseLifecycle();

    await waitFor(async () => {
      return requests.some(
        (request) =>
          request.method === "PATCH" &&
          request.url ===
            "/api/library/series-dynamic-1"
      );
    });

    const patchRequest = requests.find(
      (request) =>
        request.method === "PATCH" &&
        request.url ===
          "/api/library/series-dynamic-1"
    );

    assert.equal(
      patchRequest.body.expectedUpdatedAt,
      originalUpdatedAt
    );
  }
);


test(
  "un conflicto del refresco background no repuebla la caché con un snapshot obsoleto",
  async () => {
    let releaseLifecycle;

    const lifecycleGate = new Promise((resolve) => {
      releaseLifecycle = resolve;
    });

    const {
      ApiClient,
      requests,
      libraryItem,
      consoleErrors
    } = loadApiClient({
      lifecycleGate,
      rejectStaleExpectedUpdatedAt: true
    });

    const initialItems = await ApiClient.getLibrary();

    assert.equal(initialItems[0].progress, 100);
    assert.equal(initialItems[0].status, "completed");

    await waitFor(async () => {
      return requests.some(
        (request) =>
          request.method === "GET" &&
          request.url ===
            "/api/explore/item/tmdb/serie/123/lifecycle"
      );
    });

    libraryItem.progress = 50;
    libraryItem.status = "watching";
    libraryItem.updatedAt =
      "2026-11-05T10:05:00.000Z";
    libraryItem.meta = {
      ...libraryItem.meta,
      season: 1,
      episode: 4
    };

    const userUpdate =
      await ApiClient.updateLibraryItem({
        id: libraryItem.id,
        progress: 50,
        status: "watching",
        meta: {
          season: 1,
          episode: 4
        }
      });

    assert.equal(userUpdate.ok, true);
    assert.equal(userUpdate.item.progress, 50);

    const userUpdatedAt =
      userUpdate.item.updatedAt;

    releaseLifecycle();

    await waitFor(async () => {
      return requests.some(
        (request) =>
          request.method === "PATCH" &&
          request.url ===
            "/api/library/series-dynamic-1" &&
          Object.prototype.hasOwnProperty.call(
            request.body || {},
            "expectedUpdatedAt"
          )
      );
    });

    await new Promise((resolve) => setImmediate(resolve));
    await new Promise((resolve) => setImmediate(resolve));

    const snapshot =
      await ApiClient.getLibrary();

    assert.equal(
      snapshot[0].progress,
      50,
      "la caché no debe recuperar el progreso anterior tras un 409"
    );

    assert.equal(
      snapshot[0].status,
      "watching"
    );

    assert.equal(
      snapshot[0].updatedAt,
      userUpdatedAt
    );

    assert.equal(
      consoleErrors.length,
      0,
      "stale_library_update es un conflicto esperado y no debe registrarse como error"
    );
  }
);
