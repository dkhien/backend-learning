// ================================================================
// MODULE 2 — JAVA PERFORMANCE
// ================================================================
export default {
  id: "java", title: "Java Performance", color: "#c87840",
  tagClass: "tag-java", icon: "☕",
  desc: "JVM internals, GC tuning, memory leak diagnosis, and thread pool mechanics. The skills to diagnose production performance incidents without guessing.",
  weeks: [

  {
    id: "java-w5", num: "Week 5", module: "java",
    title: "JVM Internals & GC Tuning",
    subtitle: "Understand how the JVM manages memory and how GC pauses become API latency spikes",
    hours: 11, tagClasses: ["tag-java","tag-time"], tagLabels: ["Java Performance","~11 hours"],
    ddia: null,
    objectives: [
      "Label all JVM heap regions from memory: Eden, Survivor 0/1, Old Gen, Metaspace",
      "Enable GC logging and read the output format accurately",
      "Explain G1GC region-based collection and pause target mechanics",
      "Compare G1GC vs ZGC pause times under identical load",
      "Tune -Xms, -Xmx, and MaxGCPauseMillis for a banking service profile"
    ],
    diagram: { type: "jvm", caption: "JVM heap regions and the object lifecycle" },
    labs: [
      {
        num: 1, title: "Enable GC logging and read what you see",
        goal: "Generate real GC events, then read and interpret the log line by line. No theory first — get data, then understand it.",
        setup: {
          desc: "Use the banking-app created in Week 3. Add the /gc-stress endpoint and set JVM flags in your IDE run configuration.",
          steps: [
            {
              text: "Add this endpoint to the banking-app (any @RestController class):",
              code:
`@GetMapping("/gc-stress")
public String gcStress() throws InterruptedException {
    List<byte[]> list = new ArrayList<>();
    for (int i = 0; i < 5000; i++) {
        list.add(new byte[10_240]);
        if (i % 500 == 0) {
            list.clear();
            Thread.sleep(5);
        }
    }
    return "done";
}`,
              lang: "java"
            },
            {
              text: "Set these JVM flags in IntelliJ → Run → Edit Configurations → VM Options:",
              code:
`-Xms256m
-Xmx512m
-XX:+UseG1GC
-Xlog:gc*:file=/tmp/gc.log:time,uptime,level,tags
-XX:MaxGCPauseMillis=200`,
              lang: "bash"
            }
          ]
        },
        explore: [
          {
            text: "Call /gc-stress five times. Then open /tmp/gc.log and find a 'Pause Young (Normal)' event. Parse the format yourself before reading the hint.",
            note: "Look for lines containing 'Pause Young'. The format is: GC(N) event_type reason heap_before→heap_after(heap_max) pause_ms"
          },
          {
            text: "Upload your GC log to gceasy.io and find a Full GC event if one exists. What triggered it? How much longer did it pause compared to Young GC?",
            code: "open https://gceasy.io",
            lang: "bash",
            note: "Full GC pauses the entire JVM. If your API has a 200ms timeout and GC takes 300ms, every in-flight request fails. That is the direct connection between GC and API latency."
          },
          {
            text: "Answer in writing: if your banking service gets a 300ms Full GC pause and your downstream caller has a 500ms timeout, what is the user experience? How would you detect this in production logs?"
          },
          {
            text: "Try adding -XX:+DisableExplicitGC to your flags. Call System.gc() explicitly in your endpoint. Does it still trigger a Full GC? Why does this flag matter for third-party libraries?"
          }
        ],
        hints: [
          { label: "GC log format explained", body: "Format: [time][uptime][level][tags] GC(N) event reason heap_before→heap_after(heap_max) pause_ms. Example: GC(3) Pause Young (Normal) (G1 Evacuation Pause) 45M→12M(512M) 8.234ms — heap went from 45MB used to 12MB used, max heap is 512MB, pause was 8ms. 'Normal' = regular young GC. 'Concurrent Start' = G1 beginning a concurrent marking cycle because heap occupancy hit the threshold. Full GC triggers: Old Gen full, explicit System.gc() call, humongous allocation failure." }
        ],
        solution: null
      },
      {
        num: 2, title: "Compare G1GC vs ZGC under load",
        goal: "Run the same workload under both GC algorithms. Measure max pause time, average pause, and throughput. Make a justified recommendation for a banking API service.",
        setup: {
          desc: "Use Apache Bench to drive load while the app runs with each GC configuration.",
          steps: [{
            text: "Load test command (run while app is running):",
            code: "ab -n 200 -c 10 http://localhost:8080/gc-stress",
            lang: "bash"
          }]
        },
        explore: [
          {
            text: "Run the load test with G1GC. Note the max pause time from the GC log.",
            code:
`-Xmx512m -XX:+UseG1GC -XX:MaxGCPauseMillis=200
-Xlog:gc*:file=/tmp/gc-g1.log:time`,
            lang: "bash",
            note: "Record: max pause, average pause, number of Full GC events."
          },
          {
            text: "Restart with ZGC and run the same load test.",
            code:
`-Xmx512m -XX:+UseZGC
-Xlog:gc*:file=/tmp/gc-zgc.log:time`,
            lang: "bash",
            note: "Record the same metrics. ZGC pauses should be dramatically shorter."
          },
          {
            text: "Open both logs on gceasy.io side by side. Compare the pause time distributions. Which GC had more consistent pauses?"
          },
          {
            text: "Write a 3-sentence recommendation: for a Backbase banking API running on JDK 17 with 4 cores and 2GB heap, which GC would you choose and why?"
          }
        ],
        hints: [
          { label: "When to choose G1GC vs ZGC", body: "G1GC: default since JDK 9, good throughput, pause targets configurable, heap < 4GB, JDK 11+. ZGC: concurrent collection — most work happens while your app runs, pauses are typically < 1ms regardless of heap size, slight throughput reduction. For Backbase API services where p99 response time matters: ZGC on JDK 17+ is usually better. For batch processing jobs where total throughput matters more than individual request latency: G1GC is fine." }
        ],
        solution: null
      }
    ],
    refs: [
      { type: "Oracle docs", name: "GC Tuning Guide (JDK 21)", url: "https://docs.oracle.com/en/java/javase/21/gctuning/introduction-garbage-collection-tuning.html", desc: "Official guide. Read the G1GC and ZGC chapters." },
      { type: "Tool", name: "GCeasy.io", url: "https://gceasy.io", desc: "Visual GC log analyser. Free tier is sufficient for this lab." },
      { type: "Book", name: "Java Performance (Scott Oaks)", url: "https://www.oreilly.com/library/view/java-performance-2nd/9781492056454/", desc: "Chapters 5–6 cover JVM/GC tuning with the same methodology as this week." }
    ],
    checklist: [
      "Produced a real GC log with Young GC events using the stress endpoint",
      "Can parse the 'before→after(heap) pauseMs' format without looking it up",
      "Identified what triggers Full GC events — and how to prevent them",
      "Ran identical load with G1GC and ZGC — compared max pause times",
      "Can recommend G1GC vs ZGC for a banking API with clear reasoning"
    ]
  },

  {
    id: "java-w6", num: "Week 6", module: "java",
    title: "Memory Leaks, Heap Dumps & Thread Pools",
    subtitle: "Find production leaks and diagnose thread pool exhaustion from a thread dump",
    hours: 11, tagClasses: ["tag-java","tag-time"], tagLabels: ["Java Performance","~11 hours"],
    ddia: null,
    objectives: [
      "Build an intentional memory leak and confirm heap growth with jstat",
      "Take a heap dump with jmap and find the leaking object in Eclipse MAT",
      "Take a thread dump with jstack and identify thread states",
      "Recognise what HikariCP pool exhaustion looks like in a thread dump",
      "Name four common memory leak patterns in Spring Boot"
    ],
    diagram: { type: "memleak", caption: "Normal vs leaking heap — what jstat shows over time" },
    labs: [
      {
        num: 1, title: "Build a leak, observe it, find it",
        goal: "Write an endpoint with an intentional memory leak. Load test it. Watch the heap climb. Take a heap dump. Find the leaking object in Eclipse MAT.",
        setup: {
          desc: "Use the banking-app from Week 3. Add a leaking endpoint and set JVM flags to capture the heap dump automatically.",
          steps: [
            {
              text: "Set these JVM flags (IntelliJ → Run → Edit Configurations → VM Options):",
              code:
`-Xmx256m
-XX:+HeapDumpOnOutOfMemoryError
-XX:HeapDumpPath=/tmp/
-Xlog:gc*::time`,
              lang: "bash"
            }
          ]
        },
        explore: [
          {
            text: "Design the leaking endpoint yourself before looking at the hint. Think: what Java data structure, if held in a static field and added to on every request, would grow forever? Write it, verify it compiles, then continue."
          },
          {
            text: "In Terminal 1, start the load test.",
            code:
`# ab = Apache Bench  |  -n = total requests  |  -c = concurrent users
ab -n 5000 -c 10 http://localhost:8080/your-endpoint`,
            lang: "bash",
            note: "Install ab: sudo apt install apache2-utils (Linux) or brew install httpd (macOS)."
          },
          {
            text: "In Terminal 2, find your app PID and watch Old Gen usage in real time.",
            code:
`# jps = Java Process Status  |  -l = show full class or jar name
jps -l

# jstat -gcutil: GC stats polled every 2000ms (2 sec)
# S0/S1=Survivor%  E=Eden%  O=OldGen%  M=Metaspace%  YGC/FGC=GC counts
jstat -gcutil YOUR_PID 2000`,
            lang: "bash",
            note: "Watch the O column climb toward 100%. At 100% the app OOMErrors and writes a heap dump to /tmp/"
          },
          {
            text: "Take a manual heap dump before OOM occurs, then open it in Eclipse MAT.",
            code:
`# Take heap dump manually (find PID from jps first)
# format=b = binary (required by MAT)  |  file = output path
jmap -dump:format=b,file=/tmp/manual.hprof YOUR_PID

# Then in Eclipse MAT:
# File → Open Heap Dump → /tmp/manual.hprof
# Run: File → Leak Suspects Report`,
            lang: "bash",
            note: "In the Leak Suspects report: find the object retaining the most heap. Click through the 'Shortest paths to accumulation point' to see the reference chain. You should find your static field holding the growing collection."
          },
          {
            text: "Fix the leak. Then list two other common Java memory leak patterns from your reading — one involving ThreadLocal and one involving event listeners."
          }
        ],
        hints: [
          { label: "Simple intentional leak", body: "private static final Map<String, byte[]> cache = new HashMap<>(); — on every request add: cache.put(UUID.randomUUID().toString(), new byte[50_000]); — 50KB per request, never cleared. jstat O% climbs at a rate proportional to your request rate. In MAT's dominator tree: YourController → static HashMap → all byte arrays." },
          { label: "Four common Spring Boot leak patterns", body: "1) Static collections grown without bounds (this lab). 2) ThreadLocal values added in a filter but never removed — accumulate in Tomcat's thread pool threads permanently. 3) @EventListener methods that register a listener without a corresponding @EventListener for removal, causing the listener to be GC-rooted indefinitely. 4) Classloader leaks during hot redeploy — Metaspace grows each redeploy, not heap, requiring a full restart." }
        ],
        solution: null
      },
      {
        num: 2, title: "Thread dump analysis",
        goal: "Thread dumps reveal every thread's state at an instant in time. Learn to read them to diagnose stuck threads, pool exhaustion, and HikariCP wait patterns.",
        setup: {
          desc: "Add a slow endpoint that holds a thread for 30 seconds.",
          steps: [{
            code:
`@GetMapping("/hold")
public String hold() throws InterruptedException {
    Thread.sleep(30_000);
    return "released";
}`,
            lang: "java"
          }]
        },
        explore: [
          {
            text: "Hit /hold with 10 concurrent requests, then take a thread dump while they're running.",
            code:
`# Fire 10 concurrent requests (in background)
ab -n 10 -c 10 http://localhost:8080/hold &

# Find your app PID
jps -l

# Take a thread dump
# jstack: captures all JVM thread states at this instant
jstack YOUR_PID > /tmp/threaddump.txt`,
            lang: "bash"
          },
          {
            text: "Open the thread dump and find the sleeping threads. What state are they in? What does the stack trace show?",
            code:
`# Count threads by state
grep 'java.lang.Thread.State' /tmp/threaddump.txt | sort | uniq -c`,
            lang: "bash",
            note: "TIMED_WAITING threads are sleeping (Thread.sleep). Their stack traces show Thread.sleep at the top. WAITING threads are waiting indefinitely. BLOCKED threads are trying to acquire a monitor lock."
          },
          {
            text: "Paste the thread dump into fastthread.io and read the 'Thread State' pie chart.",
            code: "open https://fastthread.io",
            lang: "bash",
            note: "A pie chart dominated by BLOCKED threads means heavy lock contention. WAITING threads waiting on HikariCP is the signature of pool exhaustion."
          },
          {
            text: "Now simulate HikariCP exhaustion: set pool size = 3, write an endpoint that holds a connection for 5 seconds, hit it with 10 requests. Take another thread dump and find the threads waiting for a connection — what does their stack trace show?"
          }
        ],
        hints: [
          { label: "HikariCP exhaustion signature in thread dump", body: "Threads waiting for a DB connection from HikariCP appear as TIMED_WAITING with this stack pattern near the top: java.util.concurrent.locks.LockSupport.parkNanos → com.zaxxer.hikari.util.ConcurrentBag.borrow → com.zaxxer.hikari.pool.HikariPool.getConnection → com.zaxxer.hikari.HikariDataSource.getConnection. If you see many threads with this pattern, your pool is exhausted. Check maximum-pool-size and connection-timeout in your HikariCP config." }
        ],
        solution: null
      }
    ],
    refs: [
      { type: "Tool", name: "Eclipse Memory Analyser (MAT)", url: "https://www.eclipse.org/mat/downloads.php", desc: "Industry-standard heap dump analyser. 'Leak Suspects' report finds the problem automatically." },
      { type: "Tool", name: "FastThread.io", url: "https://fastthread.io", desc: "Visual thread dump analyser. Identifies deadlocks and blocked threads automatically." },
      { type: "Baeldung", name: "Java Memory Leak Guide", url: "https://www.baeldung.com/java-memory-leaks", desc: "All common patterns: static collections, ThreadLocal, event listeners, classloader leaks." }
    ],
    checklist: [
      "Built an intentional leak and confirmed heap growth with jstat O% column",
      "Took a heap dump and opened it in Eclipse MAT",
      "Found the leaking object via the Leak Suspects report and dominator tree",
      "Took a thread dump during load and identified sleeping threads by state",
      "Simulated HikariCP exhaustion and found the waiting pattern in the thread dump"
    ]
  }

  ] // end java.weeks
}
