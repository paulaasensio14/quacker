import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import fs from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const SERVER_PATH = fileURLToPath(
  new URL("../server.js", import.meta.url)
);

async function availablePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();

    server.once("error", reject);

    server.listen(0, "127.0.0.1", () => {
      const port = server.address().port;

      server.close((error) => {
        if (error) reject(error);
        else resolve(port);
      });
    });
  });
}

async function startServer(port, directory) {
  const child = spawn(process.execPath, [SERVER_PATH], {
    cwd: path.dirname(SERVER_PATH),
    env: {
      ...process.env,
      NODE_ENV: "test",
      PORT: String(port),
      QUACKER_DB_PATH: path.join(directory, "db.json"),
      QUACKER_SESSION_STORE_PATH:
        path.join(directory, "sessions"),
      SMTP_HOST: "",
      SMTP_USER: "",
      SMTP_PASS: ""
    },
    stdio: ["ignore", "pipe", "pipe"]
  });

  let stdout = "";
  let stderr = "";

  child.stdout.on("data", (chunk) => {
    stdout += chunk.toString();
  });

  child.stderr.on("data", (chunk) => {
    stderr += chunk.toString();
  });

  const deadline = Date.now() + 10000;

  while (Date.now() < deadline) {
    if (
      stdout.includes(
        `Quacker server running: http://127.0.0.1:${port}`
      )
    ) {
      return child;
    }

    if (child.exitCode !== null) break;

    await new Promise((resolve) =>
      setTimeout(resolve, 50)
    );
  }

  child.kill("SIGKILL");

  throw new Error(
    `Servidor temporal no disponible: ${stderr}`
  );
}

async function requestJson(
  baseUrl,
  endpoint,
  {
    method = "GET",
    body = null,
    cookie = ""
  } = {}
) {
  const response = await fetch(
    `${baseUrl}${endpoint}`,
    {
      method,
      headers: {
        Origin: baseUrl,
        ...(body !== null
          ? { "Content-Type": "application/json" }
          : {}),
        ...(cookie ? { Cookie: cookie } : {})
      },
      ...(body !== null
        ? { body: JSON.stringify(body) }
        : {})
    }
  );

  return {
    status: response.status,
    json: await response.json(),
    cookie: response.headers
      .get("set-cookie")
      ?.split(";")[0]
  };
}

test(
  "HTTP real: notificaciones aisladas entre usuarios",
  { timeout: 30000 },
  async () => {
    const directory = fs.mkdtempSync(
      path.join(os.tmpdir(), "quacker-notifications-isolation-")
    );

    let child;

    try {
      const port = await availablePort();
      const baseUrl = `http://127.0.0.1:${port}`;
      const dbPath = path.join(directory, "db.json");

      child = await startServer(port, directory);

      const request = (endpoint, options = {}) =>
        requestJson(baseUrl, endpoint, options);

      const register = async (email, name) => {
        const result = await request(
          "/api/auth/register",
          {
            method: "POST",
            body: {
              email,
              name,
              password: "Notifications-Runtime-123!",
              language: "es"
            }
          }
        );

        assert.equal(result.status, 200);
        assert.ok(result.cookie);
        assert.ok(result.json?.user?.id);

        return {
          id: result.json.user.id,
          cookie: result.cookie
        };
      };

      const userA = await register(
        "notification-a@example.test",
        "Notification A"
      );

      const userB = await register(
        "notification-b@example.test",
        "Notification B"
      );

      const createdA = await request(
        "/api/notifications",
        {
          method: "POST",
          cookie: userA.cookie,
          body: {
            title: "Notificación privada de A",
            text: "Contenido exclusivo de A",
            secretInternalField: "NO_DEBE_APARECER"
          }
        }
      );

      assert.equal(createdA.status, 201);
      assert.ok(createdA.json?.id);
      assert.equal(
        Object.hasOwn(createdA.json, "secretInternalField"),
        false
      );

      const notificationAId = createdA.json.id;

      const createdB = await request(
        "/api/notifications",
        {
          method: "POST",
          cookie: userB.cookie,
          body: {
            title: "Notificación privada de B",
            text: "Contenido exclusivo de B"
          }
        }
      );

      assert.equal(createdB.status, 201);
      assert.ok(createdB.json?.id);

      const readA = await request(
        "/api/notifications",
        { cookie: userA.cookie }
      );

      const readB = await request(
        "/api/notifications",
        { cookie: userB.cookie }
      );

      assert.equal(readA.status, 200);
      assert.equal(readB.status, 200);

      assert.equal(
        readA.json.notifications.length,
        1
      );

      assert.equal(
        readB.json.notifications.length,
        1
      );

      assert.equal(
        readA.json.notifications[0].id,
        notificationAId
      );

      assert.equal(
        readB.json.notifications[0].id,
        createdB.json.id
      );

      assert.equal(
        JSON.stringify(readB.json).includes(
          "Contenido exclusivo de A"
        ),
        false
      );

      const deletedAsB = await request(
        `/api/notifications/${encodeURIComponent(notificationAId)}`,
        {
          method: "DELETE",
          cookie: userB.cookie
        }
      );

      assert.equal(deletedAsB.status, 404);
      assert.deepEqual(
        deletedAsB.json,
        { error: "not_found" }
      );

      const replacedAsB = await request(
        "/api/notifications",
        {
          method: "PUT",
          cookie: userB.cookie,
          body: {
            notifications: [
              {
                title: "Sustitución propia de B",
                id: createdB.json.id,
                secretInternalField: "NO_DEBE_APARECER"
              }
            ]
          }
        }
      );

      assert.equal(replacedAsB.status, 200);
      assert.equal(
        replacedAsB.json.notifications.length,
        1
      );
      assert.equal(
        Object.hasOwn(
          replacedAsB.json.notifications[0],
          "secretInternalField"
        ),
        false
      );

      const clearedAsB = await request(
        "/api/notifications",
        {
          method: "DELETE",
          cookie: userB.cookie
        }
      );

      assert.equal(clearedAsB.status, 200);

      const afterA = await request(
        "/api/notifications",
        { cookie: userA.cookie }
      );

      assert.equal(afterA.status, 200);
      assert.deepEqual(
        afterA.json,
        readA.json,
        "Las operaciones de B no deben modificar notificaciones de A"
      );

      const storedDb = JSON.parse(
        fs.readFileSync(dbPath, "utf8")
      );

      assert.equal(
        storedDb.users[userA.id].notifications.length,
        1
      );

      assert.equal(
        storedDb.users[userB.id].notifications.length,
        0
      );

      const deletedAsA = await request(
        `/api/notifications/${encodeURIComponent(notificationAId)}`,
        {
          method: "DELETE",
          cookie: userA.cookie
        }
      );

      assert.equal(deletedAsA.status, 200);
      assert.equal(deletedAsA.json?.removed, 1);

      const finalA = await request(
        "/api/notifications",
        { cookie: userA.cookie }
      );

      assert.deepEqual(
        finalA.json,
        { notifications: [] }
      );

    } finally {
      if (child && child.exitCode === null) {
        const exited = once(child, "exit");
        child.kill("SIGTERM");
        await exited;
      }

      fs.rmSync(directory, {
        recursive: true,
        force: true
      });
    }
  }
);
