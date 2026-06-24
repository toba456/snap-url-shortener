/**
 * Snap — Verificación end-to-end con Playwright
 *
 * Cubre:
 *  1. Registro (email único por ejecución)
 *  2. Login / Logout
 *  3. Crear URL con alias personalizado → contador sube sin recarga
 *  4. Prueba de intrusión: /dashboard sin sesión → rebota a /login
 *  5. Token corrupto → 401 detectado → clearAuth → redirect a /login sin crash
 *  🔍 Probes: credenciales incorrectas, email duplicado
 */
import { chromium } from 'playwright';
import { writeFileSync, mkdirSync } from 'fs';

const BASE  = 'http://localhost:5173';
const SHOTS = '/private/tmp/snap-shots';
mkdirSync(SHOTS, { recursive: true });

// Email y slug únicos por ejecución para no chocar con datos anteriores
const TS    = Date.now();
const EMAIL = `snap-${TS}@test.com`;
const SLUG  = `wiki-${TS}`;
const PASS  = 'segura123';
const NAME  = 'Santiago Test';

let stepN = 0;
async function shot(page, label) {
  stepN++;
  const file = `${SHOTS}/${String(stepN).padStart(2,'0')}-${label}.png`;
  await page.screenshot({ path: file, fullPage: true });
  console.log(`📸 [${stepN}] ${label}`);
  return file;
}

// Helper: esperar a que el pathname de la SPA cambie (sin depender de load events)
async function waitForPath(page, path, timeout = 6000) {
  await page.waitForFunction(
    (p) => window.location.pathname === p,
    path,
    { timeout }
  );
}

const results = [];
function log(emoji, msg) {
  const line = `${emoji} ${msg}`;
  results.push(line);
  console.log(line);
}

const browser = await chromium.launch({ headless: true });
const ctx     = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page    = await ctx.newPage();

// ── FLUJO 1: REGISTRO ─────────────────────────────────────────────────────────
log('▶', `FLUJO 1 — Registro (${EMAIL})`);

await page.goto(`${BASE}/register`, { waitUntil: 'networkidle' });
await shot(page, 'register-page');

await page.fill('#name',     NAME);
await page.fill('#email',    EMAIL);
await page.fill('#password', PASS);
await shot(page, 'register-form-filled');
await page.click('button[type=submit]');

await waitForPath(page, '/dashboard');
await page.waitForSelector('text=Resumen', { timeout: 8000 });
await shot(page, 'after-register-dashboard');

const h1 = await page.textContent('h1');
log(h1?.includes('Snap') ? '✅' : '❌', `Dashboard tras registro — h1: "${h1}"`);

const welcome = await page.locator('p:has-text("Hola")').textContent();
log(welcome?.includes(NAME) ? '✅' : '❌', `Saludo visible: "${welcome?.trim()}"`);

// Verificar token en localStorage
const tokenStored = await page.evaluate(() => !!localStorage.getItem('snap_token'));
log(tokenStored ? '✅' : '❌', `JWT guardado en localStorage: ${tokenStored}`);

// ── FLUJO 2: CERRAR SESIÓN Y RE-LOGIN ─────────────────────────────────────────
log('▶', 'FLUJO 2 — Cerrar sesión → Login');

await page.click('button:has-text("Cerrar sesión")');
await waitForPath(page, '/login');
await shot(page, 'after-logout');

const tokenAfterLogout = await page.evaluate(() => localStorage.getItem('snap_token'));
log(tokenAfterLogout === null ? '✅' : '❌', `localStorage limpiado tras logout: snap_token = ${tokenAfterLogout}`);

await page.fill('#email',    EMAIL);
await page.fill('#password', PASS);
await page.click('button[type=submit]');
await waitForPath(page, '/dashboard');
await page.waitForSelector('text=Resumen', { timeout: 8000 });
await shot(page, 'after-login-dashboard');
log('✅', 'Login exitoso → dashboard');

// ── FLUJO 3: CREAR URL CON ALIAS PERSONALIZADO ────────────────────────────────
log('▶', 'FLUJO 3 — Crear URL con alias personalizado');

