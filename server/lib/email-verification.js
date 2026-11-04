import crypto from "node:crypto";

import {
  normalizeAccountEmail,
  validateAccountEmail
} from "./account-validation.js";

export const EMAIL_VERIFICATION_TOKEN_BYTES = 32;

export const EMAIL_VERIFICATION_TTL_MS =
  24 * 60 * 60 * 1000;

function getPendingRegistrations(db) {
  if (
    !db ||
    typeof db !== "object" ||
    Array.isArray(db)
  ) {
    throw new TypeError(
      "La base de datos de verificación no es válida."
    );
  }

  if (db.pendingRegistrations === undefined) {
    db.pendingRegistrations = {};
  }

  if (
    !db.pendingRegistrations ||
    typeof db.pendingRegistrations !== "object" ||
    Array.isArray(db.pendingRegistrations)
  ) {
    throw new TypeError(
      "Las solicitudes pendientes no son válidas."
    );
  }

  return db.pendingRegistrations;
}

function getCurrentTime(now) {
  if (typeof now !== "function") {
    throw new TypeError("Reloj de verificación inválido.");
  }

  const value = Number(now());

  if (!Number.isSafeInteger(value) || value < 0) {
    throw new TypeError("Fecha de verificación inválida.");
  }

  return value;
}

function createToken(randomBytes) {
  if (typeof randomBytes !== "function") {
    throw new TypeError(
      "Generador de tokens inválido."
    );
  }

  const value = randomBytes(
    EMAIL_VERIFICATION_TOKEN_BYTES
  );

  if (
    !Buffer.isBuffer(value) ||
    value.length !== EMAIL_VERIFICATION_TOKEN_BYTES
  ) {
    throw new TypeError(
      "El generador ha devuelto un token inválido."
    );
  }

  return value.toString("base64url");
}

function hashToken(token) {
  return crypto
    .createHash("sha256")
    .update(token, "utf8")
    .digest("hex");
}

function isTokenMatch(token, tokenHash) {
  if (
    typeof token !== "string" ||
    !/^[A-Za-z0-9_-]{43}$/.test(token) ||
    typeof tokenHash !== "string" ||
    !/^[a-f0-9]{64}$/.test(tokenHash)
  ) {
    return false;
  }

  const receivedHash = Buffer.from(
    hashToken(token),
    "hex"
  );

  const expectedHash = Buffer.from(
    tokenHash,
    "hex"
  );

  return crypto.timingSafeEqual(
    receivedHash,
    expectedHash
  );
}

export function createPendingRegistration({
  db,
  email,
  name,
  language = "es",
  passwordSalt,
  passwordHash,
  now = Date.now,
  randomBytes = crypto.randomBytes
} = {}) {
  const currentTime = getCurrentTime(now);
  const pendingRegistrations =
    getPendingRegistrations(db);

  const normalizedEmail =
    normalizeAccountEmail(email);

  if (
    !normalizedEmail ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
      normalizedEmail
    ) ||
    normalizedEmail.length > 254
  ) {
    throw new TypeError(
      "Dirección de correo inválida."
    );
  }

  if (
    typeof name !== "string" ||
    !name.trim() ||
    typeof passwordSalt !== "string" ||
    !passwordSalt ||
    typeof passwordHash !== "string" ||
    !passwordHash
  ) {
    throw new TypeError(
      "Datos de registro incompletos."
    );
  }

  if (
    Object.values(db.users || {}).some(
      user =>
        normalizeAccountEmail(
          user?.profile?.email
        ) === normalizedEmail
    )
  ) {
    const error = new Error(
      "La dirección ya pertenece a una cuenta."
    );

    error.code = "email_in_use";
    throw error;
  }

  // No sobrescribir solicitudes existentes y vigentes.
  for (const pending of Object.values(
    pendingRegistrations
  )) {
    if (
      normalizeAccountEmail(pending?.email) ===
        normalizedEmail &&
      Number(pending?.expiresAt) > currentTime
    ) {
      const error = new Error(
        "Existe una verificación pendiente."
      );

      error.code = "verification_pending";
      throw error;
    }
  }

  // Retirar únicamente solicitudes caducadas del mismo correo.
  // Las solicitudes vigentes de otros usuarios se conservan.
  for (const [requestId, pending] of Object.entries(
    pendingRegistrations
  )) {
    if (
      normalizeAccountEmail(pending?.email) === normalizedEmail &&
      Number(pending?.expiresAt) <= currentTime
    ) {
      delete pendingRegistrations[requestId];
    }
  }

  const token = createToken(randomBytes);
  const tokenHash = hashToken(token);

  // Identificador interno derivado del hash, no del correo.
  const requestId = tokenHash;

  if (
    Object.hasOwn(
      pendingRegistrations,
      requestId
    )
  ) {
    throw new Error(
      "Colisión de identificador de verificación."
    );
  }

  const expiresAt =
    currentTime + EMAIL_VERIFICATION_TTL_MS;

  if (!Number.isSafeInteger(expiresAt)) {
    throw new TypeError(
      "Caducidad de verificación inválida."
    );
  }

  pendingRegistrations[requestId] = {
    email: normalizedEmail,
    name: name.trim(),
    language: language === "en" ? "en" : "es",
    passwordSalt,
    passwordHash,
    tokenHash,
    createdAt: currentTime,
    expiresAt
  };

  return {
    token,
    requestId,
    expiresAt
  };
}

export function verifyPendingRegistration({
  db,
  token,
  now = Date.now
} = {}) {
  const currentTime = getCurrentTime(now);
  const pendingRegistrations =
    getPendingRegistrations(db);

  if (
    typeof token !== "string" ||
    !/^[A-Za-z0-9_-]{43}$/.test(token)
  ) {
    return { ok: false };
  }

  const requestId = hashToken(token);

  const pending =
    pendingRegistrations[requestId];

  if (
    !pending ||
    !Number.isFinite(
      Number(pending.expiresAt)
    ) ||
    currentTime >= Number(pending.expiresAt) ||
    !isTokenMatch(
      token,
      pending.tokenHash
    )
  ) {
    return { ok: false };
  }

  if (
    Object.values(db.users || {}).some(
      user =>
        normalizeAccountEmail(
          user?.profile?.email
        ) === pending.email
    )
  ) {
    return { ok: false };
  }

  // Revalidar la solicitud persistida antes de aceptarla.
  const emailValidation = validateAccountEmail(
    pending.email
  );

  if (
    !emailValidation.ok ||
    pending.email !== emailValidation.value ||
    typeof pending.passwordSalt !== "string" ||
    pending.passwordSalt.length === 0 ||
    typeof pending.passwordHash !== "string" ||
    pending.passwordHash.length === 0
  ) {
    return { ok: false };
  }

  const registration = {
    email: pending.email,
    name: pending.name,
    language: pending.language,
    passwordSalt: pending.passwordSalt,
    passwordHash: pending.passwordHash
  };

  // Consumir el token: no podrá verificarse de nuevo.
  delete pendingRegistrations[requestId];

  return {
    ok: true,
    registration
  };
}

export function pruneExpiredRegistrations({
  db,
  now = Date.now
} = {}) {
  const currentTime = getCurrentTime(now);
  const pendingRegistrations =
    getPendingRegistrations(db);

  let removed = 0;

  for (const [requestId, pending] of Object.entries(
    pendingRegistrations
  )) {
    if (
      !Number.isFinite(
        Number(pending?.expiresAt)
      ) ||
      currentTime >= Number(pending.expiresAt)
    ) {
      delete pendingRegistrations[requestId];
      removed += 1;
    }
  }

  return removed;
}
