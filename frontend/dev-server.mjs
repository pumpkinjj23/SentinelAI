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
    <title>SentinelAI 97 — Retro Windows 95 SOC Alert Triage System</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <script>
      tailwind.config = {
        darkMode: 'class',
        theme: {
          extend: {
            fontFamily: {
              sans: ['"MS Sans Serif"', 'Tahoma', 'Geneva', 'Verdana', 'sans-serif'],
              heading: ['"Arial Black"', 'Impact', 'Haettenschweiler', 'sans-serif'],
              mono: ['"Courier New"', 'Courier', 'monospace'],
            },
          },
        },
      };
    </script>
    <style>
      /* =========================================================================
         RETRO / 90s NOSTALGIA DESIGN SYSTEM (WINDOWS 95 / 1997 WEB)
         - 0px border-radius EVERYWHERE
         - Pure RGB / Win95 palette (#C0C0C0, #000000, #808080, #FFFFFF, #000080, #1084D0, #0000FF, #FF0000, #FFFF00, #00FF00, #FFFFCC)
         - Mandatory 3D Outset / Inset bevels, tiled pattern, construction stripes, groove HR, rainbow, marquee, hit counter
         ========================================================================= */

      * {
        border-radius: 0px !important;
        transition: none !important;
      }

      ::selection {
        background: #000080 !important;
        color: #ffffff !important;
      }

      body {
        font-family: "MS Sans Serif", Tahoma, Geneva, Verdana, sans-serif;
        color: #000000;
        background-color: #c0c0c0;
        overflow-x: hidden;
      }
      @media (min-width: 1024px) {
        body {
          overflow: hidden;
        }
      }

      h1, h2, h3, .retro-heading {
        font-family: "Arial Black", Impact, Haettenschweiler, "MS Sans Serif", sans-serif !important;
        font-weight: 900 !important;
      }

      /* 1. 90s Tiled Background Pattern (MANDATORY) */
      .theme-bg-light,
      .theme-bg-dark {
        background-color: #c0c0c0 !important;
        background-image:
          linear-gradient(45deg, #b8b8b8 25%, transparent 25%),
          linear-gradient(-45deg, #b8b8b8 25%, transparent 25%),
          linear-gradient(45deg, transparent 75%, #b8b8b8 75%),
          linear-gradient(-45deg, transparent 75%, #b8b8b8 75%) !important;
        background-size: 4px 4px !important;
        background-position: 0 0, 0 2px, 2px -2px, -2px 0px !important;
        color: #000000 !important;
      }

      /* 2. Windows 95 Outset / Inset 3D Bevels */
      .win95-outset,
      .sylva-shell,
      .sylva-glass-card {
        background: #c0c0c0 !important;
        border: 2px solid !important;
        border-color: #ffffff #808080 #808080 #ffffff !important;
        box-shadow: inset -1px -1px 0 #404040, inset 1px 1px 0 #dfdfdf !important;
        color: #000000 !important;
      }

      .win95-inset {
        background: #ffffff !important;
        border: 2px solid !important;
        border-color: #808080 #ffffff #ffffff #808080 !important;
        box-shadow: inset 1px 1px 0 #404040, inset -1px -1px 0 #dfdfdf !important;
        color: #000000 !important;
      }

      .win95-titlebar {
        background: linear-gradient(to right, #000080, #1084d0) !important;
        color: #ffffff !important;
        font-weight: 900 !important;
        padding: 4px 10px !important;
        display: flex;
        align-items: center;
        justify-content: space-between;
        border-bottom: 2px solid #000000;
      }

      /* 3. Construction Warning Stripes */
      .bg-construction {
        background: repeating-linear-gradient(
          45deg,
          #ffff00,
          #ffff00 10px,
          #000000 10px,
          #000000 20px
        ) !important;
      }

      /* 4. Groove Horizontal Rule (HR) */
      .hr-groove {
        border: none !important;
        height: 4px !important;
        width: 100%;
        background: linear-gradient(
          to bottom,
          #808080 0%, #808080 50%,
          #ffffff 50%, #ffffff 100%
        ) !important;
      }

      /* 5. Rainbow Text Animation */
      @keyframes rainbow {
        0% { color: #ff0000; }
        17% { color: #ff8000; }
        33% { color: #aaaa00; }
        50% { color: #00aa00; }
        67% { color: #0000ff; }
        83% { color: #8000ff; }
        100% { color: #ff0000; }
      }
      .text-rainbow {
        animation: rainbow 4s linear infinite;
        text-shadow: 2px 2px 0 #000000;
      }

      /* 6. Pulse Glow & Blink Animations */
      @keyframes pulse-glow {
        0%, 100% {
          transform: scale(1);
          box-shadow: 0 0 0 0 rgba(255, 0, 0, 0.7);
        }
        50% {
          transform: scale(1.05);
          box-shadow: 0 0 10px 2px rgba(255, 0, 0, 0.5);
        }
      }
      .animate-pulse-glow {
        animation: pulse-glow 1.5s ease-in-out infinite;
      }

      @keyframes retro-blink {
        50% { opacity: 0; }
      }
      .retro-blink {
        animation: retro-blink 1s step-end infinite;
      }

      /* 7. Pure CSS Marquee */
      @keyframes retro-marquee {
        0% { transform: translateX(0%); }
        100% { transform: translateX(-50%); }
      }
      .retro-marquee-track {
        display: flex;
        width: max-content;
        animation: retro-marquee 24s linear infinite;
      }
      .retro-marquee-wrap:hover .retro-marquee-track {
        animation-play-state: paused;
      }

      @media (prefers-reduced-motion: reduce) {
        .text-rainbow { animation: none; color: #ff0000; }
        .animate-pulse-glow, .retro-blink, .retro-marquee-track { animation: none; }
      }

      /* 8. Beveled Buttons Everywhere + Pressed State + Dotted Focus Ring */
      button {
        border: 2px solid !important;
        border-color: #ffffff #808080 #808080 #ffffff !important;
        box-shadow: inset -1px -1px 0 #404040, inset 1px 1px 0 #dfdfdf !important;
        font-weight: 700 !important;
      }
      button:active {
        border-color: #808080 #ffffff #ffffff #808080 !important;
        box-shadow: inset 1px 1px 0 #404040, inset -1px -1px 0 #dfdfdf !important;
        transform: translate(1px, 1px) !important;
      }
      button:focus-visible,
      input:focus-visible,
      select:focus-visible,
      textarea:focus-visible,
      a:focus-visible {
        outline: 2px dotted #000000 !important;
        outline-offset: 2px !important;
      }

      /* Primary Blue / Danger Red / Success Green Win95 Button Tinting */
      button.bg-emerald-600,
      button.bg-sky-600 {
        background-color: #0000ff !important;
        color: #ffffff !important;
        border-color: #5555ff #000080 #000080 #5555ff !important;
      }
      button.bg-emerald-600:hover,
      button.bg-sky-600:hover {
        background-color: #1084d0 !important;
      }
      button.bg-rose-600 {
        background-color: #ff0000 !important;
        color: #ffffff !important;
        border-color: #ff5555 #800000 #800000 #ff5555 !important;
      }
      button.bg-purple-600 {
        background-color: #800080 !important;
        color: #ffffff !important;
        border-color: #cc55cc #400040 #400040 #cc55cc !important;
      }
      button.bg-amber-500 {
        background-color: #ffff00 !important;
        color: #000000 !important;
        border-color: #ffffff #808000 #808000 #ffffff !important;
      }

      /* 9. Sunken Form Inputs & Selects */
      input, select, textarea {
        background-color: #ffffff !important;
        color: #000000 !important;
        border: 2px solid !important;
        border-color: #808080 #ffffff #ffffff #808080 !important;
        box-shadow: inset 1px 1px 0 #404040, inset -1px -1px 0 #dfdfdf !important;
      }
      input::placeholder, textarea::placeholder {
        color: #808080 !important;
      }

      /* 10. Classic Hyperlinks */
      a {
        color: #0000ff !important;
        text-decoration: underline !important;
      }
      a:visited {
        color: #800080 !important;
      }
      a:hover {
        color: #ff0000 !important;
      }

      /* 11. Table-Like Alternating Rows & Visible Cell Borders */
      table {
        border: 2px solid #808080 !important;
        background-color: #ffffff !important;
      }
      thead tr {
        background: linear-gradient(to right, #000080, #1084d0) !important;
        color: #ffffff !important;
      }
      thead th {
        color: #ffffff !important;
        border-right: 2px solid #808080 !important;
        border-bottom: 2px solid #000000 !important;
      }
      tbody tr:nth-child(even) {
        background-color: #ffffff !important;
      }
      tbody tr:nth-child(odd) {
        background-color: #e8e8e8 !important;
      }
      tbody td {
        border-right: 2px solid #808080 !important;
        border-bottom: 2px solid #808080 !important;
        color: #000000 !important;
      }

      /* 12. Inner Panels -> Win95 Inset White / Panel Yellow */
      .bg-slate-50,
      .bg-slate-100,
      .bg-emerald-50,
      .bg-emerald-50\\/70,
      .bg-sky-50\\/70 {
        background-color: #ffffcc !important;
        border: 2px solid !important;
        border-color: #808080 #ffffff #ffffff #808080 !important;
        color: #000000 !important;
      }

      .text-emerald-700,
      .text-emerald-600,
      .text-sky-700 {
        color: #0000ff !important;
      }

      /* Hit Counter Monospace Terminal Box */
      .hit-counter {
        background-color: #000000 !important;
        color: #00ff00 !important;
        font-family: "Courier New", Courier, monospace !important;
        border: 2px solid !important;
        border-color: #808080 #ffffff #ffffff #808080 !important;
        box-shadow: inset 1px 1px 0 #404040, inset -1px -1px 0 #dfdfdf !important;
        padding: 4px 10px;
        letter-spacing: 1px;
      }

      .no-scrollbar::-webkit-scrollbar { display: none; }
      .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      ::-webkit-scrollbar { width: 14px; height: 14px; }
      ::-webkit-scrollbar-track { background: #dfdfdf; border-left: 1px solid #808080; }
      ::-webkit-scrollbar-thumb {
        background: #c0c0c0;
        border: 2px solid;
        border-color: #ffffff #808080 #808080 #ffffff;
      }
    </style>
  </head>
  <body class="antialiased">
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
