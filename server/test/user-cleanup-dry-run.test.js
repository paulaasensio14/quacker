import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  analyzeUserCleanupDryRun
} from "../lib/user-cleanup-dry-run.js";

import {
  writeJsonFileAtomic
} from "../lib/json-db.js";

function createFixture({
  users,
  sessions = []
}) {
  const directory = fs.mkdtempSync(
    path.join(os.tmpdir(), "quacker-user-cleanup-dry-run-")
  );

  const dbPath = path.join(directory, "db.json");
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
      typeof session === "string"
        ? session
        : `${JSON.stringify(session, null, 2)}\n`,
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

test("exige al menos un usuario objetivo explícito", () => {
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
    assert.throws(
      () =>
        analyzeUserCleanupDryRun({
          dbPath: fixture.dbPath,
          sessionDirectory:
            fixture.sessionDirectory,
          targetUserIds: []
        }),
      (error) =>
        error?.code ===
        "INVALID_USER_CLEANUP_TARGETS"
    );
  } finally {
    cleanupFixture(fixture.directory);
  }
});

test("rechaza usuarios objetivo que no existen", () => {
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
    assert.throws(
      () =>
        analyzeUserCleanupDryRun({
          dbPath: fixture.dbPath,
          sessionDirectory:
            fixture.sessionDirectory,
          targetUserIds: ["missing_user"]
        }),
      (error) =>
        error?.code ===
        "USER_CLEANUP_TARGET_NOT_FOUND"
    );
  } finally {
    cleanupFixture(fixture.directory);
  }
});

test("genera un informe sanitizado sin modificar la base", () => {
  const fixture = createFixture({
    users: {
      user_1: {
        profile: {
          id: "user_1",
          email: "private@example.com",
          name: "Nombre privado"
        },
        auth: {
          passwordHash: "hash-secreto",
          passwordSalt: "salt-secreto"
        },
        library: [
          {
            id: "item_1"
          }
        ]
      },
      user_2: {
        profile: {
          id: "user_2"
        }
      }
    }
  });

  try {
    const before = fs.readFileSync(
      fixture.dbPath,
      "utf8"
    );

    const report = analyzeUserCleanupDryRun({
      dbPath: fixture.dbPath,
      sessionDirectory:
        fixture.sessionDirectory,
      targetUserIds: ["user_1"]
    });

    const after = fs.readFileSync(
      fixture.dbPath,
      "utf8"
    );

    assert.equal(report.mode, "dry-run");
    assert.equal(report.totalUsers, 2);
    assert.equal(report.targetUsers, 1);
    assert.equal(report.remainingUsers, 1);

    assert.deepEqual(
      report.targets[0].blocks,
      ["auth", "library", "profile"]
    );

    const serializedReport =
      JSON.stringify(report);

    assert.doesNotMatch(
      serializedReport,
      /private@example\.com/
    );

    assert.doesNotMatch(
      serializedReport,
      /Nombre privado/
    );

    assert.doesNotMatch(
      serializedReport,
      /hash-secreto/
    );

    assert.doesNotMatch(
      serializedReport,
      /salt-secreto/
    );

    assert.equal(before, after);
  } finally {
    cleanupFixture(fixture.directory);
  }
});

test("detecta referencias cruzadas hacia usuarios objetivo", () => {
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
    const report = analyzeUserCleanupDryRun({
      dbPath: fixture.dbPath,
      sessionDirectory:
        fixture.sessionDirectory,
      targetUserIds: ["user_1"]
    });

    assert.equal(
      report.crossUserReferences.count,
      1
    );

    assert.equal(
      report.crossUserReferences.blocking,
      true
    );

    assert.equal(
      report.crossUserReferences.references[0]
        .path,
      "social.friendId"
    );

    assert.doesNotMatch(
      JSON.stringify(
        report.crossUserReferences
      ),
      /user_2/
    );
  } finally {
    cleanupFixture(fixture.directory);
  }
});

test("detecta sesiones de usuarios objetivo sin modificarlas", () => {
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
      },
      "{json inválido"
    ]
  });

  try {
    const before = fs
      .readdirSync(fixture.sessionDirectory)
      .sort()
      .map((name) => ({
        name,
        content: fs.readFileSync(
          path.join(
            fixture.sessionDirectory,
            name
          ),
          "utf8"
        )
      }));

    const report = analyzeUserCleanupDryRun({
      dbPath: fixture.dbPath,
      sessionDirectory:
        fixture.sessionDirectory,
      targetUserIds: ["user_1"]
    });

    const after = fs
      .readdirSync(fixture.sessionDirectory)
      .sort()
      .map((name) => ({
        name,
        content: fs.readFileSync(
          path.join(
            fixture.sessionDirectory,
            name
          ),
          "utf8"
        )
      }));

    assert.equal(
      report.sessions.files,
      3
    );

    assert.equal(
      report.sessions.validJson,
      2
    );

    assert.equal(
      report.sessions.invalidJson,
      1
    );

    assert.equal(
      report.sessions.targetSessions,
      1
    );

    assert.deepEqual(before, after);
  } finally {
    cleanupFixture(fixture.directory);
  }
});

test("normaliza y elimina objetivos duplicados", () => {
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
        }
      }
    }
  });

  try {
    const report = analyzeUserCleanupDryRun({
      dbPath: fixture.dbPath,
      sessionDirectory:
        fixture.sessionDirectory,
      targetUserIds: [
        " user_1 ",
        "user_1"
      ]
    });

    assert.equal(report.targetUsers, 1);
    assert.equal(report.remainingUsers, 1);
    assert.equal(report.targets.length, 1);
  } finally {
    cleanupFixture(fixture.directory);
  }
});

test("detecta referencias cuando el usuario objetivo se usa como clave de objeto", () => {
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
          followers: {
            user_1: true
          }
        }
      }
    }
  });

  try {
    const report = analyzeUserCleanupDryRun({
      dbPath: fixture.dbPath,
      sessionDirectory:
        fixture.sessionDirectory,
      targetUserIds: ["user_1"]
    });

    assert.equal(
      report.crossUserReferences.count,
      1
    );

    assert.equal(
      report.crossUserReferences.blocking,
      true
    );

    assert.equal(
      report.crossUserReferences.references[0]
        .path,
      "social.followers.<target-key>"
    );

    assert.doesNotMatch(
      JSON.stringify(
        report.crossUserReferences
      ),
      /user_1|user_2/
    );
  } finally {
    cleanupFixture(fixture.directory);
  }
});
