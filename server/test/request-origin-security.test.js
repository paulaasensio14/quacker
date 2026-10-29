import test from "node:test";
import assert from "node:assert/strict";

import {
  getAllowedRequestOrigins,
  isRequestOriginAllowed
} from "../lib/request-origin-security.js";

const allowedOrigins = [
  "https://quacker.es",
  "https://www.quacker.es",
  "http://127.0.0.1:3200"
];

function check(options) {
  return isRequestOriginAllowed({
    allowedOrigins,
    targetOrigin: options.origin,
    ...options
  });
}

test("permite métodos de lectura", () => {
  for (const method of ["GET", "HEAD", "OPTIONS"]) {
    assert.equal(
      check({
        method,
        origin: "https://evil.example",
        fetchSite: "cross-site"
      }),
      true
    );
  }
});

test("permite escrituras desde orígenes autorizados", () => {
  for (const method of ["POST", "PATCH", "PUT", "DELETE"]) {
    assert.equal(
      check({
        method,
        origin: "https://quacker.es",
        fetchSite: "same-origin"
      }),
      true
    );
  }
});

test("permite el dominio con www", () => {
  assert.equal(
    check({
      method: "POST",
      origin: "https://www.quacker.es",
      fetchSite: "same-origin"
    }),
    true
  );
});

test("permite el origen local de desarrollo", () => {
  assert.equal(
    check({
      method: "PATCH",
      origin: "http://127.0.0.1:3200",
      fetchSite: "same-origin"
    }),
    true
  );
});

test("rechaza orígenes externos", () => {
  assert.equal(
    check({
      method: "POST",
      origin: "https://evil.example",
      fetchSite: "same-origin"
    }),
    false
  );
});

test("rechaza solicitudes cross-site", () => {
  assert.equal(
    check({
      method: "DELETE",
      origin: "https://quacker.es",
      fetchSite: "cross-site"
    }),
    false
  );
});

test("rechaza orígenes malformados", () => {
  for (const origin of [
    "null",
    "javascript:alert(1)",
    "https://evil.example/path",
    "https://quacker.es.evil.example",
    "https://quacker.es@evil.example",
    "https://quacker.es:444"
  ]) {
    assert.equal(
      check({
        method: "POST",
        origin,
        fetchSite: "same-origin"
      }),
      false,
      `Se debe rechazar: ${origin}`
    );
  }
});

test("rechaza valores de Fetch Metadata desconocidos", () => {
  assert.equal(
    check({
      method: "POST",
      origin: "https://quacker.es",
      fetchSite: "invalid-value"
    }),
    false
  );
});

test("rechaza escrituras sin señales de origen", () => {
  assert.equal(
    check({
      method: "POST"
    }),
    false
  );
});

test("rechaza Fetch Metadata same-origin sin Origin", () => {
  assert.equal(
    check({
      method: "POST",
      fetchSite: "same-origin"
    }),
    false
  );
});

test("rechaza escrituras same-site", () => {
  assert.equal(
    check({
      method: "POST",
      origin: "https://quacker.es",
      fetchSite: "same-site"
    }),
    false
  );
});

test("rechaza Fetch Metadata none en escrituras", () => {
  assert.equal(
    check({
      method: "POST",
      origin: "https://quacker.es",
      fetchSite: "none"
    }),
    false
  );
});

test("rechaza origin vacío", () => {
  assert.equal(
    check({
      method: "POST",
      origin: ""
    }),
    false
  );
});

test("configura exclusivamente los orígenes HTTPS de producción", () => {
  assert.deepEqual(
    getAllowedRequestOrigins({
      environment: "production",
      port: 3200
    }),
    [
      "https://quacker.es",
      "https://www.quacker.es"
    ]
  );
});

test("configura el puerto del servidor temporal", () => {
  assert.deepEqual(
    getAllowedRequestOrigins({
      environment: "test",
      port: 45678
    }),
    [
      "http://127.0.0.1:45678",
      "http://localhost:45678"
    ]
  );
});

test("rechaza puertos locales inválidos", () => {
  for (const port of [0, -1, 65536, "invalid"]) {
    assert.throws(
      () => getAllowedRequestOrigins({
        environment: "test",
        port
      }),
      /INVALID_ORIGIN_PORT/
    );
  }
});

test("producción no autoriza orígenes HTTP locales", () => {
  const productionOrigins = getAllowedRequestOrigins({
    environment: "production",
    port: 3000
  });

  assert.equal(
    isRequestOriginAllowed({
      method: "POST",
      origin: "http://127.0.0.1:3000",
      allowedOrigins: productionOrigins
    }),
    false
  );
});

test("localhost funciona exclusivamente fuera de producción", () => {
  const developmentOrigins = getAllowedRequestOrigins({
    environment: "development",
    port: 3000
  });

  const productionOrigins = getAllowedRequestOrigins({
    environment: "production",
    port: 3000
  });

  const request = {
    method: "POST",
    origin: "http://localhost:3000",
    targetOrigin: "http://localhost:3000",
    fetchSite: "same-origin"
  };

  assert.equal(
    isRequestOriginAllowed({
      ...request,
      allowedOrigins: developmentOrigins
    }),
    true
  );

  assert.equal(
    isRequestOriginAllowed({
      ...request,
      allowedOrigins: productionOrigins
    }),
    false
  );
});

test("rechaza entornos de ejecución desconocidos", () => {
  for (const environment of [
    "staging",
    "invalid",
    "",
    undefined,
    null
  ]) {
    assert.throws(
      () => getAllowedRequestOrigins({
        environment,
        port: 3000
      }),
      /INVALID_ORIGIN_ENVIRONMENT/
    );
  }
});

test("mantiene autorizados los entornos de desarrollo y prueba", () => {
  for (const environment of [
    "development",
    "test"
  ]) {
    assert.deepEqual(
      getAllowedRequestOrigins({
        environment,
        port: 3000
      }),
      [
        "http://127.0.0.1:3000",
        "http://localhost:3000"
      ]
    );
  }
});

test("exige coincidencia exacta entre origen y destino", () => {
  const origins = getAllowedRequestOrigins({
    environment: "production",
    port: 3000
  });

  assert.equal(
    isRequestOriginAllowed({
      method: "POST",
      origin: "https://quacker.es",
      targetOrigin: "https://quacker.es",
      fetchSite: "same-origin",
      allowedOrigins: origins
    }),
    true
  );

  assert.equal(
    isRequestOriginAllowed({
      method: "POST",
      origin: "https://www.quacker.es",
      targetOrigin: "https://quacker.es",
      fetchSite: "same-site",
      allowedOrigins: origins
    }),
    false
  );

  assert.equal(
    isRequestOriginAllowed({
      method: "POST",
      origin: "https://quacker.es",
      targetOrigin: "https://www.quacker.es",
      fetchSite: "same-site",
      allowedOrigins: origins
    }),
    false
  );
});

test("rechaza destinos no autorizados", () => {
  const origins = getAllowedRequestOrigins({
    environment: "production",
    port: 3000
  });

  assert.equal(
    isRequestOriginAllowed({
      method: "PATCH",
      origin: "https://quacker.es",
      targetOrigin: "https://evil.example",
      allowedOrigins: origins
    }),
    false
  );
});

test("rechaza escritura sin destino", () => {
  assert.equal(
    check({
      method: "POST",
      origin: "https://quacker.es",
      targetOrigin: undefined,
      fetchSite: "same-origin"
    }),
    false
  );

  assert.equal(
    check({
      method: "PATCH",
      origin: "https://quacker.es",
      targetOrigin: null,
      fetchSite: "same-origin"
    }),
    false
  );
});
