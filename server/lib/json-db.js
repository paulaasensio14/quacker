import crypto from "crypto";
import fs from "fs";
import path from "path";

function _serializeJson(value) {
  const serialized = `${JSON.stringify(value, null, 2)}\n`;

  // Verificación defensiva antes de tocar el archivo definitivo.
  JSON.parse(serialized);

  return serialized;
}

function _createWrappedError(message, code, cause) {
  const error = new Error(message);
  error.code = code;
  error.cause = cause;

  return error;
}

export function writeJsonFileAtomic(
  filePath,
  value,
  {
    backupPrevious = false,
    backupLimit = null
  } = {}
) {
  const directory = path.dirname(filePath);
  const filename = path.basename(filePath);

  const temporaryPath = path.join(
    directory,
    `.${filename}.tmp-${process.pid}-${Date.now()}-${crypto
      .randomBytes(6)
      .toString("hex")}`
  );

  fs.mkdirSync(directory, {
    recursive: true
  });

  let descriptor = null;

  try {
    descriptor = fs.openSync(
      temporaryPath,
      "wx",
      0o600
    );

    fs.writeFileSync(
      descriptor,
      _serializeJson(value),
      "utf8"
    );

    // Fuerza la escritura del contenido antes del renombrado.
    fs.fsyncSync(descriptor);
    fs.closeSync(descriptor);
    descriptor = null;

    if (backupPrevious && fs.existsSync(filePath)) {
      const backupPath = path.join(
        directory,
        `${filename}.backup-${Date.now()}-${crypto
          .randomBytes(6)
          .toString("hex")}`
      );

      fs.copyFileSync(
        filePath,
        backupPath,
        fs.constants.COPYFILE_EXCL
      );

      fs.chmodSync(backupPath, 0o600);

      if (
        Number.isInteger(backupLimit) &&
        backupLimit >= 0
      ) {
        const backupPrefix = `${filename}.backup-`;

        const backups = fs
          .readdirSync(directory)
          .filter((name) => name.startsWith(backupPrefix))
          .map((name) => {
            const backupFilePath = path.join(directory, name);
            const stats = fs.statSync(
              backupFilePath,
              {
                bigint: true
              }
            );

            return {
              path: backupFilePath,
              modifiedAt: stats.mtimeNs
            };
          })
          .sort((a, b) => {
            if (a.modifiedAt < b.modifiedAt) return -1;
            if (a.modifiedAt > b.modifiedAt) return 1;
            return 0;
          });

        const excessBackups =
          backups.length - backupLimit;

        if (excessBackups > 0) {
          backups
            .slice(0, excessBackups)
            .forEach((backup) => {
              fs.unlinkSync(backup.path);
            });
        }
      }
    }

    // El archivo definitivo nunca queda parcialmente escrito.
    fs.renameSync(temporaryPath, filePath);
    fs.chmodSync(filePath, 0o600);
  } catch (error) {
    if (descriptor !== null) {
      try {
        fs.closeSync(descriptor);
      } catch {
        // No ocultamos el error original.
      }
    }

    try {
      fs.unlinkSync(temporaryPath);
    } catch (cleanupError) {
      if (cleanupError?.code !== "ENOENT") {
        console.error(
          "[DB] No se pudo retirar el archivo temporal",
          cleanupError
        );
      }
    }

    throw _createWrappedError(
      `No se pudo guardar de forma segura ${filePath}.`,
      "JSON_FILE_WRITE_FAILED",
      error
    );
  }
}

export function readJsonFile(
  filePath,
  {
    createDefault,
    validate
  } = {}
) {
  if (!fs.existsSync(filePath)) {
    if (typeof createDefault !== "function") {
      throw _createWrappedError(
        `No existe el archivo ${filePath}.`,
        "JSON_FILE_NOT_FOUND"
      );
    }

    const initialValue = createDefault();

    if (typeof validate === "function") {
      validate(initialValue);
    }

    writeJsonFileAtomic(filePath, initialValue);

    return initialValue;
  }

  let raw;

  try {
    raw = fs.readFileSync(filePath, "utf8");
  } catch (error) {
    throw _createWrappedError(
      `No se pudo leer ${filePath}.`,
      "JSON_FILE_READ_FAILED",
      error
    );
  }

  let parsed;

  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    throw _createWrappedError(
      `El archivo ${filePath} contiene JSON inválido. Se ha dejado intacto.`,
      "INVALID_JSON_FILE",
      error
    );
  }

  if (typeof validate === "function") {
    validate(parsed);
  }

  return parsed;
}

