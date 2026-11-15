import {
  normalizeProfilePrivacy
} from "./profile-privacy.js";

import {
  normalizeFollowing
} from "./following.js";

import {
  areUsersBlocked
} from "./user-blocks.js";

function isRecord(value) {
  return (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value)
  );
}

/**
 * Decide si una persona puede invitar directamente
 * a otra a una lista colaborativa.
 *
 * No modifica usuarios ni listas.
 *
 * La autorizacion de quien invita sobre la lista
 * debe comprobarse en la ruta HTTP correspondiente.
 */
export function canInviteToCollaborativeList({
  users,
  inviterUserId,
  targetUserId
} = {}) {
  if (!isRecord(users)) {
    return false;
  }

  const inviterId =
    typeof inviterUserId === "string"
      ? inviterUserId.trim()
      : "";

  const targetId =
    typeof targetUserId === "string"
      ? targetUserId.trim()
      : "";

  if (
    !inviterId ||
    !targetId ||
    inviterId === targetId
  ) {
    return false;
  }

  if (
    !Object.hasOwn(users, inviterId) ||
    !Object.hasOwn(users, targetId)
  ) {
    return false;
  }

  const inviter = users[inviterId];
  const target = users[targetId];

  if (
    !isRecord(inviter) ||
    !isRecord(target)
  ) {
    return false;
  }

  // Los bloqueos prevalecen sobre cualquier
  // nivel de visibilidad o relacion social.
  if (
    areUsersBlocked(
      inviterId,
      inviter.blockedUserIds,
      targetId,
      target.blockedUserIds
    )
  ) {
    return false;
  }

  const privacy =
    normalizeProfilePrivacy(target.privacy);

  const visibility =
    privacy.profileVisibility;

  // Los perfiles ocultos nunca son invitables
  // directamente mediante nombre de usuario.
  if (visibility === "hidden") {
    return false;
  }

  if (visibility === "public") {
    return true;
  }

  // El seguimiento aceptado se representa
  // en la lista following del invitador.
  const inviterFollowing =
    normalizeFollowing(
      inviter.following,
      {
        ownerUserId: inviterId
      }
    );

  const followsTarget =
    inviterFollowing.includes(targetId);

  if (visibility === "followers") {
    return followsTarget;
  }

  if (visibility === "friends") {
    if (!followsTarget) {
      return false;
    }

    const targetFollowing =
      normalizeFollowing(
        target.following,
        {
          ownerUserId: targetId
        }
      );

    return targetFollowing.includes(
      inviterId
    );
  }

  // Seguridad por defecto ante cualquier
  // visibilidad no reconocida.
  return false;
}
