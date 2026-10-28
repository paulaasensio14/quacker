import assert from "node:assert/strict";
import crypto from "node:crypto";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  createJsonFileBackup
} from "../lib/json-db.js";

import {
  validateDb
} from "../lib/db-schema.js";

import {
  runDbRestoreCommand
} from "../lib/db-restore-cli.js";

test("recupera datos ficticios tras una interrupción brusca", () => {
  const root = fs.mkdtempSync(
    path.join(os.tmpdir(), "quacker-beta-interrupt-")
  );

  try {
    const dbPath = path.join(root, "db.json");
    const sessions = path.join(root, ".sessions");
    const quarantine = path.join(root, ".sessions.beta-cleanup-test");
    const backups = path.join(root, "backups");

    const original = JSON.stringify({
      users: {
        beta1: { profile: { name: "Prueba" } },
        beta2: { profile: { name: "Otra prueba" } }
      }
    });

    fs.writeFileSync(dbPath, original, {
      mode: 0o600
    });

    fs.mkdirSync(sessions, {
      mode: 0o700
    });

    fs.mkdirSync(backups, {
      mode: 0o700
    });

    fs.writeFileSync(
      path.join(sessions, "session-test"),
      JSON.stringify({ userId: "beta1" }),
      { mode: 0o600 }
    );

    const backup = createJsonFileBackup(
      dbPath,
      backups,
      { validate: validateDb }
    );

    const childCode = `
      import fs from "node:fs";

      const [dbPath, sessions, quarantine] =
        process.argv.slice(1);

      fs.renameSync(sessions, quarantine);
      fs.mkdirSync(sessions, { mode: 0o700 });
      fs.writeFileSync(dbPath, '{"users":');

      process.kill(process.pid, "SIGKILL");
    `;

    const interrupted = spawnSync(
      process.execPath,
      [
        "--input-type=module",
        "-e",
        childCode,
        dbPath,
        sessions,
        quarantine
      ],
      {
        timeout: 5000,
        encoding: "utf8"
      }
    );

    assert.equal(
      interrupted.signal,
      "SIGKILL",
      interrupted.stderr
    );

    assert.throws(() =>
      JSON.parse(fs.readFileSync(dbPath, "utf8"))
    );

    assert.equal(
      fs.existsSync(quarantine),
      true
    );

    const stagedBackup = path.join(
      root,
      backup.name
    );

    fs.copyFileSync(backup.path, stagedBackup);
    fs.chmodSync(stagedBackup, 0o600);

    const backupSha = crypto
      .createHash("sha256")
      .update(fs.readFileSync(stagedBackup))
      .digest("hex");

    const originalSha = crypto
      .createHash("sha256")
      .update(original)
      .digest("hex");

    assert.equal(backupSha, originalSha);

    const restoreCode = runDbRestoreCommand({
      dbPath,
      args: [
        "--restore",
        backup.name,
        "--confirm"
      ],
      writeLine: () => {}
    });

    assert.equal(restoreCode, 0);

    assert.deepEqual(
      JSON.parse(fs.readFileSync(dbPath, "utf8")),
      JSON.parse(original)
    );

    assert.deepEqual(
      fs.readdirSync(sessions),
      []
    );

    fs.rmdirSync(sessions);
    fs.renameSync(quarantine, sessions);

    assert.equal(
      JSON.parse(
        fs.readFileSync(
          path.join(sessions, "session-test"),
          "utf8"
        )
      ).userId,
      "beta1"
    );
  } finally {
    fs.rmSync(root, {
      recursive: true,
      force: true
    });
  }
});
