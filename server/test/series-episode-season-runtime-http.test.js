import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import fs from "node:fs";
import http from "node:http";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const SERVER_PATH = fileURLToPath(
  new URL("../server.js", import.meta.url)
);

function availablePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();

    server.once("error", reject);

    server.listen(0, "127.0.0.1", () => {
      const port = server.address().port;
      server.close((error) => {
        if (error) reject(error);
        else resolve(port);
      });
    });
  });
}

async function startServer(port, directory) {
  const child = spawn(process.execPath, [SERVER_PATH], {
    cwd: path.dirname(SERVER_PATH),
    env: {
      ...process.env,
      NODE_ENV: "test",
      PORT: String(port),
      QUACKER_DB_PATH: path.join(directory, "db.json"),
      QUACKER_SESSION_STORE_PATH:
        path.join(directory, "sessions"),
      SMTP_HOST: "",
      SMTP_USER: "",
      SMTP_PASS: ""
    },
    stdio: ["ignore", "pipe", "pipe"]
  });

  let output = "";
  let errors = "";

  child.stdout.on("data", (chunk) => {
    output += chunk.toString();
  });

  child.stderr.on("data", (chunk) => {
    errors += chunk.toString();
  });

  const deadline = Date.now() + 10000;

  while (Date.now() < deadline) {
    if (
      output.includes(
        `Quacker server running: http://127.0.0.1:${port}`
      )
    ) {
      return child;
    }

    if (child.exitCode !== null) break;

    await new Promise((resolve) =>
      setTimeout(resolve, 50)
    );
  }

  child.kill("SIGKILL");

  throw new Error(
    `Servidor temporal no disponible: ${errors}`
  );
}

function requestJson(url, {
  method = "GET",
  body = null,
  cookie = ""
} = {}) {
  return new Promise((resolve, reject) => {
    const serializedBody =
      body === null ? null : JSON.stringify(body);

    const headers = {
      Accept: "application/json",
      Origin: new URL(url).origin
    };

    if (serializedBody !== null) {
      headers["Content-Type"] = "application/json";
      headers["Content-Length"] =
        Buffer.byteLength(serializedBody);
    }

    if (cookie) headers.Cookie = cookie;

    const request = http.request(
      url,
      { method, headers },
      (response) => {
        let text = "";

        response.setEncoding("utf8");

        response.on("data", (chunk) => {
          text += chunk;
        });

        response.on("end", () => {
          let json = null;

          if (text) {
            try {
              json = JSON.parse(text);
            } catch {
              json = null;
            }
          }

          resolve({
            status: response.statusCode,
            json,
            headers: response.headers
          });
        });
      }
    );

    request.setTimeout(5000, () => {
      request.destroy(new Error("HTTP_TIMEOUT"));
    });

    request.on("error", reject);

    if (serializedBody !== null) {
      request.write(serializedBody);
    }

    request.end();
  });
}

function getSessionCookie(response) {
  const cookies = response.headers["set-cookie"];

  assert.ok(
    Array.isArray(cookies) && cookies.length > 0,
    "El registro debe crear una sesión"
  );

  return cookies[0].split(";")[0];
}