export function createJsonFileBackup(
  filePath,
  backupDirectory,
  {
    validate,
    backupLimit = 30
  } = {}
) {
  if (
    !Number.isInteger(backupLimit) ||
    backupLimit < 1
  ) {
    const error = new Error(
      "El límite de backups debe ser un entero mayor que cero."
    );
    error.code = "INVALID_BACKUP_LIMIT";
    throw error;
  }

  let raw;
  try {
    raw = fs.readFileSync(filePath, "utf8");
  } catch (error) {
    throw _createWrappedError(
      `No se pudo leer ${filePath} para crear el backup.`,
      "BACKUP_SOURCE_READ_FAILED",
      error
    );
  }

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    throw _createWrappedError(
      `El archivo ${filePath} contiene JSON inválido. No se ha creado ningún backup.`,
      "INVALID_JSON_FILE",
      error
    );
  }

  if (typeof validate === "function") {
    validate(parsed);
  }

  const resolvedBackupDirectory =
    path.resolve(backupDirectory);
  const filename = path.basename(filePath);
  const backupPrefix = `${filename}.backup-`;

  fs.mkdirSync(resolvedBackupDirectory, {
    recursive: true,
    mode: 0o700
  });

  const backupName =
    `${backupPrefix}${Date.now()}-${crypto
      .randomBytes(6)
      .toString("hex")}`;
  const backupPath = path.join(
    resolvedBackupDirectory,
    backupName
  );
  const temporaryPath = path.join(
    resolvedBackupDirectory,
    `.${backupName}.tmp-${process.pid}-${crypto
      .randomBytes(6)
      .toString("hex")}`
  );

  let descriptor = null;

  try {
    descriptor = fs.openSync(
      temporaryPath,
      "wx",
      0o600
    );
    fs.writeFileSync(
      descriptor,
      raw,
      "utf8"
    );
    fs.fsyncSync(descriptor);
    fs.closeSync(descriptor);
    descriptor = null;

    fs.renameSync(temporaryPath, backupPath);
    fs.chmodSync(backupPath, 0o600);
  } catch (error) {
    if (descriptor !== null) {
      try {
        fs.closeSync(descriptor);
      } catch {
        // No ocultamos el error original.
      }
    }

    try {
      fs.unlinkSync(temporaryPath);
    } catch (cleanupError) {
      if (cleanupError?.code !== "ENOENT") {
        console.error(
          "[DB] No se pudo retirar el backup temporal",
          cleanupError
        );
      }
    }

    throw _createWrappedError(
      "No se pudo crear el backup periódico de la base de datos.",
      "DATABASE_BACKUP_FAILED",
      error
    );
  }

  const backups = fs
    .readdirSync(resolvedBackupDirectory)
    .filter((name) => name.startsWith(backupPrefix))
    .map((name) => {
      const candidatePath = path.join(
        resolvedBackupDirectory,
        name
      );
      const stats = fs.lstatSync(candidatePath);

      if (!stats.isFile()) {
        return null;
      }

      return {
        path: candidatePath,
        modifiedAt: stats.mtimeMs
      };
    })
    .filter(Boolean)
    .sort(
      (a, b) =>
        a.modifiedAt - b.modifiedAt
    );

  const excessBackups =
    backups.length - backupLimit;

  if (excessBackups > 0) {
    backups
      .slice(0, excessBackups)
      .forEach((backup) => {
        fs.unlinkSync(backup.path);
      });
  }

  return {
    name: backupName,
    path: backupPath
  };
}

export function restoreJsonFileBackup(
  filePath,
  backupPath,
  {
    validate,
    backupLimit = 5
  } = {}
) {
  const resolvedFilePath = path.resolve(filePath);
  const resolvedBackupPath = path.resolve(backupPath);

  const expectedDirectory = path.dirname(
    resolvedFilePath
  );

  const expectedPrefix =
    `${path.basename(resolvedFilePath)}.backup-`;

  const isValidBackupPath =
    path.dirname(resolvedBackupPath) ===
      expectedDirectory &&
    path
      .basename(resolvedBackupPath)
      .startsWith(expectedPrefix);

  if (!isValidBackupPath) {
    const error = new Error(
      "El archivo indicado no es un backup válido de esta base de datos."
    );

    error.code = "INVALID_BACKUP_PATH";

    throw error;
  }

  if (fs.existsSync(resolvedBackupPath)) {
    const backupStats = fs.lstatSync(
      resolvedBackupPath
    );

    if (!backupStats.isFile()) {
      const error = new Error(
        "El backup indicado no es un archivo regular válido."
      );

      error.code = "INVALID_BACKUP_FILE";

      throw error;
    }
  }

  const restoredValue = readJsonFile(
    resolvedBackupPath,
    {
      validate
    }
  );

  writeJsonFileAtomic(
    filePath,
    restoredValue,
    {
      backupPrevious: true,
      backupLimit
    }
  );

  return restoredValue;
}

export function listJsonFileBackups(filePath) {
  const directory = path.dirname(filePath);
  const filename = path.basename(filePath);
  const backupPrefix = `${filename}.backup-`;

  if (!fs.existsSync(directory)) {
    return [];
  }

  return fs
    .readdirSync(directory)
    .filter((name) => name.startsWith(backupPrefix))
    .map((name) => {
      const backupPath = path.join(directory, name);
      const stats = fs.lstatSync(backupPath);

      if (!stats.isFile()) {
        return null;
      }

      return {
        name,
        path: backupPath,
        modifiedAt: stats.mtime,
        size: stats.size
      };
    })
    .filter(Boolean)
    .sort(
      (a, b) =>
        b.modifiedAt.getTime() -
        a.modifiedAt.getTime()
    );
}
