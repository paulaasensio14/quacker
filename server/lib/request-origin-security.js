const SAFE_METHODS = new Set([
  "GET",
  "HEAD",
  "OPTIONS"
]);

function normalizeOrigin(value) {
  if (typeof value !== "string") {
    return null;
  }

  try {
    const url = new URL(value);

    if (
      !["http:", "https:"].includes(url.protocol) ||
      url.username ||
      url.password ||
      url.pathname !== "/" ||
      url.search ||
      url.hash ||
      url.origin === "null"
    ) {
      return null;
    }

    return url.origin;
  } catch {
    return null;
  }
}

export function getAllowedRequestOrigins({
  environment,
  port = 3000
} = {}) {
  if (environment === "production") {
    return [
      "https://quacker.es",
      "https://www.quacker.es"
    ];
  }

  if (
    environment !== "development" &&
    environment !== "test"
  ) {
    throw new Error("INVALID_ORIGIN_ENVIRONMENT");
  }

  const normalizedPort = Number(port);

  if (
    !Number.isInteger(normalizedPort) ||
    normalizedPort < 1 ||
    normalizedPort > 65535
  ) {
    throw new Error("INVALID_ORIGIN_PORT");
  }

  return [
    `http://127.0.0.1:${normalizedPort}`,
    `http://localhost:${normalizedPort}`
  ];
}

export function isRequestOriginAllowed({
  method,
  origin,
  targetOrigin,
  fetchSite,
  allowedOrigins = []
}) {
  const normalizedMethod =
    String(method || "").toUpperCase();

  if (SAFE_METHODS.has(normalizedMethod)) {
    return true;
  }

  const normalizedFetchSite =
    String(fetchSite || "")
      .trim()
      .toLowerCase();

  if (normalizedFetchSite === "cross-site") {
    return false;
  }

  if (
    normalizedFetchSite &&
    normalizedFetchSite !== "same-origin"
  ) {
    return false;
  }

  if (origin === undefined || origin === null) {
    return false;
  }

  const normalizedOrigin = normalizeOrigin(origin);

  if (!normalizedOrigin) {
    return false;
  }

  const normalizedAllowedOrigins =
    allowedOrigins
      .map(normalizeOrigin)
      .filter(Boolean);

  if (
    !normalizedAllowedOrigins.includes(
      normalizedOrigin
    )
  ) {
    return false;
  }

  const normalizedTargetOrigin =
    normalizeOrigin(targetOrigin);

  return (
    normalizedTargetOrigin !== null &&
    normalizedAllowedOrigins.includes(
      normalizedTargetOrigin
    ) &&
    normalizedOrigin === normalizedTargetOrigin
  );
}
