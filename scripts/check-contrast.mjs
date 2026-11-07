/**
 * Checks WCAG 2.1 contrast for the colour pairs the interface uses, in light and dark mode,
 * straight from src/styles/tokens.css. Run with `npm run check:contrast`; exits with 1 if a
 * pair is below its minimum.
 */
import { readFileSync } from 'node:fs';

const css = readFileSync(new URL('../src/styles/tokens.css', import.meta.url), 'utf8');

function tokens(block) {
  const out = {};
  for (const match of block.matchAll(/--([a-z0-9-]+):\s*(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)%\s+(\d+(?:\.\d+)?)%\s*;/g)) {
    out[match[1]] = [Number(match[2]), Number(match[3]), Number(match[4])];
  }
  return out;
}

const light = tokens(css.slice(0, css.indexOf('.dark')));
const dark = { ...light, ...tokens(css.slice(css.indexOf('.dark'))) };

function rgb([h, s, l]) {
  s /= 100;
  l /= 100;
  const k = (n) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  return [0, 8, 4].map((n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1))));
}

function luminance(color) {
  const [r, g, b] = rgb(color).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function ratio(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

// [text or mark token, surface token, minimum ratio, where it is used]
const PAIRS = [
  ['foreground', 'background', 4.5, 'body text'],
  ['foreground', 'card', 4.5, 'text on cards'],
  ['muted-foreground', 'card', 4.5, 'secondary text on cards'],
  ['muted-foreground', 'background', 4.5, 'secondary text on the page'],
  ['muted-foreground', 'muted', 4.5, 'table headers, chips'],
  ['primary', 'card', 4.5, 'links and link buttons'],
  ['primary-foreground', 'primary', 4.5, 'primary buttons'],
  ['primary-subtle-foreground', 'primary-subtle', 4.5, 'active menu item, badges'],
  ['accent-subtle-foreground', 'accent-subtle', 4.5, 'accent badges'],
  ['success-foreground', 'success', 4.5, 'success buttons'],
  ['danger-foreground', 'danger', 4.5, 'danger buttons'],
  ['success-subtle-foreground', 'success-subtle', 4.5, 'success alerts and badges'],
  ['warning-subtle-foreground', 'warning-subtle', 4.5, 'warning alerts and badges'],
  ['danger-subtle-foreground', 'danger-subtle', 4.5, 'error alerts and badges'],
  ['danger-subtle-foreground', 'card', 4.5, 'field error messages'],
  ['info-subtle-foreground', 'info-subtle', 4.5, 'info alerts and badges'],
  ['input', 'card', 3, 'form field borders'],
  ['ring', 'background', 3, 'focus ring'],
  ['chart-1', 'card', 3, 'chart series 1'],
  ['chart-2', 'card', 3, 'chart series 2'],
];

let failed = 0;
for (const [mode, set] of [['light', light], ['dark', dark]]) {
  console.log(`\n${mode} mode`);
  for (const [front, back, minimum, use] of PAIRS) {
    const value = ratio(set[front], set[back]);
    const ok = value >= minimum;
    if (!ok) failed += 1;
    console.log(`  ${ok ? 'pass' : 'FAIL'}  ${value.toFixed(2).padStart(5)}:1  (needs ${minimum})  ${front} on ${back}, ${use}`);
  }
}
console.log(failed ? `\n${failed} pair(s) below the minimum.` : '\nAll pairs meet WCAG AA.');
process.exit(failed ? 1 : 0);
