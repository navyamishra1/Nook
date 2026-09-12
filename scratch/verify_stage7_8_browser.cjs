const http = require('http');
const { spawn } = require('child_process');
const crypto = require('crypto');
const os = require('os');
const path = require('path');

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
        return new Promise((res, rej) => {
          const id = nextId++;
          callbacks.set(id, (resp) => {
            if (resp.error) rej(new Error(JSON.stringify(resp.error)));
            else res(resp);
          });
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
  console.log('================ STARTING STAGES 7 & 8 BROWSER QA ================');

  // 1. Start static server on port 8086
  const serverProc = spawn('python', ['-m', 'http.server', '8086', '--directory', 'frontend'], {
    cwd: path.resolve(__dirname, '..'),
    stdio: 'ignore'
  });

  await new Promise((r) => setTimeout(r, 1000));

  const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  const cdpPort = 9228;
  const tmpDir = path.join(os.tmpdir(), 'edge_nook_qa78_' + Date.now());

  const edgeProc = spawn(edgePath, [
    `--remote-debugging-port=${cdpPort}`,
    '--headless=new',
    '--window-size=1280,900',
    '--disable-gpu',
    '--no-first-run',
    '--no-default-browser-check',
    `--user-data-dir=${tmpDir}`,
    'http://localhost:8086'
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
      if (res.result?.exceptionDetails) {
        throw new Error('CDP Evaluate Exception: ' + JSON.stringify(res.result.exceptionDetails));
      }
      return res.result?.result?.value;
    }

    // Enable Page and Runtime domains
    await client.send('Page.enable');
    await client.send('Runtime.enable');

    const curUrl = await evaluate('window.location.href');
    if (!curUrl || !curUrl.includes('localhost:8086')) {
      await client.send('Page.navigate', { url: 'http://localhost:8086' });
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
    // Test 1: STAGE 7 — Reading Journal Timeline View
    // -------------------------------------------------------------
    console.log('\n--- 1. Testing Journal Timeline in Reading Journal View ---');

    const testJournalData = {
      version: 1,
      bookmarks: [
        {
          id: 'bm-qa-1',
          bookId: 'frankenstein',
          bookTitle: 'Frankenstein',
          author: 'Mary Wollstonecraft Shelley',
          chapterNumber: 4,
          chapterTitle: 'Chapter 4',
          pageNumber: 12,
          totalPages: 110,
          bookmarkStyle: 'crimson-silk',
          createdAt: 1789210000000 // Sept 12, 2026
        }
      ],
      highlights: [
        {
          id: 'hl-qa-1',
          bookId: 'frankenstein',
          bookTitle: 'Frankenstein',
          author: 'Mary Wollstonecraft Shelley',
          chapterNumber: 4,
          chapterTitle: 'Chapter 4',
          pageNumber: 12,
          selectedText: 'Learn from me, if not by my precepts, at least by my example, how dangerous is the acquirement of knowledge.',
          color: 'sage',
          createdAt: 1789215000000,
          note: 'Ambition and scientific obsession'
        },
        {
          id: 'hl-qa-2',
          bookId: 'dracula',
          bookTitle: 'Dracula',
          author: 'Bram Stoker',
          chapterNumber: 2,
          chapterTitle: 'Chapter 2',
          pageNumber: 6,
          selectedText: 'Welcome to my house! Enter freely and of your own will!',
          color: 'warm-amber',
          createdAt: 1789120000000
        }
      ],
      notes: [
        {
          id: 'nt-qa-1',
          bookId: 'pride-and-prejudice',
          bookTitle: 'Pride and Prejudice',
          author: 'Jane Austen',
          chapterNumber: 1,
          chapterTitle: 'Chapter 1',
          pageNumber: 2,
          selectedText: 'It is a truth universally acknowledged...',
          note: 'The iconic opening sentence exploring social expectations.',
          createdAt: 1786790000000
        }
      ]
    };

    await evaluate(`
      localStorage.setItem('nook_journal', JSON.stringify(${JSON.stringify(testJournalData)}));
      window.nookApp.navigateTo('journal', { tab: 'timeline' });
    `);

    await new Promise((r) => setTimeout(r, 600));

    const timelineDOM = await evaluate(`(() => {
      const stream = document.querySelector('#journalTimelineStream');
      if (!stream) return { exists: false };
      const monthBadges = Array.from(document.querySelectorAll('.timeline-month-badge')).map(b => b.textContent.trim());
      const dayLabels = Array.from(document.querySelectorAll('.day-label')).map(d => d.textContent.trim());
      const entryCards = Array.from(document.querySelectorAll('.timeline-entry-card')).map(c => ({
        id: c.getAttribute('data-entry-id'),
        bookId: c.getAttribute('data-book-id'),
        typeTag: c.querySelector('.t-type-tag')?.textContent.trim() || '',
        bookTitle: c.querySelector('.t-book-title')?.textContent.trim() || '',
        chapterPage: c.querySelector('.t-chapter-page')?.textContent.trim() || ''
      }));
      return {
        exists: true,
        monthBadges,
        dayLabels,
        entryCardsCount: entryCards.length,
        entryCards
      };
    })()`);

    console.log('  ✓ Timeline Stream exists:', timelineDOM.exists);
    console.log('  ✓ Month Groups:', timelineDOM.monthBadges.join(', '));
    console.log('  ✓ Day Markers:', timelineDOM.dayLabels.join(', '));
    console.log('  ✓ Entry Cards Count:', timelineDOM.entryCardsCount);
    timelineDOM.entryCards.forEach((c, i) => {
      console.log(`    [${i + 1}] [${c.typeTag}] ${c.bookTitle} (${c.chapterPage})`);
    });

    if (!timelineDOM.exists || timelineDOM.entryCardsCount !== 4) {
      throw new Error(`Stage 7 Timeline failed to render expected entries. Expected 4, got ${timelineDOM.entryCardsCount}`);
    }

    // -------------------------------------------------------------
    // Test 2: STAGE 7 — Navigation from Timeline Entry to Reader
    // -------------------------------------------------------------
    console.log('\n--- 2. Testing Navigation from Timeline Entry to Reader ---');

    await evaluate(`(() => {
      const openBtn = document.querySelector('.timeline-entry-card[data-entry-id="hl-qa-1"] [data-action="open-passage"]');
      if (openBtn) openBtn.click();
    })()`);

    let targetReaderState = null;
    for (let i = 0; i < 25; i++) {
      await new Promise((r) => setTimeout(r, 400));
      targetReaderState = await evaluate(`(() => {
        const reader = window.nookApp?.reader;
        if (!reader || reader.activeBookId !== 'frankenstein') return null;
        return {
          activeBookId: reader.activeBookId,
          currentPageNumber: reader.currentPageNumber,
          pageObject: reader.pagination?.getPage(reader.currentPageNumber) || null
        };
      })()`);
      if (targetReaderState) break;
    }

    console.log('  ✓ Navigated to Book:', targetReaderState?.activeBookId);
    console.log('  ✓ Target Page Number in Reader:', targetReaderState?.currentPageNumber);
    if (!targetReaderState || targetReaderState.activeBookId !== 'frankenstein') {
      throw new Error('Failed to navigate from timeline entry to reader.');
    }

    // -------------------------------------------------------------
    // Test 3: STAGE 8 — Table of Contents Modal on Multiple Books
    // -------------------------------------------------------------
    console.log('\n--- 3. Testing Table of Contents Modal ---');

    const testBooks = [
      { id: 'frankenstein', expectedChaptersMin: 15, targetChapter: 3 },
      { id: 'pride-and-prejudice', expectedChaptersMin: 20, targetChapter: 5 },
      { id: 'alices-adventures-in-wonderland', expectedChaptersMin: 10, targetChapter: 2 },
      { id: 'the-great-gatsby', expectedChaptersMin: 8, targetChapter: 2 }
    ];

    for (const b of testBooks) {
      console.log(`\n  Testing TOC for "${b.id}"...`);
      await evaluate(`
        window.nookApp.navigateTo('reader', { bookId: '${b.id}', chapterNumber: 1, pageNumber: 1 });
      `);

      // Wait for reader to load
      await new Promise((r) => setTimeout(r, 800));

      // Open TOC modal via trigger button or method
      await evaluate(`(() => {
        window.nookApp.reader.openTableOfContents();
      })()`);

      await new Promise((r) => setTimeout(r, 300));

      const tocDOM = await evaluate(`(() => {
        const backdrop = document.querySelector('#tocBackdrop');
        if (!backdrop) return { exists: false };
        const heading = backdrop.querySelector('#tocHeading')?.textContent.trim() || '';
        const bookTitle = backdrop.querySelector('.toc-book-title')?.textContent.trim() || '';
        const chapterRows = Array.from(backdrop.querySelectorAll('.toc-row-btn')).map(r => ({
          chapterNumber: parseInt(r.getAttribute('data-chapter-number'), 10),
          pageNumber: parseInt(r.getAttribute('data-page-number'), 10),
          title: r.querySelector('.toc-title-text')?.textContent.trim() || '',
          isActive: r.classList.contains('is-active'),
          hasCurrentMarker: !!r.querySelector('.toc-current-marker')
        }));
        return {
          exists: true,
          heading,
          bookTitle,
          chaptersCount: chapterRows.length,
          chapterRows
        };
      })()`);

      console.log(`    ✓ TOC Modal Open: ${tocDOM.exists} (Heading: "${tocDOM.heading}", Book: "${tocDOM.bookTitle}")`);
      console.log(`    ✓ Total Chapters listed: ${tocDOM.chaptersCount}`);
      console.log(`    ✓ First Chapter: "${tocDOM.chapterRows[0]?.title}" -> Page ${tocDOM.chapterRows[0]?.pageNumber}`);
      console.log(`    ✓ Active/Current Chapter: Chapter ${tocDOM.chapterRows.find(c => c.isActive)?.chapterNumber}`);

      if (!tocDOM.exists || tocDOM.chaptersCount < b.expectedChaptersMin) {
        throw new Error(`TOC for book ${b.id} failed. Expected at least ${b.expectedChaptersMin} chapters, got ${tocDOM.chaptersCount}`);
      }

      // Test Chapter Navigation via TOC click
      console.log(`    Testing TOC jump to Chapter ${b.targetChapter}...`);
      await evaluate(`(() => {
        const row = document.querySelector('.toc-row-btn[data-chapter-number="${b.targetChapter}"]');
        if (row) row.click();
      })()`);

      await new Promise((r) => setTimeout(r, 600));

      const newReaderState = await evaluate(`(() => {
        const reader = window.nookApp?.reader;
        const curPage = reader?.pagination?.getPage(reader.currentPageNumber);
        return {
          activeBookId: reader?.activeBookId,
          currentPageNumber: reader?.currentPageNumber,
          chapterNumber: curPage?.chapterNumber
        };
      })()`);

      console.log(`    ✓ New Reader Position: Chapter ${newReaderState.chapterNumber}, Page ${newReaderState.currentPageNumber}`);
      if (newReaderState.chapterNumber !== b.targetChapter) {
        throw new Error(`TOC jump failed. Expected chapter ${b.targetChapter}, got ${newReaderState.chapterNumber}`);
      }
    }

    // -------------------------------------------------------------
    // Test 4: STAGE 8 — Keyboard Navigation (T to open, Esc to close)
    // -------------------------------------------------------------
    console.log('\n--- 4. Testing Keyboard Navigation for TOC ---');
    await evaluate(`(() => {
      window.nookApp.reader.openTableOfContents();
    })()`);
    await new Promise((r) => setTimeout(r, 200));

    const isOpenBeforeEsc = await evaluate(`!!document.querySelector('#tocBackdrop')`);
    console.log('  ✓ TOC is open:', isOpenBeforeEsc);

    // Dispatch Esc
    await evaluate(`(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    })()`);
    await new Promise((r) => setTimeout(r, 200));

    const isClosedAfterEsc = await evaluate(`!document.querySelector('#tocBackdrop')`);
    console.log('  ✓ TOC successfully closed on Esc key:', isClosedAfterEsc);

    if (!isOpenBeforeEsc || !isClosedAfterEsc) {
      throw new Error('Keyboard Esc modal close failed.');
    }

    // -------------------------------------------------------------
    // Test 5: STAGE 7 & 8 — Mobile Viewport Overflow QA
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

    console.log('\n================ ALL STAGES 7 & 8 BROWSER QA TESTS PASSED! ================');

  } finally {
    try { edgeProc.kill(); } catch (e) {}
    try { serverProc.kill(); } catch (e) {}
  }
}

main().catch((err) => {
  console.error('\n❌ BROWSER QA ERROR:', err);
  process.exit(1);
});
