import test from "node:test";
import assert from "node:assert/strict";

import {
  CONTENT_SECURITY_POLICY_REPORT_ONLY,
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
  "define una política CSP restrictiva en modo report-only",
  () => {
    const directives = new Map(
      CONTENT_SECURITY_POLICY_REPORT_ONLY
        .split(";")
        .map((entry) => entry.trim())
        .filter(Boolean)
        .map((entry) => {
          const separator = entry.indexOf(" ");

          if (separator === -1) {
            return [entry, ""];
          }

          return [
            entry.slice(0, separator),
            entry.slice(separator + 1)
          ];
        })
    );

    assert.equal(
      SECURITY_HEADERS[
        "Content-Security-Policy-Report-Only"
      ],
      CONTENT_SECURITY_POLICY_REPORT_ONLY
    );

    assert.equal(
      directives.get("script-src"),
      "'self' 'report-sample'"
    );

    assert.equal(
      directives.get("script-src-attr"),
      "'none'"
    );

    assert.doesNotMatch(
      directives.get("style-src"),
      /'unsafe-inline'/
    );

    assert.match(
      directives.get("style-src"),
      /https:\/\/fonts\.googleapis\.com/
    );

    assert.equal(
      directives.get("font-src"),
      "'self' https://fonts.gstatic.com"
    );

    assert.match(
      directives.get("img-src"),
      /https:\/\/image\.tmdb\.org/
    );

    assert.match(
      directives.get("img-src"),
      /https:\/\/media\.rawg\.io/
    );

    assert.match(
      directives.get("img-src"),
      /https:\/\/covers\.openlibrary\.org/
    );

    assert.match(
      directives.get("img-src"),
      /https:\/\/upload\.wikimedia\.org/
    );

    assert.match(
      directives.get("img-src"),
      /https:\/\/books\.google\.com/
    );

    assert.match(
      directives.get("img-src"),
      /https:\/\/archive\.org/
    );

    assert.match(
      directives.get("img-src"),
      /https:\/\/\*\.us\.archive\.org/
    );

    assert.doesNotMatch(
      directives.get("script-src"),
      /'unsafe-inline'/
    );

    assert.match(
      directives.get("img-src"),
      /\bdata:/
    );

    assert.doesNotMatch(
      directives.get("img-src"),
      /\bblob:/
    );

    assert.equal(
      directives.get("object-src"),
      "'none'"
    );

    assert.equal(
      directives.get("frame-ancestors"),
      "'none'"
    );

    assert.equal(
      directives.get("connect-src"),
      "'self'"
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
