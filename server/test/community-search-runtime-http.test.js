import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import fs from "node:fs";
import http from "node:http";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const SERVER_PATH = fileURLToPath(
  new URL("../server.js", import.meta.url)
);
const SERVER_DIRECTORY = path.dirname(SERVER_PATH);

async function availablePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      server.close((error) => {
        if (error) return reject(error);
        resolve(address.port);
      });
    });
  });
}

function startServer({ port, dbPath, sessionsPath }) {
  return new Promise((resolve, reject) => {
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
          QUACKER_SESSION_STORE_PATH: sessionsPath
        },
        stdio: ["ignore", "pipe", "pipe"]
      }
    );

    let output = "";
    let errors = "";
    let ready = false;

    const timeout = setTimeout(() => {
      if (ready) return;
      child.kill("SIGKILL");
      reject(
        new Error(
          "Servidor temporal no disponible: " +
          output + "\n" + errors
        )
      );
    }, 10000);

    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");

    child.stdout.on("data", (chunk) => {
      output += chunk;
      if (
        !ready &&
        output.includes(
          `Quacker server running: http://127.0.0.1:${port}`
        )
      ) {
        ready = true;
        clearTimeout(timeout);
        resolve(child);
      }
    });

    child.stderr.on("data", (chunk) => {
      errors += chunk;
    });

    child.once("error", (error) => {
      if (ready) return;
      clearTimeout(timeout);
      reject(error);
    });

    child.once("exit", (code) => {
      if (ready) return;
      clearTimeout(timeout);
      reject(
        new Error(
          `Servidor temporal terminado (${code}): ${errors}`
        )
      );
    });
  });
}

async function stopServer(child) {
  if (!child || child.exitCode !== null ||
      child.signalCode !== null) {
    return;
  }

  const exited = once(child, "exit");
  child.kill("SIGTERM");

  const graceful = await Promise.race([
    exited.then(() => true),
    new Promise((resolve) =>
      setTimeout(() => resolve(false), 2000)
    )
  ]);

  if (!graceful) {
    child.kill("SIGKILL");
    await exited;
  }
}

function requestJson(
  url,
  { method = "GET", body = null, cookie = "" } = {}
) {
  return new Promise((resolve, reject) => {
    const payload = body === null
      ? null
      : JSON.stringify(body);

    const headers = {
      Accept: "application/json"
    };

    if (cookie) headers.Cookie = cookie;

    if (payload !== null) {
      headers["Content-Type"] = "application/json";
      headers["Content-Length"] =
        Buffer.byteLength(payload);
    }

    const request = http.request(
      url,
      { method, headers },
      (response) => {
        let text = "";
        response.setEncoding("utf8");
        response.on("data", (chunk) => {
          text += chunk;
        });
        response.on("end", () => {
          let json = null;
          try {
            json = JSON.parse(text);
          } catch {}

          resolve({
            status: response.statusCode,
            headers: response.headers,
            json,
            text
          });
        });
      }
    );

    request.setTimeout(5000, () => {
      request.destroy(
        new Error("Timeout en prueba HTTP temporal")
      );
    });
    request.once("error", reject);

    if (payload !== null) request.write(payload);
    request.end();
  });
}

function sessionCookie(response) {
  const value = response.headers["set-cookie"];
  assert.ok(Array.isArray(value) && value.length);
  return value[0].split(";")[0];
}

