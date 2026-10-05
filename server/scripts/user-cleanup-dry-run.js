import path from "node:path";
import { fileURLToPath } from "node:url";

import "../config/env.js";

import {
  runUserCleanupDryRunCommand
} from "../lib/user-cleanup-dry-run-cli.js";

const filename = fileURLToPath(import.meta.url);
const directory = path.dirname(filename);

const serverDirectory = path.join(
  directory,
  ".."
);

const dbPath = path.join(
  serverDirectory,
  "db.json"
);

const sessionDirectory = path.join(
  serverDirectory,
  ".sessions"
);

const exitCode =
  runUserCleanupDryRunCommand({
    dbPath,
    sessionDirectory,
    sessionSecret: String(
      process.env.SESSION_SECRET || ""
    ).trim(),
    args: process.argv.slice(2),
    writeLine: console.log
  });

process.exitCode = exitCode;
