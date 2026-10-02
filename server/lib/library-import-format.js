import {
  parseLibraryImportCsv
} from "./library-import-csv.js";

const UNKNOWN_FORMAT = Object.freeze({
  format: "unknown",
  confidence: "none"
});

const QUACKER_CSV_V1_FORMAT = Object.freeze({
  format: "quacker_csv_v1",
  confidence: "high"
});

export function detectLibraryImportFormat(input = {}) {
  const text = String(input?.text ?? "");

  if (!text.trim()) {
    return {
      ...UNKNOWN_FORMAT
    };
  }

  try {
    parseLibraryImportCsv(text);

    return {
      ...QUACKER_CSV_V1_FORMAT
    };
  } catch {
    return {
      ...UNKNOWN_FORMAT
    };
  }
}
