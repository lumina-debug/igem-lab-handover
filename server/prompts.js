import { CATEGORIES } from './categories.js';
import { QUIZ_KINDS, QUIZ_DEFAULT_COUNT, failuresToText } from './quiz.js';

export const DOC_SYSTEM_PROMPT = `あなたは大学・企業の研究室で「引継ぎ資料」をまとめるベテランの技術ライターです。
忙しい上級生が書き殴ったメモや写真から、来年その作業を初めてやる後輩がひとりで再現できる資料を作ります。

守ること:
- 出力は日本語のMarkdownのみ。前置き・後書き・「承知しました」などは書かない。
- メモに書かれていない事実を作らない。情報が足りない箇所は本文中に「【要確認】〇〇（前任者に確認）」と明記する。
- 手順は番号付きで、1ステップ1動作。数値・型番・場所・ファイル名などの具体はメモから漏らさず拾う。
- 写真が添付されている場合は内容を読み取り、該当する手順の中で「（写真1参照：〜が写っている）」のように参照する。
- 「ハマりどころ」「注意」は箇条書きで、なぜ危ないのか／どうなるのかまで書く。
- 失敗談が入力されている場合は、その失敗が起きた理由を該当する手順のすぐそばに書く。
  手順だけを写して理由を落とさない——後輩が困るのは「何をするか」ではなく「なぜそうするか」が分からないとき。
- 見出しは ## から使う。冒頭にタイトルの # を1行だけ置く。`;

const DOC_SECTIONS = `# （資料タイトル）

## この資料について
- 目的 / 想定読者 / 所要時間の目安

## 事前に用意するもの
- 必要な物品・薬品・アカウント・権限・場所

## 手順
1. …

## なぜこうするのか（背景）
- 手順の中で理由が要るところを「〇〇するのは、〜だから（やらないと〜になる）」の形で書く

## 注意点・ハマりどころ
- …

## 過去の失敗談
- 何が起きたか → なぜ起きたか → どうすれば防げるか

## よくあるトラブルと対処
- 症状 → 原因 → 対処

## 関連情報・保管場所
- 元データやマニュアルの場所、関連資料、問い合わせ先

## 引継ぎ元メモ（原文）
> 入力されたメモをそのまま引用して残す`;

/**
 * AIに渡す（＝APIキーが無い場合はユーザーがそのままコピペできる）資料作成プロンプトを組み立てる。
 */
export function buildDocumentPrompt({ title, memo, author, tags = [], photoNames = [], category, failure = '' }) {
  const lines = [];
  lines.push('次の引継ぎメモから、後輩がひとりで再現できる引継ぎ資料をMarkdownで作成してください。');
  lines.push('');
  lines.push('## 入力');
  lines.push(`- 資料タイトル（案）: ${title || '（未入力：メモから適切に付けてください）'}`);
  if (author) lines.push(`- 前任者: ${author}`);
  if (category) lines.push(`- 分野の指定: ${category}`);
  if (tags.length) lines.push(`- キーワード: ${tags.join(', ')}`);
  if (photoNames.length) {
    lines.push(`- 添付写真: ${photoNames.map((n, i) => `写真${i + 1}（${n}）`).join(' / ')}`);
  }
  lines.push('');
  lines.push('### 引継ぎメモ（原文）');
  lines.push('```');
  lines.push((memo || '').trim() || '（メモ本文なし）');
  lines.push('```');
  lines.push('');
  if ((failure || '').trim()) {
    lines.push('### 失敗談（ここで実際に起きたこと）');
    lines.push('```');
    lines.push(failure.trim());
    lines.push('```');
    lines.push('');
  }
  lines.push('## 出力フォーマット');
  lines.push('以下の構成のMarkdownだけを出力してください（該当する内容が無い節は省いて構いません）。');
  lines.push('');
  lines.push('```markdown');
  lines.push(DOC_SECTIONS);
  lines.push('```');
  lines.push('');
  lines.push('## ルール');
  lines.push('- メモに無い事実を創作しない。不明点は「【要確認】…」と本文に残す。');
  lines.push('- 手順は番号付き・1ステップ1動作。型番や数値などの具体はすべて拾う。');
  lines.push('- 写真がある場合は該当手順で「（写真1参照）」のように参照する。');
  lines.push('- 手順には「なぜそうするか」を添える。理由がメモから読み取れないものは無理に補わず、');
  lines.push('  「【要確認】なぜこうするのか（前任者に確認）」と残す。理由の空欄が見えていること自体が引継ぎの手がかりになる。');
  if ((failure || '').trim()) {
    lines.push('- 失敗談は「過去の失敗談」の節に「何が起きたか → なぜ起きたか → どうすれば防げるか」で整理し、');
    lines.push('  対応する手順の側にも一言（例:「※ ここで〇〇を忘れると△△になる」）を入れる。');
  }
  lines.push('- 出力はMarkdown本文のみ。挨拶や説明文は付けない。');
  return lines.join('\n');
}

