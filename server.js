import express from 'express';
import dotenv from 'dotenv';
import fs from 'fs';
import { chromium } from 'playwright';

dotenv.config();

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;
const API_KEY = process.env.API_KEY || '';
const LOGIN_URL = process.env.LOGIN_URL || '';

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'playwright-api',
    timestamp: new Date().toISOString()
  });
});

app.post('/run', async (req, res) => {
  try {
    const authHeader = req.headers['x-api-key'];

    if (!API_KEY) {
      return res.status(500).json({
        success: false,
        message: 'API_KEY não configurada'
      });
    }

    if (authHeader !== API_KEY) {
      return res.status(401).json({
        success: false,
        message: 'API key inválida'
      });
    }

    if (!fs.existsSync('session.json')) {
      return res.status(400).json({
        success: false,
        message: 'session.json não encontrado'
      });
    }

    const browser = await chromium.launch({
      headless: true
    });

    const context = await browser.newContext({
      storageState: 'session.json'
    });

    const page = await context.newPage();

    if (LOGIN_URL) {
      await page.goto(LOGIN_URL, {
        waitUntil: 'domcontentloaded',
        timeout: 60000
      });
    }

    await browser.close();

    return res.json({
      success: true,
      message: 'Automação executada com sucesso',
      data: req.body || {}
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Erro ao executar automação',
      error: error.message
    });
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Rodando na porta ${PORT}`);
});
