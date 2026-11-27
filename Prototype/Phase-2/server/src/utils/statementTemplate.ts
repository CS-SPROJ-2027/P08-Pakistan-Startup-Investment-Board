/**
 * Builds the financial statement template that founders download from the data room.
 * The row labels are the same ones extractFields looks for, so every value
 * in a filled template is read with full confidence.
 */
import ExcelJS from 'exceljs';

const ROWS = [
  ['Revenue', 'Money received from customers in the month'],
  ['Cost of sales', 'Direct cost of what was sold (stock, delivery, payment fees)'],
  ['Operating costs', 'Salaries, rent, marketing and all other running costs'],
  ['Monthly burn', 'Cash going out minus cash coming in (leave empty if profitable)'],
  ['Cash in bank', 'Bank balance at the end of the month'],
  ['Headcount', 'Number of people working full time'],
];

// The last 6 full months, oldest first, e.g. ["May 2026", ..., "Oct 2026"]
function lastSixMonths() {
  const months: string[] = [];
  const today = new Date();
  for (let i = 6; i >= 1; i--) {
    const date = new Date(today.getFullYear(), today.getMonth() - i, 1);
    months.push(date.toLocaleString('en-US', { month: 'short', year: 'numeric' }));
  }
  return months;
}

export async function buildTemplate() {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Financial statement');
  const months = lastSixMonths();

  sheet.addRow(['Financial statement (all amounts in PKR)']).font = { bold: true, size: 14 };
  sheet.addRow(['Fill in one column per month, oldest on the left. Leave a cell empty if you do not have the number. Do not change the labels in column A.']);
  sheet.addRow([]);

  const header = sheet.addRow(['Item', ...months, 'What to enter']);
  header.font = { bold: true };

  for (const [label, help] of ROWS) {
    // empty month cells, then the help text in the last column
    sheet.addRow([label, ...months.map(() => null), help]);
  }

  sheet.getColumn(1).width = 18;
  for (let c = 2; c <= months.length + 1; c++) {
    sheet.getColumn(c).width = 13;
    sheet.getColumn(c).numFmt = '#,##0';
  }
  sheet.getColumn(months.length + 2).width = 60;

  return Buffer.from(await workbook.xlsx.writeBuffer());
}
