import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT || 3000);
const BACKEND_HOST = '127.0.0.1';
const BACKEND_PORT = Number(process.env.BACKEND_PORT || 8080);

function collectSourceFiles(dir, baseDir = dir, out = {}) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      collectSourceFiles(fullPath, baseDir, out);
    } else if (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx')) {
      if (entry.name.endsWith('.d.ts')) continue;
      const rel = './' + path.relative(baseDir, fullPath).replace(/\\/g, '/').replace(/\.(tsx|ts)$/, '');
      const code = fs.readFileSync(fullPath, 'utf-8').replace(/import\s+['"][^'"]+\.css['"];?/g, '');
      const transpiled = ts.transpileModule(code, {
        compilerOptions: {
          module: ts.ModuleKind.CommonJS,
          target: ts.ScriptTarget.ES2020,
          jsx: ts.JsxEmit.React,
          esModuleInterop: true,
        },
        fileName: entry.name,
      });
      out[rel] = transpiled.outputText;
    }
  }
  return out;
}

function buildAppBundle() {
  const reactCode = fs.readFileSync(
    path.join(__dirname, 'node_modules/react/cjs/react.production.min.js'),
    'utf-8'
  );
  const schedulerCode = fs.readFileSync(
    path.join(__dirname, 'node_modules/scheduler/cjs/scheduler.production.min.js'),
    'utf-8'
  );
  const reactDomCode = fs.readFileSync(
    path.join(__dirname, 'node_modules/react-dom/cjs/react-dom.production.min.js'),
    'utf-8'
  );
  const lucideCode = fs.readFileSync(
    path.join(__dirname, 'node_modules/lucide-react/dist/cjs/lucide-react.js'),
    'utf-8'
  );

  const srcModules = collectSourceFiles(path.join(__dirname, 'src'));

  const chunks = [];
  chunks.push('(function() {');
  chunks.push('  const process = { env: { NODE_ENV: "production" } };');
  chunks.push('  const modules = {};');
  chunks.push('  const cache = {};');
  chunks.push('  function defineMod(id, fn) { modules[id] = fn; }');
  chunks.push(`
  function resolveId(fromId, req) {
    if (!req.startsWith('.')) return req;
    const fromParts = fromId.split('/');
    fromParts.pop();
    const reqParts = req.split('/');
    for (const p of reqParts) {
      if (p === '.' || p === '') continue;
      if (p === '..') fromParts.pop();
      else fromParts.push(p);
    }
    const joined = './' + fromParts.filter((p) => p !== '.').join('/');
    if (modules[joined]) return joined;
    if (modules[joined + '/index']) return joined + '/index';
    return joined;
  }
  function requireMod(fromId, req) {
    const id = resolveId(fromId, req);
    if (cache[id]) return cache[id].exports;
    if (!modules[id]) throw new Error('Module not found: ' + id + ' (from ' + fromId + ')');
    const mod = { exports: {} };
    cache[id] = mod;
    modules[id](mod, mod.exports, function(r) { return requireMod(id, r); });
    return mod.exports;
  }
  `);

  chunks.push(`defineMod('react', function(module, exports, require) {\n${reactCode}\n});`);
  chunks.push(`defineMod('scheduler', function(module, exports, require) {\n${schedulerCode}\n});`);
  chunks.push(`defineMod('react-dom', function(module, exports, require) {\n${reactDomCode}\n});`);
  chunks.push(`defineMod('react-dom/client', function(module, exports, require) {
    const ReactDOM = require('react-dom');
    exports.createRoot = ReactDOM.createRoot;
    exports.hydrateRoot = ReactDOM.hydrateRoot;
  });`);
  chunks.push(`defineMod('lucide-react', function(module, exports, require) {\n${lucideCode}\n});`);

  for (const [modId, jsCode] of Object.entries(srcModules)) {
    chunks.push(`defineMod(${JSON.stringify(modId)}, function(module, exports, require) {\n${jsCode}\n});`);
  }

  chunks.push(`  requireMod('./root', './main');`);
  chunks.push('})();');
  return chunks.join('\n');
}

