import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import net from "node:net";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { setTimeout as sleep } from "node:timers/promises";

import {
  createVerificationMailbox,
  registerVerifiedUser
} from "./helpers/verified-registration.js";

const serverPath = fileURLToPath(
  new URL("../server.js", import.meta.url)
);

async function availablePort() {
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
  "utilidad: registro, correo, token, confirmación y login",
  { timeout: 25000 },
  async () => {
    const directory = fs.mkdtempSync(
      path.join(os.tmpdir(), "quacker-verified-helper-")
    );

    let mailbox;
    let child;

    try {
      mailbox = await createVerificationMailbox(directory);

      const port = await availablePort();
      const baseUrl = `http://127.0.0.1:${port}`;
      const dbPath = path.join(directory, "db.json");

      child = spawn(process.execPath, [serverPath], {
        cwd: path.dirname(serverPath),
        env: {
          ...process.env,
          NODE_ENV: "test",
          PORT: String(port),
          QUACKER_DB_PATH: dbPath,
          QUACKER_SESSION_STORE_PATH:
            path.join(directory, "sessions"),
          ...mailbox.env
        },
        stdio: ["ignore", "pipe", "pipe"]
      });

      let stdout = "";
      let stderr = "";

      child.stdout.on("data", chunk => {
        stdout += chunk.toString();
      });

      child.stderr.on("data", chunk => {
        stderr += chunk.toString();
      });

      let ready = false;

      for (let attempt = 0; attempt < 100; attempt++) {
        if (stdout.includes(
          `Quacker server running: ${baseUrl}`
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

      const email = "verified-helper@example.test";
      const password = "Verified-Helper-123!";

      const registration = await fetch(
        `${baseUrl}/api/auth/register`,
        {
          method: "POST",
          headers: {
            Origin: baseUrl,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            email,
            password: "Different-Account-123!",
            name: "Cuenta de diagnóstico",
            language: "es"
          })
        }
      );

      assert.equal(registration.status, 202);

      const dbPending = JSON.parse(
        fs.readFileSync(dbPath, "utf8")
      );

      const pending = Object.values(
        dbPending.pendingRegistrations || {}
      );

      assert.equal(pending.length, 1);

      const token = await mailbox.tokenFor(email);

      assert.equal(
        crypto.createHash("sha256")
          .update(token)
          .digest("hex"),
        pending[0].tokenHash,
        "El token extraído debe coincidir con el hash guardado"
      );

      // La solicitud anterior usa una contraseña diferente.
      // Confirmarla y comprobar su autenticación por separado.
      const confirm = await fetch(
        `${baseUrl}/api/auth/email-verification/confirm`,
        {
          method: "POST",
          headers: {
            Origin: baseUrl,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({ token })
        }
      );

      assert.equal(confirm.status, 200);
      assert.equal(
        confirm.headers.get("set-cookie"),
        null
      );

      const secondEmail =
        "verified-helper-second@example.test";

      const account = await registerVerifiedUser({
        baseUrl,
        mailbox,
        email: secondEmail,
        password,
        name: "Verified Helper",
        language: "en"
      });

      assert.equal(account.user.email, secondEmail);
      assert.ok(account.user.id);
      assert.ok(account.cookie);

      const session = await fetch(
        `${baseUrl}/api/auth/me`,
        {
          headers: {
            Cookie: account.cookie
          }
        }
      );

      assert.equal(session.status, 200);

      const db = JSON.parse(
        fs.readFileSync(dbPath, "utf8")
      );

      assert.equal(Object.keys(db.users).length, 2);

      assert.equal(
        Object.keys(db.pendingRegistrations || {}).length,
        0
      );

      console.log(
        "OK: token SMTP coincide con el hash de la base de datos"
      );
      console.log(
        "OK: confirmación y login verificados"
      );
      console.log(
        "OK: utilidad compartida validada en inglés"
      );
    } finally {
      if (
        child &&
        child.exitCode === null &&
        child.signalCode === null
      ) {
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

      if (mailbox) {
        await mailbox.close();
      }

      fs.rmSync(directory, {
        recursive: true,
        force: true
      });

      console.log("OK: entorno temporal retirado");
    }
  }
);
