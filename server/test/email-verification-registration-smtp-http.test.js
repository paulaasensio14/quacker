import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import net from "node:net";
import { spawn, execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { setTimeout as sleep } from "node:timers/promises";
import { SMTPServer } from "smtp-server";

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

async function closeChild(child) {
  if (!child) return;

  if (child.exitCode === null && child.signalCode === null) {
    child.kill("SIGTERM");
  }

  for (let i = 0; i < 30; i++) {
    if (
      child.exitCode !== null ||
      child.signalCode !== null
    ) return;

    await sleep(100);
  }

  child.kill("SIGKILL");
}

test(
  "HTTP: entrega el correo y conserva el registro pendiente",
  { timeout: 25000 },
  async () => {
    const dir = fs.mkdtempSync(
      path.join(os.tmpdir(), "quacker-register-smtp-")
    );

    const dbPath = path.join(dir, "db.json");
    const keyPath = path.join(dir, "smtp.key");
    const certPath = path.join(dir, "smtp.crt");

    const username = "mailer@example.invalid";
    const password = crypto.randomBytes(24).toString("hex");
    const email = "pending-smtp@example.test";

    const captured = [];

    let smtpServer;
    let child;

    try {
      execFileSync("openssl", [
        "req",
        "-x509",
        "-newkey", "rsa:2048",
        "-nodes",
        "-keyout", keyPath,
        "-out", certPath,
        "-days", "1",
        "-subj", "/CN=127.0.0.1",
        "-addext", "subjectAltName=IP:127.0.0.1",
        "-addext", "extendedKeyUsage=serverAuth"
      ], {
        stdio: "ignore"
      });

      fs.chmodSync(keyPath, 0o600);

      smtpServer = new SMTPServer({
        key: fs.readFileSync(keyPath),
        cert: fs.readFileSync(certPath),
        secure: false,
        authOptional: false,
        disabledCommands: ["XOAUTH2"],

        onAuth(auth, session, callback) {
          if (
            auth.username !== username ||
            auth.password !== password
          ) {
            const error = new Error("Invalid credentials");
            error.responseCode = 535;
            return callback(error);
          }

          callback(null, { user: username });
        },

        onData(stream, session, callback) {
          const chunks = [];

          stream.on("data", chunk => chunks.push(chunk));

          stream.on("end", () => {
            captured.push({
              recipients: session.envelope.rcptTo.map(
                item => item.address
              ),
              content: Buffer.concat(chunks).toString("utf8")
            });

            callback();
          });

          stream.on("error", callback);
        }
      });

      await new Promise((resolve, reject) => {
        smtpServer.once("error", reject);
        smtpServer.listen(0, "127.0.0.1", resolve);
      });

      const smtpPort = smtpServer.server.address().port;
      const httpPort = await freePort();
      const origin = `http://127.0.0.1:${httpPort}`;

      child = spawn(process.execPath, [SERVER_PATH], {
        cwd: path.dirname(SERVER_PATH),
        env: {
          ...process.env,
          NODE_ENV: "test",
          PORT: String(httpPort),
          QUACKER_DB_PATH: dbPath,
          QUACKER_SESSION_STORE_PATH:
            path.join(dir, "sessions"),
          SMTP_HOST: "127.0.0.1",
          SMTP_PORT: String(smtpPort),
          SMTP_SECURE: "false",
          SMTP_USER: username,
          SMTP_PASS: password,
          CONTACT_TO: username,
          NODE_EXTRA_CA_CERTS: certPath
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
        `Servidor HTTP no disponible: ${stderr.slice(-500)}`
      );

      const registration = await fetch(
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
            name: "Usuario SMTP",
            language: "es"
          })
        }
      );

      const body = await registration.json();

      assert.equal(
        registration.status,
        202,
        "El registro con SMTP debe responder HTTP 202"
      );

      assert.equal(body.ok, true);
      assert.equal(body.verificationRequired, true);
      assert.equal(body.token, undefined);
      assert.equal(body.user, undefined);
      assert.equal(
        registration.headers.get("set-cookie"),
        null
      );

      const db = JSON.parse(
        fs.readFileSync(dbPath, "utf8")
      );

      assert.equal(Object.keys(db.users).length, 0);

      const pending = Object.values(
        db.pendingRegistrations || {}
      );

      assert.equal(pending.length, 1);
      assert.equal(pending[0].email, email);
      assert.match(pending[0].tokenHash, /^[a-f0-9]{64}$/);

      for (let i = 0; i < 40 && captured.length === 0; i++) {
        await sleep(100);
      }

      assert.equal(
        captured.length,
        1,
        "Debe entregarse un único correo de verificación"
      );

      assert.deepEqual(
        captured[0].recipients,
        [email]
      );

      assert.match(
        captured[0].content,
        /quacker\.es/i
      );

      console.log(
        "OK: registro pendiente y correo SMTP entregado"
      );
      console.log(
        "OK: sin cuenta activa, sin sesión y sin token público"
      );
    } finally {
      await closeChild(child);

      if (smtpServer) {
        await new Promise((resolve, reject) => {
          smtpServer.close(error =>
            error ? reject(error) : resolve()
          );
        });
      }

      fs.rmSync(dir, {
        recursive: true,
        force: true
      });

      console.log(
        "OK: servidor, SMTP y certificado retirados"
      );
    }
  }
);
