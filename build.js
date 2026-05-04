#!/usr/bin/env node
/**
 * Build script for Backend Engineer Learning Plan.
 * Run: node build.js
 * Output: index.html
 */
import { readFileSync, readdirSync, existsSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { spawnSync } from 'child_process';

const HERE = dirname(fileURLToPath(import.meta.url));
const read = f => readFileSync(join(HERE, f), 'utf8');

function check(label, code) {
  const r = spawnSync('node', ['--check', '-'], { input: code, encoding: 'utf8' });
  if (r.status !== 0) {
    console.error(`❌ Syntax error in ${label}:\n${r.stderr.slice(0, 400)}`);
    process.exit(1);
  }
  console.log(`✓ ${label}`);
}

// ── Import module data files ─────────────────────────────────────
const moduleFiles = readdirSync(join(HERE, 'data'))
  .filter(f => f.endsWith('.js'))
  .sort();

if (!moduleFiles.length) { console.error('❌ No files found in data/'); process.exit(1); }
console.log(`Importing ${moduleFiles.length} module files: [${moduleFiles.join(', ')}]`);

const modules = await Promise.all(
  moduleFiles.map(f => import(`./data/${f}`).then(m => m.default))
);

// ── Assemble PLAN ────────────────────────────────────────────────
const PLAN = {
  meta: {
    title: "Backend Engineer Learning Plan",
    subtitle: "16 weeks · Java / Spring Boot · Banking platforms",
    context: "A hands-on learning plan for backend engineers working with Java, Spring Boot, and cloud-native banking platforms. Covers database internals, JVM performance, Spring internals, Kubernetes, networking, and system design."
  },
  quality_refs: [
    { name: "roadmap.sh/backend",                   note: "Plan covers 90%+ of the backend roadmap core topics in the right priority order" },
    { name: "DDIA by Kleppmann",                    note: "7 chapters integrated — DB internals, transactions, partitioning, distributed systems" },
    { name: "High Performance Browser Networking",  note: "TCP, TLS, HTTP chapters map directly to Weeks 11–12" },
    { name: "Use the Index, Luke (Winand)",          note: "Weeks 1–3 implement this book's curriculum as hands-on labs" },
    { name: "Java Performance (Scott Oaks)",         note: "JVM/GC tuning in Weeks 5–6 follows this book's methodology" },
    { name: "ByteByteGo System Design",             note: "System design week aligns with ByteByteGo foundational topics" }
  ],
  modules
};

const combined = `const PLAN = ${JSON.stringify(PLAN)};`;
console.log('✓ all module data files');

// ── Validate hand-written scripts ────────────────────────────────
const renderer = read('renderer.js');
const viz      = read('interactive_visuals.js');
const css      = read('styles.css');

check('renderer.js', renderer);
check('interactive_visuals.js', viz);

// ── Embed starter zip ────────────────────────────────────────────
const zipPath = join(HERE, 'banking-app-starter.zip');
let dlJs;
if (existsSync(zipPath)) {
  const zipB64 = readFileSync(zipPath).toString('base64');
  dlJs = `function downloadStarterZip(){
  const b64='${zipB64}';
  const binary=atob(b64);
  const bytes=new Uint8Array(binary.length);
  for(let i=0;i<binary.length;i++)bytes[i]=binary.charCodeAt(i);
  const a=Object.assign(document.createElement('a'),{
    href:URL.createObjectURL(new Blob([bytes],{type:'application/zip'})),
    download:'banking-app-starter.zip'
  });
  a.click();
}`;
  console.log(`✓ banking-app-starter.zip embedded (${Math.floor(zipB64.length / 1024)}KB base64)`);
} else {
  dlJs = "function downloadStarterZip(){alert('starter zip not found in build directory');}";
  console.warn('⚠ banking-app-starter.zip not found — download button will show alert');
}

// ── HTML shell ───────────────────────────────────────────────────
const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Backend Engineer Learning Plan</title>
<link rel="icon" href="data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>🌟</text></svg>">
<style>${css}</style>
</head>
<body>
<div class="layout">
  <nav class="sidebar">
    <div class="sb-logo">
      <div class="sb-logo-title">Backend Engineer Plan</div>
      <div class="sb-logo-sub">16 weeks · Java / Spring Boot</div>
      <div class="sb-progress" id="sb-progress">Loading…</div>
    </div>
    <div style="padding:.4rem 0 0">
      <a class="sb-item" href="#overview">
        <span class="sb-dot" style="background:var(--sb-muted)"></span>Overview
      </a>
    </div>
    <div style="padding:.4rem 1.25rem .25rem">
      <button onclick="downloadStarterZip()" class="sb-download-btn"
              title="Download banking-app starter project (ZIP)">
        ⬇ Starter project (.zip)
      </button>
    </div>
    <div id="sidebar-nav"></div>
  </nav>
  <main>
    <div class="section-wrapper" id="overview">
      <div id="overview-content"></div>
    </div>
    <div id="main-content"></div>
  </main>
</div>
<script>
${dlJs}
${combined}
${viz}
${renderer}
</script>
</body>
</html>`;

writeFileSync(join(HERE, 'index.html'), html);
console.log(`\n✅ Built: index.html (${Math.floor(html.length / 1024)} KB)`);
