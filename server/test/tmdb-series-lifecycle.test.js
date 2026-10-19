import test from "node:test";
import assert from "node:assert/strict";

test(
  "TMDB conserva el ciclo de vida y los episodios emitido/próximo de una serie",
  async (t) => {
    const originalFetch = globalThis.fetch;
    const originalTmdbKey = process.env.TMDB_API_KEY;

    t.after(() => {
      globalThis.fetch = originalFetch;

      if (originalTmdbKey === undefined) {
        delete process.env.TMDB_API_KEY;
      } else {
        process.env.TMDB_API_KEY = originalTmdbKey;
      }
    });

    process.env.TMDB_API_KEY = "test-key";

    globalThis.fetch = async (url) => {
      const path = new URL(url).pathname;

      if (path === "/3/tv/123") {
        return {
          ok: true,
          async json() {
            return {
              id: 123,
              name: "Serie de prueba",
              original_name: "Serie de prueba",
              first_air_date: "2026-01-01",
              last_air_date: "2026-01-08",
              status: "Returning Series",
              in_production: true,
              number_of_seasons: 2,
              number_of_episodes: 16,
              seasons: [
                {
                  season_number: 1,
                  episode_count: 8,
                  name: "Temporada 1",
                  air_date: "2026-01-01"
                },
                {
                  season_number: 2,
                  episode_count: 8,
                  name: "Temporada 2",
                  air_date: "2026-11-05"
                }
              ],
              last_episode_to_air: {
                season_number: 1,
                episode_number: 8,
                air_date: "2026-01-08"
              },
              next_episode_to_air: {
                season_number: 2,
                episode_number: 1,
                air_date: "2026-11-05"
              },
              genres: [],
              aggregate_credits: {
                cast: []
              },
              created_by: [],
              images: {
                backdrops: []
              },
              videos: {
                results: []
              }
            };
          }
        };
      }

      if (
        path === "/3/tv/123/watch/providers" ||
        path === "/3/tv/123/recommendations"
      ) {
        return {
          ok: true,
          async json() {
            return {
              results: path.endsWith("/recommendations")
                ? []
                : {}
            };
          }
        };
      }

      throw new Error(`unexpected_tmdb_request:${path}`);
    };

    const { getTmdbDetail } = await import(
      `../adapters/tmdb.js?tmdb-series-lifecycle-test=${Date.now()}`
    );

    const detail = await getTmdbDetail({
      type: "serie",
      externalId: "123"
    });

    assert.equal(
      detail.meta.seriesStatus,
      "Returning Series"
    );

    assert.equal(
      detail.meta.inProduction,
      true
    );

    assert.deepEqual(
      detail.meta.lastEpisodeToAir,
      {
        season: 1,
        episode: 8,
        airDate: "2026-01-08"
      }
    );

    assert.deepEqual(
      detail.meta.nextEpisodeToAir,
      {
        season: 2,
        episode: 1,
        airDate: "2026-11-05"
      }
    );
  }
);

test(
  "TMDB obtiene el ciclo de vida de una serie con una sola petición ligera",
  async (t) => {
    const originalFetch = globalThis.fetch;
    const originalTmdbKey = process.env.TMDB_API_KEY;
    const requests = [];

    t.after(() => {
      globalThis.fetch = originalFetch;

      if (originalTmdbKey === undefined) {
        delete process.env.TMDB_API_KEY;
      } else {
        process.env.TMDB_API_KEY = originalTmdbKey;
      }
    });

    process.env.TMDB_API_KEY = "test-key";

    globalThis.fetch = async (url) => {
      const path = new URL(url).pathname;
      requests.push(path);

      if (path !== "/3/tv/123") {
        throw new Error(`unexpected_tmdb_request:${path}`);
      }

      return {
        ok: true,
        async json() {
          return {
            id: 123,
            name: "Serie de prueba",
            last_air_date: "2026-01-08",
            status: "Returning Series",
            in_production: true,
            number_of_seasons: 2,
            number_of_episodes: 16,
            seasons: [
              {
                season_number: 1,
                episode_count: 8,
                name: "Temporada 1",
                air_date: "2026-01-01"
              },
              {
                season_number: 2,
                episode_count: 8,
                name: "Temporada 2",
                air_date: "2026-11-05"
              }
            ],
            last_episode_to_air: {
              season_number: 1,
              episode_number: 8,
              air_date: "2026-01-08"
            },
            next_episode_to_air: {
              season_number: 2,
              episode_number: 1,
              air_date: "2026-11-05"
            }
          };
        }
      };
    };

    const {
      getTmdbSeriesLifecycle
    } = await import(
      `../adapters/tmdb.js?tmdb-series-lifecycle-light-test=${Date.now()}`
    );

    const lifecycle = await getTmdbSeriesLifecycle({
      externalId: "123"
    });

    assert.equal(requests.length, 1);
    assert.deepEqual(requests, ["/3/tv/123"]);

    assert.equal(lifecycle.totalSeasons, 2);
    assert.equal(lifecycle.totalEpisodes, 16);
    assert.equal(lifecycle.seriesStatus, "Returning Series");
    assert.equal(lifecycle.inProduction, true);

    assert.deepEqual(
      lifecycle.seasonBreakdown.map(
        ({ seasonNumber, episodeCount }) => ({
          seasonNumber,
          episodeCount
        })
      ),
      [
        {
          seasonNumber: 1,
          episodeCount: 8
        },
        {
          seasonNumber: 2,
          episodeCount: 8
        }
      ]
    );

    assert.deepEqual(
      lifecycle.lastEpisodeToAir,
      {
        season: 1,
        episode: 8,
        airDate: "2026-01-08"
      }
    );

    assert.deepEqual(
      lifecycle.nextEpisodeToAir,
      {
        season: 2,
        episode: 1,
        airDate: "2026-11-05"
      }
    );
  }
);
