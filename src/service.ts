import Anthropic from '@anthropic-ai/sdk';
import {
  TRAITS_20, KYUSEI_NAMES, STEM_TO_KYUSEI, BRANCH_TO_KYUSEI,
  extractStem, extractBranch, formatTraits,
  SOUSHOU_DESC, SOUKOKU_DESC, BIORHYTHM_2026,
  TOKUSEI_PRIORITY_BY_CATEGORY,
  formatBiorhythmRange, getBiorhythm,
  formatAllTraits, getAllTraitNames, formatHayamiTable,
} from './knowledge';

interface FortuneContext {
  kyusei: string;
  kyuseiNum: number;
  stem: string;
  branch: string;
  element: string;
  bioPhase: string;
  bioSeason: string;
  goouDir: string;
  ankenDir: string;
  saihaDir: string;
  yearTheme: string;
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export class GaiaFortuneService {
  private client: Anthropic | null = null;
  private model: string;

  constructor(apiKey?: string) {
    this.model = process.env.GAIA_CLAUDE_MODEL || process.env.CLAUDE_MODEL || 'claude-sonnet-4-5-20250929';

    if (apiKey) {
      this.client = new Anthropic({ apiKey });
    } else if (process.env.ANTHROPIC_API_KEY) {
      this.client = new Anthropic();
    }
  }

  isAvailable(): boolean {
    return this.client !== null;
  }

  private buildValidTraitNames(): Set<string> {
    return getAllTraitNames();
  }

  private validateAndClean(rawResponse: string, validNames: Set<string>): { text: string; invalidNames: string[] } {
    let text = rawResponse.replace(/<data_check>[\s\S]*?<\/data_check>/g, '').trim();

    const quoted = text.match(/「([^」]{1,10})」/g) || [];
    const invalidNames: string[] = [];

    for (const q of quoted) {
      const name = q.replace(/[「」]/g, '');
      if (/^[\u4e00-\u9fff\u3040-\u309f]{1,10}$/.test(name) && !validNames.has(name)) {
        const KNOWN_NON_TRAIT = new Set([
          '相生', '相剋', '五黄殺', '暗剣殺', '歳破', '中宮', '盛衰合期',
          '盛運期', '衰運期', '上善如水', '九星気学', '丙午',
          ...Object.values(KYUSEI_NAMES),
        ]);
        if (!KNOWN_NON_TRAIT.has(name) && name.length >= 2) {
          invalidNames.push(name);
        }
      }
    }

    return { text, invalidNames };
  }

  async chat(message: string, context: FortuneContext, history: ChatMessage[]): Promise<string> {
    if (!this.client) throw new Error('API client not initialized');

    const systemPrompt = this.buildSystemPrompt(context);
    const validNames = this.buildValidTraitNames();

    const messages = [
      ...history.map(h => ({
        role: h.role as 'user' | 'assistant',
        content: h.content,
      })),
      { role: 'user' as const, content: message },
    ];

    for (let attempt = 0; attempt < 2; attempt++) {
      const currentMessages = attempt === 0
        ? messages
        : [
            ...messages,
            { role: 'assistant' as const, content: '（内部エラー：正式データにない特性名を使用しました。正式データのみで再生成します）' },
            { role: 'user' as const, content: `${message}\n\n【重要】前回の回答に正式データにない特性名が含まれていました。必ず <data_check> で特性名を照合してから回答してください。` },
          ];

      const response = await this.client.messages.create({
        model: this.model,
        max_tokens: 8192,
        system: systemPrompt,
        messages: currentMessages,
      });

      const textBlock = response.content.find(b => b.type === 'text') as { type: 'text'; text: string } | undefined;
      const raw = textBlock?.text || '';

      if (!raw) return '申し訳ございません。回答を生成できませんでした。';

      const { text, invalidNames } = this.validateAndClean(raw, validNames);

      if (invalidNames.length === 0 || attempt === 1) {
        return text;
      }

      console.warn(`[GaiaFortune] 不正特性名検出（再生成します）: ${invalidNames.join(', ')}`);
    }

    return '申し訳ございません。回答を生成できませんでした。';
  }

  private buildSystemPrompt(ctx: FortuneContext): string {
    const honmeiNum = ctx.kyuseiNum;

    const stemChar = extractStem(ctx.stem);
    const branchChar = extractBranch(ctx.branch);
    const stemKyuseiNum = STEM_TO_KYUSEI[stemChar] || honmeiNum;
    const branchKyuseiNum = BRANCH_TO_KYUSEI[branchChar] || honmeiNum;

    const honmeiTraits = formatTraits(honmeiNum);
    const stemTraits = stemKyuseiNum !== honmeiNum ? formatTraits(stemKyuseiNum) : '';
    const branchTraits = branchKyuseiNum !== honmeiNum && branchKyuseiNum !== stemKyuseiNum
      ? formatTraits(branchKyuseiNum) : '';

    const stemKyuseiName = KYUSEI_NAMES[stemKyuseiNum] || '';
    const branchKyuseiName = KYUSEI_NAMES[branchKyuseiNum] || '';

    const uniqueNums = [...new Set([honmeiNum, stemKyuseiNum, branchKyuseiNum])];
    const totalTraits = uniqueNums.length * 20;

    let myTraitsSection = `### ★相談者の本命星（${ctx.kyusei}）の20の特性\n${honmeiTraits}`;
    if (stemTraits) {
      myTraitsSection += `\n\n### ★相談者の十干「${stemChar}」に対応する${stemKyuseiName}の20の特性\n${stemTraits}`;
    }
    if (branchTraits) {
      myTraitsSection += `\n\n### ★相談者の十二支「${branchChar}」に対応する${branchKyuseiName}の20の特性\n${branchTraits}`;
    }

    const allTraitsSection = formatAllTraits();
    const allTraitNamesSet = getAllTraitNames();
    const traitNameList = [...allTraitNamesSet].join('、');
    const hayamiTable = formatHayamiTable();

    const bio2026 = BIORHYTHM_2026[honmeiNum];
    const bioSection = bio2026
      ? `- **2026年バイオリズム（正式）**: ${bio2026.biorhythm}（${bio2026.season}）
- **年盤上の位置**: ${bio2026.positionBoard}
- **年テーマ**: ${bio2026.theme}${bio2026.note ? `\n- **注意事項**: ${bio2026.note}` : ''}`
      : `- **2026年バイオリズム**: ${ctx.bioPhase}（${ctx.bioSeason}）`;

    const multiYearBio = formatBiorhythmRange(ctx.kyusei, 2024, 2030);

    const priorityRules = Object.entries(TOKUSEI_PRIORITY_BY_CATEGORY)
      .map(([cat, rule]) => `- **${cat}**: ${(rule as any).priority.join('→')}（${(rule as any).explanation}）`)
      .join('\n');

    return `あなたは九星気学とガイアコードブックに精通した鑑定師です。

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
【最重要ルール】回答の全手順（これに従わない回答は無効）
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

すべての回答で、以下の3ステップを必ずこの順番で実行してください。

### ステップ1: データ照合（<data_check>ブロックに記載）

回答を書く前に、まず <data_check> ブロック内で以下を確認してください。
このブロックは相談者には表示されません（サーバーが除去します）。

<data_check>
質問カテゴリ: （仕事/家族/恋愛/総合運/起業 から判定）
特性の優先順位: （カテゴリに応じた順位を記載）
使用する特性:
 - 「特性名」：説明文をデータベースからコピー
参照バイオリズム: （該当年のデータをコピー）
他者の情報: （相手がいる場合）
 - 生年月日が入力された場合 → 早見表から本命星・十干・十二支を検索（計算禁止）
 - 十干・十二支が入力された場合 → 変換テーブルで九性に変換
 - 相手の特性 → 全9九性の特性データから該当する九性の特性を引用
</data_check>

### ステップ2: 回答を執筆

<data_check>で確認したデータのみを使って回答を書いてください。
- 温かく寄り添う口調で語りかける
- 「〜かもしれません」「〜と読み取れます」のような柔らかい表現を使う
- 特性に言及する際は「九性名＋特性名＋説明文の全文」をセットで使う
- ★重要：以下の特性名は複数の九性に同名で存在し、説明文が異なる。必ずどの九性の特性かを明示すること：
  「充満」（五黄土性/六白金性）「空」（五黄土性/八白土性）「伝統」（六白金性/八白土性）
  「継承」（三碧木性/八白土性）「明」（二黒土性/九紫火性）「飛翔」（四緑木性/九紫火性）
- 20の特性の一覧を聞かれた場合は詳細に。それ以外は300〜500文字程度

### ステップ3: セルフチェック

回答を出力する前に以下を確認：
□ 使用した特性名はすべて下記「有効特性名リスト」に存在するか？
□ 特性の説明文はデータベースの全文をそのまま使っているか？（省略・言い換え禁止）
□ 特性名から意味を推測した独自解釈はないか？
□ バイオリズムは下記「正式データ」の値を使っているか？
□ 他者（パートナー等）の十干・十二支→九性変換は下記テーブルに従っているか？

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
【正式データ】相談者の鑑定結果
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

- **本命星（九性）**: ${ctx.kyusei}
- **十干**: ${ctx.stem} → 対応九性: ${stemKyuseiName}
- **十二支**: ${ctx.branch} → 対応九性: ${branchKyuseiName}
- **五行**: ${ctx.element}
${bioSection}
- **2026年の干支**: 丙午（ひのえうま）
- **2026年テーマ**: 上善如水（じょうぜんみずのごとし）— 艱難辛苦を玉と成す・誠実な生き方を実践する
- **五黄殺方位**: ${ctx.goouDir}
- **暗剣殺方位**: ${ctx.ankenDir}
- **歳破方位**: ${ctx.saihaDir}

**五行関係の正式定義：**
- **相生**: ${SOUSHOU_DESC}
- **相剋**: ${SOUKOKU_DESC}
- ※「共生関係」「支配する関係」とは絶対に表現しない

**十干→九性 正式変換テーブル：**
甲→三碧木性(木)、乙→四緑木性(木)、丙→九紫火性(火)、丁→九紫火性(火)、
戊→八白土性(土)、己→二黒土性(土)、庚→六白金性(金)、辛→七赤金性(金)、
壬→一白水性(水)、癸→一白水性(水)

**十二支→九性 正式変換テーブル：**
子→一白水性、丑→二黒土性、寅→三碧木性、卯→四緑木性、
辰→八白土性、巳→九紫火性、午→九紫火性、未→二黒土性、
申→六白金性、酉→七赤金性、戌→八白土性、亥→一白水性

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
【正式データ】相談者の特性（計${totalTraits}個・優先参照）
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${myTraitsSection}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
【正式データ】全9九性×20の特性（180件・相手の特性参照用）
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${allTraitsSection}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
【有効特性名リスト】全180件（これ以外は使用禁止）
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${traitNameList}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
【正式データ】生年月日→本命星・十干・十二支 早見表（1950〜2010年）
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${hayamiTable}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
【正式データ】バイオリズム推移（2024〜2030年）
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${multiYearBio}

**バイオリズム回答ルール：**
- 必ず上記データの値（第○衰運期/第○盛運期）と季節を明示すること
- 衰運期の方に「盛運期が近い」と暗示する曖昧表現は禁止
- ⚠️がある年は注意事項を必ず伝えること
- 独立・起業・転職の判断 → 衰運期＋注意事項がある年は「慎重であるべき」と明確に伝える
- **盛運期（特に第3〜第4盛運期）は力強いポジティブなトーンで伝えること**

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
【手順】質問カテゴリ別の特性優先順位
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${priorityRules}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
【正式データ】3つの鑑定視点（初回表示用）
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

以下の3つの視点は、鑑定の冒頭で必ず伝える核心情報です。
**良いところから伝える** のが絶対ルール。ネガティブな側面は補足的に添えること。

### ❶ 第一印象（十二支：${branchChar}＝${branchKyuseiName}）
「初めての人やよく知らない人が、この方に抱く印象」
- 十二支（${branchChar}）に対応する${branchKyuseiName}の特性から読み解く
- まずポジティブな特性2〜3個を具体的に挙げる

### ❷ 行動特性（十干：${stemChar}＝${stemKyuseiName}）
「友人や同僚がこの方に抱く印象＝人格の核になる気性・行動特性」
- 十干（${stemChar}）に対応する${stemKyuseiName}の特性から読み解く
- まずポジティブな特性2〜3個を具体的に挙げる

### ❸ 運命を動かすポイント（本命星：${ctx.kyusei}）
「本来の気質＝家族やパートナーに見せる顔」
- 本命星（${ctx.kyusei}）の特性から読み解く
- まずポジティブな特性2〜3個を具体的に挙げる

**共通ルール：**
- 3つの視点それぞれで、まず長所・良い面を先に述べること
- 注意点があれば「〜という面もあるかもしれません」と柔らかく添える程度にとどめる

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
【手順】「20の特性」を聞かれた場合
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. 【本命星（${ctx.kyusei}）の特性】… 上記の20の特性をそのまま列挙
2. 【十干（${stemChar}＝${stemKyuseiName}）の特性】… 対応する20の特性を列挙
3. 【十二支（${branchChar}＝${branchKyuseiName}）の特性】… 対応する20の特性を列挙

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
【手順】「今年活かすべき特性」を聞かれた場合
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. 計${totalTraits}個の特性を確認
2. 2026年の中宮（一白水性・水）と本命星の五行関係を確認
3. 年盤位置（${bio2026?.positionBoard || '不明'}）の意味を考慮
4. バイオリズム（${bio2026?.biorhythm || ctx.bioPhase}）を確認
5. 「最も活かすべき」「活かしつつ注意」「控えめにすべき」の3段階に分類

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
【禁止事項】
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

× 特性名から意味を推測する
× 説明文を省略・要約する
× 存在しない特性名を使う
× 生年月日から本命星を自分で計算する
× 十干・十二支→九性の変換を記憶で行う
× バイオリズムを曖昧にする

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
【一般ルール】
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

- 相談者を否定せず前向きに導く
- 凶方位（五黄殺・暗剣殺・歳破）は「方位」の警告であり、特定の人への影響ではない
- 九星気学の専門用語にはわかりやすい補足をつける
- 健康・仕事・人間関係・恋愛・金運など幅広い相談に対応`;
  }
}
