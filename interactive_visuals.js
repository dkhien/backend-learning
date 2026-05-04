// ================================================================
// INTERACTIVE VISUALISATIONS
// Call renderViz(containerId, type) after DOM is built
// ================================================================

const VIZ = {

  // ── B-tree traversal ─────────────────────────────────────────
  btree(el) {
    el.innerHTML = `
      <div class="viz-btree">
        <div class="viz-title">Click any value to watch the B-tree traversal</div>
        <div class="viz-search-row">
          <span class="viz-label">Search for:</span>
          ${[42, 155, 302, 487, 601].map(v =>
            `<button class="viz-val-btn" onclick="btreeSearch(${v},this)">${v}</button>`
          ).join('')}
        </div>
        <div id="btree-svg-wrap"></div>
        <div id="btree-log" class="viz-log"></div>
      </div>`

    const nodes = {
      root: { label: 'Root', range: [1,700], children: ['b1','b2','b3'], x:300, y:20 },
      b1: { label: '1–200', range: [1,200], children: ['l1','l2'], x:100, y:110 },
      b2: { label: '201–450', range: [201,450], children: ['l3','l4'], x:300, y:110 },
      b3: { label: '451–700', range: [451,700], children: ['l5','l6'], x:500, y:110 },
      l1: { label: '1–100', range: [1,100], children: [], x:40, y:200 },
      l2: { label: '101–200', range: [101,200], children: [], x:140, y:200 },
      l3: { label: '201–325', range: [201,325], children: [], x:240, y:200 },
      l4: { label: '326–450', range: [326,450], children: [], x:340, y:200 },
      l5: { label: '451–570', range: [451,570], children: [], x:440, y:200 },
      l6: { label: '571–700', range: [571,700], children: [], x:540, y:200 },
    }
    window._btreeNodes = nodes

    let svg = `<svg viewBox="0 0 640 280" style="width:100%;font-family:inherit">`
    // Draw edges
    for (const [id, n] of Object.entries(nodes)) {
      for (const c of n.children) {
        const cn = nodes[c]
        svg += `<line x1="${n.x+40}" y1="${n.y+22}" x2="${cn.x+40}" y2="${cn.y}" stroke="var(--border2)" stroke-width="1.5"/>`
      }
    }
    // Draw nodes
    for (const [id, n] of Object.entries(nodes)) {
      const isLeaf = n.children.length === 0
      svg += `<g id="bn-${id}">
        <rect x="${n.x}" y="${n.y}" width="80" height="22" rx="5"
          fill="${isLeaf ? 'var(--green-bg)' : 'var(--blue-bg)'}"
          stroke="${isLeaf ? 'var(--green-lt)' : 'var(--blue-lt)'}" stroke-width="1.5"/>
        <text x="${n.x+40}" y="${n.y+15}" text-anchor="middle"
          font-size="10" fill="${isLeaf ? 'var(--green)' : 'var(--blue)'}" font-weight="600">${n.label}</text>
      </g>`
    }
    // Heap at bottom
    svg += `<g id="bn-heap">
      <rect x="240" y="260" width="120" height="22" rx="5" fill="var(--amber-bg)" stroke="var(--amber-lt)" stroke-width="1.5"/>
      <text x="300" y="275" text-anchor="middle" font-size="10" fill="var(--amber)" font-weight="600">Heap page</text>
    </g>`
    svg += '</svg>'
    document.getElementById('btree-svg-wrap').innerHTML = svg

    window.btreeSearch = function(val, btn) {
      document.querySelectorAll('.viz-val-btn').forEach(b=>b.classList.remove('active'))
      btn.classList.add('active')
      const log = document.getElementById('btree-log')
      const nodes = window._btreeNodes
      // Reset all nodes
      Object.keys(nodes).forEach(id => {
        const el = document.getElementById('bn-'+id)
        if (el) el.style.opacity = '0.3'
      })
      document.getElementById('bn-heap').style.opacity = '0.3'

      const steps = []
      // Find path
      steps.push({id:'root', msg:`Root page: is ${val} in range [1–700]? Yes → check children`})
      let branch = val <= 200 ? 'b1' : val <= 450 ? 'b2' : 'b3'
      steps.push({id:branch, msg:`Branch page ${nodes[branch].label}: is ${val} in this range? Yes → go to leaf`})
      let leaf = Object.entries(nodes).find(([id,n])=> id.startsWith('l') && val >= n.range[0] && val <= n.range[1])
      if (leaf) steps.push({id:leaf[0], msg:`Leaf page ${leaf[1].label}: found pointer to heap page`})
      steps.push({id:'heap', msg:`Heap fetch: read actual row data from disk`})
      steps.push({id:null, msg:`✓ Done in ${steps.length-1} page reads. Seq scan would read ALL ~4400 pages.`})

      let i = 0
      log.innerHTML = ''
      function step() {
        if (i >= steps.length) return
        const s = steps[i++]
        if (s.id) {
          const el = document.getElementById('bn-'+s.id)
          if (el) {
            el.style.opacity = '1'
            el.style.transition = 'opacity 0.3s'
            el.querySelector('rect').style.filter = 'brightness(1.15)'
          }
        }
        const line = document.createElement('div')
        line.className = 'viz-log-line' + (i === steps.length ? ' viz-log-done' : '')
        line.textContent = `Step ${i}: ${s.msg}`
        log.appendChild(line)
        if (i < steps.length) setTimeout(step, 700)
      }
      setTimeout(step, 100)
    }
  },

  // ── GC heap animation ─────────────────────────────────────────
  gc(el) {
    el.innerHTML = `
      <div class="viz-gc">
        <div class="viz-title">Watch how the JVM heap fills and gets collected</div>
        <div class="viz-gc-controls">
          <button class="viz-btn" onclick="gcAllocate()">Allocate objects</button>
          <button class="viz-btn" onclick="gcMinor()">Minor GC</button>
          <button class="viz-btn" onclick="gcFull()">Full GC</button>
          <button class="viz-btn viz-btn-reset" onclick="gcReset()">Reset</button>
        </div>
        <div class="viz-gc-grid">
          <div class="viz-heap-region">
            <div class="viz-region-label">Eden (Young Gen)</div>
            <div class="viz-region-bar" id="gc-eden"><div class="viz-fill" id="gc-eden-fill" style="background:var(--blue)"></div></div>
            <div class="viz-region-pct" id="gc-eden-pct">0%</div>
          </div>
          <div class="viz-heap-region">
            <div class="viz-region-label">Survivor (S0/S1)</div>
            <div class="viz-region-bar" id="gc-surv"><div class="viz-fill" id="gc-surv-fill" style="background:var(--teal)"></div></div>
            <div class="viz-region-pct" id="gc-surv-pct">0%</div>
          </div>
          <div class="viz-heap-region">
            <div class="viz-region-label">Old Gen</div>
            <div class="viz-region-bar" id="gc-old"><div class="viz-fill" id="gc-old-fill" style="background:var(--amber)"></div></div>
            <div class="viz-region-pct" id="gc-old-pct">0%</div>
          </div>
        </div>
        <div id="gc-log" class="viz-log"></div>
      </div>`

    let state = {eden:0, surv:0, old:0, age:0}
    window._gcState = state

    function setBar(id, pct, warn) {
      const fill = document.getElementById(id+'-fill')
      const label = document.getElementById(id+'-pct')
      fill.style.width = Math.min(100,pct)+'%'
      fill.style.background = pct > 85 ? 'var(--red)' : pct > 60 ? 'var(--amber)' : fill.style.background
      label.textContent = Math.round(pct)+'%'
    }
    function log(msg, cls='') {
      const l = document.getElementById('gc-log')
      const d = document.createElement('div')
      d.className = 'viz-log-line ' + cls
      d.textContent = msg
      l.appendChild(d)
      l.scrollTop = l.scrollHeight
    }
    function refresh() {
      setBar('gc-eden', state.eden)
      setBar('gc-surv', state.surv)
      setBar('gc-old', state.old)
    }

    window.gcAllocate = () => {
      state.eden = Math.min(100, state.eden + 20)
      refresh()
      log(`→ Allocated objects: Eden now ${Math.round(state.eden)}%`)
      if (state.eden >= 100) log('⚠ Eden full! Minor GC needed.', 'viz-log-warn')
    }
    window.gcMinor = () => {
      if (state.eden < 20) { log('Eden mostly empty, nothing to collect.'); return }
      const survived = state.eden * 0.15
      const garbage = state.eden - survived
      log(`Minor GC: ${Math.round(garbage)}% garbage collected, ${Math.round(survived)}% objects survived → Survivor`)
      state.eden = 0
      state.surv = Math.min(100, state.surv + survived)
      state.age++
      if (state.age >= 3 && state.surv > 10) {
        const promote = state.surv * 0.5
        state.old = Math.min(100, state.old + promote)
        state.surv -= promote
        log(`Objects aged ${state.age} GC cycles → promoted ${Math.round(promote)}% to Old Gen`, 'viz-log-done')
      }
      refresh()
      if (state.old > 85) log('⚠ Old Gen above 85%! Full GC will be triggered soon.', 'viz-log-warn')
    }
    window.gcFull = () => {
      log('Full GC: stop-the-world pause begins... ALL threads suspended', 'viz-log-warn')
      const freed = state.old * 0.6
      setTimeout(()=>{
        state.old -= freed
        state.surv = state.surv * 0.3
        state.eden = 0
        refresh()
        log(`Full GC complete: freed ${Math.round(freed)}% from Old Gen. Pause = hundreds of ms → API latency spike!`, 'viz-log-warn')
      }, 800)
    }
    window.gcReset = () => {
      state = {eden:0, surv:0, old:0, age:0}
      window._gcState = state
      refresh()
      document.getElementById('gc-log').innerHTML = ''
      log('Reset. Allocate objects to start.')
    }
    log('Click "Allocate objects" repeatedly, then trigger Minor GC when Eden fills.')
  },

  // ── Deadlock visualisation ────────────────────────────────────
  deadlock(el) {
    el.innerHTML = `
      <div class="viz-deadlock">
        <div class="viz-title">Watch two transactions deadlock — step by step</div>
        <div class="viz-dl-controls">
          <button class="viz-btn" id="dl-btn" onclick="dlStep()">▶ Next step</button>
          <button class="viz-btn viz-btn-reset" onclick="dlReset()">Reset</button>
        </div>
        <div class="viz-dl-grid" id="dl-grid"></div>
        <div id="dl-log" class="viz-log"></div>
      </div>`

    const steps = [
      { txA: 'BEGIN', txB: '', lockA: [], lockB: [], waitA: null, waitB: null,
        msg: 'Both transactions start. No locks held yet.' },
      { txA: 'UPDATE account 1\n(lock row 1 ✓)', txB: '', lockA: [1], lockB: [], waitA: null, waitB: null,
        msg: 'Tx A locks row 1. Proceeds normally.' },
      { txA: 'UPDATE account 1\n(lock row 1 ✓)', txB: 'BEGIN\nUPDATE account 2\n(lock row 2 ✓)', lockA: [1], lockB: [2], waitA: null, waitB: null,
        msg: 'Tx B locks row 2. Both hold one lock each.' },
      { txA: 'UPDATE account 1\n(lock row 1 ✓)', txB: 'BEGIN\nUPDATE account 2\n(lock row 2 ✓)\nUPDATE account 1\n⏳ waiting...', lockA: [1], lockB: [2], waitA: null, waitB: 1,
        msg: 'Tx B tries to lock row 1 — blocked by Tx A. Waiting...' },
      { txA: 'UPDATE account 1\n(lock row 1 ✓)\nUPDATE account 2\n⏳ waiting...', txB: 'BEGIN\nUPDATE account 2\n(lock row 2 ✓)\nUPDATE account 1\n⏳ waiting...', lockA: [1], lockB: [2], waitA: 2, waitB: 1,
        msg: 'Tx A tries to lock row 2 — blocked by Tx B. CIRCULAR WAIT = DEADLOCK!' },
      { txA: 'ROLLBACK ✗', txB: 'COMMIT ✓', lockA: [], lockB: [], waitA: null, waitB: null,
        msg: '🔴 Postgres detects deadlock. Rolls back Tx A. Tx B proceeds.' },
      { txA: 'FIX: ORDER BY id\nLock row 1 first ✓', txB: 'FIX: ORDER BY id\nWaiting for row 1...', lockA: [1], lockB: [], waitA: null, waitB: null,
        msg: '✓ Fix: consistent lock ordering. Both sessions lock lower ID first. No circular wait possible.' },
    ]
    let step = 0
    window._dlSteps = steps

    function render(s) {
      document.getElementById('dl-grid').innerHTML = `
        <div class="viz-tx ${s.waitA ? 'viz-tx-wait' : ''} ${s.txA.includes('✗') ? 'viz-tx-dead' : ''} ${s.txA.includes('FIX') ? 'viz-tx-ok' : ''}">
          <div class="viz-tx-label">Transaction A</div>
          <div class="viz-tx-body">${s.txA.replace(/\n/g,'<br>')}</div>
          ${s.lockA.map(r=>`<div class="viz-lock">🔒 Row ${r}</div>`).join('')}
          ${s.waitA ? `<div class="viz-wait">⏳ waiting for row ${s.waitA}</div>` : ''}
        </div>
        <div class="viz-rows">
          <div class="viz-row ${s.lockA.includes(1) ? 'viz-row-locked-a' : ''} ${s.lockB.includes(1) ? 'viz-row-locked-b' : ''}">Row 1<br><span>acct 1</span></div>
          <div class="viz-row ${s.lockA.includes(2) ? 'viz-row-locked-a' : ''} ${s.lockB.includes(2) ? 'viz-row-locked-b' : ''}">Row 2<br><span>acct 2</span></div>
        </div>
        <div class="viz-tx ${s.waitB ? 'viz-tx-wait' : ''} ${s.txB.includes('✓') && s.txA.includes('✗') ? 'viz-tx-ok' : ''} ${s.txB.includes('FIX') ? 'viz-tx-ok' : ''}">
          <div class="viz-tx-label">Transaction B</div>
          <div class="viz-tx-body">${s.txB.replace(/\n/g,'<br>')}</div>
          ${s.lockB.map(r=>`<div class="viz-lock">🔒 Row ${r}</div>`).join('')}
          ${s.waitB ? `<div class="viz-wait">⏳ waiting for row ${s.waitB}</div>` : ''}
        </div>`
      const log = document.getElementById('dl-log')
      const d = document.createElement('div')
      d.className = 'viz-log-line' + (s.msg.includes('🔴') ? ' viz-log-warn' : s.msg.includes('✓ Fix') ? ' viz-log-done' : '')
      d.textContent = `Step ${step}: ${s.msg}`
      log.appendChild(d)
    }

    render(steps[0])
    window.dlStep = () => {
      step = Math.min(step+1, steps.length-1)
      render(steps[step])
      if (step === steps.length-1) document.getElementById('dl-btn').disabled = true
    }
    window.dlReset = () => {
      step = 0
      document.getElementById('dl-btn').disabled = false
      document.getElementById('dl-log').innerHTML = ''
      render(steps[0])
    }
  },

  // ── N+1 query visualisation ───────────────────────────────────
  n1(el) {
    el.innerHTML = `
      <div class="viz-n1">
        <div class="viz-title">See the difference between N+1 and the correct approach</div>
        <div class="viz-n1-controls">
          <button class="viz-btn" onclick="n1Show('bad')">▶ Run with LAZY (N+1)</button>
          <button class="viz-btn viz-btn-ok" onclick="n1Show('good')">▶ Run with JOIN FETCH</button>
          <button class="viz-btn viz-btn-reset" onclick="n1Reset()">Reset</button>
        </div>
        <div class="viz-n1-grid">
          <div class="viz-n1-col">
            <div class="viz-n1-header bad">App code</div>
            <div class="viz-n1-body" id="n1-code"></div>
          </div>
          <div class="viz-n1-col">
            <div class="viz-n1-header" id="n1-db-header">SQL log</div>
            <div class="viz-n1-body" id="n1-queries"></div>
          </div>
        </div>
        <div id="n1-result" class="viz-log"></div>
      </div>`

    window.n1Show = function(mode) {
      n1Reset()
      const codeEl = document.getElementById('n1-code')
      const queryEl = document.getElementById('n1-queries')
      const hdr = document.getElementById('n1-db-header')
      const res = document.getElementById('n1-result')
      const accounts = [1,2,3,4,5,6,7,8,9,10]

      if (mode === 'bad') {
        codeEl.innerHTML = `<code>accountRepo.findAll()\n.stream()\n.map(a -> a.getTransactions()\n          .size())</code>`
        hdr.textContent = `SQL log — watch it scroll`
        hdr.className = 'viz-n1-header bad'
        // Show query 1 then N more
        let i = 0
        function addQuery() {
          const d = document.createElement('div')
          d.className = 'viz-query-line'
          if (i === 0) {
            d.textContent = 'SELECT * FROM accounts;'
            d.style.color = 'var(--blue)'
          } else {
            d.textContent = `SELECT * FROM transactions WHERE account_id = ${i};`
            d.style.color = 'var(--red)'
          }
          queryEl.appendChild(d)
          queryEl.scrollTop = queryEl.scrollHeight
          i++
          if (i <= accounts.length) setTimeout(addQuery, 200)
          else {
            const d2 = document.createElement('div')
            d2.className = 'viz-log-line viz-log-warn'
            d2.textContent = `🔴 Total: ${accounts.length+1} queries for ${accounts.length} accounts. With 1000 accounts: 1001 queries.`
            res.appendChild(d2)
          }
        }
        addQuery()
      } else {
        codeEl.innerHTML = `<code>@Query("SELECT a FROM Account a\nLEFT JOIN FETCH\na.transactions")\nList&lt;Account&gt; findAll();</code>`
        hdr.textContent = 'SQL log — just 1 query'
        hdr.className = 'viz-n1-header good'
        setTimeout(()=>{
          const d = document.createElement('div')
          d.className = 'viz-query-line'
          d.style.color = 'var(--green)'
          d.textContent = 'SELECT a.*, t.* FROM accounts a LEFT OUTER JOIN transactions t ON t.account_id = a.id;'
          queryEl.appendChild(d)
          const d2 = document.createElement('div')
          d2.className = 'viz-log-line viz-log-done'
          d2.textContent = `✓ Total: 1 query for any number of accounts. 1000 accounts = still 1 query.`
          res.appendChild(d2)
        }, 300)
      }
    }
    window.n1Reset = function() {
      document.getElementById('n1-code').innerHTML = ''
      document.getElementById('n1-queries').innerHTML = ''
      document.getElementById('n1-result').innerHTML = ''
      document.getElementById('n1-db-header').textContent = 'SQL log'
    }
  },

  // ── TCP + TLS handshake ───────────────────────────────────────
  tcp(el) {
    el.innerHTML = `
      <div class="viz-tcp">
        <div class="viz-title">TCP handshake + TLS negotiation — where latency comes from</div>
        <button class="viz-btn" onclick="tcpAnimate()" id="tcp-btn">▶ Animate connection</button>
        <div class="viz-tcp-grid" id="tcp-grid">
          <div class="viz-tcp-side">Client</div>
          <div class="viz-tcp-timeline" id="tcp-timeline"><div class="viz-tcp-line"></div></div>
          <div class="viz-tcp-side">Server</div>
        </div>
        <div class="viz-tcp-legend" id="tcp-legend"></div>
        <div id="tcp-log" class="viz-log"></div>
      </div>`

    const events = [
      { dir:'→', label:'SYN', y:60, color:'var(--blue)', phase:'TCP', desc:'Client: "I want to connect"' },
      { dir:'←', label:'SYN-ACK', y:100, color:'var(--teal)', phase:'TCP', desc:'Server: "OK, I\'m listening"' },
      { dir:'→', label:'ACK', y:140, color:'var(--blue)', phase:'TCP', desc:'Client: "Connection established" — 1 RTT spent' },
      { dir:'→', label:'ClientHello', y:190, color:'var(--purple)', phase:'TLS', desc:'Client: "Here are my supported cipher suites and key share"' },
      { dir:'←', label:'ServerHello + Cert + Finished', y:240, color:'var(--purple)', phase:'TLS', desc:'Server: "Use this cipher, here\'s my certificate, we\'re done" — TLS 1.3: 1 RTT total' },
      { dir:'→', label:'HTTP Request', y:290, color:'var(--green)', phase:'DATA', desc:'Finally! First actual data — after 2 RTTs of setup' },
      { dir:'←', label:'HTTP Response', y:330, color:'var(--green)', phase:'DATA', desc:'Server responds. Connection reuse skips ALL of the above.' },
    ]

    window.tcpAnimate = function() {
      document.getElementById('tcp-btn').disabled = true
      const log = document.getElementById('tcp-log')
      const legend = document.getElementById('tcp-legend')
      log.innerHTML = ''
      legend.innerHTML = `
        <span class="viz-legend-item" style="color:var(--blue)">■ TCP</span>
        <span class="viz-legend-item" style="color:var(--purple)">■ TLS</span>
        <span class="viz-legend-item" style="color:var(--green)">■ Data</span>`

      const tl = document.getElementById('tcp-timeline')
      // Clear old arrows
      tl.querySelectorAll('.viz-arrow').forEach(a=>a.remove())

      events.forEach((ev, i) => {
        setTimeout(()=>{
          const arrow = document.createElement('div')
          arrow.className = 'viz-arrow'
          arrow.style.cssText = `position:absolute;top:${ev.y}px;left:0;right:0;display:flex;align-items:center;gap:6px;font-size:11px;font-weight:700;color:${ev.color}`
          const line = ev.dir === '→'
            ? `<div style="flex:1;height:1.5px;background:${ev.color}"></div><div>▶</div>`
            : `<div>◀</div><div style="flex:1;height:1.5px;background:${ev.color}"></div>`
          arrow.innerHTML = ev.dir === '→'
            ? `<span style="white-space:nowrap">${ev.label}</span>${line}`
            : `${line}<span style="white-space:nowrap">${ev.label}</span>`
          tl.appendChild(arrow)

          const d = document.createElement('div')
          d.className = 'viz-log-line' + (ev.phase==='DATA'?' viz-log-done':'')
          d.innerHTML = `<span style="color:${ev.color};font-weight:700">[${ev.phase}]</span> ${ev.desc}`
          log.appendChild(d)

          if (i === events.length-1) {
            setTimeout(()=>{ document.getElementById('tcp-btn').disabled = false }, 500)
          }
        }, i * 600)
      })
    }
  },

  // ── CGLIB proxy / self-invocation ────────────────────────────
  proxy(el) {
    el.innerHTML = `
      <div class="viz-proxy">
        <div class="viz-title">CGLIB proxy — how @Transactional works, and why self-invocation breaks it</div>
        <div class="viz-proxy-controls">
          <button class="viz-btn" onclick="proxyShow('external')">External call (works)</button>
          <button class="viz-btn bad" onclick="proxyShow('self')">Self-invocation (broken)</button>
          <button class="viz-btn viz-btn-reset" onclick="proxyReset()">Reset</button>
        </div>
        <div class="viz-proxy-diagram" id="proxy-diag"></div>
        <div id="proxy-log" class="viz-log"></div>
      </div>`

    const base = `
      <div class="viz-proxy-row">
        <div class="viz-proxy-box caller">External Caller<br><small>OtherService</small></div>
        <div class="viz-proxy-arrow" id="p-arr1">→</div>
        <div class="viz-proxy-box proxy">CGLIB Proxy<br><small>PaymentService$$Proxy</small></div>
        <div class="viz-proxy-arrow" id="p-arr2">→</div>
        <div class="viz-proxy-box real">Real Bean<br><small>PaymentService</small></div>
      </div>
      <div class="viz-proxy-note" id="proxy-note"></div>`

    document.getElementById('proxy-diag').innerHTML = base

    window.proxyShow = function(mode) {
      proxyReset()
      const log = document.getElementById('proxy-log')

      if (mode === 'external') {
        const steps = [
          {el:'caller', msg:'OtherService calls paymentService.processPayment()', color:'var(--blue)'},
          {el:'proxy', msg:'Proxy intercepts → starts @Transactional → delegates to real bean', color:'var(--purple)'},
          {el:'real', msg:'Real PaymentService.processPayment() runs inside transaction', color:'var(--green)'},
          {el:'proxy', msg:'Proxy catches any exception → commits or rolls back → done ✓', color:'var(--green)'},
        ]
        steps.forEach((s,i)=>{
          setTimeout(()=>{
            document.querySelectorAll('.viz-proxy-box').forEach(b=>b.style.boxShadow='')
            const el = document.querySelector('.viz-proxy-box.'+s.el)
            if (el) el.style.boxShadow = `0 0 0 2px ${s.color}`
            const d = document.createElement('div')
            d.className = 'viz-log-line' + (i===steps.length-1?' viz-log-done':'')
            d.innerHTML = `<span style="color:${s.color};font-weight:700">Step ${i+1}:</span> ${s.msg}`
            log.appendChild(d)
          }, i*700)
        })
      } else {
        const steps = [
          {el:'caller', msg:'OtherService calls paymentService.processPayment()', color:'var(--blue)'},
          {el:'proxy', msg:'Proxy intercepts → starts @Transactional → delegates to real bean', color:'var(--purple)'},
          {el:'real', msg:'processPayment() runs... then calls this.validateAndNotify()', color:'var(--amber)'},
          {el:'real', msg:'⚠ "this" = real bean, NOT proxy. Proxy is bypassed entirely!', color:'var(--red)'},
          {el:'real', msg:'🔴 validateAndNotify() runs with NO transaction. @Transactional has no effect.', color:'var(--red)'},
        ]
        steps.forEach((s,i)=>{
          setTimeout(()=>{
            document.querySelectorAll('.viz-proxy-box').forEach(b=>b.style.boxShadow='')
            const el = document.querySelector('.viz-proxy-box.'+s.el)
            if (el) el.style.boxShadow = `0 0 0 2px ${s.color}`
            const d = document.createElement('div')
            d.className = 'viz-log-line' + (i>=3?' viz-log-warn':'')
            d.innerHTML = `<span style="color:${s.color};font-weight:700">Step ${i+1}:</span> ${s.msg}`
            log.appendChild(d)
          }, i*700)
        })
      }
    }
    window.proxyReset = function() {
      document.getElementById('proxy-log').innerHTML = ''
      document.querySelectorAll('.viz-proxy-box').forEach(b=>b.style.boxShadow='')
    }
  }
}

