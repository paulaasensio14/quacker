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

test(
  "un perfil followers recibe una solicitud sin crear following todavía",
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

      const followerRegistration =
        await requestJson(
          `${baseUrl}/api/auth/register`,
          {
            method: "POST",
            body: {
              email:
                "week13-requester@example.test",
              password:
                "runtime-pass-123",
              name:
                "Week 13 Requester",
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

      assert.ok(
        followerUserId
      );

      const targetRegistration =
        await requestJson(
          `${baseUrl}/api/auth/register`,
          {
            method: "POST",
            body: {
              email:
                "week13-followers-target@example.test",
              password:
                "runtime-pass-123",
              name:
                "Week 13 Followers Target",
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

      assert.ok(
        targetUserId
      );

      const targetProfileUpdate =
        await requestJson(
          `${baseUrl}/api/user`,
          {
            method: "PATCH",
            cookie:
              targetCookie,
            body: {
              handle:
                "@w13_followers"
            }
          }
        );

      assert.equal(
        targetProfileUpdate.statusCode,
        200
      );

      const targetPrivacyUpdate =
        await requestJson(
          `${baseUrl}/api/user/privacy`,
          {
            method: "PATCH",
            cookie:
              targetCookie,
            body: {
              profileVisibility:
                "followers"
            }
          }
        );

      assert.equal(
        targetPrivacyUpdate.statusCode,
        200
      );

      const requestFollow =
        await requestJson(
          `${baseUrl}/api/user/following/w13_followers`,
          {
            method: "POST",
            cookie:
              followerCookie
          }
        );

      assert.equal(
        requestFollow.statusCode,
        202
      );

      assert.deepEqual(
        requestFollow.json,
        {
          following: false,
          requested: true
        }
      );

      const persistedDb =
        JSON.parse(
          fs.readFileSync(
            dbPath,
            "utf8"
          )
        );

      assert.deepEqual(
        persistedDb
          .users[followerUserId]
          .following,
        [],
        "una solicitud pendiente no debe crear following"
      );

      assert.deepEqual(
        persistedDb
          .users[targetUserId]
          .followRequests,
        [
          followerUserId
        ],
        "la solicitud debe persistir en el usuario destinatario"
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

test(
  "un perfil friends recibe una sola solicitud pendiente",
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

      const requesterRegistration =
        await requestJson(
          `${baseUrl}/api/auth/register`,
          {
            method: "POST",
            body: {
              email:
                "w13-friends-requester@example.test",
              password:
                "runtime-pass-123",
              name:
                "W13 Friends Requester",
              language: "es"
            }
          }
        );

      assert.equal(
        requesterRegistration.statusCode,
        200
      );

      const requesterCookie =
        sessionCookie(
          requesterRegistration
        );

      const requesterUserId =
        requesterRegistration.json
          ?.user?.id;

      assert.ok(
        requesterUserId
      );

      const targetRegistration =
        await requestJson(
          `${baseUrl}/api/auth/register`,
          {
            method: "POST",
            body: {
              email:
                "w13-friends-target@example.test",
              password:
                "runtime-pass-123",
              name:
                "W13 Friends Target",
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

      assert.ok(
        targetUserId
      );

      const profileUpdate =
        await requestJson(
          `${baseUrl}/api/user`,
          {
            method: "PATCH",
            cookie:
              targetCookie,
            body: {
              handle:
                "@w13_friends"
            }
          }
        );

      assert.equal(
        profileUpdate.statusCode,
        200
      );

      const privacyUpdate =
        await requestJson(
          `${baseUrl}/api/user/privacy`,
          {
            method: "PATCH",
            cookie:
              targetCookie,
            body: {
              profileVisibility:
                "friends"
            }
          }
        );

      assert.equal(
        privacyUpdate.statusCode,
        200
      );

      const firstRequest =
        await requestJson(
          `${baseUrl}/api/user/following/w13_friends`,
          {
            method: "POST",
            cookie:
              requesterCookie
          }
        );

      assert.equal(
        firstRequest.statusCode,
        202
      );

      assert.deepEqual(
        firstRequest.json,
        {
          following: false,
          requested: true
        }
      );

      const duplicateRequest =
        await requestJson(
          `${baseUrl}/api/user/following/w13_friends`,
          {
            method: "POST",
            cookie:
              requesterCookie
          }
        );

      assert.equal(
        duplicateRequest.statusCode,
        409
      );

      assert.equal(
        duplicateRequest.json?.error,
        "follow_request_exists"
      );

      const persistedDb =
        JSON.parse(
          fs.readFileSync(
            dbPath,
            "utf8"
          )
        );

      assert.deepEqual(
        persistedDb
          .users[requesterUserId]
          .following,
        []
      );

      assert.deepEqual(
        persistedDb
          .users[targetUserId]
          .followRequests,
        [
          requesterUserId
        ],
        "la solicitud pendiente no debe duplicarse"
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

test(
  "aceptar una solicitud elimina el pendiente y crea following en el solicitante",
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

      const requesterRegistration =
        await requestJson(
          `${baseUrl}/api/auth/register`,
          {
            method: "POST",
            body: {
              email:
                "w13-accept-requester@example.test",
              password:
                "runtime-pass-123",
              name:
                "W13 Accept Requester",
              language: "es"
            }
          }
        );

      assert.equal(
        requesterRegistration.statusCode,
        200
      );

      const requesterCookie =
        sessionCookie(
          requesterRegistration
        );

      const requesterUserId =
        requesterRegistration.json
          ?.user?.id;

      assert.ok(
        requesterUserId
      );

      const requesterProfile =
        await requestJson(
          `${baseUrl}/api/user`,
          {
            method: "PATCH",
            cookie:
              requesterCookie,
            body: {
              handle:
                "@w13_requester"
            }
          }
        );

      assert.equal(
        requesterProfile.statusCode,
        200
      );

      const targetRegistration =
        await requestJson(
          `${baseUrl}/api/auth/register`,
          {
            method: "POST",
            body: {
              email:
                "w13-accept-target@example.test",
              password:
                "runtime-pass-123",
              name:
                "W13 Accept Target",
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

      assert.ok(
        targetUserId
      );

      const targetProfile =
        await requestJson(
          `${baseUrl}/api/user`,
          {
            method: "PATCH",
            cookie:
              targetCookie,
            body: {
              handle:
                "@w13_target"
            }
          }
        );

      assert.equal(
        targetProfile.statusCode,
        200
      );

      const targetPrivacy =
        await requestJson(
          `${baseUrl}/api/user/privacy`,
          {
            method: "PATCH",
            cookie:
              targetCookie,
            body: {
              profileVisibility:
                "followers"
            }
          }
        );

      assert.equal(
        targetPrivacy.statusCode,
        200
      );

      const followRequest =
        await requestJson(
          `${baseUrl}/api/user/following/w13_target`,
          {
            method: "POST",
            cookie:
              requesterCookie
          }
        );

      assert.equal(
        followRequest.statusCode,
        202
      );

      const accept =
        await requestJson(
          `${baseUrl}/api/user/follow-requests/w13_requester/accept`,
          {
            method: "POST",
            cookie:
              targetCookie
          }
        );

      assert.equal(
        accept.statusCode,
        200
      );

      assert.deepEqual(
        accept.json,
        {
          following: true,
          requested: false
        }
      );

      const persistedDb =
        JSON.parse(
          fs.readFileSync(
            dbPath,
            "utf8"
          )
        );

      assert.deepEqual(
        persistedDb
          .users[targetUserId]
          .followRequests,
        [],
        "la solicitud aceptada debe desaparecer"
      );

      assert.deepEqual(
        persistedDb
          .users[requesterUserId]
          .following,
        [
          targetUserId
        ],
        "el solicitante debe pasar a seguir al destinatario"
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

test(
  "rechazar una solicitud elimina el pendiente sin crear following",
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

      const requesterRegistration =
        await requestJson(
          `${baseUrl}/api/auth/register`,
          {
            method: "POST",
            body: {
              email:
                "w13-reject-requester@example.test",
              password:
                "runtime-pass-123",
              name:
                "W13 Reject Requester",
              language: "es"
            }
          }
        );

      assert.equal(
        requesterRegistration.statusCode,
        200
      );

      const requesterCookie =
        sessionCookie(
          requesterRegistration
        );

      const requesterUserId =
        requesterRegistration.json
          ?.user?.id;

      assert.ok(
        requesterUserId
      );

      const requesterProfile =
        await requestJson(
          `${baseUrl}/api/user`,
          {
            method: "PATCH",
            cookie:
              requesterCookie,
            body: {
              handle:
                "@w13_rejector"
            }
          }
        );

      assert.equal(
        requesterProfile.statusCode,
        200
      );

      const targetRegistration =
        await requestJson(
          `${baseUrl}/api/auth/register`,
          {
            method: "POST",
            body: {
              email:
                "w13-reject-target@example.test",
              password:
                "runtime-pass-123",
              name:
                "W13 Reject Target",
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

      assert.ok(
        targetUserId
      );

      const targetProfile =
        await requestJson(
          `${baseUrl}/api/user`,
          {
            method: "PATCH",
            cookie:
              targetCookie,
            body: {
              handle:
                "@w13_reject_target"
            }
          }
        );

      assert.equal(
        targetProfile.statusCode,
        200
      );

      const targetPrivacy =
        await requestJson(
          `${baseUrl}/api/user/privacy`,
          {
            method: "PATCH",
            cookie:
              targetCookie,
            body: {
              profileVisibility:
                "followers"
            }
          }
        );

      assert.equal(
        targetPrivacy.statusCode,
        200
      );

      const followRequest =
        await requestJson(
          `${baseUrl}/api/user/following/w13_reject_target`,
          {
            method: "POST",
            cookie:
              requesterCookie
          }
        );

      assert.equal(
        followRequest.statusCode,
        202
      );

      const reject =
        await requestJson(
          `${baseUrl}/api/user/follow-requests/w13_rejector`,
          {
            method: "DELETE",
            cookie:
              targetCookie
          }
        );

      assert.equal(
        reject.statusCode,
        200
      );

      assert.deepEqual(
        reject.json,
        {
          following: false,
          requested: false
        }
      );

      const persistedDb =
        JSON.parse(
          fs.readFileSync(
            dbPath,
            "utf8"
          )
        );

      assert.deepEqual(
        persistedDb
          .users[targetUserId]
          .followRequests,
        [],
        "la solicitud rechazada debe desaparecer"
      );

      assert.deepEqual(
        persistedDb
          .users[requesterUserId]
          .following,
        [],
        "rechazar no debe crear una relación following"
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

test(
  "seguir directamente tras pasar a public elimina una solicitud pendiente anterior",
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

      const requesterRegistration =
        await requestJson(
          `${baseUrl}/api/auth/register`,
          {
            method: "POST",
            body: {
              email:
                "w13-public-transition-requester@example.test",
              password:
                "runtime-pass-123",
              name:
                "W13 Public Transition Requester",
              language: "es"
            }
          }
        );

      assert.equal(
        requesterRegistration.statusCode,
        200
      );

      const requesterCookie =
        sessionCookie(
          requesterRegistration
        );

      const requesterUserId =
        requesterRegistration.json
          ?.user?.id;

      assert.ok(
        requesterUserId
      );

      const requesterProfile =
        await requestJson(
          `${baseUrl}/api/user`,
          {
            method: "PATCH",
            cookie:
              requesterCookie,
            body: {
              handle:
                "@w13_transitioner"
            }
          }
        );

      assert.equal(
        requesterProfile.statusCode,
        200
      );

      const targetRegistration =
        await requestJson(
          `${baseUrl}/api/auth/register`,
          {
            method: "POST",
            body: {
              email:
                "w13-public-transition-target@example.test",
              password:
                "runtime-pass-123",
              name:
                "W13 Public Transition Target",
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

      assert.ok(
        targetUserId
      );

      const targetProfile =
        await requestJson(
          `${baseUrl}/api/user`,
          {
            method: "PATCH",
            cookie:
              targetCookie,
            body: {
              handle:
                "@w13_transition"
            }
          }
        );

      assert.equal(
        targetProfile.statusCode,
        200
      );

      const restrict =
        await requestJson(
          `${baseUrl}/api/user/privacy`,
          {
            method: "PATCH",
            cookie:
              targetCookie,
            body: {
              profileVisibility:
                "followers"
            }
          }
        );

      assert.equal(
        restrict.statusCode,
        200
      );

      const pending =
        await requestJson(
          `${baseUrl}/api/user/following/w13_transition`,
          {
            method: "POST",
            cookie:
              requesterCookie
          }
        );

      assert.equal(
        pending.statusCode,
        202
      );

      const publish =
        await requestJson(
          `${baseUrl}/api/user/privacy`,
          {
            method: "PATCH",
            cookie:
              targetCookie,
            body: {
              profileVisibility:
                "public"
            }
          }
        );

      assert.equal(
        publish.statusCode,
        200
      );

      const directFollow =
        await requestJson(
          `${baseUrl}/api/user/following/w13_transition`,
          {
            method: "POST",
            cookie:
              requesterCookie
          }
        );

      assert.equal(
        directFollow.statusCode,
        201
      );

      const persistedDb =
        JSON.parse(
          fs.readFileSync(
            dbPath,
            "utf8"
          )
        );

      assert.deepEqual(
        persistedDb
          .users[requesterUserId]
          .following,
        [
          targetUserId
        ]
      );

      assert.deepEqual(
        persistedDb
          .users[targetUserId]
          .followRequests,
        [],
        "el follow directo debe limpiar la solicitud pendiente antigua"
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

test(
  "listar solicitudes recibidas expone solo identidad pública segura",
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

      const requesterRegistration =
        await requestJson(
          `${baseUrl}/api/auth/register`,
          {
            method: "POST",
            body: {
              email:
                "w13-inbox-requester@example.test",
              password:
                "runtime-pass-123",
              name:
                "W13 Inbox Requester",
              language: "es"
            }
          }
        );

      assert.equal(
        requesterRegistration.statusCode,
        200
      );

      const requesterCookie =
        sessionCookie(
          requesterRegistration
        );

      const requesterProfile =
        await requestJson(
          `${baseUrl}/api/user`,
          {
            method: "PATCH",
            cookie:
              requesterCookie,
            body: {
              handle:
                "@w13_inbox_req"
            }
          }
        );

      assert.equal(
        requesterProfile.statusCode,
        200
      );

      const targetRegistration =
        await requestJson(
          `${baseUrl}/api/auth/register`,
          {
            method: "POST",
            body: {
              email:
                "w13-inbox-target@example.test",
              password:
                "runtime-pass-123",
              name:
                "W13 Inbox Target",
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

      const targetProfile =
        await requestJson(
          `${baseUrl}/api/user`,
          {
            method: "PATCH",
            cookie:
              targetCookie,
            body: {
              handle:
                "@w13_inbox"
            }
          }
        );

      assert.equal(
        targetProfile.statusCode,
        200
      );

      const targetPrivacy =
        await requestJson(
          `${baseUrl}/api/user/privacy`,
          {
            method: "PATCH",
            cookie:
              targetCookie,
            body: {
              profileVisibility:
                "followers"
            }
          }
        );

      assert.equal(
        targetPrivacy.statusCode,
        200
      );

      const followRequest =
        await requestJson(
          `${baseUrl}/api/user/following/w13_inbox`,
          {
            method: "POST",
            cookie:
              requesterCookie
          }
        );

      assert.equal(
        followRequest.statusCode,
        202
      );

      const anonymousList =
        await requestJson(
          `${baseUrl}/api/user/follow-requests`
        );

      assert.equal(
        anonymousList.statusCode,
        401
      );

      const list =
        await requestJson(
          `${baseUrl}/api/user/follow-requests`,
          {
            cookie:
              targetCookie
          }
        );

      assert.equal(
        list.statusCode,
        200
      );

      assert.ok(
        Array.isArray(
          list.json?.requests
        )
      );

      assert.equal(
        list.json.requests.length,
        1
      );

      assert.deepEqual(
        Object.keys(
          list.json.requests[0]
        ).sort(),
        [
          "avatar",
          "name",
          "username"
        ]
      );

      assert.equal(
        list.json.requests[0].name,
        "W13 Inbox Requester"
      );

      assert.equal(
        list.json.requests[0].username,
        "w13_inbox_req"
      );

      assert.equal(
        typeof list.json.requests[0].avatar,
        "string"
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
