import {
  normalizePublicIdentity
} from "./public-profile.js";

import {
  normalizeProfilePrivacy
} from "./profile-privacy.js";

import {
  areUsersBlocked
} from "./user-blocks.js";

// Normaliza texto para comparar nombres sin tildes
// ni diferencias entre mayúsculas y minúsculas.
function normalizeSearchText(value) {
  if (typeof value !== "string") return "";

  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

// Devuelve únicamente identidades que el usuario actual
// tiene permitido descubrir.
//
// Esta función no accede a la base de datos ni a sesiones.
// La API HTTP deberá validar autenticación y rate limits.
export function searchCommunityUsers(
  users,
  query,
  {
    viewerUserId = "",
    limit = 20
  } = {}
) {
  if (
    !users ||
    typeof users !== "object" ||
    Array.isArray(users) ||
    typeof query !== "string" ||
    typeof viewerUserId !== "string"
  ) {
    return [];
  }

  const currentUserId = viewerUserId.trim();

  if (
    !currentUserId ||
    !Object.hasOwn(users, currentUserId)
  ) {
    return [];
  }

  const viewer = users[currentUserId];

  if (
    !viewer ||
    typeof viewer !== "object" ||
    Array.isArray(viewer)
  ) {
    return [];
  }

  const rawQuery = query.trim().replace(/^@/, "");

  // No permitir búsquedas vacías, excesivamente cortas
  // o entradas desproporcionadas.
  if (
    rawQuery.length > 80
  ) {
    return [];
  }

  const searchTerm = normalizeSearchText(rawQuery);

  if (
    [...searchTerm].length < 2
  ) {
    return [];
  }

  // Aunque se solicite un límite mayor, nunca
  // devolver más de veinte identidades.
  const maxResults = Number.isInteger(limit)
    ? Math.min(20, Math.max(1, limit))
    : 20;

  const results = [];
  const seenUsernames = new Set();

  for (const [userId, bucket] of Object.entries(users)) {
    // La cuenta actual no aparece como resultado.
    if (userId === currentUserId) {
      continue;
    }

    if (
      !bucket ||
      typeof bucket !== "object" ||
      Array.isArray(bucket)
    ) {
      continue;
    }

    const privacy = normalizeProfilePrivacy(
      bucket.privacy
    );

    // Los perfiles ocultos, incluidos los perfiles
    // antiguos sin configuración, no son descubribles.
    if (privacy.profileVisibility === "hidden") {
      continue;
    }

    // Respetar bloqueos tanto del usuario actual
    // como del usuario encontrado.
    if (
      areUsersBlocked(
        currentUserId,
        viewer.blockedUserIds,
        userId,
        bucket.blockedUserIds
      )
    ) {
      continue;
    }

    // Reutilizar la normalización segura
    // del perfil público existente.
    const identity = normalizePublicIdentity(
      bucket.profile
    );

    if (
      !identity.username ||
      seenUsernames.has(identity.username)
    ) {
      continue;
    }

    const searchableName = normalizeSearchText(
      identity.name
    );

    const searchableUsername = normalizeSearchText(
      identity.username
    );

    const matches =
      searchableName.includes(searchTerm) ||
      searchableUsername.includes(searchTerm);

    if (!matches) {
      continue;
    }

    seenUsernames.add(identity.username);

    // Contrato público mínimo: nunca devolver
    // IDs internos, correos, sesiones o privacidad.
    results.push({
      name: identity.name,
      username: identity.username,
      avatar: identity.avatar
    });

    if (results.length >= maxResults) {
      break;
    }
  }

  return results;
}
