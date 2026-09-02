import path from "node:path";

import {
  listJsonFileBackups,
  restoreJsonFileBackup
} from "./json-db.js";

import {
  validateDb
} from "./db-schema.js";

export function runDbRestoreCommand({
  dbPath,
  args = [],
  writeLine = console.log
}) {
  if (args.includes("--list")) {
    const backups = listJsonFileBackups(dbPath);

    if (backups.length === 0) {
      writeLine("No hay backups disponibles.");
      return 0;
    }

    backups.forEach((backup) => {
      writeLine(
        `${backup.name} | ${backup.size} bytes | ${backup.modifiedAt.toISOString()}`
      );
    });

    return 0;
  }

  const restoreIndex = args.indexOf("--restore");

  if (
    restoreIndex !== -1 &&
    !args.includes("--confirm")
  ) {
    writeLine(
      "La restauración requiere confirmación explícita con --confirm."
    );

    return 1;
  }

  if (
    restoreIndex !== -1 &&
    args.includes("--confirm")
  ) {
    const backupName = args[restoreIndex + 1];

    if (
      !backupName ||
      backupName.startsWith("--")
    ) {
      writeLine(
        "Debes indicar el nombre del backup que quieres restaurar."
      );

      return 1;
    }

    const backupPath = path.resolve(
      path.dirname(dbPath),
      backupName
    );

    try {
      restoreJsonFileBackup(
        dbPath,
        backupPath,
        {
          validate: validateDb,
          backupLimit: 5
        }
      );

      writeLine(
        `Base de datos restaurada desde ${backupName}.`
      );

      return 0;
    } catch (error) {
      writeLine(
        `No se pudo restaurar la base de datos: ${error.code || error.message}`
      );

      return 1;
    }
  }

  return 1;
}