test(
  "QA-010 HTTP: autenticación, privacidad, bloqueos y rate limit",
  { timeout: 45000 },
  async () => {
    const directory = fs.mkdtempSync(
      path.join(os.tmpdir(), "quacker-community-http-")
    );

    const dbPath = path.join(directory, "db.json");
    const sessionsPath = path.join(directory, "sessions");

    fs.writeFileSync(
      dbPath,
      JSON.stringify({ users: {} }),
      "utf8"
    );

    const port = await availablePort();
    const baseUrl = `http://127.0.0.1:${port}`;
    const searchUrl = `${baseUrl}/api/community/users`;

    let child = null;

    async function register(handle, name, isPublic) {
      const response = await requestJson(
        `${baseUrl}/api/auth/register`,
        {
          method: "POST",
          body: {
            email: `${handle}@example.test`,
            password: "community-test-pass-123",
            name,
            language: "es"
          }
        }
      );

      assert.equal(response.status, 200);

      const cookie = sessionCookie(response);

      const update = await requestJson(
        `${baseUrl}/api/user`,
        {
          method: "PATCH",
          cookie,
          body: { handle: `@${handle}` }
        }
      );

      assert.equal(update.status, 200);

      if (isPublic) {
        const privacy = await requestJson(
          `${baseUrl}/api/user/privacy`,
          {
            method: "PATCH",
            cookie,
            body: { profile: true }
          }
        );

        assert.equal(privacy.status, 200);
      }

      return { cookie, handle };
    }

    try {
      child = await startServer({
        port,
        dbPath,
        sessionsPath
      });

      // La API debe rechazar visitantes anónimos.
      const anonymous = await requestJson(
        `${searchUrl}?q=alba`
      );

      assert.equal(
        anonymous.status,
        401,
        "QA-010: buscar personas debe exigir sesión"
      );

      const viewer = await register(
        "community_viewer",
        "Usuario actual",
        false
      );

      const publicUser = await register(
        "alba_cine",
        "Álba Cine",
        true
      );

      await register(
        "alba_hidden",
        "Alba Oculta",
        false
      );

      const result = await requestJson(
        `${searchUrl}?q=ALBA`,
        { cookie: viewer.cookie }
      );

      assert.equal(result.status, 200);

      assert.equal(
        result.headers["cache-control"],
        "no-store"
      );

      assert.deepEqual(result.json, {
        users: [{
          name: "Álba Cine",
          username: "alba_cine",
          avatar: ""
        }]
      });

      assert.ok(
        !result.text.includes("@alba_hidden")
      );

      assert.ok(
        !result.text.includes("example.test")
      );

      const byUsername = await requestJson(
        `${searchUrl}?q=%40ALBA_CINE`,
        { cookie: viewer.cookie }
      );

      assert.equal(byUsername.status, 200);
      assert.equal(
        byUsername.json?.users?.[0]?.username,
        "alba_cine"
      );

      const empty = await requestJson(
        `${searchUrl}?q=`,
        { cookie: viewer.cookie }
      );

      assert.equal(empty.status, 200);
      assert.deepEqual(empty.json, { users: [] });

      // Un bloqueo debe retirar inmediatamente
      // la identidad de los resultados.
      const blocked = await requestJson(
        `${baseUrl}/api/user/blocks/${publicUser.handle}`,
        {
          method: "POST",
          cookie: viewer.cookie
        }
      );

      assert.equal(blocked.status, 201);

      const afterBlock = await requestJson(
        `${searchUrl}?q=alba`,
        { cookie: viewer.cookie }
      );

      assert.equal(afterBlock.status, 200);
      assert.deepEqual(
        afterBlock.json,
        { users: [] }
      );

      // La búsqueda debe limitar la enumeración.
      let limited = null;

      for (let attempt = 0; attempt < 40; attempt++) {
        const response = await requestJson(
          `${searchUrl}?q=alba`,
          { cookie: viewer.cookie }
        );

        if (response.status === 429) {
          limited = response;
          break;
        }

        assert.equal(
          response.status,
          200,
          "las búsquedas permitidas deben responder 200"
        );
      }

      assert.ok(
        limited,
        "QA-010: falta limitar la frecuencia de búsqueda"
      );

      assert.equal(
        limited.json?.error,
        "community_search_rate_limited"
      );

      assert.ok(
        Number(limited.headers["retry-after"]) >= 1
      );

      // El límite no debe alterar la base de datos.
      const persisted = JSON.parse(
        fs.readFileSync(dbPath, "utf8")
      );

      assert.equal(
        Object.keys(persisted.users).length,
        3
      );
    } finally {
      await stopServer(child);
      fs.rmSync(directory, {
        recursive: true,
        force: true
      });
    }
  }
);
