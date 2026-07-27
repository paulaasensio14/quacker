import test from "node:test";
import assert from "node:assert/strict";

import {
  AUTH_LOGIN_ACCOUNT_MAX_FAILURES,
  AUTH_LOGIN_IP_MAX_FAILURES,
  AUTH_LOGIN_WINDOW_MS,
  AUTH_REGISTER_IP_MAX_ATTEMPTS,
  AUTH_REGISTER_WINDOW_MS,
  createAuthRateLimiters
} from "../lib/auth-rate-limit.js";

test(
  "permite inicialmente el login y el registro",
  () => {
    const limits = createAuthRateLimiters({
      now: () => 1000
    });

    assert.deepEqual(
      limits.checkLogin({
        ip: "192.0.2.1",
        email: "user@example.test"
      }),
      {
        allowed: true,
        retryAfterSeconds: 0
      }
    );

    assert.equal(
      limits.checkRegistration({
        ip: "192.0.2.1"
      }).allowed,
      true
    );
  }
);

test(
  "bloquea una cuenta tras cinco fallos desde la misma IP",
  () => {
    const limits = createAuthRateLimiters({
      now: () => 1000
    });

    const login = {
      ip: "192.0.2.10",
      email: "user@example.test"
    };

    for (
      let attempt = 0;
      attempt <
        AUTH_LOGIN_ACCOUNT_MAX_FAILURES;
      attempt += 1
    ) {
      assert.equal(
        limits.consumeLoginFailure(login)
          .allowed,
        true
      );
    }

    assert.deepEqual(
      limits.checkLogin(login),
      {
        allowed: false,
        retryAfterSeconds:
          AUTH_LOGIN_WINDOW_MS / 1000
      }
    );
  }
);

test(
  "normaliza espacios y mayúsculas en correo e IP",
  () => {
    const limits = createAuthRateLimiters({
      now: () => 1000
    });

    const originalLogin = {
      ip: " EXAMPLE-IP ",
      email: " User@Example.Test "
    };

    for (
      let attempt = 0;
      attempt <
        AUTH_LOGIN_ACCOUNT_MAX_FAILURES;
      attempt += 1
    ) {
      limits.consumeLoginFailure(
        originalLogin
      );
    }

    assert.equal(
      limits.checkLogin({
        ip: "example-ip",
        email: "user@example.test"
      }).allowed,
      false
    );
  }
);

test(
  "mantiene independientes cuentas distintas desde la misma IP",
  () => {
    const limits = createAuthRateLimiters({
      now: () => 1000
    });

    for (
      let attempt = 0;
      attempt <
        AUTH_LOGIN_ACCOUNT_MAX_FAILURES;
      attempt += 1
    ) {
      limits.consumeLoginFailure({
        ip: "192.0.2.20",
        email: "first@example.test"
      });
    }

    assert.equal(
      limits.checkLogin({
        ip: "192.0.2.20",
        email: "first@example.test"
      }).allowed,
      false
    );

    assert.equal(
      limits.checkLogin({
        ip: "192.0.2.20",
        email: "second@example.test"
      }).allowed,
      true
    );
  }
);

test(
  "aplica también un límite global por IP",
  () => {
    const limits = createAuthRateLimiters({
      now: () => 1000
    });

    for (
      let attempt = 0;
      attempt < AUTH_LOGIN_IP_MAX_FAILURES;
      attempt += 1
    ) {
      limits.consumeLoginFailure({
        ip: "192.0.2.30",
        email:
          `user-${attempt}@example.test`
      });
    }

    assert.deepEqual(
      limits.checkLogin({
        ip: "192.0.2.30",
        email: "new@example.test"
      }),
      {
        allowed: false,
        retryAfterSeconds:
          AUTH_LOGIN_WINDOW_MS / 1000
      }
    );

    assert.equal(
      limits.checkLogin({
        ip: "192.0.2.31",
        email: "new@example.test"
      }).allowed,
      true
    );
  }
);

test(
  "reinicia solo el límite de la cuenta indicada",
  () => {
    const limits = createAuthRateLimiters({
      now: () => 1000
    });

    const firstLogin = {
      ip: "192.0.2.40",
      email: "first@example.test"
    };

    const secondLogin = {
      ip: "192.0.2.40",
      email: "second@example.test"
    };

    for (
      let attempt = 0;
      attempt <
        AUTH_LOGIN_ACCOUNT_MAX_FAILURES;
      attempt += 1
    ) {
      limits.consumeLoginFailure(
        firstLogin
      );

      limits.consumeLoginFailure(
        secondLogin
      );
    }

    limits.resetLoginAccount(
      firstLogin
    );

    assert.equal(
      limits.checkLogin(firstLogin)
        .allowed,
      true
    );

    assert.equal(
      limits.checkLogin(secondLogin)
        .allowed,
      false
    );

    assert.deepEqual(
      limits.size(),
      {
        loginAccounts: 1,
        loginIps: 1,
        registrationIps: 0
      }
    );
  }
);

