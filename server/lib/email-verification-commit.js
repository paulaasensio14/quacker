import {
  isDeepStrictEqual
} from "node:util";

import {
  verifyPendingRegistration
} from "./email-verification.js";

/**
 * Confirma una solicitud sobre una copia independiente
 * y persiste la cuenta y el consumo del token juntos.
 *
 * Todas las funciones recibidas deben ser síncronas.
 *
 * Esta operación debe ejecutarse dentro del mecanismo
 * de serialización de escrituras de la aplicación.
 */
export function commitVerifiedRegistration({
  readDb,
  writeDb,
  createUser,
  token,
  now = Date.now
} = {}) {
  if (
    typeof readDb !== "function" ||
    typeof writeDb !== "function" ||
    typeof createUser !== "function"
  ) {
    throw new TypeError(
      "Dependencias de persistencia inválidas."
    );
  }

  if (typeof now !== "function") {
    throw new TypeError(
      "Reloj de verificación inválido."
    );
  }

  // Los callbacks async no pueden participar en una
  // operación que debe terminar antes de responder.
  const asyncFunctionName = "AsyncFunction";

  if (
    createUser.constructor?.name === asyncFunctionName
  ) {
    throw new TypeError(
      "La creación de usuario debe ser síncrona."
    );
  }

  if (
    writeDb.constructor?.name === asyncFunctionName
  ) {
    throw new TypeError(
      "La escritura debe ser síncrona."
    );
  }

  // Leer los datos actuales y trabajar exclusivamente
  // sobre una copia para evitar mutaciones prematuras.
  const currentDb = readDb();

  if (
    !currentDb ||
    typeof currentDb !== "object" ||
    Array.isArray(currentDb)
  ) {
    throw new TypeError(
      "Base de datos inválida."
    );
  }

  const nextDb = structuredClone(currentDb);

  if (
    !nextDb.users ||
    typeof nextDb.users !== "object" ||
    Array.isArray(nextDb.users)
  ) {
    throw new TypeError(
      "Estructura de usuarios inválida."
    );
  }

  // La verificación modifica únicamente nextDb.
  // El estado persistido todavía permanece intacto.
  const verification = verifyPendingRegistration({
    db: nextDb,
    token,
    now
  });

  if (!verification.ok) {
    return { ok: false };
  }

  // Guardar el estado anterior a la creación.
  const usersBefore = structuredClone(nextDb.users);
  const pendingBefore = structuredClone(
    nextDb.pendingRegistrations
  );
  const registrationBefore = structuredClone(
    verification.registration
  );

  // Crear la cuenta definitiva sobre la misma copia.
  const userId = createUser(
    nextDb,
    verification.registration
  );

  if (
    userId !== null &&
    typeof userId === "object" &&
    typeof userId.then === "function"
  ) {
    throw new TypeError(
      "La creación de usuario debe ser síncrona."
    );
  }

  if (
    typeof userId !== "string" ||
    !userId.trim() ||
    !Object.hasOwn(nextDb.users, userId)
  ) {
    throw new Error(
      "La creación de la cuenta no fue válida."
    );
  }

  if (
    nextDb.users[userId]?.profile?.email !==
    verification.registration.email
  ) {
    throw new Error(
      "El correo de la cuenta creada no coincide."
    );
  }

  // El callback no puede alterar los datos validados.
  if (
    !isDeepStrictEqual(
      verification.registration,
      registrationBefore
    )
  ) {
    throw new Error(
      "Los datos de registro fueron modificados."
    );
  }

  // Ningún usuario existente puede modificarse.
  for (const [existingId, existingUser] of Object.entries(
    usersBefore
  )) {
    if (
      !Object.hasOwn(nextDb.users, existingId) ||
      !isDeepStrictEqual(
        nextDb.users[existingId],
        existingUser
      )
    ) {
      throw new Error(
        "La activación modificó una cuenta existente."
      );
    }
  }

  // Solo puede incorporarse el usuario confirmado.
  const addedUserIds = Object.keys(nextDb.users).filter(
    id => !Object.hasOwn(usersBefore, id)
  );

  if (
    addedUserIds.length !== 1 ||
    addedUserIds[0] !== userId
  ) {
    throw new Error(
      "La activación debe añadir un único usuario."
    );
  }

  // No modificar solicitudes pendientes ajenas.
  if (
    !isDeepStrictEqual(
      nextDb.pendingRegistrations,
      pendingBefore
    )
  ) {
    throw new Error(
      "La activación modificó solicitudes pendientes."
    );
  }

  const createdUser = nextDb.users[userId];

  if (
    !createdUser ||
    typeof createdUser !== "object" ||
    Array.isArray(createdUser) ||
    createdUser.profile?.id !== userId ||
    createdUser.auth?.passwordSalt !==
      registrationBefore.passwordSalt ||
    createdUser.auth?.passwordHash !==
      registrationBefore.passwordHash ||
    createdUser.auth?.authVersion !== 1
  ) {
    throw new Error(
      "La cuenta creada tiene credenciales o estructura inválidas."
    );
  }

  // Única escritura: cuenta creada y token consumido.
  // Si falla, el estado original no se ha mutado.
  const writeResult = writeDb(nextDb);

  if (
    writeResult !== null &&
    (
      typeof writeResult === "object" ||
      typeof writeResult === "function"
    ) &&
    typeof writeResult.then === "function"
  ) {
    throw new TypeError(
      "La escritura debe ser síncrona."
    );
  }

  return {
    ok: true,
    userId,
    email: registrationBefore.email,
    name: registrationBefore.name,
    language:
      registrationBefore.language === "en"
        ? "en"
        : "es"
  };
}
