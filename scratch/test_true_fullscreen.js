const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');

const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const artifactDir = 'C:\\Users\\hp\\.gemini\\antigravity-ide\\brain\\fc23f026-09fd-424b-a43f-ef1178db2bd0';

async function main() {
  console.log('[TEST] Launching browser to verify True Fullscreen Reading Mode...');
  const edge = spawn(edgePath, [
    '--headless=new',
    '--remote-debugging-port=9222',
    '--disable-gpu',
    '--no-first-run',
    '--no-default-browser-check',
    'http://localhost:8000'
  ]);

  await new Promise((r) => setTimeout(r, 2000));

  const req = http.get('http://127.0.0.1:9222/json', (res) => {
    let data = '';
    res.on('data', (c) => (data += c));
    res.on('end', async () => {
      try {
        const pages = JSON.parse(data);
        const targetPage = pages.find((p) => p.url.includes('localhost:8000'));
        if (!targetPage) {
          console.error('[ERROR] Could not find localhost:8000 target page');
          edge.kill();
          process.exit(1);
        }

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

          const consoleLogs = [];
          ws.addEventListener('message', (event) => {
            const parsed = JSON.parse(event.data);
            if (parsed.id && pending.has(parsed.id)) {
              pending.get(parsed.id)(parsed.result);
              pending.delete(parsed.id);
            }
            if (parsed.method === 'Runtime.consoleAPICalled') {
              const logMsg = parsed.params.args.map(a => a.value || a.description).join(' ');
              consoleLogs.push(logMsg);
              console.log('[BROWSER CONSOLE]', logMsg);
            }
          });

          await send('Runtime.enable');
          await send('Page.enable');
          await send('DOM.enable');
          await send('CSS.enable');

          async function evaluate(expression, awaitPromise = true) {
            const res = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise });
            return res.result ? res.result.value : res;
          }

          async function captureScreenshot(filename) {
            const ss = await send('Page.captureScreenshot', { format: 'png' });
            if (ss && ss.data) {
              const targetPath = path.join(artifactDir, filename);
              fs.writeFileSync(targetPath, Buffer.from(ss.data, 'base64'));
              console.log(`[SAVED SCREENSHOT] -> ${targetPath}`);
            }
          }

          // 1. Set Desktop 1920x1080 Viewport
          await send('Emulation.setDeviceMetricsOverride', {
            width: 1920,
            height: 1080,
            deviceScaleFactor: 1,
            mobile: false
          });

          // Skip entry animation
          await evaluate(`
            const skipBtn = document.getElementById('entry-skip-btn');
            if (skipBtn) skipBtn.click();
          `);
          await new Promise((r) => setTimeout(r, 600));

          // Open Frankenstein in Reader
          console.log('\n--- Step 1: Open Frankenstein in Reader ---');
          await evaluate(`
            if (window.nookApp) {
              window.nookApp.navigateTo('reader', { bookId: 'frankenstein' });
            }
          `);
          await new Promise((r) => setTimeout(r, 1500));

          // Jump to Chapter 3
          await evaluate(`
            const select = document.getElementById('readerChapterSelect');
            if (select) {
              select.value = "3";
              select.dispatchEvent(new Event('change'));
            }
          `);
          await new Promise((r) => setTimeout(r, 1000));

          const preFocus = await evaluate(`(() => {
            const pageEl = document.getElementById('readerPaperPage');
            const rect = pageEl ? pageEl.getBoundingClientRect() : null;
            return {
              pageNum: pageEl ? parseInt(pageEl.getAttribute('data-page-num'), 10) : null,
              width: rect ? rect.width : 0,
              height: rect ? rect.height : 0,
              ratio: rect ? (rect.width / rect.height).toFixed(3) : null
            };
          })()`);
          console.log('[NORMAL 1080P READER STATE]:', preFocus);

          // 2. Click Focus button to enter True Fullscreen Mode
          console.log('\n--- Step 2: Click Focus Button to Enter True Fullscreen Mode ---');
          await evaluate(`
            const focusBtn = document.getElementById('readerFocusBtn');
            if (focusBtn) focusBtn.click();
          `);
          await new Promise((r) => setTimeout(r, 800));

          const fullscreenInfo = await evaluate(`(() => {
            const pageEl = document.getElementById('readerPaperPage');
            const rect = pageEl ? pageEl.getBoundingClientRect() : null;
            const masthead = document.querySelector('header.masthead');
            const toolbar = document.querySelector('.reader-toolbar');
            const footerNav = document.querySelector('.reader-footer-nav');
            const exitBtn = document.getElementById('readerFocusExitBtn');
            const exitBtnStyle = exitBtn ? window.getComputedStyle(exitBtn) : null;
            const prose = document.getElementById('readerProseContent');
            const proseStyle = prose ? window.getComputedStyle(prose) : null;
            const titleEl = document.querySelector('.reader-prose-chapter-title');
            const titleStyle = titleEl ? window.getComputedStyle(titleEl) : null;
            return {
              pageNum: pageEl ? parseInt(pageEl.getAttribute('data-page-num'), 10) : null,
              width: rect ? rect.width : 0,
              height: rect ? rect.height : 0,
              ratio: rect ? (rect.width / rect.height).toFixed(3) : null,
              hasDynamicExpansion: rect ? rect.height > 850 : false,
              isFocused: document.body.classList.contains('in-focused-reading-mode'),
              hasFsElement: !!(document.fullscreenElement || document.webkitFullscreenElement),
              mastheadDisplay: masthead ? window.getComputedStyle(masthead).display : 'none',
              toolbarDisplay: toolbar ? window.getComputedStyle(toolbar).display : 'none',
              footerNavDisplay: footerNav ? window.getComputedStyle(footerNav).display : 'none',
              exitBtnVisible: exitBtnStyle ? (exitBtnStyle.display !== 'none' && exitBtnStyle.opacity !== '0') : false,
              proseFontSize: proseStyle ? proseStyle.fontSize : '',
              proseLineHeight: proseStyle ? proseStyle.lineHeight : '',
              titleFontSize: titleStyle ? titleStyle.fontSize : ''
            };
          })()`);
          console.log('[TRUE FULLSCREEN 1080P STATE]:', fullscreenInfo);
          await captureScreenshot('qa_true_fullscreen_1080p.png');

          // 3. Test on-page Corner Navigation
          console.log('\n--- Step 3: Turn Page via On-Page Corner Arrows in Fullscreen ---');
          const startPage = fullscreenInfo.pageNum;
          await evaluate(`
            const nextCorner = document.getElementById('readerPaperCornerNext');
            if (nextCorner) nextCorner.click();
          `);
          await new Promise((r) => setTimeout(r, 1000));

          const pageAfterCorner = await evaluate(`(() => {
            const pageEl = document.getElementById('readerPaperPage');
            return {
              pageNum: pageEl ? parseInt(pageEl.getAttribute('data-page-num'), 10) : null,
              folioText: pageEl ? (pageEl.querySelector('.reader-paper-page-number')?.textContent.trim() || '') : ''
            };
          })()`);
          console.log('[AFTER CORNER NEXT CLICK]:', pageAfterCorner);

          // 4. Test Dark Theme in Fullscreen
          console.log('\n--- Step 4: Test Dark Theme in True Fullscreen ---');
          await evaluate(`
            if (window.nookApp && window.nookApp.reader) {
              window.nookApp.reader.setTheme('dark');
            }
          `);
          await new Promise((r) => setTimeout(r, 600));
          await captureScreenshot('qa_true_fullscreen_dark.png');

          // 5. Test Exit Fullscreen via Exit Button
          console.log('\n--- Step 5: Test Exit Fullscreen via Exit Button ---');
          await evaluate(`
            const exitBtn = document.getElementById('readerFocusExitBtn');
            if (exitBtn) exitBtn.click();
          `);
          await new Promise((r) => setTimeout(r, 600));

          const postExitInfo = await evaluate(`(() => {
            const pageEl = document.getElementById('readerPaperPage');
            const rect = pageEl ? pageEl.getBoundingClientRect() : null;
            const toolbar = document.querySelector('.reader-toolbar');
            const footerNav = document.querySelector('.reader-footer-nav');
            return {
              pageNum: pageEl ? parseInt(pageEl.getAttribute('data-page-num'), 10) : null,
              width: rect ? rect.width : 0,
              height: rect ? rect.height : 0,
              toolbarVisible: toolbar ? window.getComputedStyle(toolbar).display !== 'none' : false,
              footerNavVisible: footerNav ? window.getComputedStyle(footerNav).display !== 'none' : false,
              isFocused: document.body.classList.contains('in-focused-reading-mode')
            };
          })()`);
          console.log('[AFTER EXIT STATE]:', postExitInfo);

          // 6. Test Mobile Fullscreen (390 x 844)
          console.log('\n--- Step 6: Test Mobile Viewport (390 x 844) ---');
          await send('Emulation.setDeviceMetricsOverride', {
            width: 390,
            height: 844,
            deviceScaleFactor: 2,
            mobile: true
          });
          await new Promise((r) => setTimeout(r, 600));

          await evaluate(`(async () => {
            if (window.nookApp && window.nookApp.reader) {
              await window.nookApp.reader.toggleFocusedMode(true);
            } else {
              const focusBtn = document.getElementById('readerFocusBtn');
              if (focusBtn) focusBtn.click();
            }
          })()`);
          await new Promise((r) => setTimeout(r, 600));

          const mobileInfo = await evaluate(`(() => {
            const pageEl = document.getElementById('readerPaperPage');
            const rect = pageEl ? pageEl.getBoundingClientRect() : null;
            const docWidth = document.documentElement.scrollWidth;
            const winWidth = window.innerWidth;
            return {
              pageNum: pageEl ? parseInt(pageEl.getAttribute('data-page-num'), 10) : null,
              width: rect ? rect.width : 0,
              height: rect ? rect.height : 0,
              ratio: rect ? (rect.width / rect.height).toFixed(3) : null,
              noHorizontalScroll: docWidth <= winWidth,
              isFocused: document.body.classList.contains('in-focused-reading-mode')
            };
          })()`);
          console.log('[MOBILE FULLSCREEN STATE]:', mobileInfo);
          await captureScreenshot('qa_true_fullscreen_mobile.png');

          console.log('\n--- QA SUMMARY VERIFICATION ---');
          const isSuccessful =
            fullscreenInfo.isFocused === true &&
            fullscreenInfo.hasDynamicExpansion === true &&
            fullscreenInfo.ratio === (11/17).toFixed(3) &&
            fullscreenInfo.toolbarDisplay === 'none' &&
            fullscreenInfo.footerNavDisplay === 'none' &&
            fullscreenInfo.exitBtnVisible === true &&
            pageAfterCorner.pageNum === startPage + 1 &&
            postExitInfo.isFocused === false &&
            postExitInfo.pageNum === startPage + 1 &&
            postExitInfo.toolbarVisible === true &&
            postExitInfo.footerNavVisible === true &&
            mobileInfo.isFocused === true &&
            mobileInfo.noHorizontalScroll === true &&
            mobileInfo.ratio === (11/17).toFixed(3);

          console.log('ALL TRUE FULLSCREEN CHECKS PASSED:', isSuccessful);

          edge.kill();
          process.exit(isSuccessful ? 0 : 1);
        });
      } catch (e) {
        console.error('[ERROR]', e);
        edge.kill();
        process.exit(1);
      }
    });
  });

  req.on('error', (e) => {
    console.error('[ERROR] HTTP req to Edge failed:', e);
    edge.kill();
    process.exit(1);
  });
}

main().catch((err) => {
  console.error('[FATAL]', err);
  process.exit(1);
});
