/**
 * Finds key numbers (revenue, costs, burn, cash, headcount) in an uploaded spreadsheet (UC-005).
 * For each row, if a cell has one of the labels below, all numbers to its right are read
 * (one per month). The last one is the latest month and is used as the value (UC-016 uses the rest).
 * An exact label match gets confidence 0.9. A label that only contains the word gets 0.6,
 * so it is marked "Verify" and the founder has to confirm it.
 * PDF and DOCX files are not read yet, so they are marked "Not yet extracted".
 */
import ExcelJS from 'exceljs';

export const EXTRACTOR_VERSION = 'rules-v1';

const LABELS: Record<string, string[]> = {
  revenue: ['revenue', 'total revenue', 'monthly revenue', 'sales'],
  cogs: ['cost of sales', 'cost of goods sold', 'cogs', 'direct costs'],
  costs: ['operating costs', 'total costs', 'expenses', 'operating expenses'],
  burn: ['burn', 'monthly burn', 'burn rate'],
  cash: ['cash', 'cash in bank', 'cash balance'],
  headcount: ['headcount', 'employees', 'team size'],
};

export interface MonthValue {
  value: number;
  cell: string;
}

export interface ExtractedField {
  fieldName: string;
  value: number;
  source: string;
  confidence: number;
  series: MonthValue[];
}

// Gets a number from a cell, including cells that hold a formula
function cellNumber(value: ExcelJS.CellValue): number | null {
  if (typeof value === 'number') {
    return value;
  }
  if (value && typeof value === 'object' && 'result' in value && typeof value.result === 'number') {
    return value.result;
  }
  return null;
}

// Returns the field name and confidence for a label cell, or null if it is not a label
function matchLabel(text: string) {
  const label = text.trim().toLowerCase();
  for (const field of Object.keys(LABELS)) {
    if (LABELS[field].includes(label)) {
      return { field, confidence: 0.9 };
    }
  }
  for (const field of Object.keys(LABELS)) {
    if (label.includes(field)) {
      return { field, confidence: 0.6 };
    }
  }
  return null;
}

export async function extractFromSpreadsheet(buffer: Buffer): Promise<ExtractedField[]> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as any);

  const found: ExtractedField[] = [];
  workbook.eachSheet((sheet) => {
    sheet.eachRow((row) => {
      let label: { field: string; confidence: number } | null = null;
      const series: MonthValue[] = [];
      row.eachCell((cell) => {
        if (typeof cell.value === 'string' && !label) {
          label = matchLabel(cell.value);
          return;
        }
        const number = cellNumber(cell.value);
        if (label && number !== null) {
          series.push({ value: number, cell: `${sheet.name}!${cell.address}` });
        }
      });

      // keep only the first row found for each field
      const match = label as { field: string; confidence: number } | null;
      if (match && series.length > 0 && !found.some((f) => f.fieldName === match.field)) {
        const latest = series[series.length - 1];
        found.push({
          fieldName: match.field,
          value: latest.value,
          source: latest.cell,
          confidence: match.confidence,
          series,
        });
      }
    });
  });
  return found;
}
