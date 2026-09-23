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
  "seguir y dejar de seguir respeta autenticación, privacidad y persistencia",
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

      const followerRegistration =
        await requestJson(
          `${baseUrl}/api/auth/register`,
          {
            method: "POST",
            body: {
              email:
                "week13-follower@example.test",
              password:
                "runtime-pass-123",
              name:
                "Week 13 Follower",
              language: "es"
            }
          }
        );

      assert.equal(
        followerRegistration.statusCode,
        200
      );

      const followerCookie =
        sessionCookie(
          followerRegistration
        );

      const followerUserId =
        followerRegistration.json
          ?.user?.id;

      assert.ok(followerUserId);

      const followerProfileUpdate =
        await requestJson(
          `${baseUrl}/api/user`,
          {
            method: "PATCH",
            cookie:
              followerCookie,
            body: {
              handle:
                "@week13_follower"
            }
          }
        );

      assert.equal(
        followerProfileUpdate.statusCode,
        200
      );

      const targetRegistration =
        await requestJson(
          `${baseUrl}/api/auth/register`,
          {
            method: "POST",
            body: {
              email:
                "week13-target@example.test",
              password:
                "runtime-pass-123",
              name:
                "Week 13 Target",
              language: "es"
            }
          }
        );

      assert.equal(
        targetRegistration.statusCode,
        200
      );

      const targetCookie =
        sessionCookie(
          targetRegistration
        );

      const targetUserId =
        targetRegistration.json
          ?.user?.id;

      assert.ok(targetUserId);

      const targetProfileUpdate =
        await requestJson(
          `${baseUrl}/api/user`,
          {
            method: "PATCH",
            cookie:
              targetCookie,
            body: {
              handle:
                "@week13_target"
            }
          }
        );

      assert.equal(
        targetProfileUpdate.statusCode,
        200
      );

      const publishTarget =
        await requestJson(
          `${baseUrl}/api/user/privacy`,
          {
            method: "PATCH",
            cookie:
              targetCookie,
            body: {
              profile: true
            }
          }
        );

      assert.equal(
        publishTarget.statusCode,
        200
      );

      const anonymousFollow =
        await requestJson(
          `${baseUrl}/api/user/following/week13_target`,
          {
            method: "POST"
          }
        );

      assert.equal(
        anonymousFollow.statusCode,
        401
      );

      const follow =
        await requestJson(
          `${baseUrl}/api/user/following/week13_target`,
          {
            method: "POST",
            cookie:
              followerCookie
          }
        );

      assert.equal(
        follow.statusCode,
        201
      );

      assert.deepEqual(
        follow.json,
        {
          following: true
        }
      );

      const persistedAfterFollow =
        JSON.parse(
          fs.readFileSync(
            dbPath,
            "utf8"
          )
        );

      assert.deepEqual(
        persistedAfterFollow
          .users[followerUserId]
          .following,
        [
          targetUserId
        ],
        "following debe persistir el userId objetivo"
      );

      const duplicateFollow =
        await requestJson(
          `${baseUrl}/api/user/following/week13_target`,
          {
            method: "POST",
            cookie:
              followerCookie
          }
        );

      assert.equal(
        duplicateFollow.statusCode,
        409
      );

      assert.equal(
        duplicateFollow.json?.error,
        "already_following"
      );

      const selfFollow =
        await requestJson(
          `${baseUrl}/api/user/following/week13_follower`,
          {
            method: "POST",
            cookie:
              followerCookie
          }
        );

      assert.equal(
        selfFollow.statusCode,
        400
      );

      assert.equal(
        selfFollow.json?.error,
        "cannot_follow_self"
      );

      const privateRegistration =
        await requestJson(
          `${baseUrl}/api/auth/register`,
          {
            method: "POST",
            body: {
              email:
                "week13-private@example.test",
              password:
                "runtime-pass-123",
              name:
                "Week 13 Private",
              language: "es"
            }
          }
        );

      assert.equal(
        privateRegistration.statusCode,
        200
      );

      const privateCookie =
        sessionCookie(
          privateRegistration
        );

      const privateProfileUpdate =
        await requestJson(
          `${baseUrl}/api/user`,
          {
            method: "PATCH",
            cookie:
              privateCookie,
            body: {
              handle:
                "@week13_private"
            }
          }
        );

      assert.equal(
        privateProfileUpdate.statusCode,
        200
      );

      const privateFollow =
        await requestJson(
          `${baseUrl}/api/user/following/week13_private`,
          {
            method: "POST",
            cookie:
              followerCookie
          }
        );

      assert.equal(
        privateFollow.statusCode,
        404
      );

      assert.equal(
        privateFollow.json?.error,
        "not_found"
      );

      const missingFollow =
        await requestJson(
          `${baseUrl}/api/user/following/week13_missing`,
          {
            method: "POST",
            cookie:
              followerCookie
          }
        );

      assert.equal(
        missingFollow.statusCode,
        404
      );

      assert.equal(
        missingFollow.json?.error,
        "not_found"
      );

      const hideTarget =
        await requestJson(
          `${baseUrl}/api/user/privacy`,
          {
            method: "PATCH",
            cookie:
              targetCookie,
            body: {
              profile: false
            }
          }
        );

      assert.equal(
        hideTarget.statusCode,
        200
      );

      const hiddenTarget =
        await requestJson(
          `${baseUrl}/api/public/users/week13_target`
        );

      assert.equal(
        hiddenTarget.statusCode,
        404,
        "el perfil deja de ser público"
      );

      const unfollow =
        await requestJson(
          `${baseUrl}/api/user/following/week13_target`,
          {
            method: "DELETE",
            cookie:
              followerCookie
          }
        );

      assert.equal(
        unfollow.statusCode,
        200
      );

      assert.deepEqual(
        unfollow.json,
        {
          following: false
        }
      );

      const persistedAfterUnfollow =
        JSON.parse(
          fs.readFileSync(
            dbPath,
            "utf8"
          )
        );

      assert.deepEqual(
        persistedAfterUnfollow
          .users[followerUserId]
          .following,
        []
      );

    } finally {
      await stopTestServer(
        child
      );

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
