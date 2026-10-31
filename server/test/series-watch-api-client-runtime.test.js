import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const source = fs.readFileSync(
  new URL("../../assets/js/data/api-client.js", import.meta.url),
  "utf8"
);

function extractFunction(name) {
  const marker = `  async function ${name}(`;
  const start = source.indexOf(marker);

  assert.ok(start >= 0, `Falta ${name}`);

  const end = source.indexOf("\n  async function ", start + marker.length);
  assert.ok(end > start, `No se encontró el final de ${name}`);

  return source.slice(start, end);
}

const episodeFunction = extractFunction("setSeriesEpisodeWatched");
const seasonFunction = extractFunction("setSeriesSeasonWatched");

function createClient({
  http = true,
  requestResult = { ok: true, item: { id: "serie-1" } },
  requestError = null
} = {}) {
  const requests = [];
  const notifications = [];

  const factory = Function(
    "_normalizeDataId",
    "_isHttp",
    "_httpJson",
    "_emitDataChanged",
    `${episodeFunction}
     ${seasonFunction}
     return { setSeriesEpisodeWatched, setSeriesSeasonWatched };`
  );

  const client = factory(
    (id) => String(id ?? "").trim(),
    () => http,
    async (method, path, body) => {
      requests.push({ method, path, body });

      if (requestError) throw requestError;

      return requestResult;
    },
    (detail) => notifications.push(detail)
  );

  return { client, requests, notifications };
}

test("QA-02-002: episodio envía PUT con concurrencia", async () => {
  const { client, requests, notifications } = createClient();

  const result = await client.setSeriesEpisodeWatched({
    itemId: "serie/1",
    season: 2,
    episode: 5,
    watched: true,
    expectedUpdatedAt: "2026-10-30T12:00:00.000Z"
  });

  assert.equal(result.ok, true);
  assert.deepEqual(requests, [{
    method: "PUT",
    path: "/library/serie%2F1/episodes/2/5",
    body: {
      watched: true,
      expectedUpdatedAt: "2026-10-30T12:00:00.000Z"
    }
  }]);

  assert.equal(notifications.length, 2);
  assert.equal(notifications[0].kind, "library");
  assert.equal(notifications[1].kind, "consumptionHistory");
});

test("QA-02-002: temporada permite desmarcar sin timestamp", async () => {
  const { client, requests, notifications } = createClient();

  const result = await client.setSeriesSeasonWatched({
    itemId: "serie-1",
    season: 3,
    watched: false
  });

  assert.equal(result.ok, true);
  assert.deepEqual(requests, [{
    method: "PUT",
    path: "/library/serie-1/seasons/3",
    body: { watched: false }
  }]);
  assert.equal(notifications.length, 2);
});

test("QA-02-002: parámetros inválidos no envían peticiones", async () => {
  const { client, requests, notifications } = createClient();

  const result1 = await client.setSeriesEpisodeWatched({
    itemId: "serie-1",
    season: 0,
    episode: 1,
    watched: true
  });

  const result2 = await client.setSeriesSeasonWatched({
    itemId: "serie-1",
    season: 1,
    watched: "false"
  });

  assert.equal(result1.ok, false);
  assert.equal(result2.ok, false);
  assert.equal(requests.length, 0);
  assert.equal(notifications.length, 0);
});

test(
  "QA-02-002: solicitud inválida en modo local no usa HTTP",
  async () => {
    const { client, requests, notifications } = createClient({
      http: false
    });

    const result = await client.setSeriesSeasonWatched({
      itemId: "serie-1",
      season: 0,
      watched: true
    });

    assert.equal(result.ok, false);
    assert.equal(result.reason, "invalid_watch_request");
    assert.equal(requests.length, 0);
    assert.equal(notifications.length, 0);
  }
);

test("QA-02-002: conflicto HTTP se propaga sin notificar", async () => {
  const conflict = Object.assign(
    new Error("conflict"),
    { status: 409 }
  );

  const { client, notifications } = createClient({
    requestError: conflict
  });

  await assert.rejects(
    client.setSeriesEpisodeWatched({
      itemId: "serie-1",
      season: 1,
      episode: 1,
      watched: false
    }),
    (error) => error.status === 409
  );

  assert.equal(notifications.length, 0);
});

test("QA-02-002: respuesta HTTP inválida no se considera éxito", async () => {
  const { client, notifications } = createClient({
    requestResult: { ok: true }
  });

  await assert.rejects(
    client.setSeriesSeasonWatched({
      itemId: "serie-1",
      season: 1,
      watched: true
    }),
    /invalid_series_watch_response/
  );

  assert.equal(notifications.length, 0);
});
