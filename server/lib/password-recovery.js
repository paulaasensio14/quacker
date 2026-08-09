import crypto from "crypto";

export const PASSWORD_RESET_TOKEN_BYTES = 32;

export const PASSWORD_RESET_TOKEN_TTL_MS =
  30 * 60 * 1000;

function _normalizeToken(value) {
  return String(value || "").trim();
}

function _normalizeTokenHash(value) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

export function hashPasswordResetToken(token) {
  const normalizedToken = _normalizeToken(token);

  if (!normalizedToken) {
    const error = new Error(
      "El token de recuperación no puede estar vacío."
    );

    error.code = "INVALID_PASSWORD_RESET_TOKEN";

    throw error;
  }

  return crypto
    .createHash("sha256")
    .update(normalizedToken, "utf8")
    .digest("hex");
}

export function createPasswordResetToken({
  now = Date.now,
  randomBytes = crypto.randomBytes,
  ttlMs = PASSWORD_RESET_TOKEN_TTL_MS
} = {}) {
  if (typeof now !== "function") {
    const error = new Error(
      "El reloj de recuperación debe ser una función."
    );

    error.code = "INVALID_PASSWORD_RESET_CLOCK";

    throw error;
  }

  if (typeof randomBytes !== "function") {
    const error = new Error(
      "El generador aleatorio debe ser una función."
    );

    error.code = "INVALID_PASSWORD_RESET_RANDOM_SOURCE";

    throw error;
  }

  const normalizedTtlMs = Number(ttlMs);

  if (
    !Number.isFinite(normalizedTtlMs) ||
    normalizedTtlMs <= 0
  ) {
    const error = new Error(
      "La duración del token de recuperación debe ser positiva."
    );

    error.code = "INVALID_PASSWORD_RESET_TTL";

    throw error;
  }

  const issuedAt = Number(now());

  if (!Number.isFinite(issuedAt)) {
    const error = new Error(
      "El reloj de recuperación devolvió un valor inválido."
    );

    error.code = "INVALID_PASSWORD_RESET_TIME";

    throw error;
  }

  const randomValue =
    randomBytes(PASSWORD_RESET_TOKEN_BYTES);

  if (
    !Buffer.isBuffer(randomValue) ||
    randomValue.length !== PASSWORD_RESET_TOKEN_BYTES
  ) {
    const error = new Error(
      "El generador aleatorio devolvió un valor inválido."
    );

    error.code = "INVALID_PASSWORD_RESET_RANDOM_VALUE";

    throw error;
  }

  const token = randomValue.toString("base64url");

  return Object.freeze({
    token,
    tokenHash: hashPasswordResetToken(token),
    issuedAt,
    expiresAt:
      issuedAt + Math.floor(normalizedTtlMs)
  });
}

export function verifyPasswordResetToken({
  token,
  tokenHash,
  expiresAt,
  now = Date.now
} = {}) {
  const normalizedToken = _normalizeToken(token);
  const normalizedHash =
    _normalizeTokenHash(tokenHash);

  if (
    !normalizedToken ||
    !/^[a-f0-9]{64}$/.test(normalizedHash)
  ) {
    return false;
  }

  if (typeof now !== "function") {
    return false;
  }

  const currentTime = Number(now());
  const normalizedExpiresAt = Number(expiresAt);

  if (
    !Number.isFinite(currentTime) ||
    !Number.isFinite(normalizedExpiresAt) ||
    currentTime >= normalizedExpiresAt
  ) {
    return false;
  }

  const computedHash =
    hashPasswordResetToken(normalizedToken);

  const storedBuffer =
    Buffer.from(normalizedHash, "hex");

  const computedBuffer =
    Buffer.from(computedHash, "hex");

  if (
    storedBuffer.length !==
    computedBuffer.length
  ) {
    return false;
  }

  return crypto.timingSafeEqual(
    storedBuffer,
    computedBuffer
  );
}

