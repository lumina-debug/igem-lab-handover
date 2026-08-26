/*
 * 依存なしの純粋ロジック。ここは Node（server/）と Google Apps Script（gas/）で共有するため、
 * import / 外部呼び出しを持ち込まないこと（npm run build:gas がそのまま連結する）。
 *
 * 失敗談とクイズの正規化。AIが作ったものも人が貼り付けたものも、必ずここを通してから保存する。
 */

export const QUIZ_DEFAULT_COUNT = 5;
export const QUIZ_MIN_COUNT = 3;
export const QUIZ_MAX_COUNT = 10;
export const MAX_FAILURES = 30;

const MIN_CHOICES = 2;
const MAX_CHOICES = 5;

/*
 * 出題の観点。「手順を暗記できたか」ではなく「なぜそうするのかを分かっているか」を中心に置く。
 * 技術が伝わらないのは手順が失われるからではなく、手順の理由が失われるため。
 */
export const QUIZ_KINDS = [
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
export function firstLineOf(source, limit) {
  const max = limit || 40;
  const line = trimmed(String(source || '').split('\n')[0]);
  return line.length > max ? `${line.slice(0, max)}…` : line;
}

export function clampQuestionCount(value) {
  const n = Math.round(Number(value));
  if (!Number.isFinite(n)) return QUIZ_DEFAULT_COUNT;
  return Math.min(QUIZ_MAX_COUNT, Math.max(QUIZ_MIN_COUNT, n));
}

/**
 * 失敗談1件を保存できる形に整える。
 * 必須は what（何が起きたか）だけ。why が空でも受け取る——書ける人がその場で書ける量だけ残せるように。
 */
export function normalizeFailure(raw, id, now) {
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
export function failuresToText(failures) {
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
export function normalizeQuestion(raw, id) {
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
export function normalizeQuiz(raw, options) {
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
export function parseQuizJson(input) {
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
export function quizSummaryOf(quiz) {
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
export function parseFailureRows(input) {
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
