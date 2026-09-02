import assert from "node:assert/strict";
import test from "node:test";

import {
  createInitialDb,
  validateDb
} from "../lib/db-schema.js";

test("crea una base de datos inicial válida", () => {
  const db = createInitialDb();

  assert.deepEqual(db, {
    users: {}
  });

  assert.equal(validateDb(db), db);
});

test("rechaza una base de datos sin users válido", () => {
  assert.throws(
    () => validateDb({}),
    (error) => {
      assert.equal(
        error.code,
        "INVALID_DATABASE_STRUCTURE"
      );

      return true;
    }
  );
});
