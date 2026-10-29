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
      "quacker-moderation-runtime-"
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
  port,
  moderatorUserIds = ""
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
            sessionStorePath,
          QUACKER_MODERATOR_USER_IDS:
            moderatorUserIds
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
        Accept: "application/json",
        Origin: new URL(url).origin
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

const DATE = "2026-10-21T09:00:00.000Z";

async function registerReportUser(
  baseUrl,
  handle,
  {
    publicProfile = true,
    reviews = false
  } = {}
) {
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

  if (publicProfile) {
    const privacy = await requestJson(
      `${baseUrl}/api/user/privacy`,
      {
        method: "PATCH",
        cookie,
        body: {
          profile: true,
          reviews
        }
      }
    );

    assert.equal(privacy.statusCode, 200);
  }

  return { cookie, userId, handle };
}

function makeReportReview(externalId, privacy = "public") {
  return {
    itemId: `local_${externalId}`,
    contentType: "pelicula",
    itemSnapshot: {
      title: `Película ${externalId}`,
      source: "tmdb",
      externalId: String(externalId)
    },
    rating: 4,
    tags: [],
    review: {
      text: `Reseña de prueba ${externalId}`,
      privacy,
      spoiler: false,
      createdAt: DATE,
      updatedAt: DATE
    },
    createdAt: DATE,
    updatedAt: DATE
  };
}

function readTestDb(dbPath) {
  return JSON.parse(
    fs.readFileSync(dbPath, "utf8")
  );
}

function writeTestDb(dbPath, db) {
  fs.writeFileSync(
    dbPath,
    JSON.stringify(db, null, 2),
    "utf8"
  );
}


