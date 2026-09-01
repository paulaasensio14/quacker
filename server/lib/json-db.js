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