// Leer contador inicial (puede ser texto "0")
const counterBefore = await page.locator('div').filter({ hasText: /^0$/ }).first().textContent().catch(() => '0');
log('✅', `Contador URLs antes de crear: "${counterBefore?.trim()}"`);

await page.fill('#url-input',  'https://es.wikipedia.org/wiki/Planeta');
await page.fill('#slug-input', SLUG);
await page.click('button:has-text("Crear")');

// Esperar a que aparezca el slug en la tabla (sin recargar)
await page.waitForSelector(`text=${SLUG}`, { timeout: 6000 });
await shot(page, 'url-created');
log('✅', `Slug "${SLUG}" aparece en tabla sin recargar la página`);

// Verificar que el contador de URLs totales subió a 1
const counter1 = await page.locator('div').filter({ hasText: /^1$/ }).first().textContent().catch(() => null);
log(counter1 !== null ? '✅' : '❌', `Contador URLs tras crear: "${counter1?.trim()}" (esperado 1)`);

// Copiar una segunda URL para tener dos filas
await page.fill('#url-input',  'https://github.com');
await page.click('button:has-text("Crear")');
await page.waitForTimeout(1000);
const rows = await page.locator('tbody tr').count();
await shot(page, 'two-urls');
log(rows >= 2 ? '✅' : '❌', `Tabla muestra ${rows} filas tras crear segunda URL`);

// ── FLUJO 3b: ELIMINAR UNA URL ────────────────────────────────────────────────
log('▶', 'FLUJO 3b — Eliminar URL');

const rowsBefore = await page.locator('tbody tr').count();
await page.locator('tbody tr').last().locator('button:has-text("Eliminar")').click();
await page.waitForTimeout(800);
const rowsAfter = await page.locator('tbody tr').count();
await shot(page, 'url-deleted');
log(rowsAfter === rowsBefore - 1 ? '✅' : '❌', `Filas: ${rowsBefore} → ${rowsAfter} tras eliminar`);

// ── FLUJO 4: CERRAR SESIÓN FINAL ──────────────────────────────────────────────
log('▶', 'FLUJO 4 — Cerrar sesión final');

await page.click('button:has-text("Cerrar sesión")');
await waitForPath(page, '/login');
log('✅', 'Cerrar sesión → /login');

// ── PRUEBA DE INTRUSIÓN ───────────────────────────────────────────────────────
log('▶', 'PRUEBA DE INTRUSIÓN — Acceso manual a /dashboard sin sesión');

// Navegar directamente a /dashboard desde barra de direcciones (hard navigation)
await page.goto(`${BASE}/dashboard`, { waitUntil: 'networkidle' });
await shot(page, 'intrusion-after-goto');

const urlAfterGoto = page.url();
// Si React montó y aplicó el guard, ya estaremos en /login
if (!urlAfterGoto.includes('/login')) {
  // Esperar a que React monte y el guard dispare <Navigate>
  await waitForPath(page, '/login', 5000).catch(() => {});
}

await shot(page, 'intrusion-result');
const intrusionUrl = page.url();
log(
  intrusionUrl.includes('/login') ? '✅' : '❌',
  `Acceso a /dashboard sin token → URL final: ${intrusionUrl}`
);

// El formulario de login debe ser usable (no crasheó)
const loginInputVisible = await page.locator('#email').isVisible();
log(loginInputVisible ? '✅' : '❌', `Formulario de login funcional tras intrusión`);

// ── SIMULACIÓN TOKEN CORRUPTO ─────────────────────────────────────────────────
log('▶', 'SIMULACIÓN — Token corrupto en localStorage');

// Login válido
await page.fill('#email',    EMAIL);
await page.fill('#password', PASS);
await page.click('button[type=submit]');
await waitForPath(page, '/dashboard');
await page.waitForSelector('text=Resumen', { timeout: 8000 });

// Corromper token
await page.evaluate(() => {
  const t = localStorage.getItem('snap_token');
  if (t) localStorage.setItem('snap_token', t + 'CORRUPTO');
});
const corruptToken = await page.evaluate(() => localStorage.getItem('snap_token'));
log('✅', `Token corrompido: ...${corruptToken?.slice(-14)}`);

