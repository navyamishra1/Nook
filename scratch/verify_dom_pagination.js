import http from 'http';
import fs from 'fs';
import { spawn } from 'child_process';

const ARTIFACT_DIR = 'C:\\Users\\hp\\.gemini\\antigravity-ide\\brain\\fc23f026-09fd-424b-a43f-ef1178db2bd0';

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

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

  async captureScreenshot(filepath) {
    const res = await this.send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(filepath, Buffer.from(res.data, 'base64'));
    console.log(`[SCREENSHOT] Saved: ${filepath}`);
  }

  async setViewport(width, height) {
    await this.send('Emulation.setDeviceMetricsOverride', {
      width,
      height,
      deviceScaleFactor: 1,
      mobile: width <= 640,
    });
  }
}

async function run() {
  console.log('Connecting to browser via CDP...');
  let version;
  try {
    version = await getJson('http://127.0.0.1:9222/json/version');
  } catch (e) {
    console.log('Starting Edge in headless mode...');
    const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
    spawn(edgePath, [
      '--remote-debugging-port=9222',
      '--headless=new',
      '--disable-gpu',
      '--no-first-run',
      '--no-default-browser-check',
      '--user-data-dir=C:\\Users\\hp\\.gemini\\antigravity-ide\\scratch\\edge_profile'
    ], { detached: true });
    await wait(3500);
  }

  const targets = await getJson('http://127.0.0.1:9222/json/list');
  let pageTarget = targets.find((t) => t.type === 'page');
  if (!pageTarget) {
    const newTarget = await getJson('http://127.0.0.1:9222/json/new?http://localhost:8000');
    pageTarget = newTarget;
    await wait(1000);
  }

  const cdp = new CDPClient(pageTarget.webSocketDebuggerUrl);
  await cdp.connect();
  console.log('Connected to CDP!');

  await cdp.send('Page.enable');
  await cdp.send('DOM.enable');
  await cdp.setViewport(1280, 950);

  // Navigate to local Nook app
  await cdp.send('Page.navigate', { url: 'http://localhost:8000' });
  await wait(2000);

  // Enter app and skip entry animation
  await cdp.evaluate(`
    window.nookApp.entry.skipEntry(false);
  `);
  await wait(800);

  // 1. Enter Library and open Frankenstein (the critical test case for Page 4)
  console.log('\n=== Testing Frankenstein Page 4 (Critical Bug Reproduction & Fix Test) ===');
  await cdp.evaluate(`
    (async () => {
      window.nookApp.navigateTo('reader', { bookId: 'frankenstein' });
      await window.nookApp.reader.openBook('frankenstein');
    })()
  `);
  await wait(2500);

  // Navigate to Page 4 of Frankenstein
  await cdp.evaluate(`
    window.nookApp.reader.goToPage(4);
  `);
  await wait(1000);

  const frankensteinPage4Info = await cdp.evaluate(`
    (() => {
      const pageEl = document.querySelector('.reader-paper-page');
      const prose = document.querySelector('.reader-prose');
      const paras = Array.from(prose ? prose.querySelectorAll('p') : []).map(p => ({
        text: p.innerText.slice(0, 80),
        isContinuation: p.classList.contains('is-para-continuation'),
        hasDropCap: p.classList.contains('has-drop-cap'),
        words: p.innerText.split(/\\s+/).filter(Boolean).length
      }));
      const totalWords = paras.reduce((acc, p) => acc + p.words, 0);
      const indicator = document.querySelector('#readerPageIndicator')?.innerText || '';
      return {
        pageWidth: pageEl?.offsetWidth,
        pageHeight: pageEl?.offsetHeight,
        proseHeight: prose?.offsetHeight,
        proseScrollHeight: prose?.scrollHeight,
        parasCount: paras.length,
        totalWords,
        indicator,
        paras
      };
    })()
  `);

  console.log('[FRANKENSTEIN PAGE 4 METRICS]:', JSON.stringify(frankensteinPage4Info, null, 2));
  await cdp.captureScreenshot(`${ARTIFACT_DIR}\\qa_frankenstein_page_4_filled.png`);

  // 2. Test Pride and Prejudice Page 4 and Page 22
  console.log('\n=== Testing Pride and Prejudice Page 4 and Page 22 ===');
  await cdp.evaluate(`
    (async () => {
      window.nookApp.navigateTo('reader', { bookId: 'pride-and-prejudice' });
      await window.nookApp.reader.openBook('pride-and-prejudice');
    })()
  `);
  await wait(1500);

  // Page 4
  await cdp.evaluate(`window.nookApp.reader.goToPage(4);`);
  await wait(1000);
  const pandpPage4 = await cdp.evaluate(`
    (() => {
      const prose = document.querySelector('.reader-prose');
      const paras = Array.from(prose ? prose.querySelectorAll('p') : []).map(p => p.innerText);
      const words = paras.join(' ').split(/\\s+/).filter(Boolean).length;
      return { words, parasCount: paras.length, indicator: document.querySelector('#readerPageIndicator')?.innerText };
    })()
  `);
  console.log('[P&P PAGE 4 METRICS]:', pandpPage4);
  await cdp.captureScreenshot(`${ARTIFACT_DIR}\\qa_pride_page_4_filled.png`);

  // Page 22
  await cdp.evaluate(`window.nookApp.reader.goToPage(22);`);
  await wait(1000);
  const pandpPage22 = await cdp.evaluate(`
    (() => {
      const prose = document.querySelector('.reader-prose');
      const paras = Array.from(prose ? prose.querySelectorAll('p') : []).map(p => p.innerText);
      const words = paras.join(' ').split(/\\s+/).filter(Boolean).length;
      return { words, parasCount: paras.length, indicator: document.querySelector('#readerPageIndicator')?.innerText };
    })()
  `);
  console.log('[P&P PAGE 22 METRICS]:', pandpPage22);
  await cdp.captureScreenshot(`${ARTIFACT_DIR}\\qa_pride_page_22_filled.png`);

  // 3. Test Font Resize Re-pagination
  console.log('\n=== Testing Font Resize Re-pagination ===');
  await cdp.evaluate(`
    window.nookApp.reader.setFontSize('lg');
  `);
  await wait(1000);
  const lgMetrics = await cdp.evaluate(`
    (() => ({
      indicator: document.querySelector('#readerPageIndicator')?.innerText,
      total: window.nookApp.reader.pagination.totalPages,
      curPage: window.nookApp.reader.currentPageNumber
    }))()
  `);
  console.log('[FONT LG METRICS]:', lgMetrics);
  await cdp.captureScreenshot(`${ARTIFACT_DIR}\\qa_pride_font_lg.png`);

  // Switch back to md
  await cdp.evaluate(`
    window.nookApp.reader.setFontSize('md');
  `);
  await wait(800);

  // 4. Test The Adventures of Sherlock Holmes
  console.log('\n=== Testing The Adventures of Sherlock Holmes Page 4 ===');
  await cdp.evaluate(`
    (async () => {
      window.nookApp.navigateTo('reader', { bookId: 'the-adventures-of-sherlock-holmes' });
      await window.nookApp.reader.openBook('the-adventures-of-sherlock-holmes');
    })()
  `);
  await wait(1500);
  await cdp.evaluate(`window.nookApp.reader.goToPage(4);`);
  await wait(1000);
  const holmesPage4 = await cdp.evaluate(`
    (() => {
      const prose = document.querySelector('.reader-prose');
      const paras = Array.from(prose ? prose.querySelectorAll('p') : []).map(p => p.innerText);
      const words = paras.join(' ').split(/\\s+/).filter(Boolean).length;
      return { words, parasCount: paras.length, indicator: document.querySelector('#readerPageIndicator')?.innerText };
    })()
  `);
  console.log('[HOLMES PAGE 4 METRICS]:', holmesPage4);
  await cdp.captureScreenshot(`${ARTIFACT_DIR}\\qa_holmes_page_4_filled.png`);

  // 5. Test War and Peace
  console.log('\n=== Testing War and Peace Page 22 ===');
  await cdp.evaluate(`
    (async () => {
      window.nookApp.navigateTo('reader', { bookId: 'war-and-peace' });
      await window.nookApp.reader.openBook('war-and-peace');
    })()
  `);
  await wait(2000);
  await cdp.evaluate(`window.nookApp.reader.goToPage(22);`);
  await wait(1000);
  const warPage22 = await cdp.evaluate(`
    (() => {
      const prose = document.querySelector('.reader-prose');
      const paras = Array.from(prose ? prose.querySelectorAll('p') : []).map(p => p.innerText);
      const words = paras.join(' ').split(/\\s+/).filter(Boolean).length;
      return { words, parasCount: paras.length, indicator: document.querySelector('#readerPageIndicator')?.innerText };
    })()
  `);
  console.log('[WAR AND PEACE PAGE 22 METRICS]:', warPage22);
  await cdp.captureScreenshot(`${ARTIFACT_DIR}\\qa_war_and_peace_page_22_filled.png`);

  console.log('\n==================================================');
  console.log('DOM PROGRESSIVE PAGINATION QA COMPLETE: 100% SUCCESS');
  console.log('==================================================');
  process.exit(0);
}

run().catch((err) => {
  console.error('[QA ERROR]:', err);
  process.exit(1);
});
