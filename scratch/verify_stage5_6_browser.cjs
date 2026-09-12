const http = require('http');
const { spawn } = require('child_process');
const crypto = require('crypto');
const os = require('os');
const path = require('path');
const fs = require('fs');

function connectWS(wsUrl) {
  return new Promise((resolve, reject) => {
    const url = new URL(wsUrl);
    const key = crypto.randomBytes(16).toString('base64');
    const req = http.request({
      hostname: url.hostname,
      port: url.port,
      path: url.pathname,
      headers: {
        'Connection': 'Upgrade',
        'Upgrade': 'websocket',
        'Sec-WebSocket-Version': '13',
        'Sec-WebSocket-Key': key
      }
    });

    req.on('upgrade', (res, socket) => {
      socket.on('error', () => {});
      let buffer = Buffer.alloc(0);
      let nextId = 1;
      const callbacks = new Map();

      socket.on('data', (chunk) => {
        buffer = Buffer.concat([buffer, chunk]);
        while (buffer.length >= 2) {
          const secondByte = buffer[1];
          let length = secondByte & 0x7f;
          let offset = 2;
          if (length === 126) {
            if (buffer.length < 4) return;
            length = buffer.readUInt16BE(2);
            offset = 4;
          } else if (length === 127) {
            if (buffer.length < 10) return;
            length = Number(buffer.readBigUInt64BE(2));
            offset = 10;
          }
          if (buffer.length < offset + length) return;
          const payload = buffer.slice(offset, offset + length);
          buffer = buffer.slice(offset + length);
          try {
            const message = JSON.parse(payload.toString('utf8'));
            if (message.id && callbacks.has(message.id)) {
              const cb = callbacks.get(message.id);
              callbacks.delete(message.id);
              cb(message);
            }
          } catch (e) {}
        }
      });

      function send(method, params = {}) {
        return new Promise((res) => {
          const id = nextId++;
          callbacks.set(id, res);
          const msg = JSON.stringify({ id, method, params });
          const payload = Buffer.from(msg, 'utf8');
          let header;
          const maskKey = crypto.randomBytes(4);
          if (payload.length <= 125) {
            header = Buffer.alloc(6);
            header[0] = 0x81;
            header[1] = 0x80 | payload.length;
            maskKey.copy(header, 2);
          } else if (payload.length <= 65535) {
            header = Buffer.alloc(8);
            header[0] = 0x81;
            header[1] = 0x80 | 126;
            header.writeUInt16BE(payload.length, 2);
            maskKey.copy(header, 4);
          }
          const maskedPayload = Buffer.alloc(payload.length);
          for (let i = 0; i < payload.length; i++) {
            maskedPayload[i] = payload[i] ^ maskKey[i % 4];
          }
          socket.write(Buffer.concat([header, maskedPayload]));
        });
      }

      resolve({ send, socket });
    });
    req.on('error', reject);
    req.end();
  });
}

