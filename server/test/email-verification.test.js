import test from "node:test";
import assert from "node:assert/strict";

import {
  EMAIL_VERIFICATION_TTL_MS,
  createPendingRegistration,
  verifyPendingRegistration,
  pruneExpiredRegistrations
} from "../lib/email-verification.js";

const HOUR = 60 * 60 * 1000;
const NOW = 1_800_000_000_000;

function createDb() {
  return {
    users: {},
    pendingRegistrations: {}
  };
}

function createRequest(db, overrides = {}) {
  return createPendingRegistration({
    db,
    email: "Test@Example.com",
    name: "Usuario de prueba",
    language: "es",
    passwordSalt: "salt-ficticio",
    passwordHash: "hash-ficticio",
    now: () => NOW,
    randomBytes: size => Buffer.alloc(size, 7),
    ...overrides
  });
}

test("la verificación caduca a las 24 horas", () => {
  assert.equal(
    EMAIL_VERIFICATION_TTL_MS,
    24 * HOUR
  );
});

test("crear solicitud no crea una cuenta activa", () => {
  const db = createDb();

  const result = createRequest(db);

  assert.deepEqual(db.users, {});
  assert.equal(typeof result.token, "string");
  assert.ok(result.token.length >= 32);

  assert.equal(
    Object.keys(db.pendingRegistrations).length,
    1
  );
});

test("solo se guarda el hash del token", () => {
  const db = createDb();
  const { token } = createRequest(db);

  const serialized = JSON.stringify(db);

  assert.ok(!serialized.includes(token));
  assert.ok(!serialized.includes("token-ficticio"));

  const pending = Object.values(
    db.pendingRegistrations
  )[0];

  assert.match(pending.tokenHash, /^[a-f0-9]{64}$/);
  assert.equal(pending.email, "test@example.com");
  assert.equal(
    pending.expiresAt,
    NOW + EMAIL_VERIFICATION_TTL_MS
  );
});

test("un token correcto confirma una sola vez", () => {
  const db = createDb();
  const { token } = createRequest(db);

  const first = verifyPendingRegistration({
    db,
    token,
    now: () => NOW + 1000
  });

  assert.equal(first.ok, true);
  assert.equal(
    first.registration.email,
    "test@example.com"
  );

  const second = verifyPendingRegistration({
    db,
    token,
    now: () => NOW + 2000
  });

  assert.equal(second.ok, false);
});

test("un token incorrecto no confirma la solicitud", () => {
  const db = createDb();
  createRequest(db);

  const result = verifyPendingRegistration({
    db,
    token: "incorrecto",
    now: () => NOW + 1000
  });

  assert.equal(result.ok, false);

  assert.equal(
    Object.keys(db.pendingRegistrations).length,
    1
  );
});

test("un token caducado se rechaza", () => {
  const db = createDb();
  const { token } = createRequest(db);

  const result = verifyPendingRegistration({
    db,
    token,
    now: () => NOW + EMAIL_VERIFICATION_TTL_MS
  });

  assert.equal(result.ok, false);
});

test("se eliminan solicitudes expiradas", () => {
  const db = createDb();
  createRequest(db);

  const removed = pruneExpiredRegistrations({
    db,
    now: () => NOW + EMAIL_VERIFICATION_TTL_MS
  });

  assert.equal(removed, 1);
  assert.deepEqual(db.pendingRegistrations, {});
});

test("no se guarda la contraseña en texto plano", () => {
  const db = createDb();

  createRequest(db);

  const stored = Object.values(
    db.pendingRegistrations
  )[0];

  assert.equal(
    stored.passwordHash,
    "hash-ficticio"
  );

  assert.equal(
    stored.passwordSalt,
    "salt-ficticio"
  );

  assert.equal(
    Object.hasOwn(stored, "password"),
    false
  );
});
