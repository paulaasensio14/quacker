import assert from "node:assert/strict";
import test from "node:test";

import * as linkInvites from
  "../lib/collaborative-list-link-invites.js";

const isExpired =
  linkInvites.isCollaborativeListInviteExpired;

const DAY_MS =
  24 * 60 * 60 * 1000;

const TTL_MS =
  7 * DAY_MS;

const NOW =
  Date.UTC(2026, 10, 15, 12, 0, 0);

test(
  "existe el validador de caducidad de enlaces",
  () => {
    assert.equal(
      typeof isExpired,
      "function",
      "Falta isCollaborativeListInviteExpired"
    );
  }
);

const skip = typeof isExpired !== "function";

test(
  "un enlace reciente sigue siendo valido",
  { skip },
  () => {
    assert.equal(
      isExpired({
        issuedAt: NOW - DAY_MS,
        now: NOW
      }),
      false
    );
  }
);

test(
  "un enlace justo antes de siete dias sigue valido",
  { skip },
  () => {
    assert.equal(
      isExpired({
        issuedAt: NOW - TTL_MS + 1,
        now: NOW
      }),
      false
    );
  }
);

test(
  "un enlace caduca exactamente a los siete dias",
  { skip },
  () => {
    assert.equal(
      isExpired({
        issuedAt: NOW - TTL_MS,
        now: NOW
      }),
      true
    );
  }
);

test(
  "un enlace antiguo esta caducado",
  { skip },
  () => {
    assert.equal(
      isExpired({
        issuedAt: NOW - 8 * DAY_MS,
        now: NOW
      }),
      true
    );
  }
);

test(
  "fechas inexistentes o invalidas se rechazan",
  { skip },
  () => {
    for (const issuedAt of [
      undefined,
      null,
      "",
      "invalido",
      -1,
      Number.NaN
    ]) {
      assert.equal(
        isExpired({
          issuedAt,
          now: NOW
        }),
        true
      );
    }
  }
);

test(
  "fechas futuras se rechazan por seguridad",
  { skip },
  () => {
    assert.equal(
      isExpired({
        issuedAt: NOW + DAY_MS,
        now: NOW
      }),
      true
    );
  }
);
