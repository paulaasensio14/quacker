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
    passwordSalt: "salt-test",
    passwordHash: "hash-test",
    now: () => NOW,
    randomBytes: size => Buffer.alloc(size, 11)
  });

  let writes = 0;

  const readDb = () => structuredClone(stored);

  const writeDb = next => {
    writes++;
    stored = structuredClone(next);
  };

  const createUser = (db, registration) => {
    const id = "u_concurrency";

    db.users[id] = {
      profile: {
        id,
        email: registration.email
      },
      auth: {
        passwordSalt: registration.passwordSalt,
        passwordHash: registration.passwordHash,
        authVersion: 1
      }
    };

    return id;
  };

  return {
    token,
    readDb,
    writeDb,
    createUser,
    getStored: () => structuredClone(stored),
    getWrites: () => writes,
    replaceStored: next => {
      stored = structuredClone(next);
    }
  };
}

test("dos confirmaciones consecutivas solo activan una cuenta", () => {
  const f = fixture();

  const first = commitVerifiedRegistration({
    ...f,
    now: () => NOW + 1000
  });

  const second = commitVerifiedRegistration({
    ...f,
    now: () => NOW + 1000
  });

  assert.equal(first.ok, true);
  assert.equal(second.ok, false);
  assert.equal(f.getWrites(), 1);
  assert.equal(Object.keys(f.getStored().users).length, 1);
});

test("rechaza un callback de creación asíncrono", () => {
  const f = fixture();

  assert.throws(
    () => commitVerifiedRegistration({
      ...f,
      createUser: async () => "u_async",
      now: () => NOW + 1000
    }),
    /cuenta|usuario|síncron/i
  );

  assert.equal(f.getWrites(), 0);
  assert.equal(Object.keys(f.getStored().users).length, 0);
});

test("rechaza un callback de escritura asíncrono", () => {
  const f = fixture();

  assert.throws(
    () => commitVerifiedRegistration({
      ...f,
      writeDb: async () => {},
      now: () => NOW + 1000
    }),
    /escritura|síncron/i
  );

  assert.equal(f.getWrites(), 0);
});
