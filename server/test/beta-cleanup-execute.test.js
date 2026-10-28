import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { executeBetaCleanup } from "../lib/beta-cleanup-execute.js";

function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "quacker-beta-exec-"));
  const dbPath = path.join(root, "db.json");
  const sessionDirectory = path.join(root, ".sessions");
  const backupDirectory = path.join(root, "backups");
  const raw = JSON.stringify({ users: { beta1: {}, beta2: {} } });
  fs.writeFileSync(dbPath, raw, { mode: 0o600 });
  fs.mkdirSync(sessionDirectory, { mode: 0o700 });
  fs.writeFileSync(path.join(sessionDirectory, "session-one"), "{}");
  fs.mkdirSync(backupDirectory, { mode: 0o700 });
  const options = {
    dbPath, sessionDirectory, backupDirectory,
    expectedUsers: 2,
    expectedSha256: crypto.createHash("sha256").update(raw).digest("hex"),
    confirmation: "DELETE_ALL_BETA_USERS",
    serviceStopped: true
  };
  return {
    options, raw,
    cleanup: () => fs.rmSync(root, { recursive: true, force: true })
  };
}

test("limpia una base ficticia con backup y sesiones en cuarentena", () => {
  const f = fixture();
  try {
    const report = executeBetaCleanup(f.options);
    assert.equal(report.removedUsers, 2);
    assert.equal(report.invalidatedSessionFiles, 1);
    assert.deepEqual(
      JSON.parse(fs.readFileSync(f.options.dbPath, "utf8")),
      { users: {} }
    );
    assert.deepEqual(fs.readdirSync(f.options.sessionDirectory), []);
    assert.equal(
      fs.readFileSync(path.join(report.quarantineDirectory, "session-one"), "utf8"),
      "{}"
    );
    assert.equal(
      fs.readFileSync(path.join(f.options.backupDirectory, report.backupName), "utf8"),
      f.raw
    );
  } finally {
    f.cleanup();
  }
});

test("no toca datos sin confirmación, servicio detenido o huella correcta", () => {
  const f = fixture();
  try {
    for (const changes of [
      { confirmation: "" },
      { serviceStopped: false },
      { expectedSha256: "0".repeat(64) }
    ]) {
      assert.throws(() => executeBetaCleanup({ ...f.options, ...changes }));
    }
    assert.equal(fs.readFileSync(f.options.dbPath, "utf8"), f.raw);
    assert.deepEqual(fs.readdirSync(f.options.sessionDirectory), ["session-one"]);
    assert.deepEqual(fs.readdirSync(f.options.backupDirectory), []);
  } finally {
    f.cleanup();
  }
});

test("rechaza un directorio de backup inseguro", () => {
  const f = fixture();
  try {
    fs.chmodSync(f.options.backupDirectory, 0o755);
    assert.throws(
      () => executeBetaCleanup(f.options),
      { code: "INSECURE_BACKUP_DIRECTORY" }
    );
    assert.equal(fs.readFileSync(f.options.dbPath, "utf8"), f.raw);
  } finally {
    f.cleanup();
  }
});

test("si falla la escritura recupera sesiones y conserva los usuarios", () => {
  const f = fixture();
  try {
    assert.throws(() => executeBetaCleanup({
      ...f.options,
      writeDatabase: () => {
        const error = new Error("Fallo simulado");
        error.code = "SIMULATED_WRITE_FAILURE";
        throw error;
      }
    }), { code: "SIMULATED_WRITE_FAILURE" });
    assert.equal(fs.readFileSync(f.options.dbPath, "utf8"), f.raw);
    assert.deepEqual(fs.readdirSync(f.options.sessionDirectory), ["session-one"]);
    assert.equal(fs.readdirSync(f.options.backupDirectory).length, 1);
  } finally {
    f.cleanup();
  }
});
