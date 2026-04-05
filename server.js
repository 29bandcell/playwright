import express from 'express';

const app = express();
app.use(express.json());

app.get('/health', (req, res) => {
  res.json({
    status: 'ok'
  });
});

app.post('/renovar', (req, res) => {
  res.json({
    success: true,
    message: 'teste ok'
  });
});

app.listen(3001, () => {
  console.log('rodando');
});
