import assert from "node:assert/strict";
import test from "node:test";

import {
  normalizeFollowRequests
} from "../lib/follow-requests.js";

test("normalizeFollowRequests devuelve una lista vacía para valores inválidos", () => {
  assert.deepEqual(
    normalizeFollowRequests(null),
    []
  );

  assert.deepEqual(
    normalizeFollowRequests({}),
    []
  );

  assert.deepEqual(
    normalizeFollowRequests("user-1"),
    []
  );
});

test("normalizeFollowRequests limpia ids inválidos y elimina duplicados", () => {
  assert.deepEqual(
    normalizeFollowRequests([
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

test("normalizeFollowRequests excluye el propio usuario cuando se indica ownerUserId", () => {
  assert.deepEqual(
    normalizeFollowRequests(
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

test("addFollowRequest añade una solicitud nueva", async () => {
  const {
    addFollowRequest
  } = await import("../lib/follow-requests.js");

  assert.deepEqual(
    addFollowRequest(
      ["user-1"],
      "user-2",
      {
        ownerUserId: "owner-1"
      }
    ),
    {
      ok: true,
      followRequests: [
        "user-1",
        "user-2"
      ]
    }
  );
});

test("addFollowRequest impide una autosolicitud", async () => {
  const {
    addFollowRequest
  } = await import("../lib/follow-requests.js");

  assert.deepEqual(
    addFollowRequest(
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

test("addFollowRequest impide duplicar una solicitud pendiente", async () => {
  const {
    addFollowRequest
  } = await import("../lib/follow-requests.js");

  assert.deepEqual(
    addFollowRequest(
      ["user-2"],
      " user-2 ",
      {
        ownerUserId: "owner-1"
      }
    ),
    {
      ok: false,
      error: "follow_request_exists"
    }
  );
});

test("removeFollowRequest elimina una solicitud pendiente", async () => {
  const {
    removeFollowRequest
  } = await import("../lib/follow-requests.js");

  assert.deepEqual(
    removeFollowRequest(
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
      followRequests: [
        "user-2"
      ]
    }
  );
});

test("removeFollowRequest informa cuando la solicitud no existe", async () => {
  const {
    removeFollowRequest
  } = await import("../lib/follow-requests.js");

  assert.deepEqual(
    removeFollowRequest(
      ["user-1"],
      "user-2",
      {
        ownerUserId: "owner-1"
      }
    ),
    {
      ok: false,
      error: "follow_request_not_found"
    }
  );
});
