import { Router, Request, Response } from 'express';
import { GaiaFortuneService } from './service';
import {
  calcFromBirthday, KYUSEI_NAMES, KYUSEI_NAME_TO_NUM,
  STEM_TO_KYUSEI, BRANCH_TO_KYUSEI,
  formatTraits, getBiorhythm, formatBiorhythmRange,
  SOUSHOU_DESC, SOUKOKU_DESC, BIORHYTHM_2026,
  TOKUSEI_PRIORITY_BY_CATEGORY, TRAITS_20,
} from './knowledge';

// ============================================================
// 3つの鑑定視点テキスト生成ヘルパー
// ============================================================

function getTopTraits(kyuseiNum: number, count: number = 3): { name: string; desc: string }[] {
  const traits = TRAITS_20[kyuseiNum] || [];
  return traits.slice(0, count);
}

// 本命星の重要特性：コードブックで四角に囲まれた 1,6,11,16番目（0始まりで 0,5,10,15）
const KEY_TRAIT_INDICES = [0, 5, 10, 15];

function getKeyTraits(kyuseiNum: number): { name: string; desc: string }[] {
  const traits = TRAITS_20[kyuseiNum] || [];
  return KEY_TRAIT_INDICES.map(i => traits[i]).filter(Boolean);
}

function buildImpression(label: string, kyuseiNum: number, kyuseiName: string, sourceChar: string, sourceLabel: string): object {
  const traits = getTopTraits(kyuseiNum, 3);
  return {
    label,
    sourceChar,
    sourceLabel,
    kyuseiName,
    traits: traits.map(t => ({ name: t.name, desc: t.desc })),
  };
}

const router = Router();

// 五行マッピング
const KYUSEI_ELEMENTS: Record<number, string> = {
  1: '水', 2: '土', 3: '木', 4: '木', 5: '土', 6: '金', 7: '金', 8: '土', 9: '火',
};
const STEM_ELEMENTS: Record<string, string> = {
  '甲': '木', '乙': '木', '丙': '火', '丁': '火', '戊': '土',
  '己': '土', '庚': '金', '辛': '金', '壬': '水', '癸': '水',
};
const STEM_READINGS: Record<string, string> = {
  '甲': 'きのえ', '乙': 'きのと', '丙': 'ひのえ', '丁': 'ひのと', '戊': 'つちのえ',
  '己': 'つちのと', '庚': 'かのえ', '辛': 'かのと', '壬': 'みずのえ', '癸': 'みずのと',
};
const BRANCH_READINGS: Record<string, string> = {
  '子': 'ね', '丑': 'うし', '寅': 'とら', '卯': 'う', '辰': 'たつ', '巳': 'み',
  '午': 'うま', '未': 'ひつじ', '申': 'さる', '酉': 'とり', '戌': 'いぬ', '亥': 'い',
};
const BRANCH_ELEMENTS: Record<string, string> = {
  '子': '水', '丑': '土', '寅': '木', '卯': '木', '辰': '土', '巳': '火',
  '午': '火', '未': '土', '申': '金', '酉': '金', '戌': '土', '亥': '水',
};
const KYUSEI_DIRECTIONS: Record<number, string> = {
  1: '北', 2: '南西', 3: '東', 4: '南東', 5: '中宮', 6: '北西', 7: '西', 8: '北東', 9: '南',
};
const BRANCH_OPPOSITES: Record<string, string> = {
  '子': '南', '丑': '南南西', '寅': '西南西', '卯': '西', '辰': '西北西', '巳': '北北西',
  '午': '北', '未': '北北東', '申': '東北東', '酉': '東', '戌': '東南東', '亥': '南南東',
};

const FLY_ORDER = [5, 6, 7, 8, 9, 1, 2, 3, 4];
function generateStarChart(centerStar: number): number[] {
  const chart = new Array(9);
  for (let i = 0; i < 9; i++) {
    let star = ((centerStar - 1 + i) % 9) + 1;
    chart[FLY_ORDER[i] - 1] = star;
  }
  return chart;
}

function getGoouDirection(chart: number[]): string | null {
  const pos = chart.indexOf(5);
  if (pos < 0 || pos === 4) return null;
  return KYUSEI_DIRECTIONS[pos + 1] || null;
}

function getAnkenDirection(chart: number[]): string | null {
  const goouPos = chart.indexOf(5);
  if (goouPos < 0 || goouPos === 4) return null;
  const DIR_OPPOSITES: Record<number, number> = { 1: 9, 2: 8, 3: 7, 4: 6, 6: 4, 7: 3, 8: 2, 9: 1 };
  const oppNum = DIR_OPPOSITES[goouPos + 1];
  return oppNum ? KYUSEI_DIRECTIONS[oppNum] || null : null;
}

