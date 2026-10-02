import {
  detectLibraryImportFormat
} from "./library-import-format.js";

import {
  parseLibraryImportCsv
} from "./library-import-csv.js";

import {
  normalizeLibraryImportRow,
  validateLibraryImportRow
} from "./library-import-row.js";

import {
  matchLibraryImportRow
} from "./library-import-matcher.js";

import {
  classifyLibraryImportBatch
} from "./library-import-classification.js";

function _makeImportPreviewError(code) {
  const error = new Error(code);
  error.code = code;
  return error;
}

function _buildSummary(rows = []) {
  const summary = {
    total: rows.length,
    matched: 0,
    doubtful: 0,
    notFound: 0,
    duplicate: 0,
    invalid: 0
  };

  for (const row of rows) {
    if (row.status === "matched") {
      summary.matched += 1;
    } else if (row.status === "doubtful") {
      summary.doubtful += 1;
    } else if (row.status === "not_found") {
      summary.notFound += 1;
    } else if (row.status === "duplicate") {
      summary.duplicate += 1;
    } else if (row.status === "invalid") {
      summary.invalid += 1;
    }
  }

  return summary;
}

export async function buildLibraryImportPreview(
  {
    text = "",
    library = []
  } = {},
  {
    matchRow = matchLibraryImportRow
  } = {}
) {
  const detected =
    detectLibraryImportFormat({
      text
    });

  if (detected.format !== "quacker_csv_v1") {
    parseLibraryImportCsv(text);

    throw _makeImportPreviewError(
      "unsupported_import_format"
    );
  }

  const parsed =
    parseLibraryImportCsv(text);

  const rows = [];
  const validEntries = [];
  const matchResults = [];

  for (
    let index = 0;
    index < parsed.rows.length;
    index += 1
  ) {
    const normalized =
      normalizeLibraryImportRow(
        parsed.rows[index]
      );

    const errors =
      validateLibraryImportRow(
        normalized
      );

    const rowNumber =
      index + 2;

    if (errors.length > 0) {
      rows.push({
        rowNumber,
        status: "invalid",
        data: normalized,
        errors
      });

      continue;
    }

    const result =
      await matchRow(normalized);

    validEntries.push({
      rowIndex: rows.length,
      rowNumber,
      data: normalized
    });

    matchResults.push(result);

    rows.push(null);
  }

  const classified =
    classifyLibraryImportBatch(
      matchResults,
      library
    );

  for (
    let index = 0;
    index < validEntries.length;
    index += 1
  ) {
    const entry =
      validEntries[index];

    rows[entry.rowIndex] = {
      rowNumber: entry.rowNumber,
      data: entry.data,
      errors: [],
      ...classified[index]
    };
  }

  return {
    format: detected.format,
    formatConfidence:
      detected.confidence,
    headers: parsed.headers,
    rows,
    summary: _buildSummary(rows)
  };
}
