
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const root = path.dirname(fileURLToPath(import.meta.url));

// CSP is added to the built page only.
// OCR loads workers, WebAssembly and language files externally.
function csp(scriptHashes) {
  return [
    "default-src 'self'",
    [
      "script-src 'self'",
      ...scriptHashes,
      "'wasm-unsafe-eval'",
      "https://cdn.jsdelivr.net",
      "blob:"
    ].join(' '),
    "worker-src 'self' blob: https://cdn.jsdelivr.net",
    "connect-src 'self' https://cdn.jsdelivr.net https://tessdata.projectnaptha.com data: blob:",
    "img-src 'self' data: blob:",
    "style-src 'self' 'unsafe-inline'",
    "font-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'"
  ].join('; ');
}

// Hash the inline theme initialization script.
function inlineScriptHashes(html) {
  return [...html.matchAll(
    /<script id="theme-init">([\s\S]*?)<\/script>/g
  )].map((match) => {
    return "'sha256-" +
      createHash('sha256')
        .update(match[1])
        .digest('base64') +
      "'";
  });
}

function securityHeadersPlugin() {
  return {
    name: 'ldrs-security-meta',
    apply: 'build',
    transformIndexHtml(html) {
      return html.replace(
        '<!-- CSP -->',
        `<meta http-equiv="Content-Security-Policy" content="${csp(inlineScriptHashes(html))}" />
    <meta name="referrer" content="no-referrer" />`
      );
    }
  };
}

export default defineConfig({
  plugins: [react(), securityHeadersPlugin()],

  resolve: {
    alias: {
      '@': path.join(root, 'src'),
      // Data shared with the backend (county / sub-county / ward lists)
      '@shared': path.join(root, '..', 'shared')
    }
  },

  server: {
    port: 5175,
    strictPort: true,
    // Allow the dev server to read ../shared (the project root is one level up).
    fs: { allow: [path.join(root, '..')] },
    // Limit the development server to this laptop because /api/v6 is proxied to the backend.
    host: '127.0.0.1',
    // LDRS v6 backend (backend/, port 4001). Same-origin proxy keeps the session cookie HttpOnly + SameSite=Strict.
    proxy: {
      '/api/v6': {
        target: 'http://127.0.0.1:4001',
        changeOrigin: false
      }
    }
  },

  // `npm run preview` serves the built app on the same port, with the same proxy.
  preview: {
    port: 5175,
    strictPort: true,
    host: '127.0.0.1'
  },

  build: {
    outDir: 'dist',
    sourcemap: false,

    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            {
              name: 'react',
              test: /node_modules[\\/](react|react-dom|react-router-dom)[\\/]/
            },
            {
              name: 'radix',
              test: /node_modules[\\/]@radix-ui[\\/]/
            },
            {
              name: 'utils',
              test: /node_modules[\\/](date-fns|clsx|tailwind-merge|class-variance-authority)[\\/]/
            }
          ]
        }
      }
    }
  }
});
