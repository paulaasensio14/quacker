import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";

import nodemailer from "nodemailer";
import { SMTPServer } from "smtp-server";

import {
  buildEmailVerificationEmail
} from "../lib/email-messages.js";


function decodeQuotedPrintable(value) {
  const unfolded = value.replace(/=\r?\n/g, "");

  return Buffer.from(
    unfolded.replace(/=([0-9A-Fa-f]{2})/g, (_, hex) =>
      String.fromCharCode(parseInt(hex, 16))
    ),
    "binary"
  ).toString("utf8");
}

function decodeMimeBody(message) {
  const sections = message.split(/\r?\n\r?\n/);
  const decoded = [];

  for (const section of sections) {
    decoded.push(decodeQuotedPrintable(section));
  }

  return decoded.join("\n");
}

test(
  "SMTP local: entrega correos V3 en español e inglés",
  { timeout: 20000 },
  async () => {
    const dir = fs.mkdtempSync(
      path.join(os.tmpdir(), "quacker-v3-smtp-")
    );

    const keyPath = path.join(dir, "smtp.key");
    const certPath = path.join(dir, "smtp.crt");
    const username = "mailer@example.invalid";
    const password = crypto.randomBytes(24).toString("hex");
    const token = crypto.randomBytes(32).toString("base64url");

    const verificationUrl =
      `https://quacker.es/?verify_token=${token}`;

    const received = [];
    let server;
    let transporter;

    try {
      execFileSync("openssl", [
        "req", "-x509",
        "-newkey", "rsa:2048",
        "-nodes",
        "-keyout", keyPath,
        "-out", certPath,
        "-days", "1",
        "-subj", "/CN=localhost"
      ], {
        stdio: "ignore"
      });

      fs.chmodSync(keyPath, 0o600);

      server = new SMTPServer({
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
            received.push({
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
        server.once("error", reject);
        server.listen(0, "127.0.0.1", resolve);
      });

      const port = server.server.address().port;

      transporter = nodemailer.createTransport({
        host: "127.0.0.1",
        port,
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

      for (const [language, name, recipient] of [
        ["es", "Usuario de prueba", "es@example.invalid"],
        ["en", "Test User", "en@example.invalid"]
      ]) {
        const mail = buildEmailVerificationEmail({
          name,
          language,
          verificationUrl,
          expiryHours: 24
        });

        assert.ok(mail.text.includes(verificationUrl));
        assert.ok(mail.html.includes(verificationUrl.replaceAll("&", "&amp;")));

        const result = await transporter.sendMail({
          from: username,
          to: recipient,
          subject: mail.subject,
          text: mail.text,
          html: mail.html
        });

        assert.deepEqual(result.accepted, [recipient]);
      }

      assert.equal(received.length, 2);

      assert.deepEqual(
        received.map(item => item.recipients[0]),
        ["es@example.invalid", "en@example.invalid"]
      );

      for (const message of received) {
        const decoded = decodeMimeBody(message.content);

        assert.ok(
          decoded.includes(token),
          "El correo decodificado debe contener el token"
        );

        assert.match(
          message.content,
          /multipart\/alternative/i
        );
      }

      console.log("OK: correo V3 español recibido");
      console.log("OK: correo V3 inglés recibido");
      console.log("OK: enlaces de verificación incluidos");
      console.log("OK: mensajes capturados con SMTP local");
    } finally {
      transporter?.close();

      if (server) {
        await new Promise((resolve, reject) => {
          server.close(error =>
            error ? reject(error) : resolve()
          );
        });
      }

      fs.rmSync(dir, {
        recursive: true,
        force: true
      });

      console.log("OK: certificado y receptor retirados");
    }
  }
);
