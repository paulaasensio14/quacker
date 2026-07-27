const BLOCKED_TOP_LEVEL_SEGMENTS =
  new Set([
    "server",
    ".git",
    "node_modules"
  ]);

function _extractRequestPath(value) {
  return String(value ?? "/")
    .split(/[?#]/, 1)[0];
}

function _decodeRequestPath(value) {
  let decoded = _extractRequestPath(
    value
  );

  for (
    let iteration = 0;
    iteration < 4;
    iteration += 1
  ) {
    let nextValue;

    try {
      nextValue =
        decodeURIComponent(decoded);
    } catch {
      return null;
    }

    if (nextValue === decoded) {
      break;
    }

    decoded = nextValue;
  }

  return decoded;
}

export function normalizeStaticRequestSegments(
  value
) {
  const decoded =
    _decodeRequestPath(value);

  if (decoded === null) {
    return null;
  }

  const segments = [];

  for (
    const rawSegment of
    decoded
      .replace(/\\/g, "/")
      .split("/")
  ) {
    if (
      !rawSegment ||
      rawSegment === "."
    ) {
      continue;
    }

    if (rawSegment === "..") {
      if (
        segments.length > 0 &&
        segments.at(-1) !== ".."
      ) {
        segments.pop();
      } else {
        segments.push("..");
      }

      continue;
    }

    segments.push(
      rawSegment.toLowerCase()
    );
  }

  return segments;
}

export function isSensitiveStaticRequestPath(
  value
) {
  const segments =
    normalizeStaticRequestSegments(
      value
    );

  if (segments === null) {
    return true;
  }

  if (
    segments.some(
      (segment) =>
        segment.startsWith(".")
    )
  ) {
    return true;
  }

  return (
    segments.length > 0 &&
    BLOCKED_TOP_LEVEL_SEGMENTS.has(
      segments[0]
    )
  );
}

export function blockSensitiveStaticPaths(
  req,
  res,
  next
) {
  const requestTarget =
    req?.originalUrl ??
    req?.url ??
    req?.path ??
    "/";

  if (
    !isSensitiveStaticRequestPath(
      requestTarget
    )
  ) {
    next();
    return;
  }

  return res
    .status(404)
    .type("text/plain")
    .send("Not Found");
}
