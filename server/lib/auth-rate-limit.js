import {
  createSlidingWindowRateLimiter
} from "./rate-limit.js";

export const AUTH_LOGIN_WINDOW_MS =
  15 * 60 * 1000;

export const AUTH_LOGIN_ACCOUNT_MAX_FAILURES =
  5;

export const AUTH_LOGIN_IP_MAX_FAILURES =
  30;

export const AUTH_REGISTER_WINDOW_MS =
  60 * 60 * 1000;

export const AUTH_REGISTER_IP_MAX_ATTEMPTS =
  5;

export const AUTH_PASSWORD_RESET_REQUEST_WINDOW_MS =
  60 * 60 * 1000;

export const AUTH_PASSWORD_RESET_REQUEST_EMAIL_MAX_ATTEMPTS =
  3;

export const AUTH_PASSWORD_RESET_REQUEST_IP_MAX_ATTEMPTS =
  10;

export const AUTH_PASSWORD_RESET_CONFIRM_WINDOW_MS =
  15 * 60 * 1000;

export const AUTH_PASSWORD_RESET_CONFIRM_IP_MAX_ATTEMPTS =
  10;

function _normalizeIp(value) {
  return (
    String(value ?? "")
      .trim()
      .toLowerCase() ||
    "unknown"
  );
}

function _normalizeEmail(value) {
  return (
    String(value ?? "")
      .trim()
      .toLowerCase() ||
    "unknown"
  );
}

function _createLoginAccountKey({
  ip,
  email
} = {}) {
  return [
    _normalizeIp(ip),
    _normalizeEmail(email)
  ].join("\u001f");
}

function _createIpKey(ip) {
  return _normalizeIp(ip);
}

function _createEmailKey(email) {
  return _normalizeEmail(email);
}

function _combineRateLimitStatuses(
  statuses
) {
  const blockedStatuses =
    statuses.filter(
      (status) => !status.allowed
    );

  return {
    allowed:
      blockedStatuses.length === 0,
    retryAfterSeconds:
      blockedStatuses.length > 0
        ? Math.max(
            ...blockedStatuses.map(
              (status) =>
                status.retryAfterSeconds
            )
          )
        : 0
  };
}

export function createAuthRateLimiters({
  now = Date.now
} = {}) {
  const loginByAccount =
    createSlidingWindowRateLimiter({
      windowMs: AUTH_LOGIN_WINDOW_MS,
      maxAttempts:
        AUTH_LOGIN_ACCOUNT_MAX_FAILURES,
      maxEntries: 5000,
      now
    });

  const loginByIp =
    createSlidingWindowRateLimiter({
      windowMs: AUTH_LOGIN_WINDOW_MS,
      maxAttempts:
        AUTH_LOGIN_IP_MAX_FAILURES,
      maxEntries: 2000,
      now
    });

  const registrationByIp =
    createSlidingWindowRateLimiter({
      windowMs: AUTH_REGISTER_WINDOW_MS,
      maxAttempts:
        AUTH_REGISTER_IP_MAX_ATTEMPTS,
      maxEntries: 2000,
      now
    });

  const passwordResetRequestByEmail =
    createSlidingWindowRateLimiter({
      windowMs:
        AUTH_PASSWORD_RESET_REQUEST_WINDOW_MS,
      maxAttempts:
        AUTH_PASSWORD_RESET_REQUEST_EMAIL_MAX_ATTEMPTS,
      maxEntries: 5000,
      now
    });

  const passwordResetRequestByIp =
    createSlidingWindowRateLimiter({
      windowMs:
        AUTH_PASSWORD_RESET_REQUEST_WINDOW_MS,
      maxAttempts:
        AUTH_PASSWORD_RESET_REQUEST_IP_MAX_ATTEMPTS,
      maxEntries: 2000,
      now
    });

  const passwordResetConfirmByIp =
    createSlidingWindowRateLimiter({
      windowMs:
        AUTH_PASSWORD_RESET_CONFIRM_WINDOW_MS,
      maxAttempts:
        AUTH_PASSWORD_RESET_CONFIRM_IP_MAX_ATTEMPTS,
      maxEntries: 2000,
      now
    });

  function checkLogin({
    ip,
    email
  } = {}) {
    return _combineRateLimitStatuses([
      loginByAccount.check(
        _createLoginAccountKey({
          ip,
          email
        })
      ),
      loginByIp.check(
        _createIpKey(ip)
      )
    ]);
  }

  function consumeLoginFailure({
    ip,
    email
  } = {}) {
    return _combineRateLimitStatuses([
      loginByAccount.consume(
        _createLoginAccountKey({
          ip,
          email
        })
      ),
      loginByIp.consume(
        _createIpKey(ip)
      )
    ]);
  }

  function resetLoginAccount({
    ip,
    email
  } = {}) {
    loginByAccount.reset(
      _createLoginAccountKey({
        ip,
        email
      })
    );
  }

  function checkRegistration({
    ip
  } = {}) {
    return registrationByIp.check(
      _createIpKey(ip)
    );
  }

  function consumeRegistration({
    ip
  } = {}) {
    return registrationByIp.consume(
      _createIpKey(ip)
    );
  }

  function checkPasswordResetRequest({
    ip,
    email
  } = {}) {
    return _combineRateLimitStatuses([
      passwordResetRequestByEmail.check(
        _createEmailKey(email)
      ),
      passwordResetRequestByIp.check(
        _createIpKey(ip)
      )
    ]);
  }

  function consumePasswordResetRequest({
    ip,
    email
  } = {}) {
    return _combineRateLimitStatuses([
      passwordResetRequestByEmail.consume(
        _createEmailKey(email)
      ),
      passwordResetRequestByIp.consume(
        _createIpKey(ip)
      )
    ]);
  }

  function checkPasswordResetConfirm({
    ip
  } = {}) {
    return passwordResetConfirmByIp.check(
      _createIpKey(ip)
    );
  }

  function consumePasswordResetConfirm({
    ip
  } = {}) {
    return passwordResetConfirmByIp.consume(
      _createIpKey(ip)
    );
  }

  function clear() {
    loginByAccount.clear();
    loginByIp.clear();
    registrationByIp.clear();
    passwordResetRequestByEmail.clear();
    passwordResetRequestByIp.clear();
    passwordResetConfirmByIp.clear();
  }

  function size() {
    return {
      loginAccounts:
        loginByAccount.size(),
      loginIps:
        loginByIp.size(),
      registrationIps:
        registrationByIp.size()
    };
  }

  return Object.freeze({
    checkLogin,
    consumeLoginFailure,
    resetLoginAccount,
    checkRegistration,
    consumeRegistration,
    clear,
    size,
    checkPasswordResetRequest,
    consumePasswordResetRequest,
    checkPasswordResetConfirm,
    consumePasswordResetConfirm
  });
}