// Mount visualisations onto diagram-wrap elements
function mountViz(weekId, type) {
  // Called from buildContent after rendering — finds the diagram wrap for this week
  const wrap = document.querySelector(`#${weekId} .diagram-wrap`)
  if (!wrap || !VIZ[type]) return
  const el = document.createElement('div')
  el.className = 'viz-container'
  wrap.appendChild(el)
  VIZ[type](el)
}

// ── OOMKill and JVM memory budget ─────────────────────────────
VIZ.oomkill = function(el) {
  el.innerHTML = `
    <div class="viz-title">JVM memory budget — why the heap is not the whole picture</div>
    <div class="viz-oom-grid">
      <div>
        <div class="viz-oom-label">Container memory limit: 512 MB</div>
        <div class="viz-oom-bar-wrap">
          <div class="viz-oom-seg" style="height:57%;background:var(--blue);color:#fff">
            <span>Heap</span><small>384 MB (75%)</small>
          </div>
          <div class="viz-oom-seg" style="height:20%;background:var(--amber);color:#fff">
            <span>Metaspace</span><small>~100 MB</small>
          </div>
          <div class="viz-oom-seg" style="height:10%;background:var(--teal);color:#fff">
            <span>Thread stacks</span><small>~50 MB</small>
          </div>
          <div class="viz-oom-seg" style="height:8%;background:var(--purple);color:#fff">
            <span>Netty buffers</span><small>~40 MB</small>
          </div>
          <div class="viz-oom-seg viz-oom-over" style="height:5%;background:var(--red)">
            <span>⚠ Over limit</span>
          </div>
        </div>
        <div class="viz-oom-footer bad">Total ~574 MB &gt; 512 MB limit → OOMKill (exit 137)</div>
      </div>
      <div>
        <div class="viz-oom-label">Container memory limit: 768 MB</div>
        <div class="viz-oom-bar-wrap">
          <div class="viz-oom-seg" style="height:75%;background:var(--blue);color:#fff">
            <span>Heap</span><small>576 MB (75%)</small>
          </div>
          <div class="viz-oom-seg" style="height:13%;background:var(--amber);color:#fff">
            <span>Metaspace</span><small>~100 MB</small>
          </div>
          <div class="viz-oom-seg" style="height:6%;background:var(--teal);color:#fff">
            <span>Thread stacks</span><small>~50 MB</small>
          </div>
          <div class="viz-oom-seg" style="height:5%;background:var(--purple);color:#fff">
            <span>Buffers</span><small>~40 MB</small>
          </div>
        </div>
        <div class="viz-oom-footer good">Total ~766 MB &lt; 768 MB → Safe ✓</div>
      </div>
    </div>
    <div class="viz-qos-grid">
      <div class="viz-qos-card">
        <div class="viz-qos-title bad">BestEffort</div>
        <div class="viz-qos-body">requests and limits<br><strong>not set at all</strong><br><br>First evicted under pressure</div>
      </div>
      <div class="viz-qos-card">
        <div class="viz-qos-title mid">Burstable</div>
        <div class="viz-qos-body">requests &lt; limits<br><strong>e.g. req: 256Mi, limit: 512Mi</strong><br><br>Evicted second</div>
      </div>
      <div class="viz-qos-card">
        <div class="viz-qos-title good">Guaranteed</div>
        <div class="viz-qos-body">requests = limits<br><strong>e.g. req: 512Mi, limit: 512Mi</strong><br><br>Last to be evicted<br><em>Use this in production</em></div>
      </div>
    </div>`
}

