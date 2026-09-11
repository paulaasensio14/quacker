import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  runUserCleanupDryRunCommand
} from "../lib/user-cleanup-dry-run-cli.js";

import {
  writeJsonFileAtomic
} from "../lib/json-db.js";

function createFixture({
  users,
  sessions = []
}) {
  const directory = fs.mkdtempSync(
    path.join(
      os.tmpdir(),
      "quacker-user-cleanup-dry-run-cli-"
    )
  );

  const dbPath = path.join(
    directory,
    "db.json"
  );

  const sessionDirectory = path.join(
    directory,
    ".sessions"
  );

  writeJsonFileAtomic(dbPath, {
    users
  });

  fs.mkdirSync(sessionDirectory, {
    recursive: true,
    mode: 0o700
  });

  sessions.forEach((session, index) => {
    fs.writeFileSync(
      path.join(
        sessionDirectory,
        `session-${index}.json`
      ),
      `${JSON.stringify(session, null, 2)}\n`,
      {
        encoding: "utf8",
        mode: 0o600
      }
    );
  });

  return {
    directory,
    dbPath,
    sessionDirectory
  };
}

function cleanupFixture(directory) {
  fs.rmSync(directory, {
    recursive: true,
    force: true
  });
}

test("exige al menos un --user explícito", () => {
  const fixture = createFixture({
    users: {
      user_1: {
        profile: {
          id: "user_1"
        }
      }
    }
  });

  try {
    const output = [];

    const exitCode =
      runUserCleanupDryRunCommand({
        dbPath: fixture.dbPath,
        sessionDirectory:
          fixture.sessionDirectory,
        args: [],
        writeLine: (line) =>
          output.push(line)
      });

    assert.equal(exitCode, 1);

    assert.match(
      output.join("\n"),
      /--user/
    );
  } finally {
    cleanupFixture(fixture.directory);
  }
});

test("acepta varios --user y muestra solo un resumen sanitizado", () => {
  const fixture = createFixture({
    users: {
      user_1: {
        profile: {
          id: "user_1",
          email: "private@example.com",
          name: "Nombre privado"
        },
        library: []
      },
      user_2: {
        profile: {
          id: "user_2"
        },
        notifications: []
      },
      user_3: {
        profile: {
          id: "user_3"
        }
      }
    }
  });

  try {
    const before = fs.readFileSync(
      fixture.dbPath,
      "utf8"
    );

    const output = [];

    const exitCode =
      runUserCleanupDryRunCommand({
        dbPath: fixture.dbPath,
        sessionDirectory:
          fixture.sessionDirectory,
        args: [
          "--user",
          "user_1",
          "--user",
          "user_2"
        ],
        writeLine: (line) =>
          output.push(line)
      });

    const after = fs.readFileSync(
      fixture.dbPath,
      "utf8"
    );

    const text = output.join("\n");

    assert.equal(exitCode, 0);

    assert.match(
      text,
      /Modo: dry-run/
    );

    assert.match(
      text,
      /Usuarios totales: 3/
    );

    assert.match(
      text,
      /Usuarios objetivo: 2/
    );

    assert.match(
      text,
      /Usuarios restantes: 1/
    );

    assert.match(
      text,
      /Objetivo 1: library, profile/
    );

    assert.match(
      text,
      /Objetivo 2: notifications, profile/
    );

    assert.doesNotMatch(
      text,
      /user_1|user_2|private@example\.com|Nombre privado/
    );

    assert.equal(before, after);
  } finally {
    cleanupFixture(fixture.directory);
  }
});

