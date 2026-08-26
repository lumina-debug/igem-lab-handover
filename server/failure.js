/*
 * 失敗談の構造化フォームと、その資料化。
 *
 * ここは Node（server/）と Google Apps Script（gas/）で共有する純粋ロジック。
 * import / 外部呼び出しを持ち込まないこと（npm run build:gas がそのまま連結する）。
 *
 * 設計の要点（将来「Slack・Boxを横断して意思決定を復元する」ための土台）:
 *  - 入力欄は「問い→候補→試行→失敗→失敗理由→判断→結果」の鎖そのものにする。
 *    あとから記録を突き合わせるとき、この単位が揃っていないと結合できない。
 *  - 書かれなかった項目は捨てず、資料に「不明（未記録）」と明示して残す。
 *  - 人が書いた事実と、AIが足した推測を、保存の時点から別の場所に持つ。
 *  - 出典（Slack・Box・録音）はURLごと保持し、資料から必ず原文へ戻れるようにする。
 */

/** 失敗談の本体。順序がそのまま資料の節の順序になる。 */
export const FAILURE_FIELDS = [
  {
    id: 'question',
    label: '問い（何を決めようとしていた？）',
    hint: '例: 発光が弱い原因をどこから潰すか',
    rows: 2,
  },
  {
    id: 'options',
    label: '検討した候補',
    hint: '例: ①プラスミド量を変える ②培養温度を下げる ③測定器の設定を疑う',
    rows: 3,
  },
  {
    id: 'attempt',
    label: '実際に試したこと',
    hint: '条件・数値・使った装置まで具体的に',
    rows: 3,
  },
  {
    id: 'failure',
    label: '起きた失敗・症状',
    hint: '何がどうなったか。エラー文や見た目をそのまま',
    rows: 3,
    required: true,
  },
  {
    id: 'cause',
    label: '失敗の理由',
    hint: '分かっていないなら空欄のままで構いません（「不明」として残ります）',
    rows: 3,
  },
  {
    id: 'decision',
    label: 'そのあとの判断',
    hint: '例: 温度条件は諦めて、測定器の校正から確認することにした',
    rows: 2,
  },
  { id: 'outcome', label: '結果', hint: '解決した / していない / 別の問題が出た など', rows: 2 },
  { id: 'nextTip', label: '次にやる人へ', hint: '同じ轍を踏まないための一言', rows: 2 },
];

/** 「失敗の理由」がどこまで確かなのか。事実と推測を最初から分けて持つ。 */
export const CAUSE_CONFIDENCE = [
  { id: 'observed', label: '実際に確認した', note: '再現実験やログで裏が取れている' },
  { id: 'inferred', label: '推測', note: 'たぶんこれ、という段階' },
  { id: 'unknown', label: '分からない', note: '原因は未特定' },
];

/** 誰向けの記録か。将来、学年とWet/Dryで学習順序を変えるための軸。 */
export const TRACKS = [
  { id: 'both', label: 'Wet / Dry 共通' },
  { id: 'wet', label: 'Wet（実験）' },
  { id: 'dry', label: 'Dry（計算・解析）' },
];

export const LEVELS = [
  { id: 'all', label: '学年を問わない' },
  { id: 'b3', label: 'B3・入りたて向け' },
  { id: 'b4', label: 'B4向け' },
  { id: 'm1', label: 'M1以上向け' },
];

/** 出典の種類。原文へ戻れることがこの仕組みの生命線。 */
export const SOURCE_KINDS = [
  { id: 'slack', label: 'Slack投稿', emoji: '💬' },
  { id: 'box', label: 'Boxのファイル', emoji: '📦' },
  { id: 'drive', label: 'Driveのファイル', emoji: '🗂' },
  { id: 'audio', label: '録音・議事録', emoji: '🎙' },
  { id: 'notebook', label: '実験ノート', emoji: '📓' },
  { id: 'other', label: 'その他', emoji: '🔗' },
];

/** 承認されるまで教材として公開しない。 */
export const STATUSES = [
  { id: 'draft', label: '未承認（下書き）', emoji: '📝' },
  { id: 'approved', label: '承認済み', emoji: '✅' },
];

export const UNKNOWN_TEXT = '不明（未記録）';

export function labelOf(list, id, fallback) {
  for (let i = 0; i < list.length; i += 1) {
    if (list[i].id === id) return list[i].label;
  }
  return fallback || id || '';
}