// ── HPA timeline ───────────────────────────────────────────────
VIZ.hpa = function(el) {
  el.innerHTML = `
    <div class="viz-title">HPA — how autoscaling responds to load over time</div>
    <div class="viz-hpa-controls">
      <button class="viz-btn" onclick="hpaAnimate()" id="hpa-btn">▶ Simulate load spike</button>
      <button class="viz-btn viz-btn-reset" onclick="hpaReset()">Reset</button>
    </div>
    <div class="viz-hpa-grid" id="hpa-grid">
      <div class="viz-hpa-row-label">CPU %</div>
      <div class="viz-hpa-timeline" id="hpa-cpu-line"></div>
      <div class="viz-hpa-row-label">Pods</div>
      <div class="viz-hpa-timeline" id="hpa-pod-line"></div>
      <div class="viz-hpa-row-label">Phase</div>
      <div class="viz-hpa-timeline" id="hpa-phase-line"></div>
    </div>
    <div id="hpa-log" class="viz-log"></div>
    <div style="margin-top:1rem;padding:10px 14px;background:var(--amber-bg);border:1px solid var(--amber-lt);border-radius:var(--radius);font-size:13px;color:var(--amber)">
      <strong>⚠ CPU-based HPA is wrong for DB-bound services.</strong>
      A banking payment service waiting on DB connections uses &lt;5% CPU — HPA never triggers,
      service is silently saturated. Use KEDA with <code>hikaricp_connections_pending</code> metric instead.
    </div>`

  const phases = [
    { t:0,  cpu:15, pods:2, label:'Normal', color:'var(--green)' },
    { t:1,  cpu:30, pods:2, label:'Load rising', color:'var(--teal)' },
    { t:2,  cpu:62, pods:2, label:'▲ HPA triggers (>50%)', color:'var(--amber)' },
    { t:3,  cpu:55, pods:4, label:'Scaling up…', color:'var(--amber)' },
    { t:4,  cpu:30, pods:4, label:'Load handled', color:'var(--green)' },
    { t:5,  cpu:10, pods:4, label:'Load drops — 5min window starts', color:'var(--blue)' },
    { t:6,  cpu:10, pods:4, label:'Stabilising (5 min)…', color:'var(--blue)' },
    { t:7,  cpu:10, pods:2, label:'▼ Scale down after window', color:'var(--green)' },
  ]

  window.hpaAnimate = function() {
    document.getElementById('hpa-btn').disabled = true
    const cpuLine = document.getElementById('hpa-cpu-line')
    const podLine = document.getElementById('hpa-pod-line')
    const phaseLine = document.getElementById('hpa-phase-line')
    const log = document.getElementById('hpa-log')
    cpuLine.innerHTML = ''
    podLine.innerHTML = ''
    phaseLine.innerHTML = ''
    log.innerHTML = ''
    phases.forEach((p, i) => {
      setTimeout(() => {
        const mkCell = (text, color, bg) => {
          const d = document.createElement('div')
          d.className = 'viz-hpa-cell'
          d.style.cssText = `color:${color};background:${bg||'var(--bg2)'};border-color:${color}40`
          d.textContent = text
          return d
        }
        cpuLine.appendChild(mkCell(p.cpu+'%',
          p.cpu > 50 ? 'var(--red)' : p.cpu > 30 ? 'var(--amber)' : 'var(--green)',
          p.cpu > 50 ? 'var(--red-bg)' : ''))
        podLine.appendChild(mkCell(p.pods+' pods',
          p.pods > 2 ? 'var(--blue)' : 'var(--muted)'))
        phaseLine.appendChild(mkCell(p.label, p.color))
        if (p.label.includes('▲') || p.label.includes('▼') || p.label.includes('window')) {
          const d = document.createElement('div')
          d.className = 'viz-log-line' + (p.label.includes('▲') ? ' viz-log-warn' : p.label.includes('▼') ? ' viz-log-done' : '')
          d.textContent = `t+${i*30}s: ${p.label}`
          log.appendChild(d)
        }
        if (i === phases.length - 1)
          setTimeout(()=>document.getElementById('hpa-btn').disabled=false, 400)
      }, i * 500)
    })
  }
  window.hpaReset = function() {
    ['hpa-cpu-line','hpa-pod-line','hpa-phase-line'].forEach(id=>document.getElementById(id).innerHTML='')
    document.getElementById('hpa-log').innerHTML = ''
    document.getElementById('hpa-btn').disabled = false
  }
}

