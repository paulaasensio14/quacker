import {
  analyzeUserCleanupDryRun
} from "./user-cleanup-dry-run.js";

function getRepeatedArgumentValues(
  args,
  name
) {
  const values = [];

  for (
    let index = 0;
    index < args.length;
    index += 1
  ) {
    if (args[index] !== name) {
      continue;
    }

    const value = args[index + 1];

    if (
      !value ||
      value.startsWith("--")
    ) {
      continue;
    }

    values.push(value);
    index += 1;
  }

  return values;
}

function writeReport(
  report,
  writeLine
) {
  writeLine(`Modo: ${report.mode}`);
  writeLine(
    `Usuarios totales: ${report.totalUsers}`
  );
  writeLine(
    `Usuarios objetivo: ${report.targetUsers}`
  );
  writeLine(
    `Usuarios restantes: ${report.remainingUsers}`
  );

  report.targets.forEach(
    (target) => {
      const blocks =
        target.blocks.length > 0
          ? target.blocks.join(", ")
          : "(sin bloques)";

      writeLine(
        `Objetivo ${target.index}: ${blocks}`
      );
    }
  );

  writeLine(
    `Referencias cruzadas: ${report.crossUserReferences.count}`
  );

  const operationalBlocking =
    report.crossUserReferences.blocking ||
    report.sessions.invalidJson > 0;

  writeLine(
    `Bloqueo operativo: ${
      operationalBlocking
        ? "sí"
        : "no"
    }`
  );

  for (
    const reference of
      report.crossUserReferences.references
  ) {
    writeLine(
      `Referencia estructural: ${reference.path}`
    );
  }

  writeLine(
    `Archivos de sesión: ${report.sessions.files}`
  );
  writeLine(
    `Sesiones JSON válidas: ${report.sessions.validJson}`
  );
  writeLine(
    `Sesiones JSON inválidas: ${report.sessions.invalidJson}`
  );
  writeLine(
    `Sesiones objetivo: ${report.sessions.targetSessions}`
  );
}

export function runUserCleanupDryRunCommand({
  dbPath,
  sessionDirectory,
  args = [],
  writeLine = console.log
}) {
  const targetUserIds =
    getRepeatedArgumentValues(
      args,
      "--user"
    );

  if (targetUserIds.length === 0) {
    writeLine(
      "Debes indicar al menos un usuario objetivo con --user."
    );

    return 1;
  }

  try {
    const report =
      analyzeUserCleanupDryRun({
        dbPath,
        sessionDirectory,
        targetUserIds
      });

    writeReport(
      report,
      writeLine
    );

    if (
      report.crossUserReferences.blocking ||
      report.sessions.invalidJson > 0
    ) {
      return 2;
    }

    return 0;
  } catch (error) {
    writeLine(
      `No se pudo completar el dry-run: ${
        error?.code ||
        "USER_CLEANUP_DRY_RUN_FAILED"
      }`
    );

    return 1;
  }
}
