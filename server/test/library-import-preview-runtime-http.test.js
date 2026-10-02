import assert from "node:assert/strict";
import {
  spawn
} from "node:child_process";
import {
  once
} from "node:events";
import fs from "node:fs";
import http from "node:http";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  fileURLToPath
} from "node:url";

const SERVER_PATH = fileURLToPath(
  new URL("../server.js", import.meta.url)
);

const SERVER_DIRECTORY =
  path.dirname(SERVER_PATH);

function createTemporaryDirectory() {
  return fs.mkdtempSync(
    path.join(
      os.tmpdir(),
      "quacker-library-import-preview-runtime-"
    )
  );
}

function getAvailablePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();

    server.once("error", reject);

    server.listen(
      0,
      "127.0.0.1",
      () => {
        const address =
          server.address();

        const port =
          typeof address === "object" &&
          address
            ? address.port
            : null;

        server.close((error) => {
          if (error) {
            reject(error);
            return;
          }

          if (!port) {
            reject(
              new Error(
                "No se pudo reservar un puerto temporal."
              )
            );
            return;
          }

          resolve(port);
        });
      }
    );
  });
}

function startTestServer({
  dbPath,
  sessionStorePath,
  port
}) {
  return new Promise((resolve, reject) => {
    let stdout = "";
    let stderr = "";
    let ready = false;

    const child = spawn(
      process.execPath,
      [SERVER_PATH],
      {
        cwd: SERVER_DIRECTORY,
        env: {
          ...process.env,
          NODE_ENV: "test",
          PORT: String(port),
          QUACKER_DB_PATH: dbPath,
          QUACKER_SESSION_STORE_PATH:
            sessionStorePath
        },
        stdio: [
          "ignore",
          "pipe",
          "pipe"
        ]
      }
    );

    const timeout = setTimeout(() => {
      if (ready) return;

      child.kill("SIGKILL");

      reject(
        new Error(
          `El servidor temporal no arrancó.\nSTDOUT:\n${stdout}\nSTDERR:\n${stderr}`
        )
      );
    }, 8000);

    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");

    child.stdout.on("data", (chunk) => {
      stdout += chunk;

      if (
        !ready &&
        stdout.includes(
          `Quacker server running: http://127.0.0.1:${port}`
        )
      ) {
        ready = true;
        clearTimeout(timeout);
        resolve(child);
      }
    });

    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });

    child.once("error", (error) => {
      if (ready) return;

      clearTimeout(timeout);
      reject(error);
    });

    child.once(
      "exit",
      (code, signal) => {
        if (ready) return;

        clearTimeout(timeout);

        reject(
          new Error(
            `El servidor temporal terminó antes de arrancar (${code ?? signal}).\nSTDOUT:\n${stdout}\nSTDERR:\n${stderr}`
          )
        );
      }
    );
  });
}

async function stopTestServer(child) {
  if (
    !child ||
    child.exitCode !== null ||
    child.signalCode !== null
  ) {
    return;
  }

  const gracefulExit =
    once(child, "exit");

  child.kill("SIGTERM");

  const exitedGracefully =
    await Promise.race([
      gracefulExit.then(() => true),
      new Promise((resolve) => {
        setTimeout(
          () => resolve(false),
          2000
        );
      })
    ]);

  if (
    exitedGracefully ||
    child.exitCode !== null ||
    child.signalCode !== null
  ) {
    return;
  }

  const forcedExit =
    once(child, "exit");

  child.kill("SIGKILL");

  await forcedExit;
}