// ── Rolling vs Blue-Green deploy ──────────────────────────────
VIZ.deploy = function(el) {
  el.innerHTML = `
    <div class="viz-title">Deployment strategies — click each tab to compare</div>
    <div style="font-size:13.5px;color:var(--muted);margin-bottom:1rem;line-height:1.65">
      Three strategies exist for rolling out new versions. The right choice depends on
      what your DB migration does — some migrations are safe during a V1/V2 overlap window,
      others require zero overlap. Understanding this is core platform team knowledge.
    </div>
    <div class="viz-deploy-tabs">
      <button class="viz-btn active" id="dt-rolling" onclick="deployShow('rolling')">Rolling</button>
      <button class="viz-btn" id="dt-bluegreen" onclick="deployShow('bluegreen')">Blue-Green</button>
      <button class="viz-btn" id="dt-canary" onclick="deployShow('canary')">Canary</button>
    </div>
    <div id="deploy-content"></div>
    <div id="deploy-migration-table" style="margin-top:1rem"></div>`

  const strategies = {
    rolling: {
      color: 'var(--amber)',
      diagram: () => `
        <div class="viz-deploy-timeline">
          <div class="viz-dt-label">t=0</div>
          <div class="viz-dt-label">t=30s</div>
          <div class="viz-dt-label">t=60s (done)</div>
        </div>
        <div class="viz-deploy-rows">
          <div class="viz-dr-label">V1 pods</div>
          <div class="viz-dr-bars">
            <div class="viz-dr-bar" style="background:var(--blue);width:100%">●●●●</div>
            <div class="viz-dr-bar" style="background:var(--blue);width:50%;opacity:.5">●●</div>
            <div class="viz-dr-bar" style="background:var(--blue);width:0"></div>
          </div>
          <div class="viz-dr-label">V2 pods</div>
          <div class="viz-dr-bars">
            <div class="viz-dr-bar" style="background:var(--green);width:0"></div>
            <div class="viz-dr-bar" style="background:var(--green);width:50%">●●</div>
            <div class="viz-dr-bar" style="background:var(--green);width:100%">●●●●</div>
          </div>
          <div class="viz-dr-label viz-dr-overlap">⚠ V1+V2 overlap</div>
          <div class="viz-dr-bars">
            <div class="viz-dr-bar" style="background:transparent"></div>
            <div class="viz-dr-bar" style="background:var(--amber-bg);border:1px solid var(--amber-lt);color:var(--amber);font-size:11px">Both versions serve traffic<br>Migration already ran on V2</div>
            <div class="viz-dr-bar" style="background:transparent"></div>
          </div>
        </div>`,
      label: '<strong>K8s default — use for most deploys.</strong> Pods are replaced gradually, one at a time. Zero downtime. But V1 and V2 pods run simultaneously for ~30–60 seconds — they share the same database. Any migration that runs must not break V1 code.',
      safe: ['Add nullable column', 'Add index (CONCURRENTLY)', 'Add new table'],
      unsafe: ['Rename column', 'Drop column', 'Change column type']
    },
    bluegreen: {
      color: 'var(--blue)',
      diagram: () => `
        <div class="viz-bg-grid">
          <div class="viz-bg-lb">
            <div class="viz-flow-node db">Load Balancer</div>
            <div style="font-size:12px;color:var(--muted);margin-top:6px" id="bg-arrow">↓ pointing to Blue</div>
          </div>
          <div class="viz-bg-envs">
            <div class="viz-bg-env active" id="bg-blue">
              <div class="viz-bg-env-label">🔵 Blue (live)</div>
              <div class="viz-bg-env-body">V1 pods serving traffic<br>DB: current schema</div>
            </div>
            <div class="viz-bg-env" id="bg-green">
              <div class="viz-bg-env-label">🟢 Green (staging)</div>
              <div class="viz-bg-env-body">V2 pods ready<br>Migration already ran</div>
            </div>
          </div>
          <div style="margin-top:10px">
            <button class="viz-btn" onclick="bgSwitch()">Switch traffic → Green</button>
          </div>
        </div>`,
      label: '<strong>Two full environments running in parallel.</strong> Traffic switches atomically from Blue to Green via the load balancer. No V1/V2 overlap window — safe for any migration type. Costs double infra resources during the cutover period. Your team likely uses this for major version upgrades.',
      safe: ['Everything — no overlap window', 'Destructive renames safe', 'Schema changes run on green while blue serves'],
      unsafe: ['High infra cost (double resources during transition)']
    },
    canary: {
      color: 'var(--purple)',
      diagram: () => `
        <div class="viz-canary-grid">
          <div class="viz-flow-node db" style="margin:0 auto 12px">Load Balancer / Ingress</div>
          <div style="display:flex;gap:16px;justify-content:center">
            <div style="text-align:center">
              <div class="viz-flow-node" style="background:var(--blue-bg);border-color:var(--blue-lt);color:var(--blue)">V1 pods (90%)</div>
              <div style="font-size:11px;color:var(--muted);margin-top:4px">Most traffic</div>
            </div>
            <div style="text-align:center">
              <div class="viz-flow-node" style="background:var(--green-bg);border-color:var(--green-lt);color:var(--green)">V2 pod (10%)</div>
              <div style="font-size:11px;color:var(--muted);margin-top:4px">Canary</div>
            </div>
          </div>
          <div style="margin-top:12px;padding:9px 14px;background:var(--purple-bg);border:1px solid var(--purple-lt);border-radius:var(--radius);font-size:12.5px;color:var(--purple)">
            Both V1 and V2 hit the same database — migration must be backward-compatible.<br>
            Traffic weights configured by infra team (Istio / nginx ingress). Not your config.
          </div>
        </div>`,
      label: '<strong>Route a small % of traffic to V2 before committing.</strong> Real users test the new version at low risk. If errors spike, roll back the canary. The infra team configures traffic weights (Istio / nginx). Both V1 and V2 hit the same DB — migrations must be backward-compatible.',
      safe: ['Only backward-compatible migrations'],
      unsafe: ['Destructive migrations — V1 still running on same DB']
    }
  }

  window.bgSwitch = function() {
    const blue = document.getElementById('bg-blue')
    const green = document.getElementById('bg-green')
    const arrow = document.getElementById('bg-arrow')
    if (!blue || !green) return
    blue.classList.remove('active')
    green.classList.add('active')
    arrow.textContent = '↓ pointing to Green ✓'
    arrow.style.color = 'var(--green)'
  }

  window.deployShow = function(mode) {
    document.querySelectorAll('.viz-deploy-tabs .viz-btn').forEach(b=>b.classList.remove('active'))
    document.getElementById('dt-'+mode).classList.add('active')
    const s = strategies[mode]
    document.getElementById('deploy-content').innerHTML = `
      <div style="padding:10px 14px;background:var(--bg2);border:1px solid var(--border);border-radius:var(--radius);font-size:13.5px;color:var(--muted);margin:10px 0">${s.label}</div>
      <div class="viz-deploy-diagram">${s.diagram()}</div>`
    document.getElementById('deploy-migration-table').innerHTML = `<div style="font-size:11px;font-weight:700;color:var(--hint);text-transform:uppercase;letter-spacing:.06em;margin-bottom:8px">Migration safety for this strategy</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
        <div>
          <div style="font-size:11px;font-weight:800;color:var(--green);text-transform:uppercase;margin-bottom:6px">✓ Safe migrations</div>
          ${s.safe.map(m=>`<div style="font-size:13px;padding:5px 8px;background:var(--green-bg);border-radius:4px;margin-bottom:4px;color:var(--green)">${m}</div>`).join('')}
        </div>
        <div>
          <div style="font-size:11px;font-weight:800;color:var(--red);text-transform:uppercase;margin-bottom:6px">✗ Risky migrations</div>
          ${s.unsafe.map(m=>`<div style="font-size:13px;padding:5px 8px;background:var(--red-bg);border-radius:4px;margin-bottom:4px;color:var(--red)">${m}</div>`).join('')}
        </div>
      </div>`
  }
  deployShow('rolling')
}

