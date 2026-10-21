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
  "moderación HTTP: sin permisos, acceso denegado y moderador autorizado",
  { timeout: 30000 },
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
    const adminUrl = `${baseUrl}/api/moderation/reports`;
    const accessUrl = `${baseUrl}/api/moderation/access`;

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

      return {
        cookie: sessionCookie(response),
        userId: response.json?.user?.id
      };
    }

    async function readReports(cookie = null) {
      return requestJson(adminUrl, {
        cookie
      });
    }

    try {
      child = await startTestServer({
        dbPath,
        sessionStorePath,
        port,
        moderatorUserIds: ""
      });

      const moderator = await register(
        "mod_candidate"
      );

      const ordinary = await register(
        "ordinary_user"
      );

      assert.ok(moderator.userId);
      assert.ok(ordinary.userId);

      const db = JSON.parse(
        fs.readFileSync(dbPath, "utf8")
      );

      // Incluso un perfil con indicadores de rol
      // manipulados no debe recibir permisos.
      db.users[ordinary.userId].profile.role =
        "admin";

      db.users[ordinary.userId].profile.isModerator =
        true;

      db.moderationReports = [
        {
          id: "report_pending_1",
          reporterUserId: ordinary.userId,
          targetUserId: moderator.userId,
          kind: "review",
          reason: "harassment",
          details: "Incidencia de prueba",
          reviewIdentity: {
            source: "tmdb",
            contentType: "pelicula",
            externalId: "603",
            key: "tmdb::pelicula::603"
          },
          reviewEvidence: {
            title: "Película de prueba",
            text: "EVIDENCIA_PRIVADA_DE_PRUEBA",
            textTruncated: false,
            spoiler: false,
            updatedAt: "2026-10-21T09:00:00.000Z"
          },
          status: "pending",
          createdAt: "2026-10-21T09:00:00.000Z",
          secretIgnored: "CAMPO_PROHIBIDO"
        },
        {
          id: "report_resolved_1",
          reporterUserId: ordinary.userId,
          targetUserId: moderator.userId,
          kind: "user",
          reason: "spam",
          status: "dismissed",
          createdAt: "2026-10-21T09:00:00.000Z"
        }
      ];

      fs.writeFileSync(
        dbPath,
        JSON.stringify(db, null, 2),
        "utf8"
      );

      const anonymous = await readReports();

      assert.equal(anonymous.statusCode, 401);

      const anonymousAccess =
        await requestJson(accessUrl);

      assert.equal(anonymousAccess.statusCode, 401);
      assert.equal(
        anonymous.text.includes("EVIDENCIA_PRIVADA"),
        false
      );

      const noModeratorConfigured =
        await readReports(moderator.cookie);

      assert.equal(
        noModeratorConfigured.statusCode,
        403
      );

      const unconfiguredAccess = await requestJson(
        accessUrl,
        { cookie: moderator.cookie }
      );

      assert.equal(unconfiguredAccess.statusCode, 200);
      assert.deepEqual(unconfiguredAccess.json, {
        isModerator: false
      });

      assert.equal(
        unconfiguredAccess.headers["cache-control"],
        "no-store"
      );

      const forgedProfile = await requestJson(
        `${baseUrl}/api/user`,
        {
          method: "PATCH",
          cookie: ordinary.cookie,
          body: {
            name: "Usuario sin permisos",
            role: "admin",
            isAdmin: true
          }
        }
      );

      assert.equal(forgedProfile.statusCode, 200);

      const forgedAccess = await readReports(
        ordinary.cookie
      );

      assert.equal(forgedAccess.statusCode, 403);

      const forgedCapability = await requestJson(
        accessUrl,
        { cookie: ordinary.cookie }
      );

      assert.equal(forgedCapability.statusCode, 200);
      assert.deepEqual(forgedCapability.json, {
        isModerator: false
      });

      // Reiniciamos SOLO el servidor de prueba.
      // La base y las sesiones temporales se conservan.
      await stopTestServer(child);
      child = null;

      child = await startTestServer({
        dbPath,
        sessionStorePath,
        port,
        moderatorUserIds: moderator.userId
      });

      const permitted = await readReports(
        moderator.cookie
      );

      assert.equal(permitted.statusCode, 200);

      const authorizedCapability = await requestJson(
        accessUrl,
        { cookie: moderator.cookie }
      );

      assert.equal(authorizedCapability.statusCode, 200);
      assert.deepEqual(authorizedCapability.json, {
        isModerator: true
      });

      const ordinaryCapability = await requestJson(
        accessUrl,
        { cookie: ordinary.cookie }
      );

      assert.equal(ordinaryCapability.statusCode, 200);
      assert.deepEqual(ordinaryCapability.json, {
        isModerator: false
      });
      assert.equal(
        permitted.headers["cache-control"],
        "no-store"
      );

      assert.equal(
        permitted.json?.totalPending,
        1
      );

      assert.equal(
        permitted.json?.reports?.length,
        1
      );

      const report = permitted.json.reports[0];

      assert.equal(report.id, "report_pending_1");
      assert.equal(report.status, "pending");

      assert.equal(
        report.reviewEvidence?.text,
        "EVIDENCIA_PRIVADA_DE_PRUEBA"
      );

      assert.equal(
        permitted.text.includes("CAMPO_PROHIBIDO"),
        false
      );

      assert.equal(
        permitted.text.includes("passwordHash"),
        false
      );

      assert.equal(
        permitted.text.includes("report_resolved_1"),
        false
      );

      const ordinaryDenied = await readReports(
        ordinary.cookie
      );

      assert.equal(ordinaryDenied.statusCode, 403);

      assert.equal(
        ordinaryDenied.text.includes("EVIDENCIA_PRIVADA"),
        false
      );

      const stillAnonymous = await readReports();

      assert.equal(stillAnonymous.statusCode, 401);

      // El servidor no debe modificar denuncias
      // simplemente por consultarlas.
      const finalDb = JSON.parse(
        fs.readFileSync(dbPath, "utf8")
      );

      assert.equal(
        finalDb.moderationReports.length,
        2
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
  "decisiones HTTP: autorización y persistencia",
  { timeout: 30000 },
  async () => {
    const directory = createTemporaryDirectory();
    const dbPath = path.join(directory, "db.json");
    const sessionStorePath = path.join(directory, "sessions");

    fs.writeFileSync(
      dbPath,
      JSON.stringify({ users: {} }),
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

      return {
        userId: response.json.user.id,
        cookie: sessionCookie(response)
      };
    }

    function submit(
      reportId,
      cookie,
      body
    ) {
      return requestJson(
        `${baseUrl}/api/moderation/reports/${reportId}/decision`,
        {
          method: "POST",
          cookie,
          body
        }
      );
    }

    function readDb() {
      return JSON.parse(
        fs.readFileSync(dbPath, "utf8")
      );
    }

    try {
      child = await startTestServer({
        dbPath,
        sessionStorePath,
        port,
        moderatorUserIds: ""
      });

      const moderator = await register(
        "decision_mod"
      );

      const ordinary = await register(
        "decision_user"
      );

      const db = readDb();

      const evidence = {
        title: "Película de prueba",
        text: "EVIDENCIA_ORIGINAL_PRIVADA",
        textTruncated: false,
        spoiler: false,
        updatedAt: "2026-10-21T09:00:00.000Z"
      };

      db.moderationReports = [
        {
          id: "report_decision_1",
          reporterUserId: ordinary.userId,
          targetUserId: moderator.userId,
          kind: "review",
          reason: "harassment",
          details: "Denuncia original",
          reviewIdentity: {
            source: "tmdb",
            contentType: "pelicula",
            externalId: "603",
            key: "tmdb:pelicula:603"
          },
          reviewEvidence: evidence,
          status: "pending",
          createdAt: "2026-10-21T09:00:00.000Z"
        },
        {
          id: "report_decision_2",
          reporterUserId: ordinary.userId,
          targetUserId: moderator.userId,
          kind: "user",
          reason: "spam",
          details: "",
          reviewIdentity: null,
          reviewEvidence: null,
          status: "pending",
          createdAt: "2026-10-21T09:00:00.000Z"
        }
      ];

      const originalUsers = JSON.stringify(db.users);

      fs.writeFileSync(
        dbPath,
        JSON.stringify(db),
        "utf8"
      );

      const action = {
        action: "resolve",
        notes: "  Incidencia comprobada  ",
        moderatorUserId: ordinary.userId,
        decidedAt: "2099-01-01T00:00:00.000Z",
        status: "dismissed"
      };

      // Nadie puede resolver sin autorización.
      const anonymous = await submit(
        "report_decision_1",
        null,
        action
      );

      assert.equal(anonymous.statusCode, 401);

      const normalUser = await submit(
        "report_decision_1",
        ordinary.cookie,
        action
      );

      assert.equal(normalUser.statusCode, 403);

      const unconfiguredModerator = await submit(
        "report_decision_1",
        moderator.cookie,
        action
      );

      assert.equal(
        unconfiguredModerator.statusCode,
        403
      );

      assert.equal(
        readDb().moderationReports[0].status,
        "pending"
      );

      // Reiniciar exclusivamente este servidor temporal.
      await stopTestServer(child);
      child = null;

      child = await startTestServer({
        dbPath,
        sessionStorePath,
        port,
        moderatorUserIds: moderator.userId
      });

      const deniedAgain = await submit(
        "report_decision_1",
        ordinary.cookie,
        action
      );

      assert.equal(deniedAgain.statusCode, 403);

      const invalidAction = await submit(
        "report_decision_1",
        moderator.cookie,
        { action: "ban" }
      );

      assert.equal(invalidAction.statusCode, 400);

      const excessiveNotes = await submit(
        "report_decision_1",
        moderator.cookie,
        {
          action: "resolve",
          notes: "x".repeat(501)
        }
      );

      assert.equal(excessiveNotes.statusCode, 400);

      const unknownReport = await submit(
        "report_missing",
        moderator.cookie,
        { action: "resolve" }
      );

      assert.equal(unknownReport.statusCode, 404);

      assert.equal(
        readDb().moderationReports[0].status,
        "pending"
      );

      // Decisión válida.
      const resolved = await submit(
        "report_decision_1",
        moderator.cookie,
        action
      );

      assert.equal(resolved.statusCode, 200);

      assert.deepEqual(resolved.json, {
        ok: true,
        reportId: "report_decision_1",
        status: "resolved"
      });

      assert.equal(
        resolved.headers["cache-control"],
        "no-store"
      );

      assert.equal(
        resolved.text.includes(evidence.text),
        false
      );

      const saved = readDb();
      const first = saved.moderationReports[0];

      assert.equal(first.status, "resolved");

      assert.deepEqual(
        first.reviewEvidence,
        evidence
      );

      assert.equal(
        first.moderationDecision.moderatorUserId,
        moderator.userId
      );

      assert.equal(
        first.moderationDecision.notes,
        "Incidencia comprobada"
      );

      assert.notEqual(
        first.moderationDecision.decidedAt,
        action.decidedAt
      );

      assert.equal(
        Number.isNaN(
          Date.parse(first.moderationDecision.decidedAt)
        ),
        false
      );

      // Una denuncia ya cerrada no puede cerrarse otra vez.
      const repeated = await submit(
        "report_decision_1",
        moderator.cookie,
        { action: "dismiss" }
      );

      assert.equal(repeated.statusCode, 409);

      const dismissed = await submit(
        "report_decision_2",
        moderator.cookie,
        {
          action: "dismiss",
          notes: "No procede"
        }
      );

      assert.equal(dismissed.statusCode, 200);
      assert.equal(dismissed.json.status, "dismissed");

      const finalDb = readDb();

      assert.equal(
        finalDb.moderationReports[0].status,
        "resolved"
      );

      assert.equal(
        finalDb.moderationReports[1].status,
        "dismissed"
      );

      // Nunca modificar cuentas por decidir una denuncia.
      assert.equal(
        JSON.stringify(finalDb.users),
        originalUsers
      );

      const pending = await requestJson(
        `${baseUrl}/api/moderation/reports`,
        { cookie: moderator.cookie }
      );

      assert.equal(pending.statusCode, 200);
      assert.equal(pending.json.totalPending, 0);
      assert.deepEqual(pending.json.reports, []);

    } finally {
      await stopTestServer(child);

      fs.rmSync(directory, {
        recursive: true,
        force: true
      });
    }
  }
);
