import {
  createSlidingWindowRateLimiter
} from "./rate-limit.js";


export const SOCIAL_FOLLOW_WINDOW_MS =
  15 * 60 * 1000;

export const SOCIAL_FOLLOW_USER_MAX_ATTEMPTS =
  30;

export const SOCIAL_RECOMMENDATION_WINDOW_MS =
  15 * 60 * 1000;

export const SOCIAL_RECOMMENDATION_USER_MAX_ATTEMPTS =
  20;

export const SOCIAL_BLOCK_WINDOW_MS =
  15 * 60 * 1000;

export const SOCIAL_BLOCK_USER_MAX_ATTEMPTS =
  20;


function _createUserKey(userId) {
  return (
    String(userId ?? "").trim() ||
    "unknown"
  );
}


export function createSocialRateLimiters({
  now = Date.now
} = {}) {
  const followByUser =
    createSlidingWindowRateLimiter({
      windowMs:
        SOCIAL_FOLLOW_WINDOW_MS,
      maxAttempts:
        SOCIAL_FOLLOW_USER_MAX_ATTEMPTS,
      maxEntries: 5000,
      now
    });

  const recommendationByUser =
    createSlidingWindowRateLimiter({
      windowMs:
        SOCIAL_RECOMMENDATION_WINDOW_MS,
      maxAttempts:
        SOCIAL_RECOMMENDATION_USER_MAX_ATTEMPTS,
      maxEntries: 5000,
      now
    });


  const blockByUser =
    createSlidingWindowRateLimiter({
      windowMs: SOCIAL_BLOCK_WINDOW_MS,
      maxAttempts: SOCIAL_BLOCK_USER_MAX_ATTEMPTS,
      maxEntries: 5000,
      now
    });


  function checkFollow({
    userId
  } = {}) {
    return followByUser.check(
      _createUserKey(userId)
    );
  }


  function consumeFollow({
    userId
  } = {}) {
    return followByUser.consume(
      _createUserKey(userId)
    );
  }


  function checkRecommendation({
    userId
  } = {}) {
    return recommendationByUser.check(
      _createUserKey(userId)
    );
  }


  function consumeRecommendation({
    userId
  } = {}) {
    return recommendationByUser.consume(
      _createUserKey(userId)
    );
  }


  function checkBlock({
    userId
  } = {}) {
    return blockByUser.check(
      _createUserKey(userId)
    );
  }


  function consumeBlock({
    userId
  } = {}) {
    return blockByUser.consume(
      _createUserKey(userId)
    );
  }


  function clear() {
    followByUser.clear();
    recommendationByUser.clear();
    blockByUser.clear();
  }


  function size() {
    return {
      followUsers:
        followByUser.size(),
      recommendationUsers:
        recommendationByUser.size(),
      blockUsers:
        blockByUser.size()
    };
  }


  return Object.freeze({
    checkFollow,
    consumeFollow,
    checkRecommendation,
    consumeRecommendation,
    checkBlock,
    consumeBlock,
    clear,
    size
  });
}
