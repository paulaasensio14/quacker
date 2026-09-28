import test from "node:test";
import assert from "node:assert/strict";

import {
  SOCIAL_FOLLOW_USER_MAX_ATTEMPTS,
  SOCIAL_FOLLOW_WINDOW_MS,
  SOCIAL_RECOMMENDATION_USER_MAX_ATTEMPTS,
  SOCIAL_RECOMMENDATION_WINDOW_MS,
  createSocialRateLimiters
} from "../lib/social-rate-limit.js";


test(
  "permite inicialmente follows y recomendaciones",
  () => {
    const limits =
      createSocialRateLimiters({
        now: () => 1000
      });

    assert.equal(
      limits.checkFollow({
        userId: "user-a"
      }).allowed,
      true
    );

    assert.equal(
      limits.checkRecommendation({
        userId: "user-a"
      }).allowed,
      true
    );
  }
);


test(
  "bloquea follows al alcanzar el máximo por usuario",
  () => {
    const limits =
      createSocialRateLimiters({
        now: () => 1000
      });

    for (
      let attempt = 0;
      attempt <
        SOCIAL_FOLLOW_USER_MAX_ATTEMPTS;
      attempt += 1
    ) {
      assert.equal(
        limits.consumeFollow({
          userId: "user-a"
        }).allowed,
        true
      );
    }

    assert.deepEqual(
      limits.checkFollow({
        userId: "user-a"
      }),
      {
        allowed: false,
        remaining: 0,
        retryAfterMs:
          SOCIAL_FOLLOW_WINDOW_MS,
        retryAfterSeconds:
          SOCIAL_FOLLOW_WINDOW_MS / 1000
      }
    );
  }
);


test(
  "bloquea recomendaciones al alcanzar el máximo por usuario",
  () => {
    const limits =
      createSocialRateLimiters({
        now: () => 1000
      });

    for (
      let attempt = 0;
      attempt <
        SOCIAL_RECOMMENDATION_USER_MAX_ATTEMPTS;
      attempt += 1
    ) {
      assert.equal(
        limits.consumeRecommendation({
          userId: "user-a"
        }).allowed,
        true
      );
    }

    assert.deepEqual(
      limits.checkRecommendation({
        userId: "user-a"
      }),
      {
        allowed: false,
        remaining: 0,
        retryAfterMs:
          SOCIAL_RECOMMENDATION_WINDOW_MS,
        retryAfterSeconds:
          SOCIAL_RECOMMENDATION_WINDOW_MS /
          1000
      }
    );
  }
);


test(
  "mantiene independientes usuarios y tipos de acción",
  () => {
    const limits =
      createSocialRateLimiters({
        now: () => 1000
      });

    for (
      let attempt = 0;
      attempt <
        SOCIAL_FOLLOW_USER_MAX_ATTEMPTS;
      attempt += 1
    ) {
      limits.consumeFollow({
        userId: "user-a"
      });
    }

    assert.equal(
      limits.checkFollow({
        userId: "user-a"
      }).allowed,
      false
    );

    assert.equal(
      limits.checkFollow({
        userId: "user-b"
      }).allowed,
      true
    );

    assert.equal(
      limits.checkRecommendation({
        userId: "user-a"
      }).allowed,
      true
    );
  }
);


test(
  "libera los límites sociales al finalizar su ventana",
  () => {
    let currentTime = 0;

    const limits =
      createSocialRateLimiters({
        now: () => currentTime
      });

    for (
      let attempt = 0;
      attempt <
        SOCIAL_FOLLOW_USER_MAX_ATTEMPTS;
      attempt += 1
    ) {
      limits.consumeFollow({
        userId: "user-a"
      });
    }

    currentTime =
      SOCIAL_FOLLOW_WINDOW_MS;

    assert.equal(
      limits.checkFollow({
        userId: "user-a"
      }).allowed,
      true
    );
  }
);


test(
  "permite limpiar contadores y expone una API inmutable",
  () => {
    const limits =
      createSocialRateLimiters({
        now: () => 1000
      });

    limits.consumeFollow({
      userId: "user-a"
    });

    limits.consumeRecommendation({
      userId: "user-b"
    });

    assert.deepEqual(
      limits.size(),
      {
        followUsers: 1,
        recommendationUsers: 1
      }
    );

    limits.clear();

    assert.deepEqual(
      limits.size(),
      {
        followUsers: 0,
        recommendationUsers: 0
      }
    );

    assert.equal(
      Object.isFrozen(limits),
      true
    );
  }
);
