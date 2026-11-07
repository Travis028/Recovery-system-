/** @type {import('tailwindcss').Config} */

// Every colour comes from a CSS variable in src/styles/tokens.css, so the same class
// works in light and dark mode.
const token = (name) => `hsl(var(--${name}) / <alpha-value>)`;

const tone = (name) => ({
  DEFAULT: token(name),
  foreground: token(`${name}-foreground`),
  subtle: token(`${name}-subtle`),
  'subtle-foreground': token(`${name}-subtle-foreground`),
});

module.exports = {
  darkMode: ['class'],
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        background: token('background'),
        foreground: token('foreground'),
        card: { DEFAULT: token('card'), foreground: token('card-foreground') },
        popover: { DEFAULT: token('popover'), foreground: token('popover-foreground') },
        muted: { DEFAULT: token('muted'), foreground: token('muted-foreground') },
        border: { DEFAULT: token('border'), strong: token('border-strong') },
        input: token('input'),
        ring: token('ring'),
        primary: { ...tone('primary'), hover: token('primary-hover') },
        accent: tone('accent'),
        success: { ...tone('success'), border: token('success-border') },
        warning: { ...tone('warning'), border: token('warning-border') },
        danger: { ...tone('danger'), border: token('danger-border') },
        info: { ...tone('info'), border: token('info-border') },
        chart: { 1: token('chart-1'), 2: token('chart-2'), grid: token('chart-grid') },
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      fontFamily: {
        heading: ['var(--font-heading)'],
        body: ['var(--font-body)'],
        mono: ['var(--font-mono)'],
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
};
