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


test(
  "un colaborador puede abandonar una lista colaborativa",
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
                "w14-leave-owner@example.test",
              password:
                "runtime-pass-123",
              name:
                "W14 Leave Owner",
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

      const collaboratorRegistration =
        await requestJson(
          `${baseUrl}/api/auth/register`,
          {
            method: "POST",
            body: {
              email:
                "w14-leave-collaborator@example.test",
              password:
                "runtime-pass-123",
              name:
                "W14 Leave Collaborator",
              language: "es"
            }
          }
        );

      assert.equal(
        collaboratorRegistration.statusCode,
        200
      );

      const collaboratorCookie =
        collaboratorRegistration.headers[
          "set-cookie"
        ][0].split(";")[0];

      const collaboratorUserId =
        collaboratorRegistration.json?.user?.id;

      const collaboratorUsername =
        collaboratorRegistration.json?.user
          ?.handle;

      assert.ok(ownerUserId);
      assert.ok(collaboratorUserId);
      assert.ok(collaboratorUsername);

      const privacyUpdated =
        await requestJson(
          `${baseUrl}/api/user/privacy`,
          {
            method: "PATCH",
            cookie:
              collaboratorCookie,
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
                "Lista para abandonar",
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
          `${baseUrl}/api/lists/${encodeURIComponent(listId)}/invites/${encodeURIComponent(collaboratorUsername)}`,
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
              collaboratorCookie
          }
        );

      assert.equal(
        accepted.statusCode,
        200
      );

      const left =
        await requestJson(
          `${baseUrl}/api/lists/${encodeURIComponent(listId)}/members/me`,
          {
            method: "DELETE",
            cookie:
              collaboratorCookie
          }
        );

      assert.equal(
        left.statusCode,
        200
      );

      assert.equal(
        left.json?.left,
        true
      );

      assert.equal(
        left.json?.list?.id,
        listId
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
  "el propietario puede expulsar a un colaborador de su lista",
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
                "w14-kick-owner@example.test",
              password:
                "runtime-pass-123",
              name:
                "W14 Kick Owner",
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

      const collaboratorRegistration =
        await requestJson(
          `${baseUrl}/api/auth/register`,
          {
            method: "POST",
            body: {
              email:
                "w14-kick-collaborator@example.test",
              password:
                "runtime-pass-123",
              name:
                "W14 Kick Collaborator",
              language: "es"
            }
          }
        );

      assert.equal(
        collaboratorRegistration.statusCode,
        200
      );

      const collaboratorCookie =
        collaboratorRegistration.headers[
          "set-cookie"
        ][0].split(";")[0];

      const collaboratorUserId =
        collaboratorRegistration.json?.user?.id;

      const collaboratorUsername =
        collaboratorRegistration.json?.user
          ?.handle;

      assert.ok(ownerUserId);
      assert.ok(collaboratorUserId);
      assert.ok(collaboratorUsername);

      const privacyUpdated =
        await requestJson(
          `${baseUrl}/api/user/privacy`,
          {
            method: "PATCH",
            cookie:
              collaboratorCookie,
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
                "Lista para expulsar",
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
          `${baseUrl}/api/lists/${encodeURIComponent(listId)}/invites/${encodeURIComponent(collaboratorUsername)}`,
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
              collaboratorCookie
          }
        );

      assert.equal(
        accepted.statusCode,
        200
      );

      const removed =
        await requestJson(
          `${baseUrl}/api/lists/${encodeURIComponent(listId)}/members/${encodeURIComponent(collaboratorUserId)}`,
          {
            method: "DELETE",
            cookie:
              ownerCookie
          }
        );

      assert.equal(
        removed.statusCode,
        200
      );

      assert.equal(
        removed.json?.removed,
        true
      );

      assert.equal(
        removed.json?.list?.id,
        listId
      );

      assert.equal(
        removed.json?.userId,
        collaboratorUserId
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
  "los permisos de miembros se aplican también ante llamadas directas a la API",
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

      const register = async ({
        email,
        name
      }) => {
        const response =
          await requestJson(
            `${baseUrl}/api/auth/register`,
            {
              method: "POST",
              body: {
                email,
                password:
                  "runtime-pass-123",
                name,
                language: "es"
              }
            }
          );

        assert.equal(
          response.statusCode,
          200
        );

        return {
          cookie:
            response.headers[
              "set-cookie"
            ][0].split(";")[0],
          userId:
            response.json?.user?.id,
          username:
            response.json?.user?.handle
        };
      };

      const owner =
        await register({
          email:
            "w14-members-owner@example.test",
          name:
            "W14 Members Owner"
        });

      const collaboratorA =
        await register({
          email:
            "w14-members-a@example.test",
          name:
            "W14 Members A"
        });

      const collaboratorB =
        await register({
          email:
            "w14-members-b@example.test",
          name:
            "W14 Members B"
        });

      assert.ok(owner.userId);
      assert.ok(collaboratorA.userId);
      assert.ok(collaboratorB.userId);
      assert.ok(collaboratorA.username);
      assert.ok(collaboratorB.username);

      for (const collaborator of [
        collaboratorA,
        collaboratorB
      ]) {
        const privacyUpdated =
          await requestJson(
            `${baseUrl}/api/user/privacy`,
            {
              method: "PATCH",
              cookie:
                collaborator.cookie,
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
      }

      const created =
        await requestJson(
          `${baseUrl}/api/lists`,
          {
            method: "POST",
            cookie:
              owner.cookie,
            body: {
              name:
                "Lista de permisos",
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

      for (const collaborator of [
        collaboratorA,
        collaboratorB
      ]) {
        const invited =
          await requestJson(
            `${baseUrl}/api/lists/${encodeURIComponent(listId)}/invites/${encodeURIComponent(collaborator.username)}`,
            {
              method: "POST",
              cookie:
                owner.cookie
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
                collaborator.cookie
            }
          );

        assert.equal(
          accepted.statusCode,
          200
        );
      }

      const collaboratorKick =
        await requestJson(
          `${baseUrl}/api/lists/${encodeURIComponent(listId)}/members/${encodeURIComponent(collaboratorB.userId)}`,
          {
            method: "DELETE",
            cookie:
              collaboratorA.cookie
          }
        );

      assert.equal(
        collaboratorKick.statusCode,
        404
      );

      const ownerRemoveSelf =
        await requestJson(
          `${baseUrl}/api/lists/${encodeURIComponent(listId)}/members/${encodeURIComponent(owner.userId)}`,
          {
            method: "DELETE",
            cookie:
              owner.cookie
          }
        );

      assert.equal(
        ownerRemoveSelf.statusCode,
        400
      );

      assert.equal(
        ownerRemoveSelf.json?.error,
        "cannot_remove_owner"
      );

      const ownerLeave =
        await requestJson(
          `${baseUrl}/api/lists/${encodeURIComponent(listId)}/members/me`,
          {
            method: "DELETE",
            cookie:
              owner.cookie
          }
        );

      assert.equal(
        ownerLeave.statusCode,
        409
      );

      assert.equal(
        ownerLeave.json?.error,
        "owner_cannot_leave"
      );

      const persisted =
        JSON.parse(
          fs.readFileSync(
            dbPath,
            "utf8"
          )
        );

      assert.deepEqual(
        persisted.users[owner.userId]
          .lists[0]
          .collaborators,
        [
          collaboratorA.userId,
          collaboratorB.userId
        ]
      );

      assert.equal(
        persisted.users[owner.userId]
          .lists[0]
          .ownerUserId,
        owner.userId
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
  "GET /api/lists incluye listas compartidas y PUT no las materializa en el bucket del colaborador",
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
                "w14-shared-read-owner@example.test",
              password:
                "runtime-pass-123",
              name:
                "W14 Shared Read Owner",
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

      const collaboratorRegistration =
        await requestJson(
          `${baseUrl}/api/auth/register`,
          {
            method: "POST",
            body: {
              email:
                "w14-shared-read-collaborator@example.test",
              password:
                "runtime-pass-123",
              name:
                "W14 Shared Read Collaborator",
              language: "es"
            }
          }
        );

      assert.equal(
        collaboratorRegistration.statusCode,
        200
      );

      const collaboratorCookie =
        collaboratorRegistration.headers[
          "set-cookie"
        ][0].split(";")[0];

      const collaboratorUserId =
        collaboratorRegistration.json?.user?.id;

      const collaboratorUsername =
        collaboratorRegistration.json?.user
          ?.handle;

      assert.ok(ownerUserId);
      assert.ok(collaboratorUserId);
      assert.ok(collaboratorUsername);

      const privacyUpdated =
        await requestJson(
          `${baseUrl}/api/user/privacy`,
          {
            method: "PATCH",
            cookie:
              collaboratorCookie,
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
                "Lista compartida visible",
              description:
                "Debe verla el colaborador",
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
          `${baseUrl}/api/lists/${encodeURIComponent(listId)}/invites/${encodeURIComponent(collaboratorUsername)}`,
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
              collaboratorCookie
          }
        );

      assert.equal(
        accepted.statusCode,
        200
      );

      const collaboratorLists =
        await requestJson(
          `${baseUrl}/api/lists`,
          {
            cookie:
              collaboratorCookie
          }
        );

      assert.equal(
        collaboratorLists.statusCode,
        200
      );

      assert.equal(
        Array.isArray(collaboratorLists.json),
        true
      );

      const sharedList =
        collaboratorLists.json.find(
          (list) =>
            String(list?.id || "") ===
            listId
        );

      assert.ok(sharedList);

      assert.equal(
        sharedList.ownerUserId,
        ownerUserId
      );

      assert.deepEqual(
        sharedList.collaborators,
        [
          collaboratorUserId
        ]
      );

      const putPayloadLists =
        collaboratorLists.json.map(
          (list) => ({
            id: list?.id,
            name: list?.name,
            description:
              list?.description,
            visibility:
              list?.visibility,
            items:
              Array.isArray(list?.items)
                ? list.items
                : [],
            createdAt:
              list?.createdAt,
            updatedAt:
              list?.updatedAt
          })
        );

      const rewritten =
        await requestJson(
          `${baseUrl}/api/lists`,
          {
            method: "PUT",
            cookie:
              collaboratorCookie,
            body: {
              lists:
                putPayloadLists
            }
          }
        );

      assert.equal(
        rewritten.statusCode,
        200
      );

      assert.equal(
        Array.isArray(
          rewritten.json?.lists
        ),
        true
      );

      assert.equal(
        rewritten.json.lists.length,
        1
      );

      const rewrittenSharedList =
        rewritten.json.lists.find(
          (list) =>
            String(
              list?.id || ""
            ) === listId
        );

      assert.ok(
        rewrittenSharedList
      );

      assert.equal(
        rewrittenSharedList.ownerUserId,
        ownerUserId
      );

      assert.deepEqual(
        rewrittenSharedList.collaborators,
        [
          collaboratorUserId
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
        persisted.users[ownerUserId]
          .lists.length,
        1
      );

      assert.equal(
        persisted.users[collaboratorUserId]
          .lists.length,
        0
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
  "un colaborador puede añadir desde su Library un item canónico a la lista del propietario",
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
                "w14-content-owner@example.test",
              password:
                "runtime-pass-123",
              name:
                "W14 Content Owner",
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

      const collaboratorRegistration =
        await requestJson(
          `${baseUrl}/api/auth/register`,
          {
            method: "POST",
            body: {
              email:
                "w14-content-collaborator@example.test",
              password:
                "runtime-pass-123",
              name:
                "W14 Content Collaborator",
              language: "es"
            }
          }
        );

      assert.equal(
        collaboratorRegistration.statusCode,
        200
      );

      const collaboratorCookie =
        collaboratorRegistration.headers[
          "set-cookie"
        ][0].split(";")[0];

      const collaboratorUserId =
        collaboratorRegistration.json?.user?.id;

      const collaboratorUsername =
        collaboratorRegistration.json?.user
          ?.handle;

      assert.ok(ownerUserId);
      assert.ok(collaboratorUserId);
      assert.ok(collaboratorUsername);

      const privacyUpdated =
        await requestJson(
          `${baseUrl}/api/user/privacy`,
          {
            method: "PATCH",
            cookie:
              collaboratorCookie,
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
                "Lista colaborativa con contenido",
              description:
                "Contenido añadido por colaborador",
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
          `${baseUrl}/api/lists/${encodeURIComponent(listId)}/invites/${encodeURIComponent(collaboratorUsername)}`,
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
              collaboratorCookie
          }
        );

      assert.equal(
        accepted.statusCode,
        200
      );

      const collaboratorItemId =
        "w14_collaborator_movie_603";

      const restored =
        await requestJson(
          `${baseUrl}/api/library/restore`,
          {
            method: "POST",
            cookie:
              collaboratorCookie,
            body: {
              item: {
                id:
                  collaboratorItemId,
                type:
                  "pelicula",
                title:
                  "Matrix compartida",
                source:
                  "tmdb",
                externalId:
                  "603",
                cover:
                  "https://image.example.test/matrix.jpg",
                status:
                  "pending",
                progress:
                  0
              }
            }
          }
        );

      assert.equal(
        restored.statusCode,
        201
      );

      const added =
        await requestJson(
          `${baseUrl}/api/lists/${encodeURIComponent(listId)}/items`,
          {
            method: "POST",
            cookie:
              collaboratorCookie,
            body: {
              itemId:
                collaboratorItemId
            }
          }
        );

      assert.equal(
        added.statusCode,
        201
      );

      assert.equal(
        added.json?.itemId,
        collaboratorItemId
      );

      const listItem =
        added.json?.list?.items?.find(
          (entry) =>
            String(entry?.id || "") ===
            collaboratorItemId
        );

      assert.ok(listItem);

      assert.equal(
        listItem.source,
        "tmdb"
      );

      assert.equal(
        listItem.type,
        "pelicula"
      );

      assert.equal(
        listItem.externalId,
        "603"
      );

      assert.deepEqual(
        listItem.itemSnapshot,
        {
          title:
            "Matrix compartida",
          cover:
            "https://image.example.test/matrix.jpg"
        }
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
          .lists.length,
        1
      );

      assert.equal(
        persisted.users[collaboratorUserId]
          .lists.length,
        0
      );

      assert.equal(
        persisted.users[ownerUserId]
          .library.length,
        0
      );

      assert.equal(
        persisted.users[collaboratorUserId]
          .library.length,
        1
      );

      assert.deepEqual(
        persisted.users[ownerUserId]
          .lists[0]
          .items[0],
        listItem
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
  "una lista colaborativa evita duplicados por identidad canónica aunque los IDs locales sean distintos",
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
                "w14-canonical-owner@example.test",
              password:
                "runtime-pass-123",
              name:
                "W14 Canonical Owner",
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

      const collaboratorRegistration =
        await requestJson(
          `${baseUrl}/api/auth/register`,
          {
            method: "POST",
            body: {
              email:
                "w14-canonical-collaborator@example.test",
              password:
                "runtime-pass-123",
              name:
                "W14 Canonical Collaborator",
              language: "es"
            }
          }
        );

      assert.equal(
        collaboratorRegistration.statusCode,
        200
      );

      const collaboratorCookie =
        collaboratorRegistration.headers[
          "set-cookie"
        ][0].split(";")[0];

      const collaboratorUserId =
        collaboratorRegistration.json?.user?.id;

      const collaboratorUsername =
        collaboratorRegistration.json?.user
          ?.handle;

      assert.ok(ownerUserId);
      assert.ok(collaboratorUserId);
      assert.ok(collaboratorUsername);

      const privacyUpdated =
        await requestJson(
          `${baseUrl}/api/user/privacy`,
          {
            method: "PATCH",
            cookie:
              collaboratorCookie,
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

      const ownerItemId =
        "owner_matrix_603";

      const collaboratorItemId =
        "collaborator_matrix_603";

      const ownerRestore =
        await requestJson(
          `${baseUrl}/api/library/restore`,
          {
            method: "POST",
            cookie:
              ownerCookie,
            body: {
              item: {
                id:
                  ownerItemId,
                type:
                  "pelicula",
                title:
                  "Matrix",
                source:
                  "tmdb",
                externalId:
                  "603",
                cover:
                  "https://image.example.test/matrix-owner.jpg",
                status:
                  "pending"
              }
            }
          }
        );

      assert.equal(
        ownerRestore.statusCode,
        201
      );

      const collaboratorRestore =
        await requestJson(
          `${baseUrl}/api/library/restore`,
          {
            method: "POST",
            cookie:
              collaboratorCookie,
            body: {
              item: {
                id:
                  collaboratorItemId,
                type:
                  "pelicula",
                title:
                  "Matrix",
                source:
                  "tmdb",
                externalId:
                  "603",
                cover:
                  "https://image.example.test/matrix-collaborator.jpg",
                status:
                  "pending"
              }
            }
          }
        );

      assert.equal(
        collaboratorRestore.statusCode,
        201
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
                "Lista sin duplicados canónicos",
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

      const ownerAdded =
        await requestJson(
          `${baseUrl}/api/lists/${encodeURIComponent(listId)}/items`,
          {
            method: "POST",
            cookie:
              ownerCookie,
            body: {
              itemId:
                ownerItemId
            }
          }
        );

      assert.equal(
        ownerAdded.statusCode,
        201
      );

      const invited =
        await requestJson(
          `${baseUrl}/api/lists/${encodeURIComponent(listId)}/invites/${encodeURIComponent(collaboratorUsername)}`,
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
              collaboratorCookie
          }
        );

      assert.equal(
        accepted.statusCode,
        200
      );

      const duplicateAdd =
        await requestJson(
          `${baseUrl}/api/lists/${encodeURIComponent(listId)}/items`,
          {
            method: "POST",
            cookie:
              collaboratorCookie,
            body: {
              itemId:
                collaboratorItemId
            }
          }
        );

      assert.equal(
        duplicateAdd.statusCode,
        200
      );

      assert.equal(
        duplicateAdd.json?.already,
        true
      );

      assert.equal(
        duplicateAdd.json?.list?.items?.length,
        1
      );

      assert.equal(
        duplicateAdd.json?.list?.items?.[0]?.id,
        ownerItemId
      );

      assert.equal(
        duplicateAdd.json?.list?.items?.[0]?.source,
        "tmdb"
      );

      assert.equal(
        duplicateAdd.json?.list?.items?.[0]?.type,
        "pelicula"
      );

      assert.equal(
        duplicateAdd.json?.list?.items?.[0]?.externalId,
        "603"
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
          .lists[0]
          .items.length,
        1
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
  "PUT /api/lists preserva la identidad canónica y snapshot de los items",
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
                "w14-put-canonical@example.test",
              password:
                "runtime-pass-123",
              name:
                "W14 Put Canonical",
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

      const created =
        await requestJson(
          `${baseUrl}/api/lists`,
          {
            method: "POST",
            cookie,
            body: {
              name:
                "Lista identidad persistente",
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

      const item = {
        id:
          "local_matrix_603",
        source:
          "tmdb",
        type:
          "pelicula",
        externalId:
          "603",
        itemSnapshot: {
          title:
            "Matrix persistente",
          cover:
            "https://image.example.test/matrix-put.jpg"
        },
        addedAt:
          "2026-09-29T10:00:00.000Z"
      };

      const response =
        await requestJson(
          `${baseUrl}/api/lists`,
          {
            method: "PUT",
            cookie,
            body: {
              lists: [
                {
                  ...created.json,
                  items: [
                    item
                  ],
                  itemsCount: 1
                }
              ]
            }
          }
        );

      assert.equal(
        response.statusCode,
        200
      );

      assert.deepEqual(
        response.json?.lists?.[0]
          ?.items?.[0],
        item
      );

      const persisted =
        JSON.parse(
          fs.readFileSync(
            dbPath,
            "utf8"
          )
        );

      assert.deepEqual(
        persisted.users[userId]
          .lists[0]
          .items[0],
        item
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
  "un colaborador puede eliminar por identidad canónica un item añadido por el propietario",
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
                "w14-remove-owner@example.test",
              password:
                "runtime-pass-123",
              name:
                "W14 Remove Owner",
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

      const collaboratorRegistration =
        await requestJson(
          `${baseUrl}/api/auth/register`,
          {
            method: "POST",
            body: {
              email:
                "w14-remove-collaborator@example.test",
              password:
                "runtime-pass-123",
              name:
                "W14 Remove Collaborator",
              language: "es"
            }
          }
        );

      assert.equal(
        collaboratorRegistration.statusCode,
        200
      );

      const collaboratorCookie =
        collaboratorRegistration.headers[
          "set-cookie"
        ][0].split(";")[0];

      const collaboratorUsername =
        collaboratorRegistration.json?.user
          ?.handle;

      assert.ok(ownerUserId);
      assert.ok(collaboratorUsername);

      const privacyUpdated =
        await requestJson(
          `${baseUrl}/api/user/privacy`,
          {
            method: "PATCH",
            cookie:
              collaboratorCookie,
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

      const ownerItemId =
        "owner_remove_matrix_603";

      const collaboratorItemId =
        "collaborator_remove_matrix_603";

      const ownerRestore =
        await requestJson(
          `${baseUrl}/api/library/restore`,
          {
            method: "POST",
            cookie:
              ownerCookie,
            body: {
              item: {
                id:
                  ownerItemId,
                type:
                  "pelicula",
                title:
                  "Matrix",
                source:
                  "tmdb",
                externalId:
                  "603",
                cover:
                  "https://image.example.test/matrix-owner-remove.jpg",
                status:
                  "pending"
              }
            }
          }
        );

      assert.equal(
        ownerRestore.statusCode,
        201
      );

      const collaboratorRestore =
        await requestJson(
          `${baseUrl}/api/library/restore`,
          {
            method: "POST",
            cookie:
              collaboratorCookie,
            body: {
              item: {
                id:
                  collaboratorItemId,
                type:
                  "pelicula",
                title:
                  "Matrix",
                source:
                  "tmdb",
                externalId:
                  "603",
                cover:
                  "https://image.example.test/matrix-collaborator-remove.jpg",
                status:
                  "pending"
              }
            }
          }
        );

      assert.equal(
        collaboratorRestore.statusCode,
        201
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
                "Lista eliminación colaborativa",
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

      const ownerAdded =
        await requestJson(
          `${baseUrl}/api/lists/${encodeURIComponent(listId)}/items`,
          {
            method: "POST",
            cookie:
              ownerCookie,
            body: {
              itemId:
                ownerItemId
            }
          }
        );

      assert.equal(
        ownerAdded.statusCode,
        201
      );

      assert.equal(
        ownerAdded.json?.list?.items?.length,
        1
      );

      assert.equal(
        ownerAdded.json?.list?.items?.[0]?.id,
        ownerItemId
      );

      const invited =
        await requestJson(
          `${baseUrl}/api/lists/${encodeURIComponent(listId)}/invites/${encodeURIComponent(collaboratorUsername)}`,
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
              collaboratorCookie
          }
        );

      assert.equal(
        accepted.statusCode,
        200
      );

      const removed =
        await requestJson(
          `${baseUrl}/api/lists/${encodeURIComponent(listId)}/items/${encodeURIComponent(collaboratorItemId)}`,
          {
            method: "DELETE",
            cookie:
              collaboratorCookie
          }
        );

      assert.equal(
        removed.statusCode,
        200
      );

      assert.equal(
        removed.json?.removed,
        1
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
          .lists[0]
          .items.length,
        0
      );

      assert.equal(
        persisted.users[ownerUserId]
          .library.length,
        1
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
  "outsiders y ex-colaboradores no pueden mutar items de una lista colaborativa",
  {
    timeout: 30000
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

      const register =
        async ({
          email,
          name
        }) => {
          const response =
            await requestJson(
              `${baseUrl}/api/auth/register`,
              {
                method: "POST",
                body: {
                  email,
                  password:
                    "runtime-pass-123",
                  name,
                  language: "es"
                }
              }
            );

          assert.equal(
            response.statusCode,
            200
          );

          return {
            cookie:
              response.headers[
                "set-cookie"
              ][0].split(";")[0],
            userId:
              response.json?.user?.id,
            username:
              response.json?.user?.handle
          };
        };

      const owner =
        await register({
          email:
            "w14-access-owner@example.test",
          name:
            "W14 Access Owner"
        });

      const leaver =
        await register({
          email:
            "w14-access-leaver@example.test",
          name:
            "W14 Access Leaver"
        });

      const kicked =
        await register({
          email:
            "w14-access-kicked@example.test",
          name:
            "W14 Access Kicked"
        });

      const outsider =
        await register({
          email:
            "w14-access-outsider@example.test",
          name:
            "W14 Access Outsider"
        });

      assert.ok(owner.userId);
      assert.ok(leaver.userId);
      assert.ok(kicked.userId);
      assert.ok(outsider.userId);
      assert.ok(leaver.username);
      assert.ok(kicked.username);

      for (const collaborator of [
        leaver,
        kicked
      ]) {
        const privacyUpdated =
          await requestJson(
            `${baseUrl}/api/user/privacy`,
            {
              method: "PATCH",
              cookie:
                collaborator.cookie,
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
      }

      const created =
        await requestJson(
          `${baseUrl}/api/lists`,
          {
            method: "POST",
            cookie:
              owner.cookie,
            body: {
              name:
                "Lista autorización negativa",
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

      for (const collaborator of [
        leaver,
        kicked
      ]) {
        const invited =
          await requestJson(
            `${baseUrl}/api/lists/${encodeURIComponent(listId)}/invites/${encodeURIComponent(collaborator.username)}`,
            {
              method: "POST",
              cookie:
                owner.cookie
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
                collaborator.cookie
            }
          );

        assert.equal(
          accepted.statusCode,
          200
        );
      }

      for (const method of [
        "POST",
        "DELETE"
      ]) {
        const response =
          method === "POST"
            ? await requestJson(
                `${baseUrl}/api/lists/${encodeURIComponent(listId)}/items`,
                {
                  method,
                  cookie:
                    outsider.cookie,
                  body: {
                    itemId:
                      "authorization-probe-item"
                  }
                }
              )
            : await requestJson(
                `${baseUrl}/api/lists/${encodeURIComponent(listId)}/items/${encodeURIComponent("authorization-probe-item")}`,
                {
                  method,
                  cookie:
                    outsider.cookie
                }
              );

        assert.equal(
          response.statusCode,
          404
        );

        assert.equal(
          response.json?.error,
          "list_not_found"
        );
      }

      const left =
        await requestJson(
          `${baseUrl}/api/lists/${encodeURIComponent(listId)}/members/me`,
          {
            method: "DELETE",
            cookie:
              leaver.cookie
          }
        );

      assert.equal(
        left.statusCode,
        200
      );

      for (const method of [
        "POST",
        "DELETE"
      ]) {
        const response =
          method === "POST"
            ? await requestJson(
                `${baseUrl}/api/lists/${encodeURIComponent(listId)}/items`,
                {
                  method,
                  cookie:
                    leaver.cookie,
                  body: {
                    itemId:
                      "authorization-probe-item"
                  }
                }
              )
            : await requestJson(
                `${baseUrl}/api/lists/${encodeURIComponent(listId)}/items/${encodeURIComponent("authorization-probe-item")}`,
                {
                  method,
                  cookie:
                    leaver.cookie
                }
              );

        assert.equal(
          response.statusCode,
          404
        );

        assert.equal(
          response.json?.error,
          "list_not_found"
        );
      }

      const removed =
        await requestJson(
          `${baseUrl}/api/lists/${encodeURIComponent(listId)}/members/${encodeURIComponent(kicked.userId)}`,
          {
            method: "DELETE",
            cookie:
              owner.cookie
          }
        );

      assert.equal(
        removed.statusCode,
        200
      );

      for (const method of [
        "POST",
        "DELETE"
      ]) {
        const response =
          method === "POST"
            ? await requestJson(
                `${baseUrl}/api/lists/${encodeURIComponent(listId)}/items`,
                {
                  method,
                  cookie:
                    kicked.cookie,
                  body: {
                    itemId:
                      "authorization-probe-item"
                  }
                }
              )
            : await requestJson(
                `${baseUrl}/api/lists/${encodeURIComponent(listId)}/items/${encodeURIComponent("authorization-probe-item")}`,
                {
                  method,
                  cookie:
                    kicked.cookie
                }
              );

        assert.equal(
          response.statusCode,
          404
        );

        assert.equal(
          response.json?.error,
          "list_not_found"
        );
      }
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
