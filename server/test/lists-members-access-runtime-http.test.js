import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import net from "node:net";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { fileURLToPath } from "node:url";
import test from "node:test";

import {
  createVerificationMailbox,
  registerVerifiedUser
} from "./helpers/verified-registration.js";

const serverPath = fileURLToPath(
  new URL("../server.js", import.meta.url)
);

async function freePort() {
  const server = net.createServer();

  await new Promise(resolve =>
    server.listen(0, "127.0.0.1", resolve)
  );

  const port = server.address().port;

  await new Promise(resolve =>
    server.close(resolve)
  );

  return port;
}

test(
  "HTTP: identidades de listas solo para miembros autorizados",
  { timeout: 120000 },
  async () => {
    const directory = fs.mkdtempSync(
      path.join(os.tmpdir(), "quacker-members-611-")
    );

    let child = null;
    let mailbox = null;

    try {
      mailbox = await createVerificationMailbox(directory);

      const port = await freePort();
      const base = `http://127.0.0.1:${port}`;

      child = spawn(process.execPath, [serverPath], {
        cwd: path.dirname(serverPath),
        env: {
          ...process.env,
          NODE_ENV: "test",
          PORT: String(port),
          QUACKER_DB_PATH: path.join(directory, "db.json"),
          QUACKER_SESSION_STORE_PATH: path.join(
            directory, "sessions"
          ),
          ...mailbox.env
        },
        stdio: ["ignore", "pipe", "pipe"]
      });

      let logs = "";
      child.stdout.on("data", chunk => {
        logs += String(chunk).slice(-3000);
      });
      child.stderr.on("data", chunk => {
        logs += String(chunk).slice(-3000);
      });

      let ready = false;

      for (let attempt = 0; attempt < 100; attempt++) {
        if (child.exitCode !== null) break;

        try {
          const response = await fetch(`${base}/api/health`);
          if (response.ok) {
            ready = true;
            break;
          }
        } catch {}

        await new Promise(resolve => setTimeout(resolve, 100));
      }

      assert.ok(ready, `Servidor no preparado: ${logs}`);

      const register = (email, name) =>
        registerVerifiedUser({
          baseUrl: base,
          mailbox,
          email,
          name,
          password: "Temporary-611-Test-Only!",
          language: "es"
        });

      const owner = await register(
        "owner611@example.test",
        "QA Owner 611"
      );

      const member = await register(
        "members611@example.test",
        "QA Member 611"
      );

      const outsider = await register(
        "outsider611@example.test",
        "QA Outsider 611"
      );

      async function request(endpoint, cookie = "", method = "GET", body) {
        const response = await fetch(base + endpoint, {
          method,
          headers: {
            Origin: base,
            ...(cookie ? { Cookie: cookie } : {}),
            ...(body !== undefined
              ? { "Content-Type": "application/json" }
              : {})
          },
          ...(body !== undefined
            ? { body: JSON.stringify(body) }
            : {})
        });

        return {
          status: response.status,
          body: await response.json(),
          cache: response.headers.get("cache-control") || ""
        };
      }

      const created = await request(
        "/api/lists",
        owner.cookie,
        "POST",
        {
          name: "QA miembros 611",
          description: "",
          visibility: "collab"
        }
      );

      assert.equal(created.status, 201);
      const listId = created.body.id;
      assert.ok(listId);

      const url =
        `/api/lists/${encodeURIComponent(listId)}/members`;

      const anonymous = await request(url);
      assert.equal(anonymous.status, 401);

      const unrelated = await request(url, outsider.cookie);
      assert.equal(unrelated.status, 404);

      const initialOwner = await request(url, owner.cookie);

      assert.equal(initialOwner.status, 200);
      assert.equal(initialOwner.body.owner.username, "owner611");
      assert.equal(initialOwner.body.owner.name, "QA Owner 611");
      assert.deepEqual(initialOwner.body.collaborators, []);
      assert.deepEqual(initialOwner.body.invited, []);
      assert.match(initialOwner.cache, /no-store/);

      const privacy = await request(
        "/api/user/privacy",
        member.cookie,
        "PATCH",
        { profileVisibility: "public" }
      );

      assert.equal(privacy.status, 200);

      const invitation = await request(
        `/api/lists/${encodeURIComponent(listId)}/invites/members611`,
        owner.cookie,
        "POST"
      );

      assert.equal(invitation.status, 201);
      assert.equal(invitation.body.invited, true);

      const invitedAccess = await request(url, member.cookie);
      assert.equal(invitedAccess.status, 404);

      const pending = await request(url, owner.cookie);
      assert.equal(pending.status, 200);
      assert.equal(pending.body.invited.length, 1);
      assert.equal(pending.body.invited[0].username, "members611");

      const accepted = await request(
        `/api/user/list-invites/${encodeURIComponent(listId)}/accept`,
        member.cookie,
        "POST"
      );

      assert.equal(accepted.status, 200);
      assert.equal(accepted.body.accepted, true);

      const memberView = await request(url, member.cookie);

      assert.equal(memberView.status, 200);
      assert.equal(memberView.body.owner.username, "owner611");
      assert.equal(memberView.body.collaborators.length, 1);
      assert.equal(
        memberView.body.collaborators[0].username,
        "members611"
      );
      assert.equal(
        Object.hasOwn(memberView.body, "invited"),
        false
      );

      const hidden = await request(
        "/api/user/privacy",
        member.cookie,
        "PATCH",
        { profileVisibility: "hidden" }
      );

      assert.equal(hidden.status, 200);

      const ownerView = await request(url, owner.cookie);

      assert.equal(ownerView.status, 200);
      assert.equal(ownerView.body.collaborators.length, 1);
      assert.equal(
        ownerView.body.collaborators[0].username,
        "members611"
      );
      assert.deepEqual(ownerView.body.invited, []);

      const publicSearch = await request(
        "/api/community/users?q=members611",
        outsider.cookie
      );

      assert.equal(publicSearch.status, 200);
      assert.deepEqual(publicSearch.body.users, []);

      for (const result of [ownerView, memberView]) {
        const serialized = JSON.stringify(result.body);

        assert.doesNotMatch(serialized, /@example\.test/);
        assert.doesNotMatch(
          serialized,
          /passwordHash|passwordSalt|authVersion|sessionSecret/
        );
      }

      const privateList = await request(
        "/api/lists",
        owner.cookie,
        "POST",
        {
          name: "QA privada 611",
          visibility: "private"
        }
      );

      assert.equal(privateList.status, 201);

      const privateMembers = await request(
        `/api/lists/${encodeURIComponent(privateList.body.id)}/members`,
        owner.cookie
      );

      assert.equal(privateMembers.status, 404);

    } finally {
      if (child && child.exitCode === null) {
        const exit = once(child, "exit");
        child.kill("SIGTERM");

        await Promise.race([
          exit,
          new Promise(resolve => setTimeout(resolve, 2000))
        ]);

        if (child.exitCode === null) {
          child.kill("SIGKILL");
          await exit;
        }
      }

      if (mailbox) await mailbox.close();

      fs.rmSync(directory, {
        recursive: true,
        force: true
      });
    }
  }
);
