const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');

const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const artifactDir = 'C:\\Users\\hp\\.gemini\\antigravity-ide\\brain\\fc23f026-09fd-424b-a43f-ef1178db2bd0';

async function main() {
  console.log('[TEST] Launching headless browser to test Focused Reading Mode...');
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

          // 1. Set Desktop Viewport
          await send('Emulation.setDeviceMetricsOverride', {
            width: 1280,
            height: 900,
            deviceScaleFactor: 1,
            mobile: false
          });

          // Skip entry animation
          await evaluate(`
            const skipBtn = document.getElementById('entry-skip-btn');
            if (skipBtn) skipBtn.click();
          `);
          await new Promise((r) => setTimeout(r, 600));

          // Open Frankenstein directly via app router
          console.log('\n--- Step 1: Open Frankenstein in Reader ---');
          await evaluate(`
            if (window.nookApp) {
              window.nookApp.navigateTo('reader', { bookId: 'frankenstein' });
            }
          `);
          await new Promise((r) => setTimeout(r, 1500));

          // 2. Jump to Chapter 3 / Page 22
          console.log('\n--- Step 2: Navigate to a middle chapter/page ---');
          await evaluate(`
            const select = document.getElementById('readerChapterSelect');
            if (select) {
              select.value = "3"; // Chapter 3
              select.dispatchEvent(new Event('change'));
            }
          `);
          await new Promise((r) => setTimeout(r, 1200));

          const preFocusInfo = await evaluate(`(() => {
            const pageEl = document.getElementById('readerPaperPage');
            const pageNum = pageEl ? parseInt(pageEl.getAttribute('data-page-num'), 10) : null;
            const folioText = pageEl ? (pageEl.querySelector('.reader-paper-page-number')?.textContent.trim() || '') : '';
            const rect = pageEl ? pageEl.getBoundingClientRect() : null;
            const masthead = document.querySelector('header.masthead');
            const toolbar = document.querySelector('.reader-toolbar');
            return {
              pageNum,
              folioText,
              ratio: rect ? (rect.width / rect.height).toFixed(3) : null,
              width: rect ? rect.width : 0,
              height: rect ? rect.height : 0,
              mastheadVisible: masthead ? window.getComputedStyle(masthead).display !== 'none' : false,
              toolbarVisible: toolbar ? window.getComputedStyle(toolbar).display !== 'none' : false,
              isFocused: document.body.classList.contains('in-focused-reading-mode')
            };
          })()`);
          console.log('[INITIAL NORMAL READER STATE]:', preFocusInfo);

          // 3. Enter Focused Reading Mode
          console.log('\n--- Step 3: Click Focus Button to Enter Focused Reading Mode ---');
          await evaluate(`
            const focusBtn = document.getElementById('readerFocusBtn');
            if (focusBtn) focusBtn.click();
          `);
          await new Promise((r) => setTimeout(r, 600));

          const focusedInfo = await evaluate(`(() => {
            const pageEl = document.getElementById('readerPaperPage');
            const pageNum = pageEl ? parseInt(pageEl.getAttribute('data-page-num'), 10) : null;
            const folioText = pageEl ? (pageEl.querySelector('.reader-paper-page-number')?.textContent.trim() || '') : '';
            const rect = pageEl ? pageEl.getBoundingClientRect() : null;
            const masthead = document.querySelector('header.masthead');
            const toolbar = document.querySelector('.reader-toolbar');
            const footerNav = document.querySelector('.reader-footer-nav');
            const exitBtn = document.getElementById('readerFocusExitBtn');
            const exitBtnStyle = exitBtn ? window.getComputedStyle(exitBtn) : null;
            const cornerPrev = document.getElementById('readerPaperCornerPrev');
            const cornerNext = document.getElementById('readerPaperCornerNext');
            const stage = document.querySelector('.reader-stage');
            const stageStyle = stage ? window.getComputedStyle(stage) : null;
            return {
              pageNum,
              folioText,
              ratio: rect ? (rect.width / rect.height).toFixed(3) : null,
              width: rect ? rect.width : 0,
              height: rect ? rect.height : 0,
              mastheadDisplay: masthead ? window.getComputedStyle(masthead).display : 'none',
              toolbarDisplay: toolbar ? window.getComputedStyle(toolbar).display : 'none',
              footerNavDisplay: footerNav ? window.getComputedStyle(footerNav).display : 'none',
              exitBtnVisible: exitBtnStyle ? (exitBtnStyle.display !== 'none' && exitBtnStyle.opacity !== '0') : false,
              exitBtnText: exitBtn ? exitBtn.textContent.trim() : '',
              hasCornerPrev: !!cornerPrev,
              hasCornerNext: !!cornerNext,
              isFocused: document.body.classList.contains('in-focused-reading-mode'),
              stageMinHeight: stageStyle ? stageStyle.minHeight : null
            };
          })()`);
          console.log('[FOCUSED READING MODE STATE]:', focusedInfo);

          await captureScreenshot('qa_focus_mode_desktop.png');

          // 4. Test on-page Corner Navigation and Arrow keys
          console.log('\n--- Step 4: Turn Page via Corner Nav & Arrow Keys ---');
          const startPage = focusedInfo.pageNum;
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

          // Press ArrowRight key
          await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'ArrowRight', code: 'ArrowRight', windowsVirtualKeyCode: 39 });
          await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'ArrowRight', code: 'ArrowRight', windowsVirtualKeyCode: 39 });
          await new Promise((r) => setTimeout(r, 1000));

          const pageAfterArrow = await evaluate(`(() => {
            const pageEl = document.getElementById('readerPaperPage');
            return {
              pageNum: pageEl ? parseInt(pageEl.getAttribute('data-page-num'), 10) : null,
              folioText: pageEl ? (pageEl.querySelector('.reader-paper-page-number')?.textContent.trim() || '') : ''
            };
          })()`);
          console.log('[AFTER ARROW RIGHT KEY]:', pageAfterArrow);

          // 5. Switch to Dark Theme in Focus Mode
          console.log('\n--- Step 5: Test Dark Theme in Focused Reading Mode ---');
          await evaluate(`
            if (window.nookApp && window.nookApp.reader) {
              window.nookApp.reader.setTheme('dark');
            }
          `);
          await new Promise((r) => setTimeout(r, 600));
          await captureScreenshot('qa_focus_mode_dark.png');

          // Switch back to Warm theme
          await evaluate(`
            if (window.nookApp && window.nookApp.reader) {
              window.nookApp.reader.setTheme('warm');
            }
          `);
          await new Promise((r) => setTimeout(r, 400));

          // 6. Test ESC key to Exit Focus Mode
          console.log('\n--- Step 6: Test ESC key to Exit Focus Mode ---');
          await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
          await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
          await new Promise((r) => setTimeout(r, 600));

          const postEscInfo = await evaluate(`(() => {
            const pageEl = document.getElementById('readerPaperPage');
            const pageNum = pageEl ? parseInt(pageEl.getAttribute('data-page-num'), 10) : null;
            const folioText = pageEl ? (pageEl.querySelector('.reader-paper-page-number')?.textContent.trim() || '') : '';
            const masthead = document.querySelector('header.masthead');
            const toolbar = document.querySelector('.reader-toolbar');
            const footerNav = document.querySelector('.reader-footer-nav');
            const exitBtn = document.getElementById('readerFocusExitBtn');
            const exitBtnStyle = exitBtn ? window.getComputedStyle(exitBtn) : null;
            return {
              pageNum,
              folioText,
              mastheadVisible: masthead ? window.getComputedStyle(masthead).display !== 'none' : false,
              toolbarVisible: toolbar ? window.getComputedStyle(toolbar).display !== 'none' : false,
              footerNavVisible: footerNav ? window.getComputedStyle(footerNav).display !== 'none' : false,
              exitBtnVisible: exitBtnStyle ? (exitBtnStyle.display !== 'none' && exitBtnStyle.opacity !== '0') : false,
              isFocused: document.body.classList.contains('in-focused-reading-mode')
            };
          })()`);
          console.log('[AFTER ESC EXIT STATE]:', postEscInfo);
          await captureScreenshot('qa_focus_mode_exit.png');

          // 7. Test Mobile Responsive Viewport (390 x 844)
          console.log('\n--- Step 7: Test Mobile Responsive Viewport (390 x 844) ---');
          await send('Emulation.setDeviceMetricsOverride', {
            width: 390,
            height: 844,
            deviceScaleFactor: 2,
            mobile: true
          });
          await new Promise((r) => setTimeout(r, 600));

          // Enter focused mode on mobile
          const toggleResult = await evaluate(`(() => {
            const focusBtn = document.getElementById('readerFocusBtn');
            console.log('[DEBUG MOBILE] focusBtn exists:', !!focusBtn);
            if (focusBtn) {
              focusBtn.click();
            } else if (window.nookApp && window.nookApp.reader) {
              window.nookApp.reader.toggleFocusedMode(true);
            }
            return {
              isFocused: document.body.classList.contains('in-focused-reading-mode'),
              readerFocused: window.nookApp?.reader?.isFocusedMode
            };
          })()`);
          console.log('[DEBUG TOGGLE RESULT ON MOBILE]:', toggleResult);
          await new Promise((r) => setTimeout(r, 600));

          const mobileFocusedInfo = await evaluate(`(() => {
            const pageEl = document.getElementById('readerPaperPage');
            const pageNum = pageEl ? parseInt(pageEl.getAttribute('data-page-num'), 10) : null;
            const rect = pageEl ? pageEl.getBoundingClientRect() : null;
            const docWidth = document.documentElement.scrollWidth;
            const winWidth = window.innerWidth;
            const masthead = document.querySelector('header.masthead');
            const toolbar = document.querySelector('.reader-toolbar');
            const exitBtn = document.getElementById('readerFocusExitBtn');
            const exitBtnStyle = exitBtn ? window.getComputedStyle(exitBtn) : null;
            return {
              pageNum,
              ratio: rect ? (rect.width / rect.height).toFixed(3) : null,
              width: rect ? rect.width : 0,
              height: rect ? rect.height : 0,
              docWidth,
              winWidth,
              noHorizontalScroll: docWidth <= winWidth,
              mastheadDisplay: masthead ? window.getComputedStyle(masthead).display : 'none',
              toolbarDisplay: toolbar ? window.getComputedStyle(toolbar).display : 'none',
              exitBtnVisible: exitBtnStyle ? (exitBtnStyle.display !== 'none' && exitBtnStyle.opacity !== '0') : false,
              isFocused: document.body.classList.contains('in-focused-reading-mode')
            };
          })()`);
          console.log('[MOBILE FOCUSED STATE]:', mobileFocusedInfo);
          await captureScreenshot('qa_focus_mode_mobile.png');

          // Exit on mobile via exit button
          await evaluate(`
            const exitBtn = document.getElementById('readerFocusExitBtn');
            if (exitBtn) exitBtn.click();
          `);
          await new Promise((r) => setTimeout(r, 500));

          console.log('\n--- QA SUMMARY VERIFICATION ---');
          const isSuccessful = 
            focusedInfo.isFocused === true &&
            focusedInfo.toolbarDisplay === 'none' &&
            focusedInfo.footerNavDisplay === 'none' &&
            focusedInfo.exitBtnVisible === true &&
            focusedInfo.hasCornerPrev === true &&
            focusedInfo.hasCornerNext === true &&
            pageAfterCorner.pageNum === startPage + 1 &&
            pageAfterArrow.pageNum === startPage + 2 &&
            postEscInfo.isFocused === false &&
            postEscInfo.pageNum === startPage + 2 &&
            postEscInfo.toolbarVisible === true &&
            postEscInfo.footerNavVisible === true &&
            postEscInfo.exitBtnVisible === false &&
            mobileFocusedInfo.isFocused === true &&
            mobileFocusedInfo.noHorizontalScroll === true &&
            mobileFocusedInfo.ratio === (11/17).toFixed(3);

          console.log('ALL FOCUSED MODE CHECKS PASSED:', isSuccessful);

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
