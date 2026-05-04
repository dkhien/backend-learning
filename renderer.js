// ── Helpers ──────────────────────────────────────────────────
function esc(s){ return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;') }

function tag(cls,label){ return `<span class="tag ${cls}">${label}</span>` }

function callout(type,title,body){
  return `<div class="callout ${type}"><div class="callout-title">${title}</div>${body}</div>`
}

// ── Code block — language sets the dark theme ──
function codeBlock(code, lang){
  const themeMap = {bash:'bash',shell:'bash',sh:'bash',sql:'sql',java:'java',kotlin:'java',yaml:'yaml',yml:'yaml',dockerfile:'dockerfile',output:'output'}
  const theme = themeMap[(lang||'').toLowerCase()] || 'default'
  const label = lang || 'code'
  if (!code) return ''
  return `<div class="code-wrap">
    <div class="code-header ${theme}">${esc(label.toUpperCase())}<button class="copy-btn" onclick="copyCode(this)">copy</button></div>
    <pre class="${theme}"><code>${esc(String(code).trim())}</code></pre>
  </div>`
}

// ── OS-aware tab block ──
function osTabs(id, tabs){
  // tabs = [{os:'Linux/macOS', lang:'bash', code:''}, {os:'Windows', lang:'bash', code:''}]
  const tabBtns = tabs.map((t,i)=>
    `<div class="os-tab${i===0?' active':''}" onclick="switchTab('${id}',${i})">${esc(t.os)}</div>`
  ).join('')
  const panels = tabs.map((t,i)=>
    `<div class="os-tab-panel${i===0?' active':''}" id="${id}-panel-${i}">${codeBlock(t.code, t.lang)}</div>`
  ).join('')
  return `<div class="os-tabs" id="${id}-tabs">${tabBtns}</div>${panels}`
}


// ── Setup block (boilerplate before lab exercises) ──
function setupBlock(setup) {
  if (!setup) return '';
  let html = `<div class="setup-block">
    <div class="setup-block-title">⚙ Setup — run this before starting the lab</div>`;
  if (setup.desc) html += `<p>${setup.desc}</p>`;
  if (setup.steps) {
    setup.steps.forEach(step => {
      if (step.text) html += `<p>${step.text}</p>`;
      if (step.code) html += codeBlock(step.code, step.lang || 'bash');
      if (step.os_tabs) html += osTabs('setup-' + Math.random().toString(36).slice(2,6), step.os_tabs);
    });
  }
  if (setup.code) html += codeBlock(setup.code, setup.lang || 'bash');
  html += '</div>';
  return html;
}

// ── Explore step — each item is {text, code?, lang?, os_tabs?} ──
function revealBlock(code, lang) {
  const id = 'rev-' + Math.random().toString(36).slice(2,8)
  return `<div class="reveal-wrap">
    <button class="reveal-toggle" onclick="toggleReveal(this,'${id}')">
      <span class="rev-icon">👁</span> Show code — write it yourself first
    </button>
    <div class="reveal-body" id="${id}">${codeBlock(code, lang)}</div>
  </div>`
}

function exploreItem(item, idx){
  if (!item || !item.text) return ''
  let inner = `<div class="explore-text">${item.text}</div>`
  if(item.code) {
    inner += item.reveal ? revealBlock(item.code, item.lang||'bash') : codeBlock(item.code, item.lang||'bash')
  }
  if(item.os_tabs) inner += osTabs(`ex-${Math.random().toString(36).slice(2,7)}`, item.os_tabs)
  if(item.note)   inner += `<p style="font-size:13px;color:var(--muted);margin-top:.5rem;font-style:italic">${item.note}</p>`
  return `<li class="explore-item">
    <div class="explore-num">${idx+1}</div>
    <div class="explore-content">${inner}</div>
  </li>`
}

function labHTML(lab, color){
  const explores = (lab.explore||[]).map((e,i)=> exploreItem(typeof e==='string'?{text:e}:e, i)).join('')
  const hints = (lab.hints||[]).map(h=>`
    <button class="hint-toggle" onclick="toggleHint(this)"><span class="arr">▶</span> ${esc(h.label)}</button>
    <div class="hint-body">${h.body}${h.code?codeBlock(h.code,h.lang||'bash'):''}</div>
  `).join('')
  const sol = lab.solution ? `
    <button class="solution-toggle" onclick="toggleSolution(this)">
      📦 Show complete solution — try it yourself first <span class="arr">▼</span>
    </button>
    <div class="solution-body">
      <p class="solution-note">Only look after a genuine attempt.</p>
      ${lab.solution.content ? codeBlock(lab.solution.content, lab.solution.lang||'bash') : ''}
    </div>` : ''

  return `<div class="lab">
    <div class="lab-header" style="background:${color}14;border-color:${color}30">
      <div class="lab-num" style="background:${color}">${lab.num}</div>
      <div class="lab-title">${esc(lab.title)}${lab.optional?'<span class="optional-badge" style="margin-left:8px;font-size:10px">Optional</span>':''}</div>
    </div>
    <div class="lab-body">
      ${lab.goal?`<div class="lab-goal">${esc(lab.goal)}</div>`:''}
      <div class="section-label">Lab steps</div>
      <ul class="explore-list">${explores}</ul>
      ${hints?`<div class="section-label">Hints</div>${hints}`:''}
      ${sol?`<div class="section-label">Solution</div>${sol}`:''}
    </div>
  </div>`
}

function refsHTML(refs){
  if(!refs||!refs.length) return ''
  return `<h3>References</h3><div class="refs">${refs.map(r=>`
    <div class="ref-card">
      <div class="ref-type">${esc(r.type)}</div>
      ${r.url?`<a class="ref-name" href="${esc(r.url)}" target="_blank">${esc(r.name)}</a>`:`<div class="ref-name">${esc(r.name)}</div>`}
      <div class="ref-desc">${esc(r.desc)}</div>
    </div>`).join('')}</div>`
}

function checklistHTML(id, items){
  return `<h3>Week checklist</h3><ul class="checklist">${items.map((item,i)=>`
    <li><input type="checkbox" id="${id}-c${i}"><label for="${id}-c${i}">${esc(item)}</label></li>
  `).join('')}</ul>`
}

// ── Diagrams ──────────────────────────────────────────────────
function diagramHTML(d){
  if(!d) return ''
  const inner = DIAGRAMS[d.type] ? DIAGRAMS[d.type]() : `<p>Diagram: ${d.type}</p>`
  return `<div class="diagram-wrap"><div class="diagram-title">${esc(d.caption)}</div>${inner}</div>`
}

const DIAGRAMS = {
  btree(){
    return `<div class="flow">
      <div class="flow-row"><div class="flow-node db" style="min-width:200px">Root page<small>sorted index pointers</small></div></div>
      <div class="flow-down">↓</div>
      <div class="flow-row">
        <div class="flow-node db">Branch [100–299]</div>
        <div class="flow-node db">Branch [300–499]</div>
        <div class="flow-node db">Branch [500–699]</div>
      </div>
      <div class="flow-down">↓</div>
      <div class="flow-row"><div class="flow-node" style="min-width:240px">Leaf page (sorted)<small>(101 → page 4/slot 2) &nbsp; (102 → page 4/slot 8) &nbsp; …</small></div></div>
      <div class="flow-down">↓ heap fetch</div>
      <div class="flow-row"><div class="flow-node good">Heap page — actual row data<small>id, account_id, amount, status …</small></div></div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:16px;width:100%">
        <div class="flow-node bad">Seq scan<small>Reads all 500 k rows → ~4 400 page reads</small></div>
        <div class="flow-node good">Index scan<small>Root → branch → leaf → heap → ~4 reads total</small></div>
      </div></div>`
  },
  partition(){
    return `<div class="flow-node db" style="margin:0 auto 14px;max-width:280px">transactions_part<small>Parent partitioned table (invisible to queries)</small></div>
      <div class="flow-row" style="gap:6px;flex-wrap:wrap">
        ${['2025-01','2025-02','2025-03'].map(m=>`<div class="flow-node" style="font-size:11.5px;min-width:0">transactions_part_${m}<small>skipped ✓</small></div>`).join('')}
        <div class="flow-node good" style="font-size:11.5px;min-width:0">transactions_part_2025-04<small>← query scans here only</small></div>
        <div class="flow-node" style="font-size:11.5px;min-width:0">2025-05 … 12<small>skipped ✓</small></div>
      </div>
      <div style="margin-top:14px;padding:10px 14px;background:var(--green-bg);border:1px solid var(--green-lt);border-radius:var(--radius);font-size:13px;color:var(--green)">
        <strong>WHERE created_at BETWEEN '2025-04-01' AND '2025-04-30'</strong><br>Planner reads partition bounds → prunes 11 partitions → zero reads on 11/12 months
      </div>`
  },
  hikari(){
    return `<div style="display:grid;grid-template-columns:1fr 1fr;gap:14px">
      <div>
        <div style="font-size:12px;font-weight:700;color:var(--muted);margin-bottom:8px">Pool (size = 5) — all in use</div>
        ${[1,2,3,4,5].map(i=>`<div class="flow-node good" style="margin-bottom:6px;font-size:12px">Connection ${i} — IN USE</div>`).join('')}
      </div>
      <div>
        <div style="font-size:12px;font-weight:700;color:var(--muted);margin-bottom:8px">Requests 6+ — waiting queue</div>
        ${[6,7,8,9,10].map(i=>`<div class="flow-node bad" style="margin-bottom:6px;font-size:12px">Thread ${i} — WAITING… (3 000 ms timeout)</div>`).join('')}
      </div>
    </div>
    <div style="margin-top:12px;padding:10px 14px;background:var(--red-bg);border:1px solid var(--red-lt);border-radius:var(--radius);font-size:12.5px;color:var(--red);font-family:monospace">
      HikariPool-1 — Connection is not available, request timed out after 3000ms
    </div>`
  },
  isolation(){
    return `<table class="compare-table">
      <thead><tr><th>Level</th><th>Dirty read</th><th>Non-repeatable</th><th>Phantom</th><th>Banking note</th></tr></thead>
      <tbody>
        <tr><td><strong>Read Uncommitted</strong></td><td class="bad">Possible</td><td class="bad">Possible</td><td class="bad">Possible</td><td>Never use in banking</td></tr>
        <tr><td><strong>Read Committed</strong> <em>(Postgres default)</em></td><td class="good">Prevented</td><td class="bad">Possible</td><td class="bad">Possible</td><td>OK for single-read operations</td></tr>
        <tr><td><strong>Repeatable Read</strong></td><td class="good">Prevented</td><td class="good">Prevented</td><td class="bad">Possible</td><td>Multi-step financial reads</td></tr>
        <tr><td><strong>Serializable</strong></td><td class="good">Prevented</td><td class="good">Prevented</td><td class="good">Prevented</td><td>Max safety — use for critical txns</td></tr>
      </tbody>
    </table>`
  },
  jvm(){
    return `<div class="mem-grid">
      <div class="mem-box" style="flex:2">
        <div class="mem-box-title" style="background:var(--blue-bg);color:var(--blue)">Heap — GC managed</div>
        <div class="mem-box-body">
          <div style="display:flex;gap:6px;flex-wrap:wrap">
            <div class="flow-node db" style="flex:1;min-width:0">Eden<small>New objects born here</small></div>
            <div class="flow-node" style="flex:1;min-width:0">S0 / S1<small>Survive minor GC</small></div>
            <div class="flow-node warn" style="flex:2;min-width:0">Old Gen<small>Long-lived objects. Full GC here = slow</small></div>
          </div>
        </div>
      </div>
      <div class="mem-box">
        <div class="mem-box-title">Off-heap (not GC managed)</div>
        <div class="mem-box-body">
          <div class="mem-row">Metaspace — class definitions</div>
          <div class="mem-row">Thread stacks — ~1 MB × N threads</div>
          <div class="mem-row">Direct buffers — Netty / NIO</div>
        </div>
      </div>
    </div>
    <div style="margin-top:10px;padding:9px 14px;background:var(--amber-bg);border:1px solid var(--amber-lt);border-radius:var(--radius);font-size:13px;color:var(--amber)">
      Object path: <code style="background:rgba(0,0,0,.08);border:none;color:inherit">new Object()</code> → Eden → [minor GC survives] → S0/S1 → [age ≥ threshold] → Old Gen → [Old Gen full] → Full GC pause → API latency spike
    </div>`
  },
  memleak(){
    return `<div style="display:grid;grid-template-columns:1fr 1fr;gap:14px">
      <div>
        <div style="font-size:12px;font-weight:700;color:var(--muted);margin-bottom:8px">Normal — heap stabilises after GC</div>
        <div style="height:90px;background:var(--bg3);border:1px solid var(--border);border-radius:var(--radius);display:flex;align-items:flex-end;overflow:hidden">
          <div style="height:40%;width:100%;background:var(--green-bg);border-top:2px solid var(--green);display:flex;align-items:center;justify-content:center;font-size:12px;color:var(--green);font-weight:600">Heap usage — flat line ✓</div>
        </div>
      </div>
      <div>
        <div style="font-size:12px;font-weight:700;color:var(--muted);margin-bottom:8px">Leaking — heap grows → OOMError</div>
        <div style="height:90px;background:var(--bg3);border:1px solid var(--border);border-radius:var(--radius);position:relative;overflow:hidden">
          <div style="position:absolute;bottom:0;left:0;right:0;height:100%;background:linear-gradient(135deg, var(--amber-bg) 0%, var(--red-bg) 100%);border-top:2px solid var(--red);clip-path:polygon(0 100%,100% 100%,100% 5%,0 60%)"></div>
          <div style="position:absolute;bottom:6px;right:8px;font-size:11.5px;color:var(--red);font-weight:700">→ OOMError</div>
        </div>
      </div>
    </div>`
  },
  'spring-lifecycle'(){
    return `<div class="flow">
      <div class="flow-row"><div class="flow-node">@SpringBootApplication starts</div></div>
      <div class="flow-down">↓</div>
      <div class="flow-row">
        <div class="flow-node db">Component scan<small>@Service @Repository @Controller</small></div>
        <div class="flow-arrow">+</div>
        <div class="flow-node db">@Configuration</div>
        <div class="flow-arrow">+</div>
        <div class="flow-node db">AutoConfiguration<small>@Conditional checks</small></div>
      </div>
      <div class="flow-down">↓ for each bean definition</div>
      <div class="flow-row">
        <div class="flow-node">1. Instantiate<small>constructor</small></div>
        <div class="flow-arrow">→</div>
        <div class="flow-node">2. Inject<small>@Autowired</small></div>
        <div class="flow-arrow">→</div>
        <div class="flow-node">3. @PostConstruct</div>
        <div class="flow-arrow">→</div>
        <div class="flow-node good">4. Ready</div>
      </div>
      <div class="flow-down">↓ on shutdown</div>
      <div class="flow-row"><div class="flow-node">@PreDestroy → garbage collected</div></div>
    </div>`
  },
  aop(){
    return `<div class="flow">
      <div class="flow-row"><div class="flow-node">External caller — calls paymentService.processPayment()</div></div>
      <div class="flow-down">↓</div>
      <div class="flow-row"><div class="flow-node db">CGLIB Proxy wraps the real bean<small>Intercepts the call → starts transaction</small></div></div>
      <div class="flow-down">↓ delegates to real object</div>
      <div class="flow-row"><div class="flow-node warn">Real PaymentService.processPayment()<small>"this" = the real bean, NOT the proxy</small></div></div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:14px;width:100%">
        <div>
          <div style="font-size:11.5px;font-weight:700;color:var(--red);margin-bottom:7px">❌ Self-invocation — broken</div>
          <div class="flow-node bad">this.validateAndNotify()<small>Calls real bean directly → proxy never intercepts → no transaction</small></div>
        </div>
        <div>
          <div style="font-size:11.5px;font-weight:700;color:var(--green);margin-bottom:7px">✓ External call — works</div>
          <div class="flow-node good">auditService.logAudit()<small>Goes through auditService's proxy → transaction applied</small></div>
        </div>
      </div>
    </div>`
  },
  'docker-layers'(){
    const layers = [
      {label:'Base JRE image — eclipse-temurin:21-jre-alpine',freq:'Never changes',cls:'good'},
      {label:'Maven dependencies (~100 MB)',freq:'Rarely — only when pom.xml changes',cls:'good'},
      {label:'spring-boot-loader',freq:'Never changes',cls:'good'},
      {label:'Snapshot dependencies',freq:'Occasionally',cls:''},
      {label:'Your application classes',freq:'Every build',cls:'bad'},
    ]
    return `<div style="display:flex;flex-direction:column;gap:4px;max-width:480px;margin:0 auto">
      ${layers.map(l=>`
        <div class="flow-node ${l.cls}" style="display:flex;justify-content:space-between;min-width:0;text-align:left;padding:8px 14px">
          <span style="font-size:12.5px">${l.label}</span>
          <span style="font-size:11px;opacity:.65;margin-left:12px;white-space:nowrap;font-style:italic">${l.freq}</span>
        </div>`).join('')}
    </div>
    <p style="margin-top:12px;font-size:13px;color:var(--muted);text-align:center">Change source code → only the last tiny layer rebuilds → 30 s build becomes 3 s</p>`
  },
  'k8s-probes'(){
    return `<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:14px">
      ${[
        {cls:'db',title:'Startup probe',fail:'Restart container',body:'Runs once at startup until first success, then hands off to liveness. Use for slow-starting Backbase services (give 5 min).'},
        {cls:'good',title:'Readiness probe',fail:'Remove from Service endpoints — NO restart',body:'Runs continuously. If DB is down, pod goes NotReady (no traffic), but K8s does not restart it.'},
        {cls:'warn',title:'Liveness probe',fail:'Restart container',body:'Runs continuously. Only check that the JVM is alive — not DB connectivity (see danger note below).'},
      ].map(p=>`
        <div class="flow-node ${p.cls}" style="flex-direction:column;align-items:flex-start;padding:12px 14px;text-align:left">
          <div style="font-weight:800;margin-bottom:6px">${p.title}</div>
          <div style="font-size:12px;opacity:.85;margin-bottom:8px;line-height:1.55">${p.body}</div>
          <div style="font-size:11px;font-weight:700">Failure → ${p.fail}</div>
        </div>`).join('')}
    </div>
    <div style="padding:10px 14px;background:var(--red-bg);border:1px solid var(--red-lt);border-radius:var(--radius);font-size:13px;color:var(--red)">
      <strong>⚠ Common mistake:</strong> liveness checks DB connectivity. DB goes down → liveness fails → K8s restarts all pods → none can connect → all restart again → cascading failure.
    </div>`
  },
  'tcp-tls'(){
    return `<div style="display:grid;grid-template-columns:1fr 1fr;gap:14px">
      <div>
        <div style="font-size:12px;font-weight:700;color:var(--muted);margin-bottom:8px">TCP 3-way handshake — adds 1 RTT</div>
        ${['Client → SYN','Server → SYN-ACK','Client → ACK  (connected)'].map(s=>`<div class="flow-node" style="margin-bottom:5px;font-size:12.5px">${s}</div>`).join('')}
        <div style="font-size:12px;color:var(--hint);margin-top:7px">50 ms datacenter RTT = 50 ms before any data flows</div>
      </div>
      <div>
        <div style="font-size:12px;font-weight:700;color:var(--muted);margin-bottom:8px">TLS 1.3 on top — 1 more RTT</div>
        ${['Client → ClientHello + key share','Server → ServerHello + Cert + Finished','Encrypted data flows'].map(s=>`<div class="flow-node" style="margin-bottom:5px;font-size:12.5px">${s}</div>`).join('')}
        <div style="font-size:12px;color:var(--hint);margin-top:7px">TLS 1.2 = 2 extra RTTs. Connection pool avoids ALL handshake cost on reuse.</div>
      </div>
    </div>`
  },
  'http-evolution'(){
    return `<div style="display:flex;flex-direction:column;gap:14px">
      <div>
        <div style="font-size:12px;font-weight:700;color:var(--muted);margin-bottom:7px">HTTP/1.1 — sequential, 6 parallel connections max</div>
        <div style="display:flex;gap:4px;flex-wrap:wrap">
          <div class="flow-node bad" style="flex:1;min-width:0;font-size:12px">Conn 1: [Req A ——— Res A]</div>
          <div class="flow-node" style="flex:1;min-width:0;font-size:12px">Conn 2: [Req B ——————— Res B]</div>
          <div class="flow-node" style="flex:1;min-width:0;font-size:12px">Conn 3: [Req C — Res C]</div>
        </div>
      </div>
      <div>
        <div style="font-size:12px;font-weight:700;color:var(--muted);margin-bottom:7px">HTTP/2 — multiplexed streams on 1 TCP connection</div>
        <div style="display:flex;flex-direction:column;gap:3px">
          ${['Stream 1: [Req A] ————————————— [Res A]','Stream 2:   [Req B] ———————————————————— [Res B]','Stream 3:       [Req C] — [Res C]'].map(s=>`<div class="flow-node good" style="text-align:left;font-size:12.5px;min-width:0">${s}</div>`).join('')}
        </div>
        <div style="font-size:12px;color:var(--amber);margin-top:5px;font-weight:600">Still: a lost TCP packet blocks ALL streams (TCP head-of-line blocking)</div>
      </div>
      <div>
        <div style="font-size:12px;font-weight:700;color:var(--muted);margin-bottom:7px">HTTP/3 — QUIC over UDP, per-stream loss recovery</div>
        <div style="padding:10px 14px;background:var(--green-bg);border:1px solid var(--green-lt);border-radius:var(--radius);font-size:13px;color:var(--green)">Lost packet on Stream 1 → only Stream 1 pauses. Streams 2 and 3 continue unaffected.</div>
      </div>
    </div>`
  },
  osi(){
    const layers = [
      {num:7,name:'Application',color:'#1558a2',protocols:'HTTP, HTTPS, DNS, SMTP, FTP',tools:'curl, wget, browser devtools, nslookup/dig',banking:'API calls, TLS-secured REST endpoints'},
      {num:6,name:'Presentation',color:'#2a6614',protocols:'TLS/SSL, encoding (UTF-8, JSON)',tools:'openssl s_client, Wireshark (TLS decode)',banking:'Encryption of JSON payloads, certificate validation'},
      {num:5,name:'Session',color:'#2a6614',protocols:'TCP sessions, WebSocket',tools:'ss, netstat (connection state)',banking:'Persistent banking API connections, session management'},
      {num:4,name:'Transport',color:'#7a4806',protocols:'TCP, UDP',tools:'netstat, ss, nc (netcat), tcpdump',banking:'HikariCP pool (TCP to DB), timeouts, retransmission'},
      {num:3,name:'Network',color:'#7a4806',protocols:'IP, ICMP, routing',tools:'ping, tracert/traceroute, ip route',banking:'Routing between datacentres, IP whitelisting for payment gateways'},
      {num:2,name:'Data Link',color:'#952020',protocols:'Ethernet, ARP, MAC addresses',tools:'arp -a, ip link',banking:'Switch-level isolation, VLAN segmentation'},
      {num:1,name:'Physical',color:'#952020',protocols:'Cables, Wi-Fi, signals',tools:'ethtool (Linux)',banking:'Rarely relevant — handled by infrastructure team'},
    ]
    return `<table class="osi-table">
      <thead><tr><th>Layer</th><th>Protocol / What travels here</th><th>Debug tools</th><th>Banking relevance</th></tr></thead>
      <tbody>${layers.map(l=>`
        <tr>
          <td><span class="osi-num" style="background:${l.color}">${l.num}</span> &nbsp;<strong>${l.name}</strong></td>
          <td style="font-size:12.5px">${l.protocols}</td>
          <td style="font-size:12.5px;font-family:monospace">${l.tools}</td>
          <td style="font-size:12.5px;color:var(--muted)">${l.banking}</td>
        </tr>`).join('')}
      </tbody>
    </table>`
  },
  cap(){
    return `<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
      <div class="flow-node db" style="flex-direction:column;align-items:flex-start;padding:16px;text-align:left">
        <div style="font-weight:800;font-size:14px;margin-bottom:8px">CP — Consistency + Partition Tolerance</div>
        <div style="font-size:13px;line-height:1.65;margin-bottom:10px">When a network split occurs: <strong>refuse the request</strong> rather than return potentially stale data.<br><br>Banking example: account balance query returns an error rather than a possibly wrong number.</div>
        <div style="font-size:12px;font-weight:700">Use for: account balances, transfers, transaction records</div>
      </div>
      <div class="flow-node good" style="flex-direction:column;align-items:flex-start;padding:16px;text-align:left">
        <div style="font-weight:800;font-size:14px;margin-bottom:8px">AP — Availability + Partition Tolerance</div>
        <div style="font-size:13px;line-height:1.65;margin-bottom:10px">When a network split occurs: <strong>return possibly stale data</strong> rather than fail the request.<br><br>Banking example: product catalogue serves cached data during a DB outage.</div>
        <div style="font-size:12px;font-weight:700">Use for: product listings, exchange rates, branch info</div>
      </div>
    </div>
    <div style="margin-top:10px;padding:10px 14px;background:var(--teal-bg);border:1px solid var(--teal-lt);border-radius:var(--radius);font-size:13px;color:var(--teal)">
      Networks always partition eventually — so CA (no partition tolerance) is not achievable in practice. The real design decision is: <strong>CP vs AP when partitions occur</strong>.
    </div>`
  }
}

// ── Sidebar ──
function buildSidebar(){
  const nav = document.getElementById('sidebar-nav')
  let html = ''
  PLAN.modules.forEach(mod=>{
    html += `<div class="sb-group">
      <div class="sb-group-label" style="color:${mod.color}">${mod.title}</div>`
    mod.weeks.forEach(w=>{
      html += `<a class="sb-item${w.optional?' sb-optional':''}" href="#${w.id}">
        <span class="sb-dot" style="background:${mod.color}${w.optional?';opacity:.55':''}"></span>${w.num} · ${w.title}${w.optional?' <span style="font-size:9px;opacity:.7">(opt)</span>':''}
      </a>`
    })
    html += '</div>'
  })
  nav.innerHTML = html
  // append theme switcher at bottom
  const sw = document.createElement('div')
  sw.className = 'theme-switcher'
  sw.innerHTML = `
    <div class="theme-label">Theme</div>
    <div class="theme-btns">
      <div class="theme-btn slate active" onclick="setTheme('slate',this)">Slate</div>
      <div class="theme-btn pink" onclick="setTheme('pink',this)" id="theme-btn-pink">✿ Pink</div>
      <div class="theme-btn dark" onclick="setTheme('dark',this)">Dark</div>
    </div>`
  document.querySelector('.sidebar').appendChild(sw)
}

// ── Main content ──
function buildContent(){
  const main = document.getElementById('main-content')
  let html = ''
  PLAN.modules.forEach(mod=>{
    mod.weeks.forEach(week=>{
      html += `<div class="section-wrapper" id="${week.id}">`
      // Week header
      html += `<div class="week-header">
        <div class="week-accent" style="background:${mod.color}"></div>
        <div class="week-meta">
          <div class="week-num">${week.num} · ${mod.title}</div>
          <div class="week-title">${esc(week.title)}</div>
          <div class="week-subtitle">${esc(week.subtitle)}</div>
          <div class="week-tags">${week.tagClasses.map((c,i)=>tag(c,week.tagLabels[i])).join('')}${week.optional?'<span class="optional-badge">⭐ Optional — do after rotation starts</span>':''}</div>
        </div>
      </div>`
      // Objectives
      html += `<h3>What you will learn</h3><ul>${week.objectives.map(o=>`<li>${o}</li>`).join('')}</ul>`
      // DDIA
      if(week.ddia) html += callout('ddia',`📖 DDIA — ${week.ddia.chapter}`,`<p>${week.ddia.note}</p>`)
      // Diagram
      if(week.diagram) html += diagramHTML(week.diagram)
      // Setup — week-level old format (label+code) only, new format is per-lab
      if(week.setup && week.setup.label){
        html += `<h3>${esc(week.setup.label)}</h3>`
        if(week.setup.note) html += `<p>${week.setup.note}</p>`
        if(week.setup.code) html += codeBlock(week.setup.code, week.setup.lang)
      }
      if(week.setup2 && week.setup2.label){
        html += `<h4>${esc(week.setup2.label)}</h4>`
        if(week.setup2.code) html += codeBlock(week.setup2.code, week.setup2.lang)
      }
      // Labs
      html += `<h3>Lab exercises</h3>`
      week.labs.forEach(lab=>{ html += labHTML(lab, mod.color) })
      // Refs + checklist
      html += refsHTML(week.refs)
      html += checklistHTML(week.id, week.checklist)
      html += '</div>'
    })
  })
  main.innerHTML = html

  // Mount interactive visualisations
  const vizMap = {
    'db-w1': 'btree',
    'db-w4': 'deadlock',
    'db-w3': 'n1',
    'java-w5': 'gc',
    'spring-w8': 'proxy',
    'net-w11': 'tcp',
    'infra-w10': 'oomkill',
  }
  // Weeks with multiple viz — mount directly
  const multiViz = {
    'infra-w10': ['hpa', 'deploy', 'expandcontract'],
    'infra-w10b': ['gitops'],
  }
  Object.entries(vizMap).forEach(([weekId, type]) => {
    const wrap = document.querySelector('#'+weekId+' .diagram-wrap')
    if (wrap && VIZ[type]) {
      const el = document.createElement('div')
      el.className = 'viz-container'
      wrap.appendChild(el)
      VIZ[type](el)
    }
  })
  // Mount additional viz for weeks with multiple visualisations
  Object.entries(multiViz).forEach(([weekId, types]) => {
    const week = document.getElementById(weekId)
    if (!week) return
    // Find the "Lab exercises" h3 — insert visuals before it
    const allH3 = week.querySelectorAll('h3')
    // Last h3 is "Lab exercises", second-to-last is "References" or similar
    // We want to insert AFTER objectives/ddia/setup, BEFORE labs
    // Find h3 whose text is "Lab exercises"
    let anchor = null
    allH3.forEach(h => { if (h.textContent.trim() === 'Lab exercises') anchor = h })
    types.forEach(type => {
      if (!VIZ[type]) return
      const el = document.createElement('div')
      el.className = 'viz-container'
      if (anchor) anchor.parentNode.insertBefore(el, anchor)
      else week.appendChild(el)
      VIZ[type](el)
    })
  })
}

// ── Overview ──
function buildOverview(){
  const el = document.getElementById('overview-content')
  const cards = PLAN.modules.map(m=>`
    <div class="module-card">
      <div class="module-card-top">
        <div class="module-icon" style="background:${m.color}18;color:${m.color}">${m.icon}</div>
        <h4>${m.title} · ${m.weeks.length} week${m.weeks.length>1?'s':''}</h4>
      </div>
      <p>${esc(m.desc)}</p>
      <div class="module-weeks">${m.weeks.map(w=>w.num+': '+w.title).join(' &middot; ')}</div>
    </div>`).join('')
  const qrefs = PLAN.quality_refs.map(r=>`
    <div class="q-ref"><div class="q-dot"></div>
      <span><strong>${esc(r.name)}</strong> — ${esc(r.note)}</span>
    </div>`).join('')
  el.innerHTML = `
    <h1>${esc(PLAN.meta.title)}</h1>
    <div class="week-tags" style="margin-bottom:1.5rem">
      <span class="tag tag-db">13 weeks</span>
      <span class="tag tag-java">Java / Spring Boot</span>
      <span class="tag tag-infra">Backbase · Banking</span>
    </div>
    <p>${esc(PLAN.meta.context)}</p>
    <h3>Modules</h3><div class="module-grid">${cards}</div>
    <h3>Plan validated against</h3>
    <p style="font-size:14px;color:var(--muted)">Curriculum and lab approach cross-referenced with these widely-respected resources:</p>
    <div class="quality-bar">${qrefs}</div>`
}

// ── Interactions ──
function toggleReveal(btn, id) {
  const body = document.getElementById(id)
  const open = body.classList.toggle('open')
  btn.querySelector('.rev-icon').textContent = open ? '🙈' : '👁'
  btn.querySelector('span:last-child') && (btn.lastChild.textContent = open ? ' Hide' : ' Show code — write it yourself first')
  if (open) btn.innerHTML = '<span class="rev-icon">🙈</span> Hide solution'
  else btn.innerHTML = '<span class="rev-icon">👁</span> Show code — write it yourself first'
}

function toggleHint(btn){
  const body = btn.nextElementSibling
  const open = body.classList.toggle('open')
  btn.classList.toggle('open', open)
  btn.querySelector('.arr').textContent = open ? '▼' : '▶'
}
function toggleSolution(btn){
  const body = btn.nextElementSibling
  const open = body.classList.toggle('open')
  btn.classList.toggle('open', open)
}
function switchTab(id, idx){
  document.querySelectorAll(`#${id}-tabs .os-tab`).forEach((t,i)=>t.classList.toggle('active',i===idx))
  document.querySelectorAll(`[id^="${id}-panel-"]`).forEach((p,i)=>p.classList.toggle('active',i===idx))
}
function copyCode(btn){
  const code = btn.closest('.code-wrap').querySelector('code')
  navigator.clipboard.writeText(code.textContent).then(()=>{
    btn.textContent='copied!'; setTimeout(()=>btn.textContent='copy',1800)
  })
  // Mount additional viz for weeks with multiple visualisations
  Object.entries(multiViz).forEach(([weekId, types]) => {
    const week = document.getElementById(weekId)
    if (!week) return
    // Find the "Lab exercises" h3 — insert visuals before it
    const allH3 = week.querySelectorAll('h3')
    // Last h3 is "Lab exercises", second-to-last is "References" or similar
    // We want to insert AFTER objectives/ddia/setup, BEFORE labs
    // Find h3 whose text is "Lab exercises"
    let anchor = null
    allH3.forEach(h => { if (h.textContent.trim() === 'Lab exercises') anchor = h })
    types.forEach(type => {
      if (!VIZ[type]) return
      const el = document.createElement('div')
      el.className = 'viz-container'
      if (anchor) anchor.parentNode.insertBefore(el, anchor)
      else week.appendChild(el)
      VIZ[type](el)
    })
  })
}

// ── Persist checkboxes ──
const saved = JSON.parse(localStorage.getItem('pe-v3')||'{}')
function initChecks(){
  document.querySelectorAll('.checklist input').forEach(cb=>{
    if(saved[cb.id]) cb.checked=true
    cb.addEventListener('change',()=>{ saved[cb.id]=cb.checked; localStorage.setItem('pe-v3',JSON.stringify(saved)); updateProgress() })
  })
  updateProgress()
}
function updateProgress(){
  const total=document.querySelectorAll('.checklist input').length
  const done=document.querySelectorAll('.checklist input:checked').length
  const el=document.getElementById('sb-progress')
  if(el) el.textContent=`${done}/${total} complete (${Math.round(done/total*100)}%)`
}

// ── Scroll spy ──
function initScrollSpy(){
  const items=document.querySelectorAll('.sb-item[href^="#"]')
  const io=new IntersectionObserver(entries=>{
    entries.forEach(e=>{
      if(e.isIntersecting) items.forEach(n=>n.classList.toggle('active',n.getAttribute('href')==='#'+e.target.id))
    })
  },{threshold:.12,rootMargin:'-70px 0px -65% 0px'})
  document.querySelectorAll('.section-wrapper[id]').forEach(s=>io.observe(s))
}

function bloomParticles(btn) {
  const rect = btn.getBoundingClientRect()
  const cx = rect.left + rect.width / 2
  const cy = rect.top + rect.height / 2
  const flowers = ['🌸']
  const count = 16
  const dur = 850

  for (let i = 0; i < count; i++) {
    const el = document.createElement('div')
    el.textContent = flowers[i % flowers.length]
    const size = 11 + Math.random() * 12
    const angle = (i / count) * 2 * Math.PI + (Math.random() - .5) * .8
    const dist  = 40 + Math.random() * 60
    const tx = Math.cos(angle) * dist
    const ty = Math.sin(angle) * dist - 15
    const rot = (Math.random() - .5) * 360
    const delay = Math.random() * 150

    Object.assign(el.style, {
      position: 'fixed',
      left: cx + 'px',
      top:  cy + 'px',
      fontSize: size + 'px',
      lineHeight: '1',
      pointerEvents: 'none',
      zIndex: '9999',
      userSelect: 'none',
      transform: 'translate(-50%,-50%) scale(0) rotate(0deg)',
      opacity: '1',
      transition: 'none',
      willChange: 'transform,opacity',
    })
    document.body.appendChild(el)

    // Force reflow then animate
    el.getBoundingClientRect()
    setTimeout(() => {
      el.style.transition = `transform ${dur}ms cubic-bezier(.2,.8,.3,1) ${delay}ms, opacity ${dur*0.6}ms ease ${delay + dur*0.35}ms`
      el.style.transform = `translate(calc(-50% + ${tx}px), calc(-50% + ${ty}px)) scale(1) rotate(${rot}deg)`
      el.style.opacity = '0'
    }, 10)

    setTimeout(() => el.remove(), dur + delay + 50)
  }
}

function setTheme(name, btn) {
  document.documentElement.setAttribute('data-theme', name === 'slate' ? '' : name)
  if (name === 'slate') document.documentElement.removeAttribute('data-theme')
  localStorage.setItem('pe-theme', name)
  document.querySelectorAll('.theme-btn').forEach(b => b.classList.remove('active'))
  if (btn) {
    btn.classList.add('active')
    if (name === 'pink') bloomParticles(btn)
  } else {
    const b = document.querySelector('.theme-btn.' + name)
    if (b) b.classList.add('active')
  }
}

document.addEventListener('DOMContentLoaded',()=>{
  buildOverview(); buildSidebar(); buildContent(); initChecks(); initScrollSpy()
  const savedTheme = localStorage.getItem('pe-theme') || 'slate'
  setTheme(savedTheme, null)
})
