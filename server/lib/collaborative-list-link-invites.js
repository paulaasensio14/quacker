import crypto from "node:crypto";

export const COLLABORATIVE_LIST_INVITE_TOKEN_BYTES =
  32;


function _normalizeToken(value) {
  return String(value || "").trim();
}


function _normalizeTokenHash(value) {
  return String(value || "")
    .trim()
    .toLowerCase();
}


export function hashCollaborativeListInviteToken(
  token
) {
  const normalizedToken =
    _normalizeToken(token);

  if (!normalizedToken) {
    const error = new Error(
      "El token de invitación no puede estar vacío."
    );

    error.code =
      "INVALID_COLLABORATIVE_LIST_INVITE_TOKEN";

    throw error;
  }

  return crypto
    .createHash("sha256")
    .update(normalizedToken, "utf8")
    .digest("hex");
}


export function createCollaborativeListInviteToken({
  now = Date.now,
  randomBytes = crypto.randomBytes
} = {}) {
  if (typeof now !== "function") {
    const error = new Error(
      "El reloj de invitación debe ser una función."
    );

    error.code =
      "INVALID_COLLABORATIVE_LIST_INVITE_CLOCK";

    throw error;
  }

  if (typeof randomBytes !== "function") {
    const error = new Error(
      "El generador aleatorio debe ser una función."
    );

    error.code =
      "INVALID_COLLABORATIVE_LIST_INVITE_RANDOM_SOURCE";

    throw error;
  }

  const issuedAt =
    Number(now());

  if (!Number.isFinite(issuedAt)) {
    const error = new Error(
      "El reloj de invitación devolvió un valor inválido."
    );

    error.code =
      "INVALID_COLLABORATIVE_LIST_INVITE_TIME";

    throw error;
  }

  const randomValue =
    randomBytes(
      COLLABORATIVE_LIST_INVITE_TOKEN_BYTES
    );

  if (
    !Buffer.isBuffer(randomValue) ||
    randomValue.length !==
      COLLABORATIVE_LIST_INVITE_TOKEN_BYTES
  ) {
    const error = new Error(
      "El generador aleatorio devolvió un valor inválido."
    );

    error.code =
      "INVALID_COLLABORATIVE_LIST_INVITE_RANDOM_VALUE";

    throw error;
  }

  const token =
    randomValue.toString("base64url");

  return Object.freeze({
    token,
    tokenHash:
      hashCollaborativeListInviteToken(token),
    issuedAt
  });
}


export function verifyCollaborativeListInviteToken({
  token,
  tokenHash
} = {}) {
  const normalizedToken =
    _normalizeToken(token);

  const normalizedHash =
    _normalizeTokenHash(tokenHash);

  if (
    !normalizedToken ||
    !/^[a-f0-9]{64}$/.test(normalizedHash)
  ) {
    return false;
  }

  const computedHash =
    hashCollaborativeListInviteToken(
      normalizedToken
    );

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
