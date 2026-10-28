import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  runBetaCleanupCommand
} from "../lib/beta-cleanup-cli.js";

function fixture() {
  const root = fs.mkdtempSync(
    path.join(os.tmpdir(), "quacker-beta-cli-")
  );

  const dbPath = path.join(root, "db.json");
  const sessionDirectory = path.join(root, ".sessions");

  const raw = JSON.stringify({
    users: {
      beta1: {},
      beta2: {}
    }
  });

  fs.writeFileSync(dbPath, raw, {
    mode: 0o600
  });

  fs.mkdirSync(sessionDirectory, {
    mode: 0o700
  });

  fs.writeFileSync(
    path.join(sessionDirectory, "session-one"),
    "{}"
  );

  const sha256 = crypto
    .createHash("sha256")
    .update(raw)
    .digest("hex");

  return {
    dbPath,
    sessionDirectory,
    raw,
    sha256,
    cleanup: () => fs.rmSync(root, {
      recursive: true,
      force: true
    })
  };
}

test("simula la limpieza sin modificar datos", () => {
  const f = fixture();

  try {
    const lines = [];

    const code = runBetaCleanupCommand({
      dbPath: f.dbPath,
      sessionDirectory: f.sessionDirectory,
      args: [
        "--plan",
        "--expected-users", "2",
        "--sha256", f.sha256
      ],
      writeLine: (line) => lines.push(line)
    });

    assert.equal(code, 0);
    assert.ok(
      lines.includes("Usuarios objetivo: 2")
    );

    assert.ok(
      lines.includes("Usuarios restantes: 0")
    );

    assert.ok(
      lines.includes("Sesiones detectadas: 1")
    );

    assert.equal(
      fs.readFileSync(f.dbPath, "utf8"),
      f.raw
    );

    assert.deepEqual(
      fs.readdirSync(f.sessionDirectory),
      ["session-one"]
    );
  } finally {
    f.cleanup();
  }
});

test("rechaza ejecución real", () => {
  const f = fixture();

  try {
    const lines = [];

    const code = runBetaCleanupCommand({
      dbPath: f.dbPath,
      sessionDirectory: f.sessionDirectory,
      args: ["--execute"],
      writeLine: (line) => lines.push(line)
    });

    assert.equal(code, 1);
    assert.ok(
      lines.some((line) =>
        line.includes("INVALID_CLEANUP_ARGUMENTS")
      )
    );

    assert.equal(
      fs.readFileSync(f.dbPath, "utf8"),
      f.raw
    );
  } finally {
    f.cleanup();
  }
});

test("rechaza una huella incorrecta", () => {
  const f = fixture();

  try {
    const lines = [];

    const code = runBetaCleanupCommand({
      dbPath: f.dbPath,
      sessionDirectory: f.sessionDirectory,
      args: [
        "--plan",
        "--expected-users", "2",
        "--sha256", "0".repeat(64)
      ],
      writeLine: (line) => lines.push(line)
    });

    assert.equal(code, 1);
    assert.ok(
      lines.some((line) =>
        line.includes("DATABASE_CHANGED")
      )
    );

    assert.equal(
      fs.readFileSync(f.dbPath, "utf8"),
      f.raw
    );
  } finally {
    f.cleanup();
  }
});

test("rechaza argumentos incompletos o duplicados", () => {
  const f = fixture();

  try {
    for (const args of [
      [],
      ["--plan"],
      ["--plan", "--expected-users", "0"],
      ["--plan", "--expected-users", "2"],
      ["--plan", "--plan"],
      [
        "--plan",
        "--expected-users", "2",
        "--sha256", f.sha256,
        "--execute"
      ]
    ]) {
      const code = runBetaCleanupCommand({
        dbPath: f.dbPath,
        sessionDirectory: f.sessionDirectory,
        args,
        writeLine: () => {}
      });

      assert.equal(code, 1);
    }

    assert.equal(
      fs.readFileSync(f.dbPath, "utf8"),
      f.raw
    );
  } finally {
    f.cleanup();
  }
});


test("el comando rechaza ejecución fuera de producción", async () => {
  const { spawnSync } = await import("node:child_process");
  const { fileURLToPath } = await import("node:url");

  const script = fileURLToPath(
    new URL("../scripts/beta-cleanup.js", import.meta.url)
  );

  const result = spawnSync(
    process.execPath,
    [script, "--execute"],
    { encoding: "utf8", timeout: 5000 }
  );

  assert.equal(result.status, 1);

  const productionScript =
    "/home/ubuntu/apps/quacker/server/scripts/beta-cleanup.js";

  if (script === productionScript) {
    assert.match(
      result.stdout,
      /INVALID_CLEANUP_ARGUMENTS/
    );
  } else {
    assert.match(
      result.stderr,
      /PRODUCTION_INSTALL_REQUIRED/
    );
  }
});


test("rechaza ejecución completa fuera de producción", () => {
  const f = fixture();

  try {
    const lines = [];

    const code = runBetaCleanupCommand({
      dbPath: f.dbPath,
      sessionDirectory: f.sessionDirectory,
      args: [
        "--execute",
        "--expected-users", "2",
        "--sha256", f.sha256,
        "--confirm", "DELETE_ALL_BETA_USERS"
      ],
      writeLine: (line) => lines.push(line)
    });

    assert.equal(code, 1);

    assert.equal(
      fs.readFileSync(f.dbPath, "utf8"),
      f.raw
    );

    assert.deepEqual(
      fs.readdirSync(f.sessionDirectory),
      ["session-one"]
    );
  } finally {
    f.cleanup();
  }
});

test("rechaza confirmación incorrecta y argumentos no autorizados", () => {
  const f = fixture();

  try {
    for (const args of [
      [
        "--execute",
        "--expected-users", "2",
        "--sha256", f.sha256,
        "--confirm", "WRONG_CONFIRMATION"
      ],
      [
        "--execute",
        "--expected-users", "2",
        "--sha256", f.sha256,
        "--confirm", "DELETE_ALL_BETA_USERS",
        "--production-check", "skip"
      ],
      [
        "--execute",
        "--expected-users", "2",
        "--sha256", f.sha256,
        "--confirm", "DELETE_ALL_BETA_USERS",
        "--write-database", "skip"
      ]
    ]) {
      assert.equal(
        runBetaCleanupCommand({
          dbPath: f.dbPath,
          sessionDirectory: f.sessionDirectory,
          args,
          writeLine: () => {}
        }),
        1
      );
    }

    assert.equal(
      fs.readFileSync(f.dbPath, "utf8"),
      f.raw
    );
  } finally {
    f.cleanup();
  }
});
