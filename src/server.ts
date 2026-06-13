import express from 'express';
import path from 'path';
import { gaiaFortuneRouter } from './routes';

const app = express();
const PORT = parseInt(process.env.PORT || '3000', 10);

app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

// API routes
app.use('/', gaiaFortuneRouter);

// SPA fallback
app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'gaia-code-fortune-ss.html'));
});

app.listen(PORT, () => {
  console.log(`Gaia Fortune server running on port ${PORT}`);
});
