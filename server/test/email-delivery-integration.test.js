import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

import {
  buildContactEmail,
  buildWelcomeEmail,
  buildPasswordResetEmail
} from "../lib/email-messages.js";

const source = fs.readFileSync(
  new URL("../server.js", import.meta.url),
  "utf8"
);

function createHarness() {
  const captured = [];

  const start = source.indexOf(
    "async function _sendContactEmail("
  );

  const end = source.indexOf(
    "function _normalizeCanonicalIdentity(",
    start
  );

  assert.ok(start >= 0, "Falta inicio de funciones");
  assert.ok(end > start, "Falta final de funciones");

  const functions = source.slice(start, end);

  for (const name of [
    "_sendContactEmail",
    "_sendWelcomeEmail",
    "_sendPasswordResetEmail"
  ]) {
    assert.equal(
      functions.split(`async function ${name}(`).length - 1,
      1,
      `Definición duplicada o ausente: ${name}`
    );
  }

  const context = vm.createContext({
    ENV: {
      SMTP_USER: "mailer@example.invalid",
      CONTACT_TO: "support@example.invalid"
    },
    PASSWORD_RESET_TOKEN_TTL_MS: 30 * 60 * 1000,
    _getMailTransporter: () => ({
      sendMail: async mail => {
        captured.push(mail);
        return { accepted: [mail.to] };
      }
    }),
    _normalizeContactName: name =>
      String(name ?? "")
        .replace(/[\r\n]+/g, " ")
        .replace(/\s+/g, " ")
        .trim(),
    createPasswordResetUrl: token =>
      `https://quacker.es/#reset=${encodeURIComponent(token)}`,
    buildContactEmail,
    buildWelcomeEmail,
    buildPasswordResetEmail
  });

  vm.runInContext(functions, context, {
    timeout: 1000
  });

  return {
    captured,
    async send(name, args) {
      assert.ok([
        "_sendContactEmail",
        "_sendWelcomeEmail",
        "_sendPasswordResetEmail"
      ].includes(name));

      await vm.runInContext(
        `${name}(${JSON.stringify(args)})`,
        context,
        { timeout: 1000 }
      );

      assert.equal(
        captured.length,
        1,
        "Se esperaba exactamente un mensaje"
      );

      return captured[0];
    }
  };
}

test("bienvenida ES: destinatario y plantilla V3", async () => {
  const h = createHarness();

  const mail = await h.send("_sendWelcomeEmail", {
    name: "Usuario de prueba",
    email: "user@example.invalid",
    language: "es"
  });

  assert.equal(mail.to, "user@example.invalid");
  assert.equal(mail.from.name, "Quacker");
  assert.equal(mail.from.address, "mailer@example.invalid");
  assert.equal(mail.replyTo, "support@example.invalid");
  assert.match(mail.subject, /Quacker/);
  assert.match(mail.html, /Bienvenido a tu nido/);
  assert.match(mail.html, /logo-quacker\.png/);
  assert.match(mail.text, /Usuario de prueba/);
});

test("bienvenida EN: idioma correcto", async () => {
  const h = createHarness();

  const mail = await h.send("_sendWelcomeEmail", {
    name: "Test User",
    email: "user@example.invalid",
    language: "en"
  });

  assert.match(mail.html, /Welcome to your nest/);
  assert.match(mail.html, /lang="en"/);
  assert.match(mail.text, /Test User/);
});

test("recuperación ES: URL y caducidad", async () => {
  const h = createHarness();

  const mail = await h.send("_sendPasswordResetEmail", {
    name: "Usuario de prueba",
    email: "user@example.invalid",
    language: "es",
    token: "TOKEN_FICTICIO"
  });

  assert.equal(mail.to, "user@example.invalid");
  assert.equal(mail.replyTo, "support@example.invalid");
  assert.match(mail.subject, /contraseña/);
  assert.match(
    mail.html,
    /https:\/\/quacker\.es\/#reset=TOKEN_FICTICIO/
  );
  assert.match(mail.html, /30 minutos/);
  assert.match(mail.text, /TOKEN_FICTICIO/);
});

test("recuperación EN: idioma y enlace", async () => {
  const h = createHarness();

  const mail = await h.send("_sendPasswordResetEmail", {
    name: "Test User",
    email: "user@example.invalid",
    language: "en",
    token: "TEST_TOKEN"
  });

  assert.match(mail.html, /Reset your password/);
  assert.match(mail.html, /30 minutes/);
  assert.match(mail.text, /TEST_TOKEN/);
});

test("contacto: destinatario interno y Reply-To", async () => {
  const h = createHarness();

  const mail = await h.send("_sendContactEmail", {
    name: "Usuario de prueba",
    email: "visitor@example.invalid",
    message: "Consulta de ejemplo",
    language: "es"
  });

  assert.equal(mail.to, "support@example.invalid");
  assert.equal(mail.replyTo.name, "Usuario de prueba");
  assert.equal(
    mail.replyTo.address,
    "visitor@example.invalid"
  );
  assert.match(mail.subject, /Nuevo mensaje/);
  assert.match(mail.html, /Nuevo mensaje de contacto/);
  assert.match(mail.html, /Consulta de ejemplo/);
  assert.match(mail.html, /charset="utf-8"/);
  assert.match(mail.text, /Consulta de ejemplo/);
});

test("contacto: error si no hay destinatario", async () => {
  const h = createHarness();

  const context = vm.createContext({
    ENV: {
      CONTACT_TO: "",
      SMTP_USER: "mailer@example.invalid"
    },
    _getMailTransporter: () => {
      throw new Error("No debería acceder a SMTP");
    },
    buildContactEmail
  });

  const start = source.indexOf(
    "async function _sendContactEmail("
  );

  const end = source.indexOf(
    "async function _sendWelcomeEmail(",
    start
  );

  vm.runInContext(source.slice(start, end), context);

  await assert.rejects(
    vm.runInContext(
      `_sendContactEmail({
        name: "Test",
        email: "test@example.invalid",
        message: "Mensaje",
        language: "es"
      })`,
      context
    ),
    error => error.code === "contact_mail_not_configured"
  );

  assert.equal(h.captured.length, 0);
});
