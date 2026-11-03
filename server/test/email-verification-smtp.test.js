import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";

import nodemailer from "nodemailer";
import { SMTPServer } from "smtp-server";

const HOST = "127.0.0.1";

function createCertificate(dir) {
  const key = path.join(dir, "smtp.key");
  const cert = path.join(dir, "smtp.crt");

  execFileSync("openssl", [
    "req",
    "-x509",
    "-newkey", "rsa:2048",
    "-nodes",
    "-keyout", key,
    "-out", cert,
    "-days", "1",
    "-subj", "/CN=localhost"
  ], {
    stdio: "ignore"
  });

  fs.chmodSync(key, 0o600);

  return {
    key: fs.readFileSync(key),
    cert: fs.readFileSync(cert)
  };
}

function startServer(options) {
  return new Promise((resolve, reject) => {
    const server = new SMTPServer(options);

    server.once("error", reject);

    server.listen(0, HOST, () => {
      resolve({
        server,
        port: server.server.address().port
      });
    });
  });
}

function closeServer(server) {
  return new Promise((resolve, reject) => {
    server.close(error => {
      if (error) reject(error);
      else resolve();
    });
  });
}

test(
  "SMTP local: TLS, autenticación y captura segura",
  { timeout: 20000 },
  async () => {
    const dir = fs.mkdtempSync(
      path.join(os.tmpdir(), "quacker-smtp-test-")
    );

    const username = "mailer@example.invalid";
    const password = crypto.randomBytes(24).toString("hex");
    const captured = [];

    let server;
    let transporter;

    try {
      const certificate = createCertificate(dir);

      const smtp = await startServer({
        ...certificate,
        secure: false,
        authOptional: false,
        disabledCommands: ["XOAUTH2"],
        onAuth(auth, session, callback) {
          const valid =
            auth.username === username &&
            auth.password === password;

          if (!valid) {
            const error = new Error("Invalid credentials");
            error.responseCode = 535;
            callback(error);
            return;
          }

          callback(null, {
            user: username
          });
        },
        onData(stream, session, callback) {
          const chunks = [];

          stream.on("data", chunk => chunks.push(chunk));

          stream.on("end", () => {
            captured.push({
              sender: session.envelope.mailFrom.address,
              recipients: session.envelope.rcptTo.map(
                recipient => recipient.address
              ),
              content: Buffer.concat(chunks).toString("utf8")
            });

            callback();
          });

          stream.on("error", callback);
        }
      });

      server = smtp.server;

      transporter = nodemailer.createTransport({
        host: HOST,
        port: smtp.port,
        secure: false,
        requireTLS: true,
        auth: {
          user: username,
          pass: password
        },
        tls: {
          minVersion: "TLSv1.2",
          rejectUnauthorized: false
        },
        connectionTimeout: 5000,
        greetingTimeout: 5000,
        socketTimeout: 5000
      });

      const result = await transporter.sendMail({
        from: username,
        to: "recipient@example.invalid",
        subject: "Quacker SMTP test",
        text: "Mensaje de prueba seguro."
      });

      assert.equal(result.accepted.length, 1);
      assert.equal(captured.length, 1);

      assert.deepEqual(
        captured[0].recipients,
        ["recipient@example.invalid"]
      );

      assert.match(
        captured[0].content,
        /Quacker SMTP test/
      );

      assert.match(
        captured[0].content,
        /Mensaje de prueba seguro/
      );

      console.log(
        "OK: mensaje recibido por SMTP local"
      );

      console.log(
        "OK: STARTTLS y autenticación completados"
      );

      const invalidTransporter =
        nodemailer.createTransport({
          host: HOST,
          port: smtp.port,
          secure: false,
          requireTLS: true,
          auth: {
            user: username,
            pass: "invalid-password"
          },
          tls: {
            minVersion: "TLSv1.2",
            rejectUnauthorized: false
          },
          connectionTimeout: 5000,
          greetingTimeout: 5000,
          socketTimeout: 5000
        });

      try {
        await assert.rejects(
          invalidTransporter.sendMail({
            from: username,
            to: "recipient@example.invalid",
            subject: "Unauthorized",
            text: "Must not be accepted"
          })
        );
      } finally {
        invalidTransporter.close();
      }

      assert.equal(captured.length, 1);

      console.log(
        "OK: credenciales incorrectas rechazadas"
      );
    } finally {
      transporter?.close();

      if (server) {
        await closeServer(server);
      }

      fs.rmSync(dir, {
        recursive: true,
        force: true
      });

      console.log(
        "OK: receptor y certificado temporal retirados"
      );
    }
  }
);
