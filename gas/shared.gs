/*
 * 自動生成ファイル — 直接編集しないでください。
 * 元ファイル: server/categories.js, server/classify.js, server/quiz.js, server/prompts.js
 * 更新方法: npm run build:gas を実行し、このファイルを Apps Script に貼り直す。
 */

// ===== server/categories.js =====
// 資料の分類カテゴリ定義。
// keywords はAPIキーが無い環境で動くルールベース分類器が使う手がかり。
const CATEGORIES = [
  {
    id: 'equipment',
    label: '装置・機器の使い方',
    emoji: '🔬',
    color: '#3b82f6',
    description: '実験装置・測定機器・PC周辺機器の起動手順や操作方法、予約ルールなど',
    keywords: ['装置', '機器', '測定', '顕微鏡', 'サーマルサイクラー', 'PCR装置', 'クリーンベンチ', '安全キャビネット', 'オートクレーブ', '遠心', '遠心機', 'ボルテックス', 'インキュベーター', '振とう', 'シェーカー', 'ナノドロップ', 'NanoDrop', '分光光度計', '電気泳動槽', 'トランスイルミネーター', 'ゲル撮影', 'ピペット', 'マイクロピペット', '製氷機', 'ディープフリーザー', 'HPLC', 'レーザー', '真空', 'ポンプ', '電源', '起動', '立ち上げ', '立上げ', 'シャットダウン', '予約', 'メンテナンス', '校正', 'キャリブレーション', '恒温槽', 'オーブン', '天秤'],
  },
  {
    id: 'protocol',
    label: '実験手順・プロトコル',
    emoji: '🧪',
    color: '#10b981',
    description: '試料作製・測定条件・実験レシピなど、再現するための手順書',
    keywords: ['手順', 'プロトコル', '実験', 'PCR', 'コロニーPCR', 'プライマー', 'アニーリング', 'プラスミド', '制限酵素', 'ライゲーション', 'Gibson', 'ギブソン', 'ゴールデンゲート', '形質転換', 'トランスフォーメーション', 'コンピテントセル', 'ヒートショック', 'ミニプレップ', '精製', '抽出', '電気泳動', 'アガロース', 'ゲル', '培地', 'LB', 'SOC', 'プレート', '播種', '植菌', '前培養', '本培養', 'グリセロールストック', 'シークエンス', '大腸菌', 'コロニー', '試料', 'サンプル', '作製', '合成', '培養', '前処理', '条件', 'レシピ', '濃度', '試薬', '溶液', '洗浄', '検量線', '再現'],
  },
  {
    id: 'safety',
    label: '安全・注意事項',
    emoji: '⚠️',
    color: '#ef4444',
    description: '薬品管理、危険物、事故対応、法令・講習など安全にかかわること',
    keywords: ['安全', '危険', '事故', '遺伝子組換え', 'カルタヘナ', '拡散防止', 'P1レベル', 'バイオハザード', '滅菌', '不活化', 'EtBr', 'エチジウムブロマイド', '変異原', 'UV', '紫外線', '抗生物質', '劇物', '毒物', '薬品', '廃液', '廃棄', '保護', 'ゴーグル', '手袋', '白衣', '換気', 'ドラフト', '高圧', 'ガス', 'ボンベ', '感電', '火傷', '火災', '地震', '緊急', '講習', '法令', 'MSDS', 'SDS', '注意'],
  },
  {
    id: 'analysis',
    label: 'データ解析・ソフトウェア',
    emoji: '💻',
    color: '#8b5cf6',
    description: '解析コード、ソフトの使い方、データの保存場所や命名規則',
    keywords: ['解析', 'データ', 'ソフト', 'プログラム', 'コード', 'スクリプト', 'SnapGene', 'Benchling', 'ベンチリング', 'Geneious', '配列', 'アライメント', 'プラスミドマップ', 'BLAST', 'NCBI', 'Addgene', 'Python', 'MATLAB', 'Origin', 'Excel', 'ImageJ', 'R言語', 'Git', 'サーバ', 'サーバー', '計算', 'シミュレーション', 'モデリング', 'フィッティング', 'グラフ', '可視化', 'ライセンス', 'インストール', '命名規則', 'バックアップ'],
  },
  {
    id: 'admin',
    label: '事務・手続き',
    emoji: '📋',
    color: '#f59e0b',
    description: '発注、旅費、学会申込、経費精算、書類の出し方',
    keywords: ['事務', '手続', '申請', 'iGEM', 'Jamboree', 'レジストリ', 'パーツ登録', 'チーム登録', '参加費', 'DNA合成', '遺伝子合成', 'IDT', 'ビザ', '渡航', 'スポンサー', 'クラウドファンディング', '発注', '購入', '見積', '納品', '請求', '経費', '精算', '旅費', '出張', '学会', '投稿', '締切', '書類', '提出', '予算', '報告書', '許可', 'ハンコ', '押印'],
  },
  {
    id: 'lablife',
    label: '研究室の運営・生活',
    emoji: '🏠',
    color: '#14b8a6',
    description: 'ゼミ運営、当番、鍵、掃除、備品の場所、連絡手段など日々のルール',
    keywords: ['ゼミ', 'ミーティング', '当番', '掃除', '清掃', '鍵', '入室', 'カード', '備品', '文房具', '発注リスト', '連絡', 'Slack', 'メール', '歓迎会', '新歓', '席', '部屋', '冷蔵庫', 'ゴミ', '共用', 'ルール', '慣習', '年間', 'スケジュール'],
  },
  {
    id: 'troubleshoot',
    label: 'トラブル対応',
    emoji: '🛠️',
    color: '#f43f5e',
    description: '「動かない時」「エラーが出た時」の対処法、過去にハマった事例',
    keywords: ['トラブル', 'エラー', '不具合', '故障', '動かない', '直し', '修理', '再起動', '対処', '原因', 'ハマ', '失敗', 'うまくいかない', 'コンタミ', '汚染', '生えない', '増えない', 'バンドが出ない', '非特異', '収量', '効率が悪い', 'スメア', '止まる', '落ちる', '異音', '漏れ', '業者', '問い合わせ'],
  },
  {
    id: 'other',
    label: 'その他',
    emoji: '📦',
    color: '#64748b',
    description: '上のどれにも当てはまらない資料',
    keywords: [],
  },
];

