import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import net from "node:net";
import { fileURLToPath } from "node:url";
import { setTimeout as sleep } from "node:timers/promises";

import {
  createPendingRegistration
} from "../lib/email-verification.js";

import {
  createInitialDb,
  validateDb
} from "../lib/db-schema.js";

import {
  writeJsonFileAtomic
} from "../lib/json-db.js";

const SERVER_PATH = fileURLToPath(
  new URL("../server.js", import.meta.url)
);

async function freePort() {
  return new Promise((resolve, reject) => {
    const listener = net.createServer();

    listener.once("error", reject);

    listener.listen(0, "127.0.0.1", () => {
      const port = listener.address().port;

      listener.close(error =>
        error ? reject(error) : resolve(port)
      );
    });
  });
}

test(
  "HTTP: confirmar correo activa la cuenta una sola vez",
  { timeout: 20000 },
  async () => {
    const dir = fs.mkdtempSync(
      path.join(os.tmpdir(), "quacker-confirm-email-")
    );

    let child;

    try {
      const dbPath = path.join(dir, "db.json");
      const email = "verified@example.test";
      const password = "Verification-Test-123!";
      const salt = crypto.randomBytes(16).toString("hex");

      const hash = crypto.scryptSync(
        password,
        salt,
        64
      ).toString("hex");

      const db = createInitialDb();

      const pending = createPendingRegistration({
        db,
        email,
        name: "Usuario verificado",
        language: "es",
        passwordSalt: salt,
        passwordHash: hash
      });

      validateDb(db);
      writeJsonFileAtomic(dbPath, db);

      const port = await freePort();
      const origin = `http://127.0.0.1:${port}`;

      child = spawn(process.execPath, [SERVER_PATH], {
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

      let ready = false;

      for (let attempt = 0; attempt < 100; attempt++) {
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

      const request = (endpoint, body) => fetch(
        `${origin}${endpoint}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Origin: origin
          },
          body: JSON.stringify(body)
        }
      );

      // La solicitud existe, pero aún no hay cuenta activa.
      const before = JSON.parse(
        fs.readFileSync(dbPath, "utf8")
      );

      assert.equal(
        Object.keys(before.users).length,
        0
      );

      assert.equal(
        Object.keys(before.pendingRegistrations).length,
        1
      );

      const confirmation = await request(
        "/api/auth/email-verification/confirm",
        { token: pending.token }
      );

      assert.equal(
        confirmation.status,
        200,
        "La ruta debe confirmar el correo"
      );

      const confirmationBody = await confirmation.json();

      assert.equal(confirmationBody.ok, true);

      // Confirmar no debe iniciar sesión automáticamente.
      assert.equal(
        confirmation.headers.get("set-cookie"),
        null
      );

      const saved = JSON.parse(
        fs.readFileSync(dbPath, "utf8")
      );

      const users = Object.values(saved.users);

      assert.equal(users.length, 1);
      assert.equal(users[0].profile.email, email);

      assert.equal(
        Object.keys(saved.pendingRegistrations).length,
        0
      );

      const repeated = await request(
        "/api/auth/email-verification/confirm",
        { token: pending.token }
      );

      assert.equal(repeated.status, 400);

      const login = await request(
        "/api/auth/login",
        { email, password }
      );

      assert.equal(login.status, 200);

      const loggedIn = await login.json();

      assert.equal(loggedIn.user.email, email);

      assert.ok(
        login.headers.get("set-cookie"),
        "El inicio de sesión debe devolver la cookie"
      );

      console.log(
        "OK: correo confirmado, cuenta activa y token consumido"
      );
    } finally {
      if (child) {
        child.kill("SIGTERM");

        for (let attempt = 0; attempt < 30; attempt++) {
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
      }

      fs.rmSync(dir, {
        recursive: true,
        force: true
      });

      console.log("OK: entorno temporal retirado");
    }
  }
);
