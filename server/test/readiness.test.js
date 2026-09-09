import test from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import os from "os";
import path from "path";
import {
  checkJsonDatabaseReadiness
} from "../lib/readiness.js";
import {
  validateDb
} from "../lib/db-schema.js";

function createTempDirectory() {
  return fs.mkdtempSync(
    path.join(os.tmpdir(), "quacker-readiness-")
  );
}

test("devuelve ready para una base de datos válida", () => {
  const directory = createTempDirectory();
  const filePath = path.join(directory, "db.json");

  try {
    fs.writeFileSync(
      filePath,
      JSON.stringify({
        users: {}
      }),
      "utf8"
    );

    assert.deepEqual(
      checkJsonDatabaseReadiness(
        filePath,
        {
          validate: validateDb
        }
      ),
      {
        ok: true
      }
    );
  } finally {
    fs.rmSync(directory, {
      recursive: true,
      force: true
    });
  }
});

test("no crea la base de datos cuando el archivo no existe", () => {
  const directory = createTempDirectory();
  const filePath = path.join(directory, "db.json");

  try {
    assert.deepEqual(
      checkJsonDatabaseReadiness(
        filePath,
        {
          validate: validateDb
        }
      ),
      {
        ok: false,
        error: "database_not_found"
      }
    );

    assert.equal(
      fs.existsSync(filePath),
      false
    );
  } finally {
    fs.rmSync(directory, {
      recursive: true,
      force: true
    });
  }
});

test("detecta JSON inválido sin modificar el archivo", () => {
  const directory = createTempDirectory();
  const filePath = path.join(directory, "db.json");
  const invalidJson = "{invalid";

  try {
    fs.writeFileSync(
      filePath,
      invalidJson,
      "utf8"
    );

    assert.deepEqual(
      checkJsonDatabaseReadiness(
        filePath,
        {
          validate: validateDb
        }
      ),
      {
        ok: false,
        error: "database_invalid_json"
      }
    );

    assert.equal(
      fs.readFileSync(filePath, "utf8"),
      invalidJson
    );
  } finally {
    fs.rmSync(directory, {
      recursive: true,
      force: true
    });
  }
});

test("detecta una estructura de base de datos inválida", () => {
  const directory = createTempDirectory();
  const filePath = path.join(directory, "db.json");

  try {
    fs.writeFileSync(
      filePath,
      JSON.stringify({
        users: []
      }),
      "utf8"
    );

    assert.deepEqual(
      checkJsonDatabaseReadiness(
        filePath,
        {
          validate: validateDb
        }
      ),
      {
        ok: false,
        error: "database_invalid_structure"
      }
    );
  } finally {
    fs.rmSync(directory, {
      recursive: true,
      force: true
    });
  }
});

test("detecta cuando la base de datos no se puede leer", () => {
  const directory = createTempDirectory();
  const filePath = path.join(directory, "db.json");

  try {
    fs.mkdirSync(filePath);

    assert.deepEqual(
      checkJsonDatabaseReadiness(
        filePath,
        {
          validate: validateDb
        }
      ),
      {
        ok: false,
        error: "database_unreadable"
      }
    );
  } finally {
    fs.rmSync(directory, {
      recursive: true,
      force: true
    });
  }
});
