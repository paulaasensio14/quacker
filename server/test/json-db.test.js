import test from "node:test";
import assert from "node:assert/strict";

import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  readJsonFile,
  writeJsonFileAtomic
} from "../lib/json-db.js";

function createTemporaryDirectory() {
  return fs.mkdtempSync(
    path.join(os.tmpdir(), "quacker-json-db-")
  );
}

function removeTemporaryDirectory(directory) {
  fs.rmSync(directory, {
    recursive: true,
    force: true
  });
}

test("escribe y vuelve a leer un archivo JSON", () => {
  const directory = createTemporaryDirectory();

  try {
    const filePath = path.join(directory, "data.json");
    const value = {
      users: [
        {
          id: "user-1",
          name: "Paula"
        }
      ],
      version: 1
    };

    writeJsonFileAtomic(filePath, value);

    assert.deepEqual(
      readJsonFile(filePath),
      value
    );

    const raw = fs.readFileSync(filePath, "utf8");

    assert.equal(raw.endsWith("\n"), true);
    assert.deepEqual(JSON.parse(raw), value);
  } finally {
    removeTemporaryDirectory(directory);
  }
});

test("crea automáticamente los directorios necesarios", () => {
  const directory = createTemporaryDirectory();

  try {
    const filePath = path.join(
      directory,
      "nested",
      "database",
      "data.json"
    );

    writeJsonFileAtomic(filePath, {
      ok: true
    });

    assert.equal(fs.existsSync(filePath), true);
    assert.deepEqual(
      JSON.parse(fs.readFileSync(filePath, "utf8")),
      {
        ok: true
      }
    );
  } finally {
    removeTemporaryDirectory(directory);
  }
});

test("aplica permisos 0600 al archivo definitivo", () => {
  const directory = createTemporaryDirectory();

  try {
    const filePath = path.join(directory, "secure.json");

    writeJsonFileAtomic(filePath, {
      secret: false
    });

    const permissions =
      fs.statSync(filePath).mode & 0o777;

    assert.equal(permissions, 0o600);
  } finally {
    removeTemporaryDirectory(directory);
  }
});

test("reemplaza de forma completa un archivo existente", () => {
  const directory = createTemporaryDirectory();

  try {
    const filePath = path.join(directory, "replace.json");

    writeJsonFileAtomic(filePath, {
      version: 1,
      obsolete: true
    });

    writeJsonFileAtomic(filePath, {
      version: 2
    });

    assert.deepEqual(
      readJsonFile(filePath),
      {
        version: 2
      }
    );
  } finally {
    removeTemporaryDirectory(directory);
  }
});

test("crea y valida un valor predeterminado cuando no existe el archivo", () => {
  const directory = createTemporaryDirectory();

  try {
    const filePath = path.join(directory, "default.json");
    let validationCalls = 0;

    const result = readJsonFile(filePath, {
      createDefault() {
        return {
          users: [],
          lists: []
        };
      },
      validate(value) {
        validationCalls += 1;

        assert.equal(Array.isArray(value.users), true);
        assert.equal(Array.isArray(value.lists), true);
      }
    });

    assert.deepEqual(result, {
      users: [],
      lists: []
    });

    assert.equal(validationCalls, 1);
    assert.equal(fs.existsSync(filePath), true);
    assert.deepEqual(
      readJsonFile(filePath),
      result
    );
  } finally {
    removeTemporaryDirectory(directory);
  }
});

test("lanza JSON_FILE_NOT_FOUND cuando no existe el archivo", () => {
  const directory = createTemporaryDirectory();

  try {
    const filePath = path.join(directory, "missing.json");

    assert.throws(
      () => readJsonFile(filePath),
      error => {
        assert.equal(
          error.code,
          "JSON_FILE_NOT_FOUND"
        );

        return true;
      }
    );
  } finally {
    removeTemporaryDirectory(directory);
  }
});