// Recargar → el useEffect llama a getDashboard con token inválido → 401 → clearAuth → Navigate
await page.reload({ waitUntil: 'networkidle' });
await shot(page, 'corrupt-token-after-reload');

if (!page.url().includes('/login')) {
  await waitForPath(page, '/login', 6000).catch(() => {});
}
await shot(page, 'corrupt-token-result');

const urlAfterCorrupt = page.url();
log(
  urlAfterCorrupt.includes('/login') ? '✅' : '❌',
  `Token corrupto detectado → URL final: ${urlAfterCorrupt}`
);

const tokenAfterCorrupt = await page.evaluate(() => localStorage.getItem('snap_token'));
log(
  tokenAfterCorrupt === null ? '✅' : '❌',
  `localStorage limpiado tras 401: snap_token = ${tokenAfterCorrupt ?? 'null (correcto)'}`
);

const loginOkAfterCorrupt = await page.locator('#email').isVisible();
log(loginOkAfterCorrupt ? '✅' : '❌', `Login renderizado correctamente, sin crash`);

// ── 🔍 PROBE: credenciales incorrectas ───────────────────────────────────────
log('🔍', 'PROBE — Credenciales incorrectas');
await page.fill('#email',    EMAIL);
await page.fill('#password', 'contrasena-mala');
await page.click('button[type=submit]');
await page.waitForSelector('[role=alert]', { timeout: 4000 });
const badPassError = await page.textContent('[role=alert]');
await shot(page, 'probe-bad-password');
log('🔍', `Error por credenciales: "${badPassError?.trim()}"`);
const staysOnLogin = page.url().includes('/login');
log(staysOnLogin ? '🔍' : '❌', `Permanece en /login tras error de auth: ${staysOnLogin}`);

// ── 🔍 PROBE: registro con email duplicado ────────────────────────────────────
log('🔍', 'PROBE — Registro con email ya existente');
await page.goto(`${BASE}/register`, { waitUntil: 'networkidle' });
await page.fill('#name',     'Otro');
await page.fill('#email',    EMAIL);
await page.fill('#password', PASS);
await page.click('button[type=submit]');
await page.waitForSelector('[role=alert]', { timeout: 4000 });
const dupError = await page.textContent('[role=alert]');
await shot(page, 'probe-duplicate-email');
log('🔍', `Error por email duplicado: "${dupError?.trim()}"`);

// ── 🔍 PROBE: URL sin protocolo ───────────────────────────────────────────────
log('🔍', 'PROBE — Crear URL inválida (sin https://)');
await page.fill('#email',    EMAIL);
await page.fill('#password', PASS);
await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
await page.fill('#email', EMAIL);
await page.fill('#password', PASS);
await page.click('button[type=submit]');
await waitForPath(page, '/dashboard');
await page.waitForSelector('#url-input', { timeout: 5000 });
await page.fill('#url-input', 'wikipedia.org/sin-protocolo');  // URL inválida
await page.click('button:has-text("Crear")');
// El campo type="url" del browser debería prevenir el submit, o el backend retorna 400
await page.waitForTimeout(1000);
const urlProbeError = await page.locator('[role=alert]').textContent().catch(() => null);
const formStillVisible = await page.locator('#url-input').isVisible();
await shot(page, 'probe-invalid-url');
log('🔍', `URL sin protocolo — error: "${urlProbeError?.trim() ?? 'validación nativa HTML5'}", form visible: ${formStillVisible}`);

// ── CIERRE ────────────────────────────────────────────────────────────────────
await browser.close();

console.log('\n═══════════════════════════════════════════════════');
console.log(' RESUMEN FINAL');
console.log('═══════════════════════════════════════════════════');
results.forEach(r => console.log(r));

const passed  = results.filter(r => r.startsWith('✅')).length;
const failed  = results.filter(r => r.startsWith('❌')).length;
const probes  = results.filter(r => r.startsWith('🔍')).length;
console.log(`\n✅ ${passed} pasos OK  |  ❌ ${failed} fallos  |  🔍 ${probes} probes`);

writeFileSync('/private/tmp/snap-verify-results.txt', [
  ...results,
  `\n✅ ${passed}  ❌ ${failed}  🔍 ${probes}`,
].join('\n'));
