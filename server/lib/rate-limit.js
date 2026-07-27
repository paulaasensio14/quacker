function _createRateLimitError(
  message,
  code
) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function _normalizePositiveInteger(
  value,
  field,
  code
) {
  const normalizedValue = Number(value);

  if (
    !Number.isInteger(normalizedValue) ||
    normalizedValue <= 0
  ) {
    throw _createRateLimitError(
      `${field} debe ser un número entero positivo.`,
      code
    );
  }

  return normalizedValue;
}

function _normalizeKey(value) {
  return String(value ?? "").trim() || "unknown";
}

export function createSlidingWindowRateLimiter({
  windowMs,
  maxAttempts,
  maxEntries = 1000,
  now = Date.now
} = {}) {
  const normalizedWindowMs =
    _normalizePositiveInteger(
      windowMs,
      "windowMs",
      "INVALID_RATE_LIMIT_WINDOW"
    );

  const normalizedMaxAttempts =
    _normalizePositiveInteger(
      maxAttempts,
      "maxAttempts",
      "INVALID_RATE_LIMIT_MAX_ATTEMPTS"
    );

  const normalizedMaxEntries =
    _normalizePositiveInteger(
      maxEntries,
      "maxEntries",
      "INVALID_RATE_LIMIT_MAX_ENTRIES"
    );

  if (typeof now !== "function") {
    throw _createRateLimitError(
      "now debe ser una función.",
      "INVALID_RATE_LIMIT_CLOCK"
    );
  }

  const attemptsByKey = new Map();

  function _readNow() {
    const currentTime = Number(now());

    if (!Number.isFinite(currentTime)) {
      throw _createRateLimitError(
        "El reloj del limitador devolvió un valor inválido.",
        "INVALID_RATE_LIMIT_TIME"
      );
    }

    return currentTime;
  }

  function _getFreshAttempts(
    key,
    currentTime
  ) {
    return (attemptsByKey.get(key) || [])
      .filter(
        (timestamp) =>
          Number.isFinite(timestamp) &&
          currentTime - timestamp <
            normalizedWindowMs
      );
  }

  function _storeFreshAttempts(
    key,
    attempts
  ) {
    if (attempts.length) {
      attemptsByKey.set(key, attempts);
      return;
    }

    attemptsByKey.delete(key);
  }

  function _createStatus(
    attempts,
    currentTime
  ) {
    const blocked =
      attempts.length >=
      normalizedMaxAttempts;

    let retryAfterMs = 0;

    if (blocked) {
      retryAfterMs = Math.max(
        1,
        normalizedWindowMs -
          (currentTime - attempts[0])
      );
    }

    return {
      allowed: !blocked,
      remaining: Math.max(
        0,
        normalizedMaxAttempts -
          attempts.length
      ),
      retryAfterMs,
      retryAfterSeconds:
        retryAfterMs > 0
          ? Math.ceil(retryAfterMs / 1000)
          : 0
    };
  }

  function _cleanup(currentTime) {
    for (
      const [key, storedAttempts]
      of attemptsByKey.entries()
    ) {
      const freshAttempts =
        storedAttempts.filter(
          (timestamp) =>
            Number.isFinite(timestamp) &&
            currentTime - timestamp <
              normalizedWindowMs
        );

      _storeFreshAttempts(
        key,
        freshAttempts
      );
    }

    if (
      attemptsByKey.size <=
      normalizedMaxEntries
    ) {
      return;
    }

    const orderedEntries = [
      ...attemptsByKey.entries()
    ].sort((left, right) => {
      const leftLastAttempt =
        left[1].at(-1) || 0;

      const rightLastAttempt =
        right[1].at(-1) || 0;

      return (
        leftLastAttempt -
        rightLastAttempt
      );
    });

    const overflow =
      attemptsByKey.size -
      normalizedMaxEntries;

    for (
      let index = 0;
      index < overflow;
      index += 1
    ) {
      attemptsByKey.delete(
        orderedEntries[index][0]
      );
    }
  }

  function check(keyValue) {
    const currentTime = _readNow();
    const key = _normalizeKey(keyValue);

    const freshAttempts =
      _getFreshAttempts(
        key,
        currentTime
      );

    _storeFreshAttempts(
      key,
      freshAttempts
    );

    _cleanup(currentTime);

    return _createStatus(
      freshAttempts,
      currentTime
    );
  }

  function consume(keyValue) {
    const currentTime = _readNow();
    const key = _normalizeKey(keyValue);

    const freshAttempts =
      _getFreshAttempts(
        key,
        currentTime
      );

    const currentStatus =
      _createStatus(
        freshAttempts,
        currentTime
      );

    if (!currentStatus.allowed) {
      _storeFreshAttempts(
        key,
        freshAttempts
      );

      _cleanup(currentTime);

      return currentStatus;
    }

    freshAttempts.push(currentTime);

    attemptsByKey.set(
      key,
      freshAttempts
    );

    _cleanup(currentTime);

    return {
      allowed: true,
      remaining: Math.max(
        0,
        normalizedMaxAttempts -
          freshAttempts.length
      ),
      retryAfterMs: 0,
      retryAfterSeconds: 0
    };
  }

  function reset(keyValue) {
    attemptsByKey.delete(
      _normalizeKey(keyValue)
    );
  }

  function clear() {
    attemptsByKey.clear();
  }

  function size() {
    return attemptsByKey.size;
  }

  return Object.freeze({
    check,
    consume,
    reset,
    clear,
    size
  });
}
