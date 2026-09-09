import fs from "fs";

export function checkJsonDatabaseReadiness(
  filePath,
  {
    validate
  } = {}
) {
  if (!fs.existsSync(filePath)) {
    return {
      ok: false,
      error: "database_not_found"
    };
  }

  let raw;

  try {
    raw = fs.readFileSync(filePath, "utf8");
  } catch {
    return {
      ok: false,
      error: "database_unreadable"
    };
  }

  let parsed;

  try {
    parsed = JSON.parse(raw);
  } catch {
    return {
      ok: false,
      error: "database_invalid_json"
    };
  }

  try {
    if (typeof validate === "function") {
      validate(parsed);
    }
  } catch {
    return {
      ok: false,
      error: "database_invalid_structure"
    };
  }

  return {
    ok: true
  };
}
