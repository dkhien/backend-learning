# CLAUDE.md — Backend Engineer Learning Plan

Instructions for Claude Code to edit the learning plan HTML file efficiently.

---

## Architecture overview

The final output is **one standalone HTML file** assembled from source files.
Always edit the source files, then run the build script to regenerate the HTML.

**Never edit `index.html` directly — it is overwritten on every build.**

```
data/                     — One JS file per module (edit these for content)
  01_db.js                  — DB module (weeks 1–4)
  02_java.js                — Java Performance module (weeks 5–6)
  03_spring.js              — Spring Internals module (weeks 7–8)
  04_infra.js               — Cloud & Kubernetes module (weeks 9–10b)
  05_net.js                 — Networking module (weeks 11–12, optional)
  06_design.js              — System Design module (week 13)

renderer.js               — JS rendering engine (DOM generation, interactions)
styles.css                — All CSS including theme variables
interactive_visuals.js    — Interactive diagram functions (VIZ object)
build.py                  — Assembles PLAN from data/ files; HTML shell lives here

Build output:
  index.html              — The single distributable file (build artifact)
```

The numbered prefix (01_, 02_, …) sets the sidebar order. All source files live
in the same directory as this CLAUDE.md (except module data, which is in `data/`).

---

## Build command

After any edit, run this to regenerate the HTML:

```bash
python3 build.py
```

The build script:
1. Reads `data/*.js` in sorted order (01 → 06)
2. Wraps them in `const PLAN = { meta, quality_refs, modules: [...] };`
3. Validates JS syntax with `node --check`
4. Embeds `banking-app-starter.zip` as base64
5. Writes `index.html`

The HTML shell (`<!DOCTYPE html>`, `<head>`, favicon, `<body>` scaffold) and
`PLAN_META` (title, subtitle, quality_refs) are embedded directly in `build.py`
— there is no `template.html`.

---

## Content structure

### Data format — every week follows this schema

```js
{
  id: "module-wN",          // e.g. "db-w1", "java-w5", "infra-w10b"
  num: "Week N",
  module: "db",             // db | java | spring | infra | net | design
  title: "...",
  subtitle: "...",
  hours: 11,
  tagClasses: ["tag-db", "tag-time"],
  tagLabels: ["DB Internals", "~11 hours"],
  optional: true,           // omit if not optional — shows amber badge
  ddia: {                   // omit if no DDIA reading
    chapter: "Chapter N — Title",
    note: "What to read and why"
  },
  diagram: { type: "btree", caption: "..." },  // omit if no diagram
  setup: {                  // week-level setup (old format, some weeks)
    label: "...",
    note: "...",
    code: `...`,
    lang: "sql"
  },
  labs: [ ...lab objects ],
  refs: [ ...ref objects ],
  checklist: [ "string", "string", ... ]
}
```

### Lab object schema

```js
{
  num: 1,
  title: "Lab title",
  goal: "One sentence — what the student achieves by the end.",
  optional: true,           // omit if not optional
  setup: {                  // per-lab setup block (boilerplate, always shown)
    desc: "Context sentence",
    steps: [
      { text: "Optional label", code: `...`, lang: "bash" },
      { text: "Text-only step with no code" }
    ]
  },
  explore: [                // numbered learning steps
    {
      text: "What to do — action first, then what to observe.",
      code: `...`,          // omit if no code for this step
      lang: "sql",
      reveal: true,         // omit unless code is a solution student should write
      os_tabs: [            // use instead of code if cross-platform commands needed
        { os: "Linux / macOS", lang: "bash", code: `...` },
        { os: "Windows", lang: "bash", code: `...` }
      ],
      note: "Short italic follow-up. What this means. Key takeaway."
    }
  ],
  hints: [
    { label: "Hint label", body: "Explanation text. Can include code inline." }
  ],
  solution: {               // omit unless full solution needed (Dockerfile etc.)
    lang: "dockerfile",
    content: `...`
  }
}
```

### Ref object schema

```js
{ type: "Postgres docs", name: "Link text", url: "https://...", desc: "One line." }
// url: null for books (DDIA etc.)
```

---

## Source file map — what to edit for each task

### Adding or editing lab content
→ Edit the matching file in **`data/`** — one file per module:

| File | Module | Weeks |
|------|--------|-------|
| `data/01_db.js` | Database Internals | db-w1 – db-w4 |
| `data/02_java.js` | Java Performance | java-w5 – java-w6 |
| `data/03_spring.js` | Spring Internals | spring-w7 – spring-w8 |
| `data/04_infra.js` | Cloud & Kubernetes | infra-w9 – infra-w10b |
| `data/05_net.js` | Networking | net-w11 – net-w12 |
| `data/06_design.js` | System Design | design-w13 |

