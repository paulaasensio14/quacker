import test from "node:test";
import assert from "node:assert/strict";

import {
  SECURITY_HEADERS,
  applySecurityHeaders
} from "../lib/security-headers.js";

test(
  "define las cabeceras de seguridad esperadas",
  () => {
    assert.equal(
      SECURITY_HEADERS["X-Content-Type-Options"],
      "nosniff"
    );

    assert.equal(
      SECURITY_HEADERS["X-Frame-Options"],
      "DENY"
    );

    assert.equal(
      SECURITY_HEADERS["Referrer-Policy"],
      "strict-origin-when-cross-origin"
    );

    assert.match(
      SECURITY_HEADERS["Permissions-Policy"],
      /camera=\(\)/
    );

    assert.match(
      SECURITY_HEADERS["Permissions-Policy"],
      /microphone=\(\)/
    );
  }
);

test(
  "aplica las cabeceras y continúa la petición",
  () => {
    const headers = new Map();
    let nextCalls = 0;

    const response = {
      setHeader(name, value) {
        headers.set(name, value);
      }
    };

    applySecurityHeaders(
      {},
      response,
      () => {
        nextCalls += 1;
      }
    );

    for (const [name, value] of Object.entries(
      SECURITY_HEADERS
    )) {
      assert.equal(headers.get(name), value);
    }

    assert.equal(nextCalls, 1);
  }
);
