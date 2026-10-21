import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const source = fs.readFileSync(
  new URL(
    "../../assets/js/data/api-client.js",
    import.meta.url
  ),
  "utf8"
);

function createHarness({
  status = 200,
  body = {}
} = {}) {
  const requests = [];

  const window = {
    location: {
      hostname: "quacker.es",
      port: "",
      protocol: "https:",
      pathname: "/dashboard.html",
      href: "/dashboard.html"
    }
  };

  const context = {
    window,
    document: {
      dispatchEvent() {
        return true;
      }
    },
    AbortController,
    setTimeout,
    clearTimeout,
    console,
    async fetch(url, options = {}) {
      requests.push({ url, options });

      return {
        status,
        ok: status >= 200 && status < 300,
        async text() {
          return JSON.stringify(body);
        }
      };
    }
  };

  vm.runInNewContext(
    source + "\nglobalThis.__testClient = ApiClient;",
    context,
    { filename: "api-client.js" }
  );

  return {
    api: context.__testClient,
    requests
  };
}

test("consulta permisos sin descargar denuncias", async () => {
  const h = createHarness({
    body: { isModerator: true }
  });

  const access = await h.api.getModeratorAccess();

  assert.equal(access.isModerator, true);
  assert.equal(h.requests.length, 1);
  assert.equal(h.requests[0].url, "/api/moderation/access");
  assert.equal(h.requests[0].options.method, "GET");
  assert.equal(
    h.requests[0].options.credentials,
    "include"
  );
});

test("solo acepta isModerator booleano verdadero", async () => {
  const h = createHarness({
    body: { isModerator: "true" }
  });

  const access = await h.api.getModeratorAccess();

  assert.equal(access.isModerator, false);
});

test("el modo local nunca concede permisos", async () => {
  const h = createHarness();

  h.api.setTransport("local");

  const access = await h.api.getModeratorAccess();

  assert.equal(access.isModerator, false);
  assert.equal(h.requests.length, 0);
});

test("consulta la bandeja usando sesión HTTP", async () => {
  const h = createHarness({
    body: {
      totalPending: 1,
      reports: [{ id: "report_1" }]
    }
  });

  const result = await h.api.getModerationReports();

  assert.equal(result.totalPending, 1);
  assert.equal(result.reports.length, 1);
  assert.equal(result.reports[0].id, "report_1");
  assert.equal(
    h.requests[0].url,
    "/api/moderation/reports"
  );
  assert.equal(h.requests[0].options.method, "GET");
});

test("normaliza respuestas inválidas de la bandeja", async () => {
  const h = createHarness({
    body: {
      totalPending: "999",
      reports: "incorrecto"
    }
  });

  const result = await h.api.getModerationReports();

  assert.equal(result.totalPending, 0);
  assert.equal(result.reports.length, 0);
});

test("envía decisiones con campos permitidos", async () => {
  const h = createHarness({
    body: {
      ok: true,
      reportId: "report_1",
      status: "resolved"
    }
  });

  const result = await h.api.decideModerationReport(
    " report_1 ",
    " RESOLVE ",
    "  Revisado  "
  );

  assert.equal(result.status, "resolved");

  const request = h.requests[0];

  assert.equal(
    request.url,
    "/api/moderation/reports/report_1/decision"
  );

  assert.equal(request.options.method, "POST");

  assert.deepEqual(
    JSON.parse(request.options.body),
    {
      action: "resolve",
      notes: "Revisado"
    }
  );

  assert.equal(request.options.credentials, "include");
});

test("rechaza acciones e identificadores inválidos", async () => {
  const h = createHarness();

  for (const [id, action, notes] of [
    ["../report_1", "resolve", ""],
    ["report_1", "ban", ""],
    ["report_1", "resolve", "x".repeat(501)],
    ["report_1", "resolve", { text: "falso" }]
  ]) {
    await assert.rejects(
      h.api.decideModerationReport(id, action, notes),
      (error) => error.status === 400
    );
  }

  assert.equal(h.requests.length, 0);
});

test("un servidor que deniega acceso no devuelve denuncias", async () => {
  const h = createHarness({
    status: 403,
    body: {
      error: "forbidden"
    }
  });

  await assert.rejects(
    h.api.getModerationReports(),
    (error) =>
      error.status === 403 &&
      error.error === "forbidden"
  );
});

test("el modo local no admite moderación", async () => {
  const h = createHarness();

  h.api.setTransport("local");

  await assert.rejects(
    h.api.getModerationReports(),
    (error) => error.status === 501
  );

  await assert.rejects(
    h.api.decideModerationReport(
      "report_1",
      "resolve"
    ),
    (error) => error.status === 501
  );

  assert.equal(h.requests.length, 0);
});