// ── Expand-contract pattern ────────────────────────────────────
VIZ.expandcontract = function(el) {
  el.innerHTML = `
    <div class="viz-title">Expand-contract — the only safe way to rename a column in a live system</div>
    <div class="viz-ec-controls">
      <button class="viz-btn active" onclick="ecShow(0,this)">Phase 1: Expand</button>
      <button class="viz-btn" onclick="ecShow(1,this)">Phase 2: Migrate</button>
      <button class="viz-btn" onclick="ecShow(2,this)">Phase 3: Contract</button>
    </div>
    <div id="ec-content"></div>`

  const phases = [
    {
      title: 'Phase 1 — Expand (deploy V2)',
      desc: 'Add the new column alongside the old one. V2 writes to both. V1 still reads the old column — no breakage.',
      db: [
        { name: 'id', type: 'BIGINT', v1:'read', v2:'read' },
        { name: 'txn_status', type: 'VARCHAR', v1:'read/write', v2:'write only', old: true },
        { name: 'status', type: 'VARCHAR', v1:'ignored', v2:'read/write', new: true },
      ],
      note: 'V1 and V2 can run simultaneously. Rolling deploy is safe.'
    },
    {
      title: 'Phase 2 — Migrate data',
      desc: 'Backfill all rows: UPDATE transactions SET status = txn_status WHERE status IS NULL. Can run as Liquibase migration or background job.',
      db: [
        { name: 'id', type: 'BIGINT', v1:'read', v2:'read' },
        { name: 'txn_status', type: 'VARCHAR', v1:'read', v2:'ignored', old: true },
        { name: 'status', type: 'VARCHAR', v1:'ignored', v2:'read/write', new: true },
      ],
      note: 'All rows now have both columns populated. V2 reads only the new column.'
    },
    {
      title: 'Phase 3 — Contract (deploy V3)',
      desc: 'V3 reads only the new column. Drop the old column once all V2 pods are confirmed gone.',
      db: [
        { name: 'id', type: 'BIGINT', v1:'gone', v2:'read', v3:'read' },
        { name: 'txn_status', type: 'VARCHAR', v1:'gone', v2:'gone', v3:'DROPPED', old: true, dropped: true },
        { name: 'status', type: 'VARCHAR', v1:'gone', v2:'read', v3:'read/write', new: true },
      ],
      note: 'Safe to drop: no running code references txn_status anymore.'
    }
  ]

  window.ecShow = function(idx, btn) {
    document.querySelectorAll('.viz-ec-controls .viz-btn').forEach(b=>b.classList.remove('active'))
    if(btn) btn.classList.add('active')
    const p = phases[idx]
    const cols = p.db.map(col => {
      const cls = col.dropped ? 'viz-ec-col-dropped' : col.new ? 'viz-ec-col-new' : col.old ? 'viz-ec-col-old' : ''
      const versions = Object.entries(col).filter(([k])=>!['name','type','old','new','dropped'].includes(k))
      return `<div class="viz-ec-col ${cls}">
        <div class="viz-ec-col-name">${col.name}</div>
        <div class="viz-ec-col-type">${col.type}</div>
        ${versions.map(([v,usage])=>`<div class="viz-ec-usage"><span class="viz-ec-ver">${v.toUpperCase()}</span>${usage}</div>`).join('')}
      </div>`
    }).join('')
    document.getElementById('ec-content').innerHTML = `
      <div style="font-size:15px;font-weight:700;margin:10px 0 5px">${p.title}</div>
      <div style="font-size:13.5px;color:var(--muted);margin-bottom:12px">${p.desc}</div>
      <div class="viz-ec-table">${cols}</div>
      <div style="margin-top:10px;font-size:13px;color:var(--muted);font-style:italic">${p.note}</div>`
  }
  ecShow(0)
}

