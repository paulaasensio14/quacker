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
    users: {
      u_existing: {
        profile: {
          id: "u_existing",
          email: "existing@example.com",
          name: "Usuario existente"
        },
        auth: {
          passwordSalt: "existing-salt",
          passwordHash: "existing-hash",
          authVersion: 1
        }
      }
    },
    pendingRegistrations: {}
  };

  const { token } = createPendingRegistration({
    db: stored,
    email: "nuevo@example.com",
    name: "Usuario nuevo",
    language: "es",
    passwordSalt: "new-salt",
    passwordHash: "new-hash",
    now: () => NOW,
    randomBytes: size => Buffer.alloc(size, 12)
  });

  createPendingRegistration({
    db: stored,
    email: "tercero@example.com",
    name: "Usuario tercero",
    language: "es",
    passwordSalt: "third-salt",
    passwordHash: "third-hash",
    now: () => NOW,
    randomBytes: size => Buffer.alloc(size, 13)
  });

  let writes = 0;

  return {
    token,
    readDb: () => structuredClone(stored),
    writeDb: next => {
      writes++;
      stored = structuredClone(next);
    },
    getStored: () => structuredClone(stored),
    getWrites: () => writes
  };
}

function createValidUser(db, registration) {
  const id = "u_new";

  db.users[id] = {
    profile: {
      id,
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

  return id;
}

function confirm(fixture, createUser) {
  return commitVerifiedRegistration({
    readDb: fixture.readDb,
    writeDb: fixture.writeDb,
    token: fixture.token,
    createUser,
    now: () => NOW + 1000
  });
}

test("rechaza alterar otra cuenta durante la activación", () => {
  const f = fixture();
  const before = f.getStored();

  assert.throws(
    () => confirm(f, (db, registration) => {
      delete db.users.u_existing;
      return createValidUser(db, registration);
    })
  );

  assert.equal(f.getWrites(), 0);
  assert.deepEqual(f.getStored(), before);
});

test("rechaza alterar solicitudes pendientes de terceros", () => {
  const f = fixture();
  const before = f.getStored();

  assert.throws(
    () => confirm(f, (db, registration) => {
      db.pendingRegistrations = {};
      return createValidUser(db, registration);
    })
  );

  assert.equal(f.getWrites(), 0);
  assert.deepEqual(f.getStored(), before);
});

test("rechaza crear la cuenta sin las credenciales correctas", () => {
  const f = fixture();
  const before = f.getStored();

  assert.throws(
    () => confirm(f, (db, registration) => {
      const id = createValidUser(db, registration);
      delete db.users[id].auth.passwordHash;
      return id;
    })
  );

  assert.equal(f.getWrites(), 0);
  assert.deepEqual(f.getStored(), before);
});

test("una activación legítima conserva los demás datos", () => {
  const f = fixture();
  const before = f.getStored();

  const result = confirm(f, createValidUser);

  assert.equal(result.ok, true);
  assert.equal(result.userId, "u_new");
  assert.equal(f.getWrites(), 1);

  const after = f.getStored();

  assert.deepEqual(
    after.users.u_existing,
    before.users.u_existing
  );

  const thirdBefore = Object.entries(
    before.pendingRegistrations
  ).find(([, pending]) =>
    pending.email === "tercero@example.com"
  );

  assert.ok(thirdBefore);

  assert.deepEqual(
    after.pendingRegistrations[thirdBefore[0]],
    thirdBefore[1]
  );
});
