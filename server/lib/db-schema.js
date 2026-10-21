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

  if (!hasValidUsers || !hasValidReports) {
    const error = new Error(
      "La base de datos no contiene una estructura users válida."
    );

    error.code = "INVALID_DATABASE_STRUCTURE";

    throw error;
  }

  return db;
}
