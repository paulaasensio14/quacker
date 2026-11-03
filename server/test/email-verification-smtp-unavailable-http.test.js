import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import net from "node:net";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { setTimeout as sleep } from "node:timers/promises";

const SERVER_PATH = fileURLToPath(
  new URL("../server.js", import.meta.url)
);

async function getFreePort() {
  const server = net.createServer();

  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const port = server.address().port;
      server.close(error =>
        error ? reject(error) : resolve(port)
      );
    });
  });
}

test(
  "HTTP: sin SMTP no crea cuenta ni registro pendiente",
  { timeout: 20000 },
  async () => {
    const dir = fs.mkdtempSync(
      path.join(os.tmpdir(), "quacker-no-smtp-")
    );

    const dbPath = path.join(dir, "db.json");
    const port = await getFreePort();
    const origin = `http://127.0.0.1:${port}`;

    const child = spawn(process.execPath, [SERVER_PATH], {
      cwd: path.dirname(SERVER_PATH),
      env: {
        ...process.env,
        NODE_ENV: "test",
        PORT: String(port),
        QUACKER_DB_PATH: dbPath,
        QUACKER_SESSION_STORE_PATH:
          path.join(dir, "sessions"),
        SMTP_HOST: "",
        SMTP_USER: "",
        SMTP_PASS: "",
        CONTACT_TO: ""
      },
      stdio: ["ignore", "pipe", "pipe"]
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", data => {
      stdout += data.toString();
    });

    child.stderr.on("data", data => {
      stderr += data.toString();
    });

    try {
      let ready = false;

      for (let i = 0; i < 100; i++) {
        if (stdout.includes(
          `Quacker server running: ${origin}`
        )) {
          ready = true;
          break;
        }

        if (child.exitCode !== null) break;
        await sleep(100);
      }

      assert.ok(
        ready,
        `Servidor no disponible: ${stderr.slice(-500)}`
      );

      const email = "no-smtp@example.test";

      const response = await fetch(
        `${origin}/api/auth/register`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Origin: origin
          },
          body: JSON.stringify({
            email,
            password: "Verification-Test-123!",
            name: "Prueba sin SMTP",
            language: "es"
          })
        }
      );

      const body = await response.json();

      assert.equal(
        response.status,
        503,
        "Sin SMTP, el registro debe fallar de forma segura"
      );

      assert.equal(
        body.error,
        "verification_email_unavailable"
      );

      assert.equal(body.user, undefined);
      assert.equal(body.token, undefined);
      assert.equal(
        response.headers.get("set-cookie"),
        null
      );

      const db = JSON.parse(
        fs.readFileSync(dbPath, "utf8")
      );

      assert.equal(Object.keys(db.users).length, 0);

      assert.equal(
        Object.keys(db.pendingRegistrations || {}).length,
        0
      );

      const login = await fetch(
        `${origin}/api/auth/login`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Origin: origin
          },
          body: JSON.stringify({
            email,
            password: "Verification-Test-123!"
          })
        }
      );

      assert.equal(login.status, 401);

      console.log(
        "OK: sin SMTP no se crea ninguna cuenta"
      );
    } finally {
      child.kill("SIGTERM");

      for (let i = 0; i < 30; i++) {
        if (
          child.exitCode !== null ||
          child.signalCode !== null
        ) break;

        await sleep(100);
      }

      if (
        child.exitCode === null &&
        child.signalCode === null
      ) {
        child.kill("SIGKILL");
      }

      fs.rmSync(dir, {
        recursive: true,
        force: true
      });

      console.log("OK: entorno temporal retirado");
    }
  }
);
