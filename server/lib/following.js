function normalizeUserId(value) {
  if (typeof value !== "string") return "";

  return value.trim();
}

export function normalizeFollowing(
  value,
  {
    ownerUserId = ""
  } = {}
) {
  if (!Array.isArray(value)) return [];

  const normalizedOwnerUserId =
    normalizeUserId(ownerUserId);

  const seen = new Set();
  const following = [];

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
    following.push(userId);
  }

  return following;
}

export function addFollowing(
  following,
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
      error: "invalid_follow_target"
    };
  }

  if (
    normalizedOwnerUserId &&
    normalizedTargetUserId === normalizedOwnerUserId
  ) {
    return {
      ok: false,
      error: "cannot_follow_self"
    };
  }

  const normalizedFollowing =
    normalizeFollowing(
      following,
      {
        ownerUserId: normalizedOwnerUserId
      }
    );

  if (
    normalizedFollowing.includes(
      normalizedTargetUserId
    )
  ) {
    return {
      ok: false,
      error: "already_following"
    };
  }

  return {
    ok: true,
    following: [
      ...normalizedFollowing,
      normalizedTargetUserId
    ]
  };
}

export function removeFollowing(
  following,
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
      error: "invalid_follow_target"
    };
  }

  const normalizedFollowing =
    normalizeFollowing(
      following,
      {
        ownerUserId
      }
    );

  if (
    !normalizedFollowing.includes(
      normalizedTargetUserId
    )
  ) {
    return {
      ok: false,
      error: "not_following"
    };
  }

  return {
    ok: true,
    following: normalizedFollowing.filter(
      (userId) =>
        userId !== normalizedTargetUserId
    )
  };
}