test(
  "el reinicio de cuenta conserva los fallos globales de la IP",
  () => {
    const limits = createAuthRateLimiters({
      now: () => 1000
    });

    const login = {
      ip: "192.0.2.50",
      email: "user@example.test"
    };

    limits.consumeLoginFailure(login);
    limits.resetLoginAccount(login);

    assert.deepEqual(
      limits.size(),
      {
        loginAccounts: 0,
        loginIps: 1,
        registrationIps: 0
      }
    );
  }
);

test(
  "libera los límites de login al finalizar la ventana",
  () => {
    let currentTime = 0;

    const limits = createAuthRateLimiters({
      now: () => currentTime
    });

    const login = {
      ip: "192.0.2.60",
      email: "user@example.test"
    };

    for (
      let attempt = 0;
      attempt <
        AUTH_LOGIN_ACCOUNT_MAX_FAILURES;
      attempt += 1
    ) {
      limits.consumeLoginFailure(login);
    }

    currentTime =
      AUTH_LOGIN_WINDOW_MS - 1;

    assert.equal(
      limits.checkLogin(login)
        .retryAfterSeconds,
      1
    );

    currentTime =
      AUTH_LOGIN_WINDOW_MS;

    assert.equal(
      limits.checkLogin(login)
        .allowed,
      true
    );
  }
);

test(
  "bloquea el registro tras cinco intentos por IP",
  () => {
    const limits = createAuthRateLimiters({
      now: () => 1000
    });

    const registration = {
      ip: "192.0.2.70"
    };

    for (
      let attempt = 0;
      attempt <
        AUTH_REGISTER_IP_MAX_ATTEMPTS;
      attempt += 1
    ) {
      assert.equal(
        limits.consumeRegistration(
          registration
        ).allowed,
        true
      );
    }

    assert.deepEqual(
      limits.checkRegistration(
        registration
      ),
      {
        allowed: false,
        remaining: 0,
        retryAfterMs:
          AUTH_REGISTER_WINDOW_MS,
        retryAfterSeconds:
          AUTH_REGISTER_WINDOW_MS / 1000
      }
    );
  }
);

test(
  "mantiene independientes las IP de registro",
  () => {
    const limits = createAuthRateLimiters({
      now: () => 1000
    });

    for (
      let attempt = 0;
      attempt <
        AUTH_REGISTER_IP_MAX_ATTEMPTS;
      attempt += 1
    ) {
      limits.consumeRegistration({
        ip: "192.0.2.80"
      });
    }

    assert.equal(
      limits.checkRegistration({
        ip: "192.0.2.80"
      }).allowed,
      false
    );

    assert.equal(
      limits.checkRegistration({
        ip: "192.0.2.81"
      }).allowed,
      true
    );
  }
);

test(
  "libera el registro al finalizar su ventana",
  () => {
    let currentTime = 0;

    const limits = createAuthRateLimiters({
      now: () => currentTime
    });

    const registration = {
      ip: "192.0.2.90"
    };

    for (
      let attempt = 0;
      attempt <
        AUTH_REGISTER_IP_MAX_ATTEMPTS;
      attempt += 1
    ) {
      limits.consumeRegistration(
        registration
      );
    }

    currentTime =
      AUTH_REGISTER_WINDOW_MS;

    assert.equal(
      limits.checkRegistration(
        registration
      ).allowed,
      true
    );
  }
);

test(
  "borra todos los contadores de autenticación",
  () => {
    const limits = createAuthRateLimiters({
      now: () => 1000
    });

    limits.consumeLoginFailure({
      ip: "192.0.2.100",
      email: "user@example.test"
    });

    limits.consumeRegistration({
      ip: "192.0.2.101"
    });

    assert.deepEqual(
      limits.size(),
      {
        loginAccounts: 1,
        loginIps: 1,
        registrationIps: 1
      }
    );

    limits.clear();

    assert.deepEqual(
      limits.size(),
      {
        loginAccounts: 0,
        loginIps: 0,
        registrationIps: 0
      }
    );
  }
);

test(
  "expone una API de autenticación inmutable",
  () => {
    const limits =
      createAuthRateLimiters();

    assert.equal(
      Object.isFrozen(limits),
      true
    );
  }
);
