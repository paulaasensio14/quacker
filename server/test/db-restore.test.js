import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  listJsonFileBackups,
  restoreJsonFileBackup,
  writeJsonFileAtomic
} from "../lib/json-db.js";

import {
  validateDb
} from "../lib/db-schema.js";

test("restaura un backup válido y conserva la base actual", () => {
  const directory = fs.mkdtempSync(
    path.join(os.tmpdir(), "quacker-db-restore-")
  );

  try {
    const filePath = path.join(directory, "db.json");
    const backupPath = path.join(
      directory,
      "db.json.backup-manual"
    );

    writeJsonFileAtomic(filePath, {
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

    restoreJsonFileBackup(
      filePath,
      backupPath,
      {
        validate: validateDb,
        backupLimit: 5
      }
    );

    assert.deepEqual(
      JSON.parse(
        fs.readFileSync(filePath, "utf8")
      ),
      {
        users: {
          restored: {}
        }
      }
    );

    const backups = fs
      .readdirSync(directory)
      .filter((name) =>
        name.startsWith("db.json.backup-")
      );

    const preservedCurrent = backups.some((name) => {
      const data = JSON.parse(
        fs.readFileSync(
          path.join(directory, name),
          "utf8"
        )
      );

      return Boolean(data.users?.current);
    });

    assert.equal(preservedCurrent, true);
  } finally {
    fs.rmSync(directory, {
      recursive: true,
      force: true
    });
  }
});

test("no modifica la base actual si el backup contiene JSON inválido", () => {
  const directory = fs.mkdtempSync(
    path.join(os.tmpdir(), "quacker-db-restore-invalid-")
  );

  try {
    const filePath = path.join(directory, "db.json");
    const backupPath = path.join(
      directory,
      "db.json.backup-invalid"
    );

    const currentDb = {
      users: {
        current: {}
      }
    };

    writeJsonFileAtomic(filePath, currentDb);

    fs.writeFileSync(
      backupPath,
      "{ esto no es JSON válido",
      {
        encoding: "utf8",
        mode: 0o600
      }
    );

    assert.throws(
      () =>
        restoreJsonFileBackup(
          filePath,
          backupPath,
          {
            validate: validateDb,
            backupLimit: 5
          }
        ),
      (error) => {
        assert.equal(
          error.code,
          "INVALID_JSON_FILE"
        );

        return true;
      }
    );

    assert.deepEqual(
      JSON.parse(
        fs.readFileSync(filePath, "utf8")
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

test("no modifica la base actual si el backup tiene una estructura inválida", () => {
  const directory = fs.mkdtempSync(
    path.join(os.tmpdir(), "quacker-db-restore-structure-")
  );

  try {
    const filePath = path.join(directory, "db.json");
    const backupPath = path.join(
      directory,
      "db.json.backup-invalid-structure"
    );

    const currentDb = {
      users: {
        current: {}
      }
    };

    writeJsonFileAtomic(filePath, currentDb);

    fs.writeFileSync(
      backupPath,
      JSON.stringify(
        {
          foo: "bar"
        },
        null,
        2
      ),
      {
        encoding: "utf8",
        mode: 0o600
      }
    );

    assert.throws(
      () =>
        restoreJsonFileBackup(
          filePath,
          backupPath,
          {
            validate: validateDb,
            backupLimit: 5
          }
        ),
      (error) => {
        assert.equal(
          error.code,
          "INVALID_DATABASE_STRUCTURE"
        );

        return true;
      }
    );

    assert.deepEqual(
      JSON.parse(
        fs.readFileSync(filePath, "utf8")
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

test("no modifica la base actual si el backup no existe", () => {
  const directory = fs.mkdtempSync(
    path.join(os.tmpdir(), "quacker-db-restore-missing-")
  );

  try {
    const filePath = path.join(directory, "db.json");
    const backupPath = path.join(
      directory,
      "db.json.backup-missing"
    );

    const currentDb = {
      users: {
        current: {}
      }
    };

    writeJsonFileAtomic(filePath, currentDb);

    assert.throws(
      () =>
        restoreJsonFileBackup(
          filePath,
          backupPath,
          {
            validate: validateDb,
            backupLimit: 5
          }
        ),
      (error) => {
        assert.equal(
          error.code,
          "JSON_FILE_NOT_FOUND"
        );

        return true;
      }
    );

    assert.deepEqual(
      JSON.parse(
        fs.readFileSync(filePath, "utf8")
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

test("lista únicamente los backups de la base de datos", async () => {
  const {
    listJsonFileBackups
  } = await import("../lib/json-db.js");

  const directory = fs.mkdtempSync(
    path.join(os.tmpdir(), "quacker-db-backup-list-")
  );

  try {
    const filePath = path.join(directory, "db.json");

    fs.writeFileSync(
      path.join(directory, "db.json.backup-100"),
      "{}",
      "utf8"
    );

    fs.writeFileSync(
      path.join(directory, "db.json.backup-200"),
      "{}",
      "utf8"
    );

    fs.writeFileSync(
      path.join(directory, "otro.json.backup-300"),
      "{}",
      "utf8"
    );

    fs.writeFileSync(
      path.join(directory, "db.json.tmp-test"),
      "{}",
      "utf8"
    );

    const backups = listJsonFileBackups(filePath);

    assert.deepEqual(
      backups.map((backup) => backup.name).sort(),
      [
        "db.json.backup-100",
        "db.json.backup-200"
      ]
    );
  } finally {
    fs.rmSync(directory, {
      recursive: true,
      force: true
    });
  }
});

test("rechaza archivos que no sean backups de la base indicada", () => {
  const directory = fs.mkdtempSync(
    path.join(os.tmpdir(), "quacker-db-restore-path-")
  );

  try {
    const filePath = path.join(directory, "db.json");
    const unrelatedPath = path.join(
      directory,
      "otro-archivo.json"
    );

    const currentDb = {
      users: {
        current: {}
      }
    };

    writeJsonFileAtomic(filePath, currentDb);

    fs.writeFileSync(
      unrelatedPath,
      JSON.stringify(
        {
          users: {
            unrelated: {}
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

    assert.throws(
      () =>
        restoreJsonFileBackup(
          filePath,
          unrelatedPath,
          {
            validate: validateDb,
            backupLimit: 5
          }
        ),
      (error) => {
        assert.equal(
          error.code,
          "INVALID_BACKUP_PATH"
        );

        return true;
      }
    );

    assert.deepEqual(
      JSON.parse(
        fs.readFileSync(filePath, "utf8")
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

test("rechaza un backup que sea un enlace simbólico", () => {
  const directory = fs.mkdtempSync(
    path.join(os.tmpdir(), "quacker-db-restore-symlink-")
  );

  try {
    const filePath = path.join(directory, "db.json");
    const externalPath = path.join(
      directory,
      "external.json"
    );

    const backupPath = path.join(
      directory,
      "db.json.backup-symlink"
    );

    const currentDb = {
      users: {
        current: {}
      }
    };

    writeJsonFileAtomic(filePath, currentDb);

    fs.writeFileSync(
      externalPath,
      JSON.stringify(
        {
          users: {
            external: {}
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

    fs.symlinkSync(
      externalPath,
      backupPath
    );

    assert.throws(
      () =>
        restoreJsonFileBackup(
          filePath,
          backupPath,
          {
            validate: validateDb,
            backupLimit: 5
          }
        ),
      (error) => {
        assert.equal(
          error.code,
          "INVALID_BACKUP_FILE"
        );

        return true;
      }
    );

    assert.deepEqual(
      JSON.parse(
        fs.readFileSync(filePath, "utf8")
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

test("no lista enlaces simbólicos como backups disponibles", () => {
  const directory = fs.mkdtempSync(
    path.join(os.tmpdir(), "quacker-db-backup-list-symlink-")
  );

  try {
    const filePath = path.join(directory, "db.json");

    const regularBackupPath = path.join(
      directory,
      "db.json.backup-regular"
    );

    const externalPath = path.join(
      directory,
      "external.json"
    );

    const symlinkBackupPath = path.join(
      directory,
      "db.json.backup-symlink"
    );

    fs.writeFileSync(
      regularBackupPath,
      "{}",
      "utf8"
    );

    fs.writeFileSync(
      externalPath,
      "{}",
      "utf8"
    );

    fs.symlinkSync(
      externalPath,
      symlinkBackupPath
    );

    const backups = listJsonFileBackups(filePath);

    assert.deepEqual(
      backups.map((backup) => backup.name),
      [
        "db.json.backup-regular"
      ]
    );
  } finally {
    fs.rmSync(directory, {
      recursive: true,
      force: true
    });
  }
});