const INDEX_HTML = `<!doctype html>
<html lang="th" style="color-scheme: light;">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>SentinelAI — AI-Assisted Security Alert Analysis & Rule-Based Risk Prioritization</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600;700&family=Noto+Sans+Thai:wght@400;500;600;700&family=Plus+Jakarta+Sans:wght@500;600;700;800&display=swap" rel="stylesheet">
    <script src="https://cdn.tailwindcss.com"></script>
    <script>
      tailwind.config = {
        darkMode: 'class',
        theme: {
          extend: {
            fontFamily: {
              sans: ['Plus Jakarta Sans', 'Noto Sans Thai', 'Inter', 'sans-serif'],
              mono: ['JetBrains Mono', 'monospace'],
            },
            maxWidth: {
              '9xl': '96rem',
            },
          },
        },
      };
    </script>
    <style>
      :root {
        --sylva-ease: cubic-bezier(0.22, 1, 0.36, 1);
      }
      body {
        font-family: 'Plus Jakarta Sans', 'Noto Sans Thai', 'Inter', system-ui, sans-serif;
        overflow-x: hidden;
      }
      @media (min-width: 1024px) {
        body {
          overflow: hidden;
        }
      }

      /* High-Contrast Dark & Light Canvas */
      .theme-bg-dark {
        background-color: #0b1120;
        background-image:
          radial-gradient(at 10% 10%, rgba(16, 185, 129, 0.14) 0px, transparent 45%),
          radial-gradient(at 90% 15%, rgba(14, 165, 233, 0.12) 0px, transparent 45%),
          linear-gradient(180deg, #090e1a 0%, #0f172a 100%);
      }

      .theme-bg-light {
        background-color: #f1f5f9;
        background-image:
          radial-gradient(at 10% 10%, rgba(16, 185, 129, 0.08) 0px, transparent 45%),
          radial-gradient(at 90% 15%, rgba(14, 165, 233, 0.08) 0px, transparent 45%),
          linear-gradient(180deg, #f8fafc 0%, #eef2f6 100%);
      }

      /* Crisp High-Readability Frosted Shell & Cards (No nested backdrop-filter so fixed modals cover full viewport) */
      .sylva-shell {
        background: rgba(15, 23, 42, 0.94);
        border: 1px solid rgba(148, 163, 184, 0.18);
        box-shadow: 0 24px 64px -12px rgba(0, 0, 0, 0.6);
      }
      html:not(.dark) .sylva-shell {
        background: rgba(255, 255, 255, 0.96);
        border: 1px solid rgba(203, 213, 225, 0.9);
        box-shadow: 0 20px 50px -12px rgba(15, 23, 42, 0.08);
      }

      .sylva-glass-card {
        background: rgba(30, 41, 59, 0.92);
        border: 1px solid rgba(148, 163, 184, 0.18);
        box-shadow: 0 8px 24px -6px rgba(0, 0, 0, 0.35);
        transition: all 0.25s var(--sylva-ease);
      }
      html:not(.dark) .sylva-glass-card {
        background: #ffffff;
        border: 1px solid #e2e8f0;
        box-shadow: 0 4px 16px -4px rgba(15, 23, 42, 0.05);
      }

      /* Ensure <select> options are always readable in both Dark and Light mode */
      select option {
        background-color: #1e293b;
        color: #f8fafc;
      }
      html:not(.dark) select option {
        background-color: #ffffff;
        color: #0f172a;
      }

      .sylva-transition {
        transition: all 0.35s var(--sylva-ease);
      }

      .no-scrollbar::-webkit-scrollbar { display: none; }
      .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      ::-webkit-scrollbar { width: 6px; height: 6px; }
      ::-webkit-scrollbar-track { background: transparent; }
      ::-webkit-scrollbar-thumb { background: rgba(148, 163, 184, 0.35); border-radius: 9999px; }
    </style>
  </head>
  <body class="antialiased selection:bg-emerald-500 selection:text-white">
    <div id="root"></div>
    <script src="./app.bundle.js"></script>
  </body>
</html>`;

const distDir = path.join(__dirname, 'dist');
const rootDir = path.resolve(__dirname, '..');
fs.mkdirSync(distDir, { recursive: true });
const builtBundle = buildAppBundle();
fs.writeFileSync(path.join(distDir, 'index.html'), INDEX_HTML, 'utf-8');
fs.writeFileSync(path.join(distDir, 'app.bundle.js'), builtBundle, 'utf-8');
// Also emit index.html, app.bundle.js, and .nojekyll at repo root for GitHub Pages (https://pumpkinjj23.github.io/SentinelAI/)
fs.writeFileSync(path.join(rootDir, 'index.html'), INDEX_HTML, 'utf-8');
fs.writeFileSync(path.join(rootDir, 'app.bundle.js'), builtBundle, 'utf-8');
fs.writeFileSync(path.join(rootDir, '.nojekyll'), '', 'utf-8');

if (process.argv.includes('--build-only')) {
  console.log('[SentinelAI] High-Contrast Frosted bundle written to dist/ successfully.');
  process.exit(0);
}

const server = http.createServer((req, res) => {
  const url = req.url || '/';

  if (url.startsWith('/api')) {
    const proxyReq = http.request(
      {
        hostname: BACKEND_HOST,
        port: BACKEND_PORT,
        path: url,
        method: req.method,
        headers: req.headers,
      },
      (proxyRes) => {
        res.writeHead(proxyRes.statusCode || 500, proxyRes.headers);
        proxyRes.pipe(res, { end: true });
      }
    );
    proxyReq.on('error', (err) => {
      res.writeHead(502, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          detail: `SentinelAI Backend API (http://127.0.0.1:${BACKEND_PORT}) ยังไม่ได้เปิดใช้งาน: ${err.message}`,
        })
      );
    });
    req.pipe(proxyReq, { end: true });
    return;
  }

  if (url.startsWith('/app.bundle.js')) {
    try {
      const bundle = buildAppBundle();
      res.writeHead(200, {
        'Content-Type': 'application/javascript; charset=utf-8',
        'Cache-Control': 'no-store',
      });
      res.end(bundle);
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end(String(err));
    }
    return;
  }

  res.writeHead(200, {
    'Content-Type': 'text/html; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  res.end(INDEX_HTML);
});

server.listen(PORT, '0.0.0.0', () => {
  console.log('');
  console.log('  ====================================================================');
  console.log('  🛡️  SentinelAI — High-Contrast Frosted Glass SOC Server');
  console.log(`  ➜  Local URL:   http://localhost:${PORT}`);
  console.log(`  ➜  API Proxy:   http://${BACKEND_HOST}:${BACKEND_PORT}/api`);
  console.log('  ====================================================================');
  console.log('');
});
