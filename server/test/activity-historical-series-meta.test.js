import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import vm from "node:vm";

function createJsonResponse(body) {
  return {
    ok: true,
    status: 200,
    async text() {
      return JSON.stringify(body);
    }
  };
}

function loadApiClient() {
  const source = fs.readFileSync(
    new URL("../../assets/js/data/api-client.js", import.meta.url),
    "utf8"
  );

  const library = [
    {
      id: "series-1",
      type: "serie",
      title: "Serie de prueba",
      status: "watching",
      progress: 50,
      meta: {
        season: 4,
        episode: 3
      }
    }
  ];

  const activities = [
    {
      id: "activity-1",
      type: "progress",
      targetType: "library_item",
      targetId: "series-1",
      createdAt: "2026-08-10T12:00:00.000Z",
      payload: {
        season: 4,
        episode: 2
      }
    }
  ];

  const context = {
    window: {
      location: {
        hostname: "quacker.test",
        port: "",
        protocol: "https:",
        pathname: "/dashboard.html",
        href: "/dashboard.html"
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
    console,
    URLSearchParams,
    AbortController,
    setTimeout,
    clearTimeout,
    structuredClone,
    fetch: async (url) => {
      const safeUrl = String(url);

      if (safeUrl.startsWith("/api/library")) {
        return createJsonResponse({ items: library });
      }

      if (safeUrl.startsWith("/api/activities")) {
        return createJsonResponse({ activities });
      }

      throw new Error(`Unexpected URL: ${safeUrl}`);
    }
  };

  vm.createContext(context);
  vm.runInContext(
    `${source}\n;globalThis.__ApiClientForTest = ApiClient;`,
    context,
    { filename: "assets/js/data/api-client.js" }
  );

  return context.__ApiClientForTest;
}

test(
  "Actividad histórica de una serie conserva temporada y episodio del payload",
  async () => {
    const ApiClient = loadApiClient();

    const activities = await ApiClient.getRecentActivitiesDetailed(40, "all");

    assert.equal(activities.length, 1);
    assert.equal(activities[0].itemMeta, "T4 · E2");
  }
);
