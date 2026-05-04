# Backend Engineer Learning Plan

A hands-on 13-week learning plan for backend engineers working with Java, Spring Boot,
and cloud-native banking platforms.

## What's in this plan

| Module | Weeks | Topics |
|--------|-------|--------|
| Database Internals | 1–4 | B-tree indexes, partitioning, query optimiser, locking & isolation |
| Java Performance | 5–6 | JVM internals, GC tuning, memory leaks, thread dumps |
| Spring Internals | 7–8 | IoC container, bean lifecycle, AOP, @Transactional |
| Cloud & Kubernetes | 9–10b | Docker, K8s resources, HPA, deployment strategies, GitOps |
| Networking *(optional)* | 11–12 | OSI layers, TCP/IP, TLS, HTTP, DNS |
| System Design | 13 | Caching (Redis), Kafka, CAP theorem |

## Viewing the plan

Open `index.html` in a browser — it is a single self-contained file, no server needed.

## Editing the plan

All content lives in `data/`. Each file is one module:

```
data/
  01_db.js        DB module
  02_java.js      Java Performance
  03_spring.js    Spring Internals
  04_infra.js     Cloud & Kubernetes
  05_net.js       Networking
  06_design.js    System Design
```

After any edit, rebuild:

```bash
node build.js
```

This regenerates `index.html`. Requires Python 3 and Node.js (for syntax validation).

### Other source files

| File | Purpose |
|------|---------|
| `styles.css` | All CSS — theme variables, layout, component styles |
| `renderer.js` | JS rendering engine — turns data into HTML |
| `interactive_visuals.js` | Interactive diagrams (B-tree, deadlock, GC heap, etc.) |
| `build.py` | Build script — also contains HTML shell and plan metadata |

See `CLAUDE.md` for detailed editing instructions and data schema reference.

## Requirements

- Node.js (to run the build and for JS syntax validation)
- Docker (for database and infra labs)
- A Postgres client (psql or DBeaver) for DB labs
- Java 17+ and Maven for Spring Boot labs