Find the week by searching for `id: "week-id"`, e.g.:
```bash
grep -n 'id: "db-w3"' data/01_db.js
```

### Adding a new week
1. Add the week object to the correct module's `weeks: [...]` array
2. Add `id: "new-id"` in the sidebar — the renderer auto-generates it
3. If the week needs a new interactive diagram, add a `VIZ.typename` function in `interactive_visuals.js` and register it in the `vizMap` or `multiViz` object in `renderer.js`

### Changing visual styling
→ Edit **`styles.css`**

Theme variables are at the top in three blocks:
- `:root` — Slate theme (default)
- `[data-theme="pink"]` — Pink theme
- `[data-theme="dark"]` — Dark theme

Module accent colors are CSS variables: `--db-color`, `--java-color`, `--spring-color`, `--infra-color`, `--net-color`, `--design-color`

### Adding or editing interactive diagrams
→ Edit **`interactive_visuals.js`**

Each diagram is a method on the `VIZ` object:
```js
VIZ.typename = function(el) {
  el.innerHTML = `...your HTML...`
  // attach event handlers, animations etc.
}
```

Register it in `renderer.js`:
- Single viz per week: add to `vizMap` object in `buildContent()`
- Multiple viz per week: add to `multiViz` object in `buildContent()`

### Changing rendering logic or adding new UI components
→ Edit **`renderer.js`**

Key functions:
- `buildContent()` — generates all week/lab HTML, mounts viz
- `buildSidebar()` — generates nav items from PLAN.modules
- `buildOverview()` — generates the overview/hero section
- `labHTML(lab, color)` — renders a single lab card
- `exploreItem(item, idx)` — renders one numbered explore step
- `setupBlock(setup)` — renders the setup block above explore steps
- `codeBlock(code, lang)` — renders a dark-themed code block
- `osTabs(id, tabs)` — renders Linux/macOS/Windows tab switcher
- `revealBlock(code, lang)` — renders a hidden solution block
- `setTheme(name, btn)` — switches CSS theme and saves to localStorage
- `bloomParticles(btn)` — 🌸 flower animation on pink theme button click

### Changing the theme toggle or sidebar
→ Edit **`renderer.js`** — `buildSidebar()` function
→ Edit **`styles.css`** — `.sidebar`, `.sb-*`, `.theme-btn.*` rules

---

## Week and lab index

### data/01_db.js — Database Internals

| Week ID | Title | Labs |
|---------|-------|------|
| `db-w1` | B-tree Indexes & EXPLAIN ANALYZE | 1: Sequential scan, 2: Add indexes, 3: Index traps |
| `db-w2` | Partitioning, Triggers & Liquibase | 1: Partitioned table, 2: Audit trigger, 3: Liquibase |
| `db-w3` | Query Optimizer, N+1 & HikariCP | 1: Stale statistics, 2: HikariCP exhaustion, 3: N+1 problem |
| `db-w4` | Locking, Deadlocks & Isolation | 1: Isolation anomalies, 2: Deadlock reproduce & fix |

### data/02_java.js — Java Performance

| Week ID | Title | Labs |
|---------|-------|------|
| `java-w5` | JVM & GC Tuning | 1: GC logging, 2: G1GC vs ZGC |
| `java-w6` | Memory Leaks & Thread Pools | 1: Leak & heap dump, 2: Thread dump |

### data/03_spring.js — Spring Internals

| Week ID | Title | Labs |
|---------|-------|------|
| `spring-w7` | IoC Container & Bean Lifecycle | 1: BeanPostProcessor, 2: Autoconfiguration |
| `spring-w8` | AOP & @Transactional | 1: Self-invocation bug, 2: REQUIRES_NEW |

### data/04_infra.js — Cloud & Kubernetes

| Week ID | Title | Labs |
|---------|-------|------|
| `infra-w9` | Docker & Containerisation | 1: Dockerfile, 2: Docker Compose |
| `infra-w10` | K8s Resources, Scaling & Deployments | 1: OOMKill & QoS, 2: HPA, 3: Deployment strategies |
| `infra-w10b` | GitOps & CI/CD (optional) | 1: GitOps mental model, 2: JVM in K8s |

### data/05_net.js — Networking (optional weeks)

| Week ID | Title | Labs |
|---------|-------|------|
| `net-w11` | OSI Layers & TCP/IP | 1: ping & traceroute, 2: netcat, 3: curl & TLS |
| `net-w12` | HTTP, DNS & Debugging | 1: curl HTTP, 2: DNS & JVM cache |

### data/06_design.js — System Design

| Week ID | Title | Labs |
|---------|-------|------|
| `design-w13` | Caching, Kafka & CAP | 1: Redis cache-aside, 2: Kafka partitions |