function requestJson(
  url,
  {
    method = "GET",
    body = null,
    cookie = null
  } = {}
) {
  return new Promise(
    (resolve, reject) => {
      const serializedBody =
        body === null
          ? null
          : JSON.stringify(body);

      const headers = {
        Accept: "application/json"
      };

      if (serializedBody !== null) {
        headers["Content-Type"] =
          "application/json";

        headers["Content-Length"] =
          Buffer.byteLength(
            serializedBody
          );
      }

      if (cookie) {
        headers.Cookie = cookie;
      }

      const request =
        http.request(
          url,
          {
            method,
            headers
          },
          (response) => {
            let text = "";

            response.setEncoding(
              "utf8"
            );

            response.on(
              "data",
              (chunk) => {
                text += chunk;
              }
            );

            response.on(
              "end",
              () => {
                let json = null;

                if (text) {
                  try {
                    json =
                      JSON.parse(text);
                  } catch {
                    json = null;
                  }
                }

                resolve({
                  statusCode:
                    response.statusCode,
                  headers:
                    response.headers,
                  text,
                  json
                });
              }
            );
          }
        );

      request.setTimeout(
        5000,
        () => {
          request.destroy(
            new Error(
              "Timeout HTTP en servidor temporal."
            )
          );
        }
      );

      request.once(
        "error",
        reject
      );

      if (serializedBody !== null) {
        request.write(
          serializedBody
        );
      }

      request.end();
    }
  );
}

function sessionCookie(response) {
  const setCookie =
    response.headers["set-cookie"];

  assert.ok(
    Array.isArray(setCookie) &&
      setCookie.length > 0,
    "debe recibirse una cookie de sesión"
  );

  return setCookie[0]
    .split(";")[0];
}

test(
  "POST /api/library/import/preview exige sesión y devuelve el preview sin persistir",
  {
    timeout: 20000
  },
  async () => {
    const directory =
      createTemporaryDirectory();

    const dbPath =
      path.join(
        directory,
        "db.json"
      );

    const sessionStorePath =
      path.join(
        directory,
        "sessions"
      );

    fs.writeFileSync(
      dbPath,
      JSON.stringify(
        {
          users: {}
        },
        null,
        2
      ),
      "utf8"
    );

    const port =
      await getAvailablePort();

    let child = null;

    try {
      child =
        await startTestServer({
          dbPath,
          sessionStorePath,
          port
        });

      const baseUrl =
        `http://127.0.0.1:${port}`;

      const csv = [
        "title,type,year,source,externalId",
        "Dune,pelicula,2021,tmdb,438631",
        "Arrival,pelicula,2016,tmdb,329865"
      ].join("\n");

      const unauthenticated =
        await requestJson(
          `${baseUrl}/api/library/import/preview`,
          {
            method: "POST",
            body: {
              text: csv
            }
          }
        );

      assert.equal(
        unauthenticated.statusCode,
        401
      );

      const registration =
        await requestJson(
          `${baseUrl}/api/auth/register`,
          {
            method: "POST",
            body: {
              email:
                "library-import-preview@example.test",
              password:
                "runtime-pass-123",
              name:
                "Library Import Preview",
              language:
                "es"
            }
          }
        );

      assert.equal(
        registration.statusCode,
        200
      );

      const cookie =
        sessionCookie(
          registration
        );

      const preview =
        await requestJson(
          `${baseUrl}/api/library/import/preview`,
          {
            method: "POST",
            cookie,
            body: {
              text: csv
            }
          }
        );

      assert.equal(
        preview.statusCode,
        200
      );

      assert.equal(
        preview.json?.format,
        "quacker_csv_v1"
      );

      assert.deepEqual(
        preview.json?.summary,
        {
          total: 2,
          matched: 2,
          doubtful: 0,
          notFound: 0,
          duplicate: 0,
          invalid: 0
        }
      );

      assert.deepEqual(
        preview.json?.rows?.map(
          (row) => row.status
        ),
        [
          "matched",
          "matched"
        ]
      );

      const library =
        await requestJson(
          `${baseUrl}/api/library`,
          {
            cookie
          }
        );

      assert.equal(
        library.statusCode,
        200
      );

      assert.deepEqual(
        library.json,
        []
      );
    } finally {
      await stopTestServer(child);

      fs.rmSync(
        directory,
        {
          recursive: true,
          force: true
        }
      );
    }
  }
);

