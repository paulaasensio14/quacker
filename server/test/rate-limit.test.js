import test from "node:test";
import assert from "node:assert/strict";

import {
  createSlidingWindowRateLimiter
} from "../lib/rate-limit.js";

test(
  "rechaza una ventana temporal inválida",
  () => {
    assert.throws(
      () => createSlidingWindowRateLimiter({
        windowMs: 0,
        maxAttempts: 2
      }),
      {
        code: "INVALID_RATE_LIMIT_WINDOW"
      }
    );
  }
);

test(
  "rechaza un máximo de intentos inválido",
  () => {
    assert.throws(
      () => createSlidingWindowRateLimiter({
        windowMs: 60_000,
        maxAttempts: 0
      }),
      {
        code:
          "INVALID_RATE_LIMIT_MAX_ATTEMPTS"
      }
    );
  }
);

test(
  "rechaza un máximo de entradas inválido",
  () => {
    assert.throws(
      () => createSlidingWindowRateLimiter({
        windowMs: 60_000,
        maxAttempts: 2,
        maxEntries: -1
      }),
      {
        code:
          "INVALID_RATE_LIMIT_MAX_ENTRIES"
      }
    );
  }
);

test(
  "rechaza un reloj que no sea una función",
  () => {
    assert.throws(
      () => createSlidingWindowRateLimiter({
        windowMs: 60_000,
        maxAttempts: 2,
        now: 1000
      }),
      {
        code: "INVALID_RATE_LIMIT_CLOCK"
      }
    );
  }
);

test(
  "rechaza valores temporales no finitos",
  () => {
    const limiter =
      createSlidingWindowRateLimiter({
        windowMs: 60_000,
        maxAttempts: 2,
        now: () => Number.NaN
      });

    assert.throws(
      () => limiter.check("user"),
      {
        code: "INVALID_RATE_LIMIT_TIME"
      }
    );
  }
);

test(
  "consultar el estado no consume intentos",
  () => {
    const limiter =
      createSlidingWindowRateLimiter({
        windowMs: 60_000,
        maxAttempts: 2,
        now: () => 1000
      });

    assert.deepEqual(
      limiter.check("user"),
      {
        allowed: true,
        remaining: 2,
        retryAfterMs: 0,
        retryAfterSeconds: 0
      }
    );

    assert.equal(
      limiter.check("user").remaining,
      2
    );
  }
);

test(
  "permite el máximo configurado y bloquea el siguiente intento",
  () => {
    const limiter =
      createSlidingWindowRateLimiter({
        windowMs: 60_000,
        maxAttempts: 2,
        now: () => 1000
      });

    assert.deepEqual(
      limiter.consume("user"),
      {
        allowed: true,
        remaining: 1,
        retryAfterMs: 0,
        retryAfterSeconds: 0
      }
    );

    assert.deepEqual(
      limiter.consume("user"),
      {
        allowed: true,
        remaining: 0,
        retryAfterMs: 0,
        retryAfterSeconds: 0
      }
    );

    assert.deepEqual(
      limiter.consume("user"),
      {
        allowed: false,
        remaining: 0,
        retryAfterMs: 60_000,
        retryAfterSeconds: 60
      }
    );
  }
);

test(
  "calcula la espera restante y libera en el límite exacto",
  () => {
    let currentTime = 1000;

    const limiter =
      createSlidingWindowRateLimiter({
        windowMs: 60_000,
        maxAttempts: 1,
        now: () => currentTime
      });

    limiter.consume("user");

    currentTime = 60_999;

    assert.deepEqual(
      limiter.check("user"),
      {
        allowed: false,
        remaining: 0,
        retryAfterMs: 1,
        retryAfterSeconds: 1
      }
    );

    currentTime = 61_000;

    assert.deepEqual(
      limiter.check("user"),
      {
        allowed: true,
        remaining: 1,
        retryAfterMs: 0,
        retryAfterSeconds: 0
      }
    );
  }
);

