import test from "node:test";
import assert from "node:assert/strict";

import {
  buildEmailVerificationEmail
} from "../lib/email-messages.js";

function render(url) {
  return buildEmailVerificationEmail({
    name: "Usuario de prueba",
    language: "es",
    verificationUrl: url,
    expiryHours: 24
  });
}

test("rechaza parámetros adicionales en el enlace", () => {
  assert.throws(
    () => render(
      "https://quacker.es/?verify_token=TOKEN&next=external"
    ),
    /invalid_email_verification_url/
  );
});

test("rechaza dos parámetros de verificación", () => {
  assert.throws(
    () => render(
      "https://quacker.es/?verify_token=UNO&verify_token=DOS"
    ),
    /invalid_email_verification_url/
  );
});

test("rechaza fragmentos añadidos al enlace", () => {
  assert.throws(
    () => render(
      "https://quacker.es/?verify_token=TOKEN#fragmento"
    ),
    /invalid_email_verification_url/
  );
});

test("rechaza un token de verificación vacío", () => {
  assert.throws(
    () => render(
      "https://quacker.es/?verify_token="
    ),
    /invalid_email_verification_url/
  );
});
