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
      "quacker-recommendations-runtime-"
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

async function registerUser(
  baseUrl,
  {
    email,
    name,
    handle
  }
) {
  const registration =
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
    registration.statusCode,
    200
  );

  const cookie =
    sessionCookie(registration);

  const userId =
    registration.json
      ?.user?.id;

  assert.ok(userId);

  const profileUpdate =
    await requestJson(
      `${baseUrl}/api/user`,
      {
        method: "PATCH",
        cookie,
        body: {
          handle
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
        cookie,
        body: {
          profile: true
        }
      }
    );

  assert.equal(
    privacyUpdate.statusCode,
    200
  );

  return {
    cookie,
    userId
  };
}

test(
  "un amigo puede recomendar contenido y la recomendación se persiste en el receptor",
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

      const sender =
        await registerUser(
          baseUrl,
          {
            email:
              "week13-recommendation-sender@example.test",
            name:
              "Recommendation Sender",
            handle:
              "@rec_sender"
          }
        );

      const receiver =
        await registerUser(
          baseUrl,
          {
            email:
              "week13-recommendation-receiver@example.test",
            name:
              "Recommendation Receiver",
            handle:
              "@rec_receiver"
          }
        );

      const senderFollowsReceiver =
        await requestJson(
          `${baseUrl}/api/user/following/rec_receiver`,
          {
            method: "POST",
            cookie:
              sender.cookie
          }
        );

      assert.equal(
        senderFollowsReceiver.statusCode,
        201
      );

      const receiverFollowsSender =
        await requestJson(
          `${baseUrl}/api/user/following/rec_sender`,
          {
            method: "POST",
            cookie:
              receiver.cookie
          }
        );

      assert.equal(
        receiverFollowsSender.statusCode,
        201
      );

      const recommendation =
        await requestJson(
          `${baseUrl}/api/user/recommendations/rec_receiver`,
          {
            method: "POST",
            cookie:
              sender.cookie,
            body: {
              contentType: "movie",
              source: "tmdb",
              externalId: "603",
              itemSnapshot: {
                title: "The Matrix",
                cover:
                  "https://image.example.test/matrix.jpg"
              },
              message:
                "Creo que te va a gustar."
            }
          }
        );

      assert.equal(
        recommendation.statusCode,
        201
      );

      assert.equal(
        recommendation.json
          ?.recommendation
          ?.fromUserId,
        sender.userId
      );

      assert.equal(
        recommendation.json
          ?.recommendation
          ?.contentType,
        "pelicula"
      );

      assert.equal(
        recommendation.json
          ?.recommendation
          ?.source,
        "tmdb"
      );

      assert.equal(
        recommendation.json
          ?.recommendation
          ?.externalId,
        "603"
      );

      assert.ok(
        recommendation.json
          ?.recommendation
          ?.id
      );

      assert.ok(
        recommendation.json
          ?.recommendation
          ?.createdAt
      );

      const persisted =
        JSON.parse(
          fs.readFileSync(
            dbPath,
            "utf8"
          )
        );

      assert.equal(
        persisted
          .users[receiver.userId]
          .recommendations
          ?.length,
        1
      );

      assert.equal(
        persisted
          .users[receiver.userId]
          .recommendations?.[0]
          ?.fromUserId,
        sender.userId
      );

      const inbox =
        await requestJson(
          `${baseUrl}/api/user/recommendations`,
          {
            method: "GET",
            cookie:
              receiver.cookie
          }
        );

      assert.equal(
        inbox.statusCode,
        200
      );

      assert.equal(
        inbox.json
          ?.recommendations
          ?.length,
        1
      );

      assert.equal(
        inbox.json
          ?.recommendations?.[0]
          ?.fromUserId,
        sender.userId
      );

      assert.equal(
        inbox.json
          ?.recommendations?.[0]
          ?.externalId,
        "603"
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
  "un usuario que no es amigo no puede recomendar contenido",
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
      const sender =
        await registerUser(
          baseUrl,
          {
            email:
              "week13-rec-stranger-sender@example.test",
            name:
              "Recommendation Stranger Sender",
            handle:
              "@rec_stranger_a"
          }
        );

      const receiver =
        await registerUser(
          baseUrl,
          {
            email:
              "week13-rec-stranger-receiver@example.test",
            name:
              "Recommendation Stranger Receiver",
            handle:
              "@rec_stranger_b"
          }
        );

      const recommendation =
        await requestJson(
          `${baseUrl}/api/user/recommendations/rec_stranger_b`,
          {
            method: "POST",
            cookie:
              sender.cookie,
            body: {
              contentType: "movie",
              source: "tmdb",
              externalId: "603",
              itemSnapshot: {
                title: "The Matrix",
                cover:
                  "https://image.example.test/matrix.jpg"
              },
              message:
                "No somos amigos."
            }
          }
        );

      assert.equal(
        recommendation.statusCode,
        403
      );

      assert.equal(
        recommendation.json?.error,
        "friendship_required"
      );

      const persisted =
        JSON.parse(
          fs.readFileSync(
            dbPath,
            "utf8"
          )
        );

      assert.deepEqual(
        persisted
          .users[receiver.userId]
          .recommendations,
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
  "el mismo amigo no puede recomendar dos veces el mismo contenido pendiente",
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

      const sender =
        await registerUser(
          baseUrl,
          {
            email:
              "week13-rec-duplicate-sender@example.test",
            name:
              "Recommendation Duplicate Sender",
            handle:
              "@rec_dup_sender"
          }
        );

      const receiver =
        await registerUser(
          baseUrl,
          {
            email:
              "week13-rec-duplicate-receiver@example.test",
            name:
              "Recommendation Duplicate Receiver",
            handle:
              "@rec_dup_receiver"
          }
        );

      const senderFollowsReceiver =
        await requestJson(
          `${baseUrl}/api/user/following/rec_dup_receiver`,
          {
            method: "POST",
            cookie:
              sender.cookie
          }
        );

      assert.equal(
        senderFollowsReceiver.statusCode,
        201
      );

      const receiverFollowsSender =
        await requestJson(
          `${baseUrl}/api/user/following/rec_dup_sender`,
          {
            method: "POST",
            cookie:
              receiver.cookie
          }
        );

      assert.equal(
        receiverFollowsSender.statusCode,
        201
      );

      const payload = {
        contentType: "movie",
        source: "tmdb",
        externalId: "603",
        itemSnapshot: {
          title: "The Matrix",
          cover:
            "https://image.example.test/matrix.jpg"
        },
        message:
          "Primera recomendación."
      };

      const firstRecommendation =
        await requestJson(
          `${baseUrl}/api/user/recommendations/rec_dup_receiver`,
          {
            method: "POST",
            cookie:
              sender.cookie,
            body:
              payload
          }
        );

      assert.equal(
        firstRecommendation.statusCode,
        201
      );

      const duplicateRecommendation =
        await requestJson(
          `${baseUrl}/api/user/recommendations/rec_dup_receiver`,
          {
            method: "POST",
            cookie:
              sender.cookie,
            body: {
              ...payload,
              message:
                "Te la recomiendo otra vez."
            }
          }
        );

      assert.equal(
        duplicateRecommendation.statusCode,
        409
      );

      assert.equal(
        duplicateRecommendation.json?.error,
        "recommendation_already_exists"
      );

      const persisted =
        JSON.parse(
          fs.readFileSync(
            dbPath,
            "utf8"
          )
        );

      assert.equal(
        persisted
          .users[receiver.userId]
          .recommendations
          ?.length,
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
  "un usuario no puede recomendarse contenido a sí mismo",
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

      const user =
        await registerUser(
          baseUrl,
          {
            email:
              "week13-rec-self@example.test",
            name:
              "Recommendation Self",
            handle:
              "@rec_self"
          }
        );

      const response =
        await requestJson(
          `${baseUrl}/api/user/recommendations/rec_self`,
          {
            method: "POST",
            cookie:
              user.cookie,
            body: {
              contentType: "movie",
              source: "tmdb",
              externalId: "603",
              itemSnapshot: {
                title: "The Matrix",
                cover:
                  "https://image.example.test/matrix.jpg"
              },
              message:
                "Para mí."
            }
          }
        );

      assert.equal(
        response.statusCode,
        400
      );

      assert.equal(
        response.json?.error,
        "cannot_recommend_self"
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
