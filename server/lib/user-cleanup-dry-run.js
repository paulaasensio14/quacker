import fs from "node:fs";
import path from "node:path";

import createKruptein from "kruptein";

import {
  readJsonFile
} from "./json-db.js";

import {
  validateDb
} from "./db-schema.js";

function createCleanupError(message, code) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function normalizeTargetUserIds(targetUserIds) {
  if (!Array.isArray(targetUserIds)) {
    return [];
  }

  return [
    ...new Set(
      targetUserIds
        .map((value) =>
          String(value ?? "").trim()
        )
        .filter(Boolean)
    )
  ];
}

function walkReferences(
  value,
  targetUserIds,
  currentPath,
  references
) {
  if (typeof value === "string") {
    if (targetUserIds.has(value)) {
      references.push({
        path: currentPath || "(root)"
      });
    }

    return;
  }

  if (
    value === null ||
    typeof value !== "object"
  ) {
    return;
  }

  if (Array.isArray(value)) {
    value.forEach((item, index) => {
      walkReferences(
        item,
        targetUserIds,
        `${currentPath}[${index}]`,
        references
      );
    });

    return;
  }

  for (const [key, nestedValue] of Object.entries(value)) {
    const isTargetKey =
      targetUserIds.has(key);

    const displayKey =
      isTargetKey
        ? "<target-key>"
        : key;

    const nestedPath = currentPath
      ? `${currentPath}.${displayKey}`
      : displayKey;

    if (isTargetKey) {
      references.push({
        path: nestedPath
      });
    }

    walkReferences(
      nestedValue,
      targetUserIds,
      nestedPath,
      references
    );
  }
}

function analyzeCrossUserReferences(
  users,
  targetUserIds
) {
  const targetSet = new Set(targetUserIds);
  const references = [];

  for (const [userId, userBucket] of Object.entries(users)) {
    if (targetSet.has(userId)) {
      continue;
    }

    walkReferences(
      userBucket,
      targetSet,
      "",
      references
    );
  }

  return {
    count: references.length,
    blocking: references.length > 0,
    references
  };
}

function isEncryptedSessionEnvelope(value) {
  return (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    ["ct", "hmac", "iv", "salt"].every(
      (key) =>
        Object.prototype.hasOwnProperty.call(
          value,
          key
        )
    )
  );
}

function decodeEncryptedSession(
  rawValue,
  sessionSecret
) {
  if (!sessionSecret) {
    throw createCleanupError(
      "No se puede inspeccionar una sesión cifrada sin SESSION_SECRET.",
      "SESSION_SECRET_REQUIRED"
    );
  }

  const crypto = createKruptein({
    algorithm: "aes-256-gcm",
    hashing: "sha512",
    use_scrypt: true
  });

  let plaintext;
  let decryptError;

  crypto.get(
    sessionSecret,
    rawValue,
    (error, value) => {
      decryptError = error || null;
      plaintext = value;
    }
  );

  if (decryptError || typeof plaintext !== "string") {
    throw createCleanupError(
      "No se pudo descifrar una sesión.",
      "SESSION_DECRYPT_FAILED"
    );
  }

  const decoded = JSON.parse(plaintext);

  return typeof decoded === "string"
    ? JSON.parse(decoded)
    : decoded;
}

function decodeSessionValue(
  rawValue,
  sessionSecret
) {
  const parsed = JSON.parse(rawValue);

  if (!isEncryptedSessionEnvelope(parsed)) {
    return parsed;
  }

  return decodeEncryptedSession(
    rawValue,
    sessionSecret
  );
}

function analyzeSessions(
  sessionDirectory,
  targetUserIds,
  sessionSecret
) {
  const result = {
    files: 0,
    validJson: 0,
    invalidJson: 0,
    targetSessions: 0
  };

  if (
    !sessionDirectory ||
    !fs.existsSync(sessionDirectory)
  ) {
    return result;
  }

  const targetSet = new Set(targetUserIds);

  const entries = fs.readdirSync(
    sessionDirectory,
    {
      withFileTypes: true
    }
  );

  for (const entry of entries) {
    if (!entry.isFile()) {
      continue;
    }

    result.files += 1;

    const sessionPath = path.join(
      sessionDirectory,
      entry.name
    );

    let sessionValue;

    try {
      sessionValue = decodeSessionValue(
        fs.readFileSync(
          sessionPath,
          "utf8"
        ),
        sessionSecret
      );

      result.validJson += 1;
    } catch {
      result.invalidJson += 1;
      continue;
    }

    const sessionUserId =
      typeof sessionValue?.userId === "string"
        ? sessionValue.userId.trim()
        : "";

    if (
      sessionUserId &&
      targetSet.has(sessionUserId)
    ) {
      result.targetSessions += 1;
    }
  }

  return result;
}

export function analyzeUserCleanupDryRun({
  dbPath,
  sessionDirectory,
  sessionSecret = "",
  targetUserIds
}) {
  const normalizedTargets =
    normalizeTargetUserIds(targetUserIds);

  if (normalizedTargets.length === 0) {
    throw createCleanupError(
      "Debes indicar al menos un usuario objetivo explícito.",
      "INVALID_USER_CLEANUP_TARGETS"
    );
  }

  const db = readJsonFile(dbPath, {
    validate: validateDb
  });

  const users = db.users;

  for (const targetUserId of normalizedTargets) {
    if (
      !Object.prototype.hasOwnProperty.call(
        users,
        targetUserId
      )
    ) {
      throw createCleanupError(
        "Uno o más usuarios objetivo no existen.",
        "USER_CLEANUP_TARGET_NOT_FOUND"
      );
    }
  }

  const targets = normalizedTargets.map(
    (targetUserId, index) => {
      const userBucket =
        users[targetUserId];

      return {
        index: index + 1,
        blocks:
          userBucket &&
          typeof userBucket === "object" &&
          !Array.isArray(userBucket)
            ? Object.keys(userBucket).sort()
            : []
      };
    }
  );

  return {
    mode: "dry-run",
    totalUsers: Object.keys(users).length,
    targetUsers: normalizedTargets.length,
    remainingUsers:
      Object.keys(users).length -
      normalizedTargets.length,
    targets,
    crossUserReferences:
      analyzeCrossUserReferences(
        users,
        normalizedTargets
      ),
    sessions: analyzeSessions(
      sessionDirectory,
      normalizedTargets,
      sessionSecret
    )
  };
}
