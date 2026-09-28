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

      const recommendationNotification =
        persisted
          .users[receiver.userId]
          .notifications
          ?.find(
            (notification) =>
              notification.title ===
              "Recommendation Sender te recomienda The Matrix"
          );

      assert.ok(
        recommendationNotification,
        "una recomendación válida debe notificar al receptor"
      );

      assert.equal(
        recommendationNotification.text,
        "Creo que te va a gustar."
      );

      assert.equal(
        recommendationNotification.icon,
        "bell"
      );

      persisted
        .users[receiver.userId]
        .recommendations
        .push({
          id: "rec-dismissed",
          fromUserId: sender.userId,
          contentType: "pelicula",
          source: "tmdb",
          externalId: "27205",
          itemSnapshot: {
            title: "Inception",
            cover: ""
          },
          message: "Esta ya no debe aparecer.",
          createdAt: "2026-09-25T18:00:00.000Z",
          status: "dismissed",
          resolvedAt: "2026-09-25T19:00:00.000Z"
        });

      fs.writeFileSync(
        dbPath,
        JSON.stringify(
          persisted,
          null,
          2
        ),
        "utf8"
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

      assert.deepEqual(
        inbox.json
          ?.recommendations?.[0]
          ?.sender,
        {
          name: "Recommendation Sender",
          username: "rec_sender",
          avatar: ""
        }
      );

      assert.equal(
        inbox.json
          ?.recommendations?.[0]
          ?.externalId,
        "603"
      );

      const recommendationId =
        inbox.json
          ?.recommendations?.[0]
          ?.id;

      const dismissed =
        await requestJson(
          `${baseUrl}/api/user/recommendations/${recommendationId}`,
          {
            method: "PATCH",
            cookie:
              receiver.cookie,
            body: {
              status: "dismissed"
            }
          }
        );

      assert.equal(
        dismissed.statusCode,
        200
      );

      assert.equal(
        dismissed.json
          ?.recommendation
          ?.status,
        "dismissed"
      );

      assert.ok(
        dismissed.json
          ?.recommendation
          ?.resolvedAt
      );

      const afterDismiss =
        await requestJson(
          `${baseUrl}/api/user/recommendations`,
          {
            method: "GET",
            cookie:
              receiver.cookie
          }
        );

      assert.equal(
        afterDismiss.statusCode,
        200
      );

      assert.equal(
        afterDismiss.json
          ?.recommendations
          ?.length,
        0
      );

      const persistedAfterDismiss =
        JSON.parse(
          fs.readFileSync(
            dbPath,
            "utf8"
          )
        );

      const storedDismissed =
        persistedAfterDismiss
          .users[receiver.userId]
          .recommendations
          .find(
            (entry) =>
              entry.id ===
              recommendationId
          );

      assert.equal(
        storedDismissed?.status,
        "dismissed"
      );

      assert.ok(
        storedDismissed?.resolvedAt
      );

      const recommendationToAdd =
        await requestJson(
          `${baseUrl}/api/user/recommendations/rec_receiver`,
          {
            method: "POST",
            cookie:
              sender.cookie,
            body: {
              contentType: "movie",
              source: "tmdb",
              externalId: "329865",
              itemSnapshot: {
                title: "Arrival",
                cover: ""
              },
              message:
                "Esta también te va a gustar."
            }
          }
        );

      assert.equal(
        recommendationToAdd.statusCode,
        201
      );

      const recommendationToAddId =
        recommendationToAdd.json
          ?.recommendation
          ?.id;

      const added =
        await requestJson(
          `${baseUrl}/api/user/recommendations/${recommendationToAddId}`,
          {
            method: "PATCH",
            cookie:
              receiver.cookie,
            body: {
              status: "added"
            }
          }
        );

      assert.equal(
        added.statusCode,
        200
      );

      assert.equal(
        added.json
          ?.recommendation
          ?.status,
        "added"
      );

      assert.ok(
        added.json
          ?.recommendation
          ?.resolvedAt
      );

      assert.equal(
        added.json
          ?.item
          ?.type,
        "pelicula"
      );

      assert.equal(
        added.json
          ?.item
          ?.externalId,
        "329865"
      );

      assert.equal(
        added.json
          ?.item
          ?.status,
        "not_started"
      );

      assert.equal(
        added.json
          ?.item
          ?.progress,
        0
      );

      const persistedAfterAdd =
        JSON.parse(
          fs.readFileSync(
            dbPath,
            "utf8"
          )
        );

      const storedAdded =
        persistedAfterAdd
          .users[receiver.userId]
          .recommendations
          .find(
            (entry) =>
              entry.id ===
              recommendationToAddId
          );

      assert.equal(
        storedAdded?.status,
        "added"
      );

      assert.ok(
        storedAdded?.resolvedAt
      );

      const storedLibraryItem =
        persistedAfterAdd
          .users[receiver.userId]
          .library
          .find(
            (item) =>
              item.source === "tmdb" &&
              item.externalId === "329865"
          );

      assert.equal(
        storedLibraryItem?.status,
        "not_started"
      );

      assert.equal(
        storedLibraryItem?.progress,
        0
      );

      const existingLibraryItem =
        await requestJson(
          `${baseUrl}/api/library`,
          {
            method: "POST",
            cookie:
              receiver.cookie,
            body: {
              type: "pelicula",
              title: "The Prestige",
              source: "tmdb",
              externalId: "1124",
              progress: 0
            }
          }
        );

      assert.equal(
        existingLibraryItem.statusCode,
        200
      );

      const existingLibraryItemId =
        existingLibraryItem.json
          ?.id;

      const recommendationForExistingItem =
        await requestJson(
          `${baseUrl}/api/user/recommendations/rec_receiver`,
          {
            method: "POST",
            cookie:
              sender.cookie,
            body: {
              contentType: "movie",
              source: "tmdb",
              externalId: "1124",
              itemSnapshot: {
                title: "The Prestige",
                cover: ""
              },
              message:
                "Esta ya la tienes, pero te la recomiendo igualmente."
            }
          }
        );

      assert.equal(
        recommendationForExistingItem.statusCode,
        201
      );

      const recommendationForExistingItemId =
        recommendationForExistingItem.json
          ?.recommendation
          ?.id;

      const addedExistingItem =
        await requestJson(
          `${baseUrl}/api/user/recommendations/${recommendationForExistingItemId}`,
          {
            method: "PATCH",
            cookie:
              receiver.cookie,
            body: {
              status: "added"
            }
          }
        );

      assert.equal(
        addedExistingItem.statusCode,
        200
      );

      assert.equal(
        addedExistingItem.json
          ?.recommendation
          ?.status,
        "added"
      );

      assert.equal(
        addedExistingItem.json
          ?.item
          ?.id,
        existingLibraryItemId
      );

      const persistedAfterExistingAdd =
        JSON.parse(
          fs.readFileSync(
            dbPath,
            "utf8"
          )
        );

      const matchingExistingItems =
        persistedAfterExistingAdd
          .users[receiver.userId]
          .library
          .filter(
            (item) =>
              item.source === "tmdb" &&
              item.externalId === "1124"
          );

      assert.equal(
        matchingExistingItems.length,
        1
      );

      assert.equal(
        matchingExistingItems[0]?.id,
        existingLibraryItemId
      );

      assert.equal(
        matchingExistingItems[0]?.status,
        "not_started"
      );

      assert.equal(
        matchingExistingItems[0]?.progress,
        0
      );

      const existingItemToConsume =
        await requestJson(
          `${baseUrl}/api/library`,
          {
            method: "POST",
            cookie:
              receiver.cookie,
            body: {
              type: "pelicula",
              title: "Fight Club",
              source: "tmdb",
              externalId: "550",
              progress: 0
            }
          }
        );

      assert.equal(
        existingItemToConsume.statusCode,
        200
      );

      const existingItemToConsumeId =
        existingItemToConsume.json
          ?.id;

      const recommendationForExistingConsume =
        await requestJson(
          `${baseUrl}/api/user/recommendations/rec_receiver`,
          {
            method: "POST",
            cookie:
              sender.cookie,
            body: {
              contentType: "movie",
              source: "tmdb",
              externalId: "550",
              itemSnapshot: {
                title: "Fight Club",
                cover: ""
              },
              message:
                "Esta también tienes que verla."
            }
          }
        );

      assert.equal(
        recommendationForExistingConsume.statusCode,
        201
      );

      const recommendationForExistingConsumeId =
        recommendationForExistingConsume.json
          ?.recommendation
          ?.id;

      const consumedExistingItem =
        await requestJson(
          `${baseUrl}/api/user/recommendations/${recommendationForExistingConsumeId}`,
          {
            method: "PATCH",
            cookie:
              receiver.cookie,
            body: {
              status: "consumed"
            }
          }
        );

      assert.equal(
        consumedExistingItem.statusCode,
        200
      );

      assert.equal(
        consumedExistingItem.json
          ?.recommendation
          ?.status,
        "consumed"
      );

      assert.equal(
        consumedExistingItem.json
          ?.item
          ?.id,
        existingItemToConsumeId
      );

      assert.equal(
        consumedExistingItem.json
          ?.item
          ?.status,
        "completed"
      );

      assert.equal(
        consumedExistingItem.json
          ?.item
          ?.progress,
        100
      );

      const persistedAfterExistingConsume =
        JSON.parse(
          fs.readFileSync(
            dbPath,
            "utf8"
          )
        );

      const matchingConsumedItems =
        persistedAfterExistingConsume
          .users[receiver.userId]
          .library
          .filter(
            (item) =>
              item.source === "tmdb" &&
              item.externalId === "550"
          );

      assert.equal(
        matchingConsumedItems.length,
        1
      );

      assert.equal(
        matchingConsumedItems[0]?.id,
        existingItemToConsumeId
      );

      assert.equal(
        matchingConsumedItems[0]?.status,
        "completed"
      );

      assert.equal(
        matchingConsumedItems[0]?.progress,
        100
      );

      assert.ok(
        persistedAfterExistingConsume
          .users[receiver.userId]
          .consumptionHistory
          ?.some(
            (event) =>
              event.eventType === "watched" &&
              event.itemId ===
                existingItemToConsumeId
          )
      );

      const alreadyCompletedItem =
        await requestJson(
          `${baseUrl}/api/library`,
          {
            method: "POST",
            cookie:
              receiver.cookie,
            body: {
              type: "pelicula",
              title: "The Dark Knight",
              source: "tmdb",
              externalId: "155",
              progress: 100,
              status: "completed"
            }
          }
        );

      assert.equal(
        alreadyCompletedItem.statusCode,
        200
      );

      const alreadyCompletedItemId =
        alreadyCompletedItem.json
          ?.id;

      const beforeAlreadyCompleted =
        JSON.parse(
          fs.readFileSync(
            dbPath,
            "utf8"
          )
        );

      const beforeWatchedCount =
        (
          beforeAlreadyCompleted
            .users[receiver.userId]
            .consumptionHistory || []
        ).filter(
          (event) =>
            event.eventType === "watched" &&
            event.itemId ===
              alreadyCompletedItemId
        ).length;

      const beforeCompletedActivityCount =
        (
          beforeAlreadyCompleted
            .users[receiver.userId]
            .activities || []
        ).filter(
          (activity) =>
            activity.type === "completed" &&
            activity.targetId ===
              alreadyCompletedItemId
        ).length;

      const beforeRateContentCount =
        (
          beforeAlreadyCompleted
            .users[receiver.userId]
            .notifications || []
        ).filter(
          (notification) =>
            notification.action ===
              "rate_content" &&
            notification.itemId ===
              alreadyCompletedItemId
        ).length;

      const recommendationForAlreadyCompleted =
        await requestJson(
          `${baseUrl}/api/user/recommendations/rec_receiver`,
          {
            method: "POST",
            cookie:
              sender.cookie,
            body: {
              contentType: "movie",
              source: "tmdb",
              externalId: "155",
              itemSnapshot: {
                title: "The Dark Knight",
                cover: ""
              },
              message:
                "Esta es imprescindible."
            }
          }
        );

      assert.equal(
        recommendationForAlreadyCompleted.statusCode,
        201
      );

      const alreadyCompletedRecommendationId =
        recommendationForAlreadyCompleted.json
          ?.recommendation
          ?.id;

      const consumedAlreadyCompleted =
        await requestJson(
          `${baseUrl}/api/user/recommendations/${alreadyCompletedRecommendationId}`,
          {
            method: "PATCH",
            cookie:
              receiver.cookie,
            body: {
              status: "consumed"
            }
          }
        );

      assert.equal(
        consumedAlreadyCompleted.statusCode,
        200
      );

      assert.equal(
        consumedAlreadyCompleted.json
          ?.recommendation
          ?.status,
        "consumed"
      );

      assert.equal(
        consumedAlreadyCompleted.json
          ?.item
          ?.id,
        alreadyCompletedItemId
      );

      const afterAlreadyCompleted =
        JSON.parse(
          fs.readFileSync(
            dbPath,
            "utf8"
          )
        );

      const afterWatchedCount =
        (
          afterAlreadyCompleted
            .users[receiver.userId]
            .consumptionHistory || []
        ).filter(
          (event) =>
            event.eventType === "watched" &&
            event.itemId ===
              alreadyCompletedItemId
        ).length;

      const afterCompletedActivityCount =
        (
          afterAlreadyCompleted
            .users[receiver.userId]
            .activities || []
        ).filter(
          (activity) =>
            activity.type === "completed" &&
            activity.targetId ===
              alreadyCompletedItemId
        ).length;

      const afterRateContentCount =
        (
          afterAlreadyCompleted
            .users[receiver.userId]
            .notifications || []
        ).filter(
          (notification) =>
            notification.action ===
              "rate_content" &&
            notification.itemId ===
              alreadyCompletedItemId
        ).length;

      assert.equal(
        afterWatchedCount,
        beforeWatchedCount
      );

      assert.equal(
        afterCompletedActivityCount,
        beforeCompletedActivityCount
      );

      assert.equal(
        afterRateContentCount,
        beforeRateContentCount
      );

      const recommendationToConsume =
        await requestJson(
          `${baseUrl}/api/user/recommendations/rec_receiver`,
          {
            method: "POST",
            cookie:
              sender.cookie,
            body: {
              contentType: "movie",
              source: "tmdb",
              externalId: "157336",
              itemSnapshot: {
                title: "Interstellar",
                cover: ""
              },
              message:
                "Esta tienes que verla."
            }
          }
        );

      assert.equal(
        recommendationToConsume.statusCode,
        201
      );

      const recommendationToConsumeId =
        recommendationToConsume.json
          ?.recommendation
          ?.id;

      const consumed =
        await requestJson(
          `${baseUrl}/api/user/recommendations/${recommendationToConsumeId}`,
          {
            method: "PATCH",
            cookie:
              receiver.cookie,
            body: {
              status: "consumed"
            }
          }
        );

      assert.equal(
        consumed.statusCode,
        200
      );

      assert.equal(
        consumed.json
          ?.recommendation
          ?.status,
        "consumed"
      );

      assert.ok(
        consumed.json
          ?.recommendation
          ?.resolvedAt
      );

      assert.equal(
        consumed.json
          ?.item
          ?.status,
        "completed"
      );

      assert.equal(
        consumed.json
          ?.item
          ?.progress,
        100
      );

      const persistedAfterConsume =
        JSON.parse(
          fs.readFileSync(
            dbPath,
            "utf8"
          )
        );

      const storedConsumed =
        persistedAfterConsume
          .users[receiver.userId]
          .recommendations
          .find(
            (entry) =>
              entry.id ===
              recommendationToConsumeId
          );

      assert.equal(
        storedConsumed?.status,
        "consumed"
      );

      const consumedLibraryItem =
        persistedAfterConsume
          .users[receiver.userId]
          .library
          .find(
            (item) =>
              item.source === "tmdb" &&
              item.externalId === "157336"
          );

      assert.equal(
        consumedLibraryItem?.status,
        "completed"
      );

      assert.equal(
        consumedLibraryItem?.progress,
        100
      );

      assert.ok(
        persistedAfterConsume
          .users[receiver.userId]
          .activities
          ?.some(
            (activity) =>
              activity.type === "completed" &&
              activity.targetId ===
                consumedLibraryItem?.id
          )
      );

      assert.ok(
        persistedAfterConsume
          .users[receiver.userId]
          .consumptionHistory
          ?.some(
            (event) =>
              event.eventType === "watched" &&
              event.itemId ===
                consumedLibraryItem?.id
          )
      );

      assert.ok(
        persistedAfterConsume
          .users[receiver.userId]
          .notifications
          ?.some(
            (notification) =>
              notification.action ===
                "rate_content" &&
              notification.itemId ===
                consumedLibraryItem?.id
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

test(
  "POST /api/library crea un contenido pendiente de empezar y no duplica la misma identidad",
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
              "week13-library-baseline@example.test",
            name:
              "Library Baseline",
            handle:
              "@lib_baseline"
          }
        );

      const first =
        await requestJson(
          `${baseUrl}/api/library`,
          {
            method: "POST",
            cookie:
              user.cookie,
            body: {
              type: "pelicula",
              title: "Arrival",
              source: "tmdb",
              externalId: "329865",
              cover: ""
            }
          }
        );

      assert.equal(
        first.statusCode,
        200
      );

      assert.equal(
        first.json?.type,
        "pelicula"
      );

      assert.equal(
        first.json?.status,
        "not_started"
      );

      assert.equal(
        first.json?.progress,
        0
      );

      assert.equal(
        first.json?.externalId,
        "329865"
      );

      const second =
        await requestJson(
          `${baseUrl}/api/library`,
          {
            method: "POST",
            cookie:
              user.cookie,
            body: {
              type: "pelicula",
              title: "Arrival",
              source: "tmdb",
              externalId: "329865",
              cover: ""
            }
          }
        );

      assert.equal(
        second.statusCode,
        200
      );

      assert.equal(
        second.json?.alreadyExists,
        true
      );

      assert.equal(
        second.json?.item?.externalId,
        "329865"
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
          .users[user.userId]
          .library
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
