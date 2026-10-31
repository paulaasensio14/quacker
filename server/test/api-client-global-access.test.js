import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const apiSource = fs.readFileSync(
  new URL("../../assets/js/data/api-client.js", import.meta.url),
  "utf8"
);

test("ApiClient queda disponible en window", () => {
  const window = {
    location: {
      hostname: "127.0.0.1",
      port: "3300",
      protocol: "http:"
    }
  };

  const context = {
    window,
    document: {
      dispatchEvent() {}
    },
    AbortController,
    setTimeout,
    clearTimeout,
    console
  };

  vm.runInNewContext(apiSource, context);

  assert.equal(
    typeof window.ApiClient?.setTransport,
    "function"
  );

  assert.equal(
    window.ApiClient.getTransportInfo().transport,
    "local"
  );
});
