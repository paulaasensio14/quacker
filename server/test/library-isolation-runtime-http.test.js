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

function availablePort() {
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

  let output = "";
  let errors = "";

  child.stdout.on("data", (chunk) => {
    output += chunk.toString();
  });

  child.stderr.on("data", (chunk) => {
    errors += chunk.toString();
  });

  const deadline = Date.now() + 10000;

  while (Date.now() < deadline) {
    if (
      output.includes(
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
    `Servidor temporal no disponible: ${errors}`
  );
}

function requestJson(url, {
  method = "GET",
  body = null,
  cookie = ""
} = {}) {
  return new Promise((resolve, reject) => {
    const serializedBody =
      body === null ? null : JSON.stringify(body);

    const headers = {
      Accept: "application/json",
      Origin: new URL(url).origin
    };

    if (serializedBody !== null) {
      headers["Content-Type"] = "application/json";
      headers["Content-Length"] =
        Buffer.byteLength(serializedBody);
    }

    if (cookie) headers.Cookie = cookie;

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

          if (text) {
            try {
              json = JSON.parse(text);
            } catch {
              json = null;
            }
          }

          resolve({
            status: response.statusCode,
            json,
            headers: response.headers
          });
        });
      }
    );

    request.setTimeout(5000, () => {
      request.destroy(new Error("HTTP_TIMEOUT"));
    });

    request.on("error", reject);

    if (serializedBody !== null) {
      request.write(serializedBody);
    }

    request.end();
  });
}

function getSessionCookie(response) {
  const cookies = response.headers["set-cookie"];

  assert.ok(
    Array.isArray(cookies) && cookies.length > 0,
    "El registro debe crear una sesión"
  );

  return cookies[0].split(";")[0];
}

test(
  "HTTP real: bibliotecas aisladas entre usuarios",
  { timeout: 30000 },
  async () => {
    const directory = fs.mkdtempSync(
      path.join(os.tmpdir(), "quacker-library-isolation-")
    );

    let child;

    try {
      const port = await availablePort();
      const baseUrl = `http://127.0.0.1:${port}`;

      child = await startServer(port, directory);

      const request = (endpoint, options = {}) =>
        requestJson(`${baseUrl}${endpoint}`, options);

      const register = async (email, name) => {
        const response = await request(
          "/api/auth/register",
          {
            method: "POST",
            body: {
              email,
              name,
              password: "Library-Isolation-123!",
              language: "es"
            }
          }
        );

        assert.equal(response.status, 200);

        return getSessionCookie(response);
      };

      const cookieA = await register(
        "library-owner@example.test",
        "Library Owner"
      );

      const cookieB = await register(
        "library-other@example.test",
        "Library Other"
      );

      const created = await request(
        "/api/library",
        {
          method: "POST",
          cookie: cookieA,
          body: {
            title: "Elemento privado de A",
            type: "serie",
            source: "tmdb",
            externalId: "12345",
            status: "watching",
            progress: 40
          }
        }
      );

      assert.equal(created.status, 200);

      const itemId = created.json?.id;
      assert.ok(itemId);

      const itemPath =
        `/api/library/${encodeURIComponent(itemId)}`;

      const before = await request(itemPath, {
        cookie: cookieA
      });

      assert.equal(before.status, 200);

      const readAsB = await request(itemPath, {
        cookie: cookieB
      });

      assert.equal(readAsB.status, 404);
      assert.deepEqual(
        readAsB.json,
        { error: "not_found" }
      );

      const patchAsB = await request(itemPath, {
        method: "PATCH",
        cookie: cookieB,
        body: {
          title: "MODIFICADO POR B",
          progress: 100,
          logActivity: false
        }
      });

      assert.equal(patchAsB.status, 404);
      assert.deepEqual(
        patchAsB.json,
        { error: "not_found" }
      );

      const deleteAsB = await request(itemPath, {
        method: "DELETE",
        cookie: cookieB
      });

      assert.equal(deleteAsB.status, 404);
      assert.deepEqual(
        deleteAsB.json,
        { error: "not_found" }
      );

      const after = await request(itemPath, {
        cookie: cookieA
      });

      assert.equal(after.status, 200);
      assert.deepEqual(
        after.json,
        before.json,
        "Los intentos de B no deben modificar el elemento de A"
      );

      const libraryB = await request("/api/library", {
        cookie: cookieB
      });

      assert.equal(libraryB.status, 200);
      assert.deepEqual(libraryB.json, []);

      const patchAsA = await request(itemPath, {
        method: "PATCH",
        cookie: cookieA,
        body: {
          title: "Modificado por su propietario",
          logActivity: false
        }
      });

      assert.equal(patchAsA.status, 200);
      assert.equal(
        patchAsA.json?.title,
        "Modificado por su propietario"
      );

      const deleteAsA = await request(itemPath, {
        method: "DELETE",
        cookie: cookieA
      });

      assert.equal(deleteAsA.status, 200);
      assert.equal(deleteAsA.json?.ok, true);

      const finalRead = await request(itemPath, {
        cookie: cookieA
      });

      assert.equal(finalRead.status, 404);

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
