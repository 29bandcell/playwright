import { chromium } from 'playwright';
import dotenv from 'dotenv';

dotenv.config();

const LOGIN_URL = process.env.LOGIN_URL;
const LOGIN_USER = process.env.LOGIN_USER;
const LOGIN_PASS = process.env.LOGIN_PASS;

if (!LOGIN_URL || !LOGIN_USER || !LOGIN_PASS) {
  console.error('Faltam variáveis no .env: LOGIN_URL, LOGIN_USER, LOGIN_PASS');
  process.exit(1);
}

(async () => {
  const browser = await chromium.launch({
    headless: false
  });

  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    console.log('Abrindo página de login...');
    await page.goto(LOGIN_URL, {
      waitUntil: 'domcontentloaded',
      timeout: 60000
    });

    console.log('Preenchendo login...');
    await page.fill('input[name="username"], input[name="email"], input[type="text"]', LOGIN_USER);
    await page.fill('input[name="password"], input[type="password"]', LOGIN_PASS);

    console.log('Enviando login...');
    await Promise.all([
      page.waitForLoadState('networkidle'),
      page.click('button[type="submit"], input[type="submit"], button:has-text("Login"), button:has-text("Entrar")')
    ]);

    console.log('Salvando sessão...');
    await context.storageState({ path: 'session.json' });

    console.log('✅ session.json gerado com sucesso!');
  } catch (error) {
    console.error('❌ Erro ao gerar session.json:', error.message);
  } finally {
    await browser.close();
  }
})();
