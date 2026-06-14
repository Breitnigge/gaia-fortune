// ============================================================
// ガイアコードブック 正式データ — knowledge.ts
// ============================================================
// ★ 全データをJSONファイルから読み込む。ハードコードは一切しない。
// ★ 山内さんからJSONが更新されたら、ファイルを差し替えるだけでOK。
// ============================================================

import traitsMasterData from './traits-master-v4.json';
import biorhythmFullData from './biorhythm-full.json';
import hayamiTableData from './hayami-table.json';

// ============================================================
// 十干・十二支データ ← jikkan_junishi_data.ts から読み込み
// ============================================================

export {
  JIKKAN_DATA,
  JUNISHI_DATA,
  SECTION_INTRO,
} from './jikkan_junishi_data';

// ============================================================
// 九性の基本定義（これは固定値なので直書きでOK）
// ============================================================

const KYUSEI_ORDER = [
  '一白水性', '二黒土性', '三碧木性', '四緑木性', '五黄土性',
  '六白金性', '七赤金性', '八白土性', '九紫火性',
];

export const KYUSEI_NAME_TO_NUM: Record<string, number> = {
  '一白水性': 1, '二黒土性': 2, '三碧木性': 3, '四緑木性': 4,
  '五黄土性': 5, '六白金性': 6, '七赤金性': 7, '八白土性': 8, '九紫火性': 9,
};

export const KYUSEI_NAMES: Record<number, string> = {
  1: '一白水性', 2: '二黒土性', 3: '三碧木性', 4: '四緑木性',
  5: '五黄土性', 6: '六白金性', 7: '七赤金性', 8: '八白土性', 9: '九紫火性',
};

// ============================================================
// 特性データ（180件）← traits-master-v4.json から読み込み
// ============================================================

export const TRAITS_20: Record<number, { name: string; desc: string }[]> = (() => {
  const result: Record<number, { name: string; desc: string }[]> = {};
  for (let i = 0; i < KYUSEI_ORDER.length; i++) {
    const kyuseiName = KYUSEI_ORDER[i];
    const traits = (traitsMasterData as any)[kyuseiName];
    if (traits && Array.isArray(traits)) {
      result[i + 1] = traits.map((t: any) => ({ name: t.name, desc: t.content }));
    }
  }
  return result;
})();

// ============================================================
// 変換テーブル ← hayami-table.json から読み込み
// ============================================================

// 十干 → 対応する九性番号
export const STEM_TO_KYUSEI: Record<string, number> = (() => {
  const table = (hayamiTableData as any)['1_十干から九性への変換テーブル'];
  if (!table) return {};
  const result: Record<string, number> = {};
  for (const [stem, kyuseiName] of Object.entries(table)) {
    if (stem.startsWith('_')) continue; // _使い方 等のメタフィールドをスキップ
    const num = KYUSEI_NAME_TO_NUM[kyuseiName as string];
    if (num) result[stem] = num;
  }
  return result;
})();

// 十二支 → 対応する九性番号
export const BRANCH_TO_KYUSEI: Record<string, number> = (() => {
  const table = (hayamiTableData as any)['2_十二支から九性への変換テーブル'];
  if (!table) return {};
  const result: Record<string, number> = {};
  for (const [branch, kyuseiName] of Object.entries(table)) {
    if (branch.startsWith('_')) continue;
    const num = KYUSEI_NAME_TO_NUM[kyuseiName as string];
    if (num) result[branch] = num;
  }
  return result;
})();

// ============================================================
// ヘルパー関数
// ============================================================

export function extractStem(stemStr: string): string {
  return stemStr.charAt(0);
}

export function extractBranch(branchStr: string): string {
  return branchStr.charAt(0);
}

export function formatTraits(kyuseiNum: number): string {
  const traits = TRAITS_20[kyuseiNum];
  if (!traits) return '';
  return traits.map((t, i) => `${i + 1}. ${t.name}：${t.desc}`).join('\n');
}

// ============================================================
// 相生・相剋の正式定義
// ============================================================

