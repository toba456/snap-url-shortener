import { chromium } from 'playwright';
import { mkdirSync } from 'fs';
const SHOTS = '/private/tmp/snap-shots';
mkdirSync(SHOTS, { recursive: true });

const BASE  = 'http://localhost:5173';
const EMAIL = `snap-debug-${Date.now()}@test.com`;

const browser = await chromium.launch({ headless: true });
const ctx     = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page    = await ctx.newPage();

// Capturar mensajes de consola y errores de red
page.on('console', msg => console.log(`[BROWSER ${msg.type()}]`, msg.text()));
page.on('response', async res => {
  if (['/urls', '/auth', '/dashboard'].some(p => res.url().includes(p))) {
    const status = res.status();
    let body = '';
    try { body = await res.text(); } catch {}
    console.log(`[NET] ${res.request().method()} ${res.url()} → ${status} ${body.slice(0,200)}`);
  }
});

// Registrar
await page.goto(`${BASE}/register`, { waitUntil: 'networkidle' });
await page.fill('#name', 'Debug User');
await page.fill('#email', EMAIL);
await page.fill('#password', 'segura123');
await page.click('button[type=submit]');
await page.waitForFunction(() => window.location.pathname === '/dashboard', { timeout: 8000 });
await page.waitForSelector('text=Resumen', { timeout: 8000 });
console.log('✅ En dashboard');

// Intentar crear URL
await page.fill('#url-input', 'https://es.wikipedia.org/wiki/Planeta');
await page.fill('#slug-input', 'planeta-wiki');
console.log('URL filled:', await page.inputValue('#url-input'));
console.log('Slug filled:', await page.inputValue('#slug-input'));

await page.click('button:has-text("Crear")');
await page.waitForTimeout(3000);
await page.screenshot({ path: `${SHOTS}/debug-after-create.png`, fullPage: true });

// Buscar errores visibles en la página
const errorEl = await page.locator('[role=alert]').textContent().catch(() => null);
console.log('Error on page:', errorEl);

const tbodyRows = await page.locator('tbody tr').count();
console.log('Table rows:', tbodyRows);

const pageText = await page.textContent('body');
console.log('planeta-wiki in page:', pageText?.includes('planeta-wiki'));

await browser.close();
