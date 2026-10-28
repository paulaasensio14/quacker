import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  executeBetaCleanup
} from "../lib/beta-cleanup-execute.js";

import {
  runDbRestoreCommand
} from "../lib/db-restore-cli.js";

test("ensaya limpieza y recuperación completa en entorno aislado", () => {
  const root = fs.mkdtempSync(
    path.join(os.tmpdir(), "quacker-beta-recovery-")
  );

  try {
    const dbPath = path.join(root, "db.json");
    const sessionDirectory = path.join(root, ".sessions");
    const backupDirectory = path.join(root, "backups");

    const original = JSON.stringify({
      users: {
        beta1: {
          profile: { name: "Cuenta ficticia" }
        },
        beta2: {
          profile: { name: "Otra cuenta ficticia" }
        }
      }
    });

    fs.writeFileSync(dbPath, original, {
      mode: 0o600
    });

    fs.mkdirSync(sessionDirectory, {
      mode: 0o700
    });

    fs.mkdirSync(backupDirectory, {
      mode: 0o700
    });

    fs.writeFileSync(
      path.join(sessionDirectory, "session-test"),
      JSON.stringify({ userId: "beta1" }),
      { mode: 0o600 }
    );

    const expectedSha256 = crypto
      .createHash("sha256")
      .update(original)
      .digest("hex");

    const cleanup = executeBetaCleanup({
      dbPath,
      sessionDirectory,
      backupDirectory,
      expectedUsers: 2,
      expectedSha256,
      confirmation: "DELETE_ALL_BETA_USERS",
      serviceStopped: true,
      productionCheck: () => true
    });

    assert.deepEqual(
      JSON.parse(fs.readFileSync(dbPath, "utf8")),
      { users: {} }
    );

    const externalBackup = path.join(
      backupDirectory,
      cleanup.backupName
    );

    const stagedBackup = path.join(
      root,
      cleanup.backupName
    );

    fs.copyFileSync(externalBackup, stagedBackup);
    fs.chmodSync(stagedBackup, 0o600);

    assert.equal(
      fs.readFileSync(stagedBackup, "utf8"),
      original
    );

    const output = [];

    const restoreCode = runDbRestoreCommand({
      dbPath,
      args: [
        "--restore",
        cleanup.backupName,
        "--confirm"
      ],
      writeLine: (line) => output.push(line)
    });

    assert.equal(restoreCode, 0, output.join("\n"));

    const restored = JSON.parse(
      fs.readFileSync(dbPath, "utf8")
    );

    assert.deepEqual(
      restored,
      JSON.parse(original)
    );

    assert.deepEqual(
      fs.readdirSync(sessionDirectory),
      []
    );

    fs.rmdirSync(sessionDirectory);

    fs.renameSync(
      cleanup.quarantineDirectory,
      sessionDirectory
    );

    assert.equal(
      JSON.parse(
        fs.readFileSync(
          path.join(sessionDirectory, "session-test"),
          "utf8"
        )
      ).userId,
      "beta1"
    );

    assert.equal(
      fs.statSync(dbPath).mode & 0o777,
      0o600
    );
  } finally {
    fs.rmSync(root, {
      recursive: true,
      force: true
    });
  }
});
