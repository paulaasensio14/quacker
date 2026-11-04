import test from "node:test";
import assert from "node:assert/strict";

import {
  buildEmailVerificationEmail
} from "../lib/email-messages.js";

const VERIFY_URL =
  "https://quacker.es/?verify_token=TOKEN_DE_PRUEBA";

test("correo de verificación en español", () => {
  const mail = buildEmailVerificationEmail({
    name: "Paula",
    language: "es",
    verificationUrl: VERIFY_URL,
    expiryHours: 24
  });

  assert.equal(typeof mail.subject, "string");
  assert.equal(typeof mail.text, "string");
  assert.equal(typeof mail.html, "string");

  assert.match(mail.subject, /verific|confirm/i);
  assert.match(mail.text, /Paula/);
  assert.match(mail.text, /24 horas/i);
  assert.match(mail.html, /Quacker/);
  assert.match(mail.html, /<a /);
  assert.match(mail.html, /verify_token=TOKEN_DE_PRUEBA/);
});

test("correo de verificación en inglés", () => {
  const mail = buildEmailVerificationEmail({
    name: "Alex",
    language: "en",
    verificationUrl: VERIFY_URL,
    expiryHours: 24
  });

  assert.match(mail.subject, /verif|confirm/i);
  assert.match(mail.text, /Alex/);
  assert.match(mail.text, /24 hours/i);
  assert.match(mail.html, /lang="en"/);
  assert.match(mail.html, /verify_token=TOKEN_DE_PRUEBA/);
});

test("incluye el enlace de confirmación en texto plano", () => {
  const mail = buildEmailVerificationEmail({
    name: "Usuario",
    language: "es",
    verificationUrl: VERIFY_URL,
    expiryHours: 24
  });

  assert.ok(mail.text.includes(VERIFY_URL));
});

test("rechaza enlaces de verificación externos", () => {
  assert.throws(() => {
    buildEmailVerificationEmail({
      name: "Usuario",
      language: "es",
      verificationUrl:
        "https://example.com/?verify_token=TOKEN",
      expiryHours: 24
    });
  });
});

test("rechaza enlaces sin HTTPS", () => {
  assert.throws(() => {
    buildEmailVerificationEmail({
      name: "Usuario",
      language: "es",
      verificationUrl:
        "http://quacker.es/?verify_token=TOKEN",
      expiryHours: 24
    });
  });
});

test("escapa el nombre para impedir HTML inyectado", () => {
  const mail = buildEmailVerificationEmail({
    name: '<script>alert("x")</script>',
    language: "es",
    verificationUrl: VERIFY_URL,
    expiryHours: 24
  });

  assert.doesNotMatch(mail.html, /<script>/);
  assert.match(mail.html, /&lt;script&gt;/);
});
