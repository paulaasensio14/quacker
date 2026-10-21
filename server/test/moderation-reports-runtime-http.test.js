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
  "denuncias HTTP: autenticación, privacidad, validación y persistencia",
  { timeout: 25000 },
  async () => {
    const directory = createTemporaryDirectory();
    const dbPath = path.join(directory, "db.json");
    const sessionStorePath = path.join(directory, "sessions");

    writeTestDb(dbPath, { users: {} });

    const port = await getAvailablePort();
    const baseUrl = `http://127.0.0.1:${port}`;
    const url = `${baseUrl}/api/user/reports`;

    let child = null;

    try {
      child = await startTestServer({
        dbPath,
        sessionStorePath,
        port
      });

      const alice = await registerReportUser(
        baseUrl,
        "reports_alice"
      );

      const bob = await registerReportUser(
        baseUrl,
        "reports_bob",
        { reviews: true }
      );

      await registerReportUser(
        baseUrl,
        "reports_hidden",
        { publicProfile: false }
      );

      const initialDb = readTestDb(dbPath);

      initialDb.users[bob.userId].opinions = [
        makeReportReview("603"),
        makeReportReview("604", "private")
      ];

      writeTestDb(dbPath, initialDb);

      const anonymous = await requestJson(url, {
        method: "POST",
        body: {
          username: bob.handle,
          kind: "user",
          reason: "spam"
        }
      });

      assert.equal(anonymous.statusCode, 401);
      assert.equal(
        readTestDb(dbPath).moderationReports,
        undefined
      );

      const self = await requestJson(url, {
        method: "POST",
        cookie: alice.cookie,
        body: {
          username: alice.handle,
          kind: "user",
          reason: "spam"
        }
      });

      assert.equal(self.statusCode, 400);
      assert.equal(self.json?.error, "cannot_report_self");

      const hidden = await requestJson(url, {
        method: "POST",
        cookie: alice.cookie,
        body: {
          username: "reports_hidden",
          kind: "user",
          reason: "spam"
        }
      });

      assert.equal(hidden.statusCode, 404);

      const unknown = await requestJson(url, {
        method: "POST",
        cookie: alice.cookie,
        body: {
          username: "reports_nonexistent",
          kind: "user",
          reason: "spam"
        }
      });

      assert.equal(unknown.statusCode, 404);

      const invalid = await requestJson(url, {
        method: "POST",
        cookie: alice.cookie,
        body: {
          username: bob.handle,
          kind: "user",
          reason: "not_allowed"
        }
      });

      assert.equal(invalid.statusCode, 400);
      assert.equal(
        invalid.json?.error,
        "invalid_report_reason"
      );

      const created = await requestJson(url, {
        method: "POST",
        cookie: alice.cookie,
        body: {
          username: bob.handle,
          kind: "user",
          reason: "harassment",
          details: "Incidencia de prueba",
          reporterUserId: bob.userId,
          targetUserId: alice.userId,
          status: "resolved",
          isAdmin: true,
          id: "forged"
        }
      });

      assert.equal(created.statusCode, 201);
      assert.equal(created.json?.ok, true);
      assert.match(
        created.json?.reportId || "",
        /^report_[a-f0-9-]+$/
      );

      assert.deepEqual(
        Object.keys(created.json).sort(),
        ["ok", "reportId"]
      );

      let persisted = readTestDb(dbPath);

      assert.equal(persisted.moderationReports.length, 1);

      const stored = persisted.moderationReports[0];

      assert.equal(stored.reporterUserId, alice.userId);
      assert.equal(stored.targetUserId, bob.userId);
      assert.equal(stored.status, "pending");
      assert.equal(stored.reason, "harassment");
      assert.equal(stored.isAdmin, undefined);

      const duplicate = await requestJson(url, {
        method: "POST",
        cookie: alice.cookie,
        body: {
          username: bob.handle,
          kind: "user",
          reason: "spam"
        }
      });

      assert.equal(duplicate.statusCode, 409);
      assert.equal(
        duplicate.json?.error,
        "report_already_exists"
      );

      const privateReview = await requestJson(url, {
        method: "POST",
        cookie: alice.cookie,
        body: {
          username: bob.handle,
          kind: "review",
          reason: "spam",
          reviewIdentity: {
            source: "tmdb",
            contentType: "pelicula",
            externalId: "604"
          }
        }
      });

      assert.equal(privateReview.statusCode, 404);

      const missingReview = await requestJson(url, {
        method: "POST",
        cookie: alice.cookie,
        body: {
          username: bob.handle,
          kind: "review",
          reason: "spam",
          reviewIdentity: {
            source: "tmdb",
            contentType: "pelicula",
            externalId: "999"
          }
        }
      });

      assert.equal(missingReview.statusCode, 404);

      const publicReview = await requestJson(url, {
        method: "POST",
        cookie: alice.cookie,
        body: {
          username: bob.handle,
          kind: "review",
          reason: "spoilers",
          reviewIdentity: {
            source: "tmdb",
            contentType: "movie",
            externalId: "000603"
          }
        }
      });

      assert.equal(publicReview.statusCode, 201);

      persisted = readTestDb(dbPath);

      assert.equal(persisted.moderationReports.length, 2);
      assert.equal(
        persisted.moderationReports[1].reviewIdentity.externalId,
        "603"
      );

      const duplicateReview = await requestJson(url, {
        method: "POST",
        cookie: alice.cookie,
        body: {
          username: bob.handle,
          kind: "review",
          reason: "hate",
          reviewIdentity: {
            source: "tmdb",
            contentType: "pelicula",
            externalId: "603"
          }
        }
      });

      assert.equal(duplicateReview.statusCode, 409);

      assert.equal(
        readTestDb(dbPath).moderationReports.length,
        2
      );

      // Los reportes no forman parte de los datos
      // devueltos por la API normal del usuario.
      const userProfile = await requestJson(
        `${baseUrl}/api/user`,
        { cookie: alice.cookie }
      );

      assert.equal(userProfile.statusCode, 200);
      assert.equal(
        Object.hasOwn(
          userProfile.json || {},
          "moderationReports"
        ),
        false
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
  "denuncias HTTP: límite por usuario sin escrituras rechazadas",
  { timeout: 25000 },
  async () => {
    const directory = createTemporaryDirectory();
    const dbPath = path.join(directory, "db.json");
    const sessionStorePath = path.join(directory, "sessions");

    writeTestDb(dbPath, { users: {} });

    const port = await getAvailablePort();
    const baseUrl = `http://127.0.0.1:${port}`;
    const url = `${baseUrl}/api/user/reports`;

    let child = null;

    try {
      child = await startTestServer({
        dbPath,
        sessionStorePath,
        port
      });

      const reporter = await registerReportUser(
        baseUrl,
        "reports_limit_a"
      );

      const author = await registerReportUser(
        baseUrl,
        "reports_limit_b",
        { reviews: true }
      );

      const db = readTestDb(dbPath);

      db.users[author.userId].opinions =
        [603, 604, 605, 606, 607, 608].map(
          (id) => makeReportReview(id)
        );

      writeTestDb(dbPath, db);

      for (const externalId of [
        "603", "604", "605", "606", "607", "608"
      ]) {
        const response = await requestJson(url, {
          method: "POST",
          cookie: reporter.cookie,
          body: {
            username: author.handle,
            kind: "review",
            reason: "spam",
            reviewIdentity: {
              source: "tmdb",
              contentType: "pelicula",
              externalId
            }
          }
        });

        if (externalId === "608") {
          assert.equal(response.statusCode, 429);
          assert.equal(
            response.json?.error,
            "moderation_report_rate_limited"
          );
          assert.ok(
            Number(response.headers["retry-after"]) > 0
          );
        } else {
          assert.equal(
            response.statusCode,
            201,
            `denuncia del contenido ${externalId}`
          );
        }
      }

      const persisted = readTestDb(dbPath);

      assert.equal(
        persisted.moderationReports.length,
        5,
        "el sexto reporte rechazado no debe guardarse"
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
  "denuncias HTTP: limita también los intentos inválidos",
  { timeout: 25000 },
  async () => {
    const directory = createTemporaryDirectory();
    const dbPath = path.join(directory, "db.json");
    const sessionStorePath = path.join(directory, "sessions");

    writeTestDb(dbPath, { users: {} });

    const port = await getAvailablePort();
    const baseUrl = `http://127.0.0.1:${port}`;
    const url = `${baseUrl}/api/user/reports`;

    let child = null;

    try {
      child = await startTestServer({
        dbPath,
        sessionStorePath,
        port
      });

      const reporter = await registerReportUser(
        baseUrl,
        "reports_try_limit"
      );

      const initialDb = readTestDb(dbPath);

      for (let attempt = 1; attempt <= 30; attempt += 1) {
        const response = await requestJson(url, {
          method: "POST",
          cookie: reporter.cookie,
          body: {
            username: "nonexistent_user",
            kind: "user",
            reason: "spam"
          }
        });

        assert.equal(
          response.statusCode,
          404,
          `intento inválido ${attempt}`
        );
      }

      const rejected = await requestJson(url, {
        method: "POST",
        cookie: reporter.cookie,
        body: {
          username: "nonexistent_user",
          kind: "user",
          reason: "spam"
        }
      });

      assert.equal(rejected.statusCode, 429);

      assert.equal(
        rejected.json?.error,
        "moderation_report_attempt_rate_limited"
      );

      assert.ok(
        Number(rejected.headers["retry-after"]) > 0
      );

      assert.deepEqual(
        readTestDb(dbPath),
        initialDb,
        "los intentos inválidos no deben modificar datos"
      );

      const anonymous = await requestJson(url, {
        method: "POST",
        body: {
          username: "nonexistent_user",
          kind: "user",
          reason: "spam"
        }
      });

      assert.equal(
        anonymous.statusCode,
        401,
        "la autenticación sigue siendo obligatoria"
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
  "denuncias HTTP: respeta cambios de privacidad y bloqueos",
  { timeout: 25000 },
  async () => {
    const directory = createTemporaryDirectory();
    const dbPath = path.join(directory, "db.json");
    const sessionStorePath = path.join(directory, "sessions");

    writeTestDb(dbPath, { users: {} });

    const port = await getAvailablePort();
    const baseUrl = `http://127.0.0.1:${port}`;
    const reportUrl = `${baseUrl}/api/user/reports`;

    let child = null;

    const reviewBody = (username, externalId) => ({
      username,
      kind: "review",
      reason: "spam",
      reviewIdentity: {
        source: "tmdb",
        contentType: "pelicula",
        externalId
      }
    });

    try {
      child = await startTestServer({
        dbPath,
        sessionStorePath,
        port
      });

      const alice = await registerReportUser(
        baseUrl,
        "reports_view_a"
      );

      const bob = await registerReportUser(
        baseUrl,
        "reports_view_b",
        { reviews: true }
      );

      const charlie = await registerReportUser(
        baseUrl,
        "reports_view_c"
      );

      const initialDb = readTestDb(dbPath);

      initialDb.users[bob.userId].opinions = [
        makeReportReview("603"),
        makeReportReview("604")
      ];

      writeTestDb(dbPath, initialDb);

      // Una reseña inicialmente pública puede denunciarse.
      const firstReport = await requestJson(reportUrl, {
        method: "POST",
        cookie: alice.cookie,
        body: reviewBody(bob.handle, "603")
      });

      assert.equal(firstReport.statusCode, 201);
      assert.equal(
        readTestDb(dbPath).moderationReports.length,
        1
      );

      // El autor oculta la sección completa de reseñas.
      const hideReviews = await requestJson(
        `${baseUrl}/api/user/privacy`,
        {
          method: "PATCH",
          cookie: bob.cookie,
          body: { reviews: false }
        }
      );

      assert.equal(hideReviews.statusCode, 200);

      const hiddenReport = await requestJson(reportUrl, {
        method: "POST",
        cookie: charlie.cookie,
        body: reviewBody(bob.handle, "603")
      });

      assert.equal(hiddenReport.statusCode, 404);

      // Una denuncia anterior se conserva.
      assert.equal(
        readTestDb(dbPath).moderationReports.length,
        1
      );

      // El autor vuelve a mostrar sus reseñas.
      const showReviews = await requestJson(
        `${baseUrl}/api/user/privacy`,
        {
          method: "PATCH",
          cookie: bob.cookie,
          body: { reviews: true }
        }
      );

      assert.equal(showReviews.statusCode, 200);

      // Pero cambia una reseña concreta a privada.
      const dbWithPrivateReview = readTestDb(dbPath);

      const privateOpinion =
        dbWithPrivateReview.users[bob.userId]
          .opinions.find(
            (opinion) =>
              opinion.itemSnapshot?.externalId === "603"
          );

      assert.ok(privateOpinion);

      privateOpinion.review.privacy = "private";

      writeTestDb(dbPath, dbWithPrivateReview);

      const privateReport = await requestJson(reportUrl, {
        method: "POST",
        cookie: charlie.cookie,
        body: reviewBody(bob.handle, "603")
      });

      assert.equal(privateReport.statusCode, 404);

      // Una segunda reseña continúa siendo pública.
      const profileBeforeBlock = await requestJson(
        `${baseUrl}/api/public/users/${bob.handle}`,
        { cookie: charlie.cookie }
      );

      assert.equal(profileBeforeBlock.statusCode, 200);

      assert.ok(
        profileBeforeBlock.json?.reviews?.some(
          (review) =>
            review.externalId === "604"
        )
      );

      // Bob bloquea a Charlie.
      const blockCharlie = await requestJson(
        `${baseUrl}/api/user/blocks/${charlie.handle}`,
        {
          method: "POST",
          cookie: bob.cookie
        }
      );

      assert.equal(blockCharlie.statusCode, 201);

      // Charlie ya no puede acceder a las reseñas de Bob.
      const blockedReviewReport = await requestJson(
        reportUrl,
        {
          method: "POST",
          cookie: charlie.cookie,
          body: reviewBody(bob.handle, "604")
        }
      );

      assert.equal(blockedReviewReport.statusCode, 404);

      // El bloqueo no debe impedir denunciar un perfil
      // público conocido por comportamiento abusivo.
      const blockedUserReport = await requestJson(
        reportUrl,
        {
          method: "POST",
          cookie: charlie.cookie,
          body: {
            username: bob.handle,
            kind: "user",
            reason: "harassment"
          }
        }
      );

      assert.equal(blockedUserReport.statusCode, 201);

      // Comprobamos también el bloqueo inverso:
      // el propio informante bloquea al autor.
      const blockBob = await requestJson(
        `${baseUrl}/api/user/blocks/${bob.handle}`,
        {
          method: "POST",
          cookie: alice.cookie
        }
      );

      assert.equal(blockBob.statusCode, 201);

      const reverseBlockedReport = await requestJson(
        reportUrl,
        {
          method: "POST",
          cookie: alice.cookie,
          body: reviewBody(bob.handle, "604")
        }
      );

      assert.equal(reverseBlockedReport.statusCode, 404);

      const persisted = readTestDb(dbPath);

      assert.equal(
        persisted.moderationReports.length,
        2,
        "solo deben persistir las dos denuncias aceptadas"
      );

      assert.equal(
        persisted.moderationReports[0].status,
        "pending"
      );

      assert.equal(
        persisted.moderationReports[1].reporterUserId,
        charlie.userId
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
  "denuncias HTTP: evidencia de reseña permanece tras editarla y eliminarla",
  { timeout: 25000 },
  async () => {
    const directory = createTemporaryDirectory();
    const dbPath = path.join(directory, "db.json");
    const sessionStorePath = path.join(directory, "sessions");

    writeTestDb(dbPath, { users: {} });

    const port = await getAvailablePort();
    const baseUrl = `http://127.0.0.1:${port}`;
    let child = null;

    try {
      child = await startTestServer({
        dbPath,
        sessionStorePath,
        port
      });

      const alice = await registerReportUser(
        baseUrl,
        "evidence_alice"
      );

      const bob = await registerReportUser(
        baseUrl,
        "evidence_bob",
        { reviews: true }
      );

      const initialDb = readTestDb(dbPath);

      initialDb.users[bob.userId].opinions = [
        makeReportReview("603")
      ];

      writeTestDb(dbPath, initialDb);

      const report = await requestJson(
        `${baseUrl}/api/user/reports`,
        {
          method: "POST",
          cookie: alice.cookie,
          body: {
            username: bob.handle,
            kind: "review",
            reason: "harassment",
            reviewIdentity: {
              source: "tmdb",
              contentType: "pelicula",
              externalId: "603"
            },
            reviewEvidence: {
              title: "FALSIFICADA",
              text: "FALSIFICADA"
            }
          }
        }
      );

      assert.equal(report.statusCode, 201);
      assert.deepEqual(
        Object.keys(report.json).sort(),
        ["ok", "reportId"]
      );

      const saved = readTestDb(dbPath);
      const evidence =
        saved.moderationReports[0].reviewEvidence;

      assert.equal(evidence.title, "Película 603");
      assert.equal(evidence.text, "Reseña de prueba 603");
      assert.equal(evidence.textTruncated, false);
      assert.equal(evidence.spoiler, false);
      assert.equal(evidence.updatedAt, DATE);

      const edit = await requestJson(
        `${baseUrl}/api/opinions/local_603`,
        {
          method: "PUT",
          cookie: bob.cookie,
          body: {
            review: {
              text: "Contenido editado posteriormente",
              privacy: "public"
            }
          }
        }
      );

      assert.equal(edit.statusCode, 200);

      const afterEdit = readTestDb(dbPath);

      assert.equal(
        afterEdit.users[bob.userId].opinions[0].review.text,
        "Contenido editado posteriormente"
      );

      assert.deepEqual(
        afterEdit.moderationReports[0].reviewEvidence,
        evidence
      );

      const remove = await requestJson(
        `${baseUrl}/api/opinions/local_603`,
        {
          method: "DELETE",
          cookie: bob.cookie
        }
      );

      assert.equal(remove.statusCode, 200);

      const afterDelete = readTestDb(dbPath);

      assert.equal(
        afterDelete.users[bob.userId].opinions.length,
        0
      );

      assert.deepEqual(
        afterDelete.moderationReports[0].reviewEvidence,
        evidence
      );

      const publicProfile = await requestJson(
        `${baseUrl}/api/public/users/${bob.handle}`
      );

      assert.equal(publicProfile.statusCode, 200);
      assert.equal(publicProfile.text.includes(evidence.text), false);
      assert.equal(publicProfile.text.includes("FALSIFICADA"), false);

    } finally {
      await stopTestServer(child);
      fs.rmSync(directory, {
        recursive: true,
        force: true
      });
    }
  }
);
