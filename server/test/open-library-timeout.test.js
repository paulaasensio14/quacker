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

test("no envía a Open Library consultas sin tokens buscables", async (t) => {
  const originalFetch = globalThis.fetch;
  let fetchCalls = 0;

  globalThis.fetch = async () => {
    fetchCalls += 1;
    throw new Error("fetch no debería ejecutarse");
  };

  t.after(() => {
    globalThis.fetch = originalFetch;
  });

  for (const query of ["O", "Ob", "The"]) {
    const result = await searchOpenLibrary(query);
    assert.deepEqual(result, []);
  }

  assert.equal(fetchCalls, 0);
});

test("trata como vacío un 422 esperado de validación de Open Library", async (t) => {
  const originalFetch = globalThis.fetch;
  let fetchCalls = 0;

  globalThis.fetch = async () => {
    fetchCalls += 1;

    return {
      ok: false,
      status: 422,
      text: async () => "Query too short, must be at least 3 characters"
    };
  };

  t.after(() => {
    globalThis.fetch = originalFetch;
  });

  const result = await searchOpenLibrary(
    "open library validation probe"
  );

  assert.deepEqual(result, []);
  assert.equal(fetchCalls, 1);
});

test("reintenta una vez un ECONNRESET transitorio de Open Library", async (t) => {
  const originalFetch = globalThis.fetch;
  const originalTimeout = AbortSignal.timeout;

  const controller = new AbortController();

  let fetchCalls = 0;
  let timeoutCalls = 0;

  AbortSignal.timeout = (milliseconds) => {
    assert.equal(milliseconds, 5000);
    timeoutCalls += 1;
    return controller.signal;
  };

  globalThis.fetch = async () => {
    fetchCalls += 1;

    if (fetchCalls === 1) {
      const cause = new Error("read ECONNRESET");
      cause.code = "ECONNRESET";

      const error = new TypeError("fetch failed");
      error.cause = cause;

      throw error;
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
    "open library econnreset retry probe"
  );

  assert.deepEqual(result, []);
  assert.equal(fetchCalls, 2);
  assert.equal(timeoutCalls, 1);
});

test("Open Library respeta una cancelación externa", async (t) => {
  const originalFetch = globalThis.fetch;
  const originalTimeout = AbortSignal.timeout;

  const timeoutController = new AbortController();
  const externalController = new AbortController();

  AbortSignal.timeout = (milliseconds) => {
    assert.equal(milliseconds, 5000);
    return timeoutController.signal;
  };

  globalThis.fetch = async (_url, options = {}) => {
    assert.ok(options.signal instanceof AbortSignal);

    externalController.abort(
      new DOMException(
        "Client disconnected",
        "AbortError"
      )
    );

    await new Promise((resolve) => setTimeout(resolve, 0));

    assert.equal(
      options.signal.aborted,
      true,
      "la señal enviada a fetch debe abortarse al cancelar la señal externa"
    );

    throw options.signal.reason;
  };

  t.after(() => {
    globalThis.fetch = originalFetch;
    AbortSignal.timeout = originalTimeout;
  });

  await assert.rejects(
    () =>
      searchOpenLibrary(
        "open library external abort probe",
        { signal: externalController.signal }
      ),
    (error) => {
      assert.equal(error?.name, "AbortError");
      return true;
    }
  );
});
