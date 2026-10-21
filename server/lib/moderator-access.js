const USER_ID_PATTERN =
  /^[a-zA-Z0-9_-]{1,128}$/;

export function normalizeModeratorUserIds(value) {
  if (typeof value !== "string") {
    return [];
  }

  return [
    ...new Set(
      value
        .split(",")
        .map((id) => id.trim())
        .filter((id) =>
          USER_ID_PATTERN.test(id)
        )
    )
  ];
}

export function isModeratorUserId(
  userId,
  configuredUserIds
) {
  if (
    typeof userId !== "string" ||
    !USER_ID_PATTERN.test(userId)
  ) {
    return false;
  }

  return normalizeModeratorUserIds(
    configuredUserIds
  ).includes(userId);
}