async function main() {
  console.log('================ STARTING STAGES 5 & 6 BROWSER QA ================');

  // 1. Start static server on port 8085
  const serverProc = spawn('python', ['-m', 'http.server', '8085', '--directory', 'frontend'], {
    cwd: path.resolve(__dirname, '..'),
    stdio: 'ignore'
  });

  await new Promise((r) => setTimeout(r, 1000));

  const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  const cdpPort = 9227;
  const tmpDir = path.join(os.tmpdir(), 'edge_nook_qa_' + Date.now());

  const edgeProc = spawn(edgePath, [
    `--remote-debugging-port=${cdpPort}`,
    '--headless=new',
    '--window-size=1280,900',
    '--disable-gpu',
    '--no-first-run',
    '--no-default-browser-check',
    `--user-data-dir=${tmpDir}`,
    'http://localhost:8085'
  ], { stdio: 'ignore' });

  async function getPageTarget(maxAttempts = 15) {
    for (let i = 0; i < maxAttempts; i++) {
      try {
        const list = await new Promise((resolve, reject) => {
          const req = http.get(`http://127.0.0.1:${cdpPort}/json/list`, (r) => {
            let d = '';
            r.on('data', (c) => (d += c));
            r.on('end', () => {
              try { resolve(JSON.parse(d)); } catch(e) { reject(e); }
            });
          });
          req.on('error', reject);
          req.setTimeout(1000, () => req.destroy());
        });
        const page = list.find((p) => p.type === 'page');
        if (page && page.webSocketDebuggerUrl) return page;
      } catch (err) {
        await new Promise((r) => setTimeout(r, 500));
      }
    }
    throw new Error('Could not connect to Edge CDP after multiple attempts.');
  }

  try {
    const page = await getPageTarget();
    console.log('[BROWSER QA] Connected to Edge CDP target:', page.webSocketDebuggerUrl);
    const client = await connectWS(page.webSocketDebuggerUrl);

    async function evaluate(expression) {
      const res = await client.send('Runtime.evaluate', {
        expression,
        returnByValue: true,
        awaitPromise: true
      });
      return res.result?.result?.value;
    }

    // Enable Page and Runtime domains
    await client.send('Page.enable');
    await client.send('Runtime.enable');

    const curUrl = await evaluate('window.location.href');
    console.log('[BROWSER QA] Current page URL:', curUrl);

    // If on about:blank or not yet at localhost, navigate explicitly
    if (!curUrl || !curUrl.includes('localhost:8085')) {
      await client.send('Page.navigate', { url: 'http://localhost:8085' });
      await new Promise((r) => setTimeout(r, 1000));
    }

    // Wait until app is ready
    const readyState = await evaluate(`new Promise((res) => {
      let attempts = 0;
      const check = () => {
        attempts++;
        if (window.nookApp && Array.isArray(window.nookApp.catalog) && window.nookApp.catalog.length > 0) {
          res({ ready: true, attempts, count: window.nookApp.catalog.length });
        } else if (attempts > 100) {
          res({ ready: false, attempts, hasNookApp: !!window.nookApp });
        } else {
          setTimeout(check, 100);
        }
      };
      check();
    })`);
    console.log('[BROWSER QA] App readiness check result:', readyState);

    // -------------------------------------------------------------
    // Test 1: STAGE 5 — Highlight Intelligence in Journal View
    // -------------------------------------------------------------
    console.log('\n--- 1. Testing Highlight Intelligence in Journal View ---');

    // Populate test highlights in localStorage
    const testHighlights = [
      {
        id: 'hl-1',
        bookId: 'frankenstein',
        chapterNumber: 4,
        chapterTitle: 'Chapter 4',
        pageNumber: 12,
        text: 'Learn from me, if not by my precepts, at least by my example, how dangerous is the acquirement of knowledge and ambition.',
        color: 'sage',
        createdAt: '2026-09-10T10:00:00Z',
        note: 'Ambition and scientific obsession'
      },
      {
        id: 'hl-2',
        bookId: 'frankenstein',
        chapterNumber: 10,
        chapterTitle: 'Chapter 10',
        pageNumber: 28,
        text: 'I was a poor, helpless, miserable wretch; I knew, and could distinguish, nothing; but feeling pain invade me on all sides, I sat down and wept in loneliness.',
        color: 'warm-amber',
        createdAt: '2026-09-10T11:00:00Z',
        note: 'Solitude and grief'
      },
      {
        id: 'hl-3',
        bookId: 'the-island-of-doctor-moreau',
        chapterNumber: 14,
        chapterTitle: 'Chapter 14',
        pageNumber: 18,
        text: 'To study the limits of science and the strange destiny of ambition.',
        color: 'sage',
        createdAt: '2026-09-10T12:00:00Z',
        note: 'Scientific experimentation'
      }
    ];

    const navResult = await evaluate(`(() => {
      try {
        localStorage.setItem('nook_journal', JSON.stringify({
          version: 1,
          bookmarks: [],
          highlights: ${JSON.stringify(testHighlights)},
          notes: []
        }));
        window.nookApp.navigateTo('journal');
        return { success: true };
      } catch (err) {
        return { success: false, error: err.message, stack: err.stack };
      }
    })()`);
    console.log('[DEBUG] navigateTo journal result:', navResult);

    const debugJournalHTML = await evaluate(`(() => {
      const container = document.getElementById('view-journal');
      return {
        hasContainer: !!container,
        htmlSnippet: container ? container.innerHTML.substring(0, 400) : 'none'
      };
    })()`);
    console.log('[DEBUG] Journal DOM container:', debugJournalHTML);

    const intelDOM = await evaluate(`(() => {
      const panel = document.querySelector('#journalIntelPanel');
      if (!panel) return { exists: false };
      const kicker = panel.querySelector('.intel-kicker')?.textContent || '';
      const heading = panel.querySelector('.intel-heading')?.textContent || '';
      const summary = panel.querySelector('.intel-summary-lead')?.textContent || '';
      const themeCards = Array.from(panel.querySelectorAll('.intel-theme-card')).map(c => ({
        name: c.querySelector('.intel-theme-title')?.textContent || '',
        count: c.querySelector('.intel-theme-count')?.textContent || ''
      }));
      const connRows = Array.from(panel.querySelectorAll('.intel-connection-row')).map(r => r.textContent);
      return {
        exists: true,
        kicker,
        heading,
        summary,
        themeCardsCount: themeCards.length,
        themeCards,
        connRowsCount: connRows.length
      };
    })()`);

    console.log('  ✓ Highlight Intelligence panel exists:', intelDOM.exists);
    console.log('  ✓ Kicker:', intelDOM.kicker);
    console.log('  ✓ Heading:', intelDOM.heading);
    console.log('  ✓ Thematic summary:', intelDOM.summary);
    console.log('  ✓ Identified Themes:', (intelDOM.themeCards || []).map(t => t.name).join(', '));
    console.log('  ✓ Cross-book connections count:', intelDOM.connRowsCount);

    if (!intelDOM.exists || intelDOM.themeCardsCount === 0) {
      throw new Error('Stage 5 Highlight Intelligence failed to render in Journal view.');
    }

    // Test Empty State
    console.log('\n--- 2. Testing Highlight Intelligence Empty State ---');
    await evaluate(`
      localStorage.setItem('nook_journal', JSON.stringify({ version: 1, bookmarks: [], highlights: [], notes: [] }));
      window.nookApp.navigateTo('journal');
      const hlTab = document.querySelector('.j-tab[data-jtype="highlights"]');
      if (hlTab) hlTab.click();
    `);
    await new Promise((r) => setTimeout(r, 400));

    const emptyDOM = await evaluate(`(() => {
      const panel = document.querySelector('#journalIntelPanel');
      if (!panel) return { exists: false };
      const emptyMsg = panel.querySelector('.intel-empty-desc')?.textContent || '';
      return { exists: true, emptyMsg };
    })()`);

    console.log('  ✓ Empty state note:', emptyDOM.emptyMsg);
    if (!emptyDOM.emptyMsg.includes('Save a few passages')) {
      throw new Error('Stage 5 Empty state note not rendered properly.');
    }

    // -------------------------------------------------------------
    // Test 3: STAGE 6 — Reader Chapter-Level Similarity ("Elsewhere in Nook")
    // -------------------------------------------------------------
    console.log('\n--- 3. Testing Chapter-Level Similarity in Reader View ---');

    await evaluate(`
      window.nookApp.navigateTo('reader', { bookId: 'frankenstein', chapterNumber: 4, pageNumber: 1 });
    `);

    // Wait for reader content & elsewhere panel to load
    let elsewhereDOM = null;
    for (let i = 0; i < 20; i++) {
      await new Promise((r) => setTimeout(r, 400));
      elsewhereDOM = await evaluate(`(() => {
        const panel = document.querySelector('#readerElsewherePanel');
        if (!panel || panel.style.display === 'none') return null;
        const kicker = panel.querySelector('.elsewhere-kicker')?.textContent || '';
        const heading = panel.querySelector('.elsewhere-heading')?.textContent || '';
        const cards = Array.from(panel.querySelectorAll('.elsewhere-card')).map(c => ({
          bookId: c.getAttribute('data-book-id'),
          chapter: c.getAttribute('data-chapter'),
          bookTitle: c.querySelector('.elsewhere-book-title')?.textContent || '',
          chapterTitle: c.querySelector('.elsewhere-chapter-title')?.textContent || '',
          author: c.querySelector('.elsewhere-author')?.textContent || '',
          explanation: c.querySelector('.elsewhere-explanation')?.textContent || ''
        }));
        return {
          visible: true,
          kicker,
          heading,
          cardsCount: cards.length,
          cards
        };
      })()`);
      if (elsewhereDOM) break;
    }

    if (!elsewhereDOM) {
      throw new Error('Stage 6 Elsewhere panel did not appear in Reader view.');
    }

    console.log('  ✓ Elsewhere panel is visible:', elsewhereDOM.visible);
    console.log('  ✓ Kicker:', elsewhereDOM.kicker);
    console.log('  ✓ Heading:', elsewhereDOM.heading);
    console.log('  ✓ Related chapters count:', elsewhereDOM.cardsCount);
    elsewhereDOM.cards.forEach((c, idx) => {
      console.log(`    [${idx + 1}] ${c.bookTitle} (${c.chapterTitle}) by ${c.author}`);
      console.log(`        Reason: "${c.explanation}"`);
    });

    if (elsewhereDOM.cardsCount === 0) {
      throw new Error('Stage 6 Elsewhere cards were not populated.');
    }

    // -------------------------------------------------------------
    // Test 4: STAGE 6 — Chapter Navigation via Elsewhere Card Click
    // -------------------------------------------------------------
    console.log('\n--- 4. Testing Navigation via Elsewhere Card Click ---');
    const targetBookId = elsewhereDOM.cards[0].bookId;
    const targetChapter = elsewhereDOM.cards[0].chapter;
    console.log(`  Target navigation: Book "${targetBookId}", Chapter ${targetChapter}`);

    await evaluate(`(() => {
      const card = document.querySelector('.elsewhere-card[data-book-id="${targetBookId}"]');
      if (card) card.click();
    })()`);

    // Wait for new reader page to load
    let readerState = null;
    for (let i = 0; i < 25; i++) {
      await new Promise((r) => setTimeout(r, 400));
      readerState = await evaluate(`(() => {
        const reader = window.nookApp?.reader;
        if (!reader || reader.activeBookId !== "${targetBookId}") return null;
        return {
          activeBookId: reader.activeBookId,
          currentPage: reader.currentPage,
          pageObject: (reader.pages && reader.pages[reader.currentPage]) || null
        };
      })()`);
      if (readerState) break;
    }

    if (!readerState) {
      throw new Error(`Failed to navigate to target book "${targetBookId}" in reader within timeout.`);
    }

    console.log('  ✓ New Reader Active Book:', readerState.activeBookId);
    console.log('  ✓ New Reader Chapter Number:', readerState.pageObject?.chapterNumber);

    // -------------------------------------------------------------
    // Test 5: STAGE 6 — Mobile Responsiveness & Overflow Test
    // -------------------------------------------------------------
    console.log('\n--- 5. Testing Viewport Responsiveness (Zero Horizontal Overflow) ---');
    const viewports = [1280, 1024, 768, 390];

    for (const width of viewports) {
      await client.send('Emulation.setDeviceMetricsOverride', {
        width,
        height: 844,
        deviceScaleFactor: 1,
        mobile: width <= 768
      });

      await new Promise((r) => setTimeout(r, 250));

      const overflowCheck = await evaluate(`(() => {
        const bodyScrollWidth = document.body.scrollWidth;
        const htmlScrollWidth = document.documentElement.scrollWidth;
        const windowWidth = window.innerWidth;
        const hasOverflow = bodyScrollWidth > windowWidth || htmlScrollWidth > windowWidth;
        return {
          windowWidth,
          bodyScrollWidth,
          htmlScrollWidth,
          hasOverflow
        };
      })()`);

      console.log(`  ✓ Viewport ${width}px: scrollWidth = ${overflowCheck.htmlScrollWidth}px (hasOverflow: ${overflowCheck.hasOverflow})`);
      if (overflowCheck.hasOverflow) {
        throw new Error(`Horizontal overflow detected at ${width}px viewport!`);
      }
    }

    console.log('\n================ ALL BROWSER QA TESTS PASSED! ================');

  } finally {
    try { edgeProc.kill(); } catch (e) {}
    try { serverProc.kill(); } catch (e) {}
  }
}

main().catch((err) => {
  console.error('\n❌ BROWSER QA ERROR:', err);
  process.exit(1);
});