test("informa referencias cruzadas como bloqueo operativo", () => {
  const fixture = createFixture({
    users: {
      user_1: {
        profile: {
          id: "user_1"
        }
      },
      user_2: {
        profile: {
          id: "user_2"
        },
        social: {
          friendId: "user_1"
        }
      }
    }
  });

  try {
    const output = [];

    const exitCode =
      runUserCleanupDryRunCommand({
        dbPath: fixture.dbPath,
        sessionDirectory:
          fixture.sessionDirectory,
        args: [
          "--user",
          "user_1"
        ],
        writeLine: (line) =>
          output.push(line)
      });

    const text = output.join("\n");

    assert.equal(exitCode, 2);

    assert.match(
      text,
      /Referencias cruzadas: 1/
    );

    assert.match(
      text,
      /Bloqueo operativo: sí/
    );

    assert.match(
      text,
      /social\.friendId/
    );

    assert.doesNotMatch(
      text,
      /user_1|user_2/
    );
  } finally {
    cleanupFixture(fixture.directory);
  }
});

test("informa sesiones objetivo sin mostrar identificadores", () => {
  const fixture = createFixture({
    users: {
      user_1: {
        profile: {
          id: "user_1"
        },
        auth: {
          authVersion: 1
        }
      },
      user_2: {
        profile: {
          id: "user_2"
        },
        auth: {
          authVersion: 1
        }
      }
    },
    sessions: [
      {
        cookie: {},
        userId: "user_1",
        authVersion: 1
      },
      {
        cookie: {},
        userId: "user_2",
        authVersion: 1
      }
    ]
  });

  try {
    const output = [];

    const exitCode =
      runUserCleanupDryRunCommand({
        dbPath: fixture.dbPath,
        sessionDirectory:
          fixture.sessionDirectory,
        args: [
          "--user",
          "user_1"
        ],
        writeLine: (line) =>
          output.push(line)
      });

    const text = output.join("\n");

    assert.equal(exitCode, 0);

    assert.match(
      text,
      /Archivos de sesión: 2/
    );

    assert.match(
      text,
      /Sesiones objetivo: 1/
    );

    assert.doesNotMatch(
      text,
      /user_1|user_2|session-0|session-1/
    );
  } finally {
    cleanupFixture(fixture.directory);
  }
});

test("propaga errores del analizador como salida controlada", () => {
  const fixture = createFixture({
    users: {
      user_1: {
        profile: {
          id: "user_1"
        }
      }
    }
  });

  try {
    const output = [];

    const exitCode =
      runUserCleanupDryRunCommand({
        dbPath: fixture.dbPath,
        sessionDirectory:
          fixture.sessionDirectory,
        args: [
          "--user",
          "missing_user"
        ],
        writeLine: (line) =>
          output.push(line)
      });

    assert.equal(exitCode, 1);

    assert.match(
      output.join("\n"),
      /USER_CLEANUP_TARGET_NOT_FOUND/
    );

    assert.doesNotMatch(
      output.join("\n"),
      /missing_user/
    );
  } finally {
    cleanupFixture(fixture.directory);
  }
});

test("bloquea el procedimiento si existen sesiones con JSON inválido", () => {
  const fixture = createFixture({
    users: {
      user_1: {
        profile: {
          id: "user_1"
        }
      }
    }
  });

  try {
    fs.writeFileSync(
      path.join(
        fixture.sessionDirectory,
        "corrupt-session.json"
      ),
      "{json inválido",
      {
        encoding: "utf8",
        mode: 0o600
      }
    );

    const output = [];

    const exitCode =
      runUserCleanupDryRunCommand({
        dbPath: fixture.dbPath,
        sessionDirectory:
          fixture.sessionDirectory,
        args: [
          "--user",
          "user_1"
        ],
        writeLine: (line) =>
          output.push(line)
      });

    const text = output.join("\n");

    assert.equal(exitCode, 2);

    assert.match(
      text,
      /Sesiones JSON inválidas: 1/
    );

    assert.match(
      text,
      /Bloqueo operativo: sí/
    );

    assert.doesNotMatch(
      text,
      /user_1|corrupt-session/
    );
  } finally {
    cleanupFixture(fixture.directory);
  }
});
