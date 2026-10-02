function _makeCsvError(code, message = code) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function _parseCsvRecords(input) {
  const text = String(input ?? "").replace(/^\uFEFF/, "");
  const records = [];

  let record = [];
  let field = "";
  let inQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];

    if (inQuotes) {
      if (char === '"') {
        if (text[index + 1] === '"') {
          field += '"';
          index += 1;
          continue;
        }

        inQuotes = false;
        continue;
      }

      field += char;
      continue;
    }

    if (char === '"') {
      inQuotes = true;
      continue;
    }

    if (char === ",") {
      record.push(field);
      field = "";
      continue;
    }

    if (char === "\n" || char === "\r") {
      if (char === "\r" && text[index + 1] === "\n") {
        index += 1;
      }

      record.push(field);
      field = "";

      const hasContent = record.some(
        (value) => String(value).length > 0
      );

      if (hasContent) {
        records.push(record);
      }

      record = [];
      continue;
    }

    field += char;
  }

  if (inQuotes) {
    throw _makeCsvError(
      "csv_unclosed_quote",
      "CSV contains an unclosed quoted field"
    );
  }

  record.push(field);

  const hasFinalContent = record.some(
    (value) => String(value).length > 0
  );

  if (hasFinalContent) {
    records.push(record);
  }

  return records;
}

export function parseLibraryImportCsv(input) {
  const records = _parseCsvRecords(input);

  if (records.length === 0) {
    throw _makeCsvError(
      "csv_empty",
      "CSV file is empty"
    );
  }

  const headers = records[0].map(
    (header) => String(header ?? "").trim()
  );

  const seenHeaders = new Set();

  for (const header of headers) {
    if (!header) {
      throw _makeCsvError(
        "csv_empty_header",
        "CSV contains an empty header"
      );
    }

    if (seenHeaders.has(header)) {
      throw _makeCsvError(
        "csv_duplicate_header",
        `CSV contains duplicate header: ${header}`
      );
    }

    seenHeaders.add(header);
  }

  const supportedHeaders = new Set([
    "title",
    "type",
    "year",
    "status",
    "progress",
    "author",
    "source",
    "externalId"
  ]);

  for (const header of headers) {
    if (!supportedHeaders.has(header)) {
      throw _makeCsvError(
        "csv_unsupported_header",
        `CSV contains unsupported header: ${header}`
      );
    }
  }

  const requiredHeaders = [
    "title",
    "type"
  ];

  const missingRequiredHeaders =
    requiredHeaders.filter(
      (header) => !seenHeaders.has(header)
    );

  if (missingRequiredHeaders.length > 0) {
    throw _makeCsvError(
      "csv_missing_required_headers",
      `CSV is missing required headers: ${missingRequiredHeaders.join(", ")}`
    );
  }

  const rows = records.slice(1).map(
    (record, rowIndex) => {
      if (record.length !== headers.length) {
        throw _makeCsvError(
          "csv_column_count_mismatch",
          `CSV row ${rowIndex + 2} has ${record.length} columns; expected ${headers.length}`
        );
      }

      const row = {};

      for (
        let index = 0;
        index < headers.length;
        index += 1
      ) {
        row[headers[index]] =
          String(record[index] ?? "");
      }

      return row;
    }
  );

  return {
    headers,
    rows
  };
}
