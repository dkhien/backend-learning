// ================================================================
// MODULE 5 — NETWORKING
// ================================================================
export default {
  id: "net", title: "Networking Fundamentals", color: "#0c6652",
  tagClass: "tag-net", icon: "🌐",
  desc: "TCP/IP, TLS, and HTTP — what happens between a client request and your Spring Boot controller. Understanding this lets you diagnose latency and connection issues at the network level.",
  weeks: [
  {
    id: "net-w11", num: "Week 11", module: "net", optional: true,
    title: "OSI Layers & TCP/IP Debugging",
    subtitle: "Map all 7 layers to real tools — diagnose network problems at the right layer",
    hours: 11, tagClasses: ["tag-net","tag-time"],
    tagLabels: ["Networking","~11 hours"],
    ddia: {
      chapter: "Chapter 8 — The Trouble with Distributed Systems",
      note: "Read the 'Unreliable Networks' section before touching any tool this week. It explains why TCP's handshake, retransmission, and timeouts exist — reframing these tools from commands to memorise into responses to fundamental network unreliability."
    },
    objectives: [
      "Map all 7 OSI layers to real protocols, tools, and banking scenarios",
      "Use ping and traceroute/tracert to test Layer 3 (Network) reachability",
      "Use nc (netcat) to test raw Layer 4 (TCP) port connectivity",
      "Use ss/netstat to inspect active connections and their TCP states",
      "Use curl -w to measure DNS, TCP, and TLS costs separately",
      "Use openssl s_client to inspect TLS certificates and handshake",
      "Distinguish connection refused vs timeout — and know what each means for diagnosis"
    ],
    diagram: { type: "osi", caption: "OSI model — every layer, its tools, and its banking relevance" },
    labs: [
      {
        num: 1,
        title: "Layer 3 — ping and traceroute",
        goal: "Ping tests basic IP reachability. Traceroute reveals every router hop on the path. Together they answer: is the host reachable at all, and where is the connection breaking?",
        setup: {
          desc: "Make sure your Postgres container from the database weeks is running.",
          steps: [{ code: "docker start pg-lab", lang: "bash" }]
        },
        explore: [
          {
            text: "Run ping against localhost and an external host. Focus on three things in the output: the round-trip time (ms), packet loss percentage, and TTL value.",
            os_tabs: [
              { os: "Linux / macOS", lang: "bash", code:
`ping -c 5 localhost
ping -c 5 8.8.8.8` },
              { os: "Windows", lang: "bash", code:
`ping -n 5 localhost
ping -n 5 8.8.8.8` }
            ],
            note: "TTL starts at 64 (Linux) or 128 (Windows) and decrements by 1 at each router hop. Packet loss % — any non-zero value means the path is degraded. Round-trip consistency matters: high stddev means an unstable path, not just slow."
          },
          {
            text: "Run traceroute to see every router hop on the path to a destination. Look for the hop where latency suddenly jumps — that's the network segment adding delay.",
            os_tabs: [
              { os: "Linux", lang: "bash", code:
`traceroute 8.8.8.8
traceroute -T 8.8.8.8` },
              { os: "macOS", lang: "bash", code:
`traceroute 8.8.8.8
traceroute -I 8.8.8.8` },
              { os: "Windows", lang: "bash", code:
`tracert 8.8.8.8` }
            ],
            note: "* * * on a line means that router ignores probes — not necessarily a broken hop. The path continues. Look for large time jumps between consecutive hops, e.g. hop 5: 2 ms → hop 6: 180 ms. That delta is where latency is introduced. Linux -T uses TCP SYN probes that penetrate more firewalls. macOS -I uses ICMP like Windows tracert."
          },
          {
            text: "Explore: trace the route to your Postgres Docker container. How many hops? Now trace to an external hostname. In production, traceroute to an external payment gateway when you see connection timeouts — the hop where packets stop is what you report to the infrastructure team."
          }
        ],
        hints: [
          {
            label: "How traceroute works — TTL exploitation",
            body: "Traceroute sends packets with TTL=1 first. The first router decrements TTL to 0, drops the packet, and sends back ICMP 'Time Exceeded' — revealing hop 1. Then TTL=2 (hop 2 responds), TTL=3 (hop 3 responds), and so on. This is deliberate TTL exhaustion, not magic. It works even without any cooperation from the destination host."
          }
        ],
        solution: null
      },
      {
        num: 2,
        title: "Layer 4 — nc (netcat) for raw TCP testing",
        goal: "Netcat opens a raw TCP connection to any port without needing an application. This isolates network connectivity from application behaviour — critical for answering 'is this a network problem or an application problem?'",
        explore: [
          {
            text: "Test whether a TCP port is open. Three outcomes are possible: immediate success (port open), immediate refusal (nothing listening), or silence until timeout (firewall dropping packets). Run each command and observe which outcome you get.",
            os_tabs: [
              { os: "Linux / macOS", lang: "bash", code:
`nc -zv localhost 5432
nc -zv localhost 6379
nc -zv -w 3 localhost 8080` },
              { os: "Windows", lang: "bash", code:
`Test-NetConnection -ComputerName localhost -Port 5432
Test-NetConnection -ComputerName localhost -Port 6379` }
            ],
            note: "Flags: -z scan without sending data, -v verbose output, -w 3 wait max 3 seconds. Connection refused = something actively rejected (port closed, nothing listening). No response until timeout = firewall silently dropping the packet. These have completely different causes and different fixes."
          },
          {
            text: "Use nc as a simple echo server to verify end-to-end TCP connectivity between two terminals, without running any real service.",
            os_tabs: [
              { os: "Linux / macOS", lang: "bash", code:
`# Terminal 1 — start a listener
nc -l 8888

# Terminal 2 — connect
nc localhost 8888` },
              { os: "macOS (alternate)", lang: "bash", code:
`# Terminal 1
nc -l -p 8888

# Terminal 2
nc localhost 8888` },
              { os: "Windows", lang: "bash", code:
`# Terminal 1 (PowerShell)
$l = [Net.Sockets.TcpListener]::new(8888)
$l.Start()
$c = $l.AcceptTcpClient()
Write-Host "Client connected!"

# Terminal 2
Test-NetConnection -ComputerName localhost -Port 8888` }
            ],
            note: "Once both terminals are connected, type in Terminal 2 — the text appears in Terminal 1. This proves TCP works end-to-end. Useful pattern: use nc as a stand-in for your real service to confirm the network path is not the problem."
          },
          {
            text: "Inspect active connections on your machine. When HikariCP connects to Postgres, each pool connection appears here as ESTABLISHED. Find yours.",
            os_tabs: [
              { os: "Linux", lang: "bash", code:
`ss -tnp
ss -tnp | grep 5432
ss -tn | awk 'NR>1 {print $1}' | sort | uniq -c` },
              { os: "macOS", lang: "bash", code:
`netstat -an -p tcp | grep 5432
lsof -i :5432` },
              { os: "Windows", lang: "bash", code:
`netstat -ano | findstr :5432
Get-NetTCPConnection | Where-Object { $_.RemotePort -eq 5432 }` }
            ],
            note: "TCP states to understand: ESTABLISHED = active live connection. TIME_WAIT = recently closed, holding ~60 s for delayed packets (normal). CLOSE_WAIT = remote closed but your app has not acknowledged (possible resource leak). If you see many TIME_WAIT connections to Postgres alongside HikariCP timeout errors, that is a sign of connection pool misconfiguration."
          }
        ],
        hints: [
          {
            label: "Connection refused vs timeout — different causes, different fixes",
            body: "Connection refused arrives as an immediate RST packet. The host is reachable, but nothing is listening on that port. Fix: start the service, or check you have the right port number. Timeout means your SYN packet was dropped with no response at all — a firewall is silently discarding it. Fix: add a firewall rule, check security groups, verify VPN routing. In banking environments, a 30-second connect timeout on a service call is almost always a firewall rule, not a dead server."
          }
        ],
        solution: null
      },
      {
        num: 3,
        title: "Layers 6–7 — curl timing and TLS inspection",
        goal: "curl -w measures each connection phase separately: DNS lookup, TCP connect, TLS handshake, time to first byte. These numbers make the cost of new connections concrete and explain why HikariCP and HTTP keep-alive exist.",
        explore: [
          {
            text: "Measure each phase of an HTTPS connection using curl's write-out format. The numbers map directly to OSI layers. Run twice — DNS lookup drops to near zero on the second run due to local caching.",
            os_tabs: [
              { os: "Linux / macOS", lang: "bash", code:
`curl -s -o /dev/null \
  -w "DNS:   %{time_namelookup}s\n\
TCP:   %{time_connect}s\n\
TLS:   %{time_appconnect}s\n\
TTFB:  %{time_starttransfer}s\n\
Total: %{time_total}s\n\
HTTP:  %{http_code}\n" \
  https://httpbin.org/get` },
              { os: "Windows (cmd)", lang: "bash", code:
`curl -s -o NUL ^
  -w "DNS:   %%{time_namelookup}s\n" ^
  -w "TCP:   %%{time_connect}s\n" ^
  -w "TLS:   %%{time_appconnect}s\n" ^
  -w "Total: %%{time_total}s\n" ^
  https://httpbin.org/get` }
            ],
            note: "How to isolate each phase: pure TCP cost = time_connect minus time_namelookup. Pure TLS cost = time_appconnect minus time_connect. Server processing = time_starttransfer minus time_appconnect."
          },
          {
            text: "Compare TLS 1.2 vs TLS 1.3 handshakes. Run each and look for the Protocol line in the output. TLS 1.3 needs 1 round trip. TLS 1.2 needs 2.",
            os_tabs: [
              { os: "Linux / macOS", lang: "bash", code:
`openssl s_client -connect google.com:443 -tls1_3 2>&1 \
  | grep -E "Protocol|Cipher"

openssl s_client -connect google.com:443 -tls1_2 2>&1 \
  | grep -E "Protocol|Cipher"` },
              { os: "Windows (PowerShell)", lang: "bash", code:
`$req = [Net.HttpWebRequest]::Create("https://google.com")
$resp = $req.GetResponse()
$cert = $req.ServicePoint.Certificate
Write-Host "Subject: $($cert.Subject)"
Write-Host "Expires: $($cert.GetExpirationDateString())"` }
            ],
            note: "At 50 ms datacenter RTT: TLS 1.3 saves 50 ms per new connection compared to TLS 1.2. Multiplied across thousands of microservice calls per second this matters — and it reinforces why connection pooling (which skips the handshake entirely on reuse) is so valuable."
          },
          {
            text: "Inspect the TLS configuration of your local Postgres container. Does it have TLS enabled? What would an attacker on the same network see if it does not?",
            os_tabs: [
              { os: "Linux / macOS", lang: "bash", code:
`openssl s_client \
  -connect localhost:5432 \
  -starttls postgres 2>&1 \
  | head -20` },
              { os: "Windows (Git Bash / WSL)", lang: "bash", code:
`openssl s_client \
  -connect localhost:5432 \
  -starttls postgres 2>&1 \
  | head -20` }
            ]
          }
        ],
        hints: [
          {
            label: "Reading curl -w timing fields",
            body: "All values are cumulative from request start. time_namelookup = DNS only. time_connect = DNS + TCP. time_appconnect = DNS + TCP + TLS. time_starttransfer = all above + server processing. time_total = everything including download. To isolate each phase: subtract the previous field. Second run DNS drops to near zero — OS cached the result."
          }
        ],
        solution: null
      }
    ],
    refs: [
      { type: "Free book", name: "High Performance Browser Networking", url: "https://hpbn.co/", desc: "Chapters 2 (TCP) and 4 (TLS). Best engineer-facing explanations available. Free online." },
      { type: "Linux man", name: "ss(8)", url: "https://man7.org/linux/man-pages/man8/ss.8.html", desc: "Full reference for the ss command and output fields." },
      { type: "Cloudflare", name: "TLS 1.3 Explained", url: "https://blog.cloudflare.com/rfc-8446-aka-tls-1-3/", desc: "Deep dive with handshake diagrams. Explains round-trip reduction clearly." },
      { type: "DDIA", name: "Chapter 8 — Distributed Systems Trouble", url: null, desc: "Network unreliability and why TCP's reliability mechanisms exist." }
    ],
    checklist: [
      "Used ping and traceroute/tracert — interpreted TTL, hop latency, and * * * hops",
      "Distinguished connection refused from timeout using nc/Test-NetConnection",
      "Used nc as a listener to confirm end-to-end TCP connectivity",
      "Found Postgres connections in ss/netstat output as ESTABLISHED",
      "Measured DNS, TCP, and TLS costs separately with curl -w",
      "Compared TLS 1.2 vs 1.3 and identified the round-trip difference",
      "Read HPBN Chapters 2 and 4"
    ]
  },

  {
    id: "net-w12", num: "Week 12", module: "net", optional: true,
    title: "HTTP, DNS & Application-Layer Debugging",
    subtitle: "curl for HTTP, dig/nslookup for DNS, and fixing the JVM DNS cache in K8s",
    hours: 10, tagClasses: ["tag-net","tag-time"],
    tagLabels: ["Networking","~10 hours"],
    ddia: null,
    objectives: [
      "Use curl to send, inspect, and debug HTTP requests at Layer 7",
      "Compare HTTP/1.1 and HTTP/2 timing and understand multiplexing",
      "Trace a full DNS resolution hierarchy with dig/nslookup",
      "Find and fix the JVM DNS cache bug that causes stale routing after K8s rolling upgrades",
      "Understand what HTTP/3 and QUIC solve that HTTP/2 does not"
    ],
    diagram: { type: "http-evolution", caption: "HTTP evolution — eliminating head-of-line blocking at each generation" },
    labs: [
      {
        num: 1,
        title: "curl for HTTP debugging",
        goal: "curl is the most important tool for debugging HTTP. The -v flag shows you exactly what was sent and received — headers, status codes, protocol version — without touching any application code.",
        explore: [
          {
            text: "Run a verbose request and read every section of output. Find the TCP connection line, request headers, response status, and response headers as separate stages.",
            os_tabs: [
              { os: "All platforms", lang: "bash", code:
`curl -sv -o /dev/null https://httpbin.org/get 2>&1` }
            ],
            note: "In the output: lines starting with * are curl internal events (TCP connect, TLS). Lines starting with > are your request headers. Lines starting with < are the server's response headers. An empty line separates headers from the body."
          },
          {
            text: "Send a POST request with a JSON body — the same pattern your Spring Boot service uses when calling external payment APIs.",
            os_tabs: [
              { os: "Linux / macOS", lang: "bash", code:
`curl -X POST https://httpbin.org/post \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-token" \
  -d '{"accountId": 42, "amount": 1000.00}' \
  | python3 -m json.tool` },
              { os: "Windows (cmd)", lang: "bash", code:
`curl -X POST https://httpbin.org/post ^
  -H "Content-Type: application/json" ^
  -d "{\"accountId\": 42, \"amount\": 1000.00}"` },
              { os: "Windows (PowerShell)", lang: "bash", code:
`$body = @{ accountId = 42; amount = 1000.00 } | ConvertTo-Json
$params = @{
  Uri         = "https://httpbin.org/post"
  Method      = "POST"
  Body        = $body
  ContentType = "application/json"
}
Invoke-RestMethod @params` }
            ]
          },
          {
            text: "Compare HTTP/1.1 vs HTTP/2 for multiple sequential requests. Time both and then confirm which protocol version was negotiated.",
            os_tabs: [
              { os: "Linux / macOS", lang: "bash", code:
`time for i in 1 2 3 4 5; do
  curl -s --http1.1 -o /dev/null https://httpbin.org/get
done

time for i in 1 2 3 4 5; do
  curl -s --http2 -o /dev/null https://httpbin.org/get
done

curl -sv --http2 -o /dev/null https://httpbin.org/get 2>&1 | grep "HTTP/"` },
              { os: "Windows", lang: "bash", code:
`curl --http1.1 -sv -o NUL https://httpbin.org/get 2>&1 | findstr "HTTP"
curl --http2   -sv -o NUL https://httpbin.org/get 2>&1 | findstr "HTTP"` }
            ],
            note: "HTTP/2 multiplexes requests over one TCP connection — the handshake cost is paid once. HTTP/3 (QUIC, over UDP) goes further: a lost packet on one stream no longer blocks other streams."
          }
        ],
        hints: [
          {
            label: "Common curl flags reference",
            body: "-X METHOD — HTTP method. -H 'Key: Value' — add header. -d 'body' — request body string. -d @file.json — body from file. -u user:pass — basic auth. -k — skip TLS check (dev only). -L — follow redirects. -v — verbose headers. -s — silent. -o /dev/null — discard body. --http1.1 / --http2 — force protocol. -w 'format' — write-out timing."
          }
        ],
        solution: null
      },
      {
        num: 2,
        title: "DNS resolution and the JVM cache trap",
        goal: "dig traces the full DNS hierarchy from root servers to the authoritative answer. Understanding DNS matters for K8s debugging — particularly the JVM caching bug that causes stale routing after rolling upgrades.",
        explore: [
          {
            text: "Trace the full DNS resolution hierarchy. Each section in the output is one level of the hierarchy: root → TLD → authoritative nameserver → final answer.",
            os_tabs: [
              { os: "Linux / macOS", lang: "bash", code:
`dig +trace google.com
dig google.com A
dig @8.8.8.8 google.com A
dig google.com MX` },
              { os: "Windows", lang: "bash", code:
`nslookup google.com
nslookup -type=MX google.com
Resolve-DnsName google.com -Type A
Resolve-DnsName google.com -Server 8.8.8.8` }
            ],
            note: "The number before 'IN A' in dig output is TTL in seconds — how long resolvers cache this record. Low TTL = changes propagate fast but more queries. High TTL = slower propagation (problem during migrations and K8s deployments)."
          },
          {
            text: "Find the JVM DNS cache TTL. This determines how long your Spring Boot service caches an IP before re-resolving. Add this to a @PostConstruct or main() to log the current setting on startup.",
            code:
`System.out.println(
  "DNS TTL: " +
  java.security.Security.getProperty(
    "networkaddress.cache.ttl"
  )
);`,
            lang: "java",
            note: "null or -1 means the JVM caches DNS results forever. This is dangerous in K8s where pod IPs change on every deployment. Symptom: intermittent 'Connection refused' errors right after a rolling upgrade as requests go to the old dead pod IP."
          },
          {
            text: "Apply the DNS TTL fix. Add these flags to your JVM startup so the setting is applied before any DNS lookups happen.",
            os_tabs: [
              { os: "Linux / macOS / K8s", lang: "bash", code:
`# Add to JVM startup flags:
-Dnetworkaddress.cache.ttl=30
-Dnetworkaddress.cache.negative.ttl=5` },
              { os: "Windows (IntelliJ VM Options)", lang: "bash", code:
`-Dnetworkaddress.cache.ttl=30
-Dnetworkaddress.cache.negative.ttl=5` }
            ],
            note: "30 seconds is safe for K8s rolling upgrades — long enough to avoid hammering DNS, short enough to pick up new pod IPs within one probe cycle. The negative TTL (failed lookups) should be short so a temporary DNS hiccup does not get cached for too long."
          }
        ],
        hints: [
          {
            label: "JVM DNS cache default behaviour",
            body: "JDK reads networkaddress.cache.ttl from $JAVA_HOME/conf/security/java.security. Default is often -1 (cache forever) or implementation-defined. On newer JDKs it may be 30 seconds by default — check yours with the Security.getProperty call above. Alternative: use a service mesh like Istio which handles routing below the JVM — DNS caching becomes irrelevant because the mesh intercepts all TCP connections."
          }
        ],
        solution: null
      }
    ],
    refs: [
      { type: "Free book", name: "HPBN Chapter 12 — HTTP/2", url: "https://hpbn.co/http2/", desc: "Stream multiplexing, flow control, header compression. The definitive explanation." },
      { type: "Cloudflare", name: "How DNS Works", url: "https://www.cloudflare.com/learning/dns/what-is-dns/", desc: "Visual DNS resolution walkthrough, recursive resolvers, TTL." },
      { type: "Baeldung", name: "Java DNS Cache TTL", url: "https://www.baeldung.com/java-dns-cache-ttl", desc: "JVM DNS caching behaviour and K8s configuration." }
    ],
    checklist: [
      "Used curl -v to inspect full request and response headers",
      "Sent a POST with JSON body and confirmed server received it correctly",
      "Compared HTTP/1.1 vs HTTP/2 timing — explained the difference",
      "Traced DNS hierarchy with dig +trace or Resolve-DnsName",
      "Found JVM DNS cache TTL and understood the K8s stale routing risk",
      "Applied -Dnetworkaddress.cache.ttl=30 and verified the setting"
    ]
  }
]
}
