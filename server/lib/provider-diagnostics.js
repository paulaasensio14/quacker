function normalizeText(value) {
  return String(value || "").trim();
}

function normalizeStatus(value) {
  const status = Number(value);

  return Number.isInteger(status) &&
    status >= 100 &&
    status <= 599
    ? status
    : null;
}

function normalizeNetworkCode(error) {
  const value = normalizeText(
    error?.cause?.code ||
    error?.code
  ).toUpperCase();

  return /^[A-Z0-9_]+$/.test(value)
    ? value
    : null;
}

function classifyProviderError(error, status, networkCode) {
  const message = normalizeText(error?.message).toLowerCase();

  if (
    status === 504 ||
    error?.name === "TimeoutError" ||
    message.includes("timeout")
  ) {
    return "timeout";
  }

  if (
    message.includes("api_key") ||
    message.includes("api key")
  ) {
    return "configuration";
  }

  if (status !== null) {
    return "http";
  }

  if (networkCode) {
    return "network";
  }

  return "unknown";
}

export function buildProviderDiagnostic({
  provider,
  operation,
  error,
  durationMs
} = {}) {
  const status = normalizeStatus(error?.status);
  const networkCode = normalizeNetworkCode(error);
  const numericDuration = Number(durationMs);

  return {
    provider: normalizeText(provider) || "unknown",
    operation: normalizeText(operation) || "unknown",
    kind: classifyProviderError(
      error,
      status,
      networkCode
    ),
    status,
    networkCode,
    durationMs:
      Number.isFinite(numericDuration) &&
      numericDuration >= 0
        ? Math.round(numericDuration)
        : null
  };
}
