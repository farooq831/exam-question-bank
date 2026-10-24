/**
 * SKANS Question Bank - Windows Server deployment guide (beginner friendly, step by step).
 * Rendered to PDF by make-server-guide.ts.
 */
export function renderServerGuideHtml(images: { logo: string }): string {
  const cmd = (lines: string, label = 'PowerShell (as Administrator)') =>
    `<div class="term"><div class="term-bar"><span></span><span></span><span></span><em>${label}</em></div><pre>${lines}</pre></div>`;
  const out = (lines: string) => cmd(lines, 'What you should see');
  const file = (lines: string, name: string) => cmd(lines, name);
  const tip = (t: string) => `<div class="box tip"><b>Tip</b>${t}</div>`;
  const warn = (t: string) => `<div class="box warn"><b>Important</b>${t}</div>`;
  const info = (t: string) => `<div class="box info"><b>Good to know</b>${t}</div>`;
  const verified = (t = 'Tested on 23 October 2026 with a release package installed into an empty folder.') => `<div class="box ok"><b>✓ Verified</b>${t}</div>`;
  const problem = (rows: [string, string][]) =>
    `<div class="box prob"><b>If something goes wrong in this step</b><table class="mini">${rows.map(([a, b]) => `<tr><td>${a}</td><td>${b}</td></tr>`).join('')}</table></div>`;
  const steps = (xs: string[]) => `<ol class="steps">${xs.map((x) => `<li>${x}</li>`).join('')}</ol>`;
  const phase = (n: number, name: string) => `<div class="phase"><span>Phase ${n}</span>${name}</div>`;
  const figure = (svg: string, caption: string) => `<figure>${svg}<figcaption>${caption}</figcaption></figure>`;

  const svgPlanA = `
<svg viewBox="0 0 760 330" xmlns="http://www.w3.org/2000/svg" font-family="Segoe UI, Arial" font-size="12.5">
  <defs><marker id="a" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0L10 5L0 10z" fill="#1b2a4b"/></marker>
  <marker id="g" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0L10 5L0 10z" fill="#c08a2e"/></marker></defs>
  <rect x="10" y="40" width="130" height="70" rx="10" fill="#eef2ff" stroke="#1b2a4b"/><text x="75" y="70" text-anchor="middle" font-weight="700">Staff on campus</text><text x="75" y="90" text-anchor="middle" font-size="11">SKANS Wi-Fi / LAN</text>
  <rect x="10" y="150" width="130" height="70" rx="10" fill="#eef2ff" stroke="#1b2a4b"/><text x="75" y="180" text-anchor="middle" font-weight="700">Staff at home</text><text x="75" y="200" text-anchor="middle" font-size="11">any internet</text>
  <line x1="142" y1="75" x2="218" y2="120" stroke="#1b2a4b" stroke-width="2" marker-end="url(#a)"/><line x1="142" y1="185" x2="218" y2="140" stroke="#1b2a4b" stroke-width="2" marker-end="url(#a)"/>
  <text x="180" y="134" font-size="10.5" fill="#475569" text-anchor="middle">https://qb.your-domain</text>
  <rect x="220" y="80" width="170" height="100" rx="12" fill="#fff7ed" stroke="#c08a2e" stroke-width="2"/><text x="305" y="108" text-anchor="middle" font-weight="700">Cloudflare</text><text x="305" y="128" text-anchor="middle" font-size="11">trusted HTTPS certificate</text><text x="305" y="146" text-anchor="middle" font-size="11">fixed address</text><text x="305" y="164" text-anchor="middle" font-size="11">blocks attacks · free</text>
  <line x1="470" y1="130" x2="393" y2="130" stroke="#c08a2e" stroke-width="2.5" marker-end="url(#g)"/><text x="432" y="118" text-anchor="middle" font-size="10.5" fill="#9a3412">tunnel</text><text x="432" y="150" text-anchor="middle" font-size="9.5" fill="#9a3412">outgoing only</text>
  <rect x="472" y="10" width="278" height="310" rx="14" fill="#f8fafc" stroke="#1b2a4b" stroke-width="2"/><text x="611" y="34" text-anchor="middle" font-weight="700">SKANS Windows Server</text>
  <rect x="490" y="48" width="242" height="40" rx="8" fill="#fff" stroke="#c08a2e"/><text x="611" y="73" text-anchor="middle"><tspan font-weight="700">cloudflared</tspan> service</text>
  <line x1="611" y1="90" x2="611" y2="106" stroke="#1b2a4b" stroke-width="2" marker-end="url(#a)"/>
  <rect x="490" y="108" width="242" height="54" rx="8" fill="#fff" stroke="#1b2a4b"/><text x="611" y="130" text-anchor="middle"><tspan font-weight="700">SKANS-QB</tspan> service (Node.js)</text><text x="611" y="149" text-anchor="middle" font-size="11" fill="#475569">React website + API + PDFs · localhost:4000</text>
  <line x1="611" y1="164" x2="611" y2="180" stroke="#1b2a4b" stroke-width="2" marker-end="url(#a)"/>
  <rect x="490" y="182" width="242" height="40" rx="8" fill="#fff" stroke="#1b2a4b"/><text x="611" y="207" text-anchor="middle"><tspan font-weight="700">PostgreSQL 17</tspan> service · private</text>
  <line x1="611" y1="224" x2="611" y2="240" stroke="#059669" stroke-width="2" marker-end="url(#a)"/>
  <rect x="490" y="242" width="242" height="62" rx="8" fill="#ecfdf5" stroke="#059669"/><text x="611" y="264" text-anchor="middle" font-weight="700">Nightly backup (Task Scheduler)</text><text x="611" y="283" text-anchor="middle" font-size="11">D:\\SKANS\\backups + second copy</text><text x="611" y="298" text-anchor="middle" font-size="11">(NAS / second disk)</text>
</svg>`;

  const svgPlanB = `
<svg viewBox="0 0 760 210" xmlns="http://www.w3.org/2000/svg" font-family="Segoe UI, Arial" font-size="12.5">
  <defs><marker id="b" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0L10 5L0 10z" fill="#1b2a4b"/></marker></defs>
  <rect x="10" y="20" width="140" height="70" rx="10" fill="#eef2ff" stroke="#1b2a4b"/><text x="80" y="50" text-anchor="middle" font-weight="700">Staff on campus</text><text x="80" y="70" text-anchor="middle" font-size="11">https://qb.skans.local</text>
  <rect x="10" y="120" width="140" height="70" rx="10" fill="#eef2ff" stroke="#1b2a4b"/><text x="80" y="150" text-anchor="middle" font-weight="700">Staff at home</text><text x="80" y="170" text-anchor="middle" font-size="11">connect school VPN first</text>
  <line x1="152" y1="55" x2="300" y2="95" stroke="#1b2a4b" stroke-width="2" marker-end="url(#b)"/><line x1="152" y1="155" x2="300" y2="115" stroke="#1b2a4b" stroke-width="2" marker-end="url(#b)"/>
  <rect x="302" y="10" width="448" height="190" rx="14" fill="#f8fafc" stroke="#1b2a4b" stroke-width="2"/><text x="526" y="34" text-anchor="middle" font-weight="700">SKANS Windows Server (campus network only)</text>
  <rect x="320" y="60" width="130" height="80" rx="8" fill="#fff" stroke="#c08a2e"/><text x="385" y="88" text-anchor="middle" font-weight="700">Caddy</text><text x="385" y="106" text-anchor="middle" font-size="11">HTTPS on 443</text><text x="385" y="122" text-anchor="middle" font-size="11">internal certificate</text>
  <line x1="452" y1="100" x2="476" y2="100" stroke="#1b2a4b" stroke-width="2" marker-end="url(#b)"/>
  <rect x="478" y="60" width="130" height="80" rx="8" fill="#fff" stroke="#1b2a4b"/><text x="543" y="92" text-anchor="middle" font-weight="700">SKANS-QB</text><text x="543" y="110" text-anchor="middle" font-size="11">localhost:4000</text>
  <line x1="610" y1="100" x2="626" y2="100" stroke="#1b2a4b" stroke-width="2" marker-end="url(#b)"/>
  <rect x="628" y="60" width="110" height="80" rx="8" fill="#fff" stroke="#1b2a4b"/><text x="683" y="96" text-anchor="middle" font-weight="700">PostgreSQL</text><text x="683" y="114" text-anchor="middle" font-size="11">private</text>
  <text x="526" y="175" text-anchor="middle" font-size="11" fill="#475569">Every staff PC must trust the SKANS root certificate once (IT can push it with Group Policy).</text>
</svg>`;

  const svgPhases = `
<svg viewBox="0 0 760 92" xmlns="http://www.w3.org/2000/svg" font-family="Segoe UI, Arial" font-size="11">
  ${['Ask SKANS', 'Prepare server', 'Install software', 'Install app', 'Run as service', 'HTTPS & access', 'Backups', 'Go live']
    .map((t, i) => {
      const x = 6 + i * 94;
      return `<rect x="${x}" y="14" width="88" height="62" rx="8" fill="${i === 0 ? '#fff7ed' : i < 7 ? '#f8fafc' : '#ecfdf5'}" stroke="${i === 7 ? '#059669' : '#1b2a4b'}"/><text x="${x + 44}" y="38" text-anchor="middle" font-weight="700" fill="#c08a2e">${i}</text><text x="${x + 44}" y="58" text-anchor="middle">${t}</text>`;
    })
    .join('')}
</svg>`;

  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Server Setup Guide</title>
<style>
  *{box-sizing:border-box}
  body{font-family:'Segoe UI',Arial,sans-serif;color:#1f2937;font-size:10.3pt;line-height:1.5;margin:0}
  .cover{height:250mm;display:flex;flex-direction:column;justify-content:center;padding:0 8mm;break-after:page}
  .cover img{width:62mm;margin-bottom:16mm}
  .cover h1{font-size:27pt;color:#1b2a4b;margin:0;line-height:1.12}
  .cover .sub{font-size:13.5pt;color:#c08a2e;margin:4mm 0 8mm;font-weight:600}
  .cover p{color:#475569;margin:1mm 0}
  .bar{width:22mm;height:2mm;background:#c08a2e;border-radius:1mm;margin-bottom:8mm}
  .toc{break-after:page} .toc ol{list-style:none;padding:0;margin:0} .toc li{padding:.9mm 0;border-bottom:.3mm dotted #cbd5e1}
  .toc li.grp{border:0;padding-top:3mm;color:#c08a2e;font-weight:700;text-transform:uppercase;font-size:8.8pt;letter-spacing:.05em}
  h1.chap{break-before:page;font-size:17pt;color:#fff;background:#1b2a4b;padding:4.5mm 6mm;border-radius:3mm;margin:0 0 5mm}
  h2{font-size:13.5pt;color:#1b2a4b;border-bottom:.5mm solid #e2e8f0;padding-bottom:1.5mm;margin:6mm 0 3mm;break-after:avoid}
  h3{font-size:11pt;color:#1b2a4b;margin:4mm 0 1.5mm;break-after:avoid}
  p{margin:0 0 2.5mm}
  ol.steps{padding-left:6mm;margin:0 0 3mm} ol.steps li{margin-bottom:1.3mm} ol.steps li::marker{color:#c08a2e;font-weight:700}
  ul{padding-left:6mm;margin:0 0 3mm} ul li{margin-bottom:1mm} ul.check{list-style:none;padding-left:1mm}
  code{font-family:Consolas,'Cascadia Mono',monospace;background:#f1f5f9;border-radius:1mm;padding:0 1mm;font-size:9.2pt}
  .term{background:#0f172a;border-radius:2.5mm;margin:2mm 0 3.5mm;break-inside:avoid;overflow:hidden}
  .term-bar{background:#1e293b;padding:1.4mm 3mm;display:flex;gap:1.5mm;align-items:center}
  .term-bar span{width:2.5mm;height:2.5mm;border-radius:50%;background:#f87171}.term-bar span:nth-child(2){background:#fbbf24}.term-bar span:nth-child(3){background:#34d399}
  .term-bar em{color:#94a3b8;font-style:normal;font-size:8.3pt;margin-left:2mm}
  .term pre{margin:0;padding:2.8mm 4mm;color:#e2e8f0;font-family:Consolas,'Cascadia Mono',monospace;font-size:8.6pt;white-space:pre-wrap;word-break:break-word;line-height:1.45}
  .term .c{color:#64748b} .term .y{color:#fbbf24} .term .g{color:#4ade80}
  table{width:100%;border-collapse:collapse;margin:2mm 0 4mm;font-size:9.1pt;break-inside:avoid}
  tr{break-inside:avoid}
  th{background:#1b2a4b;color:#fff;text-align:left;padding:1.5mm 2.2mm;vertical-align:top}
  td{border-bottom:.3mm solid #e2e8f0;padding:1.5mm 2.2mm;vertical-align:top}
  table.mini{margin:1mm 0 0;font-size:8.8pt} table.mini td{border-bottom:.3mm solid #fde2e2;padding:1.1mm 1.6mm} table.mini td:first-child{width:38%;font-weight:600}
  .box{border-radius:2.5mm;padding:2.3mm 3.5mm;margin:2mm 0 3.5mm;font-size:9.4pt;break-inside:avoid}
  .box>b:first-child{display:block;margin-bottom:.6mm}
  .tip{background:#ecfdf5;border-left:1.2mm solid #059669} .warn{background:#fffbeb;border-left:1.2mm solid #d97706}
  .info{background:#eff6ff;border-left:1.2mm solid #2563eb} .ok{background:#f0fdf4;border-left:1.2mm solid #16a34a}
  .prob{background:#fef2f2;border-left:1.2mm solid #dc2626}
  figure{margin:2mm 0 4.5mm;break-inside:avoid} figure svg{width:100%;height:auto;display:block}
  figcaption{font-size:8.4pt;color:#64748b;text-align:center;margin-top:1.4mm}
  .phase{display:inline-block;background:#c08a2e;color:#fff;font-weight:700;border-radius:2mm;padding:.8mm 2.5mm;margin:1mm 0 1mm;font-size:9.4pt}
  .phase span{background:#1b2a4b;border-radius:1.5mm;padding:.2mm 1.6mm;margin-right:2mm}
  .fill td{height:7.5mm}
</style></head><body>

<div class="cover">
  <img src="${images.logo}" alt="SKANS School of Accountancy">
  <div class="bar"></div>
  <h1>SKANS Question Bank<br>Server Setup Guide</h1>
  <div class="sub">Windows Server · step by step · for first-time deployers</div>
  <p>What to package, what to ask SKANS IT, every command, and what to do when a step fails</p>
  <p>Covers: Node.js service, PostgreSQL, HTTPS, campus + home access, backups, updates</p>
  <p style="margin-top:8mm">October 2026</p>
</div>

<div class="toc"><h2>Contents</h2><ol>
  <li class="grp">Before you start</li><li>1. The big picture (and where React fits)</li><li>2. Choose the access plan (domain or no domain)</li><li>3. What to ask SKANS IT</li><li>4. What to package (the zip)</li>
  <li class="grp">Installation</li><li>5. Phase 1: prepare the server</li><li>6. Phase 2: install the software</li><li>7. Phase 3: create the database</li><li>8. Phase 4: install the app</li><li>9. Phase 5: run it as a Windows service</li><li>10. Phase 6A: HTTPS + home access with Cloudflare (recommended)</li><li>11. Phase 6B: campus-only HTTPS with Caddy (no domain)</li><li>12. Phase 7: backups</li><li>13. Phase 8: go live</li>
  <li class="grp">After go-live</li><li>14. Installing a new version (and rolling back)</li><li>15. Routine maintenance</li><li>16. Troubleshooting</li><li>17. How to ask for help</li>
  <li class="grp">Appendices</li><li>A. Email to SKANS IT</li><li>B. Record sheet (fill in and keep safe)</li><li>C. Command cheat sheet</li><li>D. Glossary</li>
</ol>
<h3 style="margin-top:6mm">The road map</h3>
${figure(svgPhases, 'Eight phases. Plan one working day for phases 1 to 7, after SKANS IT has prepared the server.')}
</div>

<!-- ============================================================ BEFORE -->
<h1 class="chap">Before you start</h1>
<h2>1. The big picture (and where React fits)</h2>
<p>The SKANS Question Bank has three parts. On the server they become <b>three Windows services</b> that start by themselves whenever the server starts:</p>
<table><tr><th>Part</th><th>What it is</th><th>On the server</th></tr>
<tr><td><b>Website (React)</b></td><td>The screens teachers use. React code is turned into plain web files (HTML, CSS, JavaScript) by <code>npm run build</code>.</td><td>Files in <code>client\\dist</code>. <b>No separate hosting needed</b>: the Node.js app serves them.</td></tr>
<tr><td><b>Server / API (Node.js)</b></td><td>The rules, logins, PDF making (with a built-in Chromium browser).</td><td>Service <b>SKANS-QB</b> on <code>localhost:4000</code></td></tr>
<tr><td><b>Database (PostgreSQL)</b></td><td>All questions, papers, users, history.</td><td>Service <b>postgresql-x64-17</b>, private to the server</td></tr></table>
<p>Two more pieces make it safe and reachable: <b>HTTPS</b> (the padlock, required for secure logins) and <b>nightly backups</b>.</p>
${figure(svgPlanA, 'Plan A (recommended): one fixed HTTPS address for campus and home, through a Cloudflare tunnel. No firewall ports are opened.')}

<h2>2. Choose the access plan</h2>
<p>The system uses <b>secure cookies</b> in production: <b>logins only work over HTTPS</b>. Getting HTTPS needs either a domain name or an internal certificate. Choose one plan with SKANS:</p>
<table><tr><th></th><th>Plan A: Cloudflare + a domain (recommended)</th><th>Plan B: campus only, no domain</th></tr>
<tr><td><b>Address</b></td><td><code>https://qb.your-domain.com</code></td><td><code>https://qb.skans.local</code> (inside SKANS only)</td></tr>
<tr><td><b>From home</b></td><td>Yes, directly</td><td>Only through the school VPN (if SKANS has one)</td></tr>
<tr><td><b>Padlock / trusted</b></td><td>Trusted everywhere automatically</td><td>Each staff PC must trust the SKANS certificate once (IT can do it centrally)</td></tr>
<tr><td><b>Firewall changes</b></td><td>None (outgoing connection only)</td><td>Allow port 443 from the campus network</td></tr>
<tr><td><b>Cost</b></td><td>Domain about 10 US dollars a year; Cloudflare free</td><td>Free</td></tr>
<tr><td><b>Needs internet</b></td><td>Yes, also for campus users</td><td>No (campus network only)</td></tr>
<tr><td><b>Difficulty</b></td><td>Easy</td><td>Medium (certificates, DNS)</td></tr></table>
<h3>Ways to get a domain for Plan A</h3>
<ul>
<li><b>Ask SKANS</b>: if SKANS already has a website, its owner or web company can create a subdomain such as <code>qb.skans-website.com</code>. For Plan A the domain's DNS must be managed in Cloudflare (or the subdomain delegated to Cloudflare by the web company).</li>
<li><b>Buy a new one</b>: for example at Cloudflare Registrar (sold at cost, about 10 US dollars a year for <code>.com</code>). It is then automatically on Cloudflare.</li>
</ul>
${tip('If the decision takes time, you can start with phases 1 to 5 and 7. Only phase 6 depends on the plan.')}

<h2>3. What to ask SKANS IT</h2>
<p>Send this list (a ready email is in Appendix A). Tick each item when you have it.</p>
<table><tr><th style="width:5%">✓</th><th style="width:33%">Item</th><th>Details / why</th></tr>
<tr><td>☐</td><td><b>A server</b> (physical or virtual)</td><td>Minimum 4 CPU cores, 8 GB RAM, 60 GB SSD. Recommended 16 GB RAM. PDF making uses about 0.5 GB per paper being printed.</td></tr>
<tr><td>☐</td><td><b>Windows Server</b> 2019, 2022 or 2025</td><td>With the latest updates. A normal Windows 10/11 Pro PC that never sleeps also works.</td></tr>
<tr><td>☐</td><td><b>A local administrator account</b></td><td>Needed to install software and services.</td></tr>
<tr><td>☐</td><td><b>Remote Desktop</b> access (or console)</td><td>To work on the server from your laptop.</td></tr>
<tr><td>☐</td><td><b>Fixed internal IP address</b> and a computer name</td><td>So the address never changes, e.g. <code>192.168.1.50</code>, name <code>SKANS-QB</code>.</td></tr>
<tr><td>☐</td><td><b>Outgoing internet</b></td><td>To download software. Plan A also needs outgoing TCP 443 and port 7844 (TCP and UDP) for the Cloudflare tunnel.</td></tr>
<tr><td>☐</td><td><b>A data disk</b> (e.g. drive <code>D:</code>)</td><td>For the app, database and backups (C: is fine if there is no second disk).</td></tr>
<tr><td>☐</td><td><b>A second place for backups</b></td><td>A NAS / shared folder or a second disk, writable by the server. If the server dies, the backups must survive.</td></tr>
<tr><td>☐</td><td><b>UPS / power protection</b></td><td>Power cuts can damage databases.</td></tr>
<tr><td>☐</td><td><b>Antivirus exclusions</b></td><td>For <code>D:\\SKANS</code> and the PostgreSQL data folder, so scanning does not slow down or lock the database.</td></tr>
<tr><td>☐</td><td><b>Plan A</b>: a domain or subdomain on Cloudflare</td><td>See section 2.</td></tr>
<tr><td>☐</td><td><b>Plan B</b>: DNS name, firewall rule, certificate push, VPN</td><td>Internal DNS name <code>qb.skans.local</code> → server IP; allow inbound 443 from the campus network; deploy the root certificate to staff PCs (Group Policy); VPN for home access.</td></tr>
<tr><td>☐</td><td><b>A contact person</b> and a <b>maintenance time</b></td><td>Who to call; when updates and restarts are allowed (e.g. Sunday evening).</td></tr></table>

<h2>4. What to package (the zip)</h2>
<p>On <b>your laptop</b>, in the project folder, run:</p>
${cmd('npm run release', 'PowerShell on your laptop (project folder)')}
${out(`[release] ...\\output\\release\\skans-question-bank-20261023-1e53251.zip
[release] 109 files, 0.6 MB, commit 1e53251
[release] SHA-256 e5dbb305db7e...`)}
<p>It creates <code>output\\release\\skans-question-bank-&lt;date&gt;-&lt;version&gt;.zip</code> and a <code>.sha256</code> file with its fingerprint. Copy <b>both</b> to the server (USB stick, OneDrive, or copy-paste through Remote Desktop).</p>
<table><tr><th>In the zip (needed)</th><th>NOT in the zip (on purpose)</th></tr>
<tr><td>Source code of client (React), server and shared<br>Database migrations and the setup (seed) script<br>Logos (<code>client\\public\\branding</code>)<br>Scripts: backups, restore, service helpers<br>README, docs (setup guide), examples of settings files</td><td><code>node_modules</code> (installed on the server with <code>npm ci</code>)<br><code>client\\dist</code> (built on the server)<br><code>.env</code>, <code>.env.beta</code> (passwords; you create a new one)<br>Databases, backups, logs<br>The ICAP sample papers (<code>samples\\</code>)</td></tr></table>
${verified('The zip was installed into an empty folder exactly as described in phases 3 and 4: install, database setup, build, production start, PDF making, backup and restore all worked.')}
${warn('Commit your changes before <code>npm run release</code>. Only committed work goes into the zip; the command warns you if something is not committed.')}
${problem([['"git" is not recognized', 'Install Git for Windows (<code>winget install Git.Git</code>), reopen PowerShell.'], ['Warning: changes not committed', 'Commit them (or ask the developer), then run the command again.']])}

<!-- ============================================================ INSTALL -->
<h1 class="chap">Installation</h1>
${phase(1, 'Prepare the server')}
<h2>5. Phase 1: prepare the server</h2>
<h3>5.1 Connect with Remote Desktop</h3>
${steps(['On your laptop press <b>Windows + R</b>, type <code>mstsc</code>, press Enter.', 'Computer: the server IP (e.g. <code>192.168.1.50</code>). Click Connect and sign in with the administrator account from IT.', 'On the server, open <b>PowerShell as Administrator</b>: Start → type <code>PowerShell</code> → right-click → <b>Run as administrator</b>. All commands in this guide are typed there.'])}
<h3>5.2 Basic settings</h3>
${cmd(`<span class="c"># time zone (papers and backups use the server's clock)</span>
Set-TimeZone -Id "Pakistan Standard Time"

<span class="c"># never sleep, high performance</span>
powercfg /change standby-timeout-ac 0
powercfg /change hibernate-timeout-ac 0
powercfg /setactive SCHEME_MIN

<span class="c"># folders for everything (use C: instead of D: if there is no D: drive)</span>
New-Item -ItemType Directory -Force D:\\SKANS\\app, D:\\SKANS\\backups, D:\\SKANS\\logs, D:\\SKANS\\ms-playwright, D:\\SKANS\\tools`)}
<p>Then run <b>Windows Update</b> (Settings → Windows Update → Check for updates) and restart once.</p>
${problem([['Remote Desktop: "cannot connect"', 'Ask IT to enable Remote Desktop and allow your laptop through the firewall or VPN.'], ['"Access is denied" in PowerShell', 'PowerShell was not opened "as administrator".'], ['Drive D: does not exist', 'Use <code>C:\\SKANS\\...</code> everywhere in this guide instead.']])}

${phase(2, 'Install the software')}
<h2>6. Phase 2: install the software</h2>
<p>Windows Server 2025 and Windows 10/11 include <b>winget</b>. On Windows Server 2019/2022 winget is often missing: use the download links instead (always choose the 64-bit Windows installer).</p>
<table><tr><th>Software</th><th>With winget</th><th>Without winget (download)</th></tr>
<tr><td><b>Node.js LTS</b> (24 or newer; runs the app)</td><td><code>winget install OpenJS.NodeJS.LTS</code></td><td>nodejs.org → Download → Windows Installer (.msi)</td></tr>
<tr><td><b>PostgreSQL 17</b> (database)</td><td><code>winget install PostgreSQL.PostgreSQL.17</code></td><td>postgresql.org → Download → Windows → EDB installer</td></tr>
<tr><td><b>NSSM</b> (turns the app into a service)</td><td><code>winget install NSSM.NSSM</code></td><td>nssm.cc → download zip → copy <code>win64\\nssm.exe</code> to <code>D:\\SKANS\\tools</code></td></tr>
<tr><td><b>cloudflared</b> (Plan A only)</td><td><code>winget install Cloudflare.cloudflared</code></td><td>github.com/cloudflare/cloudflared/releases → <code>cloudflared-windows-amd64.msi</code></td></tr>
<tr><td><b>Caddy</b> (Plan B only)</td><td><code>winget install CaddyServer.Caddy</code></td><td>caddyserver.com/download → Windows amd64 → save as <code>D:\\SKANS\\tools\\caddy.exe</code></td></tr></table>
<h3>PostgreSQL installer choices</h3>
${steps(['Components: keep <b>PostgreSQL Server</b> and <b>Command Line Tools</b>; untick Stack Builder (pgAdmin is optional).', 'Data directory: default, or <code>D:\\SKANS\\pgdata</code> if IT prefers the data disk.', 'Password for the <b>postgres</b> superuser: create a strong one and write it on the record sheet (Appendix B).', 'Port <b>5432</b>, locale <b>Default</b>. Finish.'])}
<p>Close PowerShell, open it again <b>as Administrator</b>, and check:</p>
${cmd(`node --version
npm --version
& "C:\\Program Files\\PostgreSQL\\17\\bin\\psql.exe" --version
Get-Service postgresql*`)}
${out(`v24.x.x
10.x.x
psql (PostgreSQL) 17.x
Status   Name               DisplayName
Running  postgresql-x64-17  postgresql-x64-17 - PostgreSQL Server 17`)}
${problem([['"node" is not recognized', 'Close and reopen PowerShell (new programs are only found in new windows). Still missing: reinstall Node.js and keep "Add to PATH" ticked.'], ['winget is not recognized', 'Use the download links in the table above.'], ['PostgreSQL installer fails at the end', 'Usually antivirus or a non-English Windows account name. Ask IT to allow the installer; install again.'], ['postgresql service is "Stopped"', '<code>Start-Service postgresql-x64-17</code>. If it fails: Event Viewer → Windows Logs → Application → PostgreSQL errors.']])}

${phase(3, 'Create the database')}
<h2>7. Phase 3: create the database</h2>
<p>First make a strong password for the app's own database user (not the postgres superuser):</p>
${cmd(`<span class="c"># prints a random 24-character password: write it on the record sheet</span>
-join ((48..57)+(65..90)+(97..122) | Get-Random -Count 24 | ForEach-Object {[char]$_})`)}
<p>Then create the user <b>skans</b> and the database <b>skans_qb</b> (replace the password; PostgreSQL asks for the <b>postgres</b> password first):</p>
${cmd(`& "C:\\Program Files\\PostgreSQL\\17\\bin\\psql.exe" -U postgres -h localhost
<span class="c"># then, inside psql, type these two lines and press Enter after each:</span>
CREATE ROLE skans LOGIN PASSWORD '<span class="y">THE-APP-PASSWORD</span>';
CREATE DATABASE skans_qb OWNER skans ENCODING 'UTF8' TEMPLATE template0;
\\q`)}
${verified('These commands created the development and test databases on 23 October 2026.')}
${info('PostgreSQL only listens on this server (<code>localhost</code>) by default. Keep it that way: nobody needs to reach the database over the network.')}
${problem([['password authentication failed for user "postgres"', 'Wrong superuser password. If lost, ask IT; it can be reset by editing <code>pg_hba.conf</code> (advanced).'], ['role "skans" already exists', 'It was created before. Continue, or change its password: <code>ALTER ROLE skans PASSWORD \'...\';</code>'], ['psql: command not found', 'Use the full path shown above, in quotes, with &amp; in front.']])}

${phase(4, 'Install the app')}
<h2>8. Phase 4: install the app</h2>
<h3>8.1 Check and unzip the package</h3>
${cmd(`<span class="c"># compare with the SHA-256 printed by npm run release</span>
Get-FileHash D:\\SKANS\\skans-question-bank-20261023-1e53251.zip -Algorithm SHA256

Expand-Archive D:\\SKANS\\skans-question-bank-20261023-1e53251.zip -DestinationPath D:\\SKANS\\tmp
Move-Item D:\\SKANS\\tmp\\skans-question-bank-*\\* D:\\SKANS\\app
Remove-Item D:\\SKANS\\tmp -Recurse`)}
<h3>8.2 Tell the PDF engine where to live</h3>
<p>The service runs as the <b>SYSTEM</b> account, which cannot see your personal folders. Put the built-in Chromium (used for PDFs) in a shared folder for everyone:</p>
${cmd(`[Environment]::SetEnvironmentVariable("PLAYWRIGHT_BROWSERS_PATH", "D:\\SKANS\\ms-playwright", "Machine")
<span class="c"># close PowerShell and open it again as Administrator, then:</span>
$env:PLAYWRIGHT_BROWSERS_PATH`)}
${out('D:\\SKANS\\ms-playwright')}
<h3>8.3 Install the libraries and Chromium</h3>
${cmd(`cd D:\\SKANS\\app
npm ci
npm run browsers -w server`)}
${out(`added 512 packages in 2m
Chromium ... downloaded to D:\\SKANS\\ms-playwright\\chromium-1248`)}
<h3>8.4 Create the settings file</h3>
${cmd(`copy server\\.env.production.example server\\.env
<span class="c"># a new secret for signing logins (copy the output)</span>
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
notepad server\\.env`)}
<p>In Notepad set these lines (keep the others), then save:</p>
${file(`NODE_ENV=production
PORT=4000
TRUST_PROXY=1
DATABASE_URL="postgresql://skans:<span class="y">THE-APP-PASSWORD</span>@127.0.0.1:5432/skans_qb?schema=public"
SESSION_SECRET=<span class="y">THE-LONG-SECRET-FROM-ABOVE</span>
CLIENT_ORIGIN=https://<span class="y">qb.your-domain.com</span>
BACKUP_DIR=D:/SKANS/backups
BACKUP_KEEP_DAILY=14
BACKUP_KEEP_MONTHLY=6
BACKUP_COPY_DIR=<span class="y">\\\\NAS\\skans-backups</span>
PG_BIN=C:/Program Files/PostgreSQL/17/bin
BRANDING_DIR=../client/public/branding`, 'server\\.env (Notepad)')}
<p><code>BACKUP_COPY_DIR</code> is the second backup place from IT (a share or another disk). Delete that line if there is none yet.</p>
${warn('This file holds passwords. Never email it, never put it in the zip, and keep a copy only in a password manager or on the record sheet.')}
<h3>8.5 Create the tables, first admin and build the website</h3>
${cmd(`npm run db:setup -w server
npm run build`)}
${out(`All migrations have been successfully applied.
[seed] 8 CAF papers (CAF 1-8) and the SKANS CAF Examination format present.
[seed] Administrator account created:
         username: admin
         password: <span class="y">Xk3...(shown only once)</span>
✓ built in 20s`)}
${warn('Write the admin password on the record sheet <b>now</b>. It is shown only once. (If lost: <code>npm run reset-admin -w server -- admin NewPassword123</code>, see section 16.)')}
<h3>8.6 Quick test</h3>
${cmd(`cd D:\\SKANS\\app\\server
npm start
<span class="c"># in a second PowerShell window:</span>
Invoke-WebRequest http://localhost:4000/api/health -UseBasicParsing | Select-Object -Expand Content`)}
${out(`[server] SKANS Question Bank API listening on http://localhost:4000 (production)
{"ok":true}`)}
<p>Stop the test with <b>Ctrl + C</b> in the first window. (Signing in is tested after HTTPS in phase 6: in production, logins need HTTPS.)</p>
${verified()}
${problem([['npm ci: "EPERM" or "operation not permitted"', 'Antivirus or an open program locks files. Close other windows, add the antivirus exclusion for D:\\SKANS, run again.'], ['npm ci: network / proxy errors', 'The server has no internet or uses a proxy. Ask IT; for a proxy: <code>npm config set proxy http://proxy:port</code> and <code>https-proxy</code>.'], ['browsers: download fails', 'Same network issue. Or install on another PC with the same PLAYWRIGHT_BROWSERS_PATH and copy the folder over.'], ['db:setup: "password authentication failed"', 'The password in DATABASE_URL is not the one from phase 3. Special characters (@ : / #) in the password must be avoided or URL-encoded.'], ['db:setup: "database skans_qb does not exist"', 'Repeat phase 3.'], ['Invalid server environment configuration', 'A line in .env is missing or wrong; the message names it (e.g. SESSION_SECRET too short).'], ['Port 4000 already in use', '<code>netstat -ano | findstr :4000</code> → <code>taskkill /PID &lt;number&gt; /F</code>, or set another PORT.']])}

${phase(5, 'Run it as a Windows service')}
<h2>9. Phase 5: run the app as a Windows service</h2>
<p>A service starts automatically with Windows, runs without anyone signed in, and restarts if it crashes. <b>NSSM</b> turns the app into a service. If you installed NSSM with winget, use <code>nssm</code>; if you downloaded it, use <code>D:\\SKANS\\tools\\nssm.exe</code>.</p>
${cmd(`nssm install SKANS-QB "C:\\Program Files\\nodejs\\node.exe" "D:\\SKANS\\app\\node_modules\\tsx\\dist\\cli.mjs" src/index.ts
nssm set SKANS-QB AppDirectory D:\\SKANS\\app\\server
nssm set SKANS-QB AppEnvironmentExtra NODE_ENV=production PLAYWRIGHT_BROWSERS_PATH=D:\\SKANS\\ms-playwright
nssm set SKANS-QB DisplayName "SKANS Question Bank"
nssm set SKANS-QB Start SERVICE_DELAYED_AUTO_START
nssm set SKANS-QB DependOnService postgresql-x64-17
nssm set SKANS-QB AppExit Default Restart
nssm set SKANS-QB AppStdout D:\\SKANS\\logs\\app.log
nssm set SKANS-QB AppStderr D:\\SKANS\\logs\\app.log
nssm set SKANS-QB AppRotateFiles 1
nssm set SKANS-QB AppRotateBytes 10485760
nssm start SKANS-QB
Get-Service SKANS-QB`)}
${out(`SKANS-QB: START: The operation completed successfully.
Status   Name      DisplayName
Running  SKANS-QB  SKANS Question Bank`)}
<p>Check: <code>Invoke-WebRequest http://localhost:4000/api/health -UseBasicParsing</code> returns <code>{"ok":true}</code>, and <code>D:\\SKANS\\logs\\app.log</code> shows "listening ... (production)".</p>
${info('"Delayed" start and "depends on PostgreSQL" make sure the database is running before the app starts after a reboot. Test it once: restart the server and check that both services are Running.')}
${tip('Everyday service commands: <code>nssm restart SKANS-QB</code>, <code>nssm stop SKANS-QB</code>, <code>nssm edit SKANS-QB</code> (opens a settings window). Or use Services (services.msc).')}
${problem([['Service starts, then stops ("Paused" or keeps restarting)', 'Open D:\\SKANS\\logs\\app.log; the last lines say why (same causes as in 8.6).'], ['PDF download fails, log says "Executable doesn\'t exist"', 'PLAYWRIGHT_BROWSERS_PATH is missing in the service: repeat the AppEnvironmentExtra line, run <code>npm run browsers -w server</code> again, <code>nssm restart SKANS-QB</code>.'], ['"nssm" is not recognized', 'Use the full path D:\\SKANS\\tools\\nssm.exe, or reopen PowerShell after winget.'], ['Service "already exists"', '<code>nssm remove SKANS-QB confirm</code>, then install again.']])}

${phase(6, 'HTTPS and access')}
<h2>10. Phase 6A: HTTPS and home access with Cloudflare (recommended)</h2>
<p>Needs: a free Cloudflare account and a domain on Cloudflare (section 2).</p>
${steps([
    'Sign in at <b>dash.cloudflare.com</b> (create a free account with a SKANS email). If the domain is new: <b>Add a domain</b> and follow the steps to change its nameservers at the seller (takes up to 24 hours).',
    'Left menu: <b>Zero Trust</b> (first time: choose the <b>Free</b> plan) → <b>Networks</b> → <b>Tunnels</b> → <b>Create a tunnel</b> → <b>Cloudflared</b>.',
    'Name: <code>skans-qb</code> → Save.',
    'Environment: <b>Windows</b>. Copy the command shown (it contains a long secret token) and run it in PowerShell as Administrator on the server. It installs the <b>cloudflared</b> service.',
    'Back in the browser the connector shows <b>Connected</b>. Click Next.',
    'Public hostname: Subdomain <code>qb</code>, Domain <code>your-domain.com</code>, Service Type <b>HTTP</b>, URL <code>localhost:4000</code>. Save.',
    'In <code>server\\.env</code> set <code>CLIENT_ORIGIN=https://qb.your-domain.com</code>, then <code>nssm restart SKANS-QB</code>.',
    'Open <code>https://qb.your-domain.com</code> on a phone using mobile data and on a campus PC. Sign in as <b>admin</b> with the one-time password and choose a new one.',
  ])}
${cmd('cloudflared.exe service install eyJhIjoi...(token from the dashboard)...', 'PowerShell (as Administrator) - command copied from Cloudflare')}
${warn('The token is a password for the tunnel. If it leaks: delete the tunnel in the dashboard and create a new one.')}
<h3>Optional: allow only SKANS emails (Cloudflare Access, free up to 50 users)</h3>
<p>Zero Trust → <b>Access</b> → <b>Applications</b> → Add → <b>Self-hosted</b> → domain <code>qb.your-domain.com</code> → policy <b>Allow</b>, Include <b>Emails ending in</b> <code>@skans-domain</code> (or a list of emails) → login method <b>One-time PIN</b>. Visitors must prove their email before they even see the sign-in page.</p>
${problem([['Browser shows Cloudflare "Error 1033"', 'The cloudflared service is not running: <code>Get-Service cloudflared</code>, <code>Start-Service cloudflared</code>.'], ['"502 Bad Gateway"', 'Tunnel works but the app is not running on 4000: <code>Get-Service SKANS-QB</code>, check app.log.'], ['Connector never shows "Connected"', 'The server blocks outgoing port 7844. Ask IT to allow outgoing TCP/UDP 7844 (or 443).'], ['Sign-in works, but you are sent back to the sign-in page', 'TRUST_PROXY=1 or NODE_ENV=production missing in .env; restart the service.'], ['The domain does not open at all', 'Nameserver change not finished (wait up to 24 h); check the Public hostname spelling.']])}

<h2>11. Phase 6B: campus-only HTTPS with Caddy (no domain)</h2>
${figure(svgPlanB, 'Plan B: HTTPS inside the campus network with a SKANS-issued certificate; home users connect through the VPN.')}
${info('Why Caddy and not Nginx? Nginx for Windows is officially marked "beta" by its makers and is meant for Linux servers. Caddy is a single program that runs well on Windows and creates the HTTPS certificate by itself.')}
${steps(['Ask IT for a DNS name in the school network: <code>qb.skans.local</code> → the server IP (or, for a quick test, add it to <code>C:\\Windows\\System32\\drivers\\etc\\hosts</code> on a PC).', 'Create the file below, then install Caddy as a service and open port 443 for the campus network.'])}
${file(`qb.skans.local {
    tls internal
    reverse_proxy 127.0.0.1:4000
}`, 'D:\\SKANS\\tools\\Caddyfile')}
${cmd(`nssm install Caddy "D:\\SKANS\\tools\\caddy.exe" run --config D:\\SKANS\\tools\\Caddyfile
nssm set Caddy Start SERVICE_AUTO_START
nssm set Caddy AppStdout D:\\SKANS\\logs\\caddy.log
nssm set Caddy AppStderr D:\\SKANS\\logs\\caddy.log
nssm start Caddy
New-NetFirewallRule -DisplayName "SKANS QB HTTPS" -Direction Inbound -Protocol TCP -LocalPort 443 -RemoteAddress LocalSubnet -Action Allow`)}
<h3>Make staff PCs trust the certificate (once)</h3>
<p>Caddy creates its own small certificate authority. Its root certificate must be trusted by every PC that opens the system. For a service running as SYSTEM it is stored in:</p>
${file('C:\\Windows\\System32\\config\\systemprofile\\AppData\\Roaming\\Caddy\\pki\\authorities\\local\\root.crt', 'Root certificate location')}
<p>Give <code>root.crt</code> to IT to deploy with <b>Group Policy</b> (Trusted Root Certification Authorities), or on a single PC: double-click it → Install Certificate → Local Machine → "Trusted Root Certification Authorities". Then <code>https://qb.skans.local</code> shows the padlock. Set <code>CLIENT_ORIGIN=https://qb.skans.local</code> in .env and restart SKANS-QB.</p>
${problem([['Browser warning "Your connection is not private"', 'The PC does not trust root.crt yet (see above).'], ['Page does not open from other PCs', 'Firewall rule missing, or DNS name not set up: try https://SERVER-IP first.'], ['Caddy service stops', 'D:\\SKANS\\logs\\caddy.log; usually a typing error in the Caddyfile or port 443 used by IIS (stop IIS or ask IT).']])}

${phase(7, 'Backups')}
<h2>12. Phase 7: backups</h2>
<p>The settings from 8.4 (<code>BACKUP_DIR</code>, <code>BACKUP_COPY_DIR</code>, <code>PG_BIN</code>) are used by the backup commands. First test a backup by hand:</p>
${cmd(`cd D:\\SKANS\\app
npm run db:backup
npm run db:verify-backup`)}
${out(`[backup] D:\\SKANS\\backups\\skans-20261101-230000 (102 KB)
[backup] second copy saved in \\\\NAS\\skans-backups
Backup skans-20261101-230000 restores correctly. Rows (backup / live now): ...`)}
<p>Then schedule it: every night at 23:00, plus a weekly restore check, running as SYSTEM so nobody needs to be signed in:</p>
${cmd('powershell -ExecutionPolicy Bypass -File D:\\SKANS\\app\\server\\scripts\\schedule-backup.ps1 -System')}
${out(`Scheduled: 'SKANS QB - nightly backup' daily at 23:00 and 'SKANS QB - weekly check' on Sundays.
Log file: D:\\SKANS\\app\\server\\logs\\backup.log`)}
${verified('Backup, verify and a full restore into a throw-away database were tested on 23 October 2026; the scheduled task ran with result 0.')}
<h3>Restoring (if ever needed)</h3>
${cmd(`nssm stop SKANS-QB
cd D:\\SKANS\\app
npm run db:restore -- D:\\SKANS\\backups\\skans-20261101-230000 --yes
nssm start SKANS-QB`)}
${tip('Once a term, restore the newest backup on a spare PC to prove it works. Copy backups off the server regularly (NAS, second disk, or an external drive kept elsewhere).')}
${problem([['"pg_dump was not found"', 'PG_BIN in .env must point to C:/Program Files/PostgreSQL/17/bin.'], ['"could not copy to BACKUP_COPY_DIR"', 'The SYSTEM account cannot write to the share. Ask IT to give the server\'s computer account (SKANS-QB$) write access, or use a second disk.'], ['Task result is not 0', 'Read server\\logs\\backup.log (last lines).']])}

${phase(8, 'Go live')}
<h2>13. Phase 8: go live checklist</h2>
<ul class="check">
<li>☐ Restart the server once: SKANS-QB, PostgreSQL, cloudflared (or Caddy) all come back <b>Running</b>.</li>
<li>☐ Sign in as admin over HTTPS; change the one-time password; record it.</li>
<li>☐ Create real accounts: Users → Add user (teachers, Research Officers, admins) with subjects.</li>
<li>☐ Test each role once: write a question, submit, approve, build a small paper, download paper and answer key PDFs.</li>
<li>☐ Check Paper format (Reset to standard if unsure).</li>
<li>☐ Backup ran tonight (backup.log) and the weekly check passed.</li>
<li>☐ Send staff the address and the <b>User Guide</b> PDF.</li>
<li>☐ Stop the laptop beta (<code>beta.ps1 -Stop</code> and <code>-Uninstall</code>).</li>
</ul>

<!-- ============================================================ AFTER -->
<h1 class="chap">After go-live</h1>
<h2>14. Installing a new version (and rolling back)</h2>
<p>On your laptop: commit, then <code>npm run release</code>. Copy the new zip to <code>D:\\SKANS</code>. At a quiet time on the server:</p>
${cmd(`<span class="c"># 1. backup and stop</span>
cd D:\\SKANS\\app; npm run db:backup
nssm stop SKANS-QB

<span class="c"># 2. keep the old version for rollback, unpack the new one</span>
Rename-Item D:\\SKANS\\app D:\\SKANS\\app-old
Expand-Archive D:\\SKANS\\skans-question-bank-NEW.zip -DestinationPath D:\\SKANS\\tmp
Move-Item D:\\SKANS\\tmp\\skans-question-bank-*\\* D:\\SKANS\\app -Force; Remove-Item D:\\SKANS\\tmp -Recurse
copy D:\\SKANS\\app-old\\server\\.env D:\\SKANS\\app\\server\\.env

<span class="c"># 3. install, update the database, build, start</span>
cd D:\\SKANS\\app
npm ci
npm run browsers -w server
npm run db:setup -w server
npm run build
nssm start SKANS-QB`)}
<p>Check health, sign in, download one PDF. <code>db:setup</code> only adds what is new (migrations); it never deletes data.</p>
<h3>Rollback (if the new version has a problem)</h3>
${cmd(`nssm stop SKANS-QB
Rename-Item D:\\SKANS\\app D:\\SKANS\\app-broken
Rename-Item D:\\SKANS\\app-old D:\\SKANS\\app
nssm start SKANS-QB
<span class="c"># only if the new version changed the database and the old one fails: restore last night's backup (section 12)</span>`)}

<h2>15. Routine maintenance</h2>
<table><tr><th>When</th><th>What</th></tr>
<tr><td>Daily (1 min)</td><td>Open the system; glance at the dashboard. Problems reported by staff → section 16.</td></tr>
<tr><td>Weekly</td><td>backup.log shows nightly backups and "restores correctly" on Sunday. Disk space on D: above 20%.</td></tr>
<tr><td>Monthly</td><td>Windows Update + restart (in the maintenance time); check all services are Running afterwards. <code>winget upgrade --all</code> for cloudflared / Caddy / Node.js patch versions (then <code>nssm restart SKANS-QB</code>). Copy backups off-site.</td></tr>
<tr><td>Each term</td><td>Restore test on a spare PC. Review users: deactivate leavers. Check the audit log for unusual activity.</td></tr>
<tr><td>Yearly</td><td>Renew the domain (Plan A). Plan the next PostgreSQL/Node.js major version with the developer.</td></tr></table>

<h2>16. Troubleshooting</h2>
<table><tr><th>Problem</th><th>Check / fix</th></tr>
<tr><td>Nobody can open the site</td><td><code>Get-Service SKANS-QB, postgresql-x64-17, cloudflared</code> → all Running? Start the stopped one. Then D:\\SKANS\\logs\\app.log.</td></tr>
<tr><td>Site works on campus but not from home</td><td>Plan A: cloudflared service / outgoing 7844. Plan B: expected without VPN.</td></tr>
<tr><td>"Bad Gateway" / 502</td><td>App stopped or crashed: <code>nssm restart SKANS-QB</code>, read app.log.</td></tr>
<tr><td>Everyone is signed out after each click</td><td>.env: NODE_ENV=production and TRUST_PROXY=1; open via https only.</td></tr>
<tr><td>PDFs fail, everything else works</td><td>PLAYWRIGHT_BROWSERS_PATH (8.2 and the service); <code>npm run browsers -w server</code>; enough RAM.</td></tr>
<tr><td>Very slow</td><td>Task Manager: RAM/CPU; antivirus exclusions for D:\\SKANS and pgdata; more RAM.</td></tr>
<tr><td>Admin password lost</td><td>On the server: <code>cd D:\\SKANS\\app; npm run reset-admin -w server -- admin NewPassword123</code> (choose the new password: 10+ characters, a letter and a number). It also unlocks and re-activates the account.</td></tr>
<tr><td>A user is locked out</td><td>Wait 15 minutes, or admin → Users → Unlock.</td></tr>
<tr><td>Disk full</td><td>Old backups are cleaned automatically; check D:\\SKANS\\logs (rotated) and other files; ask IT for space.</td></tr>
<tr><td>After Windows Update the site is down</td><td>Services set to Automatic / Delayed? <code>Set-Service SKANS-QB -StartupType Automatic</code>; start them.</td></tr>
<tr><td>Database will not start</td><td>Event Viewer → Application. Disk full or power cut damage → restore the last backup (section 12).</td></tr></table>

<h2>17. How to ask for help</h2>
<p>Send the developer or IT these details, it saves a lot of time:</p>
${cmd(`Get-Service SKANS-QB, postgresql-x64-17, cloudflared, Caddy -ErrorAction SilentlyContinue
Get-Content D:\\SKANS\\logs\\app.log -Tail 50
Get-Content D:\\SKANS\\app\\server\\logs\\backup.log -Tail 20
Get-PSDrive D`)}
<p>Plus: what you did, what you expected, what happened, the time, and a screenshot. <b>Never send the .env file or passwords.</b></p>

<!-- ============================================================ APPENDICES -->
<h1 class="chap">Appendices</h1>
<h2>A. Email to SKANS IT</h2>
<div class="box info"><b>Subject: Server request for the SKANS Question Bank</b>
<p>Dear [Name],</p>
<p>We are ready to install the SKANS Question Bank (the system for writing exam questions and preparing CAF papers) on a SKANS server. Could you please arrange the following:</p>
<ol class="steps"><li>A Windows Server 2019/2022/2025 machine (physical or virtual) with at least 4 CPU cores, 8 GB RAM (16 GB preferred) and 60 GB SSD, fully updated.</li>
<li>A local administrator account and Remote Desktop access for the installation.</li>
<li>A fixed internal IP address and computer name (e.g. SKANS-QB).</li>
<li>Outgoing internet access (HTTPS) for installing software; for remote access through Cloudflare also outgoing TCP/UDP port 7844.</li>
<li>A second location for nightly backups (NAS share or second disk) writable by the server.</li>
<li>UPS protection, and antivirus exclusions for D:\\SKANS and the PostgreSQL data folder.</li>
<li>[Plan A] A domain or subdomain we can manage in Cloudflare, e.g. qb.[domain]. / [Plan B] An internal DNS name qb.skans.local, inbound HTTPS (443) from the campus network, deployment of our root certificate to staff PCs, and VPN access for staff working from home.</li>
<li>A contact person and an agreed maintenance time for updates.</li></ol>
<p>The system uses Node.js and PostgreSQL; all data stays on the SKANS server. Kind regards,<br>[Your name]</p></div>

<h2>B. Record sheet (fill in, keep in a safe place or password manager)</h2>
<table class="fill"><tr><th style="width:45%">Item</th><th>Value</th></tr>
<tr><td>Server name / IP</td><td></td></tr><tr><td>Windows admin user (password in password manager)</td><td></td></tr>
<tr><td>PostgreSQL superuser "postgres" password</td><td></td></tr><tr><td>App database user "skans" password</td><td></td></tr>
<tr><td>App address (https://...)</td><td></td></tr><tr><td>First admin one-time password (then changed)</td><td></td></tr>
<tr><td>Cloudflare account email / Domain renewal date</td><td></td></tr><tr><td>Backup locations (main / second copy)</td><td></td></tr>
<tr><td>IT contact / maintenance time</td><td></td></tr><tr><td>Installed version (zip name) and date</td><td></td></tr></table>

<h2>C. Command cheat sheet</h2>
${cmd(`<span class="c"># services</span>
Get-Service SKANS-QB, postgresql-x64-17, cloudflared
nssm restart SKANS-QB      nssm stop SKANS-QB      nssm start SKANS-QB
Get-Content D:\\SKANS\\logs\\app.log -Tail 50 -Wait          <span class="c"># live log (Ctrl+C to stop)</span>
Invoke-WebRequest http://localhost:4000/api/health -UseBasicParsing

<span class="c"># app (run in D:\\SKANS\\app)</span>
npm run db:backup          npm run db:verify-backup
npm run db:restore -- D:\\SKANS\\backups\\skans-... --yes
npm run reset-admin -w server -- admin NewPassword123
npm run db:setup -w server   npm run build                  <span class="c"># after installing a new version</span>

<span class="c"># Windows</span>
netstat -ano | findstr :4000        taskkill /PID 1234 /F
Get-PSDrive D                       services.msc            eventvwr.msc`, 'Cheat sheet')}

<h2>D. Glossary</h2>
<table><tr><th>Word</th><th>Meaning</th></tr>
<tr><td>Service</td><td>A program Windows starts by itself and keeps running in the background.</td></tr>
<tr><td>NSSM</td><td>A small free tool that runs any program (here Node.js, Caddy) as a Windows service.</td></tr>
<tr><td>Node.js / npm</td><td>The engine that runs the app / the tool that installs its libraries.</td></tr>
<tr><td>Build</td><td>Turning the React source code into fast web files (client\\dist).</td></tr>
<tr><td>PostgreSQL</td><td>The database that stores all data.</td></tr>
<tr><td>HTTPS / certificate</td><td>Encrypted connection (padlock) / the digital ID that proves the server is genuine.</td></tr>
<tr><td>Domain / DNS</td><td>A name like qb.skans.com / the system that turns names into server addresses.</td></tr>
<tr><td>Cloudflare tunnel</td><td>A secure outgoing connection that makes the server reachable at a fixed HTTPS address without opening ports.</td></tr>
<tr><td>Reverse proxy (Caddy)</td><td>A program that receives HTTPS visits and passes them to the app.</td></tr>
<tr><td>Migration</td><td>A versioned change to the database structure, applied by db:setup.</td></tr>
<tr><td>.env</td><td>The settings file with passwords and options. Private.</td></tr></table>
</body></html>`;
}
