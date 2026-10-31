import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import fs from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const serverPath = fileURLToPath(
  new URL("../server.js", import.meta.url)
);

async function availablePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const port = server.address().port;
      server.close((error) =>
        error ? reject(error) : resolve(port)
      );
    });
  });
}

async function startServer(port, directory) {
  const child = spawn(process.execPath, [serverPath], {
    cwd: path.dirname(serverPath),
    env: {
      ...process.env,
      NODE_ENV: "test",
      PORT: String(port),
      QUACKER_DB_PATH: path.join(directory, "db.json"),
      QUACKER_SESSION_STORE_PATH:
        path.join(directory, "sessions"),
      SMTP_HOST: "",
      SMTP_USER: "",
      SMTP_PASS: ""
    },
    stdio: ["ignore", "pipe", "pipe"]
  });

  let stdout = "";
  let stderr = "";

  child.stdout.on("data", (chunk) => {
    stdout += chunk.toString();
  });

  child.stderr.on("data", (chunk) => {
    stderr += chunk.toString();
  });

  const deadline = Date.now() + 10000;

  while (Date.now() < deadline) {
    if (
      stdout.includes(
        `Quacker server running: http://127.0.0.1:${port}`
      )
    ) {
      return child;
    }

    if (child.exitCode !== null) break;

    await new Promise((resolve) =>
      setTimeout(resolve, 50)
    );
  }

  child.kill("SIGKILL");
  throw new Error(`Servidor temporal: ${stderr}`);
}

test(
  "HTTP real: solo el propietario puede editar o eliminar listas almacenadas",
  { timeout: 30000 },
  async () => {
    const directory = fs.mkdtempSync(
      path.join(os.tmpdir(), "quacker-list-owner-")
    );

    let child;

    try {
      const port = await availablePort();
      const base = `http://127.0.0.1:${port}`;
      const dbPath = path.join(directory, "db.json");

      child = await startServer(port, directory);

      const request = async (
        endpoint,
        method = "GET",
        body = null,
        cookie = ""
      ) => {
        const response = await fetch(`${base}${endpoint}`, {
          method,
          headers: {
            Origin: base,
            ...(body !== null
              ? { "Content-Type": "application/json" }
              : {}),
            ...(cookie ? { Cookie: cookie } : {})
          },
          ...(body !== null
            ? { body: JSON.stringify(body) }
            : {})
        });

        return {
          status: response.status,
          json: await response.json(),
          cookie:
            response.headers.get("set-cookie")
              ?.split(";")[0]
        };
      };

      const register = async (email, name) => {
        const result = await request(
          "/api/auth/register",
          "POST",
          {
            email,
            name,
            password: "Ownership-Runtime-123!",
            language: "es"
          }
        );

        assert.equal(result.status, 200);
        assert.ok(result.cookie);
        assert.ok(result.json?.user?.id);

        return {
          id: result.json.user.id,
          cookie: result.cookie
        };
      };

      const owner = await register(
        "list-owner-runtime@example.test",
        "List Owner"
      );

      const other = await register(
        "list-other-runtime@example.test",
        "List Other"
      );

      const created = await request(
        "/api/lists",
        "POST",
        {
          name: "Lista del propietario",
          description: "Lista protegida",
          visibility: "collab"
        },
        owner.cookie
      );

      assert.equal(created.status, 201);
      assert.ok(created.json?.id);

      const listId = created.json.id;

      const db = JSON.parse(
        fs.readFileSync(dbPath, "utf8")
      );

      const original = db.users[owner.id].lists.find(
        (list) => list.id === listId
      );

      assert.ok(original);
      assert.equal(original.ownerUserId, owner.id);

      // Simular un registro heredado inconsistente.
      db.users[other.id].lists.push({
        ...structuredClone(original),
        ownerUserId: owner.id
      });

      fs.writeFileSync(
        dbPath,
        JSON.stringify(db, null, 2) + "\n",
        { mode: 0o600 }
      );

      const route =
        `/api/lists/${encodeURIComponent(listId)}`;

      const patch = await request(
        route,
        "PATCH",
        { name: "Modificación no autorizada" },
        other.cookie
      );

      assert.equal(
        patch.status,
        403,
        "un usuario que no es propietario no debe editar la lista"
      );

      const afterPatch = JSON.parse(
        fs.readFileSync(dbPath, "utf8")
      );

      assert.equal(
        afterPatch.users[other.id].lists[0].name,
        original.name,
        "un PATCH rechazado no debe modificar los datos"
      );

      const removal = await request(
        route,
        "DELETE",
        null,
        other.cookie
      );

      assert.equal(
        removal.status,
        403,
        "un usuario que no es propietario no debe eliminar la lista"
      );

      const finalDb = JSON.parse(
        fs.readFileSync(dbPath, "utf8")
      );

      assert.equal(
        finalDb.users[other.id].lists.length,
        1,
        "un DELETE rechazado debe conservar la lista"
      );

      assert.equal(
        finalDb.users[owner.id].lists.length,
        1,
        "la lista original debe permanecer intacta"
      );

    } finally {
      if (child && child.exitCode === null) {
        const exited = once(child, "exit");
        child.kill("SIGTERM");
        await exited;
      }

      fs.rmSync(directory, {
        recursive: true,
        force: true
      });
    }
  }
);
