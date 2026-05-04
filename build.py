#!/usr/bin/env python3
"""
Build script for Backend Engineer Learning Plan.
Run: python3 build.py
Output: index.html
"""
import base64, glob, re, subprocess, sys, os

HERE = os.path.dirname(os.path.abspath(__file__))

def read(f):
    return open(os.path.join(HERE, f)).read()

def check(label, code):
    r = subprocess.run(['node', '--check', '-'], input=code, capture_output=True, text=True)
    if r.returncode != 0:
        print(f"❌ Syntax error in {label}:")
        print(r.stderr[:400])
        sys.exit(1)
    print(f"✓ {label}")

# Read non-data source files
renderer = read('renderer.js')
css      = read('styles.css')
viz      = read('interactive_visuals.js')

# Read module data files in order (01_db, 02_java, …)
module_files = sorted(glob.glob(os.path.join(HERE, 'data', '*.js')))
if not module_files:
    print("❌ No files found in data/")
    sys.exit(1)
print(f"Reading {len(module_files)} module files: {[os.path.basename(f) for f in module_files]}")

def load_module(path):
    text = open(path).read()
    return re.sub(r'\bexport\s+default\s+', '', text, count=1)

modules_js = ',\n\n'.join(load_module(f) for f in module_files)

# Plan-level metadata (rarely changes — edit here if needed)
PLAN_META = """
  meta: {
    title: "Backend Engineer Learning Plan",
    subtitle: "13 weeks · Java / Spring Boot · Banking platforms",
    context: "A hands-on learning plan for backend engineers working with Java, Spring Boot, and cloud-native banking platforms. Covers database internals, JVM performance, Spring internals, Kubernetes, networking, and system design."
  },
  quality_refs: [
    { name: "roadmap.sh/backend", note: "Plan covers 90%+ of the backend roadmap core topics in the right priority order" },
    { name: "DDIA by Kleppmann", note: "7 chapters integrated — DB internals, transactions, partitioning, distributed systems" },
    { name: "High Performance Browser Networking (Grigorik)", note: "TCP, TLS, HTTP chapters map directly to Weeks 11–12" },
    { name: "Use the Index, Luke (Winand)", note: "Weeks 1–3 implement this book's curriculum as hands-on labs" },
    { name: "Java Performance (Scott Oaks, O'Reilly)", note: "JVM/GC tuning in Weeks 5–6 follows this book's methodology" },
    { name: "ByteByteGo System Design", note: "System design week aligns with ByteByteGo foundational topics" }
  ]
"""

combined = f"const PLAN = {{\n{PLAN_META},\n  modules: [\n\n{modules_js}\n\n  ]\n}};"

# Validate JS syntax
check('all module data files', combined)
check('renderer.js', renderer)
check('interactive_visuals.js', viz)
check('full script bundle', combined + '\n' + viz + '\n' + renderer)

# Embed starter zip if present
zip_path = os.path.join(HERE, 'banking-app-starter.zip')
if os.path.exists(zip_path):
    zip_b64 = base64.b64encode(open(zip_path, 'rb').read()).decode()
    dl_js = f"""function downloadStarterZip(){{
  const b64='{zip_b64}';
  const binary=atob(b64);
  const bytes=new Uint8Array(binary.length);
  for(let i=0;i<binary.length;i++)bytes[i]=binary.charCodeAt(i);
  const a=Object.assign(document.createElement('a'),{{
    href:URL.createObjectURL(new Blob([bytes],{{type:'application/zip'}})),
    download:'banking-app-starter.zip'
  }});
  a.click();
}}"""
    print(f"✓ banking-app-starter.zip embedded ({len(zip_b64)//1024}KB base64)")
else:
    dl_js = "function downloadStarterZip(){alert('starter zip not found in build directory');}"
    print("⚠ banking-app-starter.zip not found — download button will show alert")

# HTML shell
html = f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Backend Engineer Learning Plan</title>
<link rel="icon" href="data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>🌟</text></svg>">
<style>{css}</style>
</head>
<body>
<div class="layout">
  <nav class="sidebar">
    <div class="sb-logo">
      <div class="sb-logo-title">Backend Engineer Plan</div>
      <div class="sb-logo-sub">15 weeks · Java / Spring Boot</div>
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
{dl_js}
{combined}
{viz}
{renderer}
</script>
</body>
</html>"""

out = os.path.join(HERE, 'index.html')
with open(out, 'w') as f:
    f.write(html)

kb = len(html) // 1024
print(f"\n✅ Built: index.html ({kb} KB)")
