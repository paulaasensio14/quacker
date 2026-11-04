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
  createVerificationMailbox
} from "./helpers/verified-registration.js";

const SERVER_PATH = fileURLToPath(
  new URL("../server.js", import.meta.url)
);

async function availablePort() {
  const listener = net.createServer();

  return new Promise((resolve, reject) => {
    listener.once("error", reject);

    listener.listen(0, "127.0.0.1", () => {
      const port = listener.address().port;

      listener.close(error =>
        error ? reject(error) : resolve(port)
      );
    });
  });
}

async function startServer(directory, mailbox) {
  const port = await availablePort();
  const origin = `http://127.0.0.1:${port}`;

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

  child.stdout.on("data", chunk => {
    stdout += chunk.toString();
  });

  child.stderr.on("data", chunk => {
    stderr += chunk.toString();
  });

  for (let attempt = 0; attempt < 100; attempt++) {
    if (stdout.includes(
      `Quacker server running: ${origin}`
    )) {
      return { child, origin, getStderr: () => stderr };
    }

    if (
      child.exitCode !== null ||
      child.signalCode !== null
    ) {
      break;
    }

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
    child.exitCode === null &&
    child.signalCode === null
  ) {
    child.kill("SIGTERM");
  }

  for (let attempt = 0; attempt < 30; attempt++) {
    if (
      child.exitCode !== null ||
      child.signalCode !== null
    ) return;

    await sleep(100);
  }

  child.kill("SIGKILL");
}

function messagesFor(mailbox, email) {
  return mailbox.messages.filter(message =>
    message.recipients.includes(email)
  );
}

async function waitForMessages(
  mailbox,
  email,
  expectedCount
) {
  for (let attempt = 0; attempt < 80; attempt++) {
    const messages = messagesFor(mailbox, email);

    if (messages.length >= expectedCount) {
      return messages;
    }

    await sleep(50);
  }

  return messagesFor(mailbox, email);
}

test(
  "HTTP + SMTP: bienvenida tras verificar, en ES/EN, sin duplicados",
  { timeout: 30000 },
  async () => {
    const directory = fs.mkdtempSync(
      path.join(os.tmpdir(), "quacker-welcome-http-")
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
      const origin = started.origin;

      const post = (endpoint, body) =>
        fetch(`${origin}${endpoint}`, {
          method: "POST",
          headers: {
            Origin: origin,
            "Content-Type": "application/json"
          },
          body: JSON.stringify(body)
        });

      for (const scenario of [
        {
          language: "es",
          email: "welcome-es@example.test",
          name: "Usuario Espanol",
          greeting: "Hola Usuario Espanol,",
          title: "Bienvenido a tu nido"
        },
        {
          language: "en",
          email: "welcome-en@example.test",
          name: "English User",
          greeting: "Hi English User,",
          title: "Welcome to your nest"
        }
      ]) {
        const password = "Welcome-Test-Password-123!";

        const registration = await post(
          "/api/auth/register",
          {
            email: scenario.email,
            password,
            name: scenario.name,
            language: scenario.language
          }
        );

        assert.equal(registration.status, 202);

        const registrationBody =
          await registration.json();

        assert.equal(
          registrationBody.verificationRequired,
          true
        );

        assert.equal(
          registration.headers.get("set-cookie"),
          null
        );

        const token = await mailbox.tokenFor(
          scenario.email
        );

        assert.equal(
          messagesFor(mailbox, scenario.email).length,
          1,
          "Antes de verificar solo debe llegar la verificacion"
        );

        const confirmation = await post(
          "/api/auth/email-verification/confirm",
          { token }
        );

        assert.equal(
          confirmation.status,
          200
        );

        const body = await confirmation.json();

        assert.equal(body.ok, true);
        assert.equal(
          body.email,
          scenario.email
        );

        assert.equal(
          confirmation.headers.get("set-cookie"),
          null
        );

        const messages = await waitForMessages(
          mailbox,
          scenario.email,
          2
        );

        assert.equal(
          messages.length,
          2,
          "FALLO_ESPERADO_BIENVENIDA_NO_ENVIADA"
        );

        const welcome = messages[1].raw.replace(
          /=\r?\n/g,
          ""
        );

        assert.ok(
          welcome.includes(scenario.greeting),
          "La bienvenida debe incluir el nombre correcto"
        );

        assert.ok(
          welcome.includes(scenario.title),
          "La bienvenida debe estar en el idioma correcto"
        );

        const repeated = await post(
          "/api/auth/email-verification/confirm",
          { token }
        );

        assert.equal(
          repeated.status,
          400,
          "El token no debe reutilizarse"
        );

        await sleep(300);

        assert.equal(
          messagesFor(
            mailbox,
            scenario.email
          ).length,
          2,
          "No debe repetirse la bienvenida"
        );

        const login = await post(
          "/api/auth/login",
          {
            email: scenario.email,
            password
          }
        );

        assert.equal(
          login.status,
          200,
          "La cuenta verificada debe poder iniciar sesion"
        );

        console.log(
          `OK: bienvenida ${scenario.language} validada`
        );
      }

      const db = JSON.parse(
        fs.readFileSync(
          path.join(directory, "db.json"),
          "utf8"
        )
      );

      assert.equal(
        Object.keys(db.users).length,
        2
      );

      assert.equal(
        Object.keys(
          db.pendingRegistrations || {}
        ).length,
        0
      );

      console.log(
        "OK: dos cuentas verificadas, sin tokens pendientes"
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
        "OK: servidor y SMTP de pruebas retirados"
      );
    }
  }
);

