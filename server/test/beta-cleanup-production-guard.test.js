import assert from "node:assert/strict";
import test from "node:test";

import {
  validateProductionStopped
} from "../lib/beta-cleanup-production-guard.js";

const script =
  "/home/ubuntu/apps/quacker/server/server.js";

const stopped = {
  name: "quacker",
  pm2_env: {
    pm_exec_path: script,
    pm_cwd: "/home/ubuntu/apps/quacker/server",
    status: "stopped"
  }
};

const safe = {
  pm2Processes: [stopped],
  processes: [],
  listeningPorts: []
};

test(
  "acepta producción detenida aunque desarrollo siga activo",
  () => {
    assert.equal(
      validateProductionStopped({
        ...safe,
        processes: [{
          script:
            "/home/ubuntu/apps/quacker-week17/server/server.js"
        }],
        listeningPorts: [3100]
      }),
      true
    );
  }
);

test(
  "rechaza PM2 online o identidad desconocida",
  () => {
    assert.throws(
      () => validateProductionStopped({
        ...safe,
        pm2Processes: [{
          ...stopped,
          pm2_env: {
            ...stopped.pm2_env,
            status: "online"
          }
        }]
      }),
      { code: "PRODUCTION_PM2_NOT_STOPPED" }
    );

    assert.throws(
      () => validateProductionStopped({
        ...safe,
        pm2Processes: []
      }),
      { code: "PRODUCTION_PM2_IDENTITY_UNKNOWN" }
    );
  }
);

test(
  "rechaza proceso residual y puerto de producción ocupado",
  () => {
    assert.throws(
      () => validateProductionStopped({
        ...safe,
        processes: [{ script }]
      }),
      { code: "PRODUCTION_PROCESS_ACTIVE" }
    );

    assert.throws(
      () => validateProductionStopped({
        ...safe,
        listeningPorts: [3000]
      }),
      { code: "PRODUCTION_PORT_ACTIVE" }
    );
  }
);

test(
  "rechaza resultados de inspección inválidos",
  () => {
    assert.throws(
      () => validateProductionStopped({
        ...safe,
        processes: null
      }),
      { code: "PRODUCTION_STATUS_UNKNOWN" }
    );
  }
);
