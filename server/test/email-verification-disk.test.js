import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  createPendingRegistration
} from "../lib/email-verification.js";

import {
  commitVerifiedRegistration
} from "../lib/email-verification-commit.js";

import {
  readJsonFile,
  writeJsonFileAtomic
} from "../lib/json-db.js";

import {
  validateDb
} from "../lib/db-schema.js";

const NOW = 1_800_000_000_000;

function withTemporaryDatabase(callback) {
  const dir = fs.mkdtempSync(
    path.join(os.tmpdir(), "quacker-email-disk-")
  );

  const file = path.join(dir, "db.json");

  try {
    const db = {
      users: {},
      pendingRegistrations: {}
    };

    const { token } = createPendingRegistration({
      db,
      email: "test@example.com",
      name: "Usuario de prueba",
      language: "es",
      passwordSalt: "salt-test",
      passwordHash: "hash-test",
      now: () => NOW,
      randomBytes: size => Buffer.alloc(size, 8)
    });

    writeJsonFileAtomic(file, db);

    const readDb = () => readJsonFile(file, {
      validate: validateDb
    });

    const writeDb = nextDb =>
      writeJsonFileAtomic(file, nextDb);

    const createUser = (nextDb, registration) => {
      const userId = "u_disk_verified";

      if (Object.hasOwn(nextDb.users, userId)) {
        throw new Error("duplicate_user_id");
      }

      nextDb.users[userId] = {
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

    return callback({
      file,
      token,
      readDb,
      writeDb,
      createUser
    });
  } finally {
    fs.rmSync(dir, {
      recursive: true,
      force: true
    });
  }
}

function confirm(fixture, overrides = {}) {
  return commitVerifiedRegistration({
    readDb: fixture.readDb,
    writeDb: fixture.writeDb,
    createUser: fixture.createUser,
    token: fixture.token,
    now: () => NOW + 1000,
    ...overrides
  });
}

test("disco: guarda cuenta y consumo del token juntos", () => {
  withTemporaryDatabase(fixture => {
    const result = confirm(fixture);
    const saved = fixture.readDb();

    assert.equal(result.ok, true);
    assert.equal(result.userId, "u_disk_verified");

    assert.equal(
      saved.users.u_disk_verified.profile.email,
      "test@example.com"
    );

    assert.deepEqual(
      saved.pendingRegistrations,
      {}
    );

    assert.equal(
      JSON.stringify(saved).includes(fixture.token),
      false
    );
  });
});

test("disco: fallo de escritura conserva los datos originales", () => {
  withTemporaryDatabase(fixture => {
    const before = fs.readFileSync(
      fixture.file,
      "utf8"
    );

    assert.throws(
      () => confirm(fixture, {
        writeDb: () => {
          throw new Error("simulated_write_failure");
        }
      }),
      /simulated_write_failure/
    );

    const after = fs.readFileSync(
      fixture.file,
      "utf8"
    );

    assert.equal(after, before);

    assert.deepEqual(
      fixture.readDb().users,
      {}
    );

    assert.equal(
      Object.keys(
        fixture.readDb().pendingRegistrations
      ).length,
      1
    );
  });
});

test("disco: el token no puede reutilizarse tras guardar", () => {
  withTemporaryDatabase(fixture => {
    assert.equal(confirm(fixture).ok, true);

    const before = fs.readFileSync(
      fixture.file,
      "utf8"
    );

    const repeated = confirm(fixture);

    assert.equal(repeated.ok, false);

    assert.equal(
      fs.readFileSync(fixture.file, "utf8"),
      before
    );

    assert.equal(
      Object.keys(fixture.readDb().users).length,
      1
    );
  });
});

test("disco: fallo al crear usuario no modifica el archivo", () => {
  withTemporaryDatabase(fixture => {
    const before = fs.readFileSync(
      fixture.file,
      "utf8"
    );

    assert.throws(
      () => confirm(fixture, {
        createUser: () => {
          throw new Error("simulated_user_creation_failure");
        }
      }),
      /simulated_user_creation_failure/
    );

    assert.equal(
      fs.readFileSync(fixture.file, "utf8"),
      before
    );

    assert.equal(
      Object.keys(
        fixture.readDb().pendingRegistrations
      ).length,
      1
    );
  });
});
