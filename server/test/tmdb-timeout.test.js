import test from "node:test";
import assert from "node:assert/strict";

test(
  "cancela una petición TMDB tras cinco segundos",
  async (t) => {
    const originalFetch = globalThis.fetch;
    const originalTimeout = AbortSignal.timeout;
    const originalTmdbKey = process.env.TMDB_API_KEY;

    t.after(() => {
      globalThis.fetch = originalFetch;
      AbortSignal.timeout = originalTimeout;

      if (originalTmdbKey === undefined) {
        delete process.env.TMDB_API_KEY;
      } else {
        process.env.TMDB_API_KEY = originalTmdbKey;
      }
    });

    // Clave ficticia solo para superar la validación del adapter.
    process.env.TMDB_API_KEY = "test-key";

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

    globalThis.fetch = async (_url, options = {}) => {
      assert.ok(
        options.signal instanceof AbortSignal,
        "TMDB debe enviar AbortSignal al fetch"
      );

      assert.equal(options.signal.aborted, true);

      throw options.signal.reason;
    };

    // Import dinámico después de fijar la clave ficticia para que ENV
    // se inicialice dentro de este test sin depender de credenciales reales.
    const { getTmdbSeasonDetail } = await import(
      `../adapters/tmdb.js?tmdb-timeout-test=${Date.now()}`
    );

    await assert.rejects(
      getTmdbSeasonDetail({
        externalId: "123",
        seasonNumber: 1
      }),
      (error) => {
        assert.equal(error.message, "tmdb_request_timeout");
        assert.equal(error.status, 504);
        return true;
      }
    );

    assert.equal(configuredTimeout, 5000);
  }
);
