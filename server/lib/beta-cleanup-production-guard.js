import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const PRODUCTION_SCRIPT =
  "/home/ubuntu/apps/quacker/server/server.js";

const PRODUCTION_CWD = path.dirname(PRODUCTION_SCRIPT);

function reject(code) {
  const error = new Error(code);
  error.code = code;
  throw error;
}

export function validateProductionStopped({
  pm2Processes,
  processes,
  listeningPorts
}) {
  if (
    !Array.isArray(pm2Processes) ||
    !Array.isArray(processes) ||
    !Array.isArray(listeningPorts)
  ) {
    reject("PRODUCTION_STATUS_UNKNOWN");
  }

  const matches = pm2Processes.filter((item) =>
    item?.name === "quacker" &&
    item?.pm2_env?.pm_exec_path === PRODUCTION_SCRIPT &&
    item?.pm2_env?.pm_cwd === PRODUCTION_CWD
  );

  if (matches.length !== 1) {
    reject("PRODUCTION_PM2_IDENTITY_UNKNOWN");
  }

  if (matches[0].pm2_env.status !== "stopped") {
    reject("PRODUCTION_PM2_NOT_STOPPED");
  }

  if (processes.some(
    (item) => item.script === PRODUCTION_SCRIPT
  )) {
    reject("PRODUCTION_PROCESS_ACTIVE");
  }

  if (listeningPorts.includes(3000)) {
    reject("PRODUCTION_PORT_ACTIVE");
  }

  return true;
}

function readProcesses() {
  const processes = [];

  for (const name of fs.readdirSync("/proc")) {
    if (!/^[0-9]+$/.test(name)) continue;

    let args;

    try {
      args = fs.readFileSync(
        `/proc/${name}/cmdline`,
        "utf8"
      ).split("\0").filter(Boolean);
    } catch (error) {
      if (
        error?.code === "ENOENT" ||
        error?.code === "ESRCH"
      ) {
        continue;
      }

      throw error;
    }

    if (
      args.length < 2 ||
      !args[0].includes("node")
    ) {
      continue;
    }

    for (const arg of args.slice(1)) {
      if (!arg.endsWith("server.js")) continue;

      let cwd;

      try {
        cwd = fs.readlinkSync(
          `/proc/${name}/cwd`
        );
      } catch (error) {
        if (
          error?.code === "ENOENT" ||
          error?.code === "ESRCH"
        ) {
          continue;
        }

        throw error;
      }

      processes.push({
        script: path.resolve(cwd, arg)
      });
    }
  }

  return processes;
}

function readListeningPorts() {
  const ports = [];

  for (const filename of [
    "/proc/net/tcp",
    "/proc/net/tcp6"
  ]) {
    const lines = fs.readFileSync(
      filename,
      "utf8"
    ).trim().split("\n").slice(1);

    for (const line of lines) {
      const fields = line.trim().split(/\s+/);

      if (fields[3] !== "0A") continue;

      const hexPort = fields[1]?.split(":")[1];

      if (hexPort) {
        ports.push(Number.parseInt(hexPort, 16));
      }
    }
  }

  return ports;
}

export function assertProductionStopped() {
  try {
    const pm2Processes = JSON.parse(
      execFileSync("pm2", ["jlist"], {
        encoding: "utf8",
        timeout: 10000,
        stdio: ["ignore", "pipe", "ignore"]
      })
    );

    return validateProductionStopped({
      pm2Processes,
      processes: readProcesses(),
      listeningPorts: readListeningPorts()
    });
  } catch (error) {
    if (error?.code?.startsWith("PRODUCTION_")) {
      throw error;
    }

    reject("PRODUCTION_STATUS_UNKNOWN");
  }
}
