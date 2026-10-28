import assert from "node:assert/strict";
import test from "node:test";

import {
  addUserBlock,
  areUsersBlocked,
  normalizeBlockedUserIds,
  removeUserBlock
} from "../lib/user-blocks.js";

test("normalizeBlockedUserIds devuelve una lista vacía para valores inválidos", () => {
  assert.deepEqual(normalizeBlockedUserIds(null), []);
  assert.deepEqual(normalizeBlockedUserIds({}), []);
  assert.deepEqual(normalizeBlockedUserIds("user-1"), []);
});

test("normalizeBlockedUserIds limpia identificadores y duplicados", () => {
  assert.deepEqual(
    normalizeBlockedUserIds([
      " user-1 ",
      "",
      "user-2",
      "user-1",
      null,
      {},
      "user-2"
    ]),
    ["user-1", "user-2"]
  );
});

test("normalizeBlockedUserIds excluye al propietario", () => {
  assert.deepEqual(
    normalizeBlockedUserIds(
      ["user-1", "owner-1", "user-2"],
      {
        ownerUserId: "owner-1"
      }
    ),
    ["user-1", "user-2"]
  );
});

test("addUserBlock añade un bloqueo nuevo", () => {
  assert.deepEqual(
    addUserBlock(
      ["user-1"],
      " user-2 ",
      {
        ownerUserId: "owner-1"
      }
    ),
    {
      ok: true,
      blockedUserIds: ["user-1", "user-2"]
    }
  );
});

test("addUserBlock impide bloquearse a uno mismo", () => {
  assert.deepEqual(
    addUserBlock(
      [],
      "owner-1",
      {
        ownerUserId: "owner-1"
      }
    ),
    {
      ok: false,
      error: "cannot_block_self"
    }
  );
});

test("addUserBlock rechaza identificadores inválidos", () => {
  for (const target of ["", "  ", null, {}, 123]) {
    assert.deepEqual(
      addUserBlock([], target, {
        ownerUserId: "owner-1"
      }),
      {
        ok: false,
        error: "invalid_block_target"
      }
    );
  }
});

test("addUserBlock impide duplicar un bloqueo", () => {
  assert.deepEqual(
    addUserBlock(
      ["user-2"],
      " user-2 ",
      {
        ownerUserId: "owner-1"
      }
    ),
    {
      ok: false,
      error: "already_blocked"
    }
  );
});

test("removeUserBlock elimina un bloqueo existente", () => {
  assert.deepEqual(
    removeUserBlock(
      ["user-1", "user-2"],
      "user-1",
      {
        ownerUserId: "owner-1"
      }
    ),
    {
      ok: true,
      blockedUserIds: ["user-2"]
    }
  );
});

test("removeUserBlock rechaza identificadores inválidos o ausentes", () => {
  assert.deepEqual(
    removeUserBlock(
      ["user-1"],
      "",
      {
        ownerUserId: "owner-1"
      }
    ),
    {
      ok: false,
      error: "invalid_block_target"
    }
  );

  assert.deepEqual(
    removeUserBlock(
      ["user-1"],
      "user-2",
      {
        ownerUserId: "owner-1"
      }
    ),
    {
      ok: false,
      error: "not_blocked"
    }
  );
});

test("areUsersBlocked detecta bloqueos en ambas direcciones", () => {
  assert.equal(
    areUsersBlocked(
      "user-a",
      ["user-b"],
      "user-b",
      []
    ),
    true
  );

  assert.equal(
    areUsersBlocked(
      "user-a",
      [],
      "user-b",
      ["user-a"]
    ),
    true
  );

  assert.equal(
    areUsersBlocked(
      "user-a",
      [],
      "user-b",
      []
    ),
    false
  );
});

test("areUsersBlocked rechaza identidades inválidas o iguales", () => {
  assert.equal(
    areUsersBlocked("", [], "user-b", []),
    false
  );

  assert.equal(
    areUsersBlocked("user-a", [], "user-a", ["user-a"]),
    false
  );
});

test("las operaciones de bloqueo no modifican los arrays originales", () => {
  const original = ["user-1"];

  addUserBlock(original, "user-2", {
    ownerUserId: "owner-1"
  });

  removeUserBlock(original, "user-1", {
    ownerUserId: "owner-1"
  });

  normalizeBlockedUserIds(original, {
    ownerUserId: "owner-1"
  });

  assert.deepEqual(original, ["user-1"]);
});
