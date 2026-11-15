import { describe, expect, it } from 'vitest';
import { csvCell, toCsv } from '@/lib/csv';

describe('CSV export', () => {
  it('quotes commas, quotes and line breaks', () => {
    expect(toCsv([['a,b', 'say "hi"', 'two\nlines']])).toBe('"a,b","say ""hi""","two\nlines"');
  });

  it('stops cells from running as spreadsheet formulas', () => {
    expect(csvCell('=HYPERLINK("http://example.com")')).toBe('"\'=HYPERLINK(""http://example.com"")"');
    expect(csvCell('+254712345678')).toBe("'+254712345678");
    expect(csvCell('@SUM(A1)')).toBe("'@SUM(A1)");
    expect(csvCell('Kisumu')).toBe('Kisumu');
  });
});
