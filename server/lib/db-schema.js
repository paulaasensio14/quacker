export function createInitialDb() {
  return {
    users: {}
  };
}

export function validateDb(db) {
  const isValidRoot =
    db &&
    typeof db === "object" &&
    !Array.isArray(db);

  const hasValidUsers =
    isValidRoot &&
    db.users &&
    typeof db.users === "object" &&
    !Array.isArray(db.users);

  const hasValidReports =
    !isValidRoot ||
    !Object.hasOwn(db, "moderationReports") ||
    Array.isArray(db.moderationReports);

  const hasValidPendingRegistrations =
    !isValidRoot ||
    !Object.hasOwn(db, "pendingRegistrations") ||
    (
      db.pendingRegistrations !== null &&
      typeof db.pendingRegistrations === "object" &&
      !Array.isArray(db.pendingRegistrations)
    );

  if (
    !hasValidUsers ||
    !hasValidReports ||
    !hasValidPendingRegistrations
  ) {
    const error = new Error(
      "La base de datos no contiene una estructura users válida."
    );

    error.code = "INVALID_DATABASE_STRUCTURE";

    throw error;
  }

  return db;
}
