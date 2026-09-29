import assert from "node:assert/strict";
import test from "node:test";

import {
  COLLABORATIVE_LIST_INVITE_TOKEN_BYTES,
  createCollaborativeListInviteToken,
  hashCollaborativeListInviteToken,
  verifyCollaborativeListInviteToken
} from "../lib/collaborative-list-link-invites.js";


test(
  "createCollaborativeListInviteToken genera token base64url, hash SHA-256 e issuedAt",
  () => {
    const nowValue = 1_800_000_000_000;

    const result =
      createCollaborativeListInviteToken({
        now: () => nowValue,
        randomBytes: (size) => {
          assert.equal(
            size,
            COLLABORATIVE_LIST_INVITE_TOKEN_BYTES
          );

          return Buffer.alloc(
            COLLABORATIVE_LIST_INVITE_TOKEN_BYTES,
            0xab
          );
        }
      });

    assert.equal(
      COLLABORATIVE_LIST_INVITE_TOKEN_BYTES,
      32
    );

    assert.equal(
      result.issuedAt,
      nowValue
    );

    assert.match(
      result.token,
      /^[A-Za-z0-9_-]+$/
    );

    assert.match(
      result.tokenHash,
      /^[a-f0-9]{64}$/
    );

    assert.equal(
      result.tokenHash,
      hashCollaborativeListInviteToken(
        result.token
      )
    );
  }
);


test(
  "verifyCollaborativeListInviteToken acepta el token correcto",
  () => {
    const recovery =
      createCollaborativeListInviteToken({
        randomBytes: () =>
          Buffer.alloc(
            COLLABORATIVE_LIST_INVITE_TOKEN_BYTES,
            0x42
          )
      });

    assert.equal(
      verifyCollaborativeListInviteToken({
        token: recovery.token,
        tokenHash: recovery.tokenHash
      }),
      true
    );
  }
);


test(
  "verifyCollaborativeListInviteToken rechaza un token distinto",
  () => {
    const first =
      createCollaborativeListInviteToken({
        randomBytes: () =>
          Buffer.alloc(
            COLLABORATIVE_LIST_INVITE_TOKEN_BYTES,
            0x11
          )
      });

    const second =
      createCollaborativeListInviteToken({
        randomBytes: () =>
          Buffer.alloc(
            COLLABORATIVE_LIST_INVITE_TOKEN_BYTES,
            0x22
          )
      });

    assert.equal(
      verifyCollaborativeListInviteToken({
        token: second.token,
        tokenHash: first.tokenHash
      }),
      false
    );
  }
);


test(
  "verifyCollaborativeListInviteToken rechaza valores inválidos",
  () => {
    assert.equal(
      verifyCollaborativeListInviteToken({
        token: "",
        tokenHash: ""
      }),
      false
    );

    assert.equal(
      verifyCollaborativeListInviteToken({
        token: "abc",
        tokenHash: "not-a-sha256"
      }),
      false
    );
  }
);
