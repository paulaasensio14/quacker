import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import { planBetaCleanup } from "./beta-cleanup-plan.js";
import { assertProductionStopped } from "./beta-cleanup-production-guard.js";
import {
  createJsonFileBackup,
  writeJsonFileAtomic
} from "./json-db.js";
import { createInitialDb, validateDb } from "./db-schema.js";

function fail(code) {
  const error = new Error(code);
  error.code = code;
  throw error;
}

function sha256(filePath) {
  return crypto.createHash("sha256")
    .update(fs.readFileSync(filePath))
    .digest("hex");
}


function restoreDatabaseFromBackup(
  dbPath,
  backupPath,
  expectedSha256
) {
  if (sha256(backupPath) !== expectedSha256) {
    fail("ROLLBACK_BACKUP_MISMATCH");
  }

  const temporaryPath =
    `${dbPath}.rollback-${crypto.randomBytes(8).toString("hex")}`;

  let descriptor = null;

  try {
    descriptor = fs.openSync(temporaryPath, "wx", 0o600);

    fs.writeFileSync(
      descriptor,
      fs.readFileSync(backupPath)
    );

    fs.fsyncSync(descriptor);
    fs.closeSync(descriptor);
    descriptor = null;

    fs.renameSync(temporaryPath, dbPath);
    fs.chmodSync(dbPath, 0o600);

    if (sha256(dbPath) !== expectedSha256) {
      fail("ROLLBACK_DATABASE_MISMATCH");
    }
  } finally {
    if (descriptor !== null) {
      fs.closeSync(descriptor);
    }

    try {
      fs.unlinkSync(temporaryPath);
    } catch (error) {
      if (error?.code !== "ENOENT") {
        throw error;
      }
    }
  }
}

export function executeBetaCleanup({
  dbPath,
  sessionDirectory,
  backupDirectory,
  expectedUsers,
  expectedSha256,
  confirmation,
  serviceStopped = false,
  productionCheck = assertProductionStopped,
  writeDatabase = writeJsonFileAtomic
}) {
  if (confirmation !== "DELETE_ALL_BETA_USERS") {
    fail("EXPLICIT_CONFIRMATION_REQUIRED");
  }
  if (serviceStopped !== true) {
    fail("SERVICE_MUST_BE_STOPPED");
  }
  productionCheck();

  if (typeof backupDirectory !== "string" ||
      !path.isAbsolute(backupDirectory)) {
    fail("INVALID_BACKUP_DIRECTORY");
  }

  const backupStats = fs.lstatSync(backupDirectory);
  if (!backupStats.isDirectory() ||
      (backupStats.mode & 0o077) !== 0) {
    fail("INSECURE_BACKUP_DIRECTORY");
  }

  const plan = planBetaCleanup({
    dbPath, sessionDirectory, expectedUsers, expectedSha256
  });

  const backup = createJsonFileBackup(
    dbPath, backupDirectory,
    { validate: validateDb, backupLimit: Number.MAX_SAFE_INTEGER }
  );
  if (sha256(backup.path) !== expectedSha256) {
    fail("BACKUP_MISMATCH");
  }

  const quarantineDirectory =
    `${sessionDirectory}.beta-cleanup-${crypto.randomBytes(8).toString("hex")}`;

  // Mover las sesiones evita accesos antiguos sin destruir su copia.
  fs.renameSync(sessionDirectory, quarantineDirectory);
  try {
    fs.mkdirSync(sessionDirectory, { mode: 0o700 });
    fs.chmodSync(sessionDirectory, 0o700);
    // Comprobar de nuevo por si la base cambió durante el backup.
    if (sha256(dbPath) !== expectedSha256) {
      fail("DATABASE_CHANGED");
    }
    writeDatabase(dbPath, createInitialDb());
    const result = validateDb(JSON.parse(fs.readFileSync(dbPath, "utf8")));
    if (Object.keys(result.users).length !== 0) {
      fail("CLEANUP_VERIFICATION_FAILED");
    }
  } catch (error) {
    try {
      if (sha256(dbPath) !== expectedSha256) {
        restoreDatabaseFromBackup(
          dbPath,
          backup.path,
          expectedSha256
        );
      }

      if (fs.existsSync(sessionDirectory)) {
        if (fs.readdirSync(sessionDirectory).length !== 0) {
          fail("ROLLBACK_SESSION_DIRECTORY_NOT_EMPTY");
        }

        fs.rmdirSync(sessionDirectory);
      }

      fs.renameSync(
        quarantineDirectory,
        sessionDirectory
      );

      if (sha256(dbPath) !== expectedSha256) {
        fail("ROLLBACK_DATABASE_MISMATCH");
      }
    } catch (recoveryError) {
      const failure = new Error(
        "BETA_CLEANUP_ROLLBACK_FAILED"
      );

      failure.code = "BETA_CLEANUP_ROLLBACK_FAILED";
      failure.cause = recoveryError;
      throw failure;
    }

    throw error;
  }

  return {
    removedUsers: plan.usersToRemove,
    invalidatedSessionFiles: plan.sessionFiles,
    backupName: backup.name,
    quarantineDirectory
  };
}


// Entrada operativa: rutas fijas y comprobaciones reales.
// No admite sustitución de dependencias utilizada en los tests.
export function executeProductionBetaCleanup({
  expectedUsers,
  expectedSha256,
  confirmation
}) {
  return executeBetaCleanup({
    dbPath: "/home/ubuntu/apps/quacker/server/db.json",
    sessionDirectory:
      "/home/ubuntu/apps/quacker/server/.sessions",
    backupDirectory: "/var/backups/quacker",
    expectedUsers,
    expectedSha256,
    confirmation,
    serviceStopped: true
  });
}