---

## Interactive diagrams index

Defined in `interactive_visuals.js`, mounted in `renderer.js`:

| VIZ key | Week | What it shows |
|---------|------|---------------|
| `btree` | db-w1 | B-tree traversal animation — click value, watch path |
| `deadlock` | db-w4 | Two transactions deadlocking step by step |
| `n1` | db-w3 | N+1 vs JOIN FETCH side-by-side query counter |
| `gc` | java-w5 | Heap regions filling, Minor/Full GC buttons |
| `proxy` | spring-w8 | CGLIB proxy — external call vs self-invocation |
| `tcp` | net-w11 | TCP + TLS handshake animated sequence |
| `oomkill` | infra-w10 | JVM memory budget bars, QoS class cards |
| `hpa` | infra-w10 | HPA timeline — load spike → scale up → stabilise |
| `deploy` | infra-w10 | Rolling / Blue-Green / Canary tab switcher |
| `expandcontract` | infra-w10 | Three-phase column rename stepper |
| `gitops` | infra-w10b | Jenkins→ArgoCD→K8s clickable pipeline |

To add a new diagram:
1. Add `VIZ.newkey = function(el) { ... }` to `interactive_visuals.js`
2. In `renderer.js` `buildContent()`, add to `vizMap` (one per week) or `multiViz` (multiple per week)

---

## Common edit patterns

### Edit a single explore step

```bash
# Find line number
grep -n "text you want to change" data_part1.js

# Then edit that line with str_replace or direct edit
```

### Add a code block to an explore step

Change:
```js
{ text: "Run this query and observe the output." }
```
To:
```js
{
  text: "Run this query and observe the output.",
  code: `SELECT * FROM transactions WHERE account_id = 42;`,
  lang: "sql",
  note: "Expected: ~50 rows. Note the execution time."
}
```

### Add a hint

```js
hints: [
  { label: "Hint label shown on button", body: "Explanation. Can be long." }
]
```

### Mark a week or lab as optional

Add `optional: true` to the week or lab object. Renders an amber badge.

### Add a new explore step between existing ones

Find the explore array for the lab and insert at the correct position.
Each item is `{ text, code?, lang?, note?, reveal?, os_tabs? }`.

### Change a note to a reveal block

Change:
```js
{ text: "Write this service class.", note: "It should look like X." }
```
To:
```js
{ text: "Write this service class.", reveal: true, code: `@Service\n...`, lang: "java" }
```

---

## Rules for code blocks

- **Code blocks contain only runnable code** — no `# explanation comments` inside
- Explanations go in the `note` field below the code block
- Use `os_tabs` for cross-platform commands (Linux/macOS vs Windows)
- Use `reveal: true` when the code IS the answer the student writes
- Keep lines under ~80 chars — use `\` line continuation for bash, `@params` splatting for PowerShell
- Language values: `bash`, `sql`, `java`, `yaml`, `dockerfile`, `output`

---

## CSS theme variables quick reference

```css
/* Colours available as var(--name) */
--blue / --blue-bg / --blue-lt
--green / --green-bg / --green-lt
--amber / --amber-bg / --amber-lt
--red / --red-bg / --red-lt
--teal / --teal-bg / --teal-lt
--purple / --purple-bg / --purple-lt

/* Sidebar (theme-specific) */
--sb-bg          /* sidebar background */
--sb-text        /* nav item text */
--sb-muted       /* group labels */
--sb-active      /* active item text */
--sb-active-bg   /* active item background */

/* Content */
--bg / --bg2 / --bg3   /* section backgrounds */
--text / --muted / --hint
--accent / --accent-bg / --accent-lt
--border / --border2
```

---

## localStorage keys (do not change these)

| Key | Purpose |
|-----|---------|
| `pe-v3` | Checklist checkbox states (JSON object, key = checkbox id) |
| `pe-theme` | Selected theme name: `"slate"`, `"pink"`, or `"dark"` |

---

## Syntax validation

Just run the build — it validates all files before writing output:

```bash
python3 build.py
```

Each module file is a standalone JS object literal and is valid JS on its own
(unlike the old split-declaration approach). You can also spot-check one file:

```bash
node --check data/01_db.js
# (will show "Unexpected end of input" — normal, object literal is not a full script)
```

Common syntax errors:
- **Backtick inside template literal** — PowerShell `` ` `` line continuations break JS template strings. Use single-line commands or `@params` splatting instead.
- **Real newline in double-quoted string** — use template literals (backticks) for multiline code, not double quotes.
- **Unmatched brackets** — every `labs: [` needs a closing `]`, every `{` needs `}`. Check with the validator above.
