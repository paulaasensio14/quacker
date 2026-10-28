import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  runBetaCleanupCommand
} from "../lib/beta-cleanup-cli.js";

const directory = path.dirname(
  fileURLToPath(import.meta.url)
);

const serverDirectory = path.resolve(directory, "..");

process.exitCode = runBetaCleanupCommand({
  dbPath: path.join(serverDirectory, "db.json"),
  sessionDirectory: path.join(serverDirectory, ".sessions"),
  args: process.argv.slice(2),
  writeLine: console.log
});
