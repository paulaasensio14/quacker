import test from "node:test";
import assert from "node:assert/strict";
import {
  buildProviderDiagnostic
} from "../lib/provider-diagnostics.js";

test("genera un diagnóstico HTTP sin incluir el mensaje del proveedor", () => {
  const error = new Error(
    "rawg_http_503: contenido remoto que no debe registrarse"
  );
  error.status = 503;

  const diagnostic = buildProviderDiagnostic({
    provider: "rawg",
    operation: "search",
    error,
    durationMs: 124.6
  });

  assert.deepEqual(diagnostic, {
    provider: "rawg",
    operation: "search",
    kind: "http",
    status: 503,
    networkCode: null,
    durationMs: 125
  });

  assert.equal(
    JSON.stringify(diagnostic).includes("contenido remoto"),
    false
  );
});

test("clasifica los timeouts como timeout", () => {
  const error = new Error("tmdb_request_timeout");
  error.status = 504;

  assert.deepEqual(
    buildProviderDiagnostic({
      provider: "tmdb",
      operation: "search",
      error
    }),
    {
      provider: "tmdb",
      operation: "search",
      kind: "timeout",
      status: 504,
      networkCode: null,
      durationMs: null
    }
  );
});

test("conserva únicamente códigos de red seguros", () => {
  const error = new Error("fetch failed");
  error.cause = {
    code: "ECONNRESET"
  };

  assert.deepEqual(
    buildProviderDiagnostic({
      provider: "open_library",
      operation: "weekly",
      error
    }),
    {
      provider: "open_library",
      operation: "weekly",
      kind: "network",
      status: null,
      networkCode: "ECONNRESET",
      durationMs: null
    }
  );
});

test("clasifica una clave API ausente como configuración", () => {
  const error = new Error("rawg_api_key_missing");
  error.status = 500;

  assert.equal(
    buildProviderDiagnostic({
      provider: "rawg",
      operation: "search",
      error
    }).kind,
    "configuration"
  );
});

test("no expone propiedades arbitrarias del error", () => {
  const error = new Error("provider secret body");
  error.url = "https://example.test/?key=secret";
  error.responseBody = "sensitive payload";

  const diagnostic = buildProviderDiagnostic({
    provider: "wikipedia",
    operation: "detail",
    error
  });

  const serialized = JSON.stringify(diagnostic);

  assert.equal(serialized.includes("secret"), false);
  assert.equal(serialized.includes("sensitive"), false);
  assert.equal(serialized.includes("example.test"), false);
});
