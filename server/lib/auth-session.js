export const SESSION_COOKIE_NAME = "connect.sid";

function _createSessionError(message, code, cause = null) {
  const error = new Error(message);
  error.code = code;

  if (cause) {
    error.cause = cause;
  }

  return error;
}

function _normalizeAuthVersion(value) {
  if (
    value === undefined ||
    value === null ||
    value === ""
  ) {
    return 1;
  }

  const normalizedValue = Number(value);

  if (
    !Number.isInteger(normalizedValue) ||
    normalizedValue < 1
  ) {
    return null;
  }

  return normalizedValue;
}

export function createSessionCookieOptions({
  isProduction = false,
  ttlSeconds = 24 * 60 * 60
} = {}) {
  const normalizedTtl = Number(ttlSeconds);

  if (
    !Number.isFinite(normalizedTtl) ||
    normalizedTtl <= 0
  ) {
    throw _createSessionError(
      "La duración de la sesión debe ser un número positivo.",
      "INVALID_SESSION_TTL"
    );
  }

  return {
    httpOnly: true,
    sameSite: "lax",
    secure: Boolean(isProduction),
    path: "/",
    maxAge: Math.floor(normalizedTtl * 1000)
  };
}

export function createSessionClearCookieOptions({
  isProduction = false
} = {}) {
  return {
    httpOnly: true,
    sameSite: "lax",
    secure: Boolean(isProduction),
    path: "/"
  };
}

export function getAuthenticatedUserId(
  sessionValue,
  users
) {
  const userId = String(
    sessionValue?.userId || ""
  ).trim();

  const hasValidUsers =
    users &&
    typeof users === "object" &&
    !Array.isArray(users);

  if (
    !userId ||
    !hasValidUsers ||
    !Object.prototype.hasOwnProperty.call(
      users,
      userId
    )
  ) {
    return null;
  }

  const userBucket = users[userId];

  if (
    !userBucket ||
    typeof userBucket !== "object" ||
    Array.isArray(userBucket)
  ) {
    return null;
  }

  const sessionAuthVersion =
    _normalizeAuthVersion(
      sessionValue?.authVersion
    );

  const userAuthVersion =
    _normalizeAuthVersion(
      userBucket?.auth?.authVersion
    );

  if (
    sessionAuthVersion === null ||
    userAuthVersion === null ||
    sessionAuthVersion !== userAuthVersion
  ) {
    return null;
  }

  return userId;
}

export function regenerateAuthenticatedSession(
  req,
  userId,
  authVersion = 1
) {
  const normalizedUserId =
    String(userId || "").trim();

  if (!normalizedUserId) {
    return Promise.reject(
      _createSessionError(
        "No se puede iniciar una sesión sin usuario.",
        "INVALID_SESSION_USER"
      )
    );
  }

  const normalizedAuthVersion =
    _normalizeAuthVersion(authVersion);

  if (normalizedAuthVersion === null) {
    return Promise.reject(
      _createSessionError(
        "La versión de autenticación de la sesión no es válida.",
        "INVALID_SESSION_AUTH_VERSION"
      )
    );
  }

  const currentSession = req?.session;

  if (
    !currentSession ||
    typeof currentSession.regenerate !== "function"
  ) {
    return Promise.reject(
      _createSessionError(
        "La sesión no permite regenerar su identificador.",
        "SESSION_REGENERATE_UNAVAILABLE"
      )
    );
  }

  return new Promise((resolve, reject) => {
    currentSession.regenerate(
      (regenerateError) => {
        if (regenerateError) {
          reject(
            _createSessionError(
              "No se pudo regenerar la sesión.",
              "SESSION_REGENERATE_FAILED",
              regenerateError
            )
          );

          return;
        }

        const nextSession = req?.session;

        if (
          !nextSession ||
          typeof nextSession.save !== "function"
        ) {
          reject(
            _createSessionError(
              "La nueva sesión no se puede guardar.",
              "SESSION_SAVE_UNAVAILABLE"
            )
          );

          return;
        }

        nextSession.userId =
          normalizedUserId;

        nextSession.authVersion =
          normalizedAuthVersion;

        nextSession.save((saveError) => {
          if (saveError) {
            reject(
              _createSessionError(
                "No se pudo guardar la sesión.",
                "SESSION_SAVE_FAILED",
                saveError
              )
            );

            return;
          }

          resolve(normalizedUserId);
        });
      }
    );
  });
}

export function destroyRequestSession(req) {
  const currentSession = req?.session;

  if (!currentSession) {
    return Promise.resolve();
  }

  if (typeof currentSession.destroy !== "function") {
    return Promise.reject(
      _createSessionError(
        "La sesión no se puede destruir.",
        "SESSION_DESTROY_UNAVAILABLE"
      )
    );
  }

  return new Promise((resolve, reject) => {
    currentSession.destroy((destroyError) => {
      if (destroyError) {
        reject(
          _createSessionError(
            "No se pudo destruir la sesión.",
            "SESSION_DESTROY_FAILED",
            destroyError
          )
        );
        return;
      }

      resolve();
    });
  });
}
