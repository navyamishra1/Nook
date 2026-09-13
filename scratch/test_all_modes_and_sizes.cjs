const { spawn } = require('child_process');
const http = require('http');
const nodeFs = require('fs');
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
  if (!nodeFs.existsSync(filePath)) {
    filePath = path.join(__dirname, '..', reqPath);
  }

  if (nodeFs.existsSync(filePath) && nodeFs.statSync(filePath).isFile()) {
    const ext = path.extname(filePath);
    res.writeHead(200, {
      'Content-Type': MIME_TYPES[ext] || 'application/octet-stream',
      'Access-Control-Allow-Origin': '*'
    });
    nodeFs.createReadStream(filePath).pipe(res);
  } else {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not Found');
  }
});

const PORT = 5012;
const DEBUG_PORT = 9342;

server.listen(PORT, async () => {
  const edge = spawn(edgePath, [
    '--headless=new',
    `--remote-debugging-port=${DEBUG_PORT}`,
    '--window-size=1440,900',
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
          await new Promise((r) => setTimeout(r, 2000));

          async function evaluate(expression, awaitPromise = true) {
            const res = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise });
            if (!res) return null;
            if (res.exceptionDetails) {
              console.error('Eval exception:', res.exceptionDetails);
            }
            return res.result ? res.result.value : res;
          }

          await evaluate(`document.fonts.ready`, true);

          // Skip entry
          await evaluate(`
            if (window.nookApp && window.nookApp.entry) {
              window.nookApp.entry.skipEntry(false);
            }
          `);
          await new Promise((r) => setTimeout(r, 300));

          const testBooks = [
            'crime-and-punishment',
            'oliver-twist',
            'frankenstein',
            'pride-and-prejudice',
            'alices-adventures-in-wonderland',
            'the-great-gatsby'
          ];

          let allPass = true;

          for (const bookId of testBooks) {
            console.log(`\n======================================================`);
            console.log(`TESTING BOOK: ${bookId}`);
            console.log(`======================================================`);

            for (const mode of ['normal', 'focus']) {
              console.log(`\n--- MODE: ${mode.toUpperCase()} ---`);

              await evaluate(`
                window.nookApp.navigateTo('reader', { bookId: '${bookId}', chapterNumber: 1, pageNumber: 1 });
              `);

              for (let i = 0; i < 50; i++) {
                const ready = await evaluate(`!!(window.nookApp.reader && !window.nookApp.reader.isLoading && window.nookApp.reader.pagination)`);
                if (ready) break;
                await new Promise((r) => setTimeout(r, 80));
              }

              if (mode === 'focus') {
                await evaluate(`
                  if (window.nookApp.reader && !window.nookApp.reader.isFocusedMode) {
                    window.nookApp.reader.isFocusedMode = true;
                    document.body.classList.add('in-focused-reading-mode');
                    window.nookApp.reader.render();
                  }
                `);
              } else {
                await evaluate(`
                  if (window.nookApp.reader && window.nookApp.reader.isFocusedMode) {
                    window.nookApp.reader.isFocusedMode = false;
                    document.body.classList.remove('in-focused-reading-mode');
                    window.nookApp.reader.render();
                  }
                `);
              }
              await new Promise((r) => setTimeout(r, 200));

              for (const size of ['sm', 'md', 'lg']) {
                await evaluate(`window.nookApp.reader.setFontSize('${size}')`);
                await new Promise((r) => setTimeout(r, 150));

                for (let p = 1; p <= 3; p++) {
                  await evaluate(`
                    window.nookApp.reader.goToPage(${p});
                  `);
                  await new Promise((r) => setTimeout(r, 100));

                  const m = await evaluate(`
                    (() => {
                      const page = document.getElementById('readerPaperPage');
                      const prose = document.getElementById('readerProseContent');
                      const footer = document.querySelector('.reader-paper-footer-row');
                      const prevBtn = document.getElementById('readerPaperCornerPrev');
                      const pageRect = page.getBoundingClientRect();
                      const footerRect = footer ? footer.getBoundingClientRect() : null;

                      const paras = Array.from(prose.querySelectorAll('p'));
                      const lastPara = paras[paras.length - 1];

                      let lastLineBottom = 0;
                      if (lastPara) {
                        const range = document.createRange();
                        range.selectNodeContents(lastPara);
                        const rects = Array.from(range.getClientRects());
                        if (rects.length > 0) {
                          lastLineBottom = rects[rects.length - 1].bottom - pageRect.top;
                        } else {
                          lastLineBottom = lastPara.getBoundingClientRect().bottom - pageRect.top;
                        }
                      }

                      const footerTop = footerRect ? (footerRect.top - pageRect.top) : (pageRect.height - 64);
                      const clearance = footerTop - lastLineBottom;

                      return {
                        pageHeight: pageRect.height,
                        lastLineBottom,
                        footerTop,
                        clearance,
                        pass: clearance >= 35
                      };
                    })()
                  `);

                  if (!m.pass) allPass = false;
                  console.log(`[${bookId}] ${mode} | ${size} | Page ${p}: lastLine=${m.lastLineBottom.toFixed(1)}px | footerTop=${m.footerTop.toFixed(1)}px | clearance=${m.clearance.toFixed(1)}px | PASS=${m.pass}`);
                }
              }
            }
          }

          console.log(`\n======================================================`);
          console.log(`OVERALL RESULT: ${allPass ? '100% ALL TESTS PASSED (GREEN)' : 'FAILED'}`);
          console.log(`======================================================`);

          ws.close();
          edge.kill();
          server.close();
          process.exit(allPass ? 0 : 1);
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
