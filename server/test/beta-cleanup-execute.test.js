import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  executeBetaCleanup,
  executeProductionBetaCleanup
} from "../lib/beta-cleanup-execute.js";

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
    serviceStopped: true,
    productionCheck: () => true
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


test("rechaza la limpieza cuando la verificación real de producción falla", () => {
  const f = fixture();

  try {
    let checks = 0;

    assert.throws(
      () => executeBetaCleanup({
        ...f.options,
        productionCheck: () => {
          checks += 1;
          const error = new Error("Producción activa");
          error.code = "PRODUCTION_PM2_NOT_STOPPED";
          throw error;
        }
      }),
      { code: "PRODUCTION_PM2_NOT_STOPPED" }
    );

    assert.equal(checks, 1);
    assert.equal(
      fs.readFileSync(f.options.dbPath, "utf8"),
      f.raw
    );

    assert.deepEqual(
      fs.readdirSync(f.options.sessionDirectory),
      ["session-one"]
    );

    assert.deepEqual(
      fs.readdirSync(f.options.backupDirectory),
      []
    );
  } finally {
    f.cleanup();
  }
});


test("restaura una base parcialmente escrita", () => {
  const f = fixture();

  try {
    assert.throws(
      () => executeBetaCleanup({
        ...f.options,
        writeDatabase: (dbPath) => {
          fs.writeFileSync(dbPath, '{"users":');

          const error = new Error("Escritura incompleta");
          error.code = "SIMULATED_PARTIAL_WRITE";
          throw error;
        }
      }),
      { code: "SIMULATED_PARTIAL_WRITE" }
    );

    assert.equal(
      fs.readFileSync(f.options.dbPath, "utf8"),
      f.raw
    );

    assert.deepEqual(
      fs.readdirSync(f.options.sessionDirectory),
      ["session-one"]
    );

    assert.equal(
      fs.readFileSync(
        path.join(f.options.sessionDirectory, "session-one"),
        "utf8"
      ),
      "{}"
    );

    assert.equal(
      fs.readdirSync(f.options.backupDirectory).length,
      1
    );
  } finally {
    f.cleanup();
  }
});

test("restaura la base si falla después de escribir datos diferentes", () => {
  const f = fixture();

  try {
    assert.throws(
      () => executeBetaCleanup({
        ...f.options,
        writeDatabase: (dbPath) => {
          fs.writeFileSync(
            dbPath,
            JSON.stringify({ users: {} })
          );

          const error = new Error("Fallo posterior");
          error.code = "SIMULATED_POST_WRITE_FAILURE";
          throw error;
        }
      }),
      { code: "SIMULATED_POST_WRITE_FAILURE" }
    );

    assert.equal(
      fs.readFileSync(f.options.dbPath, "utf8"),
      f.raw
    );

    assert.deepEqual(
      fs.readdirSync(f.options.sessionDirectory),
      ["session-one"]
    );

    assert.equal(
      fs.readdirSync(f.options.backupDirectory).length,
      1
    );
  } finally {
    f.cleanup();
  }
});


test("informa un fallo crítico si el backup no permite recuperar", () => {
  const f = fixture();

  try {
    assert.throws(
      () => executeBetaCleanup({
        ...f.options,
        writeDatabase: (dbPath) => {
          fs.writeFileSync(dbPath, '{"users":');

          const backupName = fs.readdirSync(
            f.options.backupDirectory
          )[0];

          fs.writeFileSync(
            path.join(
              f.options.backupDirectory,
              backupName
            ),
            "BACKUP_CORRUPTED_IN_TEST"
          );

          const error = new Error("Fallo simulado");
          error.code = "SIMULATED_FAILURE";
          throw error;
        }
      }),
      { code: "BETA_CLEANUP_ROLLBACK_FAILED" }
    );

    const parent = path.dirname(
      f.options.sessionDirectory
    );

    const prefix =
      path.basename(f.options.sessionDirectory) +
      ".beta-cleanup-";

    const quarantines = fs.readdirSync(parent)
      .filter((name) => name.startsWith(prefix));

    assert.equal(quarantines.length, 1);

    assert.equal(
      fs.readFileSync(
        path.join(parent, quarantines[0], "session-one"),
        "utf8"
      ),
      "{}"
    );
  } finally {
    f.cleanup();
  }
});


test("la entrada de producción ignora dependencias externas", () => {
  const options = {
    expectedUsers: 16,
    expectedSha256: "0".repeat(64),
    confirmation: "",

    get productionCheck() {
      throw new Error("NO_DEBE_LEERSE_PRODUCTION_CHECK");
    },

    get writeDatabase() {
      throw new Error("NO_DEBE_LEERSE_WRITE_DATABASE");
    }
  };

  assert.throws(
    () => executeProductionBetaCleanup(options),
    { code: "EXPLICIT_CONFIRMATION_REQUIRED" }
  );
});
