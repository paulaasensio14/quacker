import assert from "node:assert/strict";
import test from "node:test";

import {
  getCollaborativeListRole,
  normalizeCollaborativeList,
  normalizeCollaborativeLists
} from "../lib/collaborative-lists.js";


test(
  "normalizeCollaborativeList migra una lista antigua asignando propietario",
  () => {
    const result =
      normalizeCollaborativeList(
        {
          id: "list-1",
          name: "Películas",
          items: []
        },
        {
          fallbackOwnerUserId: "user-owner"
        }
      );

    assert.deepEqual(
      result,
      {
        id: "list-1",
        name: "Películas",
        items: [],
        ownerUserId: "user-owner",
        collaborators: []
      }
    );
  }
);


test(
  "normalizeCollaborativeList conserva un propietario válido existente",
  () => {
    const result =
      normalizeCollaborativeList(
        {
          id: "list-1",
          ownerUserId: " user-original ",
          collaborators: []
        },
        {
          fallbackOwnerUserId:
            "user-fallback"
        }
      );

    assert.equal(
      result.ownerUserId,
      "user-original"
    );
  }
);


test(
  "normalizeCollaborativeList normaliza colaboradores sin duplicados ni propietario",
  () => {
    const result =
      normalizeCollaborativeList(
        {
          id: "list-1",
          ownerUserId: "owner-1",
          collaborators: [
            " user-2 ",
            "user-3",
            "user-2",
            "owner-1",
            "",
            null,
            {},
            " user-3 "
          ]
        }
      );

    assert.deepEqual(
      result.collaborators,
      [
        "user-2",
        "user-3"
      ]
    );
  }
);


test(
  "normalizeCollaborativeList devuelve null para valores que no son objetos",
  () => {
    assert.equal(
      normalizeCollaborativeList(null),
      null
    );

    assert.equal(
      normalizeCollaborativeList("list-1"),
      null
    );

    assert.equal(
      normalizeCollaborativeList([]),
      null
    );
  }
);


test(
  "normalizeCollaborativeLists normaliza una colección sin mutar los objetos originales",
  () => {
    const original = [
      {
        id: "list-1",
        collaborators: [
          "user-2"
        ]
      },
      {
        id: "list-2"
      }
    ];

    const result =
      normalizeCollaborativeLists(
        original,
        {
          fallbackOwnerUserId:
            "owner-1"
        }
      );

    assert.deepEqual(
      result,
      [
        {
          id: "list-1",
          collaborators: [
            "user-2"
          ],
          ownerUserId:
            "owner-1"
        },
        {
          id: "list-2",
          ownerUserId:
            "owner-1",
          collaborators: []
        }
      ]
    );

    assert.equal(
      Object.hasOwn(
        original[0],
        "ownerUserId"
      ),
      false
    );

    assert.equal(
      Object.hasOwn(
        original[1],
        "collaborators"
      ),
      false
    );
  }
);


test(
  "normalizeCollaborativeLists devuelve vacío para una colección inválida",
  () => {
    assert.deepEqual(
      normalizeCollaborativeLists(null),
      []
    );

    assert.deepEqual(
      normalizeCollaborativeLists({}),
      []
    );
  }
);


test(
  "getCollaborativeListRole distingue propietario, colaborador y usuario ajeno",
  () => {
    const list = {
      ownerUserId: "owner-1",
      collaborators: [
        "user-2",
        "user-3"
      ]
    };

    assert.equal(
      getCollaborativeListRole(
        list,
        "owner-1"
      ),
      "owner"
    );

    assert.equal(
      getCollaborativeListRole(
        list,
        " user-2 "
      ),
      "collaborator"
    );

    assert.equal(
      getCollaborativeListRole(
        list,
        "user-9"
      ),
      ""
    );
  }
);


test(
  "getCollaborativeListRole nunca trata al propietario también como colaborador",
  () => {
    assert.equal(
      getCollaborativeListRole(
        {
          ownerUserId: "owner-1",
          collaborators: [
            "owner-1",
            "user-2"
          ]
        },
        "owner-1"
      ),
      "owner"
    );
  }
);
