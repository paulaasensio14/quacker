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
      "quacker-lists-runtime-"
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
        const address = server.address();
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

  const gracefulExit = once(
    child,
    "exit"
  );

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

  const forcedExit = once(
    child,
    "exit"
  );

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

      const request = http.request(
        url,
        {
          method,
          headers
        },
        (response) => {
          let text = "";

          response.setEncoding("utf8");

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
        3000,
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


test(
  "GET /api/lists migra metadatos colaborativos de una lista antigua",
  {
    timeout: 15000
  },
  async () => {
    const directory =
      createTemporaryDirectory();

    const dbPath =
      path.join(directory, "db.json");

    const sessionStorePath =
      path.join(directory, "sessions");

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
                "w14-lists-legacy@example.test",
              password:
                "runtime-pass-123",
              name:
                "W14 Lists Legacy",
              language: "es"
            }
          }
        );

      assert.equal(
        registration.statusCode,
        200
      );

      const userId =
        registration.json?.user?.id;

      assert.ok(userId);

      const cookie =
        registration.headers[
          "set-cookie"
        ][0].split(";")[0];

      const db =
        JSON.parse(
          fs.readFileSync(
            dbPath,
            "utf8"
          )
        );

      db.users[userId].lists = [
        {
          id: "legacy-list",
          name: "Lista antigua",
          description: "",
          visibility: "private",
          items: [],
          itemsCount: 0,
          createdAt:
            "2026-09-01T10:00:00.000Z",
          updatedAt:
            "2026-09-01T10:00:00.000Z"
        }
      ];

      fs.writeFileSync(
        dbPath,
        JSON.stringify(
          db,
          null,
          2
        ),
        "utf8"
      );

      const response =
        await requestJson(
          `${baseUrl}/api/lists`,
          {
            cookie
          }
        );

      assert.equal(
        response.statusCode,
        200
      );

      assert.equal(
        response.json?.[0]
          ?.ownerUserId,
        userId
      );

      assert.deepEqual(
        response.json?.[0]
          ?.collaborators,
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
  "POST /api/lists crea la lista con propietario y colaboradores vacíos",
  {
    timeout: 15000
  },
  async () => {
    const directory =
      createTemporaryDirectory();

    const dbPath =
      path.join(directory, "db.json");

    const sessionStorePath =
      path.join(directory, "sessions");

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
                "w14-lists-create@example.test",
              password:
                "runtime-pass-123",
              name:
                "W14 Lists Create",
              language: "es"
            }
          }
        );

      assert.equal(
        registration.statusCode,
        200
      );

      const userId =
        registration.json?.user?.id;

      assert.ok(userId);

      const cookie =
        registration.headers[
          "set-cookie"
        ][0].split(";")[0];

      const created =
        await requestJson(
          `${baseUrl}/api/lists`,
          {
            method: "POST",
            cookie,
            body: {
              name:
                "Lista colaborativa base",
              description:
                "Modelo Semana 14",
              visibility:
                "collab"
            }
          }
        );

      assert.equal(
        created.statusCode,
        201
      );

      assert.equal(
        created.json?.ownerUserId,
        userId
      );

      assert.deepEqual(
        created.json?.collaborators,
        []
      );

      const persisted =
        JSON.parse(
          fs.readFileSync(
            dbPath,
            "utf8"
          )
        );

      assert.equal(
        persisted.users[userId]
          .lists[0]
          .ownerUserId,
        userId
      );

      assert.deepEqual(
        persisted.users[userId]
          .lists[0]
          .collaborators,
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
  "PUT /api/lists preserva metadatos colaborativos protegidos",
  {
    timeout: 15000
  },
  async () => {
    const directory =
      createTemporaryDirectory();

    const dbPath =
      path.join(directory, "db.json");

    const sessionStorePath =
      path.join(directory, "sessions");

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
                "w14-lists-put@example.test",
              password:
                "runtime-pass-123",
              name:
                "W14 Lists Put",
              language: "es"
            }
          }
        );

      assert.equal(
        registration.statusCode,
        200
      );

      const userId =
        registration.json?.user?.id;

      assert.ok(userId);

      const cookie =
        registration.headers[
          "set-cookie"
        ][0].split(";")[0];

      const db =
        JSON.parse(
          fs.readFileSync(
            dbPath,
            "utf8"
          )
        );

      db.users[userId].lists = [
        {
          id: "protected-list",
          name: "Original",
          description: "",
          visibility: "collab",
          ownerUserId: userId,
          collaborators: [
            "existing-collaborator"
          ],
          items: [],
          itemsCount: 0,
          createdAt:
            "2026-09-01T10:00:00.000Z",
          updatedAt:
            "2026-09-01T10:00:00.000Z"
        }
      ];

      fs.writeFileSync(
        dbPath,
        JSON.stringify(
          db,
          null,
          2
        ),
        "utf8"
      );

      const response =
        await requestJson(
          `${baseUrl}/api/lists`,
          {
            method: "PUT",
            cookie,
            body: {
              lists: [
                {
                  id:
                    "protected-list",
                  name:
                    "Restaurada",
                  description:
                    "Undo",
                  visibility:
                    "collab",
                  ownerUserId:
                    "attacker-user",
                  collaborators: [
                    "attacker-user"
                  ],
                  items: [],
                  createdAt:
                    "2026-09-01T10:00:00.000Z"
                }
              ]
            }
          }
        );

      assert.equal(
        response.statusCode,
        200
      );

      assert.equal(
        response.json?.lists?.[0]
          ?.ownerUserId,
        userId
      );

      assert.deepEqual(
        response.json?.lists?.[0]
          ?.collaborators,
        [
          "existing-collaborator"
        ]
      );

      const persisted =
        JSON.parse(
          fs.readFileSync(
            dbPath,
            "utf8"
          )
        );

      assert.equal(
        persisted.users[userId]
          .lists[0]
          .ownerUserId,
        userId
      );

      assert.deepEqual(
        persisted.users[userId]
          .lists[0]
          .collaborators,
        [
          "existing-collaborator"
        ]
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
