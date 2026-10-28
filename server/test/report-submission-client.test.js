import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const source = fs.readFileSync(
  new URL(
    "../../assets/js/app/report-submission.js",
    import.meta.url
  ),
  "utf8"
);

function harness({
  status = 201,
  response = { ok: true, reportId: "report_123" },
  retryAfter = null
} = {}) {
  const requests = [];
  const context = {
    window: {},
    async fetch(url, options) {
      requests.push({ url, options });

      return {
        ok: status >= 200 && status < 300,
        status,
        headers: {
          get(name) {
            return name === "Retry-After"
              ? retryAfter
              : null;
          }
        },
        async json() {
          return response;
        }
      };
    }
  };

  vm.runInNewContext(
    source,
    context,
    { filename: "report-submission.js" }
  );

  return {
    api: context.window.QuackerReports,
    requests
  };
}

test("envía una denuncia de perfil con sesión", async () => {
  const h = harness();

  const result = await h.api.submit({
    username: " @bob ",
    kind: "user",
    reason: "harassment",
    details: "  Mensajes ofensivos  ",
    reporterUserId: "falsificado",
    status: "resolved"
  });

  assert.equal(result.ok, true);
  assert.equal(result.reportId, "report_123");
  assert.equal(h.requests.length, 1);

  const request = h.requests[0];

  assert.equal(request.url, "/api/user/reports");
  assert.equal(request.options.method, "POST");
  assert.equal(
    request.options.credentials,
    "same-origin"
  );

  const body = JSON.parse(request.options.body);

  assert.deepEqual(body, {
    username: "bob",
    kind: "user",
    reason: "harassment",
    details: "Mensajes ofensivos"
  });
});

test("envía identidad canónica de la reseña", async () => {
  const h = harness();

  await h.api.submit({
    username: "bob",
    kind: "review",
    reason: "spoilers",
    reviewIdentity: {
      source: "tmdb",
      contentType: "pelicula",
      externalId: "603"
    }
  });

  const body = JSON.parse(
    h.requests[0].options.body
  );

  assert.deepEqual(body.reviewIdentity, {
    source: "tmdb",
    contentType: "pelicula",
    externalId: "603"
  });

  assert.equal(body.kind, "review");
  assert.equal(body.reason, "spoilers");
});

test("rechaza datos inválidos sin usar la red", async () => {
  const h = harness();

  const invalid = [
    { username: "", kind: "user", reason: "spam" },
    { username: "bob", kind: "admin", reason: "spam" },
    { username: "bob", kind: "user", reason: "spoilers" },
    {
      username: "bob",
      kind: "user",
      reason: "spam",
      details: "x".repeat(501)
    },
    {
      username: "bob",
      kind: "user",
      reason: "spam",
      details: { invalid: true }
    }
  ];

  for (const input of invalid) {
    await assert.rejects(
      h.api.submit(input),
      (error) => error.status === 400
    );
  }

  assert.equal(h.requests.length, 0);
});

test("una reseña necesita identidad completa", async () => {
  const h = harness();

  await assert.rejects(
    h.api.submit({
      username: "bob",
      kind: "review",
      reason: "spam",
      reviewIdentity: {
        source: "tmdb",
        contentType: "pelicula"
      }
    }),
    (error) =>
      error.error === "invalid_report_review"
  );

  assert.equal(h.requests.length, 0);
});

test("reconoce denuncias duplicadas", async () => {
  const h = harness({
    status: 409,
    response: {
      error: "report_already_exists"
    }
  });

  await assert.rejects(
    h.api.submit({
      username: "bob",
      kind: "user",
      reason: "spam"
    }),
    (error) =>
      error.status === 409 &&
      error.error === "report_already_exists"
  );
});

test("conserva los segundos de espera del límite", async () => {
  const h = harness({
    status: 429,
    retryAfter: "42",
    response: {
      error: "moderation_report_rate_limited"
    }
  });

  await assert.rejects(
    h.api.submit({
      username: "bob",
      kind: "user",
      reason: "spam"
    }),
    (error) =>
      error.status === 429 &&
      error.retryAfterSeconds === 42
  );
});

test("rechaza respuestas de éxito incorrectas", async () => {
  const h = harness({
    status: 201,
    response: { ok: true }
  });

  await assert.rejects(
    h.api.submit({
      username: "bob",
      kind: "user",
      reason: "spam"
    }),
    (error) =>
      error.status === 502 &&
      error.error === "invalid_report_response"
  );
});