// ── GitOps pipeline flow ───────────────────────────────────────
VIZ.gitops = function(el) {
  el.innerHTML = `
    <div class="viz-title">GitOps pipeline — click each step to understand ownership</div>
    <div class="viz-gitops-flow" id="gitops-flow"></div>
    <div id="gitops-detail" class="viz-gitops-detail"></div>`

  const steps = [
    { id:'code', icon:'📝', label:'Code push', owner:'You', color:'var(--blue)',
      detail: 'You write code, write tests, open a PR. After merge to main, the pipeline starts. This is your primary ownership zone — the application code and its tests.' },
    { id:'jenkins', icon:'🔨', label:'Jenkins', owner:'CI Pipeline', color:'var(--amber)',
      detail: 'Jenkins runs: mvn test → mvn package → docker build → docker push. Tags the image with the commit SHA (e.g. my-app:a3f8c2d). Never :latest — that loses traceability. The image is now in the registry.' },
    { id:'values', icon:'📄', label:'Values file update', owner:'Jenkins / Pipeline', color:'var(--amber)',
      detail: 'Jenkins updates image.tag in the Helm values file in a separate config Git repo (e.g. values-prod.yaml: image.tag: a3f8c2d). This Git commit IS the deployment record. Reviewable, reversible, auditable.' },
    { id:'argocd', icon:'🔄', label:'ArgoCD detects drift', owner:'Platform infra', color:'var(--teal)',
      detail: 'ArgoCD watches the config repo continuously. It compares what is in Git with what is running in the cluster. When they differ (drift), ArgoCD alerts or auto-syncs depending on policy. Prod usually requires manual approval.' },
    { id:'helm', icon:'⎈', label:'helm upgrade', owner:'ArgoCD', color:'var(--teal)',
      detail: 'ArgoCD runs helm upgrade with the new values. You never run this manually in production. Helm applies the new Deployment spec to K8s. K8s begins the rolling update.' },
    { id:'k8s', icon:'☸', label:'K8s rolls out pods', owner:'Kubernetes', color:'var(--green)',
      detail: 'K8s replaces pods according to the Deployment strategy (rolling by default). New pods start, Liquibase runs migration on first startup, readiness probes pass, traffic switches. Old pods terminate.' },
  ]

  const flow = document.getElementById('gitops-flow')
  steps.forEach((s, i) => {
    const btn = document.createElement('div')
    btn.className = 'viz-gitops-step'
    btn.style.cssText = `border-color:${s.color}40;cursor:pointer`
    btn.innerHTML = `
      <div class="viz-gitops-icon" style="background:${s.color}18;color:${s.color}">${s.icon}</div>
      <div class="viz-gitops-label">${s.label}</div>
      <div class="viz-gitops-owner" style="color:${s.color}">${s.owner}</div>`
    btn.onclick = () => {
      document.querySelectorAll('.viz-gitops-step').forEach(b=>b.classList.remove('active'))
      btn.classList.add('active')
      btn.style.borderColor = s.color
      document.getElementById('gitops-detail').innerHTML = `
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px">
          <span style="font-size:22px">${s.icon}</span>
          <span style="font-size:15px;font-weight:700">${s.label}</span>
          <span class="optional-badge" style="background:${s.color}18;color:${s.color};border-color:${s.color}40">Owned by: ${s.owner}</span>
        </div>
        <div style="font-size:14px;line-height:1.7;color:var(--text)">${s.detail}</div>`
    }
    flow.appendChild(btn)
    if (i < steps.length - 1) {
      const arr = document.createElement('div')
      arr.className = 'viz-gitops-arrow'
      arr.textContent = '→'
      flow.appendChild(arr)
    }
  })
  // Click first step by default
  flow.querySelector('.viz-gitops-step').click()
}
