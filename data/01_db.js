// ================================================================
// MODULE 1 — DATABASE
// ================================================================
export default {
  id: "db", title: "Database Internals", color: "#1a5fb4",
  tagClass: "tag-db", icon: "🗄",
  desc: "The platform/backend team's most common fire drill — slow queries, deadlocks, schema issues. Weeks 1–4 build the depth to diagnose and fix these confidently.",
  weeks: [

  // ── WEEK 1 ──────────────────────────────────────────────────
  {
    id: "db-w1", num: "Week 1", module: "db",
    title: "B-tree Indexes & EXPLAIN ANALYZE",
    subtitle: "Understand how Postgres physically finds rows — the foundation of all query tuning",
    hours: 11, tagClasses: ["tag-db","tag-time"], tagLabels: ["DB Internals","~11 hours"],
    ddia: { chapter: "Chapter 3 — Storage and Retrieval", note: "Read the B-Tree section before the lab. It gives you the mental model behind everything you will measure this week." },
    objectives: [
      "Explain how a B-tree index stores and retrieves rows in O(log n)",
      "Read every line of an EXPLAIN ANALYZE output — cost, actual time, rows, loops",
      "Measure a real >100× speedup by adding the right index",
      "Identify five common patterns that silently prevent an index from being used",
      "Choose the correct column order for a composite index"
    ],
    diagram: { type: "btree", caption: "B-tree traversal vs sequential scan — the core mental model" },
    setup: {
      desc: "Spin up Postgres and seed the banking lab database. You will reuse this database for all four DB weeks.",
      steps: [
        { text: "Start a Postgres container:", code: "docker run --name pg-lab -e POSTGRES_PASSWORD=lab -p 5432:5432 -d postgres:16", lang: "bash" },
        { text: "Create the schema and seed 500 000 rows (takes ~20 seconds):", code:
`CREATE TABLE accounts (
  id          SERIAL PRIMARY KEY,
  customer_id INT NOT NULL,
  account_no  VARCHAR(20) NOT NULL UNIQUE,
  balance     NUMERIC(15,2),
  branch_id   INT NOT NULL,
  opened_at   DATE NOT NULL
);

CREATE TABLE transactions (
  id           BIGSERIAL PRIMARY KEY,
  account_id   INT NOT NULL,
  txn_type     VARCHAR(20) NOT NULL,
  amount       NUMERIC(15,2) NOT NULL,
  status       VARCHAR(20) NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  reference_no VARCHAR(50),
  branch_id    INT NOT NULL
);

INSERT INTO accounts (customer_id, account_no, balance, branch_id, opened_at)
SELECT (random()*50000+1)::INT, 'ACC'||LPAD(g::TEXT,8,'0'),
       (random()*100000)::NUMERIC(15,2), (random()*50+1)::INT,
       NOW()-(random()*1000||' days')::INTERVAL
FROM generate_series(1,10000) g;

INSERT INTO transactions
  (account_id,txn_type,amount,status,created_at,reference_no,branch_id)
SELECT (random()*9999+1)::INT,
       (ARRAY['DEBIT','CREDIT','TRANSFER'])[floor(random()*3+1)],
       (random()*5000+1)::NUMERIC(15,2),
       (ARRAY['COMPLETED','COMPLETED','COMPLETED','PENDING','FAILED'])
         [floor(random()*5+1)],
       NOW()-(random()*365||' days')::INTERVAL,
       'REF'||(random()*1000000)::BIGINT::TEXT,
       (random()*50+1)::INT
FROM generate_series(1,500000);

SELECT COUNT(*) FROM transactions;`, lang: "sql" }
      ]
    },
    labs: [
      {
        num: 1, title: "Observe a sequential scan",
        goal: "Run three queries with zero indexes. Record the exact execution times — these are your baseline numbers to beat in the next lab.",
        explore: [
          {
            text: "Run this query and record: execution time, node type, and 'Rows Removed by Filter'.",
            code: "EXPLAIN ANALYZE\nSELECT * FROM transactions\nWHERE account_id = 42;",
            lang: "sql",
            note: "Write down the Execution Time in ms. This is your baseline for Lab 2."
          },
          {
            text: "Run a multi-condition query. For each condition, identify what node type the planner chose.",
            code: "EXPLAIN ANALYZE\nSELECT * FROM transactions\nWHERE status = 'PENDING'\n  AND created_at > NOW() - INTERVAL '30 days';",
            lang: "sql"
          },
          {
            text: "Run a join query. Look at the full plan — where is most of the execution time being spent?",
            code: "EXPLAIN ANALYZE\nSELECT t.id, t.amount, a.account_no\nFROM transactions t\nJOIN accounts a ON t.account_id = a.id\nWHERE t.amount > 4000;",
            lang: "sql"
          },
          {
            text: "Answer in writing: what does 'Rows Removed by Filter: 499 951' tell you about how the database spent its time on query 1? Why is this expensive?"
          }
        ],
        hints: [
          { label: "How to read EXPLAIN ANALYZE output", body: "Each node shows two lines. (cost=X..Y rows=N width=W) is the planner's estimate before running. (actual time=X..Y rows=N loops=L) is what really happened. The most important numbers: 'actual time' (milliseconds), 'rows' (how many rows this node produced), 'Rows Removed by Filter' (rows read but discarded = wasted work). 'Execution Time' at the bottom is total wall clock." }
        ],
        solution: null
      },
      {
        num: 2, title: "Add indexes and measure the speedup",
        goal: "Create indexes for the three queries above, re-run them, and compare the plans and timings. Understand why each plan changed.",
        explore: [
          {
            text: "Create an index on account_id, then re-run query 1 from Lab 1.",
            code: "CREATE INDEX idx_txn_account ON transactions(account_id);\n\nEXPLAIN ANALYZE\nSELECT * FROM transactions\nWHERE account_id = 42;",
            lang: "sql",
            note: "What plan node replaced Seq Scan? By how much did execution time drop? Calculate the speedup ratio."
          },
          {
            text: "Create a composite index and re-run query 2. Then try reversing the column order and compare.",
            code: "CREATE INDEX idx_txn_status_date ON transactions(status, created_at);\n\nEXPLAIN ANALYZE\nSELECT * FROM transactions\nWHERE status = 'PENDING'\n  AND created_at > NOW() - INTERVAL '30 days';\n\n-- Now try the reverse order:\nDROP INDEX idx_txn_status_date;\nCREATE INDEX idx_txn_date_status ON transactions(created_at, status);\n\nEXPLAIN ANALYZE\nSELECT * FROM transactions\nWHERE status = 'PENDING'\n  AND created_at > NOW() - INTERVAL '30 days';",
            lang: "sql",
            note: "Which column order performs better for this query? Why?"
          },
          {
            text: "Check whether the planner uses an index on 'amount' for query 3, and measure the index size.",
            code: "CREATE INDEX idx_txn_amount ON transactions(amount);\n\nEXPLAIN ANALYZE\nSELECT t.id, t.amount, a.account_no\nFROM transactions t\nJOIN accounts a ON t.account_id = a.id\nWHERE t.amount > 4000;\n\nSELECT pg_size_pretty(pg_relation_size('idx_txn_amount'));",
            lang: "sql",
            note: "If the planner chose a Seq Scan despite the index existing, that may be correct. Think about why — what fraction of rows does amount > 4000 match?"
          }
        ],
        hints: [
          { label: "When the planner correctly ignores a valid index", body: "Postgres estimates whether index scan cost < seq scan cost. For amount > 4000, roughly 20% of rows match (~100 000 rows). Fetching 100 000 scattered heap pages via index (random I/O) is often slower than reading all pages sequentially. The planner uses the ratio of random_page_cost to seq_page_cost. Force the index with SET enable_seqscan = off to compare — but only in experiments, never production." },
          { label: "Composite index column order rule", body: "An index on (status, created_at) sorts entries by status first, then by date within each status group. A query filtering only on created_at cannot use this index — there is no sorted order for dates independent of status. Rule of thumb: put the equality column first (status = 'PENDING'), then the range column (created_at > X). Reverse the order and re-run EXPLAIN to see the plan change." }
        ],
        solution: null
      },
      {
        num: 3, title: "Index traps — five patterns that silently break your index",
        goal: "Each of these patterns is common in banking codebases, especially when JPA generates the SQL. For each one: confirm the index is skipped, then understand and write down why.",
        explore: [
          {
            text: "Trap 1 — function on the column. Confirm that wrapping the column in DATE() prevents index usage, then fix it.",
            code: "-- Does this use the index on created_at?\nEXPLAIN ANALYZE\nSELECT * FROM transactions\nWHERE DATE(created_at) = '2025-01-15';\n\n-- Fix: use a range instead\nEXPLAIN ANALYZE\nSELECT * FROM transactions\nWHERE created_at >= '2025-01-15'\n  AND created_at < '2025-01-16';",
            lang: "sql",
            note: "Why does DATE() break the index? Because the index stores raw timestamptz values, not the result of DATE(). The fix rewrites the condition to use the column directly."
          },
          {
            text: "Trap 2 — implicit type cast. reference_no is VARCHAR. Run both versions and compare the plans.",
            code: "CREATE INDEX idx_ref ON transactions(reference_no);\n\n-- Integer literal — will this use the index?\nEXPLAIN ANALYZE\nSELECT * FROM transactions WHERE reference_no = 12345;\n\n-- String literal — what changes?\nEXPLAIN ANALYZE\nSELECT * FROM transactions WHERE reference_no = '12345';",
            lang: "sql"
          },
          {
            text: "Trap 3 — leading wildcard. Run both LIKE patterns and explain from first principles why one uses the index and the other does not.",
            code: "-- Prefix match — index can be used\nEXPLAIN ANALYZE\nSELECT * FROM transactions WHERE reference_no LIKE 'REF%';\n\n-- Suffix match — cannot use the index\nEXPLAIN ANALYZE\nSELECT * FROM transactions WHERE reference_no LIKE '%12345';",
            lang: "sql",
            note: "B-trees store values sorted left-to-right. LIKE 'REF%' can jump to the REF section and scan forward. LIKE '%12345' has no starting point — the suffix has no sorted order in the index."
          },
          {
            text: "Trap 4 — stale statistics. Insert a large skewed batch, observe the wrong row estimate, then fix it.",
            code: "-- Insert 50 000 rows all with account_id = 1\nINSERT INTO transactions (account_id, txn_type, amount, status, created_at, branch_id)\nSELECT 1, 'CREDIT', 99.99, 'COMPLETED', NOW(), 1\nFROM generate_series(1, 50000);\n\n-- Check estimate BEFORE updating statistics\nEXPLAIN SELECT * FROM transactions WHERE account_id = 1;\n\n-- Fix: update statistics\nANALYZE transactions;\n\n-- Check estimate AFTER\nEXPLAIN SELECT * FROM transactions WHERE account_id = 1;",
            lang: "sql",
            note: "Compare 'rows=N' in the estimate before and after ANALYZE. The planner's wrong estimate before ANALYZE is exactly how bad query plans appear in production after large data loads."
          }
        ],
        hints: [
          { label: "Fixing the DATE() trap in JPA", body: "JPA/JPQL often generates WHERE DATE(created_at) = :date when you use LocalDate in your query. Fix in two ways: (1) change the Java query to use a date range (>= start AND < end), or (2) create a function-based index: CREATE INDEX ON transactions(DATE(created_at)). Option 1 is cleaner and avoids an extra index to maintain." }
        ],
        solution: null
      }
    ],
    refs: [
      { type: "Free book", name: "Use The Index, Luke", url: "https://use-the-index-luke.com", desc: "Best practical index resource. Read Part 1 (Anatomy) and Part 2 (Where Clause) this week." },
      { type: "Postgres docs", name: "Using EXPLAIN", url: "https://www.postgresql.org/docs/current/using-explain.html", desc: "Official guide. Bookmark — you will return to this constantly." },
      { type: "Tool", name: "pgMustard", url: "https://www.pgmustard.com/docs/explain", desc: "Paste your EXPLAIN output and get human-readable explanations with recommendations." },
      { type: "DDIA", name: "Chapter 3 — Storage and Retrieval", url: null, desc: "B-tree pages explain the why behind every experiment in this lab." }
    ],
    checklist: [
      "Can explain B-tree traversal vs seq scan from memory with no notes",
      "Measured a >100× speedup from a single well-chosen index",
      "Identified all major EXPLAIN node types: Seq Scan, Index Scan, Index Only Scan, Bitmap Heap Scan",
      "Found a case where Postgres correctly ignored a valid index — explained why",
      "Demonstrated that DATE(column) kills index usage — and rewrote the fix",
      "Explained from first principles why leading wildcards skip the B-tree"
    ]
  },

  // ── WEEK 2 ──────────────────────────────────────────────────
  {
    id: "db-w2", num: "Week 2", module: "db",
    title: "Partitioning, DB Design & Triggers",
    subtitle: "Handle billion-row transaction tables and banking audit requirements",
    hours: 12, tagClasses: ["tag-db","tag-time"], tagLabels: ["DB Internals","~12 hours"],
    ddia: { chapter: "Chapter 6 — Partitioning", note: "Read the whole chapter. Kleppmann explains key-range vs hash partitioning, secondary index strategies, and cross-partition query costs better than most official docs." },
    objectives: [
      "Design and create a range-partitioned table with monthly partitions",
      "Verify partition pruning with EXPLAIN — confirm which partitions are skipped",
      "Write a PL/pgSQL audit trigger that logs UPDATE and DELETE with old and new values",
      "Explain when to use DB triggers vs application-level audit logic",
      "Understand three partitioning strategies and their tradeoffs"
    ],
    diagram: { type: "partition", caption: "Partition pruning — only the target month is scanned" },
    labs: [
      {
        num: 1, title: "Design a partitioned transactions table",
        goal: "Create a range-partitioned table with monthly partitions. The goal is to understand why the syntax is structured the way it is — research the Postgres docs as you go rather than copying a finished answer.",
        setup: {
          desc: "Create the parent table to partition. Your job is to create the monthly partitions and indexes.",
          steps: [{
            code:
`CREATE TABLE transactions_part (
  id           BIGSERIAL,
  account_id   INT NOT NULL,
  txn_type     VARCHAR(20) NOT NULL,
  amount       NUMERIC(15,2) NOT NULL,
  status       VARCHAR(20) NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  branch_id    INT NOT NULL
) PARTITION BY RANGE (created_at);`,
            lang: "sql"
          }]
        },
        explore: [
          {
            text: "Research the Postgres partitioning docs and create monthly partitions for Jan–Dec 2025. What syntax declares a table as a partition of another? What does the upper bound mean — is it inclusive or exclusive?",
            note: "Postgres docs: https://www.postgresql.org/docs/current/ddl-partitioning.html — look for Declarative Partitioning. Tip: once you understand the pattern from the first two months, use generate_series to create the rest programmatically rather than typing 12 identical statements."
          },
          {
            text: "Seed data spread across all 12 months, then run an EXPLAIN to verify partition pruning is happening.",
            code:
`INSERT INTO transactions_part
  (account_id, txn_type, amount, status, created_at, branch_id)
SELECT (random()*9999+1)::INT,
       (ARRAY['DEBIT','CREDIT','TRANSFER'])[floor(random()*3+1)],
       (random()*5000+1)::NUMERIC(15,2),
       (ARRAY['COMPLETED','PENDING','FAILED'])[floor(random()*3+1)],
       '2025-01-01'::TIMESTAMPTZ + (random()*364||' days')::INTERVAL,
       (random()*50+1)::INT
FROM generate_series(1,100000);

-- Check partition pruning
EXPLAIN (ANALYZE, COSTS OFF)
SELECT * FROM transactions_part
WHERE created_at BETWEEN '2025-04-01' AND '2025-04-30';`,
            lang: "sql",
            note: "Look for 'Partitions excluded: N of 12' in the output. If you see all 12 being scanned, the partition bounds may not be set correctly."
          },
          {
            text: "Now query without the partition key and observe the difference.",
            code:
`EXPLAIN (ANALYZE, COSTS OFF)
SELECT * FROM transactions_part
WHERE account_id = 42;`,
            lang: "sql",
            note: "Are all partitions being scanned? What does this tell you about what indexes you need on partitioned tables? Fix it and re-run."
          },
          {
            text: "Insert a row with a date outside all partition bounds and observe what happens. What error does Postgres give you? How do you handle this in production?"
          }
        ],
        hints: [
          { label: "Partition syntax + script to create all 12", body: "Single partition: CREATE TABLE transactions_part_2025_01 PARTITION OF transactions_part FOR VALUES FROM ('2025-01-01') TO ('2025-02-01'); — upper bound is exclusive. To create all 12 at once after understanding the pattern: DO $$ DECLARE m INT; BEGIN FOR m IN 1..12 LOOP EXECUTE format('CREATE TABLE transactions_part_2025_%s PARTITION OF transactions_part FOR VALUES FROM (\'2025-%s-01\') TO (\'%s\')', lpad(m::text,2,'0'), lpad(m::text,2,'0'), CASE WHEN m=12 THEN '2026-01-01' ELSE '2025-'||lpad((m+1)::text,2,'0')||'-01' END); END LOOP; END $$; — understand the first two manually, then use this." },
          { label: "Fixing the cross-partition scan", body: "CREATE INDEX ON transactions_part(account_id); — Postgres automatically creates this index on all partitions. Re-run the EXPLAIN. You should now see Index Scans on individual partitions rather than Seq Scans across all of them." }
        ],
        solution: null
      },
      {
        num: 2, title: "Write a banking audit trigger",
        goal: "Regulators require that every modification to a financial record is logged — who changed it, when, and what the old value was. Design and build this from scratch.",
        setup: {
          desc: "Create the audit shadow table that the trigger will write to.",
          steps: [{
            code:
`CREATE TABLE transactions_audit (
  audit_id    BIGSERIAL PRIMARY KEY,
  txn_id      BIGINT NOT NULL,
  operation   VARCHAR(10) NOT NULL,
  changed_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  changed_by  TEXT NOT NULL DEFAULT current_user,
  old_status  VARCHAR(20),
  old_amount  NUMERIC(15,2),
  new_status  VARCHAR(20),
  new_amount  NUMERIC(15,2)
);`,
            lang: "sql"
          }]
        },
        explore: [
          {
            text: "Research PL/pgSQL trigger functions in the Postgres docs. Understand: what are OLD and NEW? When is NEW null? What should an AFTER trigger return? Then write the trigger function and the trigger definition.",
            note: "Docs: https://www.postgresql.org/docs/current/plpgsql-trigger.html — study the 'Overview of Trigger Behavior' and the OLD/NEW record variables."
          },
          {
            text: "Test your trigger by running UPDATE and DELETE statements, then check the audit table.",
            code:
`-- Test UPDATE
UPDATE transactions SET status = 'FAILED', amount = 1.00 WHERE id = 1;

-- Test DELETE
DELETE FROM transactions WHERE id = 2;

-- Verify audit log
SELECT * FROM transactions_audit ORDER BY changed_at DESC LIMIT 5;`,
            lang: "sql"
          },
          {
            text: "Improve the trigger to only log when status or amount actually changed — skip auditing if only branch_id changed. How do you compare OLD and NEW values conditionally in PL/pgSQL?"
          },
          {
            text: "Answer this design question: this trigger fires for every app that touches the table — including migration scripts, manual DBA queries, and your Spring Boot service. Is that good or bad? When would you prefer an AOP aspect in Spring instead?"
          }
        ],
        hints: [
          { label: "Trigger function skeleton — reveal when ready", reveal: true, body: "CREATE OR REPLACE FUNCTION audit_transactions() RETURNS TRIGGER AS $$ BEGIN IF TG_OP = 'DELETE' THEN INSERT INTO transactions_audit(txn_id, operation, old_status, old_amount) VALUES (OLD.id, TG_OP, OLD.status, OLD.amount); ELSIF TG_OP = 'UPDATE' THEN IF OLD.status != NEW.status OR OLD.amount != NEW.amount THEN INSERT INTO transactions_audit(txn_id, operation, old_status, old_amount, new_status, new_amount) VALUES (OLD.id, TG_OP, OLD.status, OLD.amount, NEW.status, NEW.amount); END IF; END IF; RETURN NEW; END; $$ LANGUAGE plpgsql;" }
        ],
        solution: null
      },
      {
        num: 3, title: "Database migrations with Liquibase",
        goal: "Every schema change in a production banking system goes through a migration tool — never ALTER TABLE directly. Backbase uses Liquibase. Understand the changelog model, run migrations, and roll back safely.",
        setup: {
          desc: "Use the same Spring Boot app from the HikariCP lab (Week 3), or create a minimal one with spring-boot-starter-web and spring-boot-starter-data-jpa. Add Liquibase and configure it to manage your schema.",
          steps: [
            {
              text: "Add to pom.xml:",
              code:
`<dependency>
  <groupId>org.liquibase</groupId>
  <artifactId>liquibase-core</artifactId>
</dependency>`,
              lang: "yaml"
            },
            {
              text: "Tell Liquibase where to find your changelog in application.yml:",
              code:
`spring:
  liquibase:
    change-log: classpath:db/changelog/db.changelog-master.yaml
    enabled: true
  datasource:
    url: jdbc:postgresql://localhost:5432/postgres
    username: postgres
    password: lab`,
              lang: "yaml"
            },
            {
              text: "Create the directory structure:",
              code: "mkdir -p src/main/resources/db/changelog",
              lang: "bash"
            }
          ]
        },
        explore: [
          {
            text: "Create your first changelog at src/main/resources/db/changelog/db.changelog-master.yaml. Write a changeSet that creates a simple table. Start the app and check the logs.",
            code:
`databaseChangeLog:
  - changeSet:
      id: 001-create-payments-table
      author: you
      changes:
        - createTable:
            tableName: payments
            columns:
              - column:
                  name: id
                  type: BIGINT
                  autoIncrement: true
                  constraints:
                    primaryKey: true
              - column:
                  name: amount
                  type: DECIMAL(15,2)
                  constraints:
                    nullable: false`,
            lang: "yaml",
            note: "On startup, Liquibase runs any changeSets not recorded in the DATABASECHANGELOG table. Check it: SELECT * FROM databasechangelog;"
          },
          {
            text: "Add a second changeSet that adds an index. Run the app — only the new changeSet should execute.",
            code:
`  - changeSet:
      id: 002-add-amount-index
      author: you
      changes:
        - createIndex:
            indexName: idx_payments_amount
            tableName: payments
            columns:
              - column:
                  name: amount`,
            lang: "yaml"
          },
          {
            text: "Modify an already-executed changeSet and try to start the app. What happens and why does Liquibase prevent it?",
            note: "Liquibase stores a checksum of each changeSet. If the content changes, the checksum no longer matches and Liquibase throws an error rather than silently applying a different migration. This prevents accidental schema drift between environments."
          },
          {
            text: "Run a rollback of the last 1 changeSet. What does Liquibase require to support rollback?",
            code:
`# Rollback the last 1 changeSet
mvn liquibase:rollback -Dliquibase.rollbackCount=1`,
            lang: "bash",
            note: "Liquibase auto-generates rollbacks for createTable (DROP TABLE) and createIndex (DROP INDEX). For custom SQL you must write an explicit rollback block. Rule: always test rollback before deploying to production."
          }
        ],
        hints: [
          { label: "Liquibase vs Flyway", body: "Both solve schema migration. Liquibase uses XML/YAML changelogs with explicit rollback support — used by Backbase. Flyway uses plain SQL files (V1__name.sql) with simpler setup but no built-in rollback. Backbase chose Liquibase for its rollback capabilities and multi-format support." }
        ],
        solution: null
      }
    ],
    refs: [
      { type: "Postgres docs", name: "Table Partitioning", url: "https://www.postgresql.org/docs/current/ddl-partitioning.html", desc: "Official guide. Covers declarative partitioning, pruning, and gotchas with Postgres 10+." },
      { type: "Postgres docs", name: "PL/pgSQL Triggers", url: "https://www.postgresql.org/docs/current/plpgsql-trigger.html", desc: "OLD and NEW record variables, RETURN values, WHEN conditions, timing." },
      { type: "DDIA", name: "Chapter 6 — Partitioning", url: null, desc: "Key-range vs hash partitioning, secondary index strategies, cross-partition queries." }
    ],
    refs: [
      { type: "Postgres docs", name: "Table Partitioning",
        goal: "Every schema change in a production banking system goes through a migration tool — never ALTER TABLE directly. Backbase uses Liquibase. Understand the changelog model, run migrations, and roll back safely.",
        setup: {
          desc: "Use the same Spring Boot app from the HikariCP lab (Week 3), or create a minimal one with spring-boot-starter-web and spring-boot-starter-data-jpa. Add Liquibase and configure it to manage your schema.",
          steps: [
            {
              text: "Add to pom.xml:",
              code:
`<dependency>
  <groupId>org.liquibase</groupId>
  <artifactId>liquibase-core</artifactId>
</dependency>`,
              lang: "yaml"
            },
            {
              text: "Tell Liquibase where to find your changelog in application.yml:",
              code:
`spring:
  liquibase:
    change-log: classpath:db/changelog/db.changelog-master.yaml
    enabled: true
  datasource:
    url: jdbc:postgresql://localhost:5432/postgres
    username: postgres
    password: lab`,
              lang: "yaml"
            },
            {
              text: "Create the directory structure:",
              code: "mkdir -p src/main/resources/db/changelog",
              lang: "bash"
            }
          ]
        },
        explore: [
          {
            text: "Create your first changelog file at src/main/resources/db/changelog/db.changelog-master.yaml. Write a changeSet that creates a simple table. Start the app and observe Liquibase output in the logs.",
            code:
`databaseChangeLog:
  - changeSet:
      id: 001-create-payments-table
      author: you
      changes:
        - createTable:
            tableName: payments
            columns:
              - column:
                  name: id
                  type: BIGINT
                  autoIncrement: true
                  constraints:
                    primaryKey: true
              - column:
                  name: amount
                  type: DECIMAL(15,2)
                  constraints:
                    nullable: false
              - column:
                  name: created_at
                  type: TIMESTAMP
                  defaultValueComputed: CURRENT_TIMESTAMP`,
            lang: "yaml",
            note: "On startup, Liquibase runs any changeSets not yet in the DATABASECHANGELOG table. Check that table: SELECT * FROM databasechangelog; — it records every migration ever applied."
          },
          {
            text: "Add a second changeSet that adds an index. Run the app again — only the new changeSet should execute.",
            code:
`  - changeSet:
      id: 002-add-payments-amount-index
      author: you
      changes:
        - createIndex:
            indexName: idx_payments_amount
            tableName: payments
            columns:
              - column:
                  name: amount`,
            lang: "yaml"
          },
          {
            text: "Try running the app with a changeSet that modifies an already-executed changeSet. What happens? Why does Liquibase prevent this?",
            note: "Liquibase computes a checksum for each changeSet when it first runs and stores it in DATABASECHANGELOG. If the changeSet content changes, the checksum no longer matches — Liquibase throws an error rather than silently applying a different migration. This prevents accidental schema drift between environments."
          },
          {
            text: "Run a rollback. What does Liquibase need to do a rollback, and what happens if you rollback a changeSet that has no rollback defined?",
            code:
`# Rollback the last 1 changeset
mvn liquibase:rollback -Dliquibase.rollbackCount=1`,
            lang: "bash",
            note: "Liquibase auto-generates rollbacks for createTable (DROP TABLE) and createIndex (DROP INDEX). For custom SQL changes you must write an explicit <rollback> block. In production: always test rollback before deploying. An unrollbackable migration is a risk."
          }
        ],
        hints: [
          { label: "Liquibase vs Flyway", body: "Both solve the same problem. Liquibase uses XML/YAML/JSON changelogs with explicit rollback support — used by Backbase. Flyway uses plain SQL files (V1__description.sql) with simpler setup but no built-in rollback. Backbase chose Liquibase for its rollback capabilities and multi-format support across DB vendors." }
        ],
        solution: null
      }
    ],
    checklist: [
      "Created range-partitioned table with monthly partitions",
      "Verified partition pruning — confirmed skipped partition count in EXPLAIN output",
      "Found the cross-partition scan problem and fixed it with a global index",
      "Audit trigger logs UPDATE and DELETE with correct old and new values",
      "Added conditional logging — skips audit when only insignificant columns change",
      "Can explain when to use DB triggers vs application-level auditing",
      "Created Liquibase changelogs for table creation and index — verified in DATABASECHANGELOG",
      "Understood why Liquibase prevents changeSet modification after execution"
    ]
  },

  // ── WEEK 3 ──────────────────────────────────────────────────
  {
    id: "db-w3", num: "Week 3", module: "db",
    title: "Query Optimizer, Statistics & Connection Pools",
    subtitle: "Why queries go bad in production — and how to prevent it",
    hours: 12, tagClasses: ["tag-db","tag-time"], tagLabels: ["DB Performance","~12 hours"],
    ddia: { chapter: "Chapter 7 — Transactions (MVCC section)", note: "MVCC explains why VACUUM is needed and how Postgres handles concurrent reads without blocking writers — directly relevant to this week's statistics and locking work." },
    objectives: [
      "Explain how the query planner uses pg_stats to choose a plan",
      "Reproduce a bad plan caused by stale statistics — then fix it with ANALYZE",
      "Understand what VACUUM does and why tables bloat without it",
      "Configure HikariCP and reproduce connection pool exhaustion",
      "Apply the correct pool sizing formula for a banking service"
    ],
    diagram: { type: "hikari", caption: "HikariCP pool exhaustion — what cascading timeouts look like" },
    labs: [
      {
        num: 1, title: "Break the optimizer with stale statistics",
        goal: "The planner makes decisions based on table statistics, not live data. Make the statistics wrong, observe the resulting bad plan, then fix it. This is exactly what happens after large bulk loads in production.",
        explore: [
          {
            text: "First, read the current statistics for key columns.",
            code:
`SELECT
  attname AS column_name,
  n_distinct,
  correlation,
  most_common_vals,
  most_common_freqs
FROM pg_stats
WHERE tablename = 'transactions'
  AND attname IN ('status', 'account_id', 'amount');`,
            lang: "sql",
            note: "n_distinct = number of distinct values the planner believes exist. correlation = how physically ordered the data is (1.0 = perfectly sorted, 0 = random). Low correlation means index scans require more random I/O."
          },
          {
            text: "Insert a large skewed batch — all rows with account_id = 1. This makes the statistics wrong without the planner knowing.",
            code:
`INSERT INTO transactions
  (account_id, txn_type, amount, status, created_at, branch_id)
SELECT 1, 'CREDIT', 99.99, 'COMPLETED', NOW(), 1
FROM generate_series(1, 50000);`,
            lang: "sql"
          },
          {
            text: "Check the planner's row estimate BEFORE running ANALYZE. Is it accurate?",
            code:
`-- What does the planner think it will find?
EXPLAIN SELECT * FROM transactions WHERE account_id = 1;`,
            lang: "sql",
            note: "Write down the 'rows=N' estimate. The real count is now ~50 050 but statistics still show the old distribution."
          },
          {
            text: "Run ANALYZE, then check the estimate again. Did the plan change?",
            code:
`ANALYZE transactions;
EXPLAIN SELECT * FROM transactions WHERE account_id = 1;`,
            lang: "sql",
            note: "Compare the new estimate to the real row count. This is why ANALYZE matters after bulk loads in production — and why autovacuum_analyze_scale_factor should be lowered for large, active tables."
          },
          {
            text: "Check when autovacuum last ran on your table, and find the current scale factor setting.",
            code:
`SELECT relname, last_analyze, last_autoanalyze, n_live_tup, n_dead_tup
FROM pg_stat_user_tables
WHERE relname = 'transactions';

SHOW autovacuum_analyze_scale_factor;`,
            lang: "sql",
            note: "Default scale factor is 0.2 (20%). For a 500k-row table: autovacuum waits until 100k rows change before re-analyzing. For high-volume banking tables, set this to 0.01 or lower at the table level."
          },
          {
            text: "Enable pg_stat_statements and find your slowest queries — this is the production equivalent of EXPLAIN.",
            code:
`-- Enable the extension (run once as superuser)
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;

-- Find the top 5 slowest queries by total execution time
SELECT
  left(query, 80)          AS query_snippet,
  calls,
  round(mean_exec_time::numeric, 2) AS avg_ms,
  round(total_exec_time::numeric, 2) AS total_ms,
  rows
FROM pg_stat_statements
ORDER BY total_exec_time DESC
LIMIT 5;`,
            lang: "sql",
            note: "In production you cannot reproduce every slow query locally. pg_stat_statements tells you which queries are actually hurting across all real traffic — total_exec_time shows cumulative cost, mean_exec_time shows per-call cost. A query called 10 000 times averaging 5ms costs 50 seconds of DB time per minute."
          }
        ],
        hints: [
          { label: "Lowering the scale factor for active tables", body: "ALTER TABLE transactions SET (autovacuum_analyze_scale_factor = 0.01); — triggers analysis after 1% change (5 000 rows for a 500k table). Much more responsive than the default 20%." }
        ],
        solution: null
      },
      {
        num: 2, title: "HikariCP connection pool exhaustion",
        goal: "Pool exhaustion is one of the most common production incidents in Spring Boot banking apps. It looks like a database problem but is actually a configuration problem. Reproduce it, observe the error, then understand the right pool size.",
        setup: {
          desc: "Create the canonical banking-app you will reuse for all remaining weeks. Generate it from start.spring.io or use the snippet below. This is a one-time setup.",
          steps: [
            {
              text: "Generate a new Spring Boot project at start.spring.io with these dependencies: Spring Web, Spring Data JPA, PostgreSQL Driver, Spring Boot Actuator. Or add to pom.xml manually:",
              code:
`<dependencies>
  <dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-web</artifactId>
  </dependency>
  <dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-data-jpa</artifactId>
  </dependency>
  <dependency>
    <groupId>org.postgresql</groupId>
    <artifactId>postgresql</artifactId>
  </dependency>
  <dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-actuator</artifactId>
  </dependency>
</dependencies>`,
              lang: "yaml"
            },
            {
              text: "application.yml — configure Postgres connection and HikariCP with an intentionally tiny pool for this lab:",
              code:
`spring:
  datasource:
    url: jdbc:postgresql://localhost:5432/postgres
    username: postgres
    password: lab
    hikari:
      maximum-pool-size: 3
      connection-timeout: 3000
      pool-name: BankingPool
  jpa:
    show-sql: false
    hibernate:
      ddl-auto: none

management:
  endpoints:
    web:
      exposure:
        include: "*"

logging:
  level:
    com.zaxxer.hikari: DEBUG`,
              lang: "yaml"
            },
            {
              text: "Add a slow endpoint that holds a DB connection for 2 seconds:",
              code:
`@RestController
public class SlowController {
  @Autowired DataSource ds;

  @GetMapping("/slow")
  public String slow() throws Exception {
    try (var conn = ds.getConnection()) {
      conn.createStatement().execute("SELECT pg_sleep(2)");
      return "done";
    }
  }
}`,
              lang: "java"
            }
          ]
        },
        explore: [
          {
            text: "Start the app, then hit the /slow endpoint with 10 concurrent requests. Watch what happens after the 3rd request.",
            code:
`# Send 10 concurrent requests
ab -n 10 -c 10 http://localhost:8080/slow`,
            lang: "bash",
            note: "You should see 'HikariPool-1 - Connection is not available, request timed out after 3000ms' in the logs. The first 3 requests succeed. The other 7 wait 3 seconds then fail."
          },
          {
            text: "While the requests are in-flight, check HikariCP metrics via the actuator.",
            code:
`curl http://localhost:8080/actuator/metrics/hikaricp.connections.pending`,
            lang: "bash",
            note: "A non-zero 'pending' count means threads are actively waiting for a connection. In production, this metric alerting at > 1 is a good early warning before timeouts cascade."
          },
          {
            text: "Read the HikariCP pool sizing article (linked in References). Apply the formula: pool_size = (core_count × 2) + effective_spindle_count. For a 4-core server with SSD, what is the recommended pool size? Change maximum-pool-size to this value and re-run the load test."
          },
          {
            text: "Try setting maximum-pool-size to 50 and repeat the load test. Does throughput improve? Research why very large pools can actually harm performance at the Postgres side."
          }
        ],
        hints: [
          { label: "Why a small pool often beats a large one", body: "Each Postgres connection uses ~5–10 MB of server memory and a backend process. At 100 connections, Postgres spends significant time on connection management. More importantly: a 4-core CPU can only run 4 things at once. 50 threads competing for 4 cores thrash the scheduler — context switching overhead eats the gains. The HikariCP wiki phrase: 'you want a waiting queue, not a racing mob'. Read: https://github.com/brettwooldridge/HikariCP/wiki/About-Pool-Sizing" }
        ],
        solution: null
      },
      {
        num: 3, title: "The N+1 problem — the most common ORM bug",
        goal: "N+1 happens when code loads N entities then fires 1 extra query per entity to load a relation. Result: 101 queries instead of 1. Every JPA codebase has it. Learn to see it, measure it, and fix it.",
        setup: {
          desc: "Add Account and Transaction JPA entities to the banking-app from Lab 2. Then enable SQL logging.",
          steps: [
            {
              text: "Add Account entity (in the banking-app from Lab 2):",
              code:
`@Entity
@Table(name = "accounts")
public class Account {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    private String accountNo;
    private BigDecimal balance;

    @OneToMany(mappedBy = "account", fetch = FetchType.LAZY)
    private List<Transaction> transactions = new ArrayList<>();
    // getters/setters
}

@Entity
@Table(name = "transactions")
public class Transaction {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "account_id")
    private Account account;

    private BigDecimal amount;
    private String status;
    // getters/setters
}`,
              lang: "java"
            },
            {
              text: "Add repositories and enable SQL logging in application.yml:",
              code:
`// AccountRepository.java
public interface AccountRepository extends JpaRepository<Account, Long> {}

// TransactionRepository.java
public interface TransactionRepository extends JpaRepository<Transaction, Long> {}`,
              lang: "java"
            },
            {
              text: "Add to application.yml:",
              code:
`spring:
  jpa:
    show-sql: true
    properties:
      hibernate:
        format_sql: true
logging:
  level:
    org.hibernate.SQL: DEBUG`,
              lang: "yaml"
            }
          ]
        },
        explore: [
          {
            text: "Write a service that loads all accounts and for each one accesses its transactions. Run it and count the SQL queries in the log.",
            code:
`public List<AccountSummary> getSummaries() {
    return accountRepo.findAll().stream()
        .map(a -> new AccountSummary(
            a.getId(),
            a.getTransactions().size()
        ))
        .toList();
}`,
            lang: "java",
            note: "With 100 accounts: 1 query to load accounts + 100 queries to load each account's transactions = 101 queries. This is N+1. The number of queries grows with your data — invisible until scale."
          },
          {
            text: "Fix it with JOIN FETCH and compare the SQL log.",
            code:
`@Query("SELECT a FROM Account a LEFT JOIN FETCH a.transactions")
List<Account> findAllWithTransactions();`,
            lang: "java",
            note: "Now 1 query. Check the SQL log — you should see a single SELECT with a LEFT OUTER JOIN instead of 101 separate selects."
          },
          {
            text: "Understand fetch types. Change the @OneToMany annotation and observe how it changes query behaviour.",
            code:
`@OneToMany(mappedBy = "account", fetch = FetchType.LAZY)
private List<Transaction> transactions;
// LAZY = load only when accessed (default, causes N+1 in loops)
// EAGER = always load with parent (bad for large collections)
// Fix: use JOIN FETCH or @EntityGraph where you need the relation`,
            lang: "java"
          },
          {
            text: "Try @EntityGraph as a cleaner alternative to @Query JOIN FETCH. When would you choose one over the other?",
            code:
`@EntityGraph(attributePaths = {"transactions"})
List<Account> findAll();`,
            lang: "java",
            note: "@EntityGraph works with Spring Data method naming (no @Query needed). JOIN FETCH gives more control for complex conditions. Both generate a SQL JOIN — verify in the log."
          }
        ],
        hints: [
          { label: "Detecting N+1 in production", body: "In pg_stat_statements: look for a parameterised query (WHERE id = $1) with very high 'calls' count and low 'mean_exec_time'. A query called 10 000 times averaging 2ms = 20 seconds of DB time per minute. That signature — high calls, low per-call time, high total — is the N+1 fingerprint in production." }
        ],
        solution: null
      }
    ],
    refs: [
      { type: "Postgres docs", name: "Planner Statistics",
        goal: "N+1 happens when code fetches a list of N entities, then fires 1 extra query per entity to load a relation. The result: 101 queries instead of 1. You will find this in every JPA codebase. Learn to recognise it, measure it, and fix it.",
        setup: {
          desc: "Add this config to application.yml to make JPA log every SQL query it fires:",
          steps: [{
            code:
`spring:
  jpa:
    show-sql: true
    properties:
      hibernate:
        format_sql: true
logging:
  level:
    org.hibernate.SQL: DEBUG
    org.hibernate.orm.jdbc.bind: TRACE`,
            lang: "yaml"
          }]
        },
        explore: [
          {
            text: "Write a repository method and service that fetches all accounts and for each account loads its transactions. Run it and count how many SQL queries appear in the log.",
            code:
`// Repository
List<Account> findAll();

// Service (the N+1 trigger)
public List<AccountSummary> getSummaries() {
    return accountRepo.findAll().stream()
        .map(a -> new AccountSummary(
            a.getId(),
            a.getTransactions().size()  // triggers 1 query per account
        ))
        .toList();
}`,
            lang: "java",
            note: "If you have 100 accounts: 1 query to fetch all accounts + 100 queries to fetch each account's transactions = 101 queries. This is the N+1 problem. The number of queries grows linearly with your data."
          },
          {
            text: "Fix it with JOIN FETCH. Compare the SQL log before and after.",
            code:
`// In your repository — fetch transactions in the same query
@Query("SELECT a FROM Account a LEFT JOIN FETCH a.transactions")
List<Account> findAllWithTransactions();`,
            lang: "java",
            note: "Now 1 query fetches everything. The SQL log shows a single SELECT with a JOIN. Run EXPLAIN ANALYZE on this query in psql and compare the execution plan to the individual queries."
          },
          {
            text: "Understand the fetch type settings and when each applies.",
            code:
`// In your Account entity
@OneToMany(
    mappedBy = "account",
    fetch = FetchType.LAZY   // default for collections
)
private List<Transaction> transactions;

// LAZY = load only when accessed (causes N+1 if accessed in a loop)
// EAGER = always load with the parent (causes performance issues for large collections)
// Neither is always right — use JOIN FETCH or @EntityGraph when you need the relation`,
            lang: "java"
          },
          {
            text: "Use @EntityGraph as a cleaner alternative to @Query with JOIN FETCH. When would you prefer one over the other?",
            code:
`@EntityGraph(attributePaths = {"transactions"})
List<Account> findAll();`,
            lang: "java",
            note: "@EntityGraph works with Spring Data method names (no @Query needed). JOIN FETCH gives you more control in complex queries. Both generate a JOIN in the SQL — check the log to confirm."
          }
        ],
        hints: [
          { label: "Detecting N+1 without reading the log manually", body: "Add the p6spy or datasource-proxy dependency to your test classpath. It counts queries per request and can throw an exception if more than N queries fire. In production, pg_stat_statements will show the same parameterised query appearing thousands of times with tiny execution time each — that signature (high calls, low mean_exec_time, high total) is the N+1 fingerprint." }
        ],
        solution: null
      },
      {
        num: 3, title: "The N+1 problem — the most common ORM bug",
        goal: "N+1 happens when code loads N entities then fires 1 extra query per entity to load a relation. Result: 101 queries instead of 1. Every JPA codebase has it. Learn to see it, measure it, and fix it.",
        setup: {
          desc: "Add Account and Transaction JPA entities to the banking-app from Lab 2. Then enable SQL logging.",
          steps: [
            {
              text: "Add Account entity (in the banking-app from Lab 2):",
              code:
`@Entity
@Table(name = "accounts")
public class Account {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    private String accountNo;
    private BigDecimal balance;

    @OneToMany(mappedBy = "account", fetch = FetchType.LAZY)
    private List<Transaction> transactions = new ArrayList<>();
    // getters/setters
}

@Entity
@Table(name = "transactions")
public class Transaction {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "account_id")
    private Account account;

    private BigDecimal amount;
    private String status;
    // getters/setters
}`,
              lang: "java"
            },
            {
              text: "Add repositories and enable SQL logging in application.yml:",
              code:
`// AccountRepository.java
public interface AccountRepository extends JpaRepository<Account, Long> {}

// TransactionRepository.java
public interface TransactionRepository extends JpaRepository<Transaction, Long> {}`,
              lang: "java"
            },
            {
              text: "Add to application.yml:",
              code:
`spring:
  jpa:
    show-sql: true
    properties:
      hibernate:
        format_sql: true
logging:
  level:
    org.hibernate.SQL: DEBUG`,
              lang: "yaml"
            }
          ]
        },
        explore: [
          {
            text: "Write a service that loads all accounts and for each one accesses its transactions. Run it and count the SQL queries in the log.",
            code:
`public List<AccountSummary> getSummaries() {
    return accountRepo.findAll().stream()
        .map(a -> new AccountSummary(
            a.getId(),
            a.getTransactions().size()
        ))
        .toList();
}`,
            lang: "java",
            note: "With 100 accounts: 1 query to load accounts + 100 queries to load each account's transactions = 101 queries. This is N+1. The number of queries grows with your data — invisible until scale."
          },
          {
            text: "Fix it with JOIN FETCH and compare the SQL log.",
            code:
`@Query("SELECT a FROM Account a LEFT JOIN FETCH a.transactions")
List<Account> findAllWithTransactions();`,
            lang: "java",
            note: "Now 1 query. Check the SQL log — you should see a single SELECT with a LEFT OUTER JOIN instead of 101 separate selects."
          },
          {
            text: "Understand fetch types. Change the @OneToMany annotation and observe how it changes query behaviour.",
            code:
`@OneToMany(mappedBy = "account", fetch = FetchType.LAZY)
private List<Transaction> transactions;
// LAZY = load only when accessed (default, causes N+1 in loops)
// EAGER = always load with parent (bad for large collections)
// Fix: use JOIN FETCH or @EntityGraph where you need the relation`,
            lang: "java"
          },
          {
            text: "Try @EntityGraph as a cleaner alternative to @Query JOIN FETCH. When would you choose one over the other?",
            code:
`@EntityGraph(attributePaths = {"transactions"})
List<Account> findAll();`,
            lang: "java",
            note: "@EntityGraph works with Spring Data method naming (no @Query needed). JOIN FETCH gives more control for complex conditions. Both generate a SQL JOIN — verify in the log."
          }
        ],
        hints: [
          { label: "Detecting N+1 in production", body: "In pg_stat_statements: look for a parameterised query (WHERE id = $1) with very high 'calls' count and low 'mean_exec_time'. A query called 10 000 times averaging 2ms = 20 seconds of DB time per minute. That signature — high calls, low per-call time, high total — is the N+1 fingerprint in production." }
        ],
        solution: null
      }
    ],
    refs: [
      { type: "Postgres docs", name: "Planner Statistics", url: "https://www.postgresql.org/docs/current/planner-stats.html", desc: "How pg_stats works and how to increase statistics targets for better estimates." },
      { type: "HikariCP wiki", name: "About Pool Sizing", url: "https://github.com/brettwooldridge/HikariCP/wiki/About-Pool-Sizing", desc: "The definitive guide. Read before touching maximum-pool-size in production." },
      { type: "Baeldung", name: "Spring Data JPA and N+1", url: "https://www.baeldung.com/spring-hibernate-n1-problem", desc: "Detailed walkthrough of N+1 causes and all fix strategies in Spring." },
      { type: "Tool", name: "pgMustard", url: "https://www.pgmustard.com/docs/explain", desc: "Visual EXPLAIN plan analyser — paste your output for instant readable breakdown." }
    ],
    checklist: [
      "Demonstrated stale statistics causing wrong row estimates (estimate vs actual differ by 10×+)",
      "Fixed bad estimates by running ANALYZE — confirmed plan changed",
      "Can explain what autovacuum does and why table bloat accumulates without it",
      "Used pg_stat_statements to find the top slow queries by total time",
      "Reproduced HikariCP pool exhaustion and observed the exact timeout error",
      "Applied the pool sizing formula — can explain why a small pool often outperforms a large one"
    ]
  },

  // ── WEEK 4 ──────────────────────────────────────────────────
  {
    id: "db-w4", num: "Week 4", module: "db",
    title: "Locking, Deadlocks & Isolation Levels",
    subtitle: "The most critical database week — financial transactions depend on getting this exactly right",
    hours: 12, tagClasses: ["tag-db","tag-time"], tagLabels: ["DB Internals","~12 hours"],
    ddia: { chapter: "Chapter 7 — Transactions (all of it)", note: "This is the most important DDIA chapter for your role. Weak isolation levels, dirty reads, non-repeatable reads, write skew. The banking examples in this lab directly parallel Kleppmann's examples. Read all of Chapter 7 this week." },
    objectives: [
      "Reproduce a non-repeatable read anomaly under Read Committed isolation",
      "Confirm that Repeatable Read prevents the same anomaly",
      "Reliably produce a deadlock between two concurrent sessions",
      "Detect a deadlock using pg_locks and pg_stat_activity",
      "Fix a deadlock using consistent lock ordering",
      "Explain all four isolation levels and what anomalies each prevents"
    ],
    diagram: { type: "isolation", caption: "Isolation levels vs anomalies — what each level prevents" },
    labs: [
      {
        num: 1, title: "Demonstrate isolation level anomalies",
        goal: "Open two separate psql sessions (or two DBeaver tabs, each with their own connection). Follow the steps precisely — the ordering between sessions matters.",
        setup: {
          desc: "Make sure account id=1 has a known balance.",
          steps: [{
            code: "UPDATE accounts SET balance = 50000.00 WHERE id = 1;\nCOMMIT;",
            lang: "sql"
          }]
        },
        explore: [
          {
            text: "Session A — start a transaction and read the balance. Do NOT commit yet.",
            code:
`-- Session A
BEGIN;
SELECT balance FROM accounts WHERE id = 1;
-- Note the value: 50000.00`,
            lang: "sql"
          },
          {
            text: "Session B — update and commit while Session A's transaction is still open.",
            code:
`-- Session B
UPDATE accounts SET balance = 99999.99 WHERE id = 1;
COMMIT;`,
            lang: "sql"
          },
          {
            text: "Session A — read the same row again without closing the transaction. What value do you see?",
            code:
`-- Session A (still in the same BEGIN block)
SELECT balance FROM accounts WHERE id = 1;
ROLLBACK;`,
            lang: "sql",
            note: "Under READ COMMITTED (Postgres default): you see 99999.99 — the value changed within your transaction. This is a non-repeatable read. It's a risk in multi-step banking operations."
          },
          {
            text: "Repeat the experiment with REPEATABLE READ isolation. Start Session A with this instead:",
            code:
`-- Session A with higher isolation
BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ;
SELECT balance FROM accounts WHERE id = 1;
-- (Run Session B's UPDATE and COMMIT again)
SELECT balance FROM accounts WHERE id = 1;
ROLLBACK;`,
            lang: "sql",
            note: "Under REPEATABLE READ: the second read still returns 50000.00. Your transaction sees a consistent snapshot from when it started. This is correct behaviour for a multi-step balance check."
          },
          {
            text: "Research: what is a phantom read? Write a scenario using the transactions table where a phantom read could occur. Which isolation level prevents it?"
          }
        ],
        hints: [
          { label: "When to use REPEATABLE READ in practice", body: "Most HTTP request handlers are a single short transaction that reads data once — READ COMMITTED is fine. Use REPEATABLE READ explicitly when: (1) you read a value, do calculations, then write based on the result in one transaction, (2) you need to produce a consistent report across multiple queries. For critical financial operations: set the isolation level explicitly per transaction rather than changing the server default." }
        ],
        solution: null
      },
      {
        num: 2, title: "Reproduce, detect, and fix a deadlock",
        goal: "The most important lab in the database module. Deadlocks in banking payment flows are real and they happen in production. Follow these steps precisely — timing between sessions matters.",
        setup: {
          desc: "Give both accounts a known balance.",
          steps: [{
            code: "UPDATE accounts SET balance = 10000.00 WHERE id IN (1, 2);\nCOMMIT;",
            lang: "sql"
          }]
        },
        explore: [
          {
            text: "Session A — start a transfer from account 1 to account 2. Lock row 1, then PAUSE before locking row 2.",
            code:
`-- Session A
BEGIN;
UPDATE accounts SET balance = balance - 500 WHERE id = 1;
-- STOP HERE. Switch to Session B before continuing.`,
            lang: "sql"
          },
          {
            text: "Session B — start a competing transfer in the opposite direction. Lock row 2, then try to lock row 1.",
            code:
`-- Session B
BEGIN;
UPDATE accounts SET balance = balance - 300 WHERE id = 2;
UPDATE accounts SET balance = balance + 300 WHERE id = 1;
-- This UPDATE hangs — it's waiting for Session A's lock on row 1.`,
            lang: "sql"
          },
          {
            text: "Session A — now try to lock row 2. This creates the circular wait.",
            code:
`-- Session A (return here after Session B is waiting)
UPDATE accounts SET balance = balance + 500 WHERE id = 2;
-- Postgres detects the circular wait and kills one transaction.`,
            lang: "sql",
            note: "One session receives ERROR: deadlock detected. Look at the full error message — it shows which transactions were involved and which locks they held."
          },
          {
            text: "While a deadlock is pending (during step 3 before Postgres resolves it), inspect the lock state in a third session.",
            code:
`-- Session C (separate connection)
SELECT pid, wait_event_type, wait_event, state, left(query, 60) AS query
FROM pg_stat_activity
WHERE state != 'idle';

SELECT locktype, relation::regclass, mode, granted, pid
FROM pg_locks
WHERE NOT granted;`,
            lang: "sql"
          },
          {
            text: "Design the fix: implement consistent lock ordering. Rewrite the transfer so both sessions always lock the lower account_id first. Verify no deadlock occurs.",
            code:
`-- Fixed transfer — always lock lower id first
BEGIN;
SELECT id, balance
FROM accounts
WHERE id IN (1, 2)
ORDER BY id         -- consistent ordering prevents circular wait
FOR UPDATE;

UPDATE accounts SET balance = balance - 500 WHERE id = 1;
UPDATE accounts SET balance = balance + 500 WHERE id = 2;
COMMIT;`,
            lang: "sql",
            note: "Run two competing transfers concurrently. With consistent ordering, Session B waits for Session A rather than forming a cycle. No deadlock."
          }
        ],
        hints: [
          { label: "Handling deadlocks in Spring Boot", body: "Postgres throws error code 40P01 (deadlock_detected). Spring translates this to CannotAcquireLockException. You can add retry logic with @Retryable(value = CannotAcquireLockException.class, maxAttempts = 3). But the better fix is consistent lock ordering — then deadlocks never happen in the first place. Retry logic is a safety net, not a substitute for correct locking." }
        ],
        solution: null
      }
    ],
    refs: [
      { type: "Postgres docs", name: "Transaction Isolation", url: "https://www.postgresql.org/docs/current/transaction-iso.html", desc: "All four levels with Postgres-specific behaviour. Note: Read Uncommitted behaves as Read Committed in Postgres." },
      { type: "Postgres docs", name: "Explicit Locking", url: "https://www.postgresql.org/docs/current/explicit-locking.html", desc: "SELECT FOR UPDATE, FOR SHARE, NOWAIT, SKIP LOCKED. SKIP LOCKED is the key pattern for banking job queues." },
      { type: "DDIA", name: "Chapter 7 — Transactions", url: null, desc: "Write skew and serialization anomalies. The doctors-on-call example parallels banking balance checks directly." }
    ],
    checklist: [
      "Demonstrated non-repeatable read under READ COMMITTED with two live sessions",
      "Confirmed REPEATABLE READ prevents the same anomaly",
      "Reliably reproduced a deadlock and observed the error message",
      "Inspected the deadlock in pg_locks before Postgres resolved it",
      "Fixed the deadlock using consistent lock ordering — verified with concurrent test",
      "Can explain all four isolation levels and their anomalies from memory"
    ]
  }

  ] // end db.weeks
}
