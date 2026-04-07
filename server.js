import express from "express";
import cors from "cors";
import fs from "fs";
import path from "path";
import { chromium } from "playwright";

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;
const BASE_URL = "https://dashboardcloud.net";
const API_KEY = process.env.API_KEY;

function auth(req, res, next) {
  const key = req.headers["x-api-key"];
  if (!key || key !== API_KEY) {
    return res.status(401).json({ error: "API KEY inválida" });
  }
  next();
}

async function browserSession() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    storageState: "./session.json"
  });
  const page = await context.newPage();
  return { browser, context, page };
}

app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

app.post("/listar-clientes", auth, async (req, res) => {
  let browser, context, page;

  try {
    ({ browser, context, page } = await browserSession());

    await page.goto(`${BASE_URL}/iptv/clients`);
    await page.waitForTimeout(3000);

    const clientes = await page.evaluate(() => {
      const rows = document.querySelectorAll("table tbody tr");

      return Array.from(rows).map(row => {
        const cells = row.querySelectorAll("td");

        return {
          nome: cells[1]?.innerText.trim(),
          usuario: cells[2]?.innerText.trim(),
          vencimento: cells[6]?.innerText.trim(),
          status: cells[9]?.innerText.trim()
        };
      });
    });

    res.json({
      success: true,
      total: clientes.length,
      clientes
    });

  } catch (e) {
    res.status(500).json({ error: e.message });
  } finally {
    await page?.close();
    await context?.close();
    await browser?.close();
  }
});

app.post("/renovar", auth, async (req, res) => {
  const { usuario } = req.body;

  if (!usuario) {
    return res.status(400).json({ error: "usuario obrigatório" });
  }

  let browser, context, page;

  try {
    ({ browser, context, page } = await browserSession());

    await page.goto(`${BASE_URL}/iptv/clients`);
    await page.waitForTimeout(3000);

    await page.fill("input[type=search]", usuario);
    await page.waitForTimeout(2000);

    const btn = await page.$("button.btn-success");
    if (btn) {
      await btn.click();
      await page.waitForTimeout(2000);
    }

    res.json({ success: true, usuario });

  } catch (e) {
    res.status(500).json({ error: e.message });
  } finally {
    await page?.close();
    await context?.close();
    await browser?.close();
  }
});

app.listen(PORT, () => {
  console.log("API rodando na porta", PORT);
});
