import test from "node:test";
import assert from "node:assert/strict";

import {
  createInitialDb,
  validateDb
} from "../lib/db-schema.js";

test("conserva compatibilidad con bases de datos antiguas", () => {
  const db = createInitialDb();

  assert.doesNotThrow(() => validateDb(db));
  assert.deepEqual(db.users, {});

  const legacyDb = {
    users: {},
    moderationReports: []
  };

  assert.doesNotThrow(() => validateDb(legacyDb));
});

test("acepta solicitudes pendientes válidas", () => {
  const db = {
    users: {},
    pendingRegistrations: {}
  };

  assert.equal(validateDb(db), db);
});

test("rechaza estructuras pendientes incorrectas", () => {
  for (const invalid of [
    null,
    [],
    "incorrecto",
    123,
    true
  ]) {
    const db = {
      users: {},
      pendingRegistrations: invalid
    };

    assert.throws(
      () => validateDb(db),
      { code: "INVALID_DATABASE_STRUCTURE" }
    );
  }
});

test("conserva otros datos sin modificarlos", () => {
  const db = {
    users: {
      existing: {
        profile: {
          email: "existing@example.test"
        }
      }
    },
    pendingRegistrations: {
      request1: {
        email: "pending@example.test"
      }
    },
    moderationReports: [],
    customMetadata: {
      version: 1
    }
  };

  const original = structuredClone(db);

  assert.equal(validateDb(db), db);
  assert.deepEqual(db, original);
});
