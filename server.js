import express from 'express';
import { chromium } from 'playwright';
import fs from 'fs';

const app = express();
app.use(express.json());

const API_KEY = process.env.API_KEY || '';
const BASE_URL = process.env.LOGIN_URL || 'https://dashboardcloud.net/';

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'playwright-api',
    timestamp: new Date().toISOString()
  });
});

function checkAuth(req, res) {
  const key = req.headers['x-api-key'];
  if (!API_KEY || key !== API_KEY) {
    res.status(401).json({
      success: false,
      message: 'API key inválida'
    });
    return false;
  }
  return true;
}

function getSessionPath() {
  if (fs.existsSync('/app/session.json')) return '/app/session.json';
  if (fs.existsSync('session.json')) return 'session.json';
  throw new Error('session.json não encontrado');
}

async function startBrowser() {
  const sessionPath = getSessionPath();

  const browser = await chromium.launch({
    headless: true
  });

  const context = await browser.newContext({
    storageState: sessionPath
  });

  const page = await context.newPage();
  return { browser, context, page };
}

async function ensureLoggedIn(page) {
  await page.goto(BASE_URL, {
    waitUntil: 'domcontentloaded',
    timeout: 60000
  });

  await page.waitForTimeout(3000);

  const url = page.url();
  const bodyText = await page.locator('body').innerText().catch(() => '');

  const stillOnLogin =
    /login|entrar|senha|não sou robô|recaptcha/i.test(bodyText) &&
    /login|auth|entrar/i.test(url);

  if (stillOnLogin) {
    throw new Error('Sessão expirada ou redirecionada para login');
  }
}

app.post('/run', async (req, res) => {
  return res.json({
    success: true,
    message: 'API funcionando'
  });
});

app.post('/renovar', async (req, res) => {
  if (!checkAuth(req, res)) return;

  const { usuario, meses = 1 } = req.body || {};

  if (!usuario) {
    return res.status(400).json({
      success: false,
      message: 'Campo "usuario" é obrigatório'
    });
  }

  let browser;
  let context;

  try {
  // código aqui
} catch (error) {
  console.error(error);
  throw error;
}
    const started = await startBrowser();
    browser = started.browser;
    context = started.context;
    const page = started.page;

    await ensureLoggedIn(page);

    await page.goto('https://dashboardcloud.net/iptv/clients', {
      waitUntil: 'domcontentloaded',
      timeout: 60000
    });

    await page.waitForTimeout(3000);

    const searchInput = page.locator('input[type="search"], input[placeholder*="Buscar"], input[placeholder*="buscar"]').first();
    if (await searchInput.count()) {
      await searchInput.fill(usuario);
      await page.waitForTimeout(2000);
    }

    const clientRow = page.locator(`tr:has-text("${usuario}")`).first();
    if (!(await clientRow.count())) {
      throw new Error(`Cliente não encontrado: ${usuario}`);
    }

    if (await clientRow.locator('button:has-text("Renovar"), a:has-text("Renovar")').count()) {
      await clientRow.locator('button:has-text("Renovar"), a:has-text("Renovar")').first().click();
    } else if (await clientRow.locator('[title*="Renovar"], [aria-label*="Renovar"]').count()) {
      await clientRow.locator('[title*="Renovar"], [aria-label*="Renovar"]').first().click();
    } else {
      const actionButtons = clientRow.locator('button, a');
      const count = await actionButtons.count();
      if (count === 0) {
        throw new Error('Nenhum botão de ação encontrado na linha do cliente');
      }
      await actionButtons.nth(0).click();
    }

    await page.waitForTimeout(1500);

    // pula campo de meses (já vem como 1 por padrão)
await page.waitForTimeout(1000);
    }

    await monthInput.fill(String(meses));
    await page.waitForTimeout(500);

    const confirmButton = page.locator('button:has-text("Confirmar"), button:has-text("Salvar"), button:has-text("Renovar")').first();
    if (!(await confirmButton.count())) {
      throw new Error('Botão de confirmar renovação não encontrado');
    }

    await confirmButton.click();
    await page.waitForTimeout(2500);

    const bodyText = await page.locator('body').innerText().catch(() => '');
    const sucessoDetectado = /sucesso|renovado|atualizado|confirmado/i.test(bodyText);

    await context.close();
    await browser.close();

    return res.json({
      success: true,
      message: sucessoDetectado ? 'Renovação concluída' : 'Renovação enviada',
      usuario,
      meses
    });
  } catch (error) {
    try {
      if (context) await context.close();
    } catch {}

    try {
      if (browser) await browser.close();
    } catch {}

    return res.status(500).json({
      success: false,
      message: 'Erro ao renovar cliente',
      error: error.message,
      usuario,
      meses
    });
  }
});

app.listen(3001, () => {
  console.log('Rodando na porta 3001');
});
