/**
 * Builds CSV text. Cells that a spreadsheet would run as a formula (starting with =, +, -, @,
 * a tab or a carriage return) get a leading apostrophe, so an audit detail or a name typed
 * by a user cannot execute when the export is opened in Excel or LibreOffice.
 */
const FORMULA_START = /^[=+\-@\t\r]/;

export function csvCell(value) {
  let text = value === undefined || value === null ? '' : String(value);
  if (FORMULA_START.test(text)) text = "'" + text;
  return /[",\n\r]/.test(text) ? '"' + text.replace(/"/g, '""') + '"' : text;
}

export function toCsv(rows) {
  return rows
    .map(function (row) {
      return row.map(csvCell).join(',');
    })
    .join('\n');
}
