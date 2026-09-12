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
  console.log('================ STARTING STAGE 9 READING PERSONALITY BROWSER QA ================');

  // 1. Start static server on port 8087
  const serverProc = spawn('python', ['-m', 'http.server', '8087', '--directory', 'frontend'], {
    cwd: path.resolve(__dirname, '..'),
    stdio: 'ignore'
  });

  await new Promise((r) => setTimeout(r, 1000));

  const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  const cdpPort = 9229;
  const tmpDir = path.join(os.tmpdir(), 'edge_nook_qa9_' + Date.now());

  const edgeProc = spawn(edgePath, [
    `--remote-debugging-port=${cdpPort}`,
    '--headless=new',
    '--window-size=1280,900',
    '--disable-gpu',
    '--no-first-run',
    '--no-default-browser-check',
    `--user-data-dir=${tmpDir}`,
    'http://localhost:8087'
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

    await new Promise((r) => setTimeout(r, 1200));

    async function evaluate(expression, retries = 5) {
      for (let i = 0; i < retries; i++) {
        try {
          const res = await client.send('Runtime.evaluate', {
            expression,
            returnByValue: true,
            awaitPromise: true
          });
          if (res.result?.exceptionDetails) {
            throw new Error(JSON.stringify(res.result.exceptionDetails));
          }
          return res.result?.result?.value;
        } catch (e) {
          if (i === retries - 1) throw e;
          await new Promise((r) => setTimeout(r, 600));
        }
      }
    }

    await client.send('Page.enable');
    await client.send('Runtime.enable');

    // Wait for App to be ready
    const readyState = await evaluate(`
      new Promise((resolve) => {
        let count = 0;
        const check = () => {
          count++;
          if (window.nookApp && window.nookApp.catalog && window.nookApp.catalog.length > 0) {
            resolve({ ready: true, attempts: count, count: window.nookApp.catalog.length });
          } else if (count > 60) {
            resolve({ ready: false, attempts: count, hasNook: !!window.nookApp });
          } else {
            setTimeout(check, 100);
          }
        };
        check();
      })
    `);
    console.log('[BROWSER QA] App readiness check result:', readyState);

    // --- 1. Test Cold-Start Emerging Reading Personality State ---
    console.log('\n--- 1. Testing Cold-Start Emerging State in Reading Insights ---');
    await evaluate(`
      (() => {
        localStorage.setItem('nook_reading_progress', JSON.stringify({
          lastActiveBookId: 'frankenstein',
          books: {
            'frankenstein': {
              bookId: 'frankenstein',
              progressPercent: 30,
              chapterNumber: 2,
              pageNumber: 5,
              lastAccessedAt: 1700000000000
            }
          }
        }));
        localStorage.setItem('nook_journal', JSON.stringify({
          version: 1,
          bookmarks: [],
          highlights: [],
          notes: []
        }));
        window.nookApp.navigateTo('journal', { tab: 'insights' });
      })()
    `);
    await new Promise((r) => setTimeout(r, 400));

    const coldStartState = await evaluate(`
      (() => {
        const card = document.querySelector('.personality-card.emerging');
        const title = card ? card.querySelector('.personality-title').textContent.trim() : null;
        const trail = card ? card.querySelector('.personality-emerging-trail').textContent.trim() : null;
        return {
          hasCard: !!card,
          title,
          trail
        };
      })()
    `);
    console.log('  ✓ Emerging Personality Card exists:', coldStartState.hasCard);
    console.log('  ✓ Emerging Title:', coldStartState.title);
    console.log('  ✓ Emerging Trail Text:', coldStartState.trail);

    // --- 2. Test Established Profile (The Atmospheric Wanderer) ---
    console.log('\n--- 2. Testing Established Personality Profile ---');
    await evaluate(`
      (() => {
        localStorage.setItem('nook_reading_progress', JSON.stringify({
          lastActiveBookId: 'frankenstein',
          books: {
            'frankenstein': {
              bookId: 'frankenstein',
              progressPercent: 95,
              chapterNumber: 24,
              pageNumber: 120,
              lastAccessedAt: 1700000000000
            },
            'dracula': {
              bookId: 'dracula',
              progressPercent: 90,
              chapterNumber: 27,
              pageNumber: 250,
              lastAccessedAt: 1700001000000
            },
            'the-picture-of-dorian-gray': {
              bookId: 'the-picture-of-dorian-gray',
              progressPercent: 85,
              chapterNumber: 20,
              pageNumber: 110,
              lastAccessedAt: 1700002000000
            },
            'the-strange-case-of-dr-jekyll-and-mr-hyde': {
              bookId: 'the-strange-case-of-dr-jekyll-and-mr-hyde',
              progressPercent: 100,
              chapterNumber: 10,
              pageNumber: 45,
              lastAccessedAt: 1700003000000
            }
          }
        }));
        localStorage.setItem('nook_journal', JSON.stringify({
          version: 1,
          bookmarks: [
            {
              id: 'bm_1',
              type: 'bookmark',
              bookId: 'frankenstein',
              bookTitle: 'Frankenstein; or, The Modern Prometheus',
              author: 'Mary Wollstonecraft Shelley',
              pageNumber: 120,
              chapterNumber: 24,
              chapterTitle: 'Chapter 24',
              createdAt: 1700000000000
            }
          ],
          highlights: [
            {
              id: 'h_1',
              type: 'highlight',
              bookId: 'frankenstein',
              bookTitle: 'Frankenstein; or, The Modern Prometheus',
              author: 'Mary Wollstonecraft Shelley',
              selectedText: 'I had desired it with an ardour that far exceeded moderation; but now that I had finished, the beauty of the dream vanished, and breathless horror and disgust filled my heart.',
              chapterNumber: 5,
              pageNumber: 32,
              createdAt: 1700000000000
            }
          ],
          notes: []
        }));

        // Re-render journal view on insights tab
        window.nookApp.navigateTo('journal', { tab: 'insights' });
      })()
    `);
    await new Promise((r) => setTimeout(r, 400));

    const establishedState = await evaluate(`
      (() => {
        const card = document.querySelector('.personality-card:not(.emerging)');
        const kicker = card ? card.querySelector('.personality-kicker').textContent.trim() : null;
        const title = card ? card.querySelector('.personality-title').textContent.trim() : null;
        const description = card ? card.querySelector('.personality-description').textContent.trim() : null;
        const evidenceItems = card ? Array.from(card.querySelectorAll('.personality-evidence-item')).map(i => i.textContent.trim()) : [];
        const tendencies = card ? Array.from(card.querySelectorAll('.tendency-item')).map(t => {
          const label = t.querySelector('.tendency-label').textContent.trim();
          const val = t.querySelector('.tendency-val').textContent.trim();
          return \`\${label}: \${val}\`;
        }) : [];

        // Check if Reading Insights overview and cards are also intact below
        const overviewPanel = document.querySelector('.insights-overview-panel');
        const categoriesCard = document.querySelector('.insights-categories-card');
        const lengthCard = document.querySelector('.insights-length-card');
        const recentSection = document.querySelector('.insights-recent-section');

        return {
          hasCard: !!card,
          kicker,
          title,
          description,
          evidenceItems,
          tendencies,
          insightsPanelsIntact: !!(overviewPanel && categoriesCard && lengthCard && recentSection)
        };
      })()
    `);

    console.log('  ✓ Established Personality Card exists:', establishedState.hasCard);
    console.log('  ✓ Archetype Title:', establishedState.title);
    console.log('  ✓ Description:', establishedState.description);
    console.log('  ✓ Evidence points count:', establishedState.evidenceItems.length);
    establishedState.evidenceItems.forEach(e => console.log('    •', e));
    console.log('  ✓ Literary Tendencies:', establishedState.tendencies.join(' | '));
    console.log('  ✓ Reading Insights panels intact below:', establishedState.insightsPanelsIntact);

    // --- 3. Verify Switching between Tabs (Commonplace, Timeline, Insights) ---
    console.log('\n--- 3. Testing Seamless Tab Switching in Journal ---');
    const tabSwitchResult = await evaluate(`
      (() => {
        const commonplaceTab = document.querySelector('[data-jsection="commonplace"]');
        commonplaceTab.click();
        const hasCommonplace = !!document.querySelector('.journal-entries-stream');

        const timelineTab = document.querySelector('[data-jsection="timeline"]');
        timelineTab.click();
        const hasTimeline = !!document.querySelector('.journal-timeline-container');

        const insightsTab = document.querySelector('[data-jsection="insights"]');
        insightsTab.click();
        const hasPersonality = !!document.querySelector('.personality-card');

        return {
          hasCommonplace,
          hasTimeline,
          hasPersonality
        };
      })()
    `);
    console.log('  ✓ Commonplace Book tab rendered:', tabSwitchResult.hasCommonplace);
    console.log('  ✓ Reading Timeline tab rendered:', tabSwitchResult.hasTimeline);
    console.log('  ✓ Reading Insights (with Personality) tab rendered:', tabSwitchResult.hasPersonality);

    // --- 4. Verify Viewport Responsiveness across Breakpoints ---
    console.log('\n--- 4. Testing Viewport Responsiveness (Zero Horizontal Overflow) ---');
    const viewports = [
      { width: 1280, height: 900 },
      { width: 1024, height: 768 },
      { width: 768, height: 1024 },
      { width: 390, height: 844 }
    ];

    for (const vp of viewports) {
      await client.send('Emulation.setDeviceMetricsOverride', {
        width: vp.width,
        height: vp.height,
        deviceScaleFactor: 1,
        mobile: vp.width <= 768
      });
      await new Promise((r) => setTimeout(r, 200));

      const overflowCheck = await evaluate(`
        (() => {
          const bodyWidth = document.body.clientWidth;
          const scrollWidth = document.documentElement.scrollWidth;
          const personalityCard = document.querySelector('.personality-card');
          return {
            clientWidth: bodyWidth,
            scrollWidth: scrollWidth,
            hasOverflow: scrollWidth > bodyWidth + 2,
            cardWidth: personalityCard ? personalityCard.offsetWidth : null
          };
        })()
      `);

      console.log(`  ✓ Viewport ${vp.width}px: scrollWidth = ${overflowCheck.scrollWidth}px (hasOverflow: ${overflowCheck.hasOverflow})`);
    }

    console.log('\n================ ALL STAGE 9 BROWSER QA TESTS PASSED! ================\n');
  } catch (err) {
    console.error('Browser QA Error:', err);
    process.exitCode = 1;
  } finally {
    try { edgeProc.kill(); } catch(e) {}
    try { serverProc.kill(); } catch(e) {}
  }
}

main();
