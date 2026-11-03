import test from "node:test";
import assert from "node:assert/strict";

import {
  createPendingRegistration
} from "../lib/email-verification.js";

import {
  commitVerifiedRegistration
} from "../lib/email-verification-commit.js";

const NOW = 1_800_000_000_000;

function fixture() {
  let stored = {
    users: {},
    pendingRegistrations: {}
  };

  const { token } = createPendingRegistration({
    db: stored,
    email: "test@example.com",
    name: "Usuario de prueba",
    language: "es",
    passwordSalt: "salt-test",
    passwordHash: "hash-test",
    now: () => NOW,
    randomBytes: size => Buffer.alloc(size, 9)
  });

  let writes = 0;

  const readDb = () => structuredClone(stored);

  const writeDb = nextDb => {
    writes += 1;
    stored = structuredClone(nextDb);
  };

  const createUser = (db, registration) => {
    const userId = "u_verified_test";

    if (Object.hasOwn(db.users, userId)) {
      throw new Error("duplicate_user_id");
    }

    db.users[userId] = {
      profile: {
        id: userId,
        email: registration.email,
        name: registration.name,
        language: registration.language
      },
      auth: {
        passwordSalt: registration.passwordSalt,
        passwordHash: registration.passwordHash,
        authVersion: 1
      }
    };

    return userId;
  };

  return {
    token,
    readDb,
    writeDb,
    createUser,
    getStored: () => structuredClone(stored),
    getWrites: () => writes,
    setStored: value => {
      stored = structuredClone(value);
    }
  };
}

function confirm(f, overrides = {}) {
  return commitVerifiedRegistration({
    readDb: f.readDb,
    writeDb: f.writeDb,
    createUser: f.createUser,
    token: f.token,
    now: () => NOW + 1000,
    ...overrides
  });
}

test("activa la cuenta y consume el token en una escritura", () => {
  const f = fixture();

  const result = confirm(f);
  const stored = f.getStored();

  assert.equal(result.ok, true);
  assert.equal(result.userId, "u_verified_test");
  assert.equal(f.getWrites(), 1);

  assert.equal(
    stored.users.u_verified_test.profile.email,
    "test@example.com"
  );

  assert.deepEqual(stored.pendingRegistrations, {});
});

test("un error de escritura conserva el registro pendiente", () => {
  const f = fixture();

  const before = f.getStored();

  assert.throws(
    () => confirm(f, {
      writeDb: () => {
        throw new Error("simulated_disk_failure");
      }
    }),
    /simulated_disk_failure/
  );

  assert.deepEqual(f.getStored(), before);
  assert.equal(f.getWrites(), 0);
});

test("un token incorrecto no escribe ni crea cuentas", () => {
  const f = fixture();

  const before = f.getStored();

  const result = confirm(f, {
    token: "TOKEN_INVALIDO"
  });

  assert.equal(result.ok, false);
  assert.equal(f.getWrites(), 0);
  assert.deepEqual(f.getStored(), before);
});

test("un token utilizado no puede crear una segunda cuenta", () => {
  const f = fixture();

  const first = confirm(f);
  assert.equal(first.ok, true);

  const second = confirm(f);

  assert.equal(second.ok, false);
  assert.equal(f.getWrites(), 1);

  assert.equal(
    Object.keys(f.getStored().users).length,
    1
  );
});

test("rechaza el correo si ya existe una cuenta activa", () => {
  const f = fixture();

  const stored = f.getStored();

  stored.users.u_existing = {
    profile: {
      id: "u_existing",
      email: "TEST@example.com"
    }
  };

  f.setStored(stored);

  const before = f.getStored();

  const result = confirm(f);

  assert.equal(result.ok, false);
  assert.equal(f.getWrites(), 0);
  assert.deepEqual(f.getStored(), before);
});