export const SOUSHOU_DESC = '愛と優しさで共存共栄するライフスタイル（正法輪身）';
export const SOUKOKU_DESC = '智慧と叱咤激励で向上発展するライフスタイル（教令輪身）';

// ============================================================
// 質問カテゴリ別の特性優先順位ルール
// ============================================================

export const TOKUSEI_PRIORITY_BY_CATEGORY: Record<string, { priority: string[]; explanation: string }> = {
  '仕事・職業・セカンドキャリア': {
    priority: ['十二支', '十干', '九性'],
    explanation: '十二支の特性を職業適性の核として最初に提示し、十干の行動特性で補強、九性の気質で補足する',
  },
  '家族・夫婦関係': {
    priority: ['九性', '十二支', '十干'],
    explanation: '九性は家族やパートナーに見せる顔を表すため、九性を核に。十二支の性格面で補強',
  },
  '恋愛・結婚・出会い': {
    priority: ['十二支', '十干', '九性'],
    explanation: '出会いでは第一印象（十二支）が重要。十干の社交性で補強、九性の本質で補足',
  },
  '総合運・今年の運勢': {
    priority: ['九性', '十干', '十二支'],
    explanation: 'バイオリズムや年盤の位置は九性で判断するため、九性を核に。十干・十二支の特性で各分野を補足',
  },
  '起業・独立・決断のタイミング': {
    priority: ['九性', '十干', '十二支'],
    explanation: 'バイオリズムで何をするタイミングなのかを判断するため、九性を核に。十干の行動特性で実務面を補足',
  },
};

// ============================================================
// 早見表（1919〜2026年、108件）← hayami-table.json から読み込み
// ============================================================

/**
 * 早見表から指定年のデータを取得
 */
export function lookupHayami(year: number): { honmeisei: string; jikkan: string; junishi: string; setsubun_date: string } | null {
  const years = (hayamiTableData as any)['3_生年月日から本命星を算出するためのデータ']?.years;
  if (!years) return null;
  return years.find((e: any) => e.year === year) || null;
}

/**
 * 生年月日から本命星・十干・十二支を正確に算出（早見表ベース）
 */
export function calcFromBirthday(year: number, month: number, day: number): { honmeisei: string; jikkan: string; junishi: string } | null {
  const thisYear = lookupHayami(year);
  if (!thisYear) return null;

  const [sm, sd] = thisYear.setsubun_date.split('-').slice(1).map(Number);
  const useYear = (month < sm || (month === sm && day < sd)) ? year - 1 : year;
  const data = lookupHayami(useYear);
  if (!data) return null;

  return { honmeisei: data.honmeisei, jikkan: data.jikkan, junishi: data.junishi };
}

// ============================================================
// 特性フォーマット関数
// ============================================================

/**
 * 全9九性×20の特性をフォーマット（システムプロンプト用・全データ）
 */
export function formatAllTraits(): string {
  const sections: string[] = [];
  for (let num = 1; num <= 9; num++) {
    const name = KYUSEI_NAMES[num];
    const traits = TRAITS_20[num];
    if (!traits) continue;
    const lines = traits.map((t, i) => `${i + 1}. ${t.name}：${t.desc}`).join('\n');
    sections.push(`### ${name}の20の特性\n${lines}`);
  }
  return sections.join('\n\n');
}

/**
 * 全9九性の全特性名リスト（バリデーション用）
 */
export function getAllTraitNames(): Set<string> {
  const names = new Set<string>();
  for (let num = 1; num <= 9; num++) {
    for (const t of (TRAITS_20[num] || [])) {
      names.add(t.name);
    }
  }
  return names;
}

/**
 * 早見表をシステムプロンプト用にフォーマット（全108件 — フィルターなし）
 * ★ 以前は1950〜2010年に絞っていたが、子どもの年（2021等）が漏れる原因になるため全件にした
 */
