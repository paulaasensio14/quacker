import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import net from "node:net";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  createPasswordResetToken,
  storePasswordResetChallenge
} from "../lib/password-recovery.js";

const serverPath = fileURLToPath(
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
  const child = spawn(process.execPath, [serverPath], {
    cwd: path.dirname(serverPath),
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

test(
  "HTTP real: recuperación de contraseña e invalidación de sesión",
  { timeout: 30000 },
  async () => {
    const directory = fs.mkdtempSync(
      path.join(os.tmpdir(), "quacker-reset-http-")
    );

    let child;

    try {
      const port = await availablePort();
      const baseUrl = `http://127.0.0.1:${port}`;
      const dbPath = path.join(directory, "db.json");

      child = await startServer(port, directory);

      const post = (endpoint, body, cookie = "") =>
        fetch(`${baseUrl}${endpoint}`, {
          method: "POST",
          headers: {
            Origin: baseUrl,
            "Content-Type": "application/json",
            ...(cookie ? { Cookie: cookie } : {})
          },
          body: JSON.stringify(body)
        });

      const email = "reset-runtime@example.test";
      const oldPassword = "Old-Runtime-Password-123!";
      const newPassword = "New-Runtime-Password-456!";

      const registration = await post(
        "/api/auth/register",
        {
          email,
          password: oldPassword,
          name: "Recovery Runtime",
          language: "es"
        }
      );

      assert.equal(registration.status, 200);

      const sessionCookie =
        registration.headers
          .get("set-cookie")
          ?.split(";")[0];

      assert.ok(sessionCookie);

      const readMe = () =>
        fetch(`${baseUrl}/api/auth/me`, {
          headers: {
            Cookie: sessionCookie
          }
        });

      assert.equal((await readMe()).status, 200);

      const unknownRequest = await post(
        "/api/auth/password-reset/request",
        {
          email: "unknown-recovery@example.test"
        }
      );

      assert.equal(unknownRequest.status, 200);
      assert.deepEqual(
        await unknownRequest.json(),
        { ok: true }
      );

      const knownRequest = await post(
        "/api/auth/password-reset/request",
        { email }
      );

      assert.equal(knownRequest.status, 200);

      assert.deepEqual(
        await knownRequest.json(),
        { ok: true }
      );

      const afterKnownRequest = JSON.parse(
        fs.readFileSync(dbPath, "utf8")
      );

      const knownUser = Object.values(
        afterKnownRequest.users
      ).find(
        (user) => user?.profile?.email === email
      );

      assert.ok(knownUser);

      assert.match(
        knownUser.auth.passwordReset.tokenHash,
        /^[a-f0-9]{64}$/
      );

      assert.ok(
        knownUser.auth.passwordReset.expiresAt >
        Date.now()
      );

      const database = JSON.parse(
        fs.readFileSync(dbPath, "utf8")
      );

      const userId = Object.keys(database.users).find(
        (id) => database.users[id]?.profile?.email === email
      );

      assert.ok(userId);

      const recovery = createPasswordResetToken();

      storePasswordResetChallenge(
        database.users[userId],
        recovery
      );

      fs.writeFileSync(
        dbPath,
        JSON.stringify(database, null, 2) + "\n",
        { mode: 0o600 }
      );

      const expiredRecovery = createPasswordResetToken({
        now: () => Date.now() - 60 * 60 * 1000
      });

      storePasswordResetChallenge(
        database.users[userId],
        expiredRecovery
      );

      fs.writeFileSync(
        dbPath,
        JSON.stringify(database, null, 2) + "\n",
        { mode: 0o600 }
      );

      const expired = await post(
        "/api/auth/password-reset/confirm",
        {
          token: expiredRecovery.token,
          password: newPassword
        }
      );

      assert.equal(expired.status, 400);
      assert.deepEqual(
        await expired.json(),
        { error: "invalid_or_expired_reset_token" }
      );

      storePasswordResetChallenge(
        database.users[userId],
        recovery
      );

      fs.writeFileSync(
        dbPath,
        JSON.stringify(database, null, 2) + "\n",
        { mode: 0o600 }
      );

      const invalid = await post(
        "/api/auth/password-reset/confirm",
        {
          token: "invalid-token",
          password: newPassword
        }
      );

      assert.equal(invalid.status, 400);
      assert.deepEqual(
        await invalid.json(),
        { error: "invalid_or_expired_reset_token" }
      );

      const confirmed = await post(
        "/api/auth/password-reset/confirm",
        {
          token: recovery.token,
          password: newPassword
        }
      );

      assert.equal(confirmed.status, 200);
      assert.deepEqual(
        await confirmed.json(),
        { ok: true }
      );

      const previousSession = await readMe();

      assert.equal(
        previousSession.status,
        401,
        "la sesión anterior debe quedar invalidada"
      );

      const reused = await post(
        "/api/auth/password-reset/confirm",
        {
          token: recovery.token,
          password: newPassword
        }
      );

      assert.equal(reused.status, 400);
      assert.deepEqual(
        await reused.json(),
        { error: "invalid_or_expired_reset_token" }
      );

      const oldLogin = await post(
        "/api/auth/login",
        {
          email,
          password: oldPassword
        }
      );

      assert.equal(oldLogin.status, 401);

      const newLogin = await post(
        "/api/auth/login",
        {
          email,
          password: newPassword
        }
      );

      assert.equal(newLogin.status, 200);

      const newSessionCookie =
        newLogin.headers
          .get("set-cookie")
          ?.split(";")[0];

      assert.ok(newSessionCookie);
      assert.notEqual(newSessionCookie, sessionCookie);

      const finalDatabase = JSON.parse(
        fs.readFileSync(dbPath, "utf8")
      );

      assert.equal(
        finalDatabase.users[userId].auth.authVersion,
        2
      );

      assert.equal(
        finalDatabase.users[userId].auth.passwordReset,
        undefined
      );

      assert.equal(
        JSON.stringify(finalDatabase).includes(
          recovery.token
        ),
        false,
        "el token original no debe guardarse"
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