test(
  "los intentos bloqueados no amplían la ventana",
  () => {
    let currentTime = 0;

    const limiter =
      createSlidingWindowRateLimiter({
        windowMs: 60_000,
        maxAttempts: 1,
        now: () => currentTime
      });

    limiter.consume("user");

    currentTime = 30_000;

    assert.equal(
      limiter.consume("user")
        .retryAfterSeconds,
      30
    );

    currentTime = 59_000;

    assert.equal(
      limiter.consume("user")
        .retryAfterSeconds,
      1
    );

    currentTime = 60_000;

    assert.equal(
      limiter.consume("user").allowed,
      true
    );
  }
);

test(
  "mantiene contadores independientes por clave",
  () => {
    const limiter =
      createSlidingWindowRateLimiter({
        windowMs: 60_000,
        maxAttempts: 1,
        now: () => 1000
      });

    limiter.consume("first");

    assert.equal(
      limiter.check("first").allowed,
      false
    );

    assert.deepEqual(
      limiter.check("second"),
      {
        allowed: true,
        remaining: 1,
        retryAfterMs: 0,
        retryAfterSeconds: 0
      }
    );
  }
);

test(
  "normaliza claves vacías mediante el valor unknown",
  () => {
    const limiter =
      createSlidingWindowRateLimiter({
        windowMs: 60_000,
        maxAttempts: 1,
        now: () => 1000
      });

    limiter.consume("   ");

    assert.equal(
      limiter.check(undefined).allowed,
      false
    );

    assert.equal(
      limiter.check(null).allowed,
      false
    );
  }
);

test(
  "reinicia únicamente la clave solicitada",
  () => {
    const limiter =
      createSlidingWindowRateLimiter({
        windowMs: 60_000,
        maxAttempts: 1,
        now: () => 1000
      });

    limiter.consume("first");
    limiter.consume("second");

    limiter.reset("first");

    assert.equal(
      limiter.check("first").allowed,
      true
    );

    assert.equal(
      limiter.check("second").allowed,
      false
    );
  }
);

test(
  "permite borrar todos los contadores",
  () => {
    const limiter =
      createSlidingWindowRateLimiter({
        windowMs: 60_000,
        maxAttempts: 1,
        now: () => 1000
      });

    limiter.consume("first");
    limiter.consume("second");

    assert.equal(limiter.size(), 2);

    limiter.clear();

    assert.equal(limiter.size(), 0);

    assert.equal(
      limiter.check("first").allowed,
      true
    );
  }
);

test(
  "elimina las entradas más antiguas al superar el límite",
  () => {
    let currentTime = 1000;

    const limiter =
      createSlidingWindowRateLimiter({
        windowMs: 60_000,
        maxAttempts: 1,
        maxEntries: 2,
        now: () => currentTime
      });

    limiter.consume("first");

    currentTime = 2000;
    limiter.consume("second");

    currentTime = 3000;
    limiter.consume("third");

    assert.equal(limiter.size(), 2);

    assert.equal(
      limiter.check("first").allowed,
      true
    );

    assert.equal(
      limiter.check("second").allowed,
      false
    );

    assert.equal(
      limiter.check("third").allowed,
      false
    );
  }
);

test(
  "limpia contadores caducados",
  () => {
    let currentTime = 0;

    const limiter =
      createSlidingWindowRateLimiter({
        windowMs: 100,
        maxAttempts: 1,
        maxEntries: 10,
        now: () => currentTime
      });

    limiter.consume("expired");

    assert.equal(limiter.size(), 1);

    currentTime = 100;
    limiter.consume("current");

    assert.equal(limiter.size(), 1);

    assert.equal(
      limiter.check("expired").allowed,
      true
    );

    assert.equal(
      limiter.check("current").allowed,
      false
    );
  }
);

test(
  "expone una API que no puede modificarse",
  () => {
    const limiter =
      createSlidingWindowRateLimiter({
        windowMs: 60_000,
        maxAttempts: 1
      });

    assert.equal(
      Object.isFrozen(limiter),
      true
    );
  }
);
