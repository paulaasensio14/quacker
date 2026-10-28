import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { validateDb } from "./db-schema.js";

function reject(code) {
  const error = new Error(code);
  error.code = code;
  throw error;
}

export function inspectBetaSessions(sessionDirectory) {
  if (typeof sessionDirectory !== "string" || !path.isAbsolute(sessionDirectory)) {
    reject("INVALID_SESSION_DIRECTORY");
  }
  const stats = fs.lstatSync(sessionDirectory);
  if (!stats.isDirectory()) reject("INVALID_SESSION_DIRECTORY");
  const entries = fs.readdirSync(sessionDirectory, { withFileTypes: true });
  if (entries.some((entry) => !entry.isFile())) {
    reject("UNEXPECTED_SESSION_ENTRY");
  }
  return { sessionFiles: entries.length };
}

export function planBetaCleanup({
  dbPath,
  sessionDirectory,
  expectedUsers,
  expectedSha256
}) {
  if (!Number.isInteger(expectedUsers) || expectedUsers < 1) {
    reject("INVALID_EXPECTED_USERS");
  }

  if (typeof expectedSha256 !== "string" ||
      !/^[a-f0-9]{64}$/.test(expectedSha256)) {
    reject("INVALID_EXPECTED_SHA256");
  }

  const raw = fs.readFileSync(dbPath);
  const sha256 = crypto.createHash("sha256")
    .update(raw).digest("hex");

  if (sha256 !== expectedSha256) {
    reject("DATABASE_CHANGED");
  }

  const db = validateDb(JSON.parse(raw.toString("utf8")));
  if (Object.keys(db).some((key) => key !== "users")) {
    reject("UNREVIEWED_ROOT_COLLECTIONS");
  }

  const sessions = inspectBetaSessions(sessionDirectory);
  const actualUsers = Object.keys(db.users).length;
  if (actualUsers !== expectedUsers) {
    reject("USER_COUNT_CHANGED");
  }

  return {
    mode: "dry-run",
    usersToRemove: actualUsers,
    usersRemaining: 0,
    sessionFiles: sessions.sessionFiles,
    sha256
  };
}