router.all('/calculate', (req: Request, res: Response) => {
  try {
    const { year, month, day } = req.body;
    if (!year || !month || !day) {
      res.status(400).json({ success: false, error: '年月日が必要です。' });
      return;
    }

    const result = calcFromBirthday(year, month, day);
    if (!result) {
      res.status(400).json({ success: false, error: '対応範囲外の年です（1919〜2026年）。' });
      return;
    }

    const kyuseiNum = KYUSEI_NAME_TO_NUM[result.honmeisei];
    const stemKyuseiNum = STEM_TO_KYUSEI[result.jikkan] || kyuseiNum;
    const branchKyuseiNum = BRANCH_TO_KYUSEI[result.junishi] || kyuseiNum;

    const targetKyusei = 1;
    const chart = generateStarChart(targetKyusei);
    const bio2026 = BIORHYTHM_2026[kyuseiNum];

    const goou = getGoouDirection(chart);
    const anken = getAnkenDirection(chart);
    const saiha = BRANCH_OPPOSITES['午'] || '北';

    res.json({
      success: true,
      data: {
        kyusei: result.honmeisei,
        kyuseiNum,
        stem: result.jikkan,
        stemReading: STEM_READINGS[result.jikkan] || '',
        branch: result.junishi,
        branchReading: BRANCH_READINGS[result.junishi] || '',
        element: KYUSEI_ELEMENTS[kyuseiNum] || '',
        stemElement: STEM_ELEMENTS[result.jikkan] || '',
        branchElement: BRANCH_ELEMENTS[result.junishi] || '',
        stemKyusei: KYUSEI_NAMES[stemKyuseiNum],
        stemKyuseiNum,
        branchKyusei: KYUSEI_NAMES[branchKyuseiNum],
        branchKyuseiNum,
        bioPhase: bio2026?.biorhythm || '',
        bioSeason: bio2026?.season || '',
        bioType: bio2026?.type || '',
        positionBoard: bio2026?.positionBoard || '',
        bioNote: bio2026?.note || '',
        goouDir: goou || '該当なし（五黄が中宮）',
        ankenDir: anken || '該当なし（五黄が中宮）',
        saihaDir: saiha,
        chart,
        fortuneContext: {
          kyusei: result.honmeisei,
          kyuseiNum,
          stem: `${result.jikkan}（${STEM_READINGS[result.jikkan] || ''}）`,
          branch: `${result.junishi}（${BRANCH_READINGS[result.junishi] || ''}）`,
          element: KYUSEI_ELEMENTS[kyuseiNum] || '',
          bioPhase: bio2026?.biorhythm || '',
          bioSeason: bio2026?.season || '',
          goouDir: goou || '該当なし（五黄が中宮）',
          ankenDir: anken || '該当なし（五黄が中宮）',
          saihaDir: saiha,
          yearTheme: '上善如水（じょうぜんみずのごとし）— 艱難辛苦を玉と成す・誠実な生き方を実践する',
        },
        firstImpression: buildImpression(
          '第一印象',
          branchKyuseiNum,
          KYUSEI_NAMES[branchKyuseiNum] || '',
          result.junishi,
          '十二支',
        ),
        behaviorTraits: buildImpression(
          '行動特性',
          stemKyuseiNum,
          KYUSEI_NAMES[stemKyuseiNum] || '',
          result.jikkan,
          '十干',
        ),
        destinyPoint: {
          label: '運命を動かすポイント',
          sourceChar: result.honmeisei,
          sourceLabel: '本命星',
          kyuseiName: result.honmeisei,
          traits: getKeyTraits(kyuseiNum).map(t => ({ name: t.name, desc: t.desc })),
        },
      },
    });
  } catch (err: any) {
    console.error('Calculate error:', err.message);
    res.status(500).json({ success: false, error: `算出エラー: ${err.message}` });
  }
});

router.post('/chat', async (req: Request, res: Response) => {
  try {
    const { message, fortuneContext, history, anthropicApiKey } = req.body;

    if (!message || !fortuneContext) {
      res.status(400).json({ success: false, error: 'メッセージと鑑定データが必要です。' });
      return;
    }

    const service = new GaiaFortuneService(anthropicApiKey);
    if (!service.isAvailable()) {
      res.status(400).json({ success: false, error: 'APIキーが設定されていません。' });
      return;
    }

    const reply = await service.chat(message, fortuneContext, history || []);
    res.json({ success: true, reply });
  } catch (err: any) {
    console.error('Gaia fortune chat error:', err.message);
    const msg = err?.status === 401
      ? 'APIキーが無効です。正しいキーを入力してください。'
      : err?.status === 403
      ? 'このAPIキーではモデルへのアクセス権がありません。Anthropic Consoleでプランをご確認ください。'
      : err?.status === 429
      ? 'リクエスト制限に達しました。しばらく待ってから再度お試しください。'
      : err?.status === 529
      ? 'APIサーバーが混雑しています。しばらく待ってから再度お試しください。'
      : err?.error?.error?.type === 'insufficient_credits' || err?.message?.includes('credit')
      ? 'APIクレジットが不足しています。Anthropic Consoleでクレジットを追加してください。'
      : `AI応答の生成に失敗しました（${err.message || '不明なエラー'}）`;
    res.status(err?.status || 500).json({ success: false, error: msg });
  }
});

export const gaiaFortuneRouter = router;