test(
  "QA-02-002 HTTP: temporadas, episodios y aislamiento",
  { timeout: 30000 },
  async () => {
    const directory = fs.mkdtempSync(
      path.join(os.tmpdir(), "quacker-series-watch-http-")
    );

    let child;

    try {
      const port = await availablePort();
      const baseUrl = `http://127.0.0.1:${port}`;

      child = await startServer(port, directory);

      const request = (endpoint, options = {}) =>
        requestJson(`${baseUrl}${endpoint}`, options);

      async function register(email, name) {
        const response = await request(
          "/api/auth/register",
          {
            method: "POST",
            body: {
              email,
              name,
              password: "Series-QA-002-2026!",
              language: "es"
            }
          }
        );

        assert.equal(response.status, 200);
        return getSessionCookie(response);
      }

      const owner = await register(
        "series-owner@example.test",
        "Series Owner"
      );

      const other = await register(
        "series-other@example.test",
        "Series Other"
      );

      const created = await request("/api/library", {
        method: "POST",
        cookie: owner,
        body: {
          title: "Breaking Bad QA HTTP",
          type: "serie",
          source: "tmdb",
          externalId: "1396",
          status: "not_started",
          progress: 0,
          meta: {
            totalEpisodes: 62,
            totalSeasons: 5,
            seasonBreakdown: [
              { seasonNumber: 1, episodeCount: 7 },
              { seasonNumber: 2, episodeCount: 13 },
              { seasonNumber: 3, episodeCount: 13 },
              { seasonNumber: 4, episodeCount: 13 },
              { seasonNumber: 5, episodeCount: 16 }
            ]
          }
        }
      });

      assert.equal(
        created.status,
        200,
        `Crear serie: ${JSON.stringify(created.json)}`
      );

      const itemId = created.json?.id;
      assert.ok(itemId);

      const itemPath =
        `/api/library/${encodeURIComponent(itemId)}`;

      const seasonPath = `${itemPath}/seasons/1`;
      const episodePath = `${itemPath}/episodes/1/2`;

      const anonymous = await request(seasonPath, {
        method: "PUT",
        body: { watched: true }
      });

      assert.equal(anonymous.status, 401);

      const foreign = await request(seasonPath, {
        method: "PUT",
        cookie: other,
        body: { watched: true }
      });

      assert.equal(foreign.status, 404);

      // Primera operación explícita: no había episodios vistos.
      // Debe activar el seguimiento sin inventar eventos.
      const initialUnwatch = await request(episodePath, {
        method: "PUT",
        cookie: owner,
        body: { watched: false }
      });

      assert.equal(initialUnwatch.status, 200);
      assert.equal(initialUnwatch.json?.changed, 0);
      assert.equal(initialUnwatch.json?.watchedEpisodes, 0);
      assert.equal(
        initialUnwatch.json?.item?.meta?.episodeTrackingVersion,
        1,
        "La primera operación sin cambios debe activar el seguimiento"
      );

      const initialHistory = await request(
        `/api/consumption-history?itemId=${encodeURIComponent(itemId)}`,
        { cookie: owner }
      );

      assert.equal(initialHistory.status, 200);
      assert.deepEqual(
        initialHistory.json?.consumptionHistory,
        []
      );

      const completeSeason = await request(seasonPath, {
        method: "PUT",
        cookie: owner,
        body: { watched: true }
      });

      assert.equal(
        completeSeason.status,
        200,
        JSON.stringify(completeSeason.json)
      );

      assert.equal(completeSeason.json?.added, 7);
      assert.equal(completeSeason.json?.watchedEpisodes, 7);
      assert.equal(completeSeason.json?.totalEpisodes, 62);
      assert.equal(completeSeason.json?.item?.progress, 11);
      assert.equal(completeSeason.json?.item?.status, "watching");

      assert.deepEqual(
        completeSeason.json?.nextEpisode,
        { season: 2, episode: 1 }
      );

      const repeated = await request(seasonPath, {
        method: "PUT",
        cookie: owner,
        body: { watched: true }
      });

      assert.equal(repeated.status, 200);
      assert.equal(repeated.json?.changed, 0);

      const historyPath =
        `/api/consumption-history?itemId=${encodeURIComponent(itemId)}`;

      const history = await request(historyPath, {
        cookie: owner
      });

      assert.equal(history.status, 200);

      const events = history.json?.consumptionHistory;

      assert.ok(Array.isArray(events));
      assert.equal(events.length, 7);

      const ids = events.map((event) => event.id);

      assert.equal(new Set(ids).size, 7);
      assert.ok(ids.every((id) => !id.startsWith("pending:")));

      const unwatch = await request(episodePath, {
        method: "PUT",
        cookie: owner,
        body: { watched: false }
      });

      assert.equal(
        unwatch.status,
        200,
        JSON.stringify(unwatch.json)
      );

      assert.equal(unwatch.json?.removed, 1);
      assert.equal(unwatch.json?.watchedEpisodes, 6);
      assert.equal(unwatch.json?.item?.progress, 10);

      assert.deepEqual(
        unwatch.json?.nextEpisode,
        { season: 1, episode: 2 }
      );

      const updatedHistory = await request(historyPath, {
        cookie: owner
      });

      assert.equal(updatedHistory.status, 200);
      assert.equal(
        updatedHistory.json?.consumptionHistory?.length,
        6
      );

      assert.ok(
        updatedHistory.json.consumptionHistory.every(
          (event) =>
            !(event.meta?.season === 1 &&
              event.meta?.episode === 2)
        )
      );

      const invalid = await request(
        `${itemPath}/episodes/1/8`,
        {
          method: "PUT",
          cookie: owner,
          body: { watched: true }
        }
      );

      assert.equal(invalid.status, 400);

      const afterInvalid = await request(itemPath, {
        cookie: owner
      });

      assert.equal(afterInvalid.status, 200);
      assert.equal(afterInvalid.json?.progress, 10);

      const otherLibrary = await request("/api/library", {
        cookie: other
      });

      assert.equal(otherLibrary.status, 200);
      assert.deepEqual(otherLibrary.json, []);

      const persistedDb = JSON.parse(
        fs.readFileSync(
          path.join(directory, "db.json"),
          "utf8"
        )
      );

      const ownerBuckets = Object.values(
        persistedDb.users || {}
      ).filter((bucket) =>
        bucket.library?.some(
          (item) => item.id === itemId
        )
      );

      assert.equal(ownerBuckets.length, 1);

      assert.equal(
        ownerBuckets[0].consumptionHistory.filter(
          (event) => event.itemId === itemId
        ).length,
        6
      );


      // Desmarcar toda la temporada elimina los seis pendientes.
      const clearSeason = await request(seasonPath, {
        method: "PUT",
        cookie: owner,
        body: { watched: false }
      });

      assert.equal(clearSeason.status, 200);
      assert.equal(clearSeason.json?.removed, 6);
      assert.equal(clearSeason.json?.watchedEpisodes, 0);
      assert.equal(clearSeason.json?.item?.progress, 0);
      assert.equal(clearSeason.json?.item?.status, "not_started");
      assert.equal(
        clearSeason.json?.item?.meta?.episodeTrackingVersion,
        1,
        "Una serie sincronizada debe identificarse incluso con historial vacío"
      );


      assert.deepEqual(clearSeason.json?.nextEpisode, {
        season: 1,
        episode: 1
      });

      const emptyHistory = await request(historyPath, {
        cookie: owner
      });

      assert.equal(emptyHistory.status, 200);
      assert.equal(
        emptyHistory.json?.consumptionHistory?.length,
        0
      );

      // Repetir una eliminación no cambia los datos.
      const clearAgain = await request(seasonPath, {
        method: "PUT",
        cookie: owner,
        body: { watched: false }
      });

      assert.equal(clearAgain.status, 200);
      assert.equal(clearAgain.json?.changed, 0);

      // Una versión obsoleta no puede modificar la biblioteca.
      const stale = await request(
        `${itemPath}/episodes/2/1`,
        {
          method: "PUT",
          cookie: owner,
          body: {
            watched: true,
            expectedUpdatedAt: "2000-01-01T00:00:00.000Z"
          }
        }
      );

      assert.equal(stale.status, 409);
      assert.equal(
        stale.json?.error,
        "stale_library_update"
      );

      // Se puede marcar un episodio aislado de otra temporada.
      const watchSeasonTwo = await request(
        `${itemPath}/episodes/2/1`,
        {
          method: "PUT",
          cookie: owner,
          body: { watched: true }
        }
      );

      assert.equal(watchSeasonTwo.status, 200);
      assert.equal(watchSeasonTwo.json?.watchedEpisodes, 1);
      assert.equal(watchSeasonTwo.json?.item?.progress, 2);

      assert.deepEqual(watchSeasonTwo.json?.nextEpisode, {
        season: 1,
        episode: 1
      });

      const lastHistory = await request(historyPath, {
        cookie: owner
      });

      assert.equal(lastHistory.status, 200);
      assert.equal(
        lastHistory.json?.consumptionHistory?.length,
        1
      );

      assert.equal(
        lastHistory.json?.consumptionHistory?.[0]?.meta?.season,
        2
      );

      assert.equal(
        lastHistory.json?.consumptionHistory?.[0]?.meta?.episode,
        1
      );

      const foreignAgain = await request(
        `${itemPath}/episodes/2/1`,
        {
          method: "PUT",
          cookie: other,
          body: { watched: false }
        }
      );

      assert.equal(foreignAgain.status, 404);

      const finalDb = JSON.parse(
        fs.readFileSync(
          path.join(directory, "db.json"),
          "utf8"
        )
      );

      const finalBucket = Object.values(
        finalDb.users || {}
      ).find((bucket) =>
        bucket.library?.some((item) => item.id === itemId)
      );

      assert.ok(finalBucket);

      assert.equal(
        finalBucket.consumptionHistory.filter(
          (event) => event.itemId === itemId
        ).length,
        1
      );
    } finally {
      if (child && child.exitCode === null) {
        const exited = once(child, "exit");
        child.kill("SIGTERM");
        await exited;
      }

      fs.rmSync(directory, {
        recursive: true,
        force: true
      });
    }
  }
);
