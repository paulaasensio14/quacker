import assert from "node:assert/strict";
import test from "node:test";

import {
  searchOpenLibrary
} from "../adapters/open-library.js";

test("cancela una petición Open Library tras cinco segundos", async (t) => {
  const originalFetch = globalThis.fetch;
  const originalTimeout = AbortSignal.timeout;

  const controller = new AbortController();
  const timeoutReason = new DOMException(
    "The operation was aborted due to timeout",
    "TimeoutError"
  );

  controller.abort(timeoutReason);

  let configuredTimeout = null;

  AbortSignal.timeout = (milliseconds) => {
    configuredTimeout = milliseconds;
    return controller.signal;
  };

  globalThis.fetch = async (_url, options = {}) => {
    assert.equal(options.signal, controller.signal);
    assert.equal(options.signal.aborted, true);

    throw options.signal.reason;
  };

  t.after(() => {
    globalThis.fetch = originalFetch;
    AbortSignal.timeout = originalTimeout;
  });

  await assert.rejects(
    () => searchOpenLibrary("timeout probe"),
    (error) => {
      assert.equal(
        error.message,
        "open_library_request_timeout"
      );

      assert.equal(error.status, 504);
      return true;
    }
  );

  assert.equal(configuredTimeout, 5000);
});

test("mantiene un único presupuesto de timeout durante reintentos", async (t) => {
  const originalFetch = globalThis.fetch;
  const originalTimeout = AbortSignal.timeout;

  const controller = new AbortController();

  let timeoutCalls = 0;
  let fetchCalls = 0;

  const receivedSignals = [];

  AbortSignal.timeout = (milliseconds) => {
    assert.equal(milliseconds, 5000);
    timeoutCalls += 1;

    return controller.signal;
  };

  globalThis.fetch = async (_url, options = {}) => {
    fetchCalls += 1;
    receivedSignals.push(options.signal);

    if (fetchCalls === 1) {
      return {
        ok: false,
        status: 503,
        text: async () => ""
      };
    }

    return {
      ok: true,
      status: 200,
      json: async () => ({
        docs: []
      })
    };
  };

  t.after(() => {
    globalThis.fetch = originalFetch;
    AbortSignal.timeout = originalTimeout;
  });

  const result = await searchOpenLibrary(
    "open library retry budget probe"
  );

  assert.deepEqual(result, []);
  assert.equal(fetchCalls, 2);
  assert.equal(timeoutCalls, 1);

  assert.equal(
    receivedSignals[0],
    controller.signal
  );

  assert.equal(
    receivedSignals[1],
    controller.signal
  );
});
