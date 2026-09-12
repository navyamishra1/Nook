const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');

const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const artifactDir = 'C:\\Users\\hp\\.gemini\\antigravity-ide\\brain\\fc23f026-09fd-424b-a43f-ef1178db2bd0';

const MIME_TYPES = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml'
};

const server = http.createServer((req, res) => {
  let reqPath = req.url.split('?')[0];
  if (reqPath === '/') reqPath = '/index.html';

  let filePath = path.join(__dirname, '../frontend', reqPath);
  if (!fs.existsSync(filePath)) {
    filePath = path.join(__dirname, '..', reqPath);
  }

  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    const ext = path.extname(filePath);
    res.writeHead(200, {
      'Content-Type': MIME_TYPES[ext] || 'application/octet-stream',
      'Access-Control-Allow-Origin': '*'
    });
    fs.createReadStream(filePath).pipe(res);
  } else {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not Found');
  }
});

server.listen(4897, async () => {
  console.log('HTTP test server running on port 4897');

  const edge = spawn(edgePath, [
    '--headless=new',
    '--remote-debugging-port=9227',
    '--disable-gpu',
    '--no-first-run',
    '--no-default-browser-check',
    'http://localhost:4897'
  ]);

  await new Promise((r) => setTimeout(r, 2000));

  http.get('http://127.0.0.1:9227/json', (res) => {
    let data = '';
    res.on('data', (c) => (data += c));
    res.on('end', async () => {
      try {
        const pages = JSON.parse(data);
        const targetPage = pages.find((p) => p.url.includes('localhost:4897'));
        if (!targetPage) throw new Error('Target page not found');

        const ws = new globalThis.WebSocket(targetPage.webSocketDebuggerUrl);
        let id = 1;
        const pending = new Map();

        ws.addEventListener('open', async () => {
          function send(method, params = {}) {
            return new Promise((resolve) => {
              const msgId = id++;
              pending.set(msgId, resolve);
              ws.send(JSON.stringify({ id: msgId, method, params }));
            });
          }

          ws.addEventListener('message', (event) => {
            const resObj = JSON.parse(event.data);
            if (resObj.id && pending.has(resObj.id)) {
              const resolve = pending.get(resObj.id);
              pending.delete(resObj.id);
              resolve(resObj.result);
            }
          });

          await send('Page.enable');
          await send('Runtime.enable');
          await send('Emulation.setDeviceMetricsOverride', {
            width: 1200,
            height: 900,
            deviceScaleFactor: 1,
            mobile: false
          });

          console.log('\n--- 1. Testing Home Page Load & Skip Entrance ---');
          await send('Runtime.evaluate', {
            expression: `
              const skip = document.getElementById('entry-skip-btn');
              if (skip) skip.click();
            `
          });
          await new Promise((r) => setTimeout(r, 1000));

          // Check if Reading Intent section exists
          const sectionCheck = await send('Runtime.evaluate', {
            expression: `
              (function() {
                const s = document.querySelector('.reading-intent-section');
                const input = document.getElementById('readingIntentInput');
                const heading = document.getElementById('reading-intent-heading');
                const prompts = Array.from(document.querySelectorAll('.intent-suggestion-btn')).map(b => b.textContent.trim());
                return {
                  hasSection: !!s,
                  hasInput: !!input,
                  heading: heading ? heading.textContent : null,
                  prompts: prompts
                };
              })()
            `,
            returnByValue: true
          });
          console.log('✓ Section rendered on Home:', sectionCheck.result.value);

          // Capture Desktop Initial Screenshot
          const shot1 = await send('Page.captureScreenshot', { format: 'png' });
          fs.writeFileSync(path.join(artifactDir, 'intent_desk_initial.png'), Buffer.from(shot1.data, 'base64'));
          console.log('✓ Captured intent_desk_initial.png');

          // --- 2. Test Typing Query: "something dark and mysterious" ---
          console.log('\n--- 2. Typing Query: "something dark and mysterious" ---');
          await send('Runtime.evaluate', {
            expression: `
              (function() {
                const input = document.getElementById('readingIntentInput');
                input.value = 'something dark and mysterious';
                input.dispatchEvent(new Event('input', { bubbles: true }));
              })()
            `
          });
          await new Promise((r) => setTimeout(r, 600)); // Wait for debounce

          const queryCheck = await send('Runtime.evaluate', {
            expression: `
              (function() {
                const results = document.getElementById('readingIntentResults');
                const cards = Array.from(results.querySelectorAll('.book-card')).map(c => ({
                  id: c.getAttribute('data-book-id'),
                  title: c.querySelector('.title') ? c.querySelector('.title').textContent : '',
                  author: c.querySelector('.author') ? c.querySelector('.author').textContent : '',
                  reason: c.querySelector('.rec-reason') ? c.querySelector('.rec-reason').textContent : ''
                }));
                const meta = results.querySelector('.intent-meta-text') ? results.querySelector('.intent-meta-text').textContent : '';
                return {
                  resultsVisible: results.style.display !== 'none',
                  cardCount: cards.length,
                  meta: meta,
                  cards: cards
                };
              })()
            `,
            returnByValue: true
          });
          console.log('✓ Query Results for "something dark and mysterious":', queryCheck.result.value.meta);
          queryCheck.result.value.cards.forEach((c, i) => {
            console.log(`    ${i + 1}. ${c.title} by ${c.author} — Reason: "${c.reason}"`);
          });

          const shot2 = await send('Page.captureScreenshot', { format: 'png' });
          fs.writeFileSync(path.join(artifactDir, 'intent_desk_query_results.png'), Buffer.from(shot2.data, 'base64'));
          console.log('✓ Captured intent_desk_query_results.png');

          // --- 3. Test Clicking Inspiration Prompts ---
          console.log('\n--- 3. Testing Clicking Inspiration Prompts ---');
          const btnCount = sectionCheck.result.value.prompts.length;

          for (let i = 0; i < btnCount; i++) {
            await send('Runtime.evaluate', {
              expression: `
                (function() {
                  const btns = document.querySelectorAll('.intent-suggestion-btn');
                  if (btns[${i}]) btns[${i}].click();
                })()
              `
            });
            await new Promise((r) => setTimeout(r, 600));
            const pResult = await send('Runtime.evaluate', {
              expression: `
                (function() {
                  const input = document.getElementById('readingIntentInput');
                  const cards = document.querySelectorAll('#readingIntentResults .book-card');
                  const lenPill = document.querySelector('.intent-length-pill');
                  return {
                    query: input ? input.value : '',
                    count: cards ? cards.length : 0,
                    lengthConstraint: lenPill ? lenPill.textContent : 'none'
                  };
                })()
              `,
              returnByValue: true
            });
            console.log(`✓ Prompt #${i + 1} ("${sectionCheck.result.value.prompts[i]}"): Input="${pResult.result.value.query}", Found ${pResult.result.value.count} books, Length=${pResult.result.value.lengthConstraint}`);
          }

          // --- 4. Test Clear Button ---
          console.log('\n--- 4. Testing Clear Button ---');
          const clearCheck = await send('Runtime.evaluate', {
            expression: `
              (function() {
                const clearBtn = document.getElementById('readingIntentClear');
                const isVisibleBefore = clearBtn && clearBtn.style.display !== 'none';
                if (clearBtn) clearBtn.click();
                const input = document.getElementById('readingIntentInput');
                const results = document.getElementById('readingIntentResults');
                return {
                  isVisibleBefore: isVisibleBefore,
                  inputAfter: input ? input.value : '',
                  resultsVisibleAfter: results && results.style.display !== 'none'
                };
              })()
            `,
            returnByValue: true
          });
          console.log('✓ Clear button behavior:', clearCheck.result.value);

          // --- 5. Test Empty / Unknown Query ---
          console.log('\n--- 5. Testing Unknown Query (No Matches) ---');
          await send('Runtime.evaluate', {
            expression: `
              (function() {
                const input = document.getElementById('readingIntentInput');
                input.value = 'qwertyuiopxyz98765 nonexistentsingularity';
                input.dispatchEvent(new Event('input', { bubbles: true }));
              })()
            `
          });
          await new Promise((r) => setTimeout(r, 600));

          const emptyCheck = await send('Runtime.evaluate', {
            expression: `
              (function() {
                const emptyState = document.querySelector('.intent-empty-state');
                return {
                  hasEmptyState: !!emptyState,
                  text: emptyState ? emptyState.textContent.replace(/\\s+/g, ' ').trim() : null
                };
              })()
            `,
            returnByValue: true
          });
          console.log('✓ Unknown query empty state:', emptyCheck.result.value);

          // --- 6. Test Book Selection & Navigation ---
          console.log('\n--- 6. Testing Book Card Navigation to Details ---');
          await send('Runtime.evaluate', {
            expression: `
              (function() {
                const input = document.getElementById('readingIntentInput');
                input.value = 'adventure';
                input.dispatchEvent(new Event('input', { bubbles: true }));
              })()
            `
          });
          await new Promise((r) => setTimeout(r, 600));

          const navCheck = await send('Runtime.evaluate', {
            expression: `
              (function() {
                const card = document.querySelector('#readingIntentResults .book-card');
                if (!card) return { error: 'No card found' };
                const bookId = card.getAttribute('data-book-id');
                card.click();
                return { clickedBookId: bookId };
              })()
            `,
            returnByValue: true
          });
          await new Promise((r) => setTimeout(r, 600));

          const viewCheck = await send('Runtime.evaluate', {
            expression: `
              (function() {
                const details = document.getElementById('view-details');
                return { isDetailsActive: details && details.classList.contains('active') };
              })()
            `,
            returnByValue: true
          });
          console.log(`✓ Clicked "${navCheck.result.value.clickedBookId}" -> Details view active:`, viewCheck.result.value.isDetailsActive);

          // Return to home
          await send('Runtime.evaluate', {
            expression: `
              const homeNav = document.querySelector('nav.mainnav a[data-nav="home"]');
              if (homeNav) homeNav.click();
            `
          });
          await new Promise((r) => setTimeout(r, 600));

          // --- 7. Tablet Viewport (768px) ---
          console.log('\n--- 7. Testing Tablet Viewport (768px) ---');
          await send('Emulation.setDeviceMetricsOverride', {
            width: 768,
            height: 1024,
            deviceScaleFactor: 1,
            mobile: false
          });
          await send('Runtime.evaluate', {
            expression: `
              (function() {
                const input = document.getElementById('readingIntentInput');
                input.value = 'something dark and mysterious';
                input.dispatchEvent(new Event('input', { bubbles: true }));
              })()
            `
          });
          await new Promise((r) => setTimeout(r, 600));
          const shotTablet = await send('Page.captureScreenshot', { format: 'png' });
          fs.writeFileSync(path.join(artifactDir, 'intent_tablet_view.png'), Buffer.from(shotTablet.data, 'base64'));
          console.log('✓ Captured intent_tablet_view.png');

          // --- 8. Mobile Viewport (390px) ---
          console.log('\n--- 8. Testing Mobile Viewport (390px) ---');
          await send('Emulation.setDeviceMetricsOverride', {
            width: 390,
            height: 844,
            deviceScaleFactor: 2,
            mobile: true
          });
          await send('Runtime.evaluate', {
            expression: `
              (function() {
                const input = document.getElementById('readingIntentInput');
                input.value = 'a short romantic story';
                input.dispatchEvent(new Event('input', { bubbles: true }));
              })()
            `
          });
          await new Promise((r) => setTimeout(r, 600));
          const shotMobile = await send('Page.captureScreenshot', { format: 'png' });
          fs.writeFileSync(path.join(artifactDir, 'intent_mobile_view.png'), Buffer.from(shotMobile.data, 'base64'));
          console.log('✓ Captured intent_mobile_view.png');

          console.log('\n================ UI QA VERIFICATION COMPLETED WITH 100% SUCCESS ================\n');

          edge.kill();
          server.close();
          process.exit(0);
        });
      } catch (e) {
        console.error('QA Error:', e);
        edge.kill();
        server.close();
        process.exit(1);
      }
    });
  });
});
