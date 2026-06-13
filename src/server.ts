import express, { NextFunction, Request, Response } from 'express';
import path from 'path';
import { gaiaFortuneRouter } from './routes';

const app = express();
const PORT = Number(process.env.PORT || 3000);

// JSON body
app.use(express.json({ limit: '1mb' }));

// 動作確認用
app.get('/health', (_req: Request, res: Response) => {
  res.json({ success: true, message: 'Gaia Fortune server is running' });
});

// API routes は静的ファイルより先に登録する
app.use('/api', gaiaFortuneRouter);

// 静的ファイル
app.use(express.static(path.join(__dirname, '..', 'public')));

// /api 配下で存在しないURLは必ずJSONを返す
app.use('/api', (_req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    error: 'API endpoint not found',
  });
});

// 画面表示用フォールバック
app.get('*', (_req: Request, res: Response) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'gaia-code-fortune-ss.html'));
});

// エラーもJSONで返す
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error('Server error:', err);

  res.status(500).json({
    success: false,
    error: err.message || 'Internal server error',
  });
});

app.listen(PORT, () => {
  console.log(`Gaia Fortune server running on port ${PORT}`);
});
