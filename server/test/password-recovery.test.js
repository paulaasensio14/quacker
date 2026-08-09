import test from "node:test";
import assert from "node:assert/strict";

import {
  PASSWORD_RESET_TOKEN_BYTES,
  PASSWORD_RESET_TOKEN_TTL_MS,
  createPasswordResetToken,
  hashPasswordResetToken,
  verifyPasswordResetToken
} from "../lib/password-recovery.js";

test(
  "crea un token de recuperación con hash y caducidad",
  () => {
    const issuedAt = 1_700_000_000_000;

    const recovery = createPasswordResetToken({
      now: () => issuedAt,
      randomBytes: (size) =>
        Buffer.alloc(size, 0x42)
    });

    assert.equal(
      PASSWORD_RESET_TOKEN_BYTES,
      32
    );

    assert.equal(
      PASSWORD_RESET_TOKEN_TTL_MS,
      30 * 60 * 1000
    );

    assert.equal(
      typeof recovery.token,
      "string"
    );

    assert.ok(
      recovery.token.length > 0
    );

    assert.match(
      recovery.tokenHash,
      /^[a-f0-9]{64}$/
    );

    assert.equal(
      recovery.tokenHash,
      hashPasswordResetToken(
        recovery.token
      )
    );

    assert.equal(
      recovery.issuedAt,
      issuedAt
    );

    assert.equal(
      recovery.expiresAt,
      issuedAt +
        PASSWORD_RESET_TOKEN_TTL_MS
    );

    assert.equal(
      Object.isFrozen(recovery),
      true
    );
  }
);

test(
  "acepta un token válido antes de caducar",
  () => {
    const issuedAt = 1_700_000_000_000;

    const recovery = createPasswordResetToken({
      now: () => issuedAt,
      randomBytes: (size) =>
        Buffer.alloc(size, 0x23)
    });

    assert.equal(
      verifyPasswordResetToken({
        token: recovery.token,
        tokenHash: recovery.tokenHash,
        expiresAt: recovery.expiresAt,
        now: () =>
          recovery.expiresAt - 1
      }),
      true
    );
  }
);

test(
  "rechaza el token en el instante de caducidad",
  () => {
    const issuedAt = 1_700_000_000_000;

    const recovery = createPasswordResetToken({
      now: () => issuedAt,
      randomBytes: (size) =>
        Buffer.alloc(size, 0x24)
    });

    assert.equal(
      verifyPasswordResetToken({
        token: recovery.token,
        tokenHash: recovery.tokenHash,
        expiresAt: recovery.expiresAt,
        now: () =>
          recovery.expiresAt
      }),
      false
    );
  }
);

test(
  "rechaza un token diferente al emitido",
  () => {
    const issuedAt = 1_700_000_000_000;

    const recovery = createPasswordResetToken({
      now: () => issuedAt,
      randomBytes: (size) =>
        Buffer.alloc(size, 0x25)
    });

    assert.equal(
      verifyPasswordResetToken({
        token: "token-incorrecto",
        tokenHash: recovery.tokenHash,
        expiresAt: recovery.expiresAt,
        now: () => issuedAt
      }),
      false
    );
  }
);

test(
  "rechaza hashes malformados",
  () => {
    assert.equal(
      verifyPasswordResetToken({
        token: "token-valido",
        tokenHash: "no-es-un-hash",
        expiresAt:
          1_700_000_000_000 + 1000,
        now: () =>
          1_700_000_000_000
      }),
      false
    );
  }
);

test(
  "rechaza tokens vacíos al calcular el hash",
  () => {
    assert.throws(
      () =>
        hashPasswordResetToken("   "),
      (error) =>
        error?.code ===
        "INVALID_PASSWORD_RESET_TOKEN"
    );
  }
);

test(
  "rechaza una duración de token inválida",
  () => {
    assert.throws(
      () =>
        createPasswordResetToken({
          ttlMs: 0
        }),
      (error) =>
        error?.code ===
        "INVALID_PASSWORD_RESET_TTL"
    );
  }
);

test(
  "rechaza un generador aleatorio inválido",
  () => {
    assert.throws(
      () =>
        createPasswordResetToken({
          randomBytes: () =>
            Buffer.alloc(4)
        }),
      (error) =>
        error?.code ===
        "INVALID_PASSWORD_RESET_RANDOM_VALUE"
    );
  }
);
