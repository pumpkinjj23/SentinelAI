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

      /* Cybersecurity SOC Command Blue & Cyan Canvas (Inspired by Microsoft Sentinel / CrowdStrike / Wazuh) */
      .theme-bg-dark {
        background-color: #050b14;
        background-image:
          radial-gradient(circle at 12% 8%, rgba(6, 182, 212, 0.14) 0px, transparent 42%),
          radial-gradient(circle at 88% 12%, rgba(37, 99, 235, 0.16) 0px, transparent 45%),
          linear-gradient(rgba(56, 189, 248, 0.04) 1px, transparent 1px),
          linear-gradient(90deg, rgba(56, 189, 248, 0.04) 1px, transparent 1px),
          linear-gradient(180deg, #060d18 0%, #091324 50%, #050b14 100%);
        background-size: 100% 100%, 100% 100%, 36px 36px, 36px 36px, 100% 100%;
      }

      .theme-bg-light {
        background-color: #f0f5fa;
        background-image:
          radial-gradient(at 10% 8%, rgba(2, 132, 199, 0.09) 0px, transparent 45%),
          radial-gradient(at 90% 12%, rgba(37, 99, 235, 0.07) 0px, transparent 45%),
          linear-gradient(rgba(15, 23, 42, 0.03) 1px, transparent 1px),
          linear-gradient(90deg, rgba(15, 23, 42, 0.03) 1px, transparent 1px),
          linear-gradient(180deg, #f6f9fc 0%, #eaf1f8 100%);
        background-size: 100% 100%, 100% 100%, 36px 36px, 36px 36px, 100% 100%;
      }

      /* SOC Command Shell & Glass Cards (No nested backdrop-filter so fixed modals cover full viewport) */
      .sylva-shell {
        background: rgba(8, 15, 28, 0.94);
        border: 1px solid rgba(56, 189, 248, 0.18);
        box-shadow: 0 24px 64px -12px rgba(0, 0, 0, 0.72), 0 0 32px -16px rgba(6, 182, 212, 0.25);
      }
      html:not(.dark) .sylva-shell {
        background: rgba(255, 255, 255, 0.95);
        border: 1px solid rgba(203, 213, 225, 0.95);
        box-shadow: 0 20px 50px -12px rgba(15, 23, 42, 0.09);
      }

      .sylva-glass-card {
        background: linear-gradient(180deg, rgba(15, 25, 44, 0.94) 0%, rgba(10, 18, 34, 0.96) 100%);
        border: 1px solid rgba(56, 189, 248, 0.16);
        box-shadow: 0 8px 24px -6px rgba(0, 0, 0, 0.45);
        transition: all 0.25s var(--sylva-ease);
      }
      .sylva-glass-card:hover {
        border-color: rgba(56, 189, 248, 0.34);
      }
      html:not(.dark) .sylva-glass-card {
        background: #ffffff;
        border: 1px solid #dbe4f0;
        box-shadow: 0 4px 16px -4px rgba(15, 23, 42, 0.05);
      }
      html:not(.dark) .sylva-glass-card:hover {
        border-color: rgba(2, 132, 199, 0.38);
      }

      /* Cybersecurity SOC Blue & Cyan Primary Accent Harmonization
         Keeps Severity badges (CRITICAL=Red, HIGH=Amber, MEDIUM=Sky, LOW=Green) crisp & distinct
         while unifying all primary UI buttons, active nav, and highlights into Cyber Blue (#0284c7 / #06b6d4). */
      html:not(.dark) .bg-emerald-600,
      html:not(.dark) .hover\\:bg-emerald-600:hover {
        background-color: #0284c7 !important;
      }
      html:not(.dark) .hover\\:bg-emerald-500:hover {
        background-color: #0369a1 !important;
      }
      html:not(.dark) .border-emerald-500,
      html:not(.dark) .hover\\:border-emerald-500:hover,
      html:not(.dark) .focus\\:border-emerald-500:focus {
        border-color: #0284c7 !important;
      }
      html:not(.dark) .border-emerald-500\\/40,
      html:not(.dark) .border-emerald-500\\/35 {
        border-color: rgba(2, 132, 199, 0.35) !important;
      }
      html:not(.dark) .text-emerald-700,
      html:not(.dark) .text-emerald-600 {
        color: #0369a1 !important;
      }
      html:not(.dark) .bg-emerald-50,
      html:not(.dark) .bg-emerald-50\\/70,
      html:not(.dark) .hover\\:bg-emerald-50:hover {
        background-color: #f0f9ff !important;
      }
      html:not(.dark) .border-emerald-200 {
        border-color: #bae6fd !important;
      }

      /* Dark Mode Cyber Cyan Accents */
      html.dark .bg-emerald-600,
      html.dark .hover\\:bg-emerald-600:hover {
        background-color: #0284c7 !important;
      }
      html.dark .hover\\:bg-emerald-500:hover {
        background-color: #0ea5e9 !important;
      }
      html.dark .border-emerald-500,
      html.dark .hover\\:border-emerald-500:hover,
      html.dark .focus\\:border-emerald-500:focus {
        border-color: #06b6d4 !important;
      }
      html.dark .border-emerald-500\\/40,
      html.dark .border-emerald-500\\/35 {
        border-color: rgba(6, 182, 212, 0.38) !important;
      }
      html.dark .dark\\:text-emerald-400,
      html.dark .text-emerald-400 {
        color: #38bdf8 !important;
      }
      html.dark .shadow-emerald-600\\/25,
      html.dark .shadow-emerald-600\\/20,
      html.dark .shadow-emerald-600\\/30,
      html.dark .shadow-emerald-500\\/20 {
        --tw-shadow-color: rgba(2, 132, 199, 0.35) !important;
      }

      /* Ensure <select> options are always readable in both Dark and Light mode */
      select option {
        background-color: #0f172a;
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
      ::-webkit-scrollbar-thumb { background: rgba(2, 132, 199, 0.38); border-radius: 9999px; }
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