test(
  "QA integral: denuncia pública, moderador, decisión y persistencia",
  { timeout: 35000 },
  async () => {
    const directory = createTemporaryDirectory();
    const dbPath = path.join(directory, "db.json");
    const sessionStorePath = path.join(directory, "sessions");

    writeTestDb(dbPath, { users: {} });

    const port = await getAvailablePort();
    const baseUrl = `http://127.0.0.1:${port}`;

    const reportUrl =
      `${baseUrl}/api/user/reports`;

    const moderationUrl =
      `${baseUrl}/api/moderation/reports`;

    let child = null;

    try {
      // 1. Servidor aislado: aún no hay moderadores.
      child = await startTestServer({
        dbPath,
        sessionStorePath,
        port,
        moderatorUserIds: ""
      });

      const reporter = await registerReportUser(
        baseUrl,
        "qa_reporter"
      );

      const author = await registerReportUser(
        baseUrl,
        "qa_author",
        { reviews: true }
      );

      const moderator = await registerReportUser(
        baseUrl,
        "qa_moderator"
      );

      // 2. Crear una reseña pública solo en la DB temporal.
      const db = readTestDb(dbPath);

      db.users[author.userId].opinions = [
        makeReportReview("603"),
        makeReportReview("604", "private")
      ];

      writeTestDb(dbPath, db);

      const publicProfile = await requestJson(
        `${baseUrl}/api/public/users/${author.handle}`,
        { cookie: reporter.cookie }
      );

      assert.equal(publicProfile.statusCode, 200);

      const publicReviews =
        publicProfile.json?.reviews || [];

      assert.equal(publicReviews.length, 1);

      assert.equal(
        publicReviews.some(
          (review) => review.externalId === "604"
        ),
        false,
        "la reseña privada no debe aparecer"
      );

      assert.equal(
        Object.hasOwn(
          publicProfile.json,
          "moderationReports"
        ),
        false
      );

      const visibleReview = publicReviews[0];

      assert.equal(
        visibleReview.externalId,
        "603"
      );

      // 3. Un visitante no puede denunciar.
      const anonymous = await requestJson(reportUrl, {
        method: "POST",
        body: {
          username: author.handle,
          kind: "user",
          reason: "spam"
        }
      });

      assert.equal(anonymous.statusCode, 401);

      // 4. La persona autenticada denuncia la reseña.
      const reviewReport = await requestJson(reportUrl, {
        method: "POST",
        cookie: reporter.cookie,
        body: {
          username: author.handle,
          kind: "review",
          reason: "spoilers",
          details: "Denuncia integral de prueba",
          reviewIdentity: {
            source: visibleReview.source,
            contentType: visibleReview.contentType,
            externalId: visibleReview.externalId
          }
        }
      });

      assert.equal(reviewReport.statusCode, 201);
      assert.equal(reviewReport.json?.ok, true);

      assert.equal(
        reviewReport.headers["cache-control"],
        "no-store"
      );

      const reviewReportId =
        reviewReport.json.reportId;

      assert.match(
        reviewReportId,
        /^report_[a-f0-9-]+$/
      );

      // Una reseña privada no puede denunciarse.
      const privateReview = await requestJson(
        reportUrl,
        {
          method: "POST",
          cookie: reporter.cookie,
          body: {
            username: author.handle,
            kind: "review",
            reason: "spam",
            reviewIdentity: {
              source: "tmdb",
              contentType: "pelicula",
              externalId: "604"
            }
          }
        }
      );

      assert.equal(privateReview.statusCode, 404);

      // No se permite una segunda denuncia pendiente
      // de la misma reseña por el mismo informante.
      const duplicate = await requestJson(
        reportUrl,
        {
          method: "POST",
          cookie: reporter.cookie,
          body: {
            username: author.handle,
            kind: "review",
            reason: "hate",
            reviewIdentity: {
              source: visibleReview.source,
              contentType: visibleReview.contentType,
              externalId: visibleReview.externalId
            }
          }
        }
      );

      assert.equal(duplicate.statusCode, 409);

      assert.equal(
        readTestDb(dbPath).moderationReports.length,
        1,
        "las solicitudes rechazadas no crean registros"
      );

      // Las denuncias no deben aparecer en la API
      // del perfil privado del denunciante.
      const account = await requestJson(
        `${baseUrl}/api/user`,
        { cookie: reporter.cookie }
      );

      assert.equal(account.statusCode, 200);

      assert.equal(
        Object.hasOwn(
          account.json,
          "moderationReports"
        ),
        false
      );

      // 5. También puede denunciar el perfil.
      const userReport = await requestJson(reportUrl, {
        method: "POST",
        cookie: reporter.cookie,
        body: {
          username: author.handle,
          kind: "user",
          reason: "harassment",
          details: "Denuncia del perfil de prueba"
        }
      });

      assert.equal(userReport.statusCode, 201);

      const userReportId =
        userReport.json.reportId;

      assert.notEqual(
        userReportId,
        reviewReportId
      );

      // 6. Nadie puede acceder como moderador
      // sin estar configurado expresamente.
      const denied = await requestJson(
        moderationUrl,
        { cookie: reporter.cookie }
      );

      assert.equal(denied.statusCode, 403);
      assert.equal(
        denied.text.includes("Reseña de prueba"),
        false
      );

      const anonymousInbox = await requestJson(
        moderationUrl
      );

      assert.equal(anonymousInbox.statusCode, 401);

      assert.equal(
        anonymousInbox.text.includes("Reseña de prueba"),
        false
      );

      const unconfigured = await requestJson(
        moderationUrl,
        { cookie: moderator.cookie }
      );

      assert.equal(unconfigured.statusCode, 403);

      // 7. Reiniciar exclusivamente el servidor temporal,
      // conservando las cuentas y sesiones de QA.
      await stopTestServer(child);
      child = null;

      child = await startTestServer({
        dbPath,
        sessionStorePath,
        port,
        moderatorUserIds: moderator.userId
      });

      const access = await requestJson(
        `${baseUrl}/api/moderation/access`,
        { cookie: moderator.cookie }
      );

      assert.equal(access.statusCode, 200);
      assert.deepEqual(access.json, {
        isModerator: true
      });

      const reporterAccess = await requestJson(
        `${baseUrl}/api/moderation/access`,
        { cookie: reporter.cookie }
      );

      assert.deepEqual(reporterAccess.json, {
        isModerator: false
      });

      // 8. El moderador ve las dos denuncias.
      const inbox = await requestJson(
        moderationUrl,
        { cookie: moderator.cookie }
      );

      assert.equal(inbox.statusCode, 200);
      assert.equal(inbox.json?.totalPending, 2);
      assert.equal(inbox.json?.reports?.length, 2);
      assert.equal(
        inbox.headers["cache-control"],
        "no-store"
      );

      const pendingReview =
        inbox.json.reports.find(
          (item) => item.id === reviewReportId
        );

      const pendingUser =
        inbox.json.reports.find(
          (item) => item.id === userReportId
        );

      assert.ok(pendingReview);
      assert.ok(pendingUser);

      assert.equal(pendingReview.kind, "review");
      assert.equal(pendingUser.kind, "user");
      assert.equal(pendingReview.reporterUserId, reporter.userId);
      assert.equal(pendingReview.targetUserId, author.userId);
      assert.equal(
        pendingReview.reporterUsername,
        reporter.handle
      );
      assert.equal(
        pendingReview.targetUsername,
        author.handle
      );
      assert.equal(
        pendingUser.reporterUsername,
        reporter.handle
      );
      assert.equal(
        pendingUser.targetUsername,
        author.handle
      );

      // La respuesta autorizada no incorpora datos de cuenta.
      for (const report of inbox.json.reports) {
        assert.equal(
          Object.hasOwn(report, "email"),
          false
        );
        assert.equal(
          Object.hasOwn(report, "profile"),
          false
        );
        assert.equal(
          Object.hasOwn(report, "password"),
          false
        );
      }

      assert.equal(
        pendingReview.reviewEvidence?.text,
        "Reseña de prueba 603"
      );

      // 9. Un usuario corriente no puede decidir.
      const deniedDecision = await requestJson(
        `${moderationUrl}/${reviewReportId}/decision`,
        {
          method: "POST",
          cookie: reporter.cookie,
          body: {
            action: "resolve",
            notes: "Intento sin permisos"
          }
        }
      );

      assert.equal(deniedDecision.statusCode, 403);

      // 10. Resolver la denuncia de reseña.
      const resolved = await requestJson(
        `${moderationUrl}/${reviewReportId}/decision`,
        {
          method: "POST",
          cookie: moderator.cookie,
          body: {
            action: "resolve",
            notes: "  Revisión integral completada  "
          }
        }
      );

      assert.equal(resolved.statusCode, 200);
      assert.deepEqual(resolved.json, {
        ok: true,
        reportId: reviewReportId,
        status: "resolved"
      });

      const repeatedDecision = await requestJson(
        `${moderationUrl}/${reviewReportId}/decision`,
        {
          method: "POST",
          cookie: moderator.cookie,
          body: {
            action: "dismiss",
            notes: "Intento posterior"
          }
        }
      );

      assert.equal(repeatedDecision.statusCode, 409);

      assert.equal(
        resolved.text.includes("Reseña de prueba 603"),
        false
      );

      assert.equal(
        resolved.text.includes("Revisión integral completada"),
        false
      );

      // 11. Descartar la denuncia de usuario.
      const dismissed = await requestJson(
        `${moderationUrl}/${userReportId}/decision`,
        {
          method: "POST",
          cookie: moderator.cookie,
          body: {
            action: "dismiss",
            notes: "No procede"
          }
        }
      );

      assert.equal(dismissed.statusCode, 200);
      assert.equal(dismissed.json?.status, "dismissed");

      // 12. La bandeja queda vacía.
      const emptyInbox = await requestJson(
        moderationUrl,
        { cookie: moderator.cookie }
      );

      assert.equal(emptyInbox.statusCode, 200);
      assert.deepEqual(emptyInbox.json, {
        totalPending: 0,
        reports: []
      });

      // 13. Comprobar auditoría y conservación de
      // evidencias en la base temporal.
      const persisted = readTestDb(dbPath);

      const reviewRecord =
        persisted.moderationReports.find(
          (item) => item.id === reviewReportId
        );

      const userRecord =
        persisted.moderationReports.find(
          (item) => item.id === userReportId
        );

      assert.equal(
        persisted.moderationReports.length,
        2,
        "solo deben existir las denuncias válidas"
      );

      assert.equal(reviewRecord.status, "resolved");
      assert.equal(userRecord.status, "dismissed");

      assert.equal(
        reviewRecord.reviewEvidence?.text,
        "Reseña de prueba 603"
      );

      assert.equal(
        reviewRecord.moderationDecision.moderatorUserId,
        moderator.userId
      );

      assert.equal(
        reviewRecord.moderationDecision.notes,
        "Revisión integral completada"
      );

      assert.equal(
        userRecord.moderationDecision.notes,
        "No procede"
      );

      // Moderar no debe cambiar el contenido del autor.
      assert.deepEqual(
        persisted.users[author.userId].opinions,
        db.users[author.userId].opinions
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
