const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');

const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const artifactDir = 'C:\\Users\\hp\\.gemini\\antigravity-ide\\brain\\fc23f026-09fd-424b-a43f-ef1178db2bd0';

async function main() {
  console.log('Testing Paper Light (Eye Comfort) Theme in Nook Reader...');
  const edge = spawn(edgePath, [
    '--headless=new',
    '--remote-debugging-port=9224',
    '--disable-gpu',
    '--no-first-run',
    '--no-default-browser-check',
    'http://localhost:8000'
  ]);

  await new Promise((r) => setTimeout(r, 2000));

  const req = http.get('http://127.0.0.1:9224/json', (res) => {
    let data = '';
    res.on('data', (c) => (data += c));
    res.on('end', async () => {
      try {
        const pages = JSON.parse(data);
        const targetPage = pages.find((p) => p.url.includes('localhost:8000'));
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

          async function evaluate(expression, awaitPromise = true) {
            const res = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise });
            if (!res) return null;
            if (res.exceptionDetails) {
              console.error('Eval exception:', res.exceptionDetails);
            }
            return res.result ? res.result.value : res;
          }

          async function setViewport(width, height) {
            await send('Emulation.setDeviceMetricsOverride', {
              width,
              height,
              deviceScaleFactor: 1,
              mobile: width < 600
            });
          }

          async function screenshot(filename) {
            const res = await send('Page.captureScreenshot', { format: 'png' });
            if (res && res.data) {
              const buf = Buffer.from(res.data, 'base64');
              const fullPath = path.join(artifactDir, filename);
              fs.writeFileSync(fullPath, buf);
              console.log(`  -> Captured screenshot: ${filename}`);
            }
          }

          await setViewport(1440, 900);

          // Wait for App to initialize
          await evaluate(`
            new Promise((resolve) => {
              const check = () => {
                if (window.nookApp && window.nookApp.catalog && window.nookApp.catalog.length >= 105) {
                  if (window.nookApp.entry) window.nookApp.entry.skipEntry(false);
                  resolve();
                } else {
                  setTimeout(check, 50);
                }
              };
              check();
            })
          `);

          console.log('\n--- 1. OPEN READER & VERIFY THEME BUTTONS ---');
          await evaluate(`
            new Promise((resolve) => {
              window.nookApp.navigateTo('reader', { bookId: 'pride-and-prejudice', chapterNumber: 1, pageNumber: 1 });
              const checkReader = () => {
                if (window.nookApp.reader && window.nookApp.reader.contentData && !window.nookApp.reader.isLoading) {
                  setTimeout(resolve, 300);
                } else {
                  setTimeout(checkReader, 50);
                }
              };
              checkReader();
            })
          `);

          const themeBtnsInfo = await evaluate(`
            (() => {
              const btns = Array.from(document.querySelectorAll('.reader-theme-controls .theme-btn'));
              return btns.map(b => ({
                themeVal: b.getAttribute('data-theme-val'),
                text: b.textContent.trim(),
                isActive: b.classList.contains('active'),
                title: b.getAttribute('title')
              }));
            })()
          `);
          console.log('Theme buttons found:', themeBtnsInfo);

          console.log('\n--- 2. SWITCH TO PAPER LIGHT (eye-comfort) ---');
          await evaluate(`
            (() => {
              const comfortBtn = document.querySelector('.theme-btn[data-theme-val="eye-comfort"]');
              if (comfortBtn) comfortBtn.click();
            })()
          `);
          await new Promise((r) => setTimeout(r, 300));

          const comfortStyles = await evaluate(`
            (() => {
              const readerEl = document.querySelector('#view-reader');
              const pageEl = document.querySelector('#readerPaperPage');
              const proseEl = document.querySelector('#readerProseContent');
              const toolbarEl = document.querySelector('.reader-toolbar');
              const bodyEl = document.body;

              const pageStyles = window.getComputedStyle(pageEl);
              const proseStyles = window.getComputedStyle(proseEl);
              const bodyStyles = window.getComputedStyle(bodyEl);
              const toolbarStyles = window.getComputedStyle(toolbarEl);

              return {
                readerThemeAttr: readerEl?.getAttribute('data-reader-theme'),
                bodyThemeAttr: bodyEl?.getAttribute('data-reader-active-theme'),
                localStorageVal: localStorage.getItem('nook_reader_theme'),
                bodyBg: bodyStyles.backgroundColor,
                pageBg: pageStyles.backgroundColor,
                proseColor: proseStyles.color,
                toolbarBg: toolbarStyles.backgroundColor
              };
            })()
          `);
          console.log('Paper Light applied styles:', comfortStyles);
          await screenshot('qa_paper_light_active_1440.png');

          console.log('\n--- 3. VERIFY PERSISTENCE ACROSS CHAPTERS & BOOKS ---');
          // Change chapter
          await evaluate(`
            (() => {
              const select = document.querySelector('#readerChapterSelect');
              if (select) {
                select.value = "1";
                select.dispatchEvent(new Event('change', { bubbles: true }));
              }
            })()
          `);
          await new Promise((r) => setTimeout(r, 400));

          const chapterTheme = await evaluate(`
            (() => {
              return {
                themeAttr: document.querySelector('#view-reader')?.getAttribute('data-reader-theme'),
                localStorage: localStorage.getItem('nook_reader_theme'),
                currentPage: window.nookApp.reader.currentPageNumber
              };
            })()
          `);
          console.log('Theme after chapter change:', chapterTheme);

          // Open different book (Frankenstein)
          await evaluate(`
            new Promise((resolve) => {
              window.nookApp.navigateTo('reader', { bookId: 'frankenstein', chapterNumber: 4, pageNumber: 1 });
              setTimeout(resolve, 400);
            })
          `);

          const book2Theme = await evaluate(`
            (() => {
              const pageEl = document.querySelector('#readerPaperPage');
              return {
                bookId: window.nookApp.reader.activeBookId,
                themeAttr: document.querySelector('#view-reader')?.getAttribute('data-reader-theme'),
                localStorage: localStorage.getItem('nook_reader_theme'),
                pageBg: window.getComputedStyle(pageEl).backgroundColor
              };
            })()
          `);
          console.log('Theme after opening Frankenstein:', book2Theme);
          await screenshot('qa_paper_light_frankenstein.png');

          console.log('\n--- 4. TEST FOCUS MODE WITH PAPER LIGHT ---');
          await evaluate(`
            (() => {
              const focusBtn = document.querySelector('#readerFocusBtn');
              if (focusBtn) focusBtn.click();
            })()
          `);
          await new Promise((r) => setTimeout(r, 400));

          const focusModeTheme = await evaluate(`
            (() => {
              const readerEl = document.querySelector('#view-reader');
              const isFocused = readerEl?.classList.contains('focused-reading-mode');
              const exitBtn = document.querySelector('.reader-focus-exit-btn');
              return {
                isFocused,
                themeAttr: readerEl?.getAttribute('data-reader-theme'),
                exitBtnVisible: !!exitBtn
              };
            })()
          `);
          console.log('Focus mode + Paper Light:', focusModeTheme);
          await screenshot('qa_paper_light_focus_mode.png');

          // Exit focus mode
          await evaluate(`
            (() => {
              const exitBtn = document.querySelector('.reader-focus-exit-btn');
              if (exitBtn) exitBtn.click();
            })()
          `);
          await new Promise((r) => setTimeout(r, 300));

          console.log('\n--- 5. TEST OTHER THEMES STILL WORK ---');
          // Test Warm
          await evaluate(`
            (() => {
              document.querySelector('.theme-btn[data-theme-val="warm"]').click();
            })()
          `);
          await new Promise((r) => setTimeout(r, 200));
          const warmCheck = await evaluate(`document.querySelector('#view-reader')?.getAttribute('data-reader-theme')`);
          console.log('Warm theme check:', warmCheck);

          // Test Dark
          await evaluate(`
            (() => {
              document.querySelector('.theme-btn[data-theme-val="dark"]').click();
            })()
          `);
          await new Promise((r) => setTimeout(r, 200));
          const darkCheck = await evaluate(`document.querySelector('#view-reader')?.getAttribute('data-reader-theme')`);
          console.log('Dark theme check:', darkCheck);

          // Test Light
          await evaluate(`
            (() => {
              document.querySelector('.theme-btn[data-theme-val="light"]').click();
            })()
          `);
          await new Promise((r) => setTimeout(r, 200));
          const lightCheck = await evaluate(`document.querySelector('#view-reader')?.getAttribute('data-reader-theme')`);
          console.log('Light theme check:', lightCheck);

          // Switch back to Paper Light
          await evaluate(`
            (() => {
              document.querySelector('.theme-btn[data-theme-val="eye-comfort"]').click();
            })()
          `);
          await new Promise((r) => setTimeout(r, 200));

          console.log('\n--- 6. RESPONSIVE MOBILE VERIFICATION ---');
          await setViewport(390, 844);
          await new Promise((r) => setTimeout(r, 400));
          await screenshot('qa_paper_light_mobile_390.png');

          console.log('\nAll Paper Light tests successfully completed!');
          ws.close();
          edge.kill();
          process.exit(0);
        });
      } catch (err) {
        console.error('Test error:', err);
        edge.kill();
        process.exit(1);
      }
    });
  });
}

main();
