// ════════════════════════════════════════════════════════════════════════════
// playwright.config.js — Smoke tests Athletik Hub
// ────────────────────────────────────────────────────────────────────────────
// Config minimale : sert le repo (statique) via python http.server, lance
// les tests sur deux profils mobile (Pixel + iPhone) puisque la cible est
// PWA mobile-first. Retries en CI uniquement, traces sur échec.
// ════════════════════════════════════════════════════════════════════════════
const { defineConfig, devices } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  timeout: 30_000,
  expect: { timeout: 5_000 },
  use: {
    baseURL: 'http://127.0.0.1:8765',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    ignoreHTTPSErrors: true,
  },
  // Cible mobile-first → Pixel + iPhone. On évite Chromium desktop : l'app
  // n'a pas de rendu desktop optimisé, on testerait des cas non réalistes.
  projects: [
    { name: 'mobile-android', use: { ...devices['Pixel 5'] } },
    { name: 'mobile-iphone',  use: { ...devices['iPhone 13'] } },
  ],
  // Serveur statique simple : python http.server suffit (toujours dispo sur
  // Ubuntu runners). Pas de nouvelle dépendance Node à installer.
  webServer: {
    command: 'python3 -m http.server 8765',
    url: 'http://127.0.0.1:8765',
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
});
