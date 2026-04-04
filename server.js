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
  await page.goto(`${BASE_URL}`, {
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
    const started = await startBrowser();
    browser = started.browser;
    context = started.context;
    const page = started.page;

    await ensureLoggedIn(page);

    // Ajuste esta URL se a tela de clientes tiver rota específica
    await page.goto(`${BASE_URL}`, {
      waitUntil: 'domcontentloaded',
      timeout: 60000
    });

    await page.waitForTimeout(3000);

    // Tenta localizar o usuário na tela
    // Se houver busca, preenche; se não houver, o locator abaixo ainda 
pode achar a linha
    const searchInput = page.locator('input[type="search"], 
input[placeholder*="Buscar"], input[placeholder*="buscar"]').first();
    if (await searchInput.count()) {
      await searchInput.fill(usuario);
      await page.waitForTimeout(2000);
    }

    // Linha do cliente
    const clientRow = page.locator(`tr:has-text("${usuario}")`).first();
    if (!(await clientRow.count())) {
      throw new Error(`Cliente não encontrado: ${usuario}`);
    }

    // Botão de renovar na linha
    // Ajuste fino se o painel usar outro seletor
    const renewButton = clientRow.locator('button, a').filter({
      has: page.locator('i, svg')
    }).nth(0);

    // Alternativas mais seguras caso exista texto ou tooltip
    if (await clientRow.locator('button:has-text("Renovar"), 
a:has-text("Renovar")').count()) {
      await clientRow.locator('button:has-text("Renovar"), 
a:has-text("Renovar")').first().click();
    } else if (await clientRow.locator('[title*="Renovar"], 
[aria-label*="Renovar"]').count()) {
      await clientRow.locator('[title*="Renovar"], 
[aria-label*="Renovar"]').first().click();
    } else {
      await renewButton.click();
    }

    await page.waitForTimeout(1500);

    // Modal de renovação
    const monthInput = page.locator('input[type="number"]').first();
    if (!(await monthInput.count())) {
      throw new Error('Campo de meses não encontrado na renovação');
    }

    await monthInput.fill(String(meses));
    await page.waitForTimeout(500);

    // Confirmar
    const confirmButton = page.locator('button:has-text("Confirmar"), 
button:has-text("Salvar"), button:has-text("Renovar")').first();
    if (!(await confirmButton.count())) {
      throw new Error('Botão de confirmar renovação não encontrado');
    }

    await confirmButton.click();
    await page.waitForTimeout(2500);

    // Tenta detectar mensagem de sucesso
    const bodyText = await page.locator('body').innerText().catch(() => 
'');
    const sucessoDetectado = 
/sucesso|renovado|atualizado|confirmado/i.test(bodyText);

    await context.close();
    await browser.close();

    return res.json({
      success: true,
      message: sucessoDetectado ? 'Renovação concluída' : 'Renovação 
enviada',
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
