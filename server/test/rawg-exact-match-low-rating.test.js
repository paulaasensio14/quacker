import test from "node:test";
import assert from "node:assert/strict";

import { searchRawg } from "../adapters/rawg.js";

test(
  "conserva una coincidencia exacta con portada aunque RAWG aún no tenga rating",
  async (t) => {
    const originalFetch = globalThis.fetch;
    const originalRawgKey = process.env.RAWG_KEY;

    t.after(() => {
      globalThis.fetch = originalFetch;

      if (originalRawgKey === undefined) {
        delete process.env.RAWG_KEY;
      } else {
        process.env.RAWG_KEY = originalRawgKey;
      }
    });

    process.env.RAWG_KEY = "test-key";

    globalThis.fetch = async (url) => {
      const requestUrl = new URL(url);

      assert.equal(
        requestUrl.searchParams.get("search"),
        "New Indie Game"
      );

      return new Response(
        JSON.stringify({
          results: [
            {
              id: 12345,
              name: "New Indie Game",
              slug: "new-indie-game",
              released: "2026-08-13",
              rating: 0,
              ratings_count: 0,
              background_image:
                "https://example.com/new-indie-game.jpg"
            }
          ]
        }),
        {
          status: 200,
          headers: {
            "content-type": "application/json"
          }
        }
      );
    };

    const results = await searchRawg("New Indie Game");

    assert.equal(results.length, 1);
    assert.equal(results[0].title, "New Indie Game");
    assert.equal(results[0].meta.rating, null);
  }
);