test(
  "POST /api/library/import/confirm importa matches resueltos sin duplicar",
  {
    timeout: 20000
  },
  async () => {
    const directory =
      createTemporaryDirectory();

    const dbPath =
      path.join(
        directory,
        "db.json"
      );

    const sessionStorePath =
      path.join(
        directory,
        "sessions"
      );

    fs.writeFileSync(
      dbPath,
      JSON.stringify(
        {
          users: {}
        },
        null,
        2
      ),
      "utf8"
    );

    const port =
      await getAvailablePort();

    let child = null;

    try {
      child =
        await startTestServer({
          dbPath,
          sessionStorePath,
          port
        });

      const baseUrl =
        `http://127.0.0.1:${port}`;

      const rows = [
        {
          rowNumber: 2,
          status: "matched",
          reason: "canonical_identity",
          confidence: 1,
          data: {
            title: "Dune",
            type: "pelicula",
            year: 2021,
            status: "completed",
            progress: 100,
            author: "",
            source: "tmdb",
            externalId: "438631"
          },
          match: {
            title: "Dune",
            type: "pelicula",
            source: "tmdb",
            externalId: "438631",
            meta: {
              year: 2021
            }
          },
          candidates: [],
          duplicate: null,
          errors: []
        },
        {
          rowNumber: 3,
          status: "matched",
          reason: "manual_selection",
          confidence: 1,
          data: {
            title: "Arrival",
            type: "pelicula",
            year: 2016,
            status: "watching",
            progress: 35,
            author: "",
            source: "",
            externalId: ""
          },
          match: {
            title: "Arrival",
            type: "pelicula",
            source: "tmdb",
            externalId: "329865",
            meta: {
              year: 2016
            }
          },
          candidates: [],
          duplicate: null,
          errors: []
        },
        {
          rowNumber: 4,
          status: "doubtful",
          reason: "low_confidence",
          confidence: 0.72,
          data: {
            title: "Unknown Film",
            type: "pelicula",
            year: 2020,
            status: "pending",
            progress: 0
          },
          match: null,
          candidates: [
            {
              title: "Unknown",
              type: "pelicula",
              source: "tmdb",
              externalId: "999",
              meta: {
                year: 2020
              }
            }
          ],
          duplicate: null,
          errors: []
        }
      ];

      const unauthenticated =
        await requestJson(
          `${baseUrl}/api/library/import/confirm`,
          {
            method: "POST",
            body: {
              rows
            }
          }
        );

      assert.equal(
        unauthenticated.statusCode,
        401
      );

      const registration =
        await requestJson(
          `${baseUrl}/api/auth/register`,
          {
            method: "POST",
            body: {
              email:
                "library-import-confirm@example.test",
              password:
                "runtime-pass-123",
              name:
                "Library Import Confirm",
              language:
                "es"
            }
          }
        );

      assert.equal(
        registration.statusCode,
        200
      );

      const cookie =
        sessionCookie(
          registration
        );

      const confirmed =
        await requestJson(
          `${baseUrl}/api/library/import/confirm`,
          {
            method: "POST",
            cookie,
            body: {
              rows
            }
          }
        );

      assert.equal(
        confirmed.statusCode,
        200
      );

      assert.equal(
        confirmed.json?.ok,
        true
      );

      assert.deepEqual(
        confirmed.json?.summary,
        {
          total: 3,
          imported: 2,
          duplicate: 0,
          skipped: 1,
          failed: 0
        }
      );

      assert.equal(
        confirmed.json?.items?.length,
        2
      );

      const libraryAfterFirstImport =
        await requestJson(
          `${baseUrl}/api/library`,
          {
            cookie
          }
        );

      assert.equal(
        libraryAfterFirstImport.statusCode,
        200
      );

      assert.equal(
        libraryAfterFirstImport.json?.length,
        2
      );

      const dune =
        libraryAfterFirstImport.json.find(
          (item) =>
            item.externalId === "438631"
        );

      const arrival =
        libraryAfterFirstImport.json.find(
          (item) =>
            item.externalId === "329865"
        );

      assert.equal(
        dune?.status,
        "completed"
      );

      assert.equal(
        dune?.progress,
        100
      );

      assert.equal(
        arrival?.status,
        "watching"
      );

      assert.equal(
        arrival?.progress,
        35
      );

      const repeated =
        await requestJson(
          `${baseUrl}/api/library/import/confirm`,
          {
            method: "POST",
            cookie,
            body: {
              rows
            }
          }
        );

      assert.equal(
        repeated.statusCode,
        200
      );

      assert.deepEqual(
        repeated.json?.summary,
        {
          total: 3,
          imported: 0,
          duplicate: 2,
          skipped: 1,
          failed: 0
        }
      );

      const libraryAfterRepeat =
        await requestJson(
          `${baseUrl}/api/library`,
          {
            cookie
          }
        );

      assert.equal(
        libraryAfterRepeat.json?.length,
        2
      );
    } finally {
      await stopTestServer(child);

      fs.rmSync(
        directory,
        {
          recursive: true,
          force: true
        }
      );
    }
  }
);

