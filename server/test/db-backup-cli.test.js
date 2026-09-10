import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  runDbBackupCommand
} from "../lib/db-backup-cli.js";

import {
  writeJsonFileAtomic
} from "../lib/json-db.js";

test("exige indicar un directorio de destino", () => {
  const directory = fs.mkdtempSync(
    path.join(os.tmpdir(), "quacker-db-backup-cli-directory-")
  );

  try {
    const dbPath = path.join(directory, "db.json");

    writeJsonFileAtomic(dbPath, {
      users: {}
    });

    const output = [];

    const exitCode = runDbBackupCommand({
      dbPath,
      args: [],
      writeLine: (line) => output.push(line)
    });

    assert.equal(exitCode, 1);
    assert.match(
      output.join("\n"),
      /--directory/
    );
  } finally {
    fs.rmSync(directory, {
      recursive: true,
      force: true
    });
  }
});

test("crea un backup válido en el directorio indicado", () => {
  const directory = fs.mkdtempSync(
    path.join(os.tmpdir(), "quacker-db-backup-cli-run-")
  );

  try {
    const dbPath = path.join(directory, "db.json");
    const backupDirectory = path.join(
      directory,
      "backups"
    );

    writeJsonFileAtomic(dbPath, {
      users: {
        current: {}
      }
    });

    const output = [];

    const exitCode = runDbBackupCommand({
      dbPath,
      args: [
        "--directory",
        backupDirectory
      ],
      writeLine: (line) => output.push(line)
    });

    assert.equal(exitCode, 0);

    const backups = fs.readdirSync(
      backupDirectory
    );

    assert.equal(backups.length, 1);
    assert.match(
      backups[0],
      /^db\.json\.backup-/
    );

    assert.deepEqual(
      JSON.parse(
        fs.readFileSync(
          path.join(
            backupDirectory,
            backups[0]
          ),
          "utf8"
        )
      ),
      {
        users: {
          current: {}
        }
      }
    );

    assert.match(
      output.join("\n"),
      /Backup creado/
    );
  } finally {
    fs.rmSync(directory, {
      recursive: true,
      force: true
    });
  }
});

test("rechaza un límite de retención inválido", () => {
  const directory = fs.mkdtempSync(
    path.join(os.tmpdir(), "quacker-db-backup-cli-limit-")
  );

  try {
    const dbPath = path.join(directory, "db.json");
    const backupDirectory = path.join(
      directory,
      "backups"
    );

    writeJsonFileAtomic(dbPath, {
      users: {}
    });

    const output = [];

    const exitCode = runDbBackupCommand({
      dbPath,
      args: [
        "--directory",
        backupDirectory,
        "--limit",
        "0"
      ],
      writeLine: (line) => output.push(line)
    });

    assert.equal(exitCode, 1);
    assert.equal(
      fs.existsSync(backupDirectory),
      false
    );
    assert.match(
      output.join("\n"),
      /entero mayor que cero/
    );
  } finally {
    fs.rmSync(directory, {
      recursive: true,
      force: true
    });
  }
});

test("falla sin crear copia si la base no supera la validación", () => {
  const directory = fs.mkdtempSync(
    path.join(os.tmpdir(), "quacker-db-backup-cli-invalid-")
  );

  try {
    const dbPath = path.join(directory, "db.json");
    const backupDirectory = path.join(
      directory,
      "backups"
    );

    fs.writeFileSync(
      dbPath,
      '{"invalid":true}\n',
      "utf8"
    );

    const output = [];

    const exitCode = runDbBackupCommand({
      dbPath,
      args: [
        "--directory",
        backupDirectory
      ],
      writeLine: (line) => output.push(line)
    });

    assert.equal(exitCode, 1);
    assert.equal(
      fs.existsSync(backupDirectory),
      false
    );
    assert.match(
      output.join("\n"),
      /INVALID_DATABASE_STRUCTURE/
    );
  } finally {
    fs.rmSync(directory, {
      recursive: true,
      force: true
    });
  }
});
