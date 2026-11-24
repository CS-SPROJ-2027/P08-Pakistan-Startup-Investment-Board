/**
 * Finds key numbers (revenue, burn, cash, headcount) in an uploaded spreadsheet (UC-005).
 * For each row, if a cell has one of the labels below, the first number to its right is taken.
 * An exact label match gets confidence 0.9. A label that only contains the word gets 0.6,
 * so it is marked "Verify" and the founder has to confirm it.
 * PDF and DOCX files are not read yet, so they are marked "Not yet extracted".
 */
import ExcelJS from 'exceljs';

export const EXTRACTOR_VERSION = 'rules-v1';

const LABELS: Record<string, string[]> = {
  revenue: ['revenue', 'total revenue', 'monthly revenue', 'sales'],
  burn: ['burn', 'monthly burn', 'burn rate'],
  cash: ['cash', 'cash in bank', 'cash balance'],
  headcount: ['headcount', 'employees', 'team size'],
};

export interface ExtractedField {
  fieldName: string;
  value: number;
  source: string;
  confidence: number;
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
      row.eachCell((cell) => {
        if (typeof cell.value === 'string') {
          label = matchLabel(cell.value);
          return;
        }
        const number = cellNumber(cell.value);
        if (label && number !== null) {
          // keep only the first value found for each field
          if (!found.some((f) => f.fieldName === label!.field)) {
            found.push({
              fieldName: label.field,
              value: number,
              source: `${sheet.name}!${cell.address}`,
              confidence: label.confidence,
            });
          }
          label = null;
        }
      });
    });
  });
  return found;
}
