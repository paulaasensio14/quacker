import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { inspectBetaSessions, planBetaCleanup } from "../lib/beta-cleanup-plan.js";

function fixture(data = { users: { beta1: {}, beta2: {} } }) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "quacker-beta-plan-"));
  const dbPath = path.join(directory, "db.json");
  const sessionDirectory = path.join(directory, ".sessions");
  fs.mkdirSync(sessionDirectory, { mode: 0o700 });
  fs.writeFileSync(path.join(sessionDirectory, "session-one"), "{}");
  const raw = JSON.stringify(data);
  fs.writeFileSync(dbPath, raw, { mode: 0o600 });
  return {
    dbPath,
    sessionDirectory,
    raw,
    sha256: crypto.createHash("sha256").update(raw).digest("hex"),
    cleanup: () => fs.rmSync(directory, { recursive: true, force: true })
  };
}

test("planifica sin modificar la base", () => {
  const f = fixture();
  try {
    const report = planBetaCleanup({
      dbPath: f.dbPath, sessionDirectory: f.sessionDirectory, expectedUsers: 2, expectedSha256: f.sha256
    });
    assert.deepEqual(report, {
      mode: "dry-run", usersToRemove: 2, usersRemaining: 0, sessionFiles: 1, sha256: f.sha256
    });
    assert.equal(fs.readFileSync(f.dbPath, "utf8"), f.raw);
  } finally {
    f.cleanup();
  }
});

test("rechaza conteos y huellas no válidos", () => {
  const f = fixture();
  try {
    assert.throws(() => planBetaCleanup({
      dbPath: f.dbPath, sessionDirectory: f.sessionDirectory, expectedUsers: 0, expectedSha256: f.sha256
    }), { code: "INVALID_EXPECTED_USERS" });
    assert.throws(() => planBetaCleanup({
      dbPath: f.dbPath, sessionDirectory: f.sessionDirectory, expectedUsers: 2, expectedSha256: "wrong"
    }), { code: "INVALID_EXPECTED_SHA256" });
    assert.throws(() => planBetaCleanup({
      dbPath: f.dbPath, sessionDirectory: f.sessionDirectory, expectedUsers: 2, expectedSha256: "0".repeat(64)
    }), { code: "DATABASE_CHANGED" });
    assert.throws(() => planBetaCleanup({
      dbPath: f.dbPath, sessionDirectory: f.sessionDirectory, expectedUsers: 3, expectedSha256: f.sha256
    }), { code: "USER_COUNT_CHANGED" });
  } finally {
    f.cleanup();
  }
});

test("rechaza colecciones raíz fuera del alcance", () => {
  const f = fixture({ users: { beta1: {} }, moderationReports: [] });
  try {
    assert.throws(() => planBetaCleanup({
      dbPath: f.dbPath, sessionDirectory: f.sessionDirectory, expectedUsers: 1, expectedSha256: f.sha256
    }), { code: "UNREVIEWED_ROOT_COLLECTIONS" });
    assert.equal(fs.readFileSync(f.dbPath, "utf8"), f.raw);
  } finally {
    f.cleanup();
  }
});

test("cuenta sesiones sin modificarlas y rechaza enlaces simbólicos", () => {
  const f = fixture();
  try {
    assert.deepEqual(inspectBetaSessions(f.sessionDirectory), { sessionFiles: 1 });
    assert.equal(fs.readFileSync(path.join(f.sessionDirectory, "session-one"), "utf8"), "{}");
    fs.symlinkSync(f.dbPath, path.join(f.sessionDirectory, "unexpected"));
    assert.throws(() => inspectBetaSessions(f.sessionDirectory), {
      code: "UNEXPECTED_SESSION_ENTRY"
    });
  } finally {
    f.cleanup();
  }
});
