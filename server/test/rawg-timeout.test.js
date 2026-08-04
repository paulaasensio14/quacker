import test from "node:test";
import assert from "node:assert/strict";

import { searchRawg } from "../adapters/rawg.js";

test(
  "cancela una petición RAWG tras cinco segundos",
  async (t) => {
    const originalFetch = globalThis.fetch;
    const originalTimeout = AbortSignal.timeout;
    const originalRawgKey = process.env.RAWG_KEY;

    t.after(() => {
      globalThis.fetch = originalFetch;
      AbortSignal.timeout = originalTimeout;

      if (originalRawgKey === undefined) {
        delete process.env.RAWG_KEY;
      } else {
        process.env.RAWG_KEY = originalRawgKey;
      }
    });

    process.env.RAWG_KEY = "test-key";

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
      assert.ok(options.signal instanceof AbortSignal);
      assert.equal(options.signal.aborted, true);

      throw options.signal.reason;
    };

    await assert.rejects(
      searchRawg("dune"),
      (error) => {
        assert.equal(error.message, "rawg_request_timeout");
        assert.equal(error.status, 504);
        return true;
      }
    );

    assert.equal(configuredTimeout, 5000);
  }
);
