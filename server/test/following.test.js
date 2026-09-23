import assert from "node:assert/strict";
import test from "node:test";

import {
  addFollowing,
  normalizeFollowing,
  removeFollowing
} from "../lib/following.js";

test("normalizeFollowing devuelve una lista vacía para valores inválidos", () => {
  assert.deepEqual(normalizeFollowing(null), []);
  assert.deepEqual(normalizeFollowing({}), []);
  assert.deepEqual(normalizeFollowing("user-1"), []);
});

test("normalizeFollowing limpia ids inválidos y elimina duplicados", () => {
  assert.deepEqual(
    normalizeFollowing([
      " user-1 ",
      "",
      "user-2",
      "user-1",
      null,
      {},
      "user-2"
    ]),
    [
      "user-1",
      "user-2"
    ]
  );
});

test("normalizeFollowing excluye el propio usuario cuando se indica ownerUserId", () => {
  assert.deepEqual(
    normalizeFollowing(
      [
        "user-1",
        "user-2",
        "user-3"
      ],
      {
        ownerUserId: "user-2"
      }
    ),
    [
      "user-1",
      "user-3"
    ]
  );
});

test("addFollowing añade una relación nueva", () => {
  assert.deepEqual(
    addFollowing(
      ["user-1"],
      "user-2",
      {
        ownerUserId: "owner-1"
      }
    ),
    {
      ok: true,
      following: [
        "user-1",
        "user-2"
      ]
    }
  );
});

test("addFollowing impide seguir al propio usuario", () => {
  assert.deepEqual(
    addFollowing(
      [],
      "owner-1",
      {
        ownerUserId: "owner-1"
      }
    ),
    {
      ok: false,
      error: "cannot_follow_self"
    }
  );
});

test("addFollowing impide duplicar una relación existente", () => {
  assert.deepEqual(
    addFollowing(
      ["user-2"],
      " user-2 ",
      {
        ownerUserId: "owner-1"
      }
    ),
    {
      ok: false,
      error: "already_following"
    }
  );
});

test("addFollowing rechaza un usuario objetivo inválido", () => {
  assert.deepEqual(
    addFollowing(
      [],
      "",
      {
        ownerUserId: "owner-1"
      }
    ),
    {
      ok: false,
      error: "invalid_follow_target"
    }
  );
});

test("removeFollowing elimina una relación existente", () => {
  assert.deepEqual(
    removeFollowing(
      [
        "user-1",
        "user-2"
      ],
      "user-1",
      {
        ownerUserId: "owner-1"
      }
    ),
    {
      ok: true,
      following: [
        "user-2"
      ]
    }
  );
});

test("removeFollowing informa cuando la relación no existe", () => {
  assert.deepEqual(
    removeFollowing(
      ["user-1"],
      "user-2",
      {
        ownerUserId: "owner-1"
      }
    ),
    {
      ok: false,
      error: "not_following"
    }
  );
});
