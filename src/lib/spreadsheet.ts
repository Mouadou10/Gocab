/**
 * Universal Spreadsheet Parser Utility (CSV + XLSX / XLS)
 *
 * Parses uploaded File objects (from FormData) in .csv, .xlsx, or .xls format
 * into a uniform array of string-valued row objects: Record<string, string>[].
 */

import Papa from "papaparse";
import * as XLSX from "xlsx";

const KNOWN_HEADER_KEYWORDS = [
  "plate",
  "matricule",
  "immatriculation",
  "phone",
  "telephone",
  "téléphone",
  "tel",
  "gsm",
  "driver",
  "chauffeur",
  "conducteur",
  "nom",
  "name",
  "full_name",
  "fullname",
  "balance",
  "solde",
  "arrears",
  "dette",
  "cin",
  "status",
  "statut",
  "etat",
  "état",
  "brand",
  "marque",
  "model",
  "modele",
  "modèle",
  "city",
  "ville",
];

/**
 * Checks whether a buffer starts with ZIP (XLSX) or OLE2 (XLS) magic bytes,
 * or if the filename/mime indicates an Excel spreadsheet.
 */
function isExcelFile(fileName: string, mimeType: string, buffer: Buffer): boolean {
  const lower = fileName.toLowerCase();
  if (lower.endsWith(".xlsx") || lower.endsWith(".xls") || lower.endsWith(".ods")) {
    return true;
  }
  if (
    mimeType.includes("spreadsheet") ||
    mimeType.includes("excel") ||
    mimeType.includes("ms-excel")
  ) {
    return true;
  }
  // Check magic bytes: PK\x03\x04 (ZIP/XLSX) or \xD0\xCF\x11\xE0 (OLE2/XLS)
  if (buffer.length >= 4) {
    if (
      buffer[0] === 0x50 &&
      buffer[1] === 0x4b &&
      buffer[2] === 0x03 &&
      buffer[3] === 0x04
    ) {
      return true;
    }
    if (
      buffer[0] === 0xd0 &&
      buffer[1] === 0xcf &&
      buffer[2] === 0x11 &&
      buffer[3] === 0xe0
    ) {
      return true;
    }
  }
  return false;
}

/**
 * Parses an Excel worksheet (2D array of cell strings) into Record<string, string>[],
 * automatically locating the header row even if preceded by title rows.
 */
function parseSheetRows(matrix: any[][]): Record<string, string>[] {
  if (!matrix || matrix.length === 0) return [];

  // Find the best header row within the first 10 rows
  let headerRowIdx = 0;
  let bestScore = -1;

  const searchLimit = Math.min(matrix.length, 10);
  for (let r = 0; r < searchLimit; r++) {
    const row = matrix[r] || [];
    const nonEmptyCells = row
      .map((c) => String(c ?? "").trim())
      .filter((c) => c.length > 0);

    if (nonEmptyCells.length < 2) continue;

    let keywordMatches = 0;
    for (const cell of nonEmptyCells) {
      const lowerCell = cell.toLowerCase();
      if (KNOWN_HEADER_KEYWORDS.some((kw) => lowerCell.includes(kw))) {
        keywordMatches++;
      }
    }

    const score = keywordMatches * 10 + nonEmptyCells.length;
    if (score > bestScore) {
      bestScore = score;
      headerRowIdx = r;
    }
  }

  const rawHeaders = matrix[headerRowIdx] || [];
  const headers: string[] = rawHeaders.map((h, idx) => {
    const cleaned = String(h ?? "")
      .replace(/^\uFEFF/, "")
      .trim();
    return cleaned || `Column_${idx + 1}`;
  });

  const results: Record<string, string>[] = [];

  for (let r = headerRowIdx + 1; r < matrix.length; r++) {
    const row = matrix[r];
    if (!row || !Array.isArray(row)) continue;

    // Check if row has any non-empty value
    let hasContent = false;
    const obj: Record<string, string> = {};

    for (let c = 0; c < headers.length; c++) {
      const val = row[c] !== undefined && row[c] !== null ? String(row[c]).trim() : "";
      if (val.length > 0) hasContent = true;
      obj[headers[c]] = val;
    }

    if (hasContent) {
      results.push(obj);
    }
  }

  return results;
}

/**
 * Parses a File (CSV, XLSX, or XLS) into an array of row objects.
 */
export async function parseSpreadsheetFile(
  file: File
): Promise<{ rows: Record<string, string>[]; format: "EXCEL" | "CSV" }> {
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  if (isExcelFile(file.name || "", file.type || "", buffer)) {
    const workbook = XLSX.read(buffer, { type: "buffer", cellDates: true });

    let bestRows: Record<string, string>[] = [];

    for (const sheetName of workbook.SheetNames) {
      const worksheet = workbook.Sheets[sheetName];
      if (!worksheet) continue;

      const matrix = XLSX.utils.sheet_to_json<any[]>(worksheet, {
        header: 1,
        defval: "",
        raw: false,
      });

      const parsed = parseSheetRows(matrix);
      if (parsed.length > bestRows.length) {
        bestRows = parsed;
      }
      // If we found a substantial sheet with recognized columns, use it
      if (parsed.length > 0) {
        const keys = Object.keys(parsed[0]).map((k) => k.toLowerCase());
        const hasKnownHeader = keys.some((k) =>
          KNOWN_HEADER_KEYWORDS.some((kw) => k.includes(kw))
        );
        if (hasKnownHeader) {
          return { rows: parsed, format: "EXCEL" };
        }
      }
    }

    return { rows: bestRows, format: "EXCEL" };
  }

  // Fallback / Standard CSV parsing
  const rawText = buffer.toString("utf-8").replace(/^\uFEFF/, "");
  const parsed = Papa.parse<Record<string, string>>(rawText, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.replace(/^\uFEFF/, "").trim(),
  });

  const rows = (parsed.data || []).map((row) => {
    const cleaned: Record<string, string> = {};
    for (const [k, v] of Object.entries(row)) {
      cleaned[k.trim()] = v !== undefined && v !== null ? String(v).trim() : "";
    }
    return cleaned;
  });

  return { rows, format: "CSV" };
}