const CATEGORY_IDS = CATEGORIES.map((c) => c.id);
const DEFAULT_CATEGORY = 'other';

function getCategory(id) {
  return CATEGORIES.find((c) => c.id === id) || CATEGORIES.find((c) => c.id === DEFAULT_CATEGORY);
}

function isValidCategory(id) {
  return CATEGORY_IDS.includes(id);
}

// ===== server/classify.js =====
/*
 * 依存なしの純粋ロジック。ここは Node（server/）と Google Apps Script（gas/）で共有するため、
 * import / 外部呼び出しを持ち込まないこと（npm run build:gas がそのまま連結する）。
 */

function normalize(text) {
  return String(text || '').toLowerCase();
}

/** Markdown記号を落として一覧表示用の短い要約を作る。 */
function excerptOf(body, limit = 120) {
  const plain = String(body || '')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/^#{1,6}\s*/gm, '')
    .replace(/^[>\-*+]\s+/gm, '')
    .replace(/[*_`>|]/g, '')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
  return plain.length > limit ? `${plain.slice(0, limit)}…` : plain;
}

/**
 * APIキー無しでも動く、キーワードベースの分類器。
 * タイトル・タグ・ファイル名は本文より重く数える（そこに書かれた語のほうが資料の主題に近いため）。
 */
function classifyByRules({ title, body, extra = '', fileNames = [], tags = [] }) {
  const heavy = normalize([title, tags.join(' '), fileNames.join(' ')].join(' '));
  const light = normalize(`${body}\n${extra}`);
  const scores = [];
  const hitWords = new Map();

  for (const category of CATEGORIES) {
    let score = 0;
    for (const keyword of category.keywords) {
      const needle = normalize(keyword);
      const inHeavy = heavy.includes(needle);
      const bodyHits = light.split(needle).length - 1;
      if (!inHeavy && bodyHits === 0) continue;
      score += (inHeavy ? 3 : 0) + Math.min(bodyHits, 4);
      const current = hitWords.get(keyword) || 0;
      hitWords.set(keyword, current + (inHeavy ? 3 : 0) + Math.min(bodyHits, 4));
    }
    scores.push({ category: category.id, score });
  }

  scores.sort((a, b) => b.score - a.score);
  const best = scores[0];
  const runnerUp = scores[1];

  if (!best || best.score === 0) {
    return { category: DEFAULT_CATEGORY, tags: [], summary: excerptOf(body), confidence: 0.2 };
  }

  // 1位と2位の差が小さいほど確信度を下げる。
  const margin = best.score - (runnerUp?.score || 0);
  const confidence = Math.max(0.25, Math.min(0.85, 0.35 + best.score * 0.05 + margin * 0.04));

  const autoTags = [...hitWords.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([word]) => word);

  return { category: best.category, tags: autoTags, summary: excerptOf(body), confidence };
}

/** 本文の見出し（なければ先頭行）からタイトルを起こす。 */
function deriveTitle(body) {
  const heading = String(body || '').match(/^#\s+(.+)$/m);
  if (heading) return heading[1].trim();
  const firstLine = String(body || '')
    .split('\n')
    .find((line) => line.trim());
  return firstLine ? excerptOf(firstLine, 40) : '';
}

// ===== server/quiz.js =====
/*
 * 依存なしの純粋ロジック。ここは Node（server/）と Google Apps Script（gas/）で共有するため、
 * import / 外部呼び出しを持ち込まないこと（npm run build:gas がそのまま連結する）。
 *
 * 失敗談とクイズの正規化。AIが作ったものも人が貼り付けたものも、必ずここを通してから保存する。
 */

const QUIZ_DEFAULT_COUNT = 5;
const QUIZ_MIN_COUNT = 3;
const QUIZ_MAX_COUNT = 10;
const MAX_FAILURES = 30;

const MIN_CHOICES = 2;
const MAX_CHOICES = 5;

/*
 * 出題の観点。「手順を暗記できたか」ではなく「なぜそうするのかを分かっているか」を中心に置く。
 * 技術が伝わらないのは手順が失われるからではなく、手順の理由が失われるため。
 */
const QUIZ_KINDS = [
  { id: 'why', label: 'なぜそうするのか', emoji: '🤔' },
  { id: 'judge', label: '現場での判断', emoji: '⚖️' },
  { id: 'trouble', label: 'トラブル対応', emoji: '🛠️' },
  { id: 'step', label: '手順の勘どころ', emoji: '📋' },
];

const QUIZ_KIND_IDS = QUIZ_KINDS.map((k) => k.id);
const CHOICE_LETTERS = ['a', 'b', 'c', 'd', 'e'];
const CHOICE_KANA = ['ア', 'イ', 'ウ', 'エ', 'オ'];

function trimmed(value) {
  return String(value === null || value === undefined ? '' : value).trim();
}

/** 1行の短い見出しを作る（失敗談のタイトルが空のときの穴埋め）。 */
function firstLineOf(source, limit) {
  const max = limit || 40;
  const line = trimmed(String(source || '').split('\n')[0]);
  return line.length > max ? `${line.slice(0, max)}…` : line;
}

function clampQuestionCount(value) {
  const n = Math.round(Number(value));
  if (!Number.isFinite(n)) return QUIZ_DEFAULT_COUNT;
  return Math.min(QUIZ_MAX_COUNT, Math.max(QUIZ_MIN_COUNT, n));
}

/**
 * 失敗談1件を保存できる形に整える。
 * 必須は what（何が起きたか）だけ。why が空でも受け取る——書ける人がその場で書ける量だけ残せるように。
 */
function normalizeFailure(raw, id, now) {
  const input = raw || {};
  const what = trimmed(input.what);
  return {
    id: id,
    title: trimmed(input.title) || firstLineOf(what, 32) || '失敗談',
    what: what,
    why: trimmed(input.why),
    prevention: trimmed(input.prevention),
    author: trimmed(input.author),
    createdAt: trimmed(input.createdAt) || now || new Date().toISOString(),
  };
}

/** 失敗談をプロンプトに載せる形の文字列にする（AI生成とプロンプト出力の両方で使う）。 */
function failuresToText(failures) {
  const list = Array.isArray(failures) ? failures : [];
  if (!list.length) return '';
  return list
    .map((f, index) => {
      const lines = [`${index + 1}. ${f.title || firstLineOf(f.what, 32)}`];
      if (f.what) lines.push(`   - 何が起きたか: ${f.what}`);
      if (f.why) lines.push(`   - なぜ起きたか: ${f.why}`);
      if (f.prevention) lines.push(`   - どうすれば防げるか: ${f.prevention}`);
      if (f.author) lines.push(`   - 語った人: ${f.author}`);
      return lines.join('\n');
    })
    .join('\n');
}

/**
 * 選択肢のどれが正解かを決める。
 * 正解は0始まりの番号で受け取るのが基本だが、人が貼り付けたJSONでは
 * 「A」「ア」「選択肢の文字列そのもの」で書かれていることがあるため、そこまで拾う。
 */
function resolveAnswerIndex(answer, choices) {
  if (typeof answer === 'number' && Number.isInteger(answer)) {
    return answer >= 0 && answer < choices.length ? answer : -1;
  }
  const value = trimmed(answer);
  if (!value) return -1;

  const exact = choices.findIndex((c) => c === value);
  if (exact !== -1) return exact;

  if (/^[0-9]+$/.test(value)) {
    const n = Number(value);
    if (n >= 0 && n < choices.length) return n;
    // 1始まりで書かれていた場合の救済。
    if (n >= 1 && n <= choices.length) return n - 1;
    return -1;
  }

  const letter = CHOICE_LETTERS.indexOf(value.toLowerCase());
  if (letter !== -1 && letter < choices.length) return letter;
  const kana = CHOICE_KANA.indexOf(value);
  if (kana !== -1 && kana < choices.length) return kana;
  return -1;
}

/** 1問を整える。問題文・選択肢・正解のどれかが欠けていたら null（呼び出し側が捨てる）。 */
function normalizeQuestion(raw, id) {
  const input = raw || {};
  const question = trimmed(input.question || input.prompt);
  const choices = (Array.isArray(input.choices) ? input.choices : [])
    .map(trimmed)
    .filter(Boolean)
    .slice(0, MAX_CHOICES);
  if (!question || choices.length < MIN_CHOICES) return null;

  const answer = resolveAnswerIndex(input.answer, choices);
  if (answer === -1) return null;

  const kind = trimmed(input.kind);
  return {
    id: id,
    question: question,
    choices: choices,
    answer: answer,
    kind: QUIZ_KIND_IDS.indexOf(kind) !== -1 ? kind : 'why',
    // なぜそれが正解なのか。ここが空の問題は「暗記クイズ」になってしまうので、
    // プロンプト側で必ず書かせる。
    why: trimmed(input.why || input.explanation),
    consequence: trimmed(input.consequence),
    failure: trimmed(input.failure),
    source: trimmed(input.source),
  };
}

/**
 * クイズ全体を整える。読み取れた問題が0問なら例外（呼び出し側でエラーメッセージにする）。
 */
function normalizeQuiz(raw, options) {
  const opts = options || {};
  const source = Array.isArray(raw) ? { questions: raw } : raw || {};
  const list = Array.isArray(source.questions) ? source.questions : [];

  const questions = [];
  for (let i = 0; i < list.length && questions.length < QUIZ_MAX_COUNT; i += 1) {
    const question = normalizeQuestion(list[i], `q${questions.length + 1}`);
    if (question) questions.push(question);
  }
  if (!questions.length) {
    throw new Error(
      '問題を1問も読み取れませんでした。question / choices / answer を持つJSONになっているか確認してください。',
    );
  }

  return {
    questions: questions,
    intro: trimmed(source.intro),
    generatedBy: opts.generatedBy || 'manual',
    model: trimmed(opts.model),
    createdAt: opts.createdAt || new Date().toISOString(),
  };
}

/**
 * AIやユーザーが返してきたテキストからクイズJSONを取り出す。
 * コードフェンスや前置きの文が付いていても拾えるようにする。
 */
function parseQuizJson(input) {
  const text = trimmed(input);
  if (!text) throw new Error('クイズのJSONを貼り付けてください');

  const fenced = text.match(/```(?:json)?\s*\n([\s\S]*?)\n```/);
  const candidate = fenced ? fenced[1] : text;
  const trimmedCandidate = trimmed(candidate);

  const attempts = [trimmedCandidate];
  const objectStart = trimmedCandidate.indexOf('{');
  const objectEnd = trimmedCandidate.lastIndexOf('}');
  if (objectStart !== -1 && objectEnd > objectStart) {
    attempts.push(trimmedCandidate.slice(objectStart, objectEnd + 1));
  }
  const arrayStart = trimmedCandidate.indexOf('[');
  const arrayEnd = trimmedCandidate.lastIndexOf(']');
  if (arrayStart !== -1 && arrayEnd > arrayStart) {
    attempts.push(trimmedCandidate.slice(arrayStart, arrayEnd + 1));
  }

  for (const attempt of attempts) {
    try {
      return JSON.parse(attempt);
    } catch (err) {
      // 次の候補を試す
    }
  }
  throw new Error('JSONとして読み取れませんでした。AIの返答からJSONの部分だけを貼り付けてください。');
}

/** 一覧に出すための軽い集計（本文やクイズ本体を送らずに済むようにする）。 */
function quizSummaryOf(quiz) {
  if (!quiz || !Array.isArray(quiz.questions) || !quiz.questions.length) return null;
  return {
    count: quiz.questions.length,
    generatedBy: quiz.generatedBy || 'manual',
    createdAt: quiz.createdAt || '',
  };
}

/* ========== スプレッドシートからの取り込み ==========
 * 失敗談はフォームで集めるのが本命だが、集まる先はスプレッドシートなので、
 * 「表をコピーして貼り付ける」経路も同じ形に落とせるようにしておく。
 */

/** 1行分をタブ / カンマで割る（引用符付きCSVにも耐える）。 */
function splitRow(line) {
  if (line.indexOf('\t') !== -1) return line.split('\t');
  const cells = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (quoted) {
      if (ch === '"' && line[i + 1] === '"') {
        cell += '"';
        i += 1;
      } else if (ch === '"') {
        quoted = false;
      } else {
        cell += ch;
      }
    } else if (ch === '"') {
      quoted = true;
    } else if (ch === ',') {
      cells.push(cell);
      cell = '';
    } else {
      cell += ch;
    }
  }
  cells.push(cell);
  return cells;
}

const FAILURE_HEADER_HINTS = [
  { key: 'what', words: ['何が', 'なにが', '起き', '失敗', 'できごと', '内容'] },
  { key: 'why', words: ['なぜ', '理由', '原因'] },
  { key: 'prevention', words: ['防', '対策', '次から', 'どうすれば'] },
  { key: 'author', words: ['名前', '氏名', '回答者', '記入者'] },
];

/** 見出し行があれば列の意味を拾う。無ければ what / why / prevention / author の順とみなす。 */
function mapHeader(cells) {
  const map = {};
  let matched = 0;
  cells.forEach((raw, index) => {
    const cell = String(raw || '');
    for (const hint of FAILURE_HEADER_HINTS) {
      if (map[hint.key] !== undefined) continue;
      if (hint.words.some((word) => cell.indexOf(word) !== -1)) {
        map[hint.key] = index;
        matched += 1;
        break;
      }
    }
  });
  return matched >= 1 ? map : null;
}

/**
 * スプレッドシートから貼り付けた表を失敗談の配列に変換する。
 * タイムスタンプ列が先頭にあるフォームの回答シートをそのまま貼れることを狙う。
 */
function parseFailureRows(input) {
  const lines = String(input || '')
    .split(/\r?\n/)
    .map((line) => line.replace(/\s+$/, ''))
    .filter((line) => line.trim());
  if (!lines.length) return [];

  const rows = lines.map(splitRow);
  const header = mapHeader(rows[0]);
  const columns = header || { what: 0, why: 1, prevention: 2, author: 3 };
  const body = header ? rows.slice(1) : rows;

  const at = (cells, index) => (index === undefined ? '' : trimmed(cells[index]));
  return body
    .map((cells) => ({
      what: at(cells, columns.what),
      why: at(cells, columns.why),
      prevention: at(cells, columns.prevention),
      author: at(cells, columns.author),
    }))
    .filter((row) => row.what);
}

// ===== server/prompts.js =====
const DOC_SYSTEM_PROMPT = `あなたは大学・企業の研究室で「引継ぎ資料」をまとめるベテランの技術ライターです。
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
function buildDocumentPrompt({ title, memo, author, tags = [], photoNames = [], category, failure = '' }) {
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

const CLASSIFY_SYSTEM_PROMPT = `あなたは研究室の資料アーカイブの司書です。資料を決められたカテゴリに1つだけ振り分け、検索用のタグと1〜2文の要約を付けます。
迷ったら「資料を探す後輩がどのカテゴリを最初に開くか」で選びます。判断材料が乏しい場合は confidence を低く付けてください。`;

function buildClassifyPrompt({ title, body, extra = '', fileNames = [], tags = [] }) {
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

const CLASSIFY_SCHEMA = {
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

const QUIZ_SYSTEM_PROMPT = `あなたは研究室でプロトコル（実験手順書）の教育係をしている先輩です。
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
  資料のどの記述よりも「なぜ」が濃い。`;

const QUIZ_SECTION_HINT = `- why: なぜその手順なのか、理由・原理を問う（最優先）
- judge: 現場で条件が変わったときにどう判断するかを問う
- trouble: 想定どおりに行かなかったときの対処を問う
- step: 手順そのものだが、外すと結果が変わる勘どころを問う`;

/**
 * 資料（＋失敗談）からクイズを作らせるプロンプト。
 * AI生成でも「プロンプトを出力して手持ちのAIに貼る」経路でも、同じ文面を使う。
 */
function buildQuizPrompt({ title, body, failures = [], count = QUIZ_DEFAULT_COUNT, focus = '' }) {
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
    lines.push('### この作業で実際にあった失敗談');
    lines.push('"""');
    lines.push(failureText);
    lines.push('"""');
    lines.push('');
    lines.push(`失敗談が${failures.length}件あります。少なくとも${Math.min(failures.length, count)}問は失敗談を題材にし、`);
    lines.push('その問題の failure に、どの失敗談を元にしたかを1文で書いてください。');
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

const QUIZ_SCHEMA = {
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