export function textOf(value) {
  return String(value === undefined || value === null ? '' : value).trim();
}

/** 入力を保存する形に整える。未入力は空文字のまま持ち、資料化のときに「不明」と書く。 */
export function normalizeFailure(input) {
  const raw = (input && input.fields) || {};
  const fields = {};
  FAILURE_FIELDS.forEach((field) => {
    fields[field.id] = textOf(raw[field.id]);
  });

  const confidence = textOf(raw.causeConfidence) || (fields.cause ? 'inferred' : 'unknown');
  fields.causeConfidence = labelOf(CAUSE_CONFIDENCE, confidence) === confidence && !fields.cause ? 'unknown' : confidence;

  const sources = [];
  ((input && input.sources) || []).forEach((source) => {
    const url = textOf(source && source.url);
    const note = textOf(source && source.note);
    if (!url && !note) return;
    sources.push({ kind: textOf(source.kind) || 'other', url: url, note: note });
  });

  return {
    fields: fields,
    sources: sources,
    track: textOf(input && input.track) || 'both',
    level: textOf(input && input.level) || 'all',
    occurredOn: textOf(input && input.occurredOn),
  };
}

/** タイトル未入力なら失敗の症状から起こす。 */
export function failureTitle(title, fields) {
  const given = textOf(title);
  if (given) return given;
  const symptom = textOf(fields && fields.failure);
  if (!symptom) return '失敗の記録';
  const firstLine = symptom.split('\n')[0].trim();
  return firstLine.length > 40 ? `${firstLine.slice(0, 40)}…` : firstLine;
}

export function sourceLine(source) {
  const label = labelOf(SOURCE_KINDS, source.kind, 'リンク');
  const note = source.note ? ` — ${source.note}` : '';
  return source.url ? `- ${label}: ${source.url}${note}` : `- ${label}: （URLなし）${note}`;
}

/**
 * 失敗談をMarkdownの資料にする。AIは使わない（＝ここに書かれているのは入力された事実だけ）。
 * AIによる補足は本文には混ぜず、資料の末尾に区別して足す。
 */
export function buildFailureMarkdown(entry) {
  const fields = (entry && entry.fields) || {};
  const lines = [];
  lines.push(`# ${failureTitle(entry && entry.title, fields)}`);
  lines.push('');
  lines.push('> この資料は失敗談フォームの入力から自動生成しています。以下はすべて記入者が書いた内容で、AIの推測は含まれません。');
  lines.push('');

  const meta = [];
  if (entry && entry.author) meta.push(`記入者: ${entry.author}`);
  if (entry && entry.occurredOn) meta.push(`いつ: ${entry.occurredOn}`);
  meta.push(`対象: ${labelOf(TRACKS, (entry && entry.track) || 'both')}`);
  meta.push(`想定読者: ${labelOf(LEVELS, (entry && entry.level) || 'all')}`);
  lines.push(meta.join(' ／ '));
  lines.push('');

  FAILURE_FIELDS.forEach((field) => {
    lines.push(`## ${field.label}`);
    const value = textOf(fields[field.id]);
    if (field.id === 'cause') {
      const confidence = labelOf(CAUSE_CONFIDENCE, fields.causeConfidence, '不明');
      lines.push(`**確からしさ: ${confidence}**`);
      lines.push('');
    }
    lines.push(value || UNKNOWN_TEXT);
    lines.push('');
  });

  lines.push('## 出典（原文）');
  const sources = (entry && entry.sources) || [];
  if (sources.length) {
    sources.forEach((source) => lines.push(sourceLine(source)));
  } else {
    lines.push(UNKNOWN_TEXT);
  }
  lines.push('');

  const notes = (entry && entry.aiNotes) || [];
  if (notes.length) {
    lines.push('---');
    lines.push('');
    lines.push('## 🤖 AIによる補足（推測を含む／原文ではありません）');
    notes.forEach((note) => {
      lines.push(`- ${textOf(note)}`);
    });
    lines.push('');
  }

  return lines.join('\n').trim();
}

/** 分類・検索に使うテキスト。フォームの全項目を1本にまとめる。 */
export function failureSearchText(entry) {
  const fields = (entry && entry.fields) || {};
  const parts = FAILURE_FIELDS.map((field) => textOf(fields[field.id]));
  ((entry && entry.sources) || []).forEach((source) => parts.push(source.note));
  return parts.filter(Boolean).join('\n');
}
