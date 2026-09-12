const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');

const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const artifactDir = 'C:\\Users\\hp\\.gemini\\antigravity-ide\\brain\\fc23f026-09fd-424b-a43f-ef1178db2bd0';

async function main() {
  console.log('[TEST] Launching browser to verify Nook Final Navigation Cleanup...');
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
            return new Promise((resolve, reject) => {
              const msgId = id++;
              pending.set(msgId, { resolve, reject });
              ws.send(JSON.stringify({ id: msgId, method, params }));
            });
          }

          ws.addEventListener('message', (event) => {
            const msg = JSON.parse(event.data);
            if (msg.id && pending.has(msg.id)) {
              const { resolve, reject } = pending.get(msg.id);
              pending.delete(msg.id);
              if (msg.error) reject(msg.error);
              else resolve(msg.result);
            }
          });

          async function evaluate(expression) {
            const res = await send('Runtime.evaluate', {
              expression,
              returnByValue: true,
              awaitPromise: true
            });
            if (res.exceptionDetails) {
              throw new Error(`Evaluation failed: ${JSON.stringify(res.exceptionDetails)}`);
            }
            return res.result.value;
          }

          async function captureScreenshot(filename) {
            const res = await send('Page.captureScreenshot', { format: 'png' });
            const buffer = Buffer.from(res.data, 'base64');
            const outPath = path.join(artifactDir, filename);
            fs.writeFileSync(outPath, buffer);
            console.log(`[SCREENSHOT] Saved: ${filename}`);
          }

          const results = {};

          try {
            // 1. Reset viewport to 1080p Desktop
            await send('Emulation.setDeviceMetricsOverride', {
              width: 1920,
              height: 1080,
              deviceScaleFactor: 1,
              mobile: false
            });

            // 2. Complete/skip Entry sequence and open Reader on Frankenstein
            await evaluate(`
              if (window.nookApp) {
                if (window.nookApp.entry) window.nookApp.entry.skipEntry();
                window.nookApp.navigateTo('reader', { bookId: 'frankenstein', chapterNumber: 1 });
                window.nookApp.reader.setTheme('warm');
                window.nookApp.reader.setFontSize('md');
              }
            `);
            await new Promise((r) => setTimeout(r, 1200));

            // ----------------------------------------------------
            // CHECK 1: Old Navigation Controls Completely Removed
            // ----------------------------------------------------
            console.log('\n--- Checking Old Navigation Controls Removal ---');
            const oldControls = await evaluate(`(() => {
              const prevTextBtn = document.getElementById('readerPrevPageBtn');
              const nextTextBtn = document.getElementById('readerNextPageBtn');
              const footerNav = document.querySelector('.reader-footer-nav');
              const pageIndicator = document.getElementById('readerPageIndicator');
              const detailsLinkRow = document.querySelector('.reader-details-link-row');
              
              const allButtons = Array.from(document.querySelectorAll('button, a'));
              const prevTextFound = allButtons.some(b => /previous\\s*page/i.test(b.textContent));
              const nextTextFound = allButtons.some(b => /next\\s*page/i.test(b.textContent));

              return {
                hasPrevTextBtnId: !!prevTextBtn,
                hasNextTextBtnId: !!nextTextBtn,
                hasFooterNav: !!footerNav,
                hasPageIndicator: !!pageIndicator,
                hasDetailsLinkRow: !!detailsLinkRow,
                prevTextFound,
                nextTextFound
              };
            })()`);
            console.log('[OLD CONTROLS CHECK]:', oldControls);

            results.oldControlsRemoved = (
              !oldControls.hasPrevTextBtnId &&
              !oldControls.hasNextTextBtnId &&
              !oldControls.hasFooterNav &&
              !oldControls.hasPageIndicator &&
              !oldControls.hasDetailsLinkRow &&
              !oldControls.prevTextFound &&
              !oldControls.nextTextFound
            );

            // ----------------------------------------------------
            // CHECK 2: On-Page Corner Arrows Size, Style & Positioning
            // ----------------------------------------------------
            console.log('\n--- Checking Corner Arrows Size, Styling & Positioning ---');
            const cornerArrowsInfo = await evaluate(`(() => {
              const pageEl = document.getElementById('readerPaperPage');
              const prevBtn = document.getElementById('readerPaperCornerPrev');
              const nextBtn = document.getElementById('readerPaperCornerNext');
              const folio = document.querySelector('.reader-paper-page-number');

              if (!prevBtn || !nextBtn || !pageEl) return null;

              const prevRect = prevBtn.getBoundingClientRect();
              const nextRect = nextBtn.getBoundingClientRect();
              const pageRect = pageEl.getBoundingClientRect();
              const prevStyle = window.getComputedStyle(prevBtn);
              const nextStyle = window.getComputedStyle(nextBtn);
              const nextArrowEl = nextBtn.querySelector('.corner-nav-arrow');
              const nextArrowStyle = nextArrowEl ? window.getComputedStyle(nextArrowEl) : null;
              const folioRect = folio ? folio.getBoundingClientRect() : null;

              return {
                insidePage: (
                  prevRect.left >= pageRect.left &&
                  prevRect.bottom <= pageRect.bottom + 5 &&
                  nextRect.right <= pageRect.right + 5 &&
                  nextRect.bottom <= pageRect.bottom + 5
                ),
                prevHitWidth: prevRect.width,
                prevHitHeight: prevRect.height,
                nextHitWidth: nextRect.width,
                nextHitHeight: nextRect.height,
                arrowFontSize: nextArrowStyle ? parseFloat(nextArrowStyle.fontSize) : 0,
                hasTransparentBg: nextStyle.backgroundColor === 'rgba(0, 0, 0, 0)' || nextStyle.backgroundColor === 'transparent',
                hasNoBorder: nextStyle.borderWidth === '0px' || nextStyle.borderStyle === 'none',
                hasNoBoxShadow: nextStyle.boxShadow === 'none',
                prevDisabledOnPage1: prevBtn.hasAttribute('disabled') || prevBtn.getAttribute('aria-disabled') === 'true',
                prevHiddenOnPage1: prevStyle.opacity === '0' || prevStyle.visibility === 'hidden',
                nextEnabledOnPage1: !nextBtn.hasAttribute('disabled'),
                folioText: folio ? folio.textContent.trim() : '',
                folioCentered: folioRect ? Math.abs((folioRect.left + folioRect.width / 2) - (pageRect.left + pageRect.width / 2)) < 15 : false,
                noFolioCollision: (prevRect.right <= (folioRect ? folioRect.left : 0) && nextRect.left >= (folioRect ? folioRect.right : 0))
              };
            })()`);
            console.log('[CORNER ARROWS INFO (PAGE 1)]:', cornerArrowsInfo);

            results.cornerArrowsPositioned = cornerArrowsInfo?.insidePage && cornerArrowsInfo?.noFolioCollision;
            results.arrowHitTargetSufficient = cornerArrowsInfo?.nextHitWidth >= 44 && cornerArrowsInfo?.nextHitHeight >= 44;
            results.arrowFontSizeDesktop = cornerArrowsInfo?.arrowFontSize >= 32 && cornerArrowsInfo?.arrowFontSize <= 40;
            results.arrowNoButtonShape = cornerArrowsInfo?.hasTransparentBg && cornerArrowsInfo?.hasNoBorder && cornerArrowsInfo?.hasNoBoxShadow;
            results.page1PrevDisabled = cornerArrowsInfo?.prevDisabledOnPage1 && cornerArrowsInfo?.prevHiddenOnPage1;

            await captureScreenshot('qa_nav_normal_1080p.png');

            // ----------------------------------------------------
            // CHECK 3: Functional Navigation via Corner Next Arrow
            // ----------------------------------------------------
            console.log('\n--- Testing Click Navigation: Page 1 -> Page 2 ---');
            await evaluate(`
              const nextBtn = document.getElementById('readerPaperCornerNext');
              if (nextBtn) nextBtn.click();
            `);
            await new Promise((r) => setTimeout(r, 1000));

            const page2Info = await evaluate(`(() => {
              const pageEl = document.getElementById('readerPaperPage');
              const prevBtn = document.getElementById('readerPaperCornerPrev');
              const prevStyle = prevBtn ? window.getComputedStyle(prevBtn) : null;
              const folio = document.querySelector('.reader-paper-page-number');

              return {
                pageNum: pageEl ? parseInt(pageEl.getAttribute('data-page-num'), 10) : null,
                folioText: folio ? folio.textContent.trim() : '',
                prevEnabled: prevBtn ? !prevBtn.hasAttribute('disabled') : false,
                rawOpacity: prevStyle ? prevStyle.opacity : null,
                rawVisibility: prevStyle ? prevStyle.visibility : null,
                outerHTML: prevBtn ? prevBtn.outerHTML : null,
                prevVisible: prevStyle ? (parseFloat(prevStyle.opacity) > 0.5 && prevStyle.visibility !== 'hidden') : false
              };
            })()`);
            console.log('[PAGE 2 STATE AFTER NEXT CLICK]:', page2Info);

            results.nextClickNavigates = page2Info.pageNum === 2 && page2Info.folioText === '— 2 —' && page2Info.prevEnabled && page2Info.prevVisible;

            // ----------------------------------------------------
            // CHECK 4: Functional Navigation via Corner Prev Arrow
            // ----------------------------------------------------
            console.log('\n--- Testing Click Navigation: Page 2 -> Page 1 ---');
            await evaluate(`
              const prevBtn = document.getElementById('readerPaperCornerPrev');
              if (prevBtn) prevBtn.click();
            `);
            await new Promise((r) => setTimeout(r, 1000));

            const page1ReturnInfo = await evaluate(`(() => {
              const pageEl = document.getElementById('readerPaperPage');
              return {
                pageNum: pageEl ? parseInt(pageEl.getAttribute('data-page-num'), 10) : null,
                folioText: document.querySelector('.reader-paper-page-number')?.textContent.trim() || ''
              };
            })()`);
            console.log('[PAGE 1 RETURN STATE]:', page1ReturnInfo);
            results.prevClickNavigates = page1ReturnInfo.pageNum === 1;

            // ----------------------------------------------------
            // CHECK 5: Keyboard Navigation (ArrowRight / ArrowLeft)
            // ----------------------------------------------------
            console.log('\n--- Testing Keyboard ArrowRight / ArrowLeft ---');
            await evaluate(`
              window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
            `);
            await new Promise((r) => setTimeout(r, 1000));

            const keyNextInfo = await evaluate(`(() => {
              return {
                pageNum: parseInt(document.getElementById('readerPaperPage')?.getAttribute('data-page-num'), 10),
                folioText: document.querySelector('.reader-paper-page-number')?.textContent.trim() || ''
              };
            })()`);

            await evaluate(`
              window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
            `);
            await new Promise((r) => setTimeout(r, 1000));

            const keyPrevInfo = await evaluate(`(() => {
              return {
                pageNum: parseInt(document.getElementById('readerPaperPage')?.getAttribute('data-page-num'), 10),
                folioText: document.querySelector('.reader-paper-page-number')?.textContent.trim() || ''
              };
            })()`);

            console.log('[KEYBOARD NAVIGATION INFO]:', { keyNext: keyNextInfo, keyPrev: keyPrevInfo });
            results.keyboardNavigationWorks = keyNextInfo.pageNum === 2 && keyPrevInfo.pageNum === 1;

            // ----------------------------------------------------
            // CHECK 6: Focus Mode Consistency & Scaling
            // ----------------------------------------------------
            console.log('\n--- Testing Focus Mode & Scaling ---');
            await evaluate(`
              const focusBtn = document.getElementById('readerFocusBtn');
              if (focusBtn) focusBtn.click();
            `);
            await new Promise((r) => setTimeout(r, 800));

            const focusNavInfo = await evaluate(`(() => {
              const pageEl = document.getElementById('readerPaperPage');
              const nextBtn = document.getElementById('readerPaperCornerNext');
              const nextArrowEl = nextBtn ? nextBtn.querySelector('.corner-nav-arrow') : null;
              const nextArrowStyle = nextArrowEl ? window.getComputedStyle(nextArrowEl) : null;
              const nextRect = nextBtn ? nextBtn.getBoundingClientRect() : null;
              const pageRect = pageEl ? pageEl.getBoundingClientRect() : null;

              return {
                isFocused: document.body.classList.contains('in-focused-reading-mode'),
                pageWidth: pageRect ? pageRect.width : 0,
                pageHeight: pageRect ? pageRect.height : 0,
                ratio: pageRect ? (pageRect.width / pageRect.height).toFixed(3) : null,
                nextHitWidth: nextRect ? nextRect.width : 0,
                nextHitHeight: nextRect ? nextRect.height : 0,
                arrowFontSize: nextArrowStyle ? parseFloat(nextArrowStyle.fontSize) : 0,
                insidePage: nextRect && pageRect ? (nextRect.right <= pageRect.right + 5 && nextRect.bottom <= pageRect.bottom + 5) : false
              };
            })()`);
            console.log('[FOCUS MODE NAVIGATION STATE]:', focusNavInfo);

            results.focusModeConsistent = focusNavInfo.isFocused && focusNavInfo.insidePage && focusNavInfo.nextHitWidth >= 44 && focusNavInfo.arrowFontSize >= 34;

            await captureScreenshot('qa_nav_focus_1080p.png');

            // ----------------------------------------------------
            // CHECK 7: Dark Theme Contrast & Styling
            // ----------------------------------------------------
            console.log('\n--- Testing Dark Theme Navigation Styling ---');
            await evaluate(`
              if (window.nookApp && window.nookApp.reader) {
                window.nookApp.reader.setTheme('dark');
              }
            `);
            await new Promise((r) => setTimeout(r, 600));

            const darkThemeNav = await evaluate(`(() => {
              const nextBtn = document.getElementById('readerPaperCornerNext');
              const style = nextBtn ? window.getComputedStyle(nextBtn) : null;
              return {
                color: style ? style.color : '',
                opacity: style ? parseFloat(style.opacity) : 0
              };
            })()`);
            console.log('[DARK THEME NAV STATE]:', darkThemeNav);
            results.darkThemeContrast = darkThemeNav.opacity >= 0.75;

            await captureScreenshot('qa_nav_dark.png');

            // Exit Focus mode
            await evaluate(`
              const exitBtn = document.getElementById('readerFocusExitBtn');
              if (exitBtn) exitBtn.click();
            `);
            await new Promise((r) => setTimeout(r, 600));

            // ----------------------------------------------------
            // CHECK 8: Mobile Viewport (390 x 844)
            // ----------------------------------------------------
            console.log('\n--- Testing Mobile Viewport (390 x 844) ---');
            await send('Emulation.setDeviceMetricsOverride', {
              width: 390,
              height: 844,
              deviceScaleFactor: 2,
              mobile: true
            });
            await new Promise((r) => setTimeout(r, 600));

            const mobileNavInfo = await evaluate(`(() => {
              const pageEl = document.getElementById('readerPaperPage');
              const nextBtn = document.getElementById('readerPaperCornerNext');
              const nextArrowEl = nextBtn ? nextBtn.querySelector('.corner-nav-arrow') : null;
              const nextArrowStyle = nextArrowEl ? window.getComputedStyle(nextArrowEl) : null;
              const nextRect = nextBtn ? nextBtn.getBoundingClientRect() : null;
              const pageRect = pageEl ? pageEl.getBoundingClientRect() : null;
              const docWidth = document.documentElement.scrollWidth;
              const winWidth = window.innerWidth;

              return {
                pageWidth: pageRect ? pageRect.width : 0,
                pageHeight: pageRect ? pageRect.height : 0,
                ratio: pageRect ? (pageRect.width / pageRect.height).toFixed(3) : null,
                nextHitWidth: nextRect ? nextRect.width : 0,
                nextHitHeight: nextRect ? nextRect.height : 0,
                arrowFontSize: nextArrowStyle ? parseFloat(nextArrowStyle.fontSize) : 0,
                insidePage: nextRect && pageRect ? (nextRect.right <= pageRect.right + 5 && nextRect.bottom <= pageRect.bottom + 5) : false,
                noHorizontalOverflow: docWidth <= winWidth
              };
            })()`);
            console.log('[MOBILE NAVIGATION STATE]:', mobileNavInfo);

            results.mobileCompliant = (
              mobileNavInfo.insidePage &&
              mobileNavInfo.noHorizontalOverflow &&
              mobileNavInfo.nextHitWidth >= 44 &&
              mobileNavInfo.nextHitHeight >= 44 &&
              mobileNavInfo.arrowFontSize >= 30
            );

            await captureScreenshot('qa_nav_mobile.png');

            // ----------------------------------------------------
            // CHECK 9: Confirm Zero Duplicate Controls
            // ----------------------------------------------------
            console.log('\n--- Duplicate Navigation Audit ---');
            const duplicateAudit = await evaluate(`(() => {
              const prevItems = document.querySelectorAll('#readerPrevPageBtn, .prev-btn, [data-nav-prev]');
              const nextItems = document.querySelectorAll('#readerNextPageBtn, .next-btn, [data-nav-next]');
              const cornerPrev = document.querySelectorAll('#readerPaperCornerPrev');
              const cornerNext = document.querySelectorAll('#readerPaperCornerNext');

              return {
                oldPrevCount: prevItems.length,
                oldNextCount: nextItems.length,
                cornerPrevCount: cornerPrev.length,
                cornerNextCount: cornerNext.length
              };
            })()`);
            console.log('[DUPLICATE AUDIT]:', duplicateAudit);
            results.noDuplicates = duplicateAudit.oldPrevCount === 0 && duplicateAudit.oldNextCount === 0 && duplicateAudit.cornerPrevCount === 1 && duplicateAudit.cornerNextCount === 1;

            console.log('\n==================================================');
            console.log('FINAL VERIFICATION RESULTS:');
            console.log(JSON.stringify(results, null, 2));
            console.log('==================================================');

            const allPassed = Object.values(results).every(Boolean);
            console.log(`ALL FINAL NAVIGATION CHECKS PASSED: ${allPassed}`);
            
            edge.kill();
            process.exit(allPassed ? 0 : 1);

          } catch (err) {
            console.error('[TEST ERROR]:', err);
            edge.kill();
            process.exit(1);
          }
        });

      } catch (err) {
        console.error('[CONNECTION ERROR]:', err);
        edge.kill();
        process.exit(1);
      }
    });
  });

  req.on('error', (err) => {
    console.error('[HTTP ERROR]:', err);
    edge.kill();
    process.exit(1);
  });
}

main();