export function createPasswordResetUrl(token) {
  const normalizedToken =
    _normalizeToken(token);

  if (!normalizedToken) {
    const error = new Error(
      "El token de recuperación no puede estar vacío."
    );

    error.code =
      "INVALID_PASSWORD_RESET_TOKEN";

    throw error;
  }

  return (
    "https://quacker.es/#reset=" +
    encodeURIComponent(normalizedToken)
  );
}

export function findPasswordResetUserId(
  users,
  token,
  {
    now = Date.now
  } = {}
) {
  const normalizedToken =
    _normalizeToken(token);

  if (
    !normalizedToken ||
    !users ||
    typeof users !== "object" ||
    Array.isArray(users)
  ) {
    return null;
  }

  for (
    const [userId, userBucket]
    of Object.entries(users)
  ) {
    if (
      !userBucket ||
      typeof userBucket !== "object" ||
      Array.isArray(userBucket)
    ) {
      continue;
    }

    const passwordReset =
      userBucket?.auth?.passwordReset;

    const isValid =
      verifyPasswordResetToken({
        token: normalizedToken,
        tokenHash:
          passwordReset?.tokenHash,
        expiresAt:
          passwordReset?.expiresAt,
        now
      });

    if (isValid) {
      return userId;
    }
  }

  return null;
}

export function getNextPasswordAuthVersion(
  auth = {}
) {
  const currentVersion =
    Number(auth?.authVersion);

  if (
    Number.isSafeInteger(currentVersion) &&
    currentVersion >= 1
  ) {
    return currentVersion + 1;
  }

  return 2;
}

export function storePasswordResetChallenge(
  userBucket,
  recovery
) {
  if (
    !userBucket ||
    typeof userBucket !== "object" ||
    Array.isArray(userBucket)
  ) {
    const error = new Error(
      "El usuario de recuperación no es válido."
    );

    error.code =
      "INVALID_PASSWORD_RESET_USER";

    throw error;
  }

  const tokenHash =
    _normalizeTokenHash(
      recovery?.tokenHash
    );

  const issuedAt =
    Number(recovery?.issuedAt);

  const expiresAt =
    Number(recovery?.expiresAt);

  if (
    !/^[a-f0-9]{64}$/.test(tokenHash) ||
    !Number.isFinite(issuedAt) ||
    !Number.isFinite(expiresAt) ||
    expiresAt <= issuedAt
  ) {
    const error = new Error(
      "El desafío de recuperación no es válido."
    );

    error.code =
      "INVALID_PASSWORD_RESET_CHALLENGE";

    throw error;
  }

  userBucket.auth =
    userBucket.auth &&
    typeof userBucket.auth === "object" &&
    !Array.isArray(userBucket.auth)
      ? userBucket.auth
      : {};

  userBucket.auth.passwordReset = {
    tokenHash,
    issuedAt,
    expiresAt
  };

  return userBucket.auth.passwordReset;
}

export function applyPasswordCredentialReset(
  userBucket,
  {
    passwordSalt,
    passwordHash
  } = {}
) {
  if (
    !userBucket ||
    typeof userBucket !== "object" ||
    Array.isArray(userBucket)
  ) {
    const error = new Error(
      "El usuario de recuperación no es válido."
    );

    error.code =
      "INVALID_PASSWORD_RESET_USER";

    throw error;
  }

  const normalizedSalt =
    String(passwordSalt || "").trim();

  const normalizedHash =
    String(passwordHash || "").trim();

  if (
    !normalizedSalt ||
    !normalizedHash
  ) {
    const error = new Error(
      "Las nuevas credenciales no son válidas."
    );

    error.code =
      "INVALID_PASSWORD_RESET_CREDENTIALS";

    throw error;
  }

  userBucket.auth =
    userBucket.auth &&
    typeof userBucket.auth === "object" &&
    !Array.isArray(userBucket.auth)
      ? userBucket.auth
      : {};

  const nextAuthVersion =
    getNextPasswordAuthVersion(
      userBucket.auth
    );

  userBucket.auth.passwordSalt =
    normalizedSalt;

  userBucket.auth.passwordHash =
    normalizedHash;

  userBucket.auth.authVersion =
    nextAuthVersion;

  delete userBucket.auth.passwordReset;

  return nextAuthVersion;
}