test(
  "HTTP: una caida SMTP no impide activar la cuenta ni iniciar sesion",
  { timeout: 30000 },
  async () => {
    const directory = fs.mkdtempSync(
      path.join(os.tmpdir(), "welcome-smtp-failure-")
    );

    let mailbox;
    let mailboxClosed = false;
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
      const origin = started.origin;

      const post = (endpoint, body) =>
        fetch(`${origin}${endpoint}`, {
          method: "POST",
          headers: {
            Origin: origin,
            "Content-Type": "application/json"
          },
          body: JSON.stringify(body)
        });

      const email = "smtp-failure@example.test";
      const password = "Welcome-Failure-Test-123!";

      const registration = await post(
        "/api/auth/register",
        {
          email,
          password,
          name: "Usuario SMTP",
          language: "es"
        }
      );

      assert.equal(registration.status, 202);

      const token = await mailbox.tokenFor(email);

      assert.equal(
        mailbox.messages.length,
        1,
        "Solo debe haberse enviado la verificacion"
      );

      const before = JSON.parse(
        fs.readFileSync(
          path.join(directory, "db.json"),
          "utf8"
        )
      );

      assert.equal(
        Object.keys(before.users).length,
        0
      );

      // Simular la caida de SMTP tras verificar
      // que el primer correo se envio.
      await mailbox.close();
      mailboxClosed = true;

      const confirmation = await post(
        "/api/auth/email-verification/confirm",
        { token }
      );

      assert.equal(
        confirmation.status,
        200,
        "La bienvenida fallida no debe bloquear la activacion"
      );

      const confirmationBody =
        await confirmation.json();

      assert.deepEqual(
        confirmationBody,
        {
          ok: true,
          email
        }
      );

      assert.equal(
        confirmation.headers.get("set-cookie"),
        null
      );

      // Esperar a que el SMTP local rechace la conexion
      // y el servidor controle el error.
      let errorControlled = false;

      for (let attempt = 0; attempt < 240; attempt++) {
        if (started.getStderr().includes(
          "[Auth] welcome email delivery failed"
        )) {
          errorControlled = true;
          break;
        }

        if (
          child.exitCode !== null ||
          child.signalCode !== null
        ) {
          break;
        }

        await sleep(50);
      }

      assert.equal(
        errorControlled,
        true,
        "El fallo SMTP debe quedar controlado"
      );

      assert.equal(
        child.exitCode,
        null,
        "El servidor debe seguir funcionando"
      );

      assert.equal(child.signalCode, null);

      const saved = JSON.parse(
        fs.readFileSync(
          path.join(directory, "db.json"),
          "utf8"
        )
      );

      const users = Object.values(saved.users);

      assert.equal(users.length, 1);
      assert.equal(users[0].profile.email, email);

      assert.equal(
        Object.keys(
          saved.pendingRegistrations || {}
        ).length,
        0
      );

      const repeated = await post(
        "/api/auth/email-verification/confirm",
        { token }
      );

      assert.equal(
        repeated.status,
        400,
        "Un token consumido no puede activarse de nuevo"
      );

      const login = await post(
        "/api/auth/login",
        {
          email,
          password
        }
      );

      assert.equal(
        login.status,
        200,
        "La cuenta debe permitir iniciar sesion"
      );

      assert.ok(
        login.headers.get("set-cookie"),
        "El inicio de sesion debe crear su cookie"
      );

      const loginBody = await login.json();

      assert.equal(loginBody.user.email, email);

      assert.equal(
        mailbox.messages.length,
        1,
        "No se deben generar mensajes adicionales"
      );

      console.log(
        "OK: error SMTP controlado"
      );

      console.log(
        "OK: cuenta persistida y token consumido"
      );

      console.log(
        "OK: inicio de sesion disponible"
      );
    } finally {
      await stopServer(child);

      if (mailbox && !mailboxClosed) {
        await mailbox.close();
      }

      fs.rmSync(directory, {
        recursive: true,
        force: true
      });

      console.log(
        "OK: entorno SMTP aislado retirado"
      );
    }
  }
);
