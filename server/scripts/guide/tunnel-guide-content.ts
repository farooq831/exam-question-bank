/**
 * "Share your local web app with a public link" - a beginner-to-advanced guide to Cloudflare Tunnel,
 * with the SKANS Question Bank beta as the worked example. Rendered to PDF by make-tunnel-guide.ts.
 */
export function renderTunnelGuideHtml(images: { logo: string; betaLogin?: string }): string {
  const cmd = (lines: string, label = 'Command') =>
    `<div class="term"><div class="term-bar"><span></span><span></span><span></span><em>${label}</em></div><pre>${lines}</pre></div>`;
  const out = (lines: string) => cmd(lines, 'What you will see');
  const tip = (t: string) => `<div class="box tip"><b>Tip</b>${t}</div>`;
  const warn = (t: string) => `<div class="box warn"><b>Important</b>${t}</div>`;
  const info = (t: string) => `<div class="box info"><b>Good to know</b>${t}</div>`;
  const steps = (xs: string[]) => `<ol class="steps">${xs.map((x) => `<li>${x}</li>`).join('')}</ol>`;
  const level = (n: number, name: string) => `<div class="level"><span>Level ${n}</span>${name}</div>`;

  // ------------------------------------------------------------------ diagrams (inline SVG)
  const svgBig = `
<svg viewBox="0 0 760 300" xmlns="http://www.w3.org/2000/svg" font-family="Segoe UI, Arial" font-size="13">
  <defs><marker id="a" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0L10 5L0 10z" fill="#1b2a4b"/></marker>
  <marker id="g" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0L10 5L0 10z" fill="#c08a2e"/></marker></defs>
  <rect x="10" y="95" width="135" height="110" rx="12" fill="#eef2ff" stroke="#1b2a4b"/>
  <text x="77" y="122" text-anchor="middle" font-weight="700">Tester</text>
  <text x="77" y="142" text-anchor="middle">phone or laptop</text>
  <text x="77" y="162" text-anchor="middle">anywhere</text>
  <text x="77" y="185" text-anchor="middle" fill="#475569" font-size="11">opens https link</text>
  <line x1="148" y1="150" x2="222" y2="150" stroke="#1b2a4b" stroke-width="2.5" marker-end="url(#a)"/>
  <text x="185" y="140" text-anchor="middle" font-size="11" fill="#475569">HTTPS</text>
  <rect x="225" y="70" width="180" height="160" rx="14" fill="#fff7ed" stroke="#c08a2e" stroke-width="2"/>
  <text x="315" y="98" text-anchor="middle" font-weight="700">Cloudflare network</text>
  <text x="315" y="120" text-anchor="middle" font-size="12">gives the public link</text>
  <text x="315" y="140" text-anchor="middle" font-size="12">xyz.trycloudflare.com</text>
  <text x="315" y="160" text-anchor="middle" font-size="12">adds HTTPS (padlock)</text>
  <text x="315" y="180" text-anchor="middle" font-size="12">blocks attacks</text>
  <text x="315" y="210" text-anchor="middle" font-size="11" fill="#9a3412">free</text>
  <path d="M408 150 H 492" stroke="#c08a2e" stroke-width="7" stroke-dasharray="2 0" opacity=".25"/>
  <line x1="492" y1="150" x2="410" y2="150" stroke="#c08a2e" stroke-width="2.5" marker-end="url(#g)"/>
  <text x="450" y="130" text-anchor="middle" font-size="11" fill="#9a3412">secure tunnel</text>
  <text x="450" y="176" text-anchor="middle" font-size="10" fill="#9a3412">opened FROM</text>
  <text x="450" y="189" text-anchor="middle" font-size="10" fill="#9a3412">your laptop</text>
  <rect x="495" y="20" width="255" height="260" rx="14" fill="#f8fafc" stroke="#1b2a4b" stroke-width="2"/>
  <text x="622" y="45" text-anchor="middle" font-weight="700">Your laptop</text>
  <rect x="515" y="62" width="215" height="48" rx="9" fill="#fff" stroke="#c08a2e"/>
  <text x="622" y="83" text-anchor="middle" font-weight="600">cloudflared</text>
  <text x="622" y="100" text-anchor="middle" font-size="11" fill="#475569">the tunnel program</text>
  <line x1="622" y1="112" x2="622" y2="138" stroke="#1b2a4b" stroke-width="2" marker-end="url(#a)"/>
  <rect x="515" y="140" width="215" height="48" rx="9" fill="#fff" stroke="#1b2a4b"/>
  <text x="622" y="161" text-anchor="middle" font-weight="600">Your web app</text>
  <text x="622" y="178" text-anchor="middle" font-size="11" fill="#475569">http://localhost:4300</text>
  <line x1="622" y1="190" x2="622" y2="216" stroke="#1b2a4b" stroke-width="2" marker-end="url(#a)"/>
  <rect x="515" y="218" width="215" height="44" rx="9" fill="#fff" stroke="#1b2a4b"/>
  <text x="622" y="238" text-anchor="middle" font-weight="600">Database</text>
  <text x="622" y="253" text-anchor="middle" font-size="11" fill="#475569">PostgreSQL (stays private)</text>
</svg>`;

  const svgWhyNot = `
<svg viewBox="0 0 760 170" xmlns="http://www.w3.org/2000/svg" font-family="Segoe UI, Arial" font-size="13">
  <defs><marker id="r" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0L10 5L0 10z" fill="#b91c1c"/></marker></defs>
  <rect x="10" y="50" width="130" height="70" rx="10" fill="#eef2ff" stroke="#1b2a4b"/><text x="75" y="80" text-anchor="middle" font-weight="700">Tester</text><text x="75" y="100" text-anchor="middle" font-size="11">on the internet</text>
  <line x1="142" y1="85" x2="300" y2="85" stroke="#b91c1c" stroke-width="2.5" marker-end="url(#r)"/>
  <text x="222" y="72" text-anchor="middle" font-size="11" fill="#b91c1c">"open my laptop"</text>
  <rect x="305" y="35" width="150" height="100" rx="10" fill="#fef2f2" stroke="#b91c1c" stroke-width="2"/>
  <text x="380" y="62" text-anchor="middle" font-weight="700">Home / office router</text><text x="380" y="84" text-anchor="middle" font-size="11">no public address,</text><text x="380" y="100" text-anchor="middle" font-size="11">firewall says NO</text><text x="380" y="122" text-anchor="middle" font-size="22" fill="#b91c1c">✕</text>
  <rect x="490" y="50" width="260" height="70" rx="10" fill="#f8fafc" stroke="#1b2a4b"/><text x="620" y="80" text-anchor="middle" font-weight="700">Your laptop: localhost</text><text x="620" y="100" text-anchor="middle" font-size="11">only this computer can open it</text>
</svg>`;

  const svgQuickNamed = `
<svg viewBox="0 0 760 210" xmlns="http://www.w3.org/2000/svg" font-family="Segoe UI, Arial" font-size="13">
  <rect x="10" y="10" width="360" height="190" rx="14" fill="#fff7ed" stroke="#c08a2e" stroke-width="2"/>
  <text x="190" y="40" text-anchor="middle" font-weight="700" font-size="15">Quick tunnel (Level 1-2)</text>
  <text x="30" y="70">✔ no account, no domain</text><text x="30" y="94">✔ one command, 1 minute</text><text x="30" y="118">✔ free HTTPS link</text>
  <text x="30" y="146" fill="#b91c1c">✕ random link, changes on restart</text><text x="30" y="170" fill="#b91c1c">✕ for testing only, no guarantee</text>
  <rect x="390" y="10" width="360" height="190" rx="14" fill="#ecfdf5" stroke="#059669" stroke-width="2"/>
  <text x="570" y="40" text-anchor="middle" font-weight="700" font-size="15">Named tunnel (Level 3-4)</text>
  <text x="410" y="70">✔ fixed link, e.g. beta.skans.edu.pk</text><text x="410" y="94">✔ runs as a Windows service</text><text x="410" y="118">✔ can require email login (Access)</text>
  <text x="410" y="146" fill="#b91c1c">✕ needs a free Cloudflare account</text><text x="410" y="170" fill="#b91c1c">✕ needs a domain on Cloudflare</text>
</svg>`;

  const svgLaptop = `
<svg viewBox="0 0 760 250" xmlns="http://www.w3.org/2000/svg" font-family="Segoe UI, Arial" font-size="12.5">
  <rect x="10" y="10" width="740" height="230" rx="16" fill="#f8fafc" stroke="#1b2a4b" stroke-width="2"/>
  <text x="380" y="36" text-anchor="middle" font-weight="700" font-size="14">The laptop running the SKANS beta</text>
  <g><rect x="30" y="55" width="160" height="165" rx="10" fill="#fff" stroke="#1b2a4b"/><text x="110" y="80" text-anchor="middle" font-weight="700">PostgreSQL 17</text><text x="110" y="102" text-anchor="middle">Windows service</text><text x="110" y="124" text-anchor="middle">database skans_beta</text><text x="110" y="146" text-anchor="middle">(real data skans_qb</text><text x="110" y="164" text-anchor="middle">is never shared)</text><text x="110" y="196" text-anchor="middle" fill="#475569">port 5432, private</text></g>
  <g><rect x="210" y="55" width="160" height="165" rx="10" fill="#fff" stroke="#1b2a4b"/><text x="290" y="80" text-anchor="middle" font-weight="700">SKANS app</text><text x="290" y="102" text-anchor="middle">Node.js, production</text><text x="290" y="124" text-anchor="middle">settings: .env.beta</text><text x="290" y="146" text-anchor="middle">makes the PDFs</text><text x="290" y="196" text-anchor="middle" fill="#475569">localhost:4300</text></g>
  <g><rect x="390" y="55" width="160" height="165" rx="10" fill="#fff" stroke="#c08a2e"/><text x="470" y="80" text-anchor="middle" font-weight="700">cloudflared</text><text x="470" y="102" text-anchor="middle">quick tunnel</text><text x="470" y="124" text-anchor="middle">writes the link to</text><text x="470" y="146" text-anchor="middle">logs\\beta-url.txt</text><text x="470" y="196" text-anchor="middle" fill="#475569">outgoing only</text></g>
  <g><rect x="570" y="55" width="160" height="165" rx="10" fill="#fff" stroke="#059669"/><text x="650" y="80" text-anchor="middle" font-weight="700">Task Scheduler</text><text x="650" y="102" text-anchor="middle">starts the beta</text><text x="650" y="124" text-anchor="middle">at sign-in</text><text x="650" y="146" text-anchor="middle">backs up skans_beta</text><text x="650" y="164" text-anchor="middle">every night 23:15</text></g>
</svg>`;

  const svgLadder = `
<svg viewBox="0 0 760 120" xmlns="http://www.w3.org/2000/svg" font-family="Segoe UI, Arial" font-size="12">
  ${[['1', 'First link', '5 min'], ['2', 'SKANS beta', '10 min'], ['3', 'Fixed link', '30 min'], ['4', 'Email login', '15 min'], ['5', 'Real server', 'later']]
    .map(([n, t, d], i) => {
      const x = 10 + i * 150;
      const y = 80 - i * 15;
      return `<rect x="${x}" y="${y}" width="140" height="${40 + i * 15}" rx="8" fill="${i < 2 ? '#fff7ed' : i < 4 ? '#ecfdf5' : '#eef2ff'}" stroke="#1b2a4b"/><text x="${x + 70}" y="${y + 18}" text-anchor="middle" font-weight="700">Level ${n}</text><text x="${x + 70}" y="${y + 34}" text-anchor="middle">${t} · ${d}</text>`;
    })
    .join('')}
</svg>`;

  const figure = (svgOrImg: string, caption: string) => `<figure>${svgOrImg}<figcaption>${caption}</figcaption></figure>`;

  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Public Link Guide</title>
<style>
  *{box-sizing:border-box}
  body{font-family:'Segoe UI',Arial,sans-serif;color:#1f2937;font-size:10.5pt;line-height:1.5;margin:0}
  .cover{height:250mm;display:flex;flex-direction:column;justify-content:center;padding:0 8mm;break-after:page}
  .cover img{width:62mm;margin-bottom:16mm}
  .cover h1{font-size:28pt;color:#1b2a4b;margin:0;line-height:1.12}
  .cover .sub{font-size:14pt;color:#c08a2e;margin:4mm 0 8mm;font-weight:600}
  .cover p{color:#475569;margin:1mm 0}
  .bar{width:22mm;height:2mm;background:#c08a2e;border-radius:1mm;margin-bottom:8mm}
  .toc{break-after:page} .toc ol{list-style:none;padding:0} .toc li{padding:1.1mm 0;border-bottom:.3mm dotted #cbd5e1}
  .toc li.grp{border:0;padding-top:4mm;color:#c08a2e;font-weight:700;text-transform:uppercase;font-size:9pt;letter-spacing:.05em}
  h1.chap{break-before:page;font-size:17pt;color:#fff;background:#1b2a4b;padding:4.5mm 6mm;border-radius:3mm;margin:0 0 5mm}
  h2{font-size:13.5pt;color:#1b2a4b;border-bottom:.5mm solid #e2e8f0;padding-bottom:1.5mm;margin:6mm 0 3mm}
  h3{font-size:11pt;color:#1b2a4b;margin:4mm 0 1.5mm}
  p{margin:0 0 2.6mm}
  ol.steps{padding-left:6mm;margin:0 0 3mm} ol.steps li{margin-bottom:1.4mm} ol.steps li::marker{color:#c08a2e;font-weight:700}
  ul{padding-left:6mm;margin:0 0 3mm} ul li{margin-bottom:1mm}
  code{font-family:Consolas,'Cascadia Mono',monospace;background:#f1f5f9;border-radius:1mm;padding:0 1mm;font-size:9.5pt}
  .term{background:#0f172a;border-radius:2.5mm;margin:2mm 0 4mm;break-inside:avoid;overflow:hidden}
  .term-bar{background:#1e293b;padding:1.5mm 3mm;display:flex;gap:1.5mm;align-items:center}
  .term-bar span{width:2.6mm;height:2.6mm;border-radius:50%;background:#f87171}.term-bar span:nth-child(2){background:#fbbf24}.term-bar span:nth-child(3){background:#34d399}
  .term-bar em{color:#94a3b8;font-style:normal;font-size:8.5pt;margin-left:2mm}
  .term pre{margin:0;padding:3mm 4mm;color:#e2e8f0;font-family:Consolas,'Cascadia Mono',monospace;font-size:8.8pt;white-space:pre-wrap;word-break:break-word;line-height:1.45}
  .term .c{color:#64748b} .term .y{color:#fbbf24} .term .g{color:#4ade80}
  table{width:100%;border-collapse:collapse;margin:2mm 0 4mm;font-size:9.2pt;break-inside:avoid}
  thead,tr:first-child{break-after:avoid}
  h2,h3{break-after:avoid}
  tr{break-inside:avoid}
  th{background:#1b2a4b;color:#fff;text-align:left;padding:1.6mm 2.2mm;vertical-align:top}
  td{border-bottom:.3mm solid #e2e8f0;padding:1.6mm 2.2mm;vertical-align:top}
  .box{border-radius:2.5mm;padding:2.4mm 3.5mm;margin:2mm 0 4mm;font-size:9.6pt;break-inside:avoid}
  .box b:first-child{display:block;margin-bottom:.6mm}
  .tip{background:#ecfdf5;border-left:1.2mm solid #059669}
  .warn{background:#fffbeb;border-left:1.2mm solid #d97706}
  .info{background:#eff6ff;border-left:1.2mm solid #2563eb}
  figure{margin:2mm 0 5mm;break-inside:avoid} figure svg{width:100%;height:auto;display:block}
  figure img{width:100%;border:.3mm solid #cbd5e1;border-radius:2.5mm;display:block}
  figcaption{font-size:8.5pt;color:#64748b;text-align:center;margin-top:1.5mm}
  .level{display:inline-block;background:#c08a2e;color:#fff;font-weight:700;border-radius:2mm;padding:.8mm 2.5mm;margin-bottom:2mm;font-size:9.5pt}
  .level span{background:#1b2a4b;border-radius:1.5mm;padding:.2mm 1.6mm;margin-right:2mm}
  .two{display:flex;gap:4mm} .two>div{flex:1}
  ul.check{list-style:none;padding-left:1mm}
</style></head><body>

<div class="cover">
  <img src="${images.logo}" alt="SKANS School of Accountancy">
  <div class="bar"></div>
  <h1>Share Your Local Web App<br>with a Public Link</h1>
  <div class="sub">A free Cloudflare Tunnel guide · from beginner to advanced</div>
  <p>Windows, macOS and Linux · every command explained · real examples</p>
  <p>Worked example: the SKANS Question Bank beta</p>
  <p style="margin-top:8mm">October 2026</p>
</div>

<div class="toc"><h2>Contents</h2><ol>
  <li class="grp">Understand it</li><li>1. The idea in one picture</li><li>2. What you need</li>
  <li class="grp">Do it</li><li>3. Level 1: your first public link in 5 minutes</li><li>4. Examples for common frameworks</li><li>5. Level 2: the SKANS Question Bank beta</li><li>6. Making an app "tunnel-ready"</li>
  <li class="grp">Know the limits</li><li>7. Limitations of quick tunnels</li><li>8. Security checklist</li>
  <li class="grp">Go further</li><li>9. Level 3: a fixed link that never changes</li><li>10. Level 4: allow only invited emails</li><li>11. Level 5: when to move to a real server</li>
  <li class="grp">Reference</li><li>12. Troubleshooting</li><li>13. Alternatives compared</li><li>14. Command cheat sheet</li><li>15. Glossary</li>
</ol>
<h3 style="margin-top:8mm">The path through this guide</h3>
${figure(svgLadder, 'Start at Level 1. Most beta tests only need Levels 1 and 2.')}
</div>

<!-- ============================================================ -->
<h1 class="chap">Understand it</h1>
<h2>1. The idea in one picture</h2>
<p>When you run a web app on your laptop, you open it at an address like <code>http://localhost:4300</code>. <b>"localhost" means "this computer"</b>, so only you can open it. Other people cannot reach your laptop from the internet, because your router has no public address for it and its firewall blocks visitors.</p>
${figure(svgWhyNot, 'Without a tunnel, nobody outside can open the app on your laptop.')}
<p><b>Cloudflare Tunnel</b> solves this. A small program on your laptop, <code>cloudflared</code>, opens a secure connection <i>from</i> your laptop <i>to</i> Cloudflare. Cloudflare gives you a public <b>https://</b> link. When someone opens the link, Cloudflare sends the request down that connection to your app, and sends the answer back.</p>
${figure(svgBig, 'With a tunnel: tester → Cloudflare (public HTTPS link) → secure tunnel → your app on your laptop.')}
${info('Because the connection starts from your laptop, you do <b>not</b> need to change router settings, open firewall ports, buy hosting, or set up HTTPS certificates. Cloudflare provides the padlock (HTTPS) for free.')}

<h2>2. What you need</h2>
<table><tr><th>Item</th><th>Details</th></tr>
<tr><td><b>A computer</b></td><td>Windows 10/11, macOS or Linux. A normal laptop is enough for a beta test with a few dozen users.</td></tr>
<tr><td><b>Internet</b></td><td>A stable connection. Testers' speed depends on your <b>upload</b> speed. 5 Mbps or more is comfortable.</td></tr>
<tr><td><b>Your app running locally</b></td><td>It must open in your own browser at <code>http://localhost:PORT</code> first.</td></tr>
<tr><td><b>cloudflared</b></td><td>The free tunnel program from Cloudflare (installation in Level 1).</td></tr>
<tr><td><b>Optional</b></td><td>A free Cloudflare account and a domain name, for a fixed link (Level 3).</td></tr></table>
<h3>Prepare the laptop (important)</h3>
<ul>
<li><b>Never sleep while the beta runs.</b> Windows: Settings → System → Power &amp; battery → Screen and sleep → "When plugged in, put my device to sleep after" → <b>Never</b>.</li>
<li><b>Closing the lid:</b> Control Panel → Power Options → "Choose what closing the lid does" → When plugged in: <b>Do nothing</b>.</li>
<li>Keep it <b>plugged in</b> and on a <b>stable Wi-Fi or cable</b>.</li>
<li>Windows Update may restart the PC at night: Settings → Windows Update → <b>Pause updates</b> during the beta, or set active hours.</li>
</ul>

<!-- ============================================================ -->
<h1 class="chap">Do it</h1>
${level(1, 'Your first public link in 5 minutes')}
<h2>3. Level 1: your first public link</h2>
<h3>Step 1. Install cloudflared</h3>
<p><b>Windows</b> (PowerShell or Command Prompt):</p>
${cmd('winget install --id Cloudflare.cloudflared')}
<p>No winget? Download <code>cloudflared-windows-amd64.exe</code> from <code>github.com/cloudflare/cloudflared/releases</code>, rename it to <code>cloudflared.exe</code> and run it from that folder.</p>
<div class="two"><div><p><b>macOS</b> (with Homebrew):</p>${cmd('brew install cloudflared')}</div>
<div><p><b>Ubuntu / Debian Linux:</b></p>${cmd('curl -L -o cloudflared.deb https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb\nsudo dpkg -i cloudflared.deb')}</div></div>
<p>Close and reopen the terminal, then check it works:</p>
${cmd('cloudflared --version')}
${out('cloudflared version 2026.10.3 (built 2026-10-21T03:51 UTC)')}

<h3>Step 2. Start any app on your laptop</h3>
<p>Use your own project, or try this tiny test website (needs Python, already on most Macs and Linux, and on Windows from the Microsoft Store):</p>
${cmd('<span class="c"># in a folder that contains an index.html file</span>\npython -m http.server 8000')}
<p>Open <code>http://localhost:8000</code> in your browser. If you see your page, continue. If not, fix the app first; the tunnel can only share what already works locally.</p>

<h3>Step 3. Start the tunnel</h3>
<p>Open a <b>second</b> terminal window (keep the app running in the first) and type:</p>
${cmd('cloudflared tunnel --url http://localhost:8000')}
${out(`Requesting new quick Tunnel on trycloudflare.com...
+--------------------------------------------------------------------------------------------+
|  Your quick Tunnel has been created! Visit it at (it may take some time to be reachable):  |
|  <span class="y">https://assets-wires-flat-wonder.trycloudflare.com</span>                                        |
+--------------------------------------------------------------------------------------------+
Registered tunnel connection ... <span class="g">protocol=quic</span>`)}
<p>Copy the yellow <b>https://…trycloudflare.com</b> link. Each run gives a new random name made of four words.</p>
<h3>Step 4. Test and share</h3>
${steps(['Open the link on your <b>phone with Wi-Fi switched off</b> (mobile data). Then you know it works from outside.', 'Wait 10 to 30 seconds if it does not open at once; new links take a moment.', 'Send the link to your testers on WhatsApp or by email.'])}
<h3>Step 5. Stop sharing</h3>
<p>Press <b>Ctrl + C</b> in the tunnel window. The link stops working immediately. Running the command again gives a <b>new</b> link.</p>
${warn('Both windows must stay open: the app <i>and</i> the tunnel. Closing either one breaks the link.')}

<h2>4. Examples for common frameworks</h2>
<p>The tunnel command is always <code>cloudflared tunnel --url http://localhost:PORT</code>. Only the port, and sometimes one setting, changes.</p>
<table><tr><th>Project type</th><th>Start it locally</th><th>Port</th><th>Extra setting for tunnels</th></tr>
<tr><td>Static HTML</td><td><code>python -m http.server 8000</code> or <code>npx serve -l 8000</code></td><td>8000</td><td>None</td></tr>
<tr><td>Node.js / Express</td><td><code>node server.js</code></td><td>3000</td><td><code>app.set('trust proxy', 1)</code> if you use secure cookies (see section 6)</td></tr>
<tr><td>React / Vue with Vite</td><td><code>npm run build</code> then <code>npx vite preview --port 4173</code></td><td>4173</td><td>Vite blocks unknown host names. Add <code>preview: { allowedHosts: ['.trycloudflare.com'] }</code> (and <code>server</code> the same for <code>npm run dev</code>) in <code>vite.config</code></td></tr>
<tr><td>Next.js</td><td><code>npm run build</code> then <code>npm start</code></td><td>3000</td><td>None for most apps</td></tr>
<tr><td>Django</td><td><code>python manage.py runserver 8000</code></td><td>8000</td><td><code>ALLOWED_HOSTS = ['.trycloudflare.com', 'localhost']</code> and <code>CSRF_TRUSTED_ORIGINS = ['https://*.trycloudflare.com']</code></td></tr>
<tr><td>Flask</td><td><code>flask run --port 5000</code></td><td>5000</td><td>For secure cookies use <code>ProxyFix</code></td></tr>
<tr><td>PHP</td><td><code>php -S localhost:8080</code></td><td>8080</td><td>None</td></tr>
<tr><td>Spring Boot</td><td><code>./mvnw spring-boot:run</code></td><td>8080</td><td><code>server.forward-headers-strategy=framework</code></td></tr>
<tr><td><b>SKANS Question Bank</b></td><td><code>beta.ps1 -Start</code> (section 5)</td><td>4300</td><td>Already done: <code>TRUST_PROXY=1</code>, production mode</td></tr></table>
${tip('Share a <b>production build</b>, not the development server. It is faster for testers, does not reload while you edit code, and shows fewer technical errors.')}

<!-- SKANS -->
${level(2, 'The SKANS Question Bank beta')}
<h2>5. Level 2: the SKANS Question Bank beta</h2>
<p>For the SKANS beta, everything above is automated by one script. This is what runs on the laptop:</p>
${figure(svgLaptop, 'Four parts on one laptop. Only the app is reachable from outside, and only through the tunnel.')}
<h3>One-time setup (already done on the beta laptop)</h3>
<table><tr><th>What</th><th>Why</th></tr>
<tr><td>Separate database <code>skans_beta</code></td><td>Testers never see real data in <code>skans_qb</code>; the beta can be thrown away afterwards.</td></tr>
<tr><td>Settings file <code>server\\.env.beta</code></td><td>Production mode, port 4300, <code>TRUST_PROXY=1</code>, its own secret. Contains passwords: never share it or put it in git.</td></tr>
<tr><td><code>cloudflared</code> installed with winget</td><td>The tunnel program.</td></tr>
<tr><td>Script <code>server\\scripts\\beta.ps1</code></td><td>Starts and stops everything and records the link.</td></tr>
<tr><td>Two scheduled tasks</td><td>Start the beta when you sign in to Windows; back up the beta database every night.</td></tr></table>
<h3>Everyday commands</h3>
<p>Open <b>PowerShell</b> in the project folder (in File Explorer: open the folder, type <code>powershell</code> in the address bar, press Enter):</p>
${cmd(`<span class="c"># start the app and the tunnel; prints the public link</span>
powershell -ExecutionPolicy Bypass -File server\\scripts\\beta.ps1 -Start

<span class="c"># is it running? which link?</span>
powershell -ExecutionPolicy Bypass -File server\\scripts\\beta.ps1 -Status

<span class="c"># stop both</span>
powershell -ExecutionPolicy Bypass -File server\\scripts\\beta.ps1 -Stop

<span class="c"># after changing the code: rebuild the web app, then start</span>
powershell -ExecutionPolicy Bypass -File server\\scripts\\beta.ps1 -Start -Rebuild`)}
${out(`  SKANS Question Bank BETA is live:  <span class="y">https://assets-wires-flat-wonder.trycloudflare.com</span>

App on this PC : running
Public link    : https://assets-wires-flat-wonder.trycloudflare.com  (reachable)`)}
<p>The current link is always saved in <code>server\\logs\\beta-url.txt</code>. Logs are in <code>server\\logs\\beta-server.log</code> and <code>beta-tunnel.log</code>.</p>
${images.betaLogin ? figure(`<img src="${images.betaLogin}" alt="SKANS beta sign-in through the tunnel">`, 'The SKANS beta opened through the public link (note the https padlock).') : ''}
<h3>After a restart</h3>
${steps(['The beta starts by itself when you sign in to Windows (scheduled task "SKANS QB - beta start").', 'The <b>link is new</b>. Run <code>-Status</code>, or open <code>server\\logs\\beta-url.txt</code>.', 'Send the new link to the testers.'])}
${tip('To give testers a link that never changes, see Level 3.')}

<h2>6. Making an app "tunnel-ready"</h2>
<p>Through a tunnel, the tester's browser talks <b>HTTPS</b> to Cloudflare, but your app receives plain <b>HTTP</b> from <code>cloudflared</code> on the same laptop. Cloudflare tells the app the original details in extra headers (<code>X-Forwarded-Proto: https</code>, <code>X-Forwarded-For: tester's address</code>). Your app must be told to trust them:</p>
<ul>
<li><b>Secure login cookies:</b> apps that only send cookies over HTTPS (good practice) will otherwise think the visit is not secure, and users are signed out after every click. Express: <code>app.set('trust proxy', 1)</code>. SKANS: <code>TRUST_PROXY=1</code>.</li>
<li><b>Correct visitor addresses:</b> needed for rate limits and account lock-outs.</li>
<li><b>Host checks:</b> some frameworks only accept known host names (Vite, Django; see the table in section 4).</li>
<li><b>Production mode:</b> <code>NODE_ENV=production</code> (or your framework's equivalent) turns off debug pages that could show code to strangers.</li>
<li><b>Test data:</b> use a separate database for the beta.</li>
</ul>

<!-- ============================================================ -->
<h1 class="chap">Know the limits</h1>
<h2>7. Limitations of quick tunnels</h2>
${figure(svgQuickNamed, 'Quick tunnels are perfect for testing. For anything permanent, use a named tunnel or a server.')}
<table><tr><th>Limitation</th><th>What it means for you</th><th>Workaround</th></tr>
<tr><td><b>Random link</b> that changes every time the tunnel starts</td><td>After a restart, testers need the new link</td><td>Send the new link; or Level 3 (fixed link)</td></tr>
<tr><td><b>No uptime guarantee</b>; meant for testing</td><td>Cloudflare may limit or end a quick tunnel; not for real exams</td><td>Named tunnel (Level 3) or a real server (Level 5)</td></tr>
<tr><td><b>About 200 requests at the same moment</b></td><td>Fine for dozens of testers; not for a whole school at once</td><td>Named tunnel or server</td></tr>
<tr><td><b>No "Server-Sent Events"</b> (live push updates)</td><td>Rarely matters; SKANS does not use them</td><td>Named tunnel</td></tr>
<tr><td><b>Laptop must stay on and online</b></td><td>Sleep, shutdown, Wi-Fi loss or Windows Update = link down</td><td>Power settings (section 2); a server</td></tr>
<tr><td><b>Speed depends on your upload speed</b></td><td>Big PDFs download slower on weak home internet</td><td>Better connection; a server</td></tr>
<tr><td><b>100 MB per upload</b> (Cloudflare free plan)</td><td>Very large file uploads are refused</td><td>Not an issue for SKANS</td></tr>
<tr><td><b>Anyone with the link can open the page</b></td><td>The app's own login is the only protection</td><td>Strong passwords; Level 4 (email check)</td></tr>
<tr><td><b>Terms of use</b></td><td>No hosting of large media or illegal content</td><td>Use it for your app only</td></tr>
<tr><td><b>Windows does not auto-update cloudflared</b></td><td>Old versions can stop working over time</td><td><code>winget upgrade Cloudflare.cloudflared</code> every month</td></tr></table>

<h2>8. Security checklist</h2>
<ul class="check">
<li>☐ The app has its <b>own login</b>, and testers get <b>their own accounts</b> (not one shared password).</li>
<li>☐ Strong admin password; change it after the beta.</li>
<li>☐ <b>Separate test database</b>; no real or confidential data (for SKANS: no real exam questions).</li>
<li>☐ <b>Production mode</b>; no development server or debug pages.</li>
<li>☐ Never tunnel a <b>database port</b> (5432, 3306) or an admin tool. Share only the web app.</li>
<li>☐ Never post <code>.env</code> files or passwords in chats or in git.</li>
<li>☐ <b>Stop the tunnel</b> when the beta ends (<code>-Stop</code>, or Ctrl + C).</li>
<li>☐ Keep backups of the test database if testers' work matters.</li>
</ul>

<!-- ============================================================ -->
<h1 class="chap">Go further</h1>
${level(3, 'A fixed link that never changes')}
<h2>9. Level 3: a fixed link with a free Cloudflare account</h2>
<p>A <b>named tunnel</b> gives a permanent address such as <code>https://beta.your-domain.com</code>. It runs as a Windows service, so it survives restarts, and testers keep the same link.</p>
<h3>You need</h3>
<ul><li>A <b>free Cloudflare account</b> (cloudflare.com, sign up with an email).</li>
<li>A <b>domain name</b> added to Cloudflare. Cloudflare does not give free domains; a <code>.com</code> costs about 10 US dollars a year (Cloudflare sells them at cost). A school domain can also be used if its DNS is on Cloudflare, or with a subdomain delegated by IT.</li></ul>
<h3>Way A: in the Cloudflare dashboard (easiest)</h3>
${steps(['Sign in to <b>dash.cloudflare.com</b> and add your domain (follow the steps to change its nameservers at the seller).', 'Open <b>Zero Trust</b> (left menu) → <b>Networks</b> → <b>Tunnels</b> → <b>Create a tunnel</b> → choose <b>Cloudflared</b>.', 'Name it, for example <code>skans-beta</code>, and save.', 'Choose <b>Windows</b>. Cloudflare shows a command with a long secret <b>token</b>. Run it in an <b>administrator</b> PowerShell. It installs cloudflared as a service.', 'Under <b>Public hostname</b>: Subdomain <code>beta</code>, Domain <code>your-domain.com</code>, Service type <b>HTTP</b>, URL <code>localhost:4300</code>. Save.', 'Open <code>https://beta.your-domain.com</code>. Done: the link never changes.'])}
${cmd('cloudflared.exe service install eyJhIjoi...your-secret-token...', 'Administrator PowerShell (command shown by Cloudflare)')}
${warn('The token is a password for your tunnel. Do not share it. If it leaks, delete the tunnel in the dashboard and create a new one.')}
<h3>Way B: from the command line</h3>
${cmd(`<span class="c"># 1. sign in (opens the browser; choose your domain)</span>
cloudflared tunnel login

<span class="c"># 2. create the tunnel (prints its ID and saves a credentials file)</span>
cloudflared tunnel create skans-beta

<span class="c"># 3. point beta.your-domain.com at the tunnel</span>
cloudflared tunnel route dns skans-beta beta.your-domain.com

<span class="c"># 4. run it (uses the config file below)</span>
cloudflared tunnel run skans-beta`)}
<p>Config file <code>C:\\Users\\&lt;you&gt;\\.cloudflared\\config.yml</code>:</p>
${cmd(`tunnel: skans-beta
credentials-file: C:\\Users\\&lt;you&gt;\\.cloudflared\\&lt;tunnel-id&gt;.json
ingress:
  - hostname: beta.your-domain.com
    service: http://localhost:4300
  - service: http_status:404`, 'config.yml')}
<p>To start it automatically with Windows, run <code>cloudflared service install</code> in an administrator PowerShell.</p>
${info('For SKANS, after switching to a named tunnel: set <code>CLIENT_ORIGIN=https://beta.your-domain.com</code> in <code>.env.beta</code>, and start only the app (the service runs the tunnel).')}

${level(4, 'Allow only invited emails')}
<h2>10. Level 4: allow only invited emails (Cloudflare Access)</h2>
<p>With a named tunnel you can make Cloudflare check each visitor's email <b>before</b> they even see your app. It is free for up to 50 users.</p>
${steps(['Zero Trust → <b>Access</b> → <b>Applications</b> → <b>Add an application</b> → <b>Self-hosted</b>.', 'Application domain: <code>beta.your-domain.com</code>.', 'Add a policy: Action <b>Allow</b>, Include <b>Emails</b> (list the testers), or <b>Emails ending in</b> <code>@skans.edu.pk</code>.', 'Login method: <b>One-time PIN</b>. Visitors type their email and receive a code.', 'Save. Now strangers who find the link cannot reach the app at all.'])}
${tip('This is an extra layer: testers still sign in to the app with their own username and password.')}

<h2>11. Level 5: when to move to a real server</h2>
<p>A laptop and a tunnel are ideal for a beta. Move to a proper server when:</p>
<ul><li>the system is used for <b>real exams</b> or confidential content;</li><li>many people use it at the same time every day;</li><li>it must be available <b>24/7</b> without depending on one laptop.</li></ul>
<p>Options: the <b>SKANS school server</b> (planned), with Nginx and HTTPS inside the school network, or a free cloud machine such as Oracle Cloud "Always Free". A named tunnel can still be used in front of the school server, so it is reachable from outside without opening the school firewall.</p>

<!-- ============================================================ -->
<h1 class="chap">Reference</h1>
<h2>12. Troubleshooting</h2>
<table><tr><th>What you see</th><th>Cause</th><th>Fix</th></tr>
<tr><td>Cloudflare page <b>"Error 1033"</b></td><td>The tunnel is not running</td><td>Start it again (<code>-Start</code>, or the cloudflared command). A quick tunnel gives a new link.</td></tr>
<tr><td><b>"502 Bad Gateway"</b></td><td>Tunnel runs, but the app is not running or uses another port</td><td>Start the app; check <code>http://localhost:PORT</code> on the laptop; match the port in <code>--url</code>.</td></tr>
<tr><td>The link does not open for 30 seconds</td><td>New links take a moment to spread</td><td>Wait and retry; try mobile data.</td></tr>
<tr><td>Signed in, but sent back to the login page</td><td>App does not trust the tunnel's HTTPS headers</td><td><code>trust proxy</code> / <code>TRUST_PROXY=1</code> (section 6).</td></tr>
<tr><td>"Blocked request. This host is not allowed"</td><td>Vite host check</td><td><code>allowedHosts</code> in <code>vite.config</code> (section 4).</td></tr>
<tr><td>Django "DisallowedHost" or CSRF error</td><td>Host and origin checks</td><td><code>ALLOWED_HOSTS</code> and <code>CSRF_TRUSTED_ORIGINS</code>.</td></tr>
<tr><td>"Address already in use" / port busy</td><td>Another program uses the port</td><td><code>netstat -ano | findstr :4300</code> shows its process ID; close it, or <code>beta.ps1 -Stop</code>.</td></tr>
<tr><td>Tunnel keeps reconnecting, or fails on office Wi-Fi</td><td>Network blocks the QUIC protocol (UDP)</td><td>Add <code>--protocol http2</code> to the cloudflared command.</td></tr>
<tr><td>Worked yesterday, not today</td><td>Laptop slept or restarted, so the link changed</td><td><code>-Status</code>, send the new link; fix power settings.</td></tr>
<tr><td><code>cloudflared</code> is "not recognized"</td><td>Terminal opened before installation</td><td>Close and reopen the terminal, or use the full path <code>"C:\\Program Files (x86)\\cloudflared\\cloudflared.exe"</code>.</td></tr></table>

<h2>13. Alternatives compared</h2>
<table><tr><th>Option</th><th>Cost</th><th>Fixed link</th><th>Good for</th><th>Notes</th></tr>
<tr><td><b>Cloudflare quick tunnel</b></td><td>Free, no account</td><td>No</td><td>Short tests, demos</td><td>Used for the SKANS beta</td></tr>
<tr><td><b>Cloudflare named tunnel</b></td><td>Free (+ domain)</td><td>Yes</td><td>Longer betas, small teams</td><td>Service, email login (Access)</td></tr>
<tr><td><b>ngrok</b></td><td>Free plan with limits</td><td>One free static address</td><td>Developer demos</td><td>Free plan shows a warning page to visitors and limits traffic</td></tr>
<tr><td><b>Tailscale Funnel</b></td><td>Free personal plan</td><td>Yes (*.ts.net)</td><td>Developers already using Tailscale</td><td>Needs a Tailscale account</td></tr>
<tr><td><b>Render, Koyeb and similar free hosts</b></td><td>Free tiers</td><td>Yes</td><td>Small apps without heavy work</td><td>Apps sleep when idle, small memory; PDF generation often fails</td></tr>
<tr><td><b>Oracle Cloud Always Free</b></td><td>Free (card for verification)</td><td>Yes</td><td>Always-on test server</td><td>More setup; full control</td></tr>
<tr><td><b>School / office server</b></td><td>Existing hardware</td><td>Yes</td><td>Real use</td><td>The final home of the SKANS system</td></tr></table>

<h2>14. Command cheat sheet</h2>
${cmd(`<span class="c"># install / update / check</span>
winget install --id Cloudflare.cloudflared
winget upgrade Cloudflare.cloudflared
cloudflared --version

<span class="c"># quick tunnel to any local app (Ctrl + C to stop)</span>
cloudflared tunnel --url http://localhost:PORT
cloudflared tunnel --url http://localhost:PORT --protocol http2   <span class="c"># if UDP is blocked</span>

<span class="c"># SKANS beta</span>
powershell -ExecutionPolicy Bypass -File server\\scripts\\beta.ps1 -Start | -Status | -Stop
powershell -ExecutionPolicy Bypass -File server\\scripts\\beta.ps1 -Start -Rebuild
powershell -ExecutionPolicy Bypass -File server\\scripts\\beta.ps1 -Install | -Uninstall
type server\\logs\\beta-url.txt                                   <span class="c"># current link</span>

<span class="c"># named tunnel (Level 3)</span>
cloudflared tunnel login
cloudflared tunnel create NAME
cloudflared tunnel route dns NAME sub.your-domain.com
cloudflared tunnel run NAME
cloudflared tunnel list
cloudflared service install            <span class="c"># run at Windows start (admin)</span>

<span class="c"># Windows helpers</span>
netstat -ano | findstr :4300           <span class="c"># who uses port 4300?</span>
taskkill /PID 1234 /F                  <span class="c"># stop that process</span>`, 'Cheat sheet')}

<h2>15. Glossary</h2>
<table><tr><th>Word</th><th>Meaning</th></tr>
<tr><td><b>localhost</b></td><td>"This computer". An address only the computer itself can open.</td></tr>
<tr><td><b>Port</b></td><td>A numbered door on a computer for one program, e.g. 4300 for the SKANS beta, 5432 for PostgreSQL.</td></tr>
<tr><td><b>Tunnel</b></td><td>A secure connection that carries visitors' requests from the internet to an app on your computer.</td></tr>
<tr><td><b>cloudflared</b></td><td>Cloudflare's free program that creates the tunnel.</td></tr>
<tr><td><b>HTTPS</b></td><td>Encrypted web traffic (the padlock). Passwords cannot be read on the way.</td></tr>
<tr><td><b>Domain / DNS</b></td><td>A name such as <code>skans.edu.pk</code>, and the internet's "phone book" that turns names into addresses.</td></tr>
<tr><td><b>Proxy / trust proxy</b></td><td>Something that passes requests on (here: Cloudflare and cloudflared). "Trust proxy" lets the app believe the proxy's information about HTTPS and the visitor.</td></tr>
<tr><td><b>Router / NAT / firewall</b></td><td>The box and rules that connect your home or office to the internet and normally block visitors from reaching your laptop.</td></tr>
<tr><td><b>Production mode</b></td><td>The safe, fast way to run an app for real users, with debug tools switched off.</td></tr>
<tr><td><b>Beta test</b></td><td>Letting real users try a nearly finished system and report problems before the real launch.</td></tr></table>
</body></html>`;
}
