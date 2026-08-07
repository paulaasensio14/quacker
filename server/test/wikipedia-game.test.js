import test from "node:test";
import assert from "node:assert/strict";

import {
  getWikipediaGameDetail,
  searchWikipediaGames
} from "../adapters/wikipedia-game.js";

function okJson(data) {
  return {
    ok: true,
    status: 200,
    json: async () => data
  };
}

test(
  "busca videojuegos y obtiene su portada desde el resumen de Wikipedia",
  { concurrency: false },
  async (t) => {
    const originalFetch = globalThis.fetch;
    const originalTimeout = AbortSignal.timeout;

    const controller = new AbortController();

    let timeoutCalls = 0;
    const receivedSignals = [];

    AbortSignal.timeout = (milliseconds) => {
      assert.equal(milliseconds, 5000);
      timeoutCalls += 1;

      return controller.signal;
    };

    globalThis.fetch = async (
      url,
      options = {}
    ) => {
      receivedSignals.push(options.signal);

      const target = new URL(url);

      if (
        target.hostname === "en.wikipedia.org" &&
        target.pathname === "/w/api.php"
      ) {
        assert.equal(
          target.searchParams.get("generator"),
          "search"
        );

        assert.match(
          target.searchParams.get("gsrsearch"),
          /Little Nightmares.*video game/i
        );

        return okJson({
          query: {
            pages: [
              {
                pageid: 51310184,
                index: 1,
                title: "Little Nightmares",
                extract:
                  "Little Nightmares is a puzzle-platform horror adventure game."
              },
              {
                pageid: 82770187,
                index: 2,
                title: "Little Nightmares (series)",
                extract:
                  "Little Nightmares is a video game series."
              }
            ]
          }
        });
      }

      if (
        target.pathname.includes(
          "/page/summary/Little_Nightmares_(series)"
        )
      ) {
        return okJson({
          pageid: 82770187,
          title: "Little Nightmares (series)",
          description: "Video game series",
          extract:
            "Little Nightmares is a platform-puzzle horror adventure video game series."
        });
      }

      if (
        target.pathname.includes(
          "/page/summary/Little_Nightmares"
        )
      ) {
        return okJson({
          pageid: 51310184,
          title: "Little Nightmares",
          description: "2017 video game",
          extract:
            "Little Nightmares is a puzzle-platform horror adventure game developed by Tarsier Studios.",
          thumbnail: {
            source:
              "https://upload.wikimedia.org/wikipedia/en/d/d8/Little_Nightmares_Box_Art.png"
          }
        });
      }

      throw new Error(
        `unexpected_url:${url}`
      );
    };

    t.after(() => {
      globalThis.fetch = originalFetch;
      AbortSignal.timeout = originalTimeout;
    });

    const items =
      await searchWikipediaGames(
        "Little Nightmares"
      );

    assert.equal(timeoutCalls, 1);
    assert.equal(items.length, 1);

    assert.deepEqual(
      {
        eid: items[0].eid,
        source: items[0].source,
        externalId: items[0].externalId,
        type: items[0].type,
        title: items[0].title,
        releaseDate: items[0].releaseDate,
        cover: items[0].cover,
        year: items[0].meta?.year
      },
      {
        eid:
          "wikipedia_game:game:51310184",
        source: "wikipedia_game",
        externalId: "51310184",
        type: "game",
        title: "Little Nightmares",
        releaseDate: "2017",
        cover:
          "https://upload.wikimedia.org/wikipedia/en/d/d8/Little_Nightmares_Box_Art.png",
        year: 2017
      }
    );

    assert.ok(
      receivedSignals.length >= 2
    );

    assert.ok(
      receivedSignals.every(
        (signal) =>
          signal === controller.signal
      )
    );
  }
);

test(
  "obtiene el detalle de un videojuego por pageid",
  { concurrency: false },
  async (t) => {
    const originalFetch = globalThis.fetch;
    const originalTimeout = AbortSignal.timeout;

    const controller = new AbortController();

    let timeoutCalls = 0;
    let fetchCalls = 0;

    AbortSignal.timeout = (milliseconds) => {
      assert.equal(milliseconds, 5000);
      timeoutCalls += 1;

      return controller.signal;
    };

    globalThis.fetch = async (
      url,
      options = {}
    ) => {
      fetchCalls += 1;

      assert.equal(
        options.signal,
        controller.signal
      );

      const target = new URL(url);

      if (
        target.pathname === "/w/api.php"
      ) {
        assert.equal(
          target.searchParams.get("pageids"),
          "51310184"
        );

        return okJson({
          query: {
            pages: [
              {
                pageid: 51310184,
                title: "Little Nightmares"
              }
            ]
          }
        });
      }

      if (
        target.pathname.includes(
          "/page/summary/Little_Nightmares"
        )
      ) {
        return okJson({
          pageid: 51310184,
          title: "Little Nightmares",
          description: "2017 video game",
          extract:
            "Little Nightmares is a puzzle-platform horror adventure game developed by Tarsier Studios and published by Bandai Namco Entertainment.",
          originalimage: {
            source:
              "https://upload.wikimedia.org/wikipedia/en/d/d8/Little_Nightmares_Box_Art.png"
          }
        });
      }

      throw new Error(
        `unexpected_url:${url}`
      );
    };

    t.after(() => {
      globalThis.fetch = originalFetch;
      AbortSignal.timeout = originalTimeout;
    });

    const item =
      await getWikipediaGameDetail(
        "wikipedia_game:0051310184"
      );

    assert.equal(timeoutCalls, 1);
    assert.equal(fetchCalls, 2);

    assert.equal(
      item.eid,
      "wikipedia_game:game:51310184"
    );

    assert.equal(
      item.source,
      "wikipedia_game"
    );

    assert.equal(
      item.externalId,
      "51310184"
    );

    assert.equal(
      item.type,
      "game"
    );

    assert.equal(
      item.title,
      "Little Nightmares"
    );

    assert.equal(
      item.meta.year,
      2017
    );

    assert.match(
      item.cover,
      /^https:\/\/upload\.wikimedia\.org\//
    );
  }
);

test(
  "cancela una petición Wikipedia tras cinco segundos",
  { concurrency: false },
  async (t) => {
    const originalFetch = globalThis.fetch;
    const originalTimeout = AbortSignal.timeout;

    let configuredTimeout = null;

    AbortSignal.timeout = (milliseconds) => {
      configuredTimeout = milliseconds;

      return AbortSignal.abort(
        new DOMException(
          "The operation was aborted due to timeout",
          "TimeoutError"
        )
      );
    };

    globalThis.fetch = async (
      _url,
      options = {}
    ) => {
      assert.ok(
        options.signal instanceof AbortSignal
      );

      assert.equal(
        options.signal.aborted,
        true
      );

      throw options.signal.reason;
    };

    t.after(() => {
      globalThis.fetch = originalFetch;
      AbortSignal.timeout = originalTimeout;
    });

    await assert.rejects(
      searchWikipediaGames(
        "Little Nightmares"
      ),
      (error) => {
        assert.equal(
          error.message,
          "wikipedia_game_request_timeout"
        );

        assert.equal(
          error.status,
          504
        );

        return true;
      }
    );

    assert.equal(
      configuredTimeout,
      5000
    );
  }
);
