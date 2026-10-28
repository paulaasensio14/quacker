import { planBetaCleanup } from "./beta-cleanup-plan.js";
import {
  executeProductionBetaCleanup
} from "./beta-cleanup-execute.js";

function parseArguments(args) {
  const allowed = new Set([
    "--plan",
    "--execute",
    "--confirm",
    "--expected-users",
    "--sha256"
  ]);

  const values = new Map();

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];

    if (!allowed.has(argument) || values.has(argument)) {
      throw new Error("INVALID_CLEANUP_ARGUMENTS");
    }

    if (argument === "--plan" || argument === "--execute") {
      values.set(argument, true);
      continue;
    }

    const value = args[index + 1];

    if (!value || value.startsWith("--")) {
      throw new Error("INVALID_CLEANUP_ARGUMENTS");
    }

    values.set(argument, value);
    index += 1;
  }

  const isPlan = values.get("--plan") === true;
  const isExecute = values.get("--execute") === true;

  if (isPlan === isExecute) {
    throw new Error("INVALID_CLEANUP_ARGUMENTS");
  }

  if (isExecute) {
    if (
      values.get("--confirm") !==
      "DELETE_ALL_BETA_USERS"
    ) {
      throw new Error("INVALID_CLEANUP_ARGUMENTS");
    }
  } else if (values.has("--confirm")) {
    throw new Error("INVALID_CLEANUP_ARGUMENTS");
  }

  if (
    !values.has("--expected-users") ||
    !values.has("--sha256")
  ) {
    throw new Error("CLEANUP_PLAN_REQUIRED");
  }

  const rawCount = values.get("--expected-users");

  if (!/^[1-9][0-9]*$/.test(rawCount)) {
    throw new Error("INVALID_EXPECTED_USERS");
  }

  const expectedUsers = Number(rawCount);

  if (!Number.isSafeInteger(expectedUsers)) {
    throw new Error("INVALID_EXPECTED_USERS");
  }

  return {
    mode: isExecute ? "execute" : "plan",
    expectedUsers,
    expectedSha256: values.get("--sha256")
  };
}

export function runBetaCleanupCommand({
  dbPath,
  sessionDirectory,
  args = [],
  writeLine = console.log
}) {
  try {
    const options = parseArguments(args);

    if (options.mode === "execute") {
      if (
        dbPath !== "/home/ubuntu/apps/quacker/server/db.json" ||
        sessionDirectory !==
          "/home/ubuntu/apps/quacker/server/.sessions"
      ) {
        throw new Error("PRODUCTION_INSTALL_REQUIRED");
      }

      const result = executeProductionBetaCleanup({
        expectedUsers: options.expectedUsers,
        expectedSha256: options.expectedSha256,
        confirmation: "DELETE_ALL_BETA_USERS"
      });

      writeLine("Modo: execute");
      writeLine(`Usuarios eliminados: ${result.removedUsers}`);
      writeLine("Backup de recuperación: creado");
      writeLine("Sesiones anteriores: en cuarentena");

      return 0;
    }

    const report = planBetaCleanup({
      dbPath,
      sessionDirectory,
      expectedUsers: options.expectedUsers,
      expectedSha256: options.expectedSha256
    });

    writeLine("Modo: dry-run");
    writeLine(`Usuarios objetivo: ${report.usersToRemove}`);
    writeLine(`Usuarios restantes: ${report.usersRemaining}`);
    writeLine(`Sesiones detectadas: ${report.sessionFiles}`);
    writeLine("Base de datos: huella verificada");
    writeLine("Resultado: ninguna modificación realizada");

    return 0;
  } catch (error) {
    const operation = args.includes("--execute")
      ? "Ejecución"
      : "Simulación";

    writeLine(
      `${operation} rechazada: ${
        error?.code ||
        (
          error?.message === "INVALID_CLEANUP_ARGUMENTS" ||
          error?.message === "CLEANUP_PLAN_REQUIRED" ||
          error?.message === "INVALID_EXPECTED_USERS"
            ? error.message
            : "BETA_CLEANUP_PLAN_FAILED"
        )
      }`
    );

    return 1;
  }
}
