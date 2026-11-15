import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import test from "node:test";

const policyUrl = new URL(
  "../lib/list-invite-privacy-policy.js",
  import.meta.url
);

const policyModule = existsSync(policyUrl)
  ? await import(policyUrl.href)
  : null;

const canInvite =
  policyModule?.canInviteToCollaborativeList;

function users({
  visibility = "public",
  inviterFollowing = [],
  targetFollowing = [],
  targetFollowRequests = []
} = {}) {
  return {
    inviter: {
      following: inviterFollowing,
      blockedUserIds: []
    },
    target: {
      privacy: {
        profileVisibility: visibility
      },
      following: targetFollowing,
      followRequests: targetFollowRequests,
      blockedUserIds: []
    }
  };
}

function allowed(data) {
  return canInvite({
    users: data,
    inviterUserId: "inviter",
    targetUserId: "target"
  });
}

test(
  "existe la politica de privacidad de invitaciones",
  () => {
    assert.equal(
      typeof canInvite,
      "function",
      "Falta implementar canInviteToCollaborativeList"
    );
  }
);

const skip = typeof canInvite !== "function";

test(
  "un perfil publico admite invitacion",
  { skip },
  () => {
    assert.equal(
      allowed(users()),
      true
    );
  }
);

test(
  "followers admite a un seguidor aceptado",
  { skip },
  () => {
    assert.equal(
      allowed(users({
        visibility: "followers",
        inviterFollowing: ["target"]
      })),
      true
    );
  }
);

test(
  "followers rechaza usuarios que no siguen al destinatario",
  { skip },
  () => {
    assert.equal(
      allowed(users({
        visibility: "followers"
      })),
      false
    );
  }
);

test(
  "followers no confunde solicitud pendiente con seguimiento aceptado",
  { skip },
  () => {
    assert.equal(
      allowed(users({
        visibility: "followers",
        targetFollowRequests: ["inviter"]
      })),
      false
    );
  }
);

test(
  "friends admite seguimiento mutuo",
  { skip },
  () => {
    assert.equal(
      allowed(users({
        visibility: "friends",
        inviterFollowing: ["target"],
        targetFollowing: ["inviter"]
      })),
      true
    );
  }
);

test(
  "friends rechaza seguimiento unilateral",
  { skip },
  () => {
    assert.equal(
      allowed(users({
        visibility: "friends",
        inviterFollowing: ["target"]
      })),
      false
    );

    assert.equal(
      allowed(users({
        visibility: "friends",
        targetFollowing: ["inviter"]
      })),
      false
    );
  }
);

test(
  "hidden rechaza invitacion directa aunque sean amigos",
  { skip },
  () => {
    assert.equal(
      allowed(users({
        visibility: "hidden",
        inviterFollowing: ["target"],
        targetFollowing: ["inviter"]
      })),
      false
    );
  }
);

test(
  "privacidad antigua sin configurar se considera oculta",
  { skip },
  () => {
    const data = users();
    delete data.target.privacy;

    assert.equal(
      allowed(data),
      false
    );
  }
);

test(
  "usuarios inexistentes no son invitables",
  { skip },
  () => {
    const data = users();
    delete data.target;

    assert.equal(
      allowed(data),
      false
    );
  }
);

test(
  "no se permite invitarse a uno mismo",
  { skip },
  () => {
    assert.equal(
      canInvite({
        users: users(),
        inviterUserId: "inviter",
        targetUserId: "inviter"
      }),
      false
    );
  }
);
