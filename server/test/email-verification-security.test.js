import test from "node:test";
import assert from "node:assert/strict";

import {
  createPendingRegistration,
  verifyPendingRegistration,
  EMAIL_VERIFICATION_TTL_MS
} from "../lib/email-verification.js";

const NOW = 1_800_000_000_000;

function db() {
  return {
    users: {},
    pendingRegistrations: {}
  };
}

function create(database, overrides = {}) {
  return createPendingRegistration({
    db: database,
    email: "test@example.com",
    name: "Usuario de prueba",
    language: "es",
    passwordSalt: "salt-test",
    passwordHash: "hash-test",
    now: () => NOW,
    randomBytes: size => Buffer.alloc(size, 3),
    ...overrides
  });
}

test("rechaza registrar un correo ya asociado a una cuenta", () => {
  const database = db();

  database.users.u1 = {
    profile: {
      email: "TEST@example.com"
    }
  };

  assert.throws(
    () => create(database),
    error => error.code === "email_in_use"
  );

  assert.equal(
    Object.keys(database.pendingRegistrations).length,
    0
  );
});

test("impide duplicar una solicitud vigente", () => {
  const database = db();

  create(database);

  const before = JSON.stringify(database);

  assert.throws(
    () => create(database, {
      email: "TEST@EXAMPLE.COM"
    }),
    error => error.code === "verification_pending"
  );

  assert.equal(JSON.stringify(database), before);
});

test("permite sustituir una solicitud caducada", () => {
  const database = db();

  create(database);

  const replacement = create(database, {
    now: () => NOW + EMAIL_VERIFICATION_TTL_MS,
    randomBytes: size => Buffer.alloc(size, 4)
  });

  assert.equal(typeof replacement.token, "string");
});

test("un token antiguo no activa una solicitud nueva", () => {
  const database = db();

  const first = create(database);

  const second = create(database, {
    now: () => NOW + EMAIL_VERIFICATION_TTL_MS,
    randomBytes: size => Buffer.alloc(size, 4)
  });

  const oldResult = verifyPendingRegistration({
    db: database,
    token: first.token,
    now: () => NOW + EMAIL_VERIFICATION_TTL_MS + 1
  });

  assert.equal(oldResult.ok, false);

  const newResult = verifyPendingRegistration({
    db: database,
    token: second.token,
    now: () => NOW + EMAIL_VERIFICATION_TTL_MS + 1
  });

  assert.equal(newResult.ok, true);
});

test("rechaza una solicitud con credenciales almacenadas corruptas", () => {
  const database = db();

  const { token } = create(database);

  const pending = Object.values(
    database.pendingRegistrations
  )[0];

  delete pending.passwordHash;

  const result = verifyPendingRegistration({
    db: database,
    token,
    now: () => NOW + 1
  });

  assert.equal(result.ok, false);
});

test("rechaza una solicitud cuyo correo almacenado es inválido", () => {
  const database = db();

  const { token } = create(database);

  const pending = Object.values(
    database.pendingRegistrations
  )[0];

  pending.email = "correo-invalido";

  const result = verifyPendingRegistration({
    db: database,
    token,
    now: () => NOW + 1
  });

  assert.equal(result.ok, false);
});

test("un token incorrecto no elimina una solicitud válida", () => {
  const database = db();

  create(database);

  const before = JSON.stringify(database);

  const result = verifyPendingRegistration({
    db: database,
    token: "x".repeat(43),
    now: () => NOW + 1
  });

  assert.equal(result.ok, false);
  assert.equal(JSON.stringify(database), before);
});


test("sustituir una solicitud caducada elimina la anterior", () => {
  const database = db();

  const first = create(database);

  const second = create(database, {
    now: () => NOW + EMAIL_VERIFICATION_TTL_MS,
    randomBytes: size => Buffer.alloc(size, 4)
  });

  const pending = Object.values(
    database.pendingRegistrations
  );

  assert.equal(pending.length, 1);
  assert.equal(pending[0].tokenHash, second.requestId);

  assert.equal(
    Object.hasOwn(database.pendingRegistrations, first.requestId),
    false
  );
});

test("una solicitud caducada no elimina otra vigente", () => {
  const database = db();

  create(database, {
    email: "primero@example.com"
  });

  create(database, {
    email: "segundo@example.com",
    now: () => NOW + EMAIL_VERIFICATION_TTL_MS - 1000,
    randomBytes: size => Buffer.alloc(size, 5)
  });

  create(database, {
    email: "primero@example.com",
    now: () => NOW + EMAIL_VERIFICATION_TTL_MS,
    randomBytes: size => Buffer.alloc(size, 6)
  });

  const emails = Object.values(
    database.pendingRegistrations
  ).map(pending => pending.email);

  assert.deepEqual(
    emails.sort(),
    [
      "primero@example.com",
      "segundo@example.com"
    ]
  );
});

test("una solicitud nueva rechaza reutilizar el mismo token", () => {
  const database = db();

  create(database);

  assert.throws(
    () => create(database, {
      email: "otro@example.com"
    }),
    /Colisión de identificador/
  );

  assert.equal(
    Object.keys(database.pendingRegistrations).length,
    1
  );
});
