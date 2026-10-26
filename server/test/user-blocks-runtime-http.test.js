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
      "quacker-following-runtime-"
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
  "bloquear y desbloquear usuarios funciona por HTTP y persiste",
  { timeout: 20000 },
  async () => {
    const directory = createTemporaryDirectory();
    const dbPath = path.join(directory, "db.json");
    const sessionStorePath = path.join(directory, "sessions");

    fs.writeFileSync(
      dbPath,
      JSON.stringify({ users: {} }, null, 2),
      "utf8"
    );

    const port = await getAvailablePort();
    const baseUrl = `http://127.0.0.1:${port}`;
    let child = null;

    async function register(email, name, handle) {
      const response = await requestJson(
        `${baseUrl}/api/auth/register`,
        {
          method: "POST",
          body: {
            email,
            password: "runtime-pass-123",
            name,
            language: "es"
          }
        }
      );

      assert.equal(response.statusCode, 200);
      const cookie = sessionCookie(response);
      const userId = response.json?.user?.id;
      assert.ok(userId);

      const update = await requestJson(
        `${baseUrl}/api/user`,
        {
          method: "PATCH",
          cookie,
          body: { handle: `@${handle}` }
        }
      );

      assert.equal(update.statusCode, 200);

      const privacy = await requestJson(
        `${baseUrl}/api/user/privacy`,
        {
          method: "PATCH",
          cookie,
          body: { profile: true }
        }
      );

      assert.equal(privacy.statusCode, 200);
      return { cookie, userId, handle };
    }

    try {
      child = await startTestServer({
        dbPath,
        sessionStorePath,
        port
      });

      const alice = await register(
        "blocks-alice@example.test",
        "Blocks Alice",
        "blocks_alice"
      );

      const bob = await register(
        "blocks-bob@example.test",
        "Blocks Bob",
        "blocks_bob"
      );

      const anonymous = await requestJson(
        `${baseUrl}/api/user/blocks`
      );

      assert.equal(anonymous.statusCode, 401);

      const follow = await requestJson(
        `${baseUrl}/api/user/following/blocks_alice`,
        {
          method: "POST",
          cookie: bob.cookie
        }
      );

      assert.equal(follow.statusCode, 201);

      const block = await requestJson(
        `${baseUrl}/api/user/blocks/blocks_bob`,
        {
          method: "POST",
          cookie: alice.cookie
        }
      );

      assert.equal(block.statusCode, 201);
      assert.equal(block.json?.blocked, true);

      // Los perfiles y grafos públicos deben respetar
      // los bloqueos en ambas direcciones.
      for (const [viewer, target] of [
        [bob, alice],
        [alice, bob]
      ]) {
        for (const suffix of [
          "",
          "/followers",
          "/following"
        ]) {
          const response = await requestJson(
            `${baseUrl}/api/public/users/${target.handle}${suffix}`,
            {
              method: "GET",
              cookie: viewer.cookie
            }
          );

          assert.equal(
            response.statusCode,
            404,
            `acceso bloqueado: ${viewer.handle} -> ${target.handle}${suffix}`
          );

          assert.equal(
            response.json?.error,
            "not_found"
          );
        }
      }

      // QA-005: el documento HTML debe respetar los
      // mismos bloqueos que la API pública.
      // Un visitante anónimo conserva el acceso público.
      const anonymousProfilePage = await requestJson(
        `${baseUrl}/u/blocks_alice`
      );

      assert.equal(
        anonymousProfilePage.statusCode,
        200,
        "un perfil público debe seguir visible sin sesión"
      );

      // El propietario conserva el acceso a su perfil.
      const ownerProfilePage = await requestJson(
        `${baseUrl}/u/blocks_alice`,
        { cookie: alice.cookie }
      );

      assert.equal(
        ownerProfilePage.statusCode,
        200,
        "el propietario debe poder abrir su propio perfil"
      );

      for (const [viewer, target] of [
        [bob, alice],
        [alice, bob]
      ]) {
        const blockedProfilePage = await requestJson(
          `${baseUrl}/u/${target.handle}`,
          { cookie: viewer.cookie }
        );

        assert.equal(
          blockedProfilePage.statusCode,
          404,
          "QA-005: la página HTML debe respetar los bloqueos"
        );
      }

      // Un usuario bloqueado no puede volver a seguir
      // a quien ha establecido el bloqueo.
      const forbiddenFollow = await requestJson(
        `${baseUrl}/api/user/following/blocks_alice`,
        {
          method: "POST",
          cookie: bob.cookie
        }
      );

      assert.equal(
        forbiddenFollow.statusCode,
        404,
        "un bloqueo debe impedir nuevos seguimientos"
      );

      const persisted = JSON.parse(
        fs.readFileSync(dbPath, "utf8")
      );

      assert.deepEqual(
        persisted.users[alice.userId].blockedUserIds,
        [bob.userId]
      );

      assert.deepEqual(
        persisted.users[bob.userId].following,
        []
      );

      const list = await requestJson(
        `${baseUrl}/api/user/blocks`,
        { cookie: alice.cookie }
      );

      assert.equal(list.statusCode, 200);
      assert.deepEqual(
        list.json?.blocks,
        [{ username: "blocks_bob" }]
      );

      const duplicate = await requestJson(
        `${baseUrl}/api/user/blocks/blocks_bob`,
        {
          method: "POST",
          cookie: alice.cookie
        }
      );

      assert.equal(duplicate.statusCode, 409);
      assert.equal(duplicate.json?.error, "already_blocked");

      const self = await requestJson(
        `${baseUrl}/api/user/blocks/blocks_alice`,
        {
          method: "POST",
          cookie: alice.cookie
        }
      );

      assert.equal(self.statusCode, 400);
      assert.equal(self.json?.error, "cannot_block_self");

      // Simular una solicitud antigua persistida antes
      // de aplicar las restricciones de bloqueo.
      const dbWithPending = JSON.parse(
        fs.readFileSync(dbPath, "utf8")
      );

      dbWithPending.users[alice.userId].followRequests = [
        bob.userId
      ];

      fs.writeFileSync(
        dbPath,
        JSON.stringify(dbWithPending, null, 2),
        "utf8"
      );

      const acceptBlockedRequest = await requestJson(
        `${baseUrl}/api/user/follow-requests/blocks_bob/accept`,
        {
          method: "POST",
          cookie: alice.cookie
        }
      );

      assert.equal(
        acceptBlockedRequest.statusCode,
        404,
        "no debe aceptarse una solicitud entre usuarios bloqueados"
      );

      const dbAfterRejectedAccept = JSON.parse(
        fs.readFileSync(dbPath, "utf8")
      );

      assert.deepEqual(
        dbAfterRejectedAccept.users[bob.userId].following,
        [],
        "la solicitud rechazada no debe crear seguimiento"
      );

      // Simular una relación de seguimiento mutuo antigua
      // que hubiera permanecido después del bloqueo.
      const dbWithLegacyFollows = JSON.parse(
        fs.readFileSync(dbPath, "utf8")
      );

      dbWithLegacyFollows.users[alice.userId].following = [
        bob.userId
      ];

      dbWithLegacyFollows.users[bob.userId].following = [
        alice.userId
      ];

      fs.writeFileSync(
        dbPath,
        JSON.stringify(dbWithLegacyFollows, null, 2),
        "utf8"
      );

      const previousRecommendations =
        dbWithLegacyFollows.users[alice.userId]
          .recommendations.length;

      const previousNotifications =
        dbWithLegacyFollows.users[alice.userId]
          .notifications.length;

      const blockedRecommendation = await requestJson(
        `${baseUrl}/api/user/recommendations/blocks_alice`,
        {
          method: "POST",
          cookie: bob.cookie,
          body: {
            contentType: "movie",
            source: "tmdb",
            externalId: "603",
            itemSnapshot: {
              title: "The Matrix",
              cover: "https://image.example.test/matrix.jpg"
            },
            message: "Creo que te va a gustar."
          }
        }
      );

      assert.equal(
        blockedRecommendation.statusCode,
        404,
        "un bloqueo debe impedir enviar recomendaciones"
      );

      const dbAfterRecommendation = JSON.parse(
        fs.readFileSync(dbPath, "utf8")
      );

      assert.equal(
        dbAfterRecommendation.users[alice.userId]
          .recommendations.length,
        previousRecommendations,
        "la recomendación rechazada no debe guardarse"
      );

      assert.equal(
        dbAfterRecommendation.users[alice.userId]
          .notifications.length,
        previousNotifications,
        "la recomendación rechazada no debe notificar"
      );

      // Retirar los seguimientos artificiales introducidos
      // exclusivamente para probar recomendaciones legacy.
      const dbWithoutLegacyFollows = JSON.parse(
        fs.readFileSync(dbPath, "utf8")
      );

      dbWithoutLegacyFollows.users[alice.userId].following = [];
      dbWithoutLegacyFollows.users[bob.userId].following = [];

      fs.writeFileSync(
        dbPath,
        JSON.stringify(dbWithoutLegacyFollows, null, 2),
        "utf8"
      );

      const unblock = await requestJson(
        `${baseUrl}/api/user/blocks/blocks_bob`,
        {
          method: "DELETE",
          cookie: alice.cookie
        }
      );

      assert.equal(unblock.statusCode, 200);
      assert.equal(unblock.json?.blocked, false);

      // QA-005: después de desbloquear, ambos perfiles
      // públicos vuelven a ser accesibles.
      for (const [viewer, target] of [
        [bob, alice],
        [alice, bob]
      ]) {
        const restoredProfilePage = await requestJson(
          `${baseUrl}/u/${target.handle}`,
          { cookie: viewer.cookie }
        );

        assert.equal(
          restoredProfilePage.statusCode,
          200,
          "el desbloqueo debe restaurar el acceso HTML"
        );
      }

      const finalDb = JSON.parse(
        fs.readFileSync(dbPath, "utf8")
      );

      assert.deepEqual(
        finalDb.users[alice.userId].blockedUserIds,
        []
      );

      assert.deepEqual(
        finalDb.users[bob.userId].following,
        [],
        "desbloquear no debe restaurar el seguimiento"
      );
    } finally {
      await stopTestServer(child);
      fs.rmSync(directory, {
        recursive: true,
        force: true
      });
    }
  }
);


