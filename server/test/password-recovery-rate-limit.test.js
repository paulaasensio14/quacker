import test from "node:test";
import assert from "node:assert/strict";

import {
  createAuthRateLimiters
} from "../lib/auth-rate-limit.js";

const RESET_REQUEST_EMAIL_MAX = 3;
const RESET_REQUEST_IP_MAX = 10;
const RESET_CONFIRM_IP_MAX = 10;

test(
  "permite inicialmente solicitar y confirmar una recuperación",
  () => {
    const limits = createAuthRateLimiters({
      now: () => 1000
    });

    assert.equal(
      limits.checkPasswordResetRequest({
        ip: "192.0.2.1",
        email: "user@example.test"
      }).allowed,
      true
    );

    assert.equal(
      limits.checkPasswordResetConfirm({
        ip: "192.0.2.1"
      }).allowed,
      true
    );
  }
);

test(
  "limita solicitudes de recuperación por email aunque cambie la IP",
  () => {
    const limits = createAuthRateLimiters({
      now: () => 1000
    });

    for (
      let attempt = 0;
      attempt < RESET_REQUEST_EMAIL_MAX;
      attempt += 1
    ) {
      limits.consumePasswordResetRequest({
        ip: `192.0.2.${10 + attempt}`,
        email: " user@example.test "
      });
    }

    assert.equal(
      limits.checkPasswordResetRequest({
        ip: "192.0.2.99",
        email: "USER@example.test"
      }).allowed,
      false
    );
  }
);

test(
  "limita solicitudes de recuperación por IP aunque cambie el email",
  () => {
    const limits = createAuthRateLimiters({
      now: () => 1000
    });

    for (
      let attempt = 0;
      attempt < RESET_REQUEST_IP_MAX;
      attempt += 1
    ) {
      limits.consumePasswordResetRequest({
        ip: "192.0.2.50",
        email: `user-${attempt}@example.test`
      });
    }

    assert.equal(
      limits.checkPasswordResetRequest({
        ip: "192.0.2.50",
        email: "other@example.test"
      }).allowed,
      false
    );
  }
);

test(
  "limita intentos de confirmación de recuperación por IP",
  () => {
    const limits = createAuthRateLimiters({
      now: () => 1000
    });

    for (
      let attempt = 0;
      attempt < RESET_CONFIRM_IP_MAX;
      attempt += 1
    ) {
      limits.consumePasswordResetConfirm({
        ip: "192.0.2.70"
      });
    }

    assert.equal(
      limits.checkPasswordResetConfirm({
        ip: "192.0.2.70"
      }).allowed,
      false
    );
  }
);

test(
  "clear elimina también los límites de recuperación",
  () => {
    const limits = createAuthRateLimiters({
      now: () => 1000
    });

    for (
      let attempt = 0;
      attempt < RESET_REQUEST_EMAIL_MAX;
      attempt += 1
    ) {
      limits.consumePasswordResetRequest({
        ip: `192.0.2.${100 + attempt}`,
        email: "blocked@example.test"
      });
    }

    for (
      let attempt = 0;
      attempt < RESET_CONFIRM_IP_MAX;
      attempt += 1
    ) {
      limits.consumePasswordResetConfirm({
        ip: "192.0.2.200"
      });
    }

    assert.equal(
      limits.checkPasswordResetRequest({
        ip: "192.0.2.250",
        email: "blocked@example.test"
      }).allowed,
      false
    );

    assert.equal(
      limits.checkPasswordResetConfirm({
        ip: "192.0.2.200"
      }).allowed,
      false
    );

    limits.clear();

    assert.equal(
      limits.checkPasswordResetRequest({
        ip: "192.0.2.250",
        email: "blocked@example.test"
      }).allowed,
      true
    );

    assert.equal(
      limits.checkPasswordResetConfirm({
        ip: "192.0.2.200"
      }).allowed,
      true
    );
  }
);
