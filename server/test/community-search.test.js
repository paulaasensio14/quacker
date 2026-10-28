import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import test from "node:test";

const moduleUrl = new URL(
  "../lib/community-search.js",
  import.meta.url
);

const communityModule = existsSync(moduleUrl)
  ? await import(moduleUrl.href)
  : null;

const searchCommunityUsers =
  communityModule?.searchCommunityUsers;

const missing = typeof searchCommunityUsers !== "function";

function fixture() {
  return {
    u_viewer: {
      profile: {
        name: "Usuario actual",
        handle: "@viewer"
      },
      privacy: { profileVisibility: "public" },
      blockedUserIds: ["u_blocked_by_viewer"]
    },
    u_alba: {
      profile: {
        name: "Álba Cine",
        handle: "@alba_cine",
        avatar: "/assets/img/avatar.png",
        email: "private@example.com"
      },
      privacy: { profileVisibility: "public" }
    },
    u_olga: {
      profile: {
        name: "Colega de Álba",
        handle: "@olga",
        avatar: "javascript:alert(1)"
      },
      privacy: { profileVisibility: "followers" }
    },
    u_hidden: {
      profile: {
        name: "Alba Oculta",
        handle: "@alba_hidden"
      },
      privacy: { profileVisibility: "hidden" }
    },
    u_legacy: {
      profile: {
        name: "Alba Antigua",
        handle: "@alba_legacy"
      }
    },
    u_blocked_by_viewer: {
      profile: {
        name: "Alba Bloqueada",
        handle: "@alba_blocked"
      },
      privacy: { profileVisibility: "public" }
    },
    u_blocks_viewer: {
      profile: {
        name: "Alba Bloqueante",
        handle: "@alba_blocker"
      },
      privacy: { profileVisibility: "public" },
      blockedUserIds: ["u_viewer"]
    }
  };
}

function search(users, query, options = {}) {
  return searchCommunityUsers(users, query, {
    viewerUserId: "u_viewer",
    ...options
  });
}

test("QA-010: existe el módulo de búsqueda segura", () => {
  assert.equal(
    typeof searchCommunityUsers,
    "function",
    "QA-010: falta implementar searchCommunityUsers"
  );
});

test(
  "QA-010: busca por nombre y usuario sin tildes ni mayúsculas",
  { skip: missing },
  () => {
    const results = search(fixture(), "  @ALBA  ");

    assert.deepEqual(
      results.map((user) => user.username),
      ["alba_cine", "olga"]
    );
  }
);

test(
  "QA-010: excluye perfiles ocultos y privados por defecto",
  { skip: missing },
  () => {
    const results = search(fixture(), "alba");
    const names = results.map((user) => user.username);

    assert.ok(!names.includes("alba_hidden"));
    assert.ok(!names.includes("alba_legacy"));
  }
);

test(
  "QA-010: respeta bloqueos en ambas direcciones",
  { skip: missing },
  () => {
    const results = search(fixture(), "alba");
    const names = results.map((user) => user.username);

    assert.ok(!names.includes("alba_blocked"));
    assert.ok(!names.includes("alba_blocker"));
  }
);

test(
  "QA-010: entrega solo identidad pública segura",
  { skip: missing },
  () => {
    const results = search(fixture(), "alba");

    assert.deepEqual(results, [
      {
        name: "Álba Cine",
        username: "alba_cine",
        avatar: "/assets/img/avatar.png"
      },
      {
        name: "Colega de Álba",
        username: "olga",
        avatar: ""
      }
    ]);

    assert.ok(!JSON.stringify(results).includes("private@example.com"));
    assert.ok(!JSON.stringify(results).includes("u_alba"));
  }
);

test(
  "QA-010: limita resultados a un máximo de veinte",
  { skip: missing },
  () => {
    const users = fixture();

    for (let i = 0; i < 30; i++) {
      users[`u_extra_${i}`] = {
        profile: {
          name: `Alba ${i}`,
          handle: `@alba_${String(i).padStart(2, "0")}`
        },
        privacy: { profileVisibility: "public" }
      };
    }

    const results = search(users, "alba", {
      limit: 1000
    });

    assert.equal(results.length, 20);
  }
);

test(
  "QA-010: evita enumeración sin búsqueda o sesión válida",
  { skip: missing },
  () => {
    const users = fixture();

    assert.deepEqual(search(users, ""), []);
    assert.deepEqual(search(users, "a"), []);
    assert.deepEqual(search(users, "@"), []);

    assert.deepEqual(
      search(users, "alba", { viewerUserId: "" }),
      []
    );

    assert.deepEqual(
      search(users, "alba", {
        viewerUserId: "usuario_inexistente"
      }),
      []
    );
  }
);
