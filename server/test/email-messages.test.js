import test from "node:test";
import assert from "node:assert/strict";

import {
  buildWelcomeEmail,
  buildPasswordResetEmail,
  buildContactEmail
} from "../lib/email-messages.js";

test("welcome email in Spanish", () => {
  const email = buildWelcomeEmail({
    name: "Usuario de prueba",
    language: "es"
  });

  assert.match(email.html, /Bienvenido a tu nido/);
  assert.match(email.html, /logo-quacker\.png/);
  assert.match(email.html, /Entrar en Quacker/);
  assert.match(email.text, /Usuario de prueba/);
});

test("welcome email in English", () => {
  const email = buildWelcomeEmail({
    name: "Test User",
    language: "en"
  });

  assert.match(email.html, /Welcome to your nest/);
  assert.match(email.html, /lang="en"/);
  assert.match(email.text, /Test User/);
});

test("welcome escapes a malicious name", () => {
  const email = buildWelcomeEmail({
    name: '<img src=x onerror=alert(1)>'
  });

  assert.doesNotMatch(email.html, /<img src=x/);
  assert.match(email.html, /&lt;img/);
});

test("password recovery preserves the secure URL", () => {
  const url = "https://quacker.es/#reset=TOKEN_FICTICIO";

  const email = buildPasswordResetEmail({
    name: "Usuario",
    language: "es",
    resetUrl: url
  });

  assert.match(email.html, /TOKEN_FICTICIO/);
  assert.match(email.text, /TOKEN_FICTICIO/);
  assert.match(email.html, /30 minutos/);
  assert.match(email.html, /solo se puede utilizar una vez/);
});

test("password recovery in English", () => {
  const email = buildPasswordResetEmail({
    language: "en",
    resetUrl: "https://quacker.es/#reset=TEST"
  });

  assert.match(email.html, /Reset your password/);
  assert.match(email.html, /30 minutes/);
});

test("password recovery rejects external URLs", () => {
  assert.throws(
    () => buildPasswordResetEmail({
      resetUrl: "https://example.com/reset"
    }),
    /invalid_email_action_url/
  );
});

test("contact email escapes message HTML", () => {
  const email = buildContactEmail({
    name: "Usuario",
    email: "test@example.invalid",
    message: '<script>alert("x")</script>',
    language: "es"
  });

  assert.match(email.html, /Nuevo mensaje de contacto/);
  assert.match(email.html, /Español/);
  assert.match(email.html, /&lt;script&gt;/);
  assert.doesNotMatch(email.html, /<script>/);
});

test("contact email preserves line breaks", () => {
  const email = buildContactEmail({
    name: "Usuario",
    email: "test@example.invalid",
    message: "Primera línea\nSegunda línea"
  });

  assert.match(email.html, /white-space:pre-wrap/);
  assert.match(email.text, /Primera línea\nSegunda línea/);
});
