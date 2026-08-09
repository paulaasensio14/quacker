import test from "node:test";
import assert from "node:assert/strict";

import {
  applyPasswordCredentialReset,
  storePasswordResetChallenge
} from "../lib/password-recovery.js";

test(
  "guarda únicamente hash y metadatos del desafío de recuperación",
  () => {
    const userBucket = {
      auth: {
        passwordSalt: "salt-anterior",
        passwordHash: "hash-anterior"
      }
    };

    const recovery = {
      token: "token-que-no-debe-guardarse",
      tokenHash: "a".repeat(64),
      issuedAt: 1_700_000_000_000,
      expiresAt: 1_700_001_800_000
    };

    storePasswordResetChallenge(
      userBucket,
      recovery
    );

    assert.deepEqual(
      userBucket.auth.passwordReset,
      {
        tokenHash: recovery.tokenHash,
        issuedAt: recovery.issuedAt,
        expiresAt: recovery.expiresAt
      }
    );

    assert.equal(
      Object.prototype.hasOwnProperty.call(
        userBucket.auth.passwordReset,
        "token"
      ),
      false
    );

    assert.equal(
      JSON.stringify(userBucket).includes(
        recovery.token
      ),
      false
    );
  }
);

test(
  "una nueva solicitud sustituye el desafío anterior",
  () => {
    const userBucket = {
      auth: {
        passwordReset: {
          tokenHash: "b".repeat(64),
          issuedAt: 100,
          expiresAt: 200
        }
      }
    };

    storePasswordResetChallenge(
      userBucket,
      {
        token: "nuevo-token",
        tokenHash: "c".repeat(64),
        issuedAt: 300,
        expiresAt: 400
      }
    );

    assert.deepEqual(
      userBucket.auth.passwordReset,
      {
        tokenHash: "c".repeat(64),
        issuedAt: 300,
        expiresAt: 400
      }
    );
  }
);

test(
  "aplica nuevas credenciales y elimina el desafío consumido",
  () => {
    const userBucket = {
      auth: {
        passwordSalt: "salt-anterior",
        passwordHash: "hash-anterior",
        passwordReset: {
          tokenHash: "d".repeat(64),
          issuedAt: 100,
          expiresAt: 200
        }
      }
    };

    const authVersion =
      applyPasswordCredentialReset(
        userBucket,
        {
          passwordSalt: "salt-nuevo",
          passwordHash: "hash-nuevo"
        }
      );

    assert.equal(
      userBucket.auth.passwordSalt,
      "salt-nuevo"
    );

    assert.equal(
      userBucket.auth.passwordHash,
      "hash-nuevo"
    );

    assert.equal(
      userBucket.auth.passwordReset,
      undefined
    );

    assert.equal(
      userBucket.auth.authVersion,
      2
    );

    assert.equal(authVersion, 2);
  }
);

test(
  "incrementa authVersion existente al cambiar credenciales",
  () => {
    const userBucket = {
      auth: {
        passwordSalt: "salt-anterior",
        passwordHash: "hash-anterior",
        authVersion: 4,
        passwordReset: {
          tokenHash: "e".repeat(64),
          expiresAt: 500
        }
      }
    };

    const authVersion =
      applyPasswordCredentialReset(
        userBucket,
        {
          passwordSalt: "salt-nuevo",
          passwordHash: "hash-nuevo"
        }
      );

    assert.equal(authVersion, 5);

    assert.equal(
      userBucket.auth.authVersion,
      5
    );

    assert.equal(
      userBucket.auth.passwordReset,
      undefined
    );
  }
);

test(
  "rechaza credenciales nuevas vacías",
  () => {
    const userBucket = {
      auth: {}
    };

    assert.throws(
      () =>
        applyPasswordCredentialReset(
          userBucket,
          {
            passwordSalt: "",
            passwordHash: ""
          }
        ),
      (error) =>
        error?.code ===
        "INVALID_PASSWORD_RESET_CREDENTIALS"
    );
  }
);
