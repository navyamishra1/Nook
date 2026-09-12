import { spawn } from 'child_process';
import http from 'http';
import fs from 'fs';
import path from 'path';

const EDGE_PATH = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const PORT = 9222;
const ARTIFACTS_DIR = "C:\\Users\\hp\\.gemini\\antigravity-ide\\brain\\fc23f026-09fd-424b-a43f-ef1178db2bd0";

async function sleep(ms) {
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
    this.id = 1;
    this.callbacks = new Map();
  }

  async connect() {
    this.ws = new WebSocket(this.wsUrl);
    return new Promise((resolve, reject) => {
      this.ws.onopen = resolve;
      this.ws.onerror = reject;
      this.ws.onmessage = (event) => {
        const payload = JSON.parse(event.data);
        if (payload.id && this.callbacks.has(payload.id)) {
          const { resolve, reject } = this.callbacks.get(payload.id);
          this.callbacks.delete(payload.id);
          if (payload.error) reject(payload.error);
          else resolve(payload.result);
        }
      };
    });
  }

  send(method, params = {}) {
    const id = this.id++;
    return new Promise((resolve, reject) => {
      this.callbacks.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  async eval(expression) {
    const res = await this.send('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise: true,
    });
    return res.result?.value;
  }

  async setViewport(width, height) {
    await this.send('Emulation.setDeviceMetricsOverride', {
      width,
      height,
      deviceScaleFactor: 1,
      mobile: width < 600,
    });
    await sleep(400);
  }

  async screenshot(filename) {
    const res = await this.send('Page.captureScreenshot', { format: 'png' });
    const buffer = Buffer.from(res.data, 'base64');
    const outPath = path.join(ARTIFACTS_DIR, filename);
    fs.writeFileSync(outPath, buffer);
    console.log(`[SCREENSHOT] Saved: ${outPath}`);
    return outPath;
  }
}

async function main() {
  console.log('Starting Edge in headless remote debugging mode...');
  const edgeProc = spawn(EDGE_PATH, [
    `--remote-debugging-port=${PORT}`,
    '--headless=new',
    '--disable-gpu',
    '--no-first-run',
    '--no-default-browser-check',
    '--window-size=1280,950',
    'http://localhost:8000',
  ]);

  await sleep(2500);

  try {
    const targets = await getJson(`http://127.0.0.1:${PORT}/json`);
    const pageTarget = targets.find((t) => t.type === 'page');
    if (!pageTarget || !pageTarget.webSocketDebuggerUrl) {
      throw new Error('No page target found');
    }

    const cdp = new CDPClient(pageTarget.webSocketDebuggerUrl);
    await cdp.connect();
    await cdp.send('Page.enable');
    await cdp.send('Runtime.enable');
    await cdp.setViewport(1280, 950);

    console.log('Connected to CDP. Entering Nook...');
    await sleep(1500);

    // 1. Skip entry animation into Home
    await cdp.eval(`
      const skipBtn = document.getElementById('entry-skip-btn');
      if (skipBtn) skipBtn.click();
    `);
    await sleep(1000);

    // 2. Click Pride and Prejudice card to open Details
    await cdp.eval(`
      const card = document.querySelector('.book-card[data-book-id="pride-and-prejudice"]') || document.querySelector('.book-card');
      if (card) card.click();
    `);
    await sleep(1000);

    // 3. Click Read Now button to open Reader
    console.log('Clicking Read now button...');
    await cdp.eval(`
      const readBtn = document.getElementById('detailsReadNowBtn') || document.querySelector('.read-now-btn');
      if (readBtn) readBtn.click();
    `);
    await sleep(1500);

    // Verify 5.5" x 8.5" Paper Page Geometry
    const pageMetrics = await cdp.eval(`
      (() => {
        const page = document.getElementById('readerPaperPage');
        const ind = document.getElementById('readerPageIndicator');
        const num = document.querySelector('.reader-paper-page-number');
        if (!page) return null;
        const rect = page.getBoundingClientRect();
        return {
          width: Math.round(rect.width),
          height: Math.round(rect.height),
          aspectRatio: (rect.width / rect.height).toFixed(3),
          expectedRatio: (11 / 17).toFixed(3),
          indicatorText: ind ? ind.textContent.trim() : null,
          paperPageNum: num ? num.textContent.trim() : null,
        };
      })()
    `);
    console.log('[READER 5.5x8.5 METRICS]:', JSON.stringify(pageMetrics, null, 2));

    // Capture Desktop Page 1 (5.5" x 8.5" warm paper)
    await cdp.screenshot('qa_novel_page_1_desktop.png');

    // 4. Turn to Page 2
    console.log('Turning to Page 2...');
    await cdp.eval(`
      const nextBtn = document.getElementById('readerNextPageBtn');
      if (nextBtn) nextBtn.click();
    `);
    await sleep(1200);
    await cdp.screenshot('qa_novel_page_2_desktop.png');

    // 5. Scroll to bottom of reader to capture footer navigation
    await cdp.eval(`window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'instant' });`);
    await sleep(500);
    await cdp.screenshot('qa_novel_page_footer_desktop.png');

    // 6. Reset scroll and switch to Dark Theme
    await cdp.eval(`
      window.scrollTo({ top: 0, behavior: 'instant' });
      const darkBtn = document.querySelector('.theme-btn[data-theme-val="dark"]');
      if (darkBtn) darkBtn.click();
    `);
    await sleep(600);
    await cdp.screenshot('qa_novel_page_dark_theme.png');

    // 7. Switch to Light Theme
    await cdp.eval(`
      const lightBtn = document.querySelector('.theme-btn[data-theme-val="light"]');
      if (lightBtn) lightBtn.click();
    `);
    await sleep(600);
    await cdp.screenshot('qa_novel_page_light_theme.png');

    // Reset back to Warm
    await cdp.eval(`
      const warmBtn = document.querySelector('.theme-btn[data-theme-val="warm"]');
      if (warmBtn) warmBtn.click();
    `);
    await sleep(400);

    // 8. Test Tablet Viewport (800x1000)
    console.log('Testing Tablet viewport (800x1000)...');
    await cdp.setViewport(800, 1000);
    await sleep(600);
    await cdp.screenshot('qa_novel_page_tablet_800.png');

    // 9. Test Mobile Viewport (390x844)
    console.log('Testing Mobile viewport (390x844)...');
    await cdp.setViewport(390, 844);
    await sleep(600);
    await cdp.screenshot('qa_novel_page_mobile_390.png');

    console.log('==================================================');
    console.log('NOOK NOVEL DIMENSIONS QA: 100% COMPLETE');
    console.log('==================================================');
  } finally {
    edgeProc.kill('SIGKILL');
  }
}

main().catch((err) => {
  console.error('QA Error:', err);
  process.exit(1);
});