export function formatHayamiTable(): string {
  const years = (hayamiTableData as any)['3_生年月日から本命星を算出するためのデータ']?.years;
  if (!years) return '';
  return years
    .map((e: any) => `${e.year}年: ${e.honmeisei}・${e.jikkan}・${e.junishi}（節分:${e.setsubun_date.slice(5)}）`)
    .join('\n');
}

// ============================================================
// バイオリズム ← biorhythm-full.json から読み込み
// ============================================================

export interface BiorhythmEntry {
  board: number;
  biorhythm: string;
  alerts: string[];
}

export interface YearInfo {
  jikkan: string;
  junishi: string;
  chuuguu: string;
}

const BOARD_TO_SEASON: Record<number, string> = {
  1: '冬の3年目・計画/準備',
  2: '春の1年目・種まき',
  3: '春の2年目・種まき',
  4: '夏の1年目・栄養を与える',
  5: '夏の2年目・栄養を与える',
  6: '第5盛運期と第1衰運期が並行するターニングポイント',
  7: '秋の2年目・収穫',
  8: '冬の1年目・計画/準備',
  9: '冬の2年目・計画/準備',
};

export const ALERT_DESCRIPTIONS: Record<string, string> = {
  '暗剣': '他動的トラブル、詐欺、事故、損失、ケガ、破綻など災厄に注意',
  '歳破': '自発的トラブル、病気、事故、損失、ケガ、破綻など災厄に注意',
  '剋': 'その年の中宮の九性に剋される関係にある（試練の年）',
  'エコノミー': '第5衰運期。運気が最も低下し、判断ミス・体調不良等に注意',
};

export function getBiorhythm(year: number, kyuseiName: string): (BiorhythmEntry & { season: string }) | null {
  const yearData = (biorhythmFullData as any).yearly_data?.[String(year)];
  if (!yearData) return null;
  const entry = yearData.kyusei_data?.[kyuseiName];
  if (!entry) return null;
  return {
    board: entry.board,
    biorhythm: entry.biorhythm,
    alerts: entry.alerts || [],
    season: BOARD_TO_SEASON[entry.board] || '',
  };
}

export function getYearInfo(year: number): YearInfo | null {
  const yearData = (biorhythmFullData as any).yearly_data?.[String(year)];
  return yearData?.year_info || null;
}

export function formatBiorhythmRange(kyuseiName: string, startYear: number, endYear: number): string {
  const lines: string[] = [];
  for (let y = startYear; y <= endYear; y++) {
    const bio = getBiorhythm(y, kyuseiName);
    const yearInfo = getYearInfo(y);
    if (!bio || !yearInfo) continue;
    const alertStr = bio.alerts.length > 0
      ? ` ⚠️ ${bio.alerts.map(a => `${a}（${ALERT_DESCRIPTIONS[a] || a}）`).join('、')}`
      : '';
    const marker = y === 2026 ? ' ←今年' : '';
    lines.push(`- **${y}年**（${yearInfo.jikkan}${yearInfo.junishi}・中宮:${yearInfo.chuuguu}）: ${bio.biorhythm}（${bio.season}）${alertStr}${marker}`);
  }
  return lines.join('\n');
}

// 2026年バイオリズム（biorhythm-full.json から動的に構築）
export const BIORHYTHM_2026: Record<number, { biorhythm: string; season: string; type: string; positionBoard: string; theme: string; note?: string }> = (() => {
  const result: Record<number, any> = {};
  for (let num = 1; num <= 9; num++) {
    const name = KYUSEI_NAMES[num];
    const bio = getBiorhythm(2026, name);
    if (!bio) continue;
    const isRising = bio.biorhythm.includes('盛運');
    const isTransition = bio.biorhythm.includes('盛衰');
    result[num] = {
      biorhythm: bio.biorhythm,
      season: bio.season,
      type: isTransition ? '盛衰合期' : isRising ? '盛運' : '衰運',
      positionBoard: name,
      theme: '',
      ...(bio.alerts.length > 0 ? { note: bio.alerts.map(a => `${a}（${ALERT_DESCRIPTIONS[a] || a}）`).join('。') } : {}),
    };
  }
  return result;
})();
