import test from "node:test";
import assert from "node:assert/strict";
import {
  searchRawg
} from "../adapters/rawg.js";
import {
  searchOpenLibrary
} from "../adapters/open-library.js";

test("RAWG conserva el status HTTP sin incluir el body remoto", async (t) => {
  const originalFetch = globalThis.fetch;
  const originalRawgKey = process.env.RAWG_KEY;

  process.env.RAWG_KEY = "test-key";

  globalThis.fetch = async () => ({
    ok: false,
    status: 418,
    text: async () => "remote body secret"
  });

  t.after(() => {
    globalThis.fetch = originalFetch;

    if (originalRawgKey === undefined) {
      delete process.env.RAWG_KEY;
    } else {
      process.env.RAWG_KEY = originalRawgKey;
    }
  });

  await assert.rejects(
    searchRawg("dune"),
    (error) => {
      assert.equal(error.status, 418);
      assert.equal(error.message, "rawg_http_418");
      assert.equal(
        error.message.includes("remote body secret"),
        false
      );
      return true;
    }
  );
});

test("Open Library conserva el status HTTP sin incluir el body remoto", async (t) => {
  const originalFetch = globalThis.fetch;

  globalThis.fetch = async () => ({
    ok: false,
    status: 418,
    text: async () => "remote body secret"
  });

  t.after(() => {
    globalThis.fetch = originalFetch;
  });

  await assert.rejects(
    searchOpenLibrary("dune"),
    (error) => {
      assert.equal(error.status, 418);
      assert.equal(
        error.message,
        "open_library_request_failed:418"
      );
      assert.equal(
        error.message.includes("remote body secret"),
        false
      );
      return true;
    }
  );
});
