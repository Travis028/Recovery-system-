import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const root = path.dirname(fileURLToPath(import.meta.url));

// Content Security Policy is added to the built page only (the dev server needs inline scripts).
// OCR (tesseract.js) loads its worker, WebAssembly core and language data from jsDelivr.
function csp(scriptHashes) {
  return [
    "default-src 'self'",
    ["script-src 'self'", ...scriptHashes, "'wasm-unsafe-eval' https://cdn.jsdelivr.net blob:"].join(' '),
    "worker-src 'self' blob: https://cdn.jsdelivr.net",
    "connect-src 'self' https://cdn.jsdelivr.net https://tessdata.projectnaptha.com data: blob:",
    "img-src 'self' data: blob:",
    "style-src 'self' 'unsafe-inline'",
    "font-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; ');
}

// The only inline script is the theme bootstrap in index.html; the CSP allows it by its hash.
function inlineScriptHashes(html) {
  return [...html.matchAll(/<script id="theme-init">([\s\S]*?)<\/script>/g)].map(function (match) {
    return "'sha256-" + createHash('sha256').update(match[1]).digest('base64') + "'";
  });
}

function securityHeadersPlugin() {
  return {
    name: 'ldrs-security-meta',
    apply: 'build',
    transformIndexHtml(html) {
      return html.replace(
        '<!-- CSP -->',
        `<meta http-equiv="Content-Security-Policy" content="${csp(inlineScriptHashes(html))}" />\n    <meta name="referrer" content="no-referrer" />`,
      );
    },
  };
}

export default defineConfig({
  plugins: [react(), securityHeadersPlugin()],
  resolve: {
    alias: { '@': path.join(root, 'src') },
  },
  server: { port: 5173, host: true },
  build: { outDir: 'dist', sourcemap: false, chunkSizeWarningLimit: 1200 },
});
