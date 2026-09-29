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

      assert.deepEqual(
        created.json?.invitedUserIds,
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

      assert.deepEqual(
        persisted.users[userId]
          .lists[0]
          .invitedUserIds,
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
          invitedUserIds: [
            "pending-user"
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
                  invitedUserIds: [
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

      assert.deepEqual(
        response.json?.lists?.[0]
          ?.invitedUserIds,
        [
          "pending-user"
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

      assert.deepEqual(
        persisted.users[userId]
          .lists[0]
          .invitedUserIds,
        [
          "pending-user"
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


test(
  "el propietario puede invitar por username y el destinatario ve la invitación pendiente",
  {
    timeout: 15000
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

      const ownerRegistration =
        await requestJson(
          `${baseUrl}/api/auth/register`,
          {
            method: "POST",
            body: {
              email:
                "w14-owner@example.test",
              password:
                "runtime-pass-123",
              name:
                "W14 Owner",
              language: "es"
            }
          }
        );

      assert.equal(
        ownerRegistration.statusCode,
        200
      );

      const ownerCookie =
        ownerRegistration.headers[
          "set-cookie"
        ][0].split(";")[0];

      const ownerUserId =
        ownerRegistration.json?.user?.id;

      const inviteeRegistration =
        await requestJson(
          `${baseUrl}/api/auth/register`,
          {
            method: "POST",
            body: {
              email:
                "w14-invitee@example.test",
              password:
                "runtime-pass-123",
              name:
                "W14 Invitee",
              language: "es"
            }
          }
        );

      assert.equal(
        inviteeRegistration.statusCode,
        200
      );

      const inviteeCookie =
        inviteeRegistration.headers[
          "set-cookie"
        ][0].split(";")[0];

      const inviteeUserId =
        inviteeRegistration.json?.user?.id;

      const inviteeUsername =
        inviteeRegistration.json?.user
          ?.handle;

      assert.ok(ownerUserId);
      assert.ok(inviteeUserId);
      assert.ok(inviteeUsername);

      const privacyUpdated =
        await requestJson(
          `${baseUrl}/api/user/privacy`,
          {
            method: "PATCH",
            cookie:
              inviteeCookie,
            body: {
              profileVisibility:
                "public"
            }
          }
        );

      assert.equal(
        privacyUpdated.statusCode,
        200
      );

      const created =
        await requestJson(
          `${baseUrl}/api/lists`,
          {
            method: "POST",
            cookie: ownerCookie,
            body: {
              name:
                "Qué vemos el sábado",
              description: "",
              visibility:
                "collab"
            }
          }
        );

      assert.equal(
        created.statusCode,
        201
      );

      const listId =
        created.json?.id;

      assert.ok(listId);

      const invited =
        await requestJson(
          `${baseUrl}/api/lists/${encodeURIComponent(listId)}/invites/${encodeURIComponent(inviteeUsername)}`,
          {
            method: "POST",
            cookie: ownerCookie
          }
        );

      assert.equal(
        invited.statusCode,
        201
      );

      assert.equal(
        invited.json?.invited,
        true
      );

      assert.equal(
        invited.json?.user?.username,
        String(inviteeUsername).replace(
          /^@/,
          ""
        )
      );

      const pending =
        await requestJson(
          `${baseUrl}/api/user/list-invites`,
          {
            cookie:
              inviteeCookie
          }
        );

      assert.equal(
        pending.statusCode,
        200
      );

      assert.equal(
        pending.json?.invites?.length,
        1
      );

      assert.equal(
        pending.json?.invites?.[0]
          ?.list?.id,
        listId
      );

      assert.equal(
        pending.json?.invites?.[0]
          ?.list?.name,
        "Qué vemos el sábado"
      );

      assert.equal(
        pending.json?.invites?.[0]
          ?.owner?.username,
        String(
          ownerRegistration.json?.user
            ?.handle || ""
        ).replace(
          /^@/,
          ""
        )
      );

      const persisted =
        JSON.parse(
          fs.readFileSync(
            dbPath,
            "utf8"
          )
        );

      assert.deepEqual(
        persisted.users[ownerUserId]
          .lists[0]
          .invitedUserIds,
        [
          inviteeUserId
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


test(
  "el destinatario puede aceptar una invitación y pasa a ser colaborador",
  {
    timeout: 15000
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

      const ownerRegistration =
        await requestJson(
          `${baseUrl}/api/auth/register`,
          {
            method: "POST",
            body: {
              email:
                "w14-accept-owner@example.test",
              password:
                "runtime-pass-123",
              name:
                "W14 Accept Owner",
              language: "es"
            }
          }
        );

      assert.equal(
        ownerRegistration.statusCode,
        200
      );

      const ownerCookie =
        ownerRegistration.headers[
          "set-cookie"
        ][0].split(";")[0];

      const ownerUserId =
        ownerRegistration.json?.user?.id;

      const inviteeRegistration =
        await requestJson(
          `${baseUrl}/api/auth/register`,
          {
            method: "POST",
            body: {
              email:
                "w14-accept-invitee@example.test",
              password:
                "runtime-pass-123",
              name:
                "W14 Accept Invitee",
              language: "es"
            }
          }
        );

      assert.equal(
        inviteeRegistration.statusCode,
        200
      );

      const inviteeCookie =
        inviteeRegistration.headers[
          "set-cookie"
        ][0].split(";")[0];

      const inviteeUserId =
        inviteeRegistration.json?.user?.id;

      const inviteeUsername =
        inviteeRegistration.json?.user
          ?.handle;

      assert.ok(ownerUserId);
      assert.ok(inviteeUserId);
      assert.ok(inviteeUsername);

      const privacyUpdated =
        await requestJson(
          `${baseUrl}/api/user/privacy`,
          {
            method: "PATCH",
            cookie:
              inviteeCookie,
            body: {
              profileVisibility:
                "public"
            }
          }
        );

      assert.equal(
        privacyUpdated.statusCode,
        200
      );

      const created =
        await requestJson(
          `${baseUrl}/api/lists`,
          {
            method: "POST",
            cookie:
              ownerCookie,
            body: {
              name:
                "Lista para aceptar",
              description: "",
              visibility:
                "collab"
            }
          }
        );

      assert.equal(
        created.statusCode,
        201
      );

      const listId =
        created.json?.id;

      assert.ok(listId);

      const invited =
        await requestJson(
          `${baseUrl}/api/lists/${encodeURIComponent(listId)}/invites/${encodeURIComponent(inviteeUsername)}`,
          {
            method: "POST",
            cookie:
              ownerCookie
          }
        );

      assert.equal(
        invited.statusCode,
        201
      );

      const accepted =
        await requestJson(
          `${baseUrl}/api/user/list-invites/${encodeURIComponent(listId)}/accept`,
          {
            method: "POST",
            cookie:
              inviteeCookie
          }
        );

      assert.equal(
        accepted.statusCode,
        200
      );

      assert.equal(
        accepted.json?.accepted,
        true
      );

      assert.equal(
        accepted.json?.list?.id,
        listId
      );

      const pending =
        await requestJson(
          `${baseUrl}/api/user/list-invites`,
          {
            cookie:
              inviteeCookie
          }
        );

      assert.equal(
        pending.statusCode,
        200
      );

      assert.deepEqual(
        pending.json?.invites,
        []
      );

      const persisted =
        JSON.parse(
          fs.readFileSync(
            dbPath,
            "utf8"
          )
        );

      assert.deepEqual(
        persisted.users[ownerUserId]
          .lists[0]
          .collaborators,
        [
          inviteeUserId
        ]
      );

      assert.deepEqual(
        persisted.users[ownerUserId]
          .lists[0]
          .invitedUserIds,
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
  "el destinatario puede rechazar una invitación sin convertirse en colaborador",
  {
    timeout: 15000
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

      const ownerRegistration =
        await requestJson(
          `${baseUrl}/api/auth/register`,
          {
            method: "POST",
            body: {
              email:
                "w14-reject-owner@example.test",
              password:
                "runtime-pass-123",
              name:
                "W14 Reject Owner",
              language: "es"
            }
          }
        );

      assert.equal(
        ownerRegistration.statusCode,
        200
      );

      const ownerCookie =
        ownerRegistration.headers[
          "set-cookie"
        ][0].split(";")[0];

      const ownerUserId =
        ownerRegistration.json?.user?.id;

      const inviteeRegistration =
        await requestJson(
          `${baseUrl}/api/auth/register`,
          {
            method: "POST",
            body: {
              email:
                "w14-reject-invitee@example.test",
              password:
                "runtime-pass-123",
              name:
                "W14 Reject Invitee",
              language: "es"
            }
          }
        );

      assert.equal(
        inviteeRegistration.statusCode,
        200
      );

      const inviteeCookie =
        inviteeRegistration.headers[
          "set-cookie"
        ][0].split(";")[0];

      const inviteeUserId =
        inviteeRegistration.json?.user?.id;

      const inviteeUsername =
        inviteeRegistration.json?.user
          ?.handle;

      assert.ok(ownerUserId);
      assert.ok(inviteeUserId);
      assert.ok(inviteeUsername);

      const privacyUpdated =
        await requestJson(
          `${baseUrl}/api/user/privacy`,
          {
            method: "PATCH",
            cookie:
              inviteeCookie,
            body: {
              profileVisibility:
                "public"
            }
          }
        );

      assert.equal(
        privacyUpdated.statusCode,
        200
      );

      const created =
        await requestJson(
          `${baseUrl}/api/lists`,
          {
            method: "POST",
            cookie:
              ownerCookie,
            body: {
              name:
                "Lista para rechazar",
              description: "",
              visibility:
                "collab"
            }
          }
        );

      assert.equal(
        created.statusCode,
        201
      );

      const listId =
        created.json?.id;

      assert.ok(listId);

      const invited =
        await requestJson(
          `${baseUrl}/api/lists/${encodeURIComponent(listId)}/invites/${encodeURIComponent(inviteeUsername)}`,
          {
            method: "POST",
            cookie:
              ownerCookie
          }
        );

      assert.equal(
        invited.statusCode,
        201
      );

      const rejected =
        await requestJson(
          `${baseUrl}/api/user/list-invites/${encodeURIComponent(listId)}`,
          {
            method: "DELETE",
            cookie:
              inviteeCookie
          }
        );

      assert.equal(
        rejected.statusCode,
        200
      );

      assert.equal(
        rejected.json?.rejected,
        true
      );

      assert.equal(
        rejected.json?.list?.id,
        listId
      );

      const pending =
        await requestJson(
          `${baseUrl}/api/user/list-invites`,
          {
            cookie:
              inviteeCookie
          }
        );

      assert.equal(
        pending.statusCode,
        200
      );

      assert.deepEqual(
        pending.json?.invites,
        []
      );

      const persisted =
        JSON.parse(
          fs.readFileSync(
            dbPath,
            "utf8"
          )
        );

      assert.deepEqual(
        persisted.users[ownerUserId]
          .lists[0]
          .collaborators,
        []
      );

      assert.deepEqual(
        persisted.users[ownerUserId]
          .lists[0]
          .invitedUserIds,
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
  "deshacer el borrado de una lista colaborativa restaura metadatos protegidos desde el servidor",
  {
    timeout: 15000
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
                "w14-undo-collab@example.test",
              password:
                "runtime-pass-123",
              name:
                "W14 Undo Collab",
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

      const cookie =
        registration.headers[
          "set-cookie"
        ][0].split(";")[0];

      assert.ok(userId);

      const db =
        JSON.parse(
          fs.readFileSync(
            dbPath,
            "utf8"
          )
        );

      db.users[userId].lists = [
        {
          id:
            "collaborative-list-to-restore",
          name:
            "Lista colaborativa",
          description:
            "Antes de borrar",
          visibility:
            "collab",
          ownerUserId:
            userId,
          collaborators: [
            "real-collaborator"
          ],
          invitedUserIds: [
            "real-pending-user"
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

      const deleted =
        await requestJson(
          `${baseUrl}/api/lists/collaborative-list-to-restore`,
          {
            method: "DELETE",
            cookie
          }
        );

      assert.equal(
        deleted.statusCode,
        200
      );

      const restored =
        await requestJson(
          `${baseUrl}/api/lists`,
          {
            method: "PUT",
            cookie,
            body: {
              lists: [
                {
                  id:
                    "collaborative-list-to-restore",
                  name:
                    "Lista colaborativa",
                  description:
                    "Antes de borrar",
                  visibility:
                    "collab",
                  ownerUserId:
                    "attacker-owner",
                  collaborators: [
                    "attacker-collaborator"
                  ],
                  invitedUserIds: [
                    "attacker-invite"
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
        restored.statusCode,
        200
      );

      assert.equal(
        restored.json?.lists?.[0]
          ?.ownerUserId,
        userId
      );

      assert.deepEqual(
        restored.json?.lists?.[0]
          ?.collaborators,
        [
          "real-collaborator"
        ]
      );

      assert.deepEqual(
        restored.json?.lists?.[0]
          ?.invitedUserIds,
        [
          "real-pending-user"
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
          "real-collaborator"
        ]
      );

      assert.deepEqual(
        persisted.users[userId]
          .lists[0]
          .invitedUserIds,
        [
          "real-pending-user"
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


test(
  "una invitación no puede aceptarse mientras la lista deja de ser colaborativa",
  {
    timeout: 15000
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

      const ownerRegistration =
        await requestJson(
          `${baseUrl}/api/auth/register`,
          {
            method: "POST",
            body: {
              email:
                "w14-inactive-invite-owner@example.test",
              password:
                "runtime-pass-123",
              name:
                "W14 Inactive Invite Owner",
              language: "es"
            }
          }
        );

      const inviteeRegistration =
        await requestJson(
          `${baseUrl}/api/auth/register`,
          {
            method: "POST",
            body: {
              email:
                "w14-inactive-invitee@example.test",
              password:
                "runtime-pass-123",
              name:
                "W14 Inactive Invitee",
              language: "es"
            }
          }
        );

      assert.equal(
        ownerRegistration.statusCode,
        200
      );

      assert.equal(
        inviteeRegistration.statusCode,
        200
      );

      const ownerCookie =
        ownerRegistration.headers[
          "set-cookie"
        ][0].split(";")[0];

      const inviteeCookie =
        inviteeRegistration.headers[
          "set-cookie"
        ][0].split(";")[0];

      const inviteeUsername =
        inviteeRegistration.json?.user
          ?.handle;

      assert.ok(inviteeUsername);

      const privacyUpdated =
        await requestJson(
          `${baseUrl}/api/user/privacy`,
          {
            method: "PATCH",
            cookie:
              inviteeCookie,
            body: {
              profileVisibility:
                "public"
            }
          }
        );

      assert.equal(
        privacyUpdated.statusCode,
        200
      );

      const created =
        await requestJson(
          `${baseUrl}/api/lists`,
          {
            method: "POST",
            cookie:
              ownerCookie,
            body: {
              name:
                "Lista colaboración suspendida",
              description: "",
              visibility:
                "collab"
            }
          }
        );

      assert.equal(
        created.statusCode,
        201
      );

      const listId =
        created.json?.id;

      assert.ok(listId);

      const invited =
        await requestJson(
          `${baseUrl}/api/lists/${encodeURIComponent(listId)}/invites/${encodeURIComponent(inviteeUsername)}`,
          {
            method: "POST",
            cookie:
              ownerCookie
          }
        );

      assert.equal(
        invited.statusCode,
        201
      );

      const changedVisibility =
        await requestJson(
          `${baseUrl}/api/lists/${encodeURIComponent(listId)}`,
          {
            method: "PATCH",
            cookie:
              ownerCookie,
            body: {
              visibility:
                "private"
            }
          }
        );

      assert.equal(
        changedVisibility.statusCode,
        200
      );

      const pending =
        await requestJson(
          `${baseUrl}/api/user/list-invites`,
          {
            cookie:
              inviteeCookie
          }
        );

      assert.deepEqual(
        pending.json?.invites,
        []
      );

      const accepted =
        await requestJson(
          `${baseUrl}/api/user/list-invites/${encodeURIComponent(listId)}/accept`,
          {
            method: "POST",
            cookie:
              inviteeCookie
          }
        );

      assert.equal(
        accepted.statusCode,
        400
      );

      assert.equal(
        accepted.json?.error,
        "list_not_collaborative"
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
  "el propietario puede generar un enlace colaborativo y solo se persiste su hash",
  {
    timeout: 15000
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
                "w14-link-owner@example.test",
              password:
                "runtime-pass-123",
              name:
                "W14 Link Owner",
              language: "es"
            }
          }
        );

      assert.equal(
        registration.statusCode,
        200
      );

      const ownerCookie =
        registration.headers[
          "set-cookie"
        ][0].split(";")[0];

      const ownerUserId =
        registration.json?.user?.id;

      assert.ok(ownerUserId);

      const created =
        await requestJson(
          `${baseUrl}/api/lists`,
          {
            method: "POST",
            cookie: ownerCookie,
            body: {
              name:
                "Lista con enlace",
              description: "",
              visibility:
                "collab"
            }
          }
        );

      assert.equal(
        created.statusCode,
        201
      );

      const listId =
        created.json?.id;

      assert.ok(listId);

      const generated =
        await requestJson(
          `${baseUrl}/api/lists/${encodeURIComponent(listId)}/link-invite`,
          {
            method: "POST",
            cookie: ownerCookie
          }
        );

      assert.equal(
        generated.statusCode,
        201
      );

      assert.equal(
        generated.json?.created,
        true
      );

      assert.equal(
        generated.json?.list?.id,
        listId
      );

      const inviteUrl =
        String(
          generated.json?.invite?.url ||
          ""
        );

      assert.match(
        inviteUrl,
        /^https:\/\/quacker\.es\/#list-invite=[A-Za-z0-9_-]+$/
      );

      assert.ok(
        Number.isFinite(
          Number(
            generated.json?.invite?.issuedAt
          )
        )
      );

      const token =
        decodeURIComponent(
          inviteUrl.split(
            "#list-invite="
          )[1] || ""
        );

      assert.ok(token);

      const persisted =
        JSON.parse(
          fs.readFileSync(
            dbPath,
            "utf8"
          )
        );

      const challenge =
        persisted.users[ownerUserId]
          ?.collaborativeListLinkInvites
          ?.[listId];

      assert.match(
        challenge?.tokenHash || "",
        /^[a-f0-9]{64}$/
      );

      assert.equal(
        Number(challenge?.issuedAt),
        Number(
          generated.json?.invite?.issuedAt
        )
      );

      assert.equal(
        JSON.stringify(persisted)
          .includes(token),
        false
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
  "regenerar el enlace colaborativo sustituye el challenge anterior",
  {
    timeout: 15000
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
                "w14-link-regenerate@example.test",
              password:
                "runtime-pass-123",
              name:
                "W14 Link Regenerate",
              language: "es"
            }
          }
        );

      assert.equal(
        registration.statusCode,
        200
      );

      const ownerCookie =
        registration.headers[
          "set-cookie"
        ][0].split(";")[0];

      const ownerUserId =
        registration.json?.user?.id;

      assert.ok(ownerUserId);

      const created =
        await requestJson(
          `${baseUrl}/api/lists`,
          {
            method: "POST",
            cookie: ownerCookie,
            body: {
              name:
                "Lista regenerable",
              description: "",
              visibility:
                "collab"
            }
          }
        );

      assert.equal(
        created.statusCode,
        201
      );

      const listId =
        created.json?.id;

      assert.ok(listId);

      const first =
        await requestJson(
          `${baseUrl}/api/lists/${encodeURIComponent(listId)}/link-invite`,
          {
            method: "POST",
            cookie: ownerCookie
          }
        );

      assert.equal(
        first.statusCode,
        201
      );

      const firstUrl =
        String(
          first.json?.invite?.url || ""
        );

      const firstToken =
        decodeURIComponent(
          firstUrl.split(
            "#list-invite="
          )[1] || ""
        );

      assert.ok(firstToken);

      const firstPersisted =
        JSON.parse(
          fs.readFileSync(
            dbPath,
            "utf8"
          )
        );

      const firstHash =
        firstPersisted.users[ownerUserId]
          ?.collaborativeListLinkInvites
          ?.[listId]
          ?.tokenHash;

      assert.match(
        firstHash || "",
        /^[a-f0-9]{64}$/
      );

      const second =
        await requestJson(
          `${baseUrl}/api/lists/${encodeURIComponent(listId)}/link-invite`,
          {
            method: "POST",
            cookie: ownerCookie
          }
        );

      assert.equal(
        second.statusCode,
        201
      );

      const secondUrl =
        String(
          second.json?.invite?.url || ""
        );

      const secondToken =
        decodeURIComponent(
          secondUrl.split(
            "#list-invite="
          )[1] || ""
        );

      assert.ok(secondToken);

      assert.notEqual(
        secondToken,
        firstToken
      );

      const secondPersisted =
        JSON.parse(
          fs.readFileSync(
            dbPath,
            "utf8"
          )
        );

      const secondHash =
        secondPersisted.users[ownerUserId]
          ?.collaborativeListLinkInvites
          ?.[listId]
          ?.tokenHash;

      assert.match(
        secondHash || "",
        /^[a-f0-9]{64}$/
      );

      assert.notEqual(
        secondHash,
        firstHash
      );

      assert.equal(
        JSON.stringify(secondPersisted)
          .includes(firstToken),
        false
      );

      assert.equal(
        JSON.stringify(secondPersisted)
          .includes(secondToken),
        false
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
  "el propietario puede revocar el enlace colaborativo",
  {
    timeout: 15000
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
                "w14-link-revoke@example.test",
              password:
                "runtime-pass-123",
              name:
                "W14 Link Revoke",
              language: "es"
            }
          }
        );

      assert.equal(
        registration.statusCode,
        200
      );

      const ownerCookie =
        registration.headers[
          "set-cookie"
        ][0].split(";")[0];

      const ownerUserId =
        registration.json?.user?.id;

      assert.ok(ownerUserId);

      const created =
        await requestJson(
          `${baseUrl}/api/lists`,
          {
            method: "POST",
            cookie: ownerCookie,
            body: {
              name:
                "Lista revocable",
              description: "",
              visibility:
                "collab"
            }
          }
        );

      assert.equal(
        created.statusCode,
        201
      );

      const listId =
        created.json?.id;

      assert.ok(listId);

      const generated =
        await requestJson(
          `${baseUrl}/api/lists/${encodeURIComponent(listId)}/link-invite`,
          {
            method: "POST",
            cookie: ownerCookie
          }
        );

      assert.equal(
        generated.statusCode,
        201
      );

      const before =
        JSON.parse(
          fs.readFileSync(
            dbPath,
            "utf8"
          )
        );

      assert.ok(
        before.users[ownerUserId]
          ?.collaborativeListLinkInvites
          ?.[listId]
      );

      const revoked =
        await requestJson(
          `${baseUrl}/api/lists/${encodeURIComponent(listId)}/link-invite`,
          {
            method: "DELETE",
            cookie: ownerCookie
          }
        );

      assert.equal(
        revoked.statusCode,
        200
      );

      assert.equal(
        revoked.json?.revoked,
        true
      );

      assert.equal(
        revoked.json?.list?.id,
        listId
      );

      const persisted =
        JSON.parse(
          fs.readFileSync(
            dbPath,
            "utf8"
          )
        );

      assert.equal(
        persisted.users[ownerUserId]
          ?.collaborativeListLinkInvites
          ?.[listId],
        undefined
      );

      assert.ok(
        persisted.users[ownerUserId]
          ?.lists
          ?.some(
            (list) =>
              String(list?.id) === listId
          )
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
  "un usuario autenticado puede unirse como colaborador mediante un enlace válido",
  {
    timeout: 15000
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

      const ownerRegistration =
        await requestJson(
          `${baseUrl}/api/auth/register`,
          {
            method: "POST",
            body: {
              email:
                "w14-link-accept-owner@example.test",
              password:
                "runtime-pass-123",
              name:
                "W14 Link Accept Owner",
              language: "es"
            }
          }
        );

      assert.equal(
        ownerRegistration.statusCode,
        200
      );

      const ownerCookie =
        ownerRegistration.headers[
          "set-cookie"
        ][0].split(";")[0];

      const ownerUserId =
        ownerRegistration.json?.user?.id;

      const inviteeRegistration =
        await requestJson(
          `${baseUrl}/api/auth/register`,
          {
            method: "POST",
            body: {
              email:
                "w14-link-accept-user@example.test",
              password:
                "runtime-pass-123",
              name:
                "W14 Link Accept User",
              language: "es"
            }
          }
        );

      assert.equal(
        inviteeRegistration.statusCode,
        200
      );

      const inviteeCookie =
        inviteeRegistration.headers[
          "set-cookie"
        ][0].split(";")[0];

      const inviteeUserId =
        inviteeRegistration.json?.user?.id;

      assert.ok(ownerUserId);
      assert.ok(inviteeUserId);

      const created =
        await requestJson(
          `${baseUrl}/api/lists`,
          {
            method: "POST",
            cookie: ownerCookie,
            body: {
              name:
                "Lista para aceptar enlace",
              description: "",
              visibility:
                "collab"
            }
          }
        );

      assert.equal(
        created.statusCode,
        201
      );

      const listId =
        created.json?.id;

      assert.ok(listId);

      const generated =
        await requestJson(
          `${baseUrl}/api/lists/${encodeURIComponent(listId)}/link-invite`,
          {
            method: "POST",
            cookie: ownerCookie
          }
        );

      assert.equal(
        generated.statusCode,
        201
      );

      const inviteUrl =
        String(
          generated.json?.invite?.url ||
          ""
        );

      const token =
        decodeURIComponent(
          inviteUrl.split(
            "#list-invite="
          )[1] || ""
        );

      assert.ok(token);

      const accepted =
        await requestJson(
          `${baseUrl}/api/user/list-invites/link/accept`,
          {
            method: "POST",
            cookie: inviteeCookie,
            body: {
              token
            }
          }
        );

      assert.equal(
        accepted.statusCode,
        200
      );

      assert.equal(
        accepted.json?.accepted,
        true
      );

      assert.equal(
        accepted.json?.list?.id,
        listId
      );

      const persisted =
        JSON.parse(
          fs.readFileSync(
            dbPath,
            "utf8"
          )
        );

      const persistedList =
        persisted.users[ownerUserId]
          ?.lists
          ?.find(
            (list) =>
              String(list?.id) === listId
          );

      assert.ok(persistedList);

      assert.deepEqual(
        persistedList.collaborators,
        [
          inviteeUserId
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


test(
  "un enlace regenerado o revocado deja de permitir unirse a la lista",
  {
    timeout: 15000
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

      const ownerRegistration =
        await requestJson(
          `${baseUrl}/api/auth/register`,
          {
            method: "POST",
            body: {
              email:
                "w14-link-invalid-owner@example.test",
              password:
                "runtime-pass-123",
              name:
                "W14 Link Invalid Owner",
              language: "es"
            }
          }
        );

      assert.equal(
        ownerRegistration.statusCode,
        200
      );

      const ownerCookie =
        ownerRegistration.headers[
          "set-cookie"
        ][0].split(";")[0];

      const inviteeRegistration =
        await requestJson(
          `${baseUrl}/api/auth/register`,
          {
            method: "POST",
            body: {
              email:
                "w14-link-invalid-user@example.test",
              password:
                "runtime-pass-123",
              name:
                "W14 Link Invalid User",
              language: "es"
            }
          }
        );

      assert.equal(
        inviteeRegistration.statusCode,
        200
      );

      const inviteeCookie =
        inviteeRegistration.headers[
          "set-cookie"
        ][0].split(";")[0];

      const created =
        await requestJson(
          `${baseUrl}/api/lists`,
          {
            method: "POST",
            cookie: ownerCookie,
            body: {
              name:
                "Lista con enlace invalidable",
              description: "",
              visibility:
                "collab"
            }
          }
        );

      assert.equal(
        created.statusCode,
        201
      );

      const listId =
        created.json?.id;

      assert.ok(listId);

      const first =
        await requestJson(
          `${baseUrl}/api/lists/${encodeURIComponent(listId)}/link-invite`,
          {
            method: "POST",
            cookie: ownerCookie
          }
        );

      assert.equal(
        first.statusCode,
        201
      );

      const firstToken =
        decodeURIComponent(
          String(
            first.json?.invite?.url || ""
          ).split(
            "#list-invite="
          )[1] || ""
        );

      assert.ok(firstToken);

      const second =
        await requestJson(
          `${baseUrl}/api/lists/${encodeURIComponent(listId)}/link-invite`,
          {
            method: "POST",
            cookie: ownerCookie
          }
        );

      assert.equal(
        second.statusCode,
        201
      );

      const secondToken =
        decodeURIComponent(
          String(
            second.json?.invite?.url || ""
          ).split(
            "#list-invite="
          )[1] || ""
        );

      assert.ok(secondToken);
      assert.notEqual(
        secondToken,
        firstToken
      );

      const oldTokenAttempt =
        await requestJson(
          `${baseUrl}/api/user/list-invites/link/accept`,
          {
            method: "POST",
            cookie: inviteeCookie,
            body: {
              token: firstToken
            }
          }
        );

      assert.equal(
        oldTokenAttempt.statusCode,
        404
      );

      assert.equal(
        oldTokenAttempt.json?.error,
        "invite_not_found"
      );

      const revoked =
        await requestJson(
          `${baseUrl}/api/lists/${encodeURIComponent(listId)}/link-invite`,
          {
            method: "DELETE",
            cookie: ownerCookie
          }
        );

      assert.equal(
        revoked.statusCode,
        200
      );

      const revokedTokenAttempt =
        await requestJson(
          `${baseUrl}/api/user/list-invites/link/accept`,
          {
            method: "POST",
            cookie: inviteeCookie,
            body: {
              token: secondToken
            }
          }
        );

      assert.equal(
        revokedTokenAttempt.statusCode,
        404
      );

      assert.equal(
        revokedTokenAttempt.json?.error,
        "invite_not_found"
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
  "el propietario y un colaborador existente no pueden aceptar de nuevo el enlace",
  {
    timeout: 15000
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

      const ownerRegistration =
        await requestJson(
          `${baseUrl}/api/auth/register`,
          {
            method: "POST",
            body: {
              email:
                "w14-link-identity-owner@example.test",
              password:
                "runtime-pass-123",
              name:
                "W14 Link Identity Owner",
              language: "es"
            }
          }
        );

      assert.equal(
        ownerRegistration.statusCode,
        200
      );

      const ownerCookie =
        ownerRegistration.headers[
          "set-cookie"
        ][0].split(";")[0];

      const inviteeRegistration =
        await requestJson(
          `${baseUrl}/api/auth/register`,
          {
            method: "POST",
            body: {
              email:
                "w14-link-identity-user@example.test",
              password:
                "runtime-pass-123",
              name:
                "W14 Link Identity User",
              language: "es"
            }
          }
        );

      assert.equal(
        inviteeRegistration.statusCode,
        200
      );

      const inviteeCookie =
        inviteeRegistration.headers[
          "set-cookie"
        ][0].split(";")[0];

      const created =
        await requestJson(
          `${baseUrl}/api/lists`,
          {
            method: "POST",
            cookie: ownerCookie,
            body: {
              name:
                "Lista identidad enlace",
              description: "",
              visibility:
                "collab"
            }
          }
        );

      assert.equal(
        created.statusCode,
        201
      );

      const listId =
        created.json?.id;

      assert.ok(listId);

      const generated =
        await requestJson(
          `${baseUrl}/api/lists/${encodeURIComponent(listId)}/link-invite`,
          {
            method: "POST",
            cookie: ownerCookie
          }
        );

      assert.equal(
        generated.statusCode,
        201
      );

      const token =
        decodeURIComponent(
          String(
            generated.json?.invite?.url ||
            ""
          ).split(
            "#list-invite="
          )[1] || ""
        );

      assert.ok(token);

      const ownerAttempt =
        await requestJson(
          `${baseUrl}/api/user/list-invites/link/accept`,
          {
            method: "POST",
            cookie: ownerCookie,
            body: {
              token
            }
          }
        );

      assert.equal(
        ownerAttempt.statusCode,
        409
      );

      assert.equal(
        ownerAttempt.json?.error,
        "cannot_add_owner"
      );

      const firstAcceptance =
        await requestJson(
          `${baseUrl}/api/user/list-invites/link/accept`,
          {
            method: "POST",
            cookie: inviteeCookie,
            body: {
              token
            }
          }
        );

      assert.equal(
        firstAcceptance.statusCode,
        200
      );

      assert.equal(
        firstAcceptance.json?.accepted,
        true
      );

      const secondAcceptance =
        await requestJson(
          `${baseUrl}/api/user/list-invites/link/accept`,
          {
            method: "POST",
            cookie: inviteeCookie,
            body: {
              token
            }
          }
        );

      assert.equal(
        secondAcceptance.statusCode,
        409
      );

      assert.equal(
        secondAcceptance.json?.error,
        "already_collaborator"
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
  "el enlace queda inactivo fuera de modo colaborativo y vuelve a funcionar al reactivarlo",
  {
    timeout: 15000
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

      const ownerRegistration =
        await requestJson(
          `${baseUrl}/api/auth/register`,
          {
            method: "POST",
            body: {
              email:
                "w14-link-visibility-owner@example.test",
              password:
                "runtime-pass-123",
              name:
                "W14 Link Visibility Owner",
              language: "es"
            }
          }
        );

      assert.equal(
        ownerRegistration.statusCode,
        200
      );

      const ownerCookie =
        ownerRegistration.headers[
          "set-cookie"
        ][0].split(";")[0];

      const inviteeRegistration =
        await requestJson(
          `${baseUrl}/api/auth/register`,
          {
            method: "POST",
            body: {
              email:
                "w14-link-visibility-user@example.test",
              password:
                "runtime-pass-123",
              name:
                "W14 Link Visibility User",
              language: "es"
            }
          }
        );

      assert.equal(
        inviteeRegistration.statusCode,
        200
      );

      const inviteeCookie =
        inviteeRegistration.headers[
          "set-cookie"
        ][0].split(";")[0];

      const created =
        await requestJson(
          `${baseUrl}/api/lists`,
          {
            method: "POST",
            cookie: ownerCookie,
            body: {
              name:
                "Lista visibilidad enlace",
              description: "",
              visibility:
                "collab"
            }
          }
        );

      assert.equal(
        created.statusCode,
        201
      );

      const listId =
        created.json?.id;

      assert.ok(listId);

      const generated =
        await requestJson(
          `${baseUrl}/api/lists/${encodeURIComponent(listId)}/link-invite`,
          {
            method: "POST",
            cookie: ownerCookie
          }
        );

      assert.equal(
        generated.statusCode,
        201
      );

      const token =
        decodeURIComponent(
          String(
            generated.json?.invite?.url ||
            ""
          ).split(
            "#list-invite="
          )[1] || ""
        );

      assert.ok(token);

      const madePrivate =
        await requestJson(
          `${baseUrl}/api/lists/${encodeURIComponent(listId)}`,
          {
            method: "PATCH",
            cookie: ownerCookie,
            body: {
              visibility: "private"
            }
          }
        );

      assert.equal(
        madePrivate.statusCode,
        200
      );

      const inactiveAttempt =
        await requestJson(
          `${baseUrl}/api/user/list-invites/link/accept`,
          {
            method: "POST",
            cookie: inviteeCookie,
            body: {
              token
            }
          }
        );

      assert.equal(
        inactiveAttempt.statusCode,
        400
      );

      assert.equal(
        inactiveAttempt.json?.error,
        "list_not_collaborative"
      );

      const madeCollaborative =
        await requestJson(
          `${baseUrl}/api/lists/${encodeURIComponent(listId)}`,
          {
            method: "PATCH",
            cookie: ownerCookie,
            body: {
              visibility: "collab"
            }
          }
        );

      assert.equal(
        madeCollaborative.statusCode,
        200
      );

      const activeAgain =
        await requestJson(
          `${baseUrl}/api/user/list-invites/link/accept`,
          {
            method: "POST",
            cookie: inviteeCookie,
            body: {
              token
            }
          }
        );

      assert.equal(
        activeAgain.statusCode,
        200
      );

      assert.equal(
        activeAgain.json?.accepted,
        true
      );

      assert.equal(
        activeAgain.json?.list?.id,
        listId
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
  "deshacer el borrado restaura también el challenge privado del enlace colaborativo",
  {
    timeout: 15000
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
                "w14-link-undo@example.test",
              password:
                "runtime-pass-123",
              name:
                "W14 Link Undo",
              language: "es"
            }
          }
        );

      assert.equal(
        registration.statusCode,
        200
      );

      const cookie =
        registration.headers[
          "set-cookie"
        ][0].split(";")[0];

      const userId =
        registration.json?.user?.id;

      assert.ok(userId);

      const created =
        await requestJson(
          `${baseUrl}/api/lists`,
          {
            method: "POST",
            cookie,
            body: {
              name:
                "Lista enlace undo",
              description:
                "Antes de borrar",
              visibility:
                "collab"
            }
          }
        );

      assert.equal(
        created.statusCode,
        201
      );

      const listId =
        created.json?.id;

      assert.ok(listId);

      const generated =
        await requestJson(
          `${baseUrl}/api/lists/${encodeURIComponent(listId)}/link-invite`,
          {
            method: "POST",
            cookie
          }
        );

      assert.equal(
        generated.statusCode,
        201
      );

      const beforeDelete =
        JSON.parse(
          fs.readFileSync(
            dbPath,
            "utf8"
          )
        );

      const originalChallenge =
        beforeDelete.users[userId]
          ?.collaborativeListLinkInvites
          ?.[listId];

      assert.match(
        originalChallenge?.tokenHash || "",
        /^[a-f0-9]{64}$/
      );

      const deleted =
        await requestJson(
          `${baseUrl}/api/lists/${encodeURIComponent(listId)}`,
          {
            method: "DELETE",
            cookie
          }
        );

      assert.equal(
        deleted.statusCode,
        200
      );

      const afterDelete =
        JSON.parse(
          fs.readFileSync(
            dbPath,
            "utf8"
          )
        );

      assert.equal(
        afterDelete.users[userId]
          ?.collaborativeListLinkInvites
          ?.[listId],
        undefined
      );

      assert.deepEqual(
        afterDelete.users[userId]
          ?.deletedListCollaboration
          ?.linkInvite,
        originalChallenge
      );

      const restored =
        await requestJson(
          `${baseUrl}/api/lists`,
          {
            method: "PUT",
            cookie,
            body: {
              lists: [
                {
                  id: listId,
                  name:
                    "Lista enlace undo",
                  description:
                    "Antes de borrar",
                  visibility:
                    "collab",
                  items: [],
                  createdAt:
                    created.json?.createdAt
                }
              ]
            }
          }
        );

      assert.equal(
        restored.statusCode,
        200
      );

      const afterRestore =
        JSON.parse(
          fs.readFileSync(
            dbPath,
            "utf8"
          )
        );

      assert.deepEqual(
        afterRestore.users[userId]
          ?.collaborativeListLinkInvites
          ?.[listId],
        originalChallenge
      );

      assert.equal(
        afterRestore.users[userId]
          ?.deletedListCollaboration,
        undefined
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
