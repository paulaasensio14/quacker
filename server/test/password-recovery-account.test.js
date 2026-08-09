import test from "node:test";
import assert from "node:assert/strict";

import {
  createPasswordResetToken,
  createPasswordResetUrl,
  findPasswordResetUserId,
  getNextPasswordAuthVersion
} from "../lib/password-recovery.js";

test(
  "crea una URL de recuperación con el token solo en el fragmento",
  () => {
    const url = createPasswordResetUrl(
      "token-seguro"
    );

    assert.equal(
      url,
      "https://quacker.es/#reset=token-seguro"
    );

    const parsed = new URL(url);

    assert.equal(
      parsed.search,
      ""
    );

    assert.equal(
      parsed.hash,
      "#reset=token-seguro"
    );
  }
);

test(
  "encuentra al usuario que posee un token válido",
  () => {
    const issuedAt = 1_700_000_000_000;

    const recovery = createPasswordResetToken({
      now: () => issuedAt,
      randomBytes: (size) =>
        Buffer.alloc(size, 0x31)
    });

    const users = {
      user_1: {
        auth: {
          passwordReset: {
            tokenHash:
              recovery.tokenHash,
            expiresAt:
              recovery.expiresAt
          }
        }
      },
      user_2: {
        auth: {}
      }
    };

    assert.equal(
      findPasswordResetUserId(
        users,
        recovery.token,
        {
          now: () =>
            recovery.expiresAt - 1
        }
      ),
      "user_1"
    );
  }
);

test(
  "no encuentra un token incorrecto",
  () => {
    const issuedAt = 1_700_000_000_000;

    const recovery = createPasswordResetToken({
      now: () => issuedAt,
      randomBytes: (size) =>
        Buffer.alloc(size, 0x32)
    });

    const users = {
      user_1: {
        auth: {
          passwordReset: {
            tokenHash:
              recovery.tokenHash,
            expiresAt:
              recovery.expiresAt
          }
        }
      }
    };

    assert.equal(
      findPasswordResetUserId(
        users,
        "token-incorrecto",
        {
          now: () => issuedAt
        }
      ),
      null
    );
  }
);

test(
  "no encuentra un token caducado",
  () => {
    const issuedAt = 1_700_000_000_000;

    const recovery = createPasswordResetToken({
      now: () => issuedAt,
      randomBytes: (size) =>
        Buffer.alloc(size, 0x33)
    });

    const users = {
      user_1: {
        auth: {
          passwordReset: {
            tokenHash:
              recovery.tokenHash,
            expiresAt:
              recovery.expiresAt
          }
        }
      }
    };

    assert.equal(
      findPasswordResetUserId(
        users,
        recovery.token,
        {
          now: () =>
            recovery.expiresAt
        }
      ),
      null
    );
  }
);

test(
  "un usuario legacy pasa de authVersion 1 a 2",
  () => {
    assert.equal(
      getNextPasswordAuthVersion({}),
      2
    );
  }
);

test(
  "incrementa la authVersion actual",
  () => {
    assert.equal(
      getNextPasswordAuthVersion({
        authVersion: 4
      }),
      5
    );
  }
);

test(
  "recupera una authVersion inválida como versión 2",
  () => {
    assert.equal(
      getNextPasswordAuthVersion({
        authVersion: "invalida"
      }),
      2
    );
  }
);
