const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');

const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';

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

const PORT = 4914;
const DEBUG_PORT = 9234;

server.listen(PORT, async () => {
  const edge = spawn(edgePath, [
    '--headless=new',
    `--remote-debugging-port=${DEBUG_PORT}`,
    '--disable-gpu',
    '--no-first-run',
    '--no-default-browser-check',
    `http://localhost:${PORT}`
  ]);

  await new Promise((r) => setTimeout(r, 2000));

  http.get(`http://127.0.0.1:${DEBUG_PORT}/json`, (res) => {
    let data = '';
    res.on('data', (c) => (data += c));
    res.on('end', async () => {
      try {
        const pages = JSON.parse(data);
        const targetPage = pages.find((p) => p.url.includes(`localhost:${PORT}`));
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
            const parsed = JSON.parse(event.data);
            if (parsed.id && pending.has(parsed.id)) {
              pending.get(parsed.id)(parsed.result);
              pending.delete(parsed.id);
            }
          });

          await send('Runtime.enable');
          await send('Page.enable');
          await send('DOM.enable');

          await send('Page.navigate', { url: `http://localhost:${PORT}` });
          await new Promise((r) => setTimeout(r, 1500));

          async function evaluate(expression, awaitPromise = true) {
            const res = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise });
            if (!res) return null;
            if (res.exceptionDetails) {
              console.error('Eval exception:', res.exceptionDetails);
            }
            return res.result ? res.result.value : res;
          }

          for (let i = 0; i < 40; i++) {
            const isReady = await evaluate(`!!(window.nookApp && window.nookApp.catalog)`);
            if (isReady) break;
            await new Promise((r) => setTimeout(r, 100));
          }

          // Test lines per page capacity in DOM measurer
          const capacity = await evaluate(`
            (() => {
              const measurer = document.getElementById('nook-pagination-measurer') || document.createElement('div');
              measurer.id = 'nook-pagination-measurer';
              if (!measurer.parentElement) document.body.appendChild(measurer);

              const results = {};
              const fontSizes = ['sm', 'md', 'lg'];

              for (const fs of fontSizes) {
                measurer.className = 'reader-paper-page reader-paper-measurer font-' + fs;
                
                // Chapter 1 Header vs Running Header
                const ch1Header = '<header class="reader-prose-header"><div class="reader-ornament">❦</div><h1 class="reader-prose-chapter-title">Chapter 1</h1><div class="reader-prose-book-title">Test Book</div><div class="reader-prose-author">by Author</div><div class="reader-divider"></div></header>';
                const runningHeader = '<div class="reader-page-running-header"><span class="reader-running-title">Test Book</span> · <span class="reader-running-chapter">Chapter 1</span></div>';
                
                // Standard test line generator
                // Generate N single-line paragraphs or 1 continuous paragraph
                function testLines(headerHtml, lineCount, isChapterFirst) {
                  const singleLine = 'This is a single calibrated line of book prose representing standard English sentence rhythm.';
                  const text = Array(lineCount).fill(singleLine).join(' ');
                  const dropCap = isChapterFirst ? 'has-drop-cap' : '';
                  measurer.innerHTML = \`
                    <div class="reader-paper-spine-shadow" aria-hidden="true"></div>
                    \${headerHtml}
                    <article class="reader-prose font-\${fs} \${isChapterFirst ? 'is-chapter-start' : ''}">
                      <p class="\${dropCap}">\${text}</p>
                    </article>
                    <div class="reader-paper-footer-row" aria-label="Page navigation">
                      <button class="reader-paper-corner-nav prev-corner"><span class="corner-nav-arrow">←</span></button>
                      <div class="reader-paper-page-number">— 1 —</div>
                      <button class="reader-paper-corner-nav next-corner"><span class="corner-nav-arrow">→</span></button>
                    </div>
                  \`;

                  const clientH = measurer.clientHeight || 848;
                  const footer = measurer.querySelector('.reader-paper-footer-row');
                  const footerTop = footer ? (footer.getBoundingClientRect().top - measurer.getBoundingClientRect().top) : (clientH - 64);
                  const pEl = measurer.querySelector('p');
                  const pBottom = pEl ? (pEl.getBoundingClientRect().bottom - measurer.getBoundingClientRect().top) : 0;
                  const gap = footerTop - pBottom;

                  return {
                    lineCount,
                    footerTop,
                    pBottom,
                    gap,
                    fits: gap >= 16 && measurer.scrollHeight <= clientH
                  };
                }

                // Find max lines for regular page
                let maxRegular = 0;
                for (let l = 15; l <= 35; l++) {
                  const r = testLines(runningHeader, l, false);
                  if (r.fits) maxRegular = l;
                }

                // Find max lines for chapter 1 page
                let maxCh1 = 0;
                for (let l = 10; l <= 30; l++) {
                  const r = testLines(ch1Header, l, true);
                  if (r.fits) maxCh1 = l;
                }

                results[fs] = { maxRegular, maxCh1 };
              }

              return results;
            })()
          `);

          console.log('\n--- MEASURER CAPACITY FOR FONT SIZES (GAP >= 16px) ---');
          console.log(JSON.stringify(capacity, null, 2));

          ws.close();
          edge.kill();
          server.close();
          process.exit(0);
        });
      } catch (e) {
        console.error(e);
        edge.kill();
        server.close();
        process.exit(1);
      }
    });
  });
});
