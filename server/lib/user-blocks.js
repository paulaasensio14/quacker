function normalizeUserId(value) {
  if (typeof value !== "string") return "";

  return value.trim();
}

export function normalizeBlockedUserIds(
  value,
  {
    ownerUserId = ""
  } = {}
) {
  if (!Array.isArray(value)) return [];

  const normalizedOwnerUserId =
    normalizeUserId(ownerUserId);

  const seen = new Set();
  const blockedUserIds = [];

  for (const entry of value) {
    const userId = normalizeUserId(entry);

    if (
      !userId ||
      userId === normalizedOwnerUserId ||
      seen.has(userId)
    ) {
      continue;
    }

    seen.add(userId);
    blockedUserIds.push(userId);
  }

  return blockedUserIds;
}

export function addUserBlock(
  blockedUserIds,
  targetUserId,
  {
    ownerUserId = ""
  } = {}
) {
  const normalizedOwnerUserId =
    normalizeUserId(ownerUserId);

  const normalizedTargetUserId =
    normalizeUserId(targetUserId);

  if (!normalizedTargetUserId) {
    return {
      ok: false,
      error: "invalid_block_target"
    };
  }

  if (
    normalizedOwnerUserId &&
    normalizedTargetUserId === normalizedOwnerUserId
  ) {
    return {
      ok: false,
      error: "cannot_block_self"
    };
  }

  const normalizedBlockedUserIds =
    normalizeBlockedUserIds(
      blockedUserIds,
      {
        ownerUserId: normalizedOwnerUserId
      }
    );

  if (
    normalizedBlockedUserIds.includes(
      normalizedTargetUserId
    )
  ) {
    return {
      ok: false,
      error: "already_blocked"
    };
  }

  return {
    ok: true,
    blockedUserIds: [
      ...normalizedBlockedUserIds,
      normalizedTargetUserId
    ]
  };
}

export function removeUserBlock(
  blockedUserIds,
  targetUserId,
  {
    ownerUserId = ""
  } = {}
) {
  const normalizedTargetUserId =
    normalizeUserId(targetUserId);

  if (!normalizedTargetUserId) {
    return {
      ok: false,
      error: "invalid_block_target"
    };
  }

  const normalizedBlockedUserIds =
    normalizeBlockedUserIds(
      blockedUserIds,
      {
        ownerUserId
      }
    );

  if (
    !normalizedBlockedUserIds.includes(
      normalizedTargetUserId
    )
  ) {
    return {
      ok: false,
      error: "not_blocked"
    };
  }

  return {
    ok: true,
    blockedUserIds:
      normalizedBlockedUserIds.filter(
        (userId) =>
          userId !== normalizedTargetUserId
      )
  };
}

export function areUsersBlocked(
  firstUserId,
  firstBlockedUserIds,
  secondUserId,
  secondBlockedUserIds
) {
  const firstId =
    normalizeUserId(firstUserId);

  const secondId =
    normalizeUserId(secondUserId);

  if (
    !firstId ||
    !secondId ||
    firstId === secondId
  ) {
    return false;
  }

  return (
    normalizeBlockedUserIds(
      firstBlockedUserIds,
      {
        ownerUserId: firstId
      }
    ).includes(secondId) ||
    normalizeBlockedUserIds(
      secondBlockedUserIds,
      {
        ownerUserId: secondId
      }
    ).includes(firstId)
  );
}
