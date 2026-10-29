import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import net from "node:net";
import http from "node:http";
import test from "node:test";
import { fileURLToPath } from "node:url";

const serverPath = fileURLToPath(
  new URL("../server.js", import.meta.url)
);

function requestWithHost(url, host, origin) {
  return new Promise((resolve, reject) => {
    const request = http.request(url, {
      method: "POST",
      headers: {
        Host: host,
        Origin: origin,
        "Content-Type": "application/json"
      }
    }, (response) => {
      let body = "";

      response.setEncoding("utf8");
      response.on("data", (chunk) => {
        body += chunk;
      });

      response.on("end", () => {
        resolve({
          status: response.statusCode,
          body
        });
      });
    });

    request.on("error", reject);
    request.end("{}");
  });
}

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
  const child = spawn(process.execPath, [serverPath], {
    cwd: path.dirname(serverPath),
    env: {
      ...process.env,
      NODE_ENV: "test",
      PORT: String(port),
      QUACKER_DB_PATH: path.join(directory, "db.json"),
      QUACKER_SESSION_STORE_PATH:
        path.join(directory, "sessions")
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

    if (child.exitCode !== null) {
      break;
    }

    await new Promise((resolve) =>
      setTimeout(resolve, 50)
    );
  }

  child.kill("SIGKILL");

  throw new Error(
    `Servidor temporal no disponible: ${errors}`
  );
}

test(
  "HTTP real: valida el origen antes de ejecutar escrituras",
  { timeout: 30000 },
  async () => {
    const directory = fs.mkdtempSync(
      path.join(os.tmpdir(), "quacker-origin-http-")
    );

    let child;

    try {
      const port = await availablePort();
      const baseUrl = `http://127.0.0.1:${port}`;

      child = await startServer(port, directory);

      const health = await fetch(
        `${baseUrl}/api/health`
      );

      assert.equal(health.status, 200);

      const valid = await fetch(
        `${baseUrl}/api/contact`,
        {
          method: "POST",
          headers: {
            Origin: baseUrl,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({})
        }
      );

      assert.notEqual(valid.status, 403);

      const dbPath = path.join(
        directory,
        "db.json"
      );

      const dbBefore = fs.existsSync(dbPath)
        ? fs.readFileSync(dbPath)
        : null;

      const external = await fetch(
        `${baseUrl}/api/contact`,
        {
          method: "POST",
          headers: {
            Origin: "https://evil.example",
            "Content-Type": "application/json"
          },
          body: JSON.stringify({})
        }
      );

      assert.equal(external.status, 403);
      assert.deepEqual(
        await external.json(),
        { error: "invalid_request_origin" }
      );

      const crossSite = await fetch(
        `${baseUrl}/api/contact`,
        {
          method: "POST",
          headers: {
            Origin: baseUrl,
            "Sec-Fetch-Site": "cross-site",
            "Content-Type": "application/json"
          },
          body: JSON.stringify({})
        }
      );

      assert.equal(crossSite.status, 403);
      assert.deepEqual(
        await crossSite.json(),
        { error: "invalid_request_origin" }
      );

      const missing = await fetch(
        `${baseUrl}/api/contact`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({})
        }
      );

      assert.equal(missing.status, 403);
      assert.deepEqual(
        await missing.json(),
        { error: "invalid_request_origin" }
      );

      const wrongHost = await requestWithHost(
        `${baseUrl}/api/contact`,
        "evil.example",
        baseUrl
      );

      assert.equal(wrongHost.status, 403);
      assert.deepEqual(
        JSON.parse(wrongHost.body),
        { error: "invalid_request_origin" }
      );

      const differentLocalHost = await requestWithHost(
        `${baseUrl}/api/contact`,
        `127.0.0.1:${port}`,
        `http://localhost:${port}`
      );

      assert.equal(differentLocalHost.status, 403);
      assert.deepEqual(
        JSON.parse(differentLocalHost.body),
        { error: "invalid_request_origin" }
      );

      const dbAfter = fs.existsSync(dbPath)
        ? fs.readFileSync(dbPath)
        : null;

      assert.deepEqual(
        dbAfter,
        dbBefore,
        "Las peticiones rechazadas no deben modificar la base de datos"
      );

      const registration = await fetch(
        `${baseUrl}/api/auth/register`,
        {
          method: "POST",
          headers: {
            Origin: baseUrl,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            email: "csrf-runtime@example.test",
            password: "Runtime-CSRF-123!",
            name: "CSRF Runtime",
            language: "es"
          })
        }
      );

      assert.equal(
        registration.status,
        200,
        "el registro autorizado debe funcionar"
      );

      const setCookie =
        registration.headers.get("set-cookie");

      assert.ok(
        setCookie,
        "el registro debe generar una sesión"
      );

      const sessionCookie =
        setCookie.split(";")[0];

      const readPrivacy = () =>
        fetch(`${baseUrl}/api/user/privacy`, {
          headers: {
            Cookie: sessionCookie
          }
        });

      const initialResponse =
        await readPrivacy();

      assert.equal(initialResponse.status, 200);

      const initialPrivacy =
        await initialResponse.json();

      assert.equal(
        initialPrivacy.profileVisibility,
        "hidden"
      );

      const rejectedPatch = await fetch(
        `${baseUrl}/api/user/privacy`,
        {
          method: "PATCH",
          headers: {
            Origin: "https://evil.example",
            Cookie: sessionCookie,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            profileVisibility: "public"
          })
        }
      );

      assert.equal(rejectedPatch.status, 403);

      assert.deepEqual(
        await rejectedPatch.json(),
        { error: "invalid_request_origin" }
      );

      const afterRejectedResponse =
        await readPrivacy();

      assert.equal(
        afterRejectedResponse.status,
        200
      );

      assert.deepEqual(
        await afterRejectedResponse.json(),
        initialPrivacy,
        "la petición externa no debe cambiar la privacidad"
      );

      const authorizedPatch = await fetch(
        `${baseUrl}/api/user/privacy`,
        {
          method: "PATCH",
          headers: {
            Origin: baseUrl,
            Cookie: sessionCookie,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            profileVisibility: "public"
          })
        }
      );

      assert.equal(
        authorizedPatch.status,
        200,
        "el usuario autenticado debe poder actualizar su privacidad"
      );

      const finalResponse =
        await readPrivacy();

      assert.equal(finalResponse.status, 200);

      const finalPrivacy =
        await finalResponse.json();

      assert.equal(
        finalPrivacy.profileVisibility,
        "public"
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