test(
  "limita por HTTP bloquear y desbloquear sin alterar datos",
  { timeout: 20000 },
  async () => {
    const directory = createTemporaryDirectory();
    const dbPath = path.join(directory, "db.json");
    const sessionStorePath = path.join(directory, "sessions");

    fs.writeFileSync(
      dbPath,
      JSON.stringify({ users: {} }, null, 2),
      "utf8"
    );

    const port = await getAvailablePort();
    const baseUrl = `http://127.0.0.1:${port}`;
    let child = null;

    async function register(handle) {
      const response = await requestJson(
        `${baseUrl}/api/auth/register`,
        {
          method: "POST",
          body: {
            email: `${handle}@example.test`,
            password: "runtime-pass-123",
            name: handle,
            language: "es"
          }
        }
      );

      assert.equal(response.statusCode, 200);

      const cookie = sessionCookie(response);

      const update = await requestJson(
        `${baseUrl}/api/user`,
        {
          method: "PATCH",
          cookie,
          body: { handle: `@${handle}` }
        }
      );

      assert.equal(update.statusCode, 200);
      return { cookie, handle };
    }

    try {
      child = await startTestServer({
        dbPath,
        sessionStorePath,
        port
      });

      const alice = await register("limit_alice");
      const bob = await register("limit_bob");
      const charlie = await register("limit_charlie");
      const dave = await register("limit_dave");

      const blockUrl =
        `${baseUrl}/api/user/blocks/${bob.handle}`;

      // Las primeras 18 operaciones son válidas.
      for (let attempt = 0; attempt < 18; attempt += 1) {
        const blocking = attempt % 2 === 0;

        const response = await requestJson(
          blockUrl,
          {
            method: blocking ? "POST" : "DELETE",
            cookie: alice.cookie
          }
        );

        assert.equal(
          response.statusCode,
          blocking ? 201 : 200,
          `operación ${attempt + 1}`
        );
      }

      // Operaciones 19 y 20: ambas permitidas.
      for (const target of [bob, charlie]) {
        const response = await requestJson(
          `${baseUrl}/api/user/blocks/${target.handle}`,
          {
            method: "POST",
            cookie: alice.cookie
          }
        );

        assert.equal(response.statusCode, 201);
      }

      const previousDb = fs.readFileSync(
        dbPath,
        "utf8"
      );

      // Operación 21: DELETE debe rechazarse.
      const rejectedDelete = await requestJson(
        blockUrl,
        {
          method: "DELETE",
          cookie: alice.cookie
        }
      );

      assert.equal(rejectedDelete.statusCode, 429);
      assert.equal(
        rejectedDelete.json?.error,
        "social_block_rate_limited"
      );
      assert.ok(
        Number(rejectedDelete.headers["retry-after"]) > 0
      );

      assert.equal(
        fs.readFileSync(dbPath, "utf8"),
        previousDb,
        "DELETE rechazado no debe modificar la base de datos"
      );

      // POST comparte el mismo contador.
      const rejectedPost = await requestJson(
        `${baseUrl}/api/user/blocks/${dave.handle}`,
        {
          method: "POST",
          cookie: alice.cookie
        }
      );

      assert.equal(rejectedPost.statusCode, 429);
      assert.equal(
        rejectedPost.json?.error,
        "social_block_rate_limited"
      );
      assert.ok(
        Number(rejectedPost.headers["retry-after"]) > 0
      );

      assert.equal(
        fs.readFileSync(dbPath, "utf8"),
        previousDb,
        "POST rechazado no debe modificar la base de datos"
      );

      // El límite es independiente para cada usuario.
      const otherUser = await requestJson(
        `${baseUrl}/api/user/blocks/${dave.handle}`,
        {
          method: "POST",
          cookie: bob.cookie
        }
      );

      assert.equal(otherUser.statusCode, 201);
    } finally {
      await stopTestServer(child);
      fs.rmSync(directory, {
        recursive: true,
        force: true
      });
    }
  }
);
