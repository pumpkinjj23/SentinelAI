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
    <title>SentinelAI — Red Noir AI-Assisted Security Alert Analysis</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500;600;700&family=Manrope:wght@400;600;700;800&family=Noto+Sans+Thai:wght@400;500;600;700&display=swap" rel="stylesheet">
    <script src="https://cdn.tailwindcss.com"></script>
    <script>
      tailwind.config = {
        darkMode: 'class',
        theme: {
          extend: {
            fontFamily: {
              sans: ['Manrope', 'Noto Sans Thai', 'Inter', 'sans-serif'],
              manrope: ['Manrope', 'Noto Sans Thai', 'sans-serif'],
              inter: ['Inter', 'Noto Sans Thai', 'sans-serif'],
              mono: ['JetBrains Mono', 'monospace'],
            },
            colors: {
              noir: {
                red: '#ef233c',
                crimson: '#d90429',
              },
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
        --accent-red: #ef233c;
        --accent-red-glow: rgba(239, 35, 60, 0.45);
      }

      @property --gradient-angle {
        syntax: "<angle>";
        initial-value: 0deg;
        inherits: false;
      }

      @keyframes border-spin {
        from { --gradient-angle: 0deg; }
        to { --gradient-angle: 360deg; }
      }

      @keyframes fade-in-up {
        from { opacity: 0; transform: translateY(14px); }
        to { opacity: 1; transform: translateY(0); }
      }

      @keyframes animStar {
        from { transform: translateY(0px); }
        to { transform: translateY(-2000px); }
      }

      body {
        font-family: 'Manrope', 'Noto Sans Thai', 'Inter', system-ui, sans-serif;
        overflow-x: hidden;
      }
      @media (min-width: 1024px) {
        body {
          overflow: hidden;
        }
      }

      .animate-fade-up {
        animation: fade-in-up 0.65s var(--sylva-ease) forwards;
      }

      /* Red Noir Shiny CTA Button */
      .shiny-cta {
        --gradient-angle: 0deg;
        position: relative;
        overflow: hidden;
        border-radius: 9999px;
        background: linear-gradient(#09090b, #09090b) padding-box,
          conic-gradient(from var(--gradient-angle), transparent 0%, #ef233c 10%, #ef233c 25%, #ff4d6d 35%, transparent 45%, transparent 100%) border-box;
        border: 2px solid transparent;
        cursor: pointer;
        isolation: isolate;
        animation: border-spin 2.8s linear infinite;
        box-shadow: 0 0 24px -4px rgba(239, 35, 60, 0.35);
      }
      .shiny-cta:hover {
        box-shadow: 0 0 32px -2px rgba(239, 35, 60, 0.55);
      }
      html:not(.dark) .shiny-cta {
        background: linear-gradient(#111114, #111114) padding-box,
          conic-gradient(from var(--gradient-angle), transparent 0%, #ef233c 10%, #ef233c 30%, transparent 45%, transparent 100%) border-box;
      }

      /* Parallax Stars for Red Noir Dark Canvas */
      .noir-stars-1 {
        box-shadow: 234px 124px rgba(255,255,255,0.45), 654px 345px rgba(255,255,255,0.35), 876px 12px rgba(239,35,60,0.5), 1200px 800px rgba(255,255,255,0.4), 400px 1500px rgba(255,255,255,0.3), 1800px 200px rgba(255,255,255,0.4), 100px 1000px rgba(239,35,60,0.45), 900px 1900px rgba(255,255,255,0.35), 500px 600px rgba(255,255,255,0.3), 1400px 100px rgba(255,255,255,0.4);
      }
      .noir-stars-2 {
        box-shadow: 123px 456px rgba(255,255,255,0.3), 789px 234px rgba(239,35,60,0.45), 456px 890px rgba(255,255,255,0.35), 1100px 300px rgba(255,255,255,0.3), 200px 1200px rgba(255,255,255,0.35), 1500px 500px rgba(239,35,60,0.4), 600px 1700px rgba(255,255,255,0.3);
      }

      /* Red Noir Dark Canvas & Crisp Red-Accent Light Canvas */
      .theme-bg-dark {
        background-color: #000000;
        background-image:
          radial-gradient(circle at 50% 0%, rgba(239, 35, 60, 0.16) 0px, transparent 50%),
          radial-gradient(circle at 85% 85%, rgba(239, 35, 60, 0.08) 0px, transparent 45%),
          linear-gradient(rgba(255, 255, 255, 0.025) 1px, transparent 1px),
          linear-gradient(90deg, rgba(255, 255, 255, 0.025) 1px, transparent 1px),
          linear-gradient(180deg, #1a0505 0%, #050507 40%, #000000 100%);
        background-size: 100% 100%, 100% 100%, 40px 40px, 40px 40px, 100% 100%;
      }

      .theme-bg-light {
        background-color: #f8f7f7;
        background-image:
          radial-gradient(at 10% 10%, rgba(239, 35, 60, 0.07) 0px, transparent 45%),
          radial-gradient(at 90% 15%, rgba(24, 24, 27, 0.05) 0px, transparent 45%),
          linear-gradient(rgba(0, 0, 0, 0.025) 1px, transparent 1px),
          linear-gradient(90deg, rgba(0, 0, 0, 0.025) 1px, transparent 1px),
          linear-gradient(180deg, #fafafa 0%, #f4f4f5 100%);
        background-size: 100% 100%, 100% 100%, 40px 40px, 40px 40px, 100% 100%;
      }

      /* Red Noir Shell & Bento Cards (No nested backdrop-filter so fixed modals cover full viewport) */
      .sylva-shell {
        background: rgba(9, 9, 11, 0.92);
        border: 1px solid rgba(255, 255, 255, 0.1);
        box-shadow: 0 24px 70px -12px rgba(0, 0, 0, 0.85), 0 0 40px -18px rgba(239, 35, 60, 0.25);
      }
      html:not(.dark) .sylva-shell {
        background: rgba(255, 255, 255, 0.96);
        border: 1px solid rgba(228, 228, 231, 0.95);
        box-shadow: 0 20px 50px -12px rgba(9, 9, 11, 0.08);
      }

      .sylva-glass-card {
        background: linear-gradient(180deg, rgba(24, 24, 27, 0.88) 0%, rgba(9, 9, 11, 0.96) 100%);
        border: 1px solid rgba(255, 255, 255, 0.1);
        box-shadow: 0 8px 28px -8px rgba(0, 0, 0, 0.65);
        transition: all 0.25s var(--sylva-ease);
      }
      .sylva-glass-card:hover {
        border-color: rgba(239, 35, 60, 0.28);
      }
      html:not(.dark) .sylva-glass-card {
        background: #ffffff;
        border: 1px solid #e4e4e7;
        box-shadow: 0 4px 16px -4px rgba(9, 9, 11, 0.05);
      }
      html:not(.dark) .sylva-glass-card:hover {
        border-color: rgba(239, 35, 60, 0.35);
      }

      /* Red Noir Global Accent Overrides — Full Crimson (#ef233c) Harmonization in Dark & Light Mode */
      html.dark .bg-emerald-600,
      html.dark .bg-emerald-500,
      html.dark .hover\\:bg-emerald-600:hover {
        background-color: #ef233c !important;
      }
      html.dark .hover\\:bg-emerald-500:hover {
        background-color: #d90429 !important;
      }
      html.dark .border-emerald-500,
      html.dark .hover\\:border-emerald-500:hover,
      html.dark .focus\\:border-emerald-500:focus {
        border-color: #ef233c !important;
      }
      html.dark .text-emerald-400,
      html.dark .dark\\:text-emerald-400,
      html.dark .text-emerald-500 {
        color: #ff4d6d !important;
      }
      html.dark .text-emerald-300,
      html.dark .dark\\:text-emerald-300 {
        color: #ff758f !important;
      }
      html.dark .text-emerald-200,
      html.dark .dark\\:text-emerald-200 {
        color: #fecdd3 !important;
      }
      html.dark .bg-emerald-400,
      html.dark .dark\\:bg-emerald-400 {
        background-color: #ef233c !important;
      }
      html.dark .border-emerald-500\\/40,
      html.dark .border-emerald-500\\/35,
      html.dark .border-emerald-400\\/40,
      html.dark .dark\\:border-emerald-400\\/40 {
        border-color: rgba(239, 35, 60, 0.42) !important;
      }
      html.dark .bg-emerald-500\\/20,
      html.dark .dark\\:bg-emerald-500\\/20,
      html.dark .bg-emerald-500\\/15,
      html.dark .dark\\:bg-emerald-500\\/15 {
        background-color: rgba(239, 35, 60, 0.16) !important;
      }
      html.dark .shadow-emerald-600\\/25,
      html.dark .shadow-emerald-600\\/20,
      html.dark .shadow-emerald-600\\/30,
      html.dark .shadow-emerald-500\\/20 {
        --tw-shadow-color: rgba(239, 35, 60, 0.38) !important;
      }

      /* Light Mode Red Noir Harmonization */
      html:not(.dark) .bg-emerald-600,
      html:not(.dark) .bg-emerald-500,
      html:not(.dark) .hover\\:bg-emerald-600:hover {
        background-color: #ef233c !important;
      }
      html:not(.dark) .hover\\:bg-emerald-500:hover {
        background-color: #d90429 !important;
      }
      html:not(.dark) .text-emerald-700,
      html:not(.dark) .text-emerald-600,
      html:not(.dark) .text-emerald-500 {
        color: #d90429 !important;
      }
      html:not(.dark) .border-emerald-500,
      html:not(.dark) .hover\\:border-emerald-500:hover,
      html:not(.dark) .focus\\:border-emerald-500:focus {
        border-color: #ef233c !important;
      }
      html:not(.dark) .bg-emerald-100,
      html:not(.dark) .bg-emerald-50,
      html:not(.dark) .bg-emerald-50\\/70,
      html:not(.dark) .hover\\:bg-emerald-50:hover {
        background-color: #fff1f2 !important;
      }
      html:not(.dark) .text-emerald-800,
      html:not(.dark) .text-emerald-900 {
        color: #9f1239 !important;
      }
      html:not(.dark) .border-emerald-300,
      html:not(.dark) .border-emerald-200 {
        border-color: #fda4af !important;
      }

      /* Ensure <select> options are always readable in both Dark and Light mode */
      select option {
        background-color: #09090b;
        color: #f4f4f5;
      }
      html:not(.dark) select option {
        background-color: #ffffff;
        color: #09090b;
      }

      .sylva-transition {
        transition: all 0.35s var(--sylva-ease);
      }

      .no-scrollbar::-webkit-scrollbar { display: none; }
      .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      ::-webkit-scrollbar { width: 6px; height: 6px; }
      ::-webkit-scrollbar-track { background: transparent; }
      ::-webkit-scrollbar-thumb { background: rgba(239, 35, 60, 0.38); border-radius: 9999px; }
    </style>
  </head>
  <body class="antialiased selection:bg-[#ef233c] selection:text-white">
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
