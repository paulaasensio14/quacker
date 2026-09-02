import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  runDbRestoreCommand
} from "../lib/db-restore-cli.js";

const filename = fileURLToPath(import.meta.url);
const directory = path.dirname(filename);

const dbPath = path.join(
  directory,
  "..",
  "db.json"
);

const exitCode = runDbRestoreCommand({
  dbPath,
  args: process.argv.slice(2),
  writeLine: console.log
});

process.exitCode = exitCode;
