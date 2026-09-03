export function resolveActivityCreatedAt({
  hasExplicitLastActivityAt,
  lastActivityAt,
  nowIso,
  normalize
}) {
  if (!hasExplicitLastActivityAt) {
    return nowIso;
  }

  return normalize(lastActivityAt) || nowIso;
}
