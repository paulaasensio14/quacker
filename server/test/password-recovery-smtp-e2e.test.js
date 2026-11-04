import test from "node:test";
import assert from "node:assert/strict";
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

const SERVER_PATH = fileURLToPath(
  new URL("../server.js", import.meta.url)
);

async function freePort() {
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

async function startServer(directory, mailbox) {
  const port = await freePort();
  const baseUrl = `http://127.0.0.1:${port}`;

  const child = spawn(process.execPath, [SERVER_PATH], {
    cwd: path.dirname(SERVER_PATH),
    env: {
      ...process.env,
      NODE_ENV: "test",
      PORT: String(port),
      QUACKER_DB_PATH:
        path.join(directory, "db.json"),
      QUACKER_SESSION_STORE_PATH:
        path.join(directory, "sessions"),
      ...mailbox.env
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

  for (let i = 0; i < 100; i++) {
    if (stdout.includes(
      `Quacker server running: ${baseUrl}`
    )) {
      return { child, baseUrl };
    }

    if (
      child.exitCode !== null ||
      child.signalCode !== null
    ) break;

    await sleep(100);
  }

  child.kill("SIGTERM");

  throw new Error(
    `Servidor temporal no disponible: ${stderr.slice(-300)}`
  );
}

async function stopServer(child) {
  if (!child) return;

  if (
    child.exitCode !== null ||
    child.signalCode !== null
  ) return;

  child.kill("SIGTERM");

  for (let i = 0; i < 30; i++) {
    if (
      child.exitCode !== null ||
      child.signalCode !== null
    ) return;

    await sleep(100);
  }

  child.kill("SIGKILL");
}

function decodeQuotedPrintable(value) {
  const unfolded = value.replace(/=\r?\n/g, "");

  return Buffer.from(
    unfolded.replace(
      /=([0-9A-Fa-f]{2})/g,
      (_, hex) =>
        String.fromCharCode(parseInt(hex, 16))
    ),
    "binary"
  ).toString("utf8");
}

function recoveryTokens(mailbox, email) {
  const result = [];

  for (const message of mailbox.messages) {
    if (!message.recipients.includes(email)) {
      continue;
    }

    const decoded = decodeQuotedPrintable(
      message.raw
    );

    const matches = [
      ...decoded.matchAll(
        /https:\/\/quacker\.es\/#reset=([A-Za-z0-9_-]{43})/g
      )
    ].map(match => match[1]);

    const unique = [...new Set(matches)];

    if (unique.length > 0) {
      assert.equal(
        unique.length,
        1,
        "Cada correo debe contener un unico token"
      );

      result.push(unique[0]);
    }
  }

  return result;
}

async function waitForRecoveryTokens(
  mailbox,
  email,
  count
) {
  for (let i = 0; i < 100; i++) {
    const tokens = recoveryTokens(
      mailbox,
      email
    );

    if (tokens.length >= count) {
      return tokens;
    }

    await sleep(50);
  }

  return recoveryTokens(mailbox, email);
}

test(
  "HTTP + SMTP: recuperacion completa mediante correo recibido",
  { timeout: 35000 },
  async () => {
    const directory = fs.mkdtempSync(
      path.join(os.tmpdir(), "quacker-recovery-e2e-")
    );

    let mailbox;
    let child;

    try {
      mailbox = await createVerificationMailbox(
        directory
      );

      const started = await startServer(
        directory,
        mailbox
      );

      child = started.child;
      const baseUrl = started.baseUrl;

      const post = (endpoint, body) =>
        fetch(`${baseUrl}${endpoint}`, {
          method: "POST",
          headers: {
            Origin: baseUrl,
            "Content-Type": "application/json"
          },
          body: JSON.stringify(body)
        });

      const email = "recovery-e2e@example.test";
      const unknown = "unknown-e2e@example.test";
      const oldPassword = "Old-Recovery-E2E-123!";
      const newPassword = "New-Recovery-E2E-456!";

      const account = await registerVerifiedUser({
        baseUrl,
        mailbox,
        email,
        password: oldPassword,
        name: "Usuario Recuperacion",
        language: "es"
      });

      const oldCookie = account.cookie;

      const readMe = () =>
        fetch(`${baseUrl}/api/auth/me`, {
          headers: {
            Cookie: oldCookie
          }
        });

      assert.equal(
        (await readMe()).status,
        200
      );

      console.log(
        "OK: cuenta verificada y sesion inicial"
      );

      // La solicitud no debe revelar si existe el email.
      const unknownResponse = await post(
        "/api/auth/password-reset/request",
        { email: unknown }
      );

      assert.equal(unknownResponse.status, 200);
      assert.deepEqual(
        await unknownResponse.json(),
        { ok: true }
      );

      await sleep(150);

      assert.equal(
        mailbox.messages.filter(
          item => item.recipients.includes(unknown)
        ).length,
        0
      );

      console.log(
        "OK: email desconocido no revela la cuenta"
      );

      const requestOne = await post(
        "/api/auth/password-reset/request",
        { email }
      );

      assert.equal(requestOne.status, 200);
      assert.deepEqual(
        await requestOne.json(),
        { ok: true }
      );

      assert.equal(
        requestOne.headers.get("set-cookie"),
        null
      );

      const firstTokens =
        await waitForRecoveryTokens(
          mailbox,
          email,
          1
        );

      assert.equal(
        firstTokens.length,
        1,
        "Debe recibirse un correo de recuperacion"
      );

      const firstToken = firstTokens[0];

      assert.match(
        firstToken,
        /^[A-Za-z0-9_-]{43}$/
      );

      console.log(
        "OK: primer enlace recuperado del correo SMTP"
      );

      // Una segunda solicitud sustituye el token.
      const requestTwo = await post(
        "/api/auth/password-reset/request",
        { email }
      );

      assert.equal(requestTwo.status, 200);
      assert.deepEqual(
        await requestTwo.json(),
        { ok: true }
      );

      const tokens = await waitForRecoveryTokens(
        mailbox,
        email,
        2
      );

      assert.equal(tokens.length, 2);

      const secondToken = tokens[1];

      assert.notEqual(
        firstToken,
        secondToken,
        "Cada solicitud debe generar un token nuevo"
      );

      const databasePath = path.join(
        directory,
        "db.json"
      );

      const before = JSON.parse(
        fs.readFileSync(databasePath, "utf8")
      );

      assert.equal(
        Object.keys(before.users).length,
        1
      );

      const userBefore =
        Object.values(before.users)[0];

      assert.match(
        userBefore.auth.passwordReset.tokenHash,
        /^[a-f0-9]{64}$/
      );

      assert.equal(
        JSON.stringify(before).includes(firstToken),
        false
      );

      assert.equal(
        JSON.stringify(before).includes(secondToken),
        false
      );

      console.log(
        "OK: tokens reales ausentes de la base de datos"
      );

      const superseded = await post(
        "/api/auth/password-reset/confirm",
        {
          token: firstToken,
          password: newPassword
        }
      );

      assert.equal(
        superseded.status,
        400,
        "El token sustituido debe ser invalido"
      );

      const confirmation = await post(
        "/api/auth/password-reset/confirm",
        {
          token: secondToken,
          password: newPassword
        }
      );

      assert.equal(
        confirmation.status,
        200
      );

      assert.deepEqual(
        await confirmation.json(),
        { ok: true }
      );

      assert.equal(
        confirmation.headers.get("set-cookie"),
        null
      );

      console.log(
        "OK: contrasena cambiada mediante token del correo"
      );

      assert.equal(
        (await readMe()).status,
        401,
        "La sesion anterior debe invalidarse"
      );

      const repeated = await post(
        "/api/auth/password-reset/confirm",
        {
          token: secondToken,
          password: newPassword
        }
      );

      assert.equal(
        repeated.status,
        400
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

      assert.ok(
        newLogin.headers.get("set-cookie")
      );

      const finalDb = JSON.parse(
        fs.readFileSync(databasePath, "utf8")
      );

      const userAfter =
        Object.values(finalDb.users)[0];

      assert.equal(
        userAfter.auth.passwordReset,
        undefined
      );

      assert.equal(
        userAfter.auth.authVersion,
        2
      );

      assert.equal(
        Object.keys(
          finalDb.pendingRegistrations || {}
        ).length,
        0
      );

      console.log(
        "OK: sesion antigua invalidada"
      );

      console.log(
        "OK: token consumido y no reutilizable"
      );

      console.log(
        "OK: acceso solo con nueva contrasena"
      );

    } finally {
      await stopServer(child);

      if (mailbox) {
        await mailbox.close();
      }

      fs.rmSync(directory, {
        recursive: true,
        force: true
      });

      console.log(
        "OK: entorno temporal y SMTP retirados"
      );
    }
  }
);
