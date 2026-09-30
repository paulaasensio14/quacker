function _normalizeUserId(value) {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim();
}


function _normalizeCollaborators(
  value,
  {
    ownerUserId = ""
  } = {}
) {
  if (!Array.isArray(value)) {
    return [];
  }

  const normalizedOwnerUserId =
    _normalizeUserId(ownerUserId);

  const seen = new Set();
  const collaborators = [];

  for (const entry of value) {
    const userId =
      _normalizeUserId(entry);

    if (
      !userId ||
      userId === normalizedOwnerUserId ||
      seen.has(userId)
    ) {
      continue;
    }

    seen.add(userId);
    collaborators.push(userId);
  }

  return collaborators;
}


function _normalizeInvitedUserIds(
  value,
  {
    ownerUserId = "",
    collaborators = []
  } = {}
) {
  if (!Array.isArray(value)) {
    return [];
  }

  const normalizedOwnerUserId =
    _normalizeUserId(ownerUserId);

  const collaboratorIds =
    new Set(
      _normalizeCollaborators(
        collaborators,
        {
          ownerUserId:
            normalizedOwnerUserId
        }
      )
    );

  const seen = new Set();
  const invitedUserIds = [];

  for (const entry of value) {
    const userId =
      _normalizeUserId(entry);

    if (
      !userId ||
      userId === normalizedOwnerUserId ||
      collaboratorIds.has(userId) ||
      seen.has(userId)
    ) {
      continue;
    }

    seen.add(userId);
    invitedUserIds.push(userId);
  }

  return invitedUserIds;
}


export function normalizeCollaborativeList(
  value,
  {
    fallbackOwnerUserId = ""
  } = {}
) {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value)
  ) {
    return null;
  }

  const ownerUserId =
    _normalizeUserId(
      value.ownerUserId
    ) ||
    _normalizeUserId(
      fallbackOwnerUserId
    );

  const collaborators =
    _normalizeCollaborators(
      value.collaborators,
      {
        ownerUserId
      }
    );

  return {
    ...value,
    ownerUserId,
    collaborators,
    invitedUserIds:
      _normalizeInvitedUserIds(
        value.invitedUserIds,
        {
          ownerUserId,
          collaborators
        }
      )
  };
}


export function normalizeCollaborativeLists(
  value,
  {
    fallbackOwnerUserId = ""
  } = {}
) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map(
      (entry) =>
        normalizeCollaborativeList(
          entry,
          {
            fallbackOwnerUserId
          }
        )
    )
    .filter(Boolean);
}


export function getCollaborativeListRole(
  list,
  userId
) {
  const normalizedUserId =
    _normalizeUserId(userId);

  if (!normalizedUserId) {
    return "";
  }

  const normalizedList =
    normalizeCollaborativeList(
      list
    );

  if (!normalizedList) {
    return "";
  }

  if (
    normalizedList.ownerUserId ===
    normalizedUserId
  ) {
    return "owner";
  }

  if (
    normalizedList.collaborators.includes(
      normalizedUserId
    )
  ) {
    return "collaborator";
  }

  return "";
}

export function addCollaborativeListInvite(
  list,
  userId
) {
  const normalizedList =
    normalizeCollaborativeList(list);

  const normalizedUserId =
    _normalizeUserId(userId);

  if (!normalizedList || !normalizedUserId) {
    return {
      ok: false,
      error: "invalid_invite_target"
    };
  }

  if (
    normalizedList.ownerUserId ===
    normalizedUserId
  ) {
    return {
      ok: false,
      error: "cannot_invite_owner"
    };
  }

  if (
    normalizedList.collaborators.includes(
      normalizedUserId
    )
  ) {
    return {
      ok: false,
      error: "already_collaborator"
    };
  }

  if (
    normalizedList.invitedUserIds.includes(
      normalizedUserId
    )
  ) {
    return {
      ok: false,
      error: "invite_exists"
    };
  }

  return {
    ok: true,
    list: {
      ...normalizedList,
      invitedUserIds: [
        ...normalizedList.invitedUserIds,
        normalizedUserId
      ]
    }
  };
}


export function acceptCollaborativeListInvite(
  list,
  userId
) {
  const normalizedList =
    normalizeCollaborativeList(list);

  const normalizedUserId =
    _normalizeUserId(userId);

  if (
    !normalizedList ||
    !normalizedUserId ||
    !normalizedList.invitedUserIds.includes(
      normalizedUserId
    )
  ) {
    return {
      ok: false,
      error: "invite_not_found"
    };
  }

  return {
    ok: true,
    list: {
      ...normalizedList,
      collaborators: [
        ...normalizedList.collaborators,
        normalizedUserId
      ],
      invitedUserIds:
        normalizedList.invitedUserIds.filter(
          (entry) =>
            entry !== normalizedUserId
        )
    }
  };
}


export function removeCollaborativeListInvite(
  list,
  userId
) {
  const normalizedList =
    normalizeCollaborativeList(list);

  const normalizedUserId =
    _normalizeUserId(userId);

  if (
    !normalizedList ||
    !normalizedUserId ||
    !normalizedList.invitedUserIds.includes(
      normalizedUserId
    )
  ) {
    return {
      ok: false,
      error: "invite_not_found"
    };
  }

  return {
    ok: true,
    list: {
      ...normalizedList,
      invitedUserIds:
        normalizedList.invitedUserIds.filter(
          (entry) =>
            entry !== normalizedUserId
        )
    }
  };
}


export function addCollaborativeListCollaborator(
  list,
  userId
) {
  const normalizedList =
    normalizeCollaborativeList(list);

  const normalizedUserId =
    _normalizeUserId(userId);

  if (
    !normalizedList ||
    !normalizedUserId
  ) {
    return {
      ok: false,
      error: "invalid_collaborator"
    };
  }

  if (
    normalizedList.ownerUserId ===
    normalizedUserId
  ) {
    return {
      ok: false,
      error: "cannot_add_owner"
    };
  }

  if (
    normalizedList.collaborators.includes(
      normalizedUserId
    )
  ) {
    return {
      ok: false,
      error: "already_collaborator"
    };
  }

  return {
    ok: true,
    list:
      normalizeCollaborativeList({
        ...normalizedList,
        collaborators: [
          ...normalizedList.collaborators,
          normalizedUserId
        ],
        invitedUserIds:
          normalizedList.invitedUserIds
      })
  };
}

export function removeCollaborativeListCollaborator(
  list,
  userId
) {
  const normalizedList =
    normalizeCollaborativeList(list);

  const normalizedUserId =
    _normalizeUserId(userId);

  if (
    !normalizedList ||
    !normalizedUserId
  ) {
    return {
      ok: false,
      error: "invalid_collaborator"
    };
  }

  if (
    normalizedList.ownerUserId ===
    normalizedUserId
  ) {
    return {
      ok: false,
      error: "cannot_remove_owner"
    };
  }

  if (
    !normalizedList.collaborators.includes(
      normalizedUserId
    )
  ) {
    return {
      ok: false,
      error: "collaborator_not_found"
    };
  }

  return {
    ok: true,
    list:
      normalizeCollaborativeList({
        ...normalizedList,
        collaborators:
          normalizedList.collaborators.filter(
            (entry) =>
              entry !== normalizedUserId
          )
      })
  };
}
