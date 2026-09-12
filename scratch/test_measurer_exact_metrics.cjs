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

const PORT = 4912;
const DEBUG_PORT = 9232;

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

          const metrics = await evaluate(`
            (() => {
              const measurer = document.getElementById('nook-pagination-measurer') || document.createElement('div');
              measurer.id = 'nook-pagination-measurer';
              measurer.className = 'reader-paper-page reader-paper-measurer font-md';
              if (!measurer.parentElement) document.body.appendChild(measurer);

              const headerHtml = '<div class="reader-page-running-header" aria-hidden="true"><span class="reader-running-title">Test Book</span> · <span class="reader-running-chapter">Chapter 1</span></div>';
              
              // Let's create a test with 5 paragraphs of varying lengths
              const paras = [
                'It is a truth universally acknowledged, that a single man in possession of a good fortune, must be in want of a wife.',
                'However little known the feelings or views of such a man may be on his first entering a neighbourhood, this truth is so well fixed in the minds of the surrounding families, that he is considered as the rightful property of some one or other of their daughters.',
                '“My dear Mr. Bennet,” said his lady to him one day, “have you heard that Netherfield Park is let at last?”',
                'Mr. Bennet replied that he had not.',
                '“But it is,” returned she; “for Mrs. Long has just been here, and she told me all about it.” Mr. Bennet made no answer. “Do not you want to know who has taken it?” cried his wife impatiently.'
              ];

              measurer.innerHTML = \`
                <div class="reader-paper-spine-shadow" aria-hidden="true"></div>
                \${headerHtml}
                <article class="reader-prose font-md">
                  \${paras.map(p => \`<p>\${p}</p>\`).join('')}
                </article>
                <div class="reader-paper-footer-row" aria-label="Page navigation">
                  <button class="reader-paper-corner-nav prev-corner"><span class="corner-nav-arrow">←</span></button>
                  <div class="reader-paper-page-number">— 1 —</div>
                  <button class="reader-paper-corner-nav next-corner"><span class="corner-nav-arrow">→</span></button>
                </div>
              \`;

              const clientH = measurer.clientHeight;
              const scrollH = measurer.scrollHeight;
              const proseEl = measurer.querySelector('.reader-prose');
              const lastPara = proseEl.querySelector('p:last-of-type');
              const footerEl = measurer.querySelector('.reader-paper-footer-row');

              const mRect = measurer.getBoundingClientRect();
              const pRect = proseEl.getBoundingClientRect();
              const lpRect = lastPara ? lastPara.getBoundingClientRect() : null;
              const fRect = footerEl ? footerEl.getBoundingClientRect() : null;

              return {
                measurer: { clientH, scrollH, height: mRect.height },
                prose: { offsetTop: proseEl.offsetTop, offsetHeight: proseEl.offsetHeight, bottomFromPageTop: pRect.bottom - mRect.top },
                lastPara: lpRect ? { bottomFromPageTop: lpRect.bottom - mRect.top, height: lpRect.height } : null,
                footer: fRect ? { topFromPageTop: fRect.top - mRect.top, height: fRect.height } : null,
                computedPadding: window.getComputedStyle(measurer).padding,
                prosePaddingBottom: window.getComputedStyle(proseEl).paddingBottom,
                lastParaMarginBottom: lastPara ? window.getComputedStyle(lastPara).marginBottom : null
              };
            })()
          `);

          console.log('\n--- MEASURER EXACT METRICS ---');
          console.log(JSON.stringify(metrics, null, 2));

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
