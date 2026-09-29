import assert from "node:assert/strict";
import test from "node:test";

import {
  acceptCollaborativeListInvite,
  addCollaborativeListInvite,
  normalizeCollaborativeList,
  removeCollaborativeListInvite
} from "../lib/collaborative-lists.js";


test(
  "normalizeCollaborativeList normaliza invitaciones pendientes sin propietario, colaboradores ni duplicados",
  () => {
    const result =
      normalizeCollaborativeList({
        id: "list-1",
        ownerUserId: "owner-1",
        collaborators: [
          "user-2"
        ],
        invitedUserIds: [
          " user-3 ",
          "user-3",
          "owner-1",
          "user-2",
          "",
          null
        ]
      });

    assert.deepEqual(
      result.invitedUserIds,
      [
        "user-3"
      ]
    );
  }
);


test(
  "addCollaborativeListInvite añade una invitación válida sin mutar la lista original",
  () => {
    const original = {
      id: "list-1",
      ownerUserId: "owner-1",
      collaborators: [],
      invitedUserIds: []
    };

    const result =
      addCollaborativeListInvite(
        original,
        " user-2 "
      );

    assert.equal(
      result.ok,
      true
    );

    assert.deepEqual(
      result.list.invitedUserIds,
      [
        "user-2"
      ]
    );

    assert.deepEqual(
      original.invitedUserIds,
      []
    );
  }
);


test(
  "addCollaborativeListInvite impide invitar al propietario",
  () => {
    const result =
      addCollaborativeListInvite(
        {
          ownerUserId: "owner-1",
          collaborators: [],
          invitedUserIds: []
        },
        "owner-1"
      );

    assert.deepEqual(
      result,
      {
        ok: false,
        error: "cannot_invite_owner"
      }
    );
  }
);


test(
  "addCollaborativeListInvite impide invitar a un colaborador existente",
  () => {
    const result =
      addCollaborativeListInvite(
        {
          ownerUserId: "owner-1",
          collaborators: [
            "user-2"
          ],
          invitedUserIds: []
        },
        "user-2"
      );

    assert.deepEqual(
      result,
      {
        ok: false,
        error: "already_collaborator"
      }
    );
  }
);


test(
  "addCollaborativeListInvite impide duplicar una invitación pendiente",
  () => {
    const result =
      addCollaborativeListInvite(
        {
          ownerUserId: "owner-1",
          collaborators: [],
          invitedUserIds: [
            "user-2"
          ]
        },
        "user-2"
      );

    assert.deepEqual(
      result,
      {
        ok: false,
        error: "invite_exists"
      }
    );
  }
);


test(
  "acceptCollaborativeListInvite mueve al usuario de invitado a colaborador",
  () => {
    const result =
      acceptCollaborativeListInvite(
        {
          id: "list-1",
          ownerUserId: "owner-1",
          collaborators: [
            "user-3"
          ],
          invitedUserIds: [
            "user-2"
          ]
        },
        "user-2"
      );

    assert.equal(
      result.ok,
      true
    );

    assert.deepEqual(
      result.list.collaborators,
      [
        "user-3",
        "user-2"
      ]
    );

    assert.deepEqual(
      result.list.invitedUserIds,
      []
    );
  }
);


test(
  "acceptCollaborativeListInvite rechaza una invitación inexistente",
  () => {
    const result =
      acceptCollaborativeListInvite(
        {
          ownerUserId: "owner-1",
          collaborators: [],
          invitedUserIds: []
        },
        "user-2"
      );

    assert.deepEqual(
      result,
      {
        ok: false,
        error: "invite_not_found"
      }
    );
  }
);


test(
  "removeCollaborativeListInvite elimina una invitación pendiente",
  () => {
    const result =
      removeCollaborativeListInvite(
        {
          id: "list-1",
          ownerUserId: "owner-1",
          collaborators: [],
          invitedUserIds: [
            "user-2",
            "user-3"
          ]
        },
        "user-2"
      );

    assert.equal(
      result.ok,
      true
    );

    assert.deepEqual(
      result.list.invitedUserIds,
      [
        "user-3"
      ]
    );
  }
);
