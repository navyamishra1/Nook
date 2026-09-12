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

  const testResult = await cdp.evaluate(`
    (async () => {
      try {
        const { paginateBook } = await import('/js/pagination.js');
        const res = await fetch('/data/books/frankenstein/content.json');
        const content = await res.json();
        
        const t0 = performance.now();
        const pagination = paginateBook(content, 'md', { forceRepaginate: true });
        const t1 = performance.now();
        
        const p4 = pagination.getPage(4);
        const p22 = pagination.getPage(22);
        
        return {
          durationMs: Math.round(t1 - t0),
          totalPages: pagination.totalPages,
          page4: {
            chapterNumber: p4?.chapterNumber,
            chapterPageNumber: p4?.chapterPageNumber,
            wordCount: p4?.wordCount,
            parasCount: p4?.paragraphs?.length,
            parasPreview: p4?.paragraphs?.map(p => p.slice(0, 60))
          },
          page22: {
            chapterNumber: p22?.chapterNumber,
            chapterPageNumber: p22?.chapterPageNumber,
            wordCount: p22?.wordCount,
            parasCount: p22?.paragraphs?.length,
            parasPreview: p22?.paragraphs?.map(p => p.slice(0, 60))
          }
        };
      } catch (err) {
        return { error: err.message, stack: err.stack };
      }
    })()
  `);

  console.log('[BROWSER PAGINATION TEST RESULT]:', JSON.stringify(testResult, null, 2));
  process.exit(0);
}

main().catch(console.error);
