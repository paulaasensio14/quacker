import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  runDbRestoreCommand
} from "../lib/db-restore-cli.js";

import {
  writeJsonFileAtomic
} from "../lib/json-db.js";

test("--list muestra los backups disponibles sin modificar la base", () => {
  const directory = fs.mkdtempSync(
    path.join(os.tmpdir(), "quacker-db-restore-cli-")
  );

  try {
    const dbPath = path.join(directory, "db.json");
    const backupName = "db.json.backup-123";

    const currentDb = {
      users: {
        current: {}
      }
    };

    writeJsonFileAtomic(dbPath, currentDb);

    fs.writeFileSync(
      path.join(directory, backupName),
      JSON.stringify(
        {
          users: {
            previous: {}
          }
        },
        null,
        2
      ),
      {
        encoding: "utf8",
        mode: 0o600
      }
    );

    const output = [];

    const exitCode = runDbRestoreCommand({
      dbPath,
      args: ["--list"],
      writeLine: (line) => output.push(line)
    });

    assert.equal(exitCode, 0);

    assert.match(
      output.join("\n"),
      new RegExp(backupName)
    );

    assert.deepEqual(
      JSON.parse(
        fs.readFileSync(dbPath, "utf8")
      ),
      currentDb
    );
  } finally {
    fs.rmSync(directory, {
      recursive: true,
      force: true
    });
  }
});

test("--restore exige confirmación explícita antes de modificar la base", () => {
  const directory = fs.mkdtempSync(
    path.join(os.tmpdir(), "quacker-db-restore-cli-confirm-")
  );

  try {
    const dbPath = path.join(directory, "db.json");
    const backupName = "db.json.backup-456";
    const backupPath = path.join(
      directory,
      backupName
    );

    const currentDb = {
      users: {
        current: {}
      }
    };

    writeJsonFileAtomic(dbPath, currentDb);

    fs.writeFileSync(
      backupPath,
      JSON.stringify(
        {
          users: {
            previous: {}
          }
        },
        null,
        2
      ),
      {
        encoding: "utf8",
        mode: 0o600
      }
    );

    const output = [];

    const exitCode = runDbRestoreCommand({
      dbPath,
      args: [
        "--restore",
        backupName
      ],
      writeLine: (line) => output.push(line)
    });

    assert.equal(exitCode, 1);

    assert.match(
      output.join("\n"),
      /--confirm/
    );

    assert.deepEqual(
      JSON.parse(
        fs.readFileSync(dbPath, "utf8")
      ),
      currentDb
    );
  } finally {
    fs.rmSync(directory, {
      recursive: true,
      force: true
    });
  }
});

test("--restore restaura el backup indicado cuando se confirma", () => {
  const directory = fs.mkdtempSync(
    path.join(os.tmpdir(), "quacker-db-restore-cli-run-")
  );

  try {
    const dbPath = path.join(directory, "db.json");
    const backupName = "db.json.backup-789";
    const backupPath = path.join(
      directory,
      backupName
    );

    writeJsonFileAtomic(dbPath, {
      users: {
        current: {}
      }
    });

    fs.writeFileSync(
      backupPath,
      JSON.stringify(
        {
          users: {
            restored: {}
          }
        },
        null,
        2
      ),
      {
        encoding: "utf8",
        mode: 0o600
      }
    );

    const output = [];

    const exitCode = runDbRestoreCommand({
      dbPath,
      args: [
        "--restore",
        backupName,
        "--confirm"
      ],
      writeLine: (line) => output.push(line)
    });

    assert.equal(exitCode, 0);

    assert.deepEqual(
      JSON.parse(
        fs.readFileSync(dbPath, "utf8")
      ),
      {
        users: {
          restored: {}
        }
      }
    );

    assert.match(
      output.join("\n"),
      /restaurad/i
    );
  } finally {
    fs.rmSync(directory, {
      recursive: true,
      force: true
    });
  }
});
