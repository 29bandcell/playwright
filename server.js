import express from 'express';

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;
const API_KEY = process.env.API_KEY || '';

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'playwright-api',
    timestamp: new Date().toISOString()
  });
});

app.post('/run', async (req, res) => {
  const sentKey = req.headers['x-api-key'];

  if (!API_KEY) {
    return res.status(500).json({
      success: false,
      message: 'API_KEY não configurada'
    });
  }

  if (!sentKey || sentKey !== API_KEY) {
    return res.status(401).json({
      success: false,
      message: 'API key inválida'
    });
  }

  return res.json({
    success: true,
    message: 'OK',
    data: req.body
  });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Rodando na porta ${PORT}`);
});