test("rechaza JSON inválido sin modificar el archivo original", () => {
  const directory = createTemporaryDirectory();

  try {
    const filePath = path.join(directory, "invalid.json");
    const originalContent = '{"users":[}';

    fs.writeFileSync(
      filePath,
      originalContent,
      "utf8"
    );

    assert.throws(
      () => readJsonFile(filePath),
      error => {
        assert.equal(
          error.code,
          "INVALID_JSON_FILE"
        );

        return true;
      }
    );

    assert.equal(
      fs.readFileSync(filePath, "utf8"),
      originalContent
    );
  } finally {
    removeTemporaryDirectory(directory);
  }
});

test("ejecuta la validación sobre un archivo existente", () => {
  const directory = createTemporaryDirectory();

  try {
    const filePath = path.join(directory, "validated.json");

    writeJsonFileAtomic(filePath, {
      users: []
    });

    let validationCalls = 0;

    const result = readJsonFile(filePath, {
      validate(value) {
        validationCalls += 1;
        assert.equal(Array.isArray(value.users), true);
      }
    });

    assert.deepEqual(result, {
      users: []
    });

    assert.equal(validationCalls, 1);
  } finally {
    removeTemporaryDirectory(directory);
  }
});

test("propaga los errores de validación sin sobrescribir el archivo", () => {
  const directory = createTemporaryDirectory();

  try {
    const filePath = path.join(directory, "rejected.json");

    writeJsonFileAtomic(filePath, {
      version: 1
    });

    const originalContent =
      fs.readFileSync(filePath, "utf8");

    assert.throws(
      () =>
        readJsonFile(filePath, {
          validate() {
            throw new Error("estructura inválida");
          }
        }),
      /estructura inválida/
    );

    assert.equal(
      fs.readFileSync(filePath, "utf8"),
      originalContent
    );
  } finally {
    removeTemporaryDirectory(directory);
  }
});

test("envuelve los fallos de serialización y elimina temporales", () => {
  const directory = createTemporaryDirectory();

  try {
    const filePath = path.join(directory, "failure.json");

    const circularValue = {};
    circularValue.self = circularValue;

    assert.throws(
      () =>
        writeJsonFileAtomic(
          filePath,
          circularValue
        ),
      error => {
        assert.equal(
          error.code,
          "JSON_FILE_WRITE_FAILED"
        );

        assert.ok(error.cause);

        return true;
      }
    );

    assert.equal(fs.existsSync(filePath), false);

    const remainingFiles =
      fs.readdirSync(directory);

    assert.deepEqual(remainingFiles, []);
  } finally {
    removeTemporaryDirectory(directory);
  }
});

test("conserva un backup de la versión anterior antes de reemplazarla", () => {
  const directory = createTemporaryDirectory();

  try {
    const filePath = path.join(directory, "data.json");

    writeJsonFileAtomic(filePath, {
      version: 1
    });

    writeJsonFileAtomic(
      filePath,
      {
        version: 2
      },
      {
        backupPrevious: true
      }
    );

    const backups = fs
      .readdirSync(directory)
      .filter((name) => name.startsWith("data.json.backup-"));

    assert.equal(backups.length, 1);

    assert.deepEqual(
      JSON.parse(
        fs.readFileSync(
          path.join(directory, backups[0]),
          "utf8"
        )
      ),
      {
        version: 1
      }
    );

    assert.deepEqual(
      readJsonFile(filePath),
      {
        version: 2
      }
    );
  } finally {
    removeTemporaryDirectory(directory);
  }
});

test("limita el número de backups conservados", () => {
  const directory = createTemporaryDirectory();

  try {
    const filePath = path.join(directory, "data.json");

    writeJsonFileAtomic(filePath, {
      version: 0
    });

    for (let version = 1; version <= 4; version += 1) {
      writeJsonFileAtomic(
        filePath,
        {
          version
        },
        {
          backupPrevious: true,
          backupLimit: 3
        }
      );
    }

    const backups = fs
      .readdirSync(directory)
      .filter((name) => name.startsWith("data.json.backup-"));

    assert.equal(backups.length, 3);

    const backupVersions = backups
      .map((name) =>
        JSON.parse(
          fs.readFileSync(
            path.join(directory, name),
            "utf8"
          )
        ).version
      )
      .sort((a, b) => a - b);

    assert.deepEqual(
      backupVersions,
      [1, 2, 3]
    );
  } finally {
    removeTemporaryDirectory(directory);
  }
});
