import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  runBetaCleanupCommand
} from "../lib/beta-cleanup-cli.js";

const directory = path.dirname(
  fileURLToPath(import.meta.url)
);

const serverDirectory = path.resolve(directory, "..");

const args = process.argv.slice(2);

const productionDirectory =
  "/home/ubuntu/apps/quacker/server";

if (
  args.includes("--execute") &&
  serverDirectory !== productionDirectory
) {
  console.error("PRODUCTION_INSTALL_REQUIRED");
  process.exitCode = 1;
} else {
  process.exitCode = runBetaCleanupCommand({
    dbPath: path.join(serverDirectory, "db.json"),
    sessionDirectory: path.join(serverDirectory, ".sessions"),
    args,
    writeLine: console.log
  });
}