test(
  "POST /api/library/import/confirm no confía en matched si la identidad canónica es inválida",
  {
    timeout: 20000
  },
  async () => {
    const directory =
      createTemporaryDirectory();

    const dbPath =
      path.join(
        directory,
        "db.json"
      );

    const sessionStorePath =
      path.join(
        directory,
        "sessions"
      );

    fs.writeFileSync(
      dbPath,
      JSON.stringify(
        {
          users: {}
        },
        null,
        2
      ),
      "utf8"
    );

    const port =
      await getAvailablePort();

    let child = null;

    try {
      child =
        await startTestServer({
          dbPath,
          sessionStorePath,
          port
        });

      const baseUrl =
        `http://127.0.0.1:${port}`;

      const registration =
        await requestJson(
          `${baseUrl}/api/auth/register`,
          {
            method: "POST",
            body: {
              email:
                "library-import-tampered@example.test",
              password:
                "runtime-pass-123",
              name:
                "Library Import Tampered",
              language:
                "es"
            }
          }
        );

      assert.equal(
        registration.statusCode,
        200
      );

      const cookie =
        sessionCookie(
          registration
        );

      const tamperedRows = [
        {
          rowNumber: 2,
          status: "matched",
          confidence: 1,
          reason: "manual_selection",
          data: {
            title: "Injected Film",
            type: "pelicula",
            status: "completed",
            progress: 100
          },
          match: {
            title: "Injected Film",
            type: "pelicula",
            source: "untrusted_provider",
            externalId: "123456",
            meta: {
              year: 2026
            }
          },
          candidates: [],
          duplicate: null,
          errors: []
        }
      ];

      const confirmed =
        await requestJson(
          `${baseUrl}/api/library/import/confirm`,
          {
            method: "POST",
            cookie,
            body: {
              rows: tamperedRows
            }
          }
        );

      assert.equal(
        confirmed.statusCode,
        200
      );

      assert.deepEqual(
        confirmed.json?.summary,
        {
          total: 1,
          imported: 0,
          duplicate: 0,
          skipped: 0,
          failed: 1
        }
      );

      assert.deepEqual(
        confirmed.json?.items,
        []
      );

      const library =
        await requestJson(
          `${baseUrl}/api/library`,
          {
            cookie
          }
        );

      assert.equal(
        library.statusCode,
        200
      );

      assert.deepEqual(
        library.json,
        []
      );
    } finally {
      await stopTestServer(child);

      fs.rmSync(
        directory,
        {
          recursive: true,
          force: true
        }
      );
    }
  }
);
