import http from 'http';
import fs from 'fs';

function getJson(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

class CDPClient {
  constructor(wsUrl) {
    this.wsUrl = wsUrl;
    this.ws = null;
    this.msgId = 1;
    this.pending = new Map();
  }

  async connect() {
    const WS = globalThis.WebSocket;
    return new Promise((resolve, reject) => {
      this.ws = new WS(this.wsUrl);
      this.ws.onopen = resolve;
      this.ws.onerror = reject;
      this.ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.id && this.pending.has(data.id)) {
          const { resolve, reject } = this.pending.get(data.id);
          this.pending.delete(data.id);
          if (data.error) reject(data.error);
          else resolve(data.result);
        }
      };
    });
  }

  send(method, params = {}) {
    const id = this.msgId++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  async evaluate(expression) {
    const res = await this.send('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise: true,
    });
    return res?.result?.value;
  }
}

async function main() {
  const { spawn } = await import('child_process');
  let version;
  try {
    version = await getJson('http://127.0.0.1:9222/json/version');
  } catch (e) {
    const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
    spawn(edgePath, [
      '--remote-debugging-port=9222',
      '--headless=new',
      '--disable-gpu',
      '--no-first-run',
      '--no-default-browser-check',
      '--user-data-dir=C:\\Users\\hp\\.gemini\\antigravity-ide\\scratch\\edge_profile'
    ], { detached: true });
    await new Promise((r) => setTimeout(r, 3000));
  }

  const targets = await getJson('http://127.0.0.1:9222/json/list');
  let pageTarget = targets.find((t) => t.type === 'page');
  if (!pageTarget) {
    pageTarget = await getJson('http://127.0.0.1:9222/json/new?http://localhost:8000');
    await new Promise((r) => setTimeout(r, 1000));
  }

  const cdp = new CDPClient(pageTarget.webSocketDebuggerUrl);
  await cdp.connect();
  await cdp.send('Page.navigate', { url: 'http://localhost:8000' });
  await new Promise((r) => setTimeout(r, 1500));

  const results = await cdp.evaluate(`
    (() => {
      let m = document.getElementById('nook-pagination-measurer');
      if (!m) {
        m = document.createElement('div');
        m.id = 'nook-pagination-measurer';
        m.className = 'reader-paper-page reader-paper-measurer font-md';
        document.body.appendChild(m);
      }
      
      const sampleShort = '<header class="reader-prose-header"><h1 class="reader-prose-chapter-title">Chapter 1</h1></header><article class="reader-prose font-md"><p>Short test text.</p></article><div class="reader-paper-page-number">— 1 —</div>';
      m.innerHTML = sampleShort;
      const shortProse = m.querySelector('.reader-prose');
      const shortRes = {
        scrollH: m.scrollHeight,
        clientH: m.clientHeight,
        proseOffsetTop: shortProse.offsetTop,
        proseOffsetHeight: shortProse.offsetHeight,
        proseBottom: shortProse.offsetTop + shortProse.offsetHeight,
        fits: m.scrollHeight <= m.clientHeight && (shortProse.offsetTop + shortProse.offsetHeight) <= (m.clientHeight - 60)
      };

      // Now create huge text that definitely overflows 850px
      const longParas = Array(15).fill('<p>This is a long paragraph with many words that will definitely fill up and overflow the entire 5.5 by 8.5 novel page in the reader.</p>').join('');
      m.innerHTML = '<header class="reader-prose-header"><h1 class="reader-prose-chapter-title">Chapter 1</h1></header><article class="reader-prose font-md">' + longParas + '</article><div class="reader-paper-page-number">— 1 —</div>';
      const longProse = m.querySelector('.reader-prose');
      const longRes = {
        scrollH: m.scrollHeight,
        clientH: m.clientHeight,
        proseOffsetTop: longProse.offsetTop,
        proseOffsetHeight: longProse.offsetHeight,
        proseBottom: longProse.offsetTop + longProse.offsetHeight,
        fits: m.scrollHeight <= m.clientHeight && (longProse.offsetTop + longProse.offsetHeight) <= (m.clientHeight - 60)
      };

      return { shortRes, longRes };
    })()
  `);

  console.log('[PROSE MEASUREMENT COMPARISON]:', JSON.stringify(results, null, 2));
  process.exit(0);
}

main().catch(console.error);
