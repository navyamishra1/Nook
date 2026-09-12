import fs from 'fs';
import path from 'path';
import assert from 'assert';

console.log('====================================================');
console.log('NOOK — SPIN THE NOOK VISUAL REDESIGN VERIFICATION');
console.log('====================================================');

const cssPath = 'frontend/css/app-shell.css';
const appCss = fs.readFileSync(cssPath, 'utf8');

const htmlPath = 'frontend/index.html';
const indexHtml = fs.readFileSync(htmlPath, 'utf8');

const jsPath = 'frontend/js/app.js';
const appJs = fs.readFileSync(jsPath, 'utf8');

// 1. HTML markup integrity
assert.ok(indexHtml.includes('id="view-spin"'), 'view-spin section exists');
assert.ok(indexHtml.includes('<h1>Spin the Nook</h1>'), 'Heading preserved');
assert.ok(indexHtml.includes('<p class="sub">Give up the choosing, just for tonight.</p>'), 'Subtitle preserved');
assert.ok(indexHtml.includes('id="wheel"'), 'Wheel element exists');
assert.ok(indexHtml.includes('class="pointer"'), 'Pointer element exists');
assert.ok(indexHtml.includes('class="wheel-center-hub"'), 'Delicate center hub element added');
assert.ok(indexHtml.includes('id="spinBtn"'), 'Spin button exists');
assert.ok(indexHtml.includes('id="resultCard"'), 'Result card exists');
console.log('[PASS] HTML markup structure verified');

// 2. CSS Rules & Styling
assert.ok(appCss.includes('.wheel-center-hub'), 'CSS defines .wheel-center-hub');
assert.ok(appCss.includes('.wheel-zone'), 'CSS defines .wheel-zone');
assert.ok(appCss.includes('.pointer'), 'CSS defines .pointer');
assert.ok(appCss.includes('#spinBtn.btn'), 'CSS defines #spinBtn.btn');
assert.ok(appCss.includes('resultCardPop'), 'CSS defines resultCardPop animation');
console.log('[PASS] CSS rules and animations verified');

// 3. JS Palette & Slices
assert.ok(appJs.includes('NOOK_WHEEL_PALETTE'), 'JS defines NOOK_WHEEL_PALETTE');
assert.ok(appJs.includes('#F4EFE6'), 'Contains warm cream palette token');
assert.ok(appJs.includes('#D3DDE4'), 'Contains dusty blue palette token');
assert.ok(appJs.includes('#D6E0CC'), 'Contains muted sage palette token');
assert.ok(appJs.includes("span.style.transform = 'rotate(90deg)'") || appJs.includes('rotate(90deg)'), 'Contains rotated text alignment');
assert.ok(appJs.includes('this.spinWinnerBookId = winner.id'), 'Preserves winning book ID routing');
console.log('[PASS] JS palette and spin logic verified');

console.log('====================================================');
console.log('SPIN THE NOOK REDESIGN: 100% VERIFIED & GREEN');
console.log('====================================================');
