import { planBetaCleanup } from "./beta-cleanup-plan.js";

function parseArguments(args) {
  const allowed = new Set([
    "--plan",
    "--expected-users",
    "--sha256"
  ]);

  const values = new Map();

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];

    if (!allowed.has(argument) || values.has(argument)) {
      throw new Error("INVALID_CLEANUP_ARGUMENTS");
    }

    if (argument === "--plan") {
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

  if (
    values.get("--plan") !== true ||
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

    const report = planBetaCleanup({
      dbPath,
      sessionDirectory,
      ...options
    });

    writeLine("Modo: dry-run");
    writeLine(`Usuarios objetivo: ${report.usersToRemove}`);
    writeLine(`Usuarios restantes: ${report.usersRemaining}`);
    writeLine(`Sesiones detectadas: ${report.sessionFiles}`);
    writeLine("Base de datos: huella verificada");
    writeLine("Resultado: ninguna modificación realizada");

    return 0;
  } catch (error) {
    writeLine(
      `Simulación rechazada: ${
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
