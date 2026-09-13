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

const PORT = 4972;
const DEBUG_PORT = 9294;

server.listen(PORT, async () => {
  console.log(`Server running on http://localhost:${PORT}`);

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

          // Open Crime and Punishment in NORMAL mode
          console.log('Navigating to Crime and Punishment (Normal Reader Mode)...');
          await evaluate(`
            window.nookApp.navigateTo('reader', { bookId: 'crime-and-punishment', chapterNumber: 1, pageNumber: 3 });
          `);

          // Wait for load & pagination
          for (let i = 0; i < 50; i++) {
            const ready = await evaluate(`!!(window.nookApp.reader && !window.nookApp.reader.isLoading && window.nookApp.reader.pagination)`);
            if (ready) break;
            await new Promise((r) => setTimeout(r, 100));
          }

          // Ensure normal mode (not focused mode)
          await evaluate(`
            if (window.nookApp.reader && window.nookApp.reader.isFocusedMode) {
              window.nookApp.reader.toggleFocusedReadingMode();
            }
          `);
          await new Promise((r) => setTimeout(r, 300));

          // Find which page has "and has seen so"
          const pageSearch = await evaluate(`
            (() => {
              const r = window.nookApp.reader;
              const pag = r.pagination;
              const matches = [];
              for (let p = 1; p <= pag.totalPages; p++) {
                const pageObj = pag.getPage(p);
                const fullText = (pageObj.paragraphUnits || []).map(u => u.text).join(' ');
                if (fullText.includes('and has seen so') || fullText.includes('has seen so')) {
                  matches.push({ pageNumber: p, text: fullText });
                }
              }
              return { totalPages: pag.totalPages, matches };
            })()
          `);

          console.log('Target Search:', JSON.stringify(pageSearch, null, 2));

          const targetPageNum = (pageSearch.matches.length > 0) ? pageSearch.matches[0].pageNumber : 3;
          console.log(`Inspecting Target Page: ${targetPageNum}`);

          // Navigate to targetPageNum
          await evaluate(`
            window.nookApp.reader.goToPage(${targetPageNum});
          `);
          await new Promise((r) => setTimeout(r, 500));

          const measurements = await evaluate(`
            (() => {
              const page = document.getElementById('readerPaperPage');
              const prose = document.getElementById('readerProseContent');
              const footer = document.querySelector('.reader-paper-footer-row');
              const prevBtn = document.getElementById('readerPaperCornerPrev');
              const nextBtn = document.getElementById('readerPaperCornerNext');
              const folio = document.querySelector('.reader-paper-page-number');

              const pageRect = page.getBoundingClientRect();
              const proseRect = prose ? prose.getBoundingClientRect() : null;
              const footerRect = footer ? footer.getBoundingClientRect() : null;
              const prevRect = prevBtn ? prevBtn.getBoundingClientRect() : null;
              const nextRect = nextBtn ? nextBtn.getBoundingClientRect() : null;
              const folioRect = folio ? folio.getBoundingClientRect() : null;

              const paras = Array.from(prose.querySelectorAll('p'));
              const lastPara = paras[paras.length - 1];
              const lastParaRect = lastPara ? lastPara.getBoundingClientRect() : null;

              let lastLineRect = null;
              let allLineRects = [];
              if (lastPara) {
                const range = document.createRange();
                range.selectNodeContents(lastPara);
                const rects = Array.from(range.getClientRects());
                allLineRects = rects.map(r => ({
                  top: r.top,
                  bottom: r.bottom,
                  height: r.height,
                  topRelative: r.top - pageRect.top,
                  bottomRelative: r.bottom - pageRect.top
                }));
                if (rects.length > 0) {
                  const lr = rects[rects.length - 1];
                  lastLineRect = {
                    top: lr.top,
                    bottom: lr.bottom,
                    height: lr.height,
                    topRelative: lr.top - pageRect.top,
                    bottomRelative: lr.bottom - pageRect.top
                  };
                }
              }

              const pageStyle = window.getComputedStyle(page);
              const proseStyle = window.getComputedStyle(prose);
              const footerStyle = footer ? window.getComputedStyle(footer) : null;

              return {
                PAGE: {
                  width: pageRect.width,
                  height: pageRect.height,
                  top: pageRect.top,
                  bottom: pageRect.bottom,
                  paddingTop: pageStyle.paddingTop,
                  paddingBottom: pageStyle.paddingBottom,
                  paddingLeft: pageStyle.paddingLeft,
                  paddingRight: pageStyle.paddingRight,
                  boxSizing: pageStyle.boxSizing,
                  transform: pageStyle.transform
                },
                PROSE: {
                  top: proseRect ? proseRect.top - pageRect.top : 0,
                  bottom: proseRect ? proseRect.bottom - pageRect.top : 0,
                  height: proseRect ? proseRect.height : 0,
                  absoluteTop: proseRect ? proseRect.top : 0,
                  absoluteBottom: proseRect ? proseRect.bottom : 0,
                  fontSize: proseStyle.fontSize,
                  lineHeight: proseStyle.lineHeight,
                  marginTop: proseStyle.marginTop,
                  marginBottom: proseStyle.marginBottom
                },
                FOOTER: {
                  top: footerRect ? footerRect.top - pageRect.top : 0,
                  bottom: footerRect ? footerRect.bottom - pageRect.top : 0,
                  height: footerRect ? footerRect.height : 0,
                  absoluteTop: footerRect ? footerRect.top : 0,
                  position: footerStyle ? footerStyle.position : '',
                  bottomVal: footerStyle ? footerStyle.bottom : ''
                },
                NAV_BUTTONS: {
                  prevTop: prevRect ? prevRect.top - pageRect.top : 0,
                  prevBottom: prevRect ? prevRect.bottom - pageRect.top : 0,
                  nextTop: nextRect ? nextRect.top - pageRect.top : 0,
                  nextBottom: nextRect ? nextRect.bottom - pageRect.top : 0
                },
                FOLIO: {
                  top: folioRect ? folioRect.top - pageRect.top : 0,
                  bottom: folioRect ? folioRect.bottom - pageRect.top : 0
                },
                LAST_PARA: {
                  top: lastParaRect ? lastParaRect.top - pageRect.top : 0,
                  bottom: lastParaRect ? lastParaRect.bottom - pageRect.top : 0,
                  height: lastParaRect ? lastParaRect.height : 0,
                  text: lastPara ? lastPara.textContent : ''
                },
                LAST_LINE_GLYPH: lastLineRect,
                ALL_LINES_IN_LAST_PARA: allLineRects
              };
            })()
          `);

          console.log('\n======================================================');
          console.log('ACTUAL DOM MEASUREMENTS IN NORMAL READER MODE:');
          console.log('======================================================');
          console.log(JSON.stringify(measurements, null, 2));

          // Also capture screenshot of the exact page
          const clip = {
            x: Math.max(0, measurements.PAGE.width ? 0 : 0),
            y: 0,
            width: 1440,
            height: 900,
            scale: 1
          };
          const screenshotRes = await send('Page.captureScreenshot', { format: 'png' });
          if (screenshotRes && screenshotRes.data) {
            const imgPath = path.join(artifactDir, `diagnose_exact_page_${targetPageNum}_normal.png`);
            nodeFs.writeFileSync(imgPath, Buffer.from(screenshotRes.data, 'base64'));
            console.log(`Saved screenshot: diagnose_exact_page_${targetPageNum}_normal.png`);
          }

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
