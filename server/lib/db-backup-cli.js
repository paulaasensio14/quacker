import path from "node:path";

import {
  createJsonFileBackup
} from "./json-db.js";

import {
  validateDb
} from "./db-schema.js";

function getArgumentValue(args, name) {
  const index = args.indexOf(name);

  if (index === -1) {
    return null;
  }

  const value = args[index + 1];

  if (
    !value ||
    value.startsWith("--")
  ) {
    return null;
  }

  return value;
}

export function runDbBackupCommand({
  dbPath,
  args = [],
  writeLine = console.log
}) {
  const directoryArgument =
    getArgumentValue(args, "--directory");

  if (!directoryArgument) {
    writeLine(
      "Debes indicar el directorio de backups con --directory."
    );
    return 1;
  }

  const limitArgument =
    getArgumentValue(args, "--limit");

  let backupLimit = 30;

  if (limitArgument !== null) {
    backupLimit = Number(limitArgument);

    if (
      !Number.isInteger(backupLimit) ||
      backupLimit < 1
    ) {
      writeLine(
        "El límite de backups debe ser un entero mayor que cero."
      );
      return 1;
    }
  }

  const backupDirectory = path.resolve(
    directoryArgument
  );

  try {
    const backup = createJsonFileBackup(
      dbPath,
      backupDirectory,
      {
        validate: validateDb,
        backupLimit
      }
    );

    writeLine(
      `Backup creado: ${backup.name}`
    );

    return 0;
  } catch (error) {
    writeLine(
      `No se pudo crear el backup: ${error.code || error.message}`
    );

    return 1;
  }
}
