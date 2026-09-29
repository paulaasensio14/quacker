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
