import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { SMTPServer } from "smtp-server";

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

function extractVerificationToken(raw) {
  const decoded = decodeQuotedPrintable(raw);

  const matches = [
    ...decoded.matchAll(
      /https:\/\/quacker\.es\/\?verify_token=([A-Za-z0-9_-]{43})/g
    )
  ].map(match => match[1]);

  const unique = [...new Set(matches)];

  assert.equal(
    unique.length,
    1,
    "El correo debe contener un único token distinto"
  );

  return unique[0];
}

export async function createVerificationMailbox(directory) {
  const keyPath = path.join(directory, "test-smtp.key");
  const certPath = path.join(directory, "test-smtp.crt");

  execFileSync("openssl", [
    "req", "-x509",
    "-newkey", "rsa:2048",
    "-nodes",
    "-keyout", keyPath,
    "-out", certPath,
    "-days", "1",
    "-subj", "/CN=127.0.0.1",
    "-addext", "subjectAltName=IP:127.0.0.1",
    "-addext", "extendedKeyUsage=serverAuth"
  ], { stdio: "ignore" });

  fs.chmodSync(keyPath, 0o600);

  const username = "mailer@example.invalid";
  const password = crypto.randomBytes(24).toString("hex");
  const messages = [];

  const server = new SMTPServer({
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
      let finished = false;

      stream.on("data", chunk => chunks.push(chunk));

      stream.once("error", error => {
        if (finished) return;
        finished = true;
        callback(error);
      });

      stream.once("end", () => {
        if (finished) return;
        finished = true;

        messages.push({
          recipients: session.envelope.rcptTo.map(
            item => item.address.toLowerCase()
          ),
          raw: Buffer.concat(chunks).toString("utf8")
        });

        callback();
      });
    }
  });

  try {
    await new Promise((resolve, reject) => {
      server.once("error", reject);
      server.listen(0, "127.0.0.1", resolve);
    });
  } catch (error) {
    server.close();
    throw error;
  }

  return {
    env: {
      SMTP_HOST: "127.0.0.1",
      SMTP_PORT: String(server.server.address().port),
      SMTP_SECURE: "false",
      SMTP_USER: username,
      SMTP_PASS: password,
      CONTACT_TO: username,
      NODE_EXTRA_CA_CERTS: certPath
    },

    messages,

    async tokenFor(email) {
      const normalized = email.trim().toLowerCase();

      for (let attempt = 0; attempt < 100; attempt++) {
        const matches = messages.filter(
          message =>
            message.recipients.includes(normalized)
        );

        assert.ok(
          matches.length <= 1,
          "Más de un correo para el mismo registro"
        );

        if (matches.length === 1) {
          return extractVerificationToken(matches[0].raw);
        }

        await new Promise(resolve =>
          setTimeout(resolve, 50)
        );
      }

      throw new Error(
        "No se recibió el correo de verificación"
      );
    },

    async close() {
      await new Promise((resolve, reject) => {
        server.close(error =>
          error ? reject(error) : resolve()
        );
      });
    }
  };
}

export async function registerVerifiedUser({
  baseUrl,
  mailbox,
  email,
  password,
  name,
  language = "es"
}) {
  const origin = new URL(baseUrl).origin;

  assert.equal(
    new URL(baseUrl).hostname,
    "127.0.0.1",
    "Solo se permiten servidores locales"
  );

  const post = (endpoint, body) =>
    fetch(`${origin}${endpoint}`, {
      method: "POST",
      headers: {
        Origin: origin,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body)
    });

  const registration = await post("/api/auth/register", {
    email,
    password,
    name,
    language
  });

  assert.equal(
    registration.status,
    202,
    "El registro debe quedar pendiente"
  );

  assert.equal(
    registration.headers.get("set-cookie"),
    null,
    "El registro no debe crear sesión"
  );

  const registrationBody = await registration.json();

  assert.equal(registrationBody.ok, true);
  assert.equal(registrationBody.verificationRequired, true);
  assert.equal(registrationBody.token, undefined);
  assert.equal(registrationBody.user, undefined);

  const token = await mailbox.tokenFor(email);

  const confirmation = await post(
    "/api/auth/email-verification/confirm",
    { token }
  );

  const confirmationBody = await confirmation.json();

  assert.equal(
    confirmation.status,
    200,
    `Confirmación HTTP inesperada: ${
      confirmationBody.error || confirmation.status
    }`
  );

  assert.deepEqual(confirmationBody, { ok: true });

  assert.equal(
    confirmation.headers.get("set-cookie"),
    null,
    "La confirmación no debe crear sesión"
  );

  const login = await post("/api/auth/login", {
    email,
    password
  });

  assert.equal(login.status, 200);

  const body = await login.json();

  assert.ok(body.user);
  assert.equal(
    body.user.email,
    email.trim().toLowerCase()
  );

  const cookie = login.headers
    .get("set-cookie")
    ?.split(";")[0];

  assert.ok(
    cookie,
    "El inicio de sesión debe devolver una cookie"
  );

  return {
    cookie,
    user: body.user
  };
}
