import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

import {
  buildEmailVerificationEmail
} from "../lib/email-messages.js";

const source = fs.readFileSync(
  new URL("../server.js", import.meta.url),
  "utf8"
);

test(
  "envío V3: destinatario, idioma, URL y SMTP",
  async () => {
    const start = source.indexOf(
      "async function _sendEmailVerificationEmail("
    );

    const end = source.indexOf(
      "async function _sendPasswordResetEmail(",
      start
    );

    assert.ok(start >= 0, "Falta función de envío");
    assert.ok(end > start, "Falta fin de función");

    const snippet = source.slice(start, end);
    const captured = [];

    const context = vm.createContext({
      ENV: {
        SMTP_USER: "mailer@example.invalid",
        CONTACT_TO: "support@example.invalid"
      },
      _getMailTransporter: () => ({
        async sendMail(message) {
          captured.push(message);
          return { accepted: [message.to] };
        }
      }),
      _normalizeContactName: name =>
        String(name || "").trim(),
      buildEmailVerificationEmail,
      encodeURIComponent
    });

    vm.runInContext(snippet, context, {
      timeout: 1000
    });

    const token = "a".repeat(43);

    for (const language of ["es", "en"]) {
      await vm.runInContext(
        `_sendEmailVerificationEmail(${JSON.stringify({
          name: "Usuario de prueba",
          email: "recipient@example.invalid",
          language,
          token
        })})`,
        context,
        { timeout: 1000 }
      );
    }

    assert.equal(captured.length, 2);

    for (const mail of captured) {
      assert.equal(mail.to, "recipient@example.invalid");
      assert.equal(
        mail.from.address,
        "mailer@example.invalid"
      );
      assert.equal(
        mail.replyTo,
        "support@example.invalid"
      );
      assert.ok(mail.text.includes(
        `https://quacker.es/?verify_token=${token}`
      ));
      assert.ok(mail.html.includes(token));
      assert.ok(mail.subject.includes("Quacker"));
    }

    assert.notEqual(
      captured[0].subject,
      captured[1].subject,
      "El asunto debe estar traducido"
    );
  }
);
