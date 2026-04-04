import express from 'express';
import { chromium } from 'playwright';
import fs from 'fs';

const app = express();
app.use(express.json());

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'playwright-api',
    timestamp: new Date().toISOString()
  });
});

const API_KEY = process.env.API_KEY;

// helper
function checkAuth(req, res) {
  if (req.headers['x-api-key'] !== API_KEY) {
    res.status(401).json({ error: 'Não autorizado' });
    return false;
  }
  return true;
}

// abrir navegador com sessão
async function startBrowser() {
  if (!fs.existsSync('session.json')) {
    throw new Error('session.json não encontrado');
  }

  return await chromium.launchPersistentContext('', {
    headless: true,
    storageState: 'session.json'
  });
}

//////////////////////////////////////////////////////
// 🚀 GERAR TESTE
//////////////////////////////////////////////////////
app.post('/gerar-teste', async (req, res) => {
  if (!checkAuth(req, res)) return;

  let context;

  try {
    context = await startBrowser();
    const page = await context.newPage();

    await page.goto('https://dashboardcloud.net/iptv/clients');

    // clicar em criar teste
    await page.click('text=Criar Teste');

    // esperar modal aparecer
    await page.waitForSelector('text=Dados do teste');

    const texto = await page.locator('textarea').innerText();

    await context.close();

    return res.json({
      success: true,
      dados_brutos: texto
    });

  } catch (err) {
    if (context) await context.close();
    return res.json({
      success: false,
      error: err.message
    });
  }
});

//////////////////////////////////////////////////////
// 🔄 RENOVAR CLIENTE
//////////////////////////////////////////////////////
app.post('/renovar', async (req, res) => {
  if (!checkAuth(req, res)) return;

  const { usuario, meses = 1 } = req.body;

  let context;

  try {
    context = await startBrowser();
    const page = await context.newPage();

    await page.goto('https://dashboardcloud.net/iptv/clients');

    // buscar cliente
    await page.fill('input[type="search"]', usuario);

    await page.waitForTimeout(2000);

    // clicar botão renovar (ajustar seletor se precisar)
    await page.click('button:has-text("Renovar")');

    // preencher meses
    await page.fill('input[type="number"]', String(meses));

    // confirmar
    await page.click('button:has-text("Confirmar")');

    await context.close();

    return res.json({
      success: true,
      usuario,
      meses
    });

  } catch (err) {
    if (context) await context.close();
    return res.json({
      success: false,
      error: err.message
    });
  }
});

//////////////////////////////////////////////////////
// TESTE
//////////////////////////////////////////////////////
app.post('/run', async (req, res) => {
  return res.json({
    success: true,
    message: "API funcionando"
  });
});

app.listen(3001, () => {
  console.log('Rodando na porta 3001');
});