export const CLASSIFY_SYSTEM_PROMPT = `あなたは研究室の資料アーカイブの司書です。資料を決められたカテゴリに1つだけ振り分け、検索用のタグと1〜2文の要約を付けます。
迷ったら「資料を探す後輩がどのカテゴリを最初に開くか」で選びます。判断材料が乏しい場合は confidence を低く付けてください。`;

export function buildClassifyPrompt({ title, body, extra = '', fileNames = [], tags = [] }) {
  const catalog = CATEGORIES.map((c) => `- ${c.id}: ${c.label} — ${c.description}`).join('\n');
  const excerpt = (body || '').slice(0, 6000);
  const note = (extra || '').slice(0, 1000);
  return `次の資料を分類してください。

## カテゴリ一覧
${catalog}

## 資料
- タイトル: ${title || '(なし)'}
${fileNames.length ? `- 添付ファイル: ${fileNames.join(', ')}\n` : ''}${tags.length ? `- 入力済みタグ: ${tags.join(', ')}\n` : ''}
### 本文
"""
${excerpt || '(本文なし)'}
"""
${note ? `\n### 投稿者のメモ\n"""\n${note}\n"""\n` : ''}

## 出力
- category: 上のidから1つ
- tags: 検索に使う日本語キーワード3〜6個（装置名・薬品名・ソフト名など固有名詞を優先）
- summary: 資料箱の一覧に表示する1〜2文の要約
- confidence: 0〜1の確信度`;
}

export const CLASSIFY_SCHEMA = {
  type: 'object',
  properties: {
    category: { type: 'string', enum: CATEGORIES.map((c) => c.id) },
    tags: { type: 'array', items: { type: 'string' }, maxItems: 6 },
    summary: { type: 'string' },
    confidence: { type: 'number' },
  },
  required: ['category', 'tags', 'summary', 'confidence'],
  additionalProperties: false,
};

/* ========== プロトコルのクイズ ========== */

export const QUIZ_SYSTEM_PROMPT = `あなたは研究室でプロトコル（実験手順書）の教育係をしている先輩です。
後輩が資料を読んだあとに解く「なぜそうするのか」を確かめる小テストを作ります。

このクイズの目的は、手順を暗記させることではありません。
手順書はいつでも読み返せますが、「なぜその手順なのか」は先輩が居なくなると失われます。
だから問うのは、手順を外したときに何が起きるか・どう判断すべきかです。

守ること:
- 出力は指定されたJSONのみ。前置き・後書き・コードフェンス外の文章は書かない。
- 資料と失敗談に書かれていないことを問題にしない。書かれていない範囲は問わない。
- 「〜はどれか」の丸暗記問題を作らない。数値そのものを答えさせる問題は、
  その数値を外すと何が起きるかを選択肢に含めた形にする。
- 誤答の選択肢は「後輩が実際にやってしまいそうな間違い」にする。
  明らかにふざけた選択肢・長さで正解が分かる選択肢を作らない（選択肢の長さと具体性は揃える）。
- 解説（why）には必ず理由を書く。「手順書にそう書いてあるから」は理由ではない。
- 失敗談が与えられている場合は、それを最優先の出題源にする。実際に起きた失敗は、
  資料のどの記述よりも「なぜ」が濃い。
- ただし「判断と理由: 記録なし」の失敗談から、理由を推測して問題を作ってはいけない。
  そこは当時その場に居た人しか知らなかったことが、既に失われた場所である。
  もっともらしい理由で埋めると、失われた事実が正解として固定されてしまう。
  出題に使うのは、判断と理由が実際に書かれている失敗談と、資料本文に根拠がある記述だけにする。`;

const QUIZ_SECTION_HINT = `- why: なぜその手順なのか、理由・原理を問う（最優先）
- judge: 現場で条件が変わったときにどう判断するかを問う
- trouble: 想定どおりに行かなかったときの対処を問う
- step: 手順そのものだが、外すと結果が変わる勘どころを問う`;

/**
 * 資料（＋失敗談）からクイズを作らせるプロンプト。
 * AI生成でも「プロンプトを出力して手持ちのAIに貼る」経路でも、同じ文面を使う。
 */
export function buildQuizPrompt({ title, body, failures = [], count = QUIZ_DEFAULT_COUNT, focus = '' }) {
  const failureText = failuresToText(failures);
  const kinds = QUIZ_KINDS.map((k) => k.id).join(' / ');
  const lines = [];

  lines.push(`次のプロトコル資料から、後輩の理解を確かめる4択クイズを${count}問作ってください。`);
  lines.push('');
  lines.push('## 資料');
  lines.push(`- タイトル: ${title || '(なし)'}`);
  lines.push('');
  lines.push('### 本文');
  lines.push('"""');
  lines.push((body || '').slice(0, 20000) || '(本文なし)');
  lines.push('"""');
  lines.push('');

  if (failureText) {
    const reasoned = failures.filter((f) => String((f && f.why) || '').trim());
    lines.push('### この作業で実際にあった失敗談');
    lines.push('各項目は「目的 / 起きたこと / 判断と理由 / 次の手」です。');
    lines.push('「記録なし」は書き忘れではなく、その場に居なかった人にはもう復元できない情報を指します。');
    lines.push('"""');
    lines.push(failureText);
    lines.push('"""');
    lines.push('');
    if (reasoned.length) {
      lines.push(
        `判断と理由が残っている失敗談が${reasoned.length}件あります。` +
          `少なくとも${Math.min(reasoned.length, count)}問はそこから作り、`,
      );
      lines.push('その問題の failure に、どの失敗談を元にしたかを1文で書いてください。');
    }
    if (reasoned.length < failures.length) {
      lines.push(
        `判断と理由が「記録なし」の失敗談が${failures.length - reasoned.length}件あります。` +
          'これらの理由を推測して出題しないでください。',
      );
      lines.push('起きたことの記述を、資料本文に根拠がある問題の材料として使うのは構いません。');
    }
    lines.push('');
  }

  if (focus) {
    lines.push(`### 特に確かめたいこと\n${focus}\n`);
  }

  lines.push('## 出題の観点（kind）');
  lines.push(QUIZ_SECTION_HINT);
  lines.push('');
  lines.push(`観点は ${kinds} から選びます。why を半分以上にしてください。`);
  lines.push('');
  lines.push('## 各問題に必要なもの');
  lines.push('- question: 問題文。資料を読んだ後輩が考えれば答えられる粒度にする');
  lines.push('- choices: 選択肢4つ（順不同・長さと具体性を揃える）');
  lines.push('- answer: 正解の選択肢の番号（0から数える）');
  lines.push('- why: なぜそれが正解なのか。原理・理由を1〜3文で');
  lines.push('- consequence: そうしなかった場合に何が起きるか（実害の形で1文）');
  lines.push('- failure: 元にした失敗談があればその要約。無ければ空文字');
  lines.push('- source: 資料のどこが根拠か（例「手順3」「注意点の2つ目」）');
  lines.push('- kind: 上の観点のid');
  lines.push('');
  lines.push('## 出力');
  lines.push('次の形のJSONだけを出力してください。');
  lines.push('```json');
  lines.push(
    JSON.stringify(
      {
        intro: 'このクイズで確かめること（1文）',
        questions: [
          {
            question: '（問題文）',
            choices: ['（選択肢1）', '（選択肢2）', '（選択肢3）', '（選択肢4）'],
            answer: 0,
            why: '（なぜそれが正解か）',
            consequence: '（そうしないと何が起きるか）',
            failure: '（元にした失敗談。無ければ空文字）',
            source: '（資料中の根拠）',
            kind: 'why',
          },
        ],
      },
      null,
      2,
    ),
  );
  lines.push('```');
  return lines.join('\n');
}

export const QUIZ_SCHEMA = {
  type: 'object',
  properties: {
    intro: { type: 'string' },
    questions: {
      type: 'array',
      minItems: 1,
      maxItems: 10,
      items: {
        type: 'object',
        properties: {
          question: { type: 'string' },
          choices: { type: 'array', items: { type: 'string' }, minItems: 2, maxItems: 5 },
          answer: { type: 'integer' },
          why: { type: 'string' },
          consequence: { type: 'string' },
          failure: { type: 'string' },
          source: { type: 'string' },
          kind: { type: 'string', enum: QUIZ_KINDS.map((k) => k.id) },
        },
        required: ['question', 'choices', 'answer', 'why', 'consequence', 'failure', 'source', 'kind'],
        additionalProperties: false,
      },
    },
  },
  required: ['intro', 'questions'],
  additionalProperties: false,
};
