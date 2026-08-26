/* 引継ぎ資料箱 フロントエンド（依存なし） */
const state = {
  config: { aiEnabled: false, categories: [], maxFiles: 12, maxFileSize: 0 },
  filters: { q: '', category: '', tag: '', sort: 'new' },
  counts: {},
  total: 0,
  documents: [],
  current: null,
  editing: false,
  player: null,
};

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => [...document.querySelectorAll(sel)];
const esc = (s) => window.markdown.escapeHtml(s ?? '');

const CLASSIFIER_LABEL = { ai: 'AIが分類', rule: 'キーワードで分類', manual: '人が指定' };
const SOURCE_LABEL = { ai: 'AI生成', manual: '手入力', upload: 'アップロード' };

/* ---------- 共通UI ---------- */
let toastTimer = null;
function toast(message, kind = 'info') {
  const el = $('#toast');
  el.textContent = message;
  el.className = `toast toast-${kind}`;
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    el.hidden = true;
  }, 4200);
}

function loading(on, text = '処理中…') {
  $('#loading-text').textContent = text;
  $('#loading').hidden = !on;
}

const API = window.hikitsugiApi;

function categoryOf(id) {
  return state.config.categories.find((c) => c.id === id) || { label: '未分類', emoji: '📦', color: '#64748b' };
}

function formatDate(iso) {
  const d = new Date(iso);
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`;
}

function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/* ---------- ファイル選択（ドラッグ＆ドロップ + プレビュー） ---------- */
function createFilePicker(dropId, inputId, previewId, driveScopeId) {
  const drop = $(`#${dropId}`);
  const input = $(`#${inputId}`);
  const preview = $(`#${previewId}`);
  const picked = [];

  function render() {
    preview.innerHTML = picked
      .map((file, index) => {
        const thumb = file.type.startsWith('image/')
          ? `<img src="${URL.createObjectURL(file)}" alt="" />`
          : `<span class="file-icon">📄</span>`;
        return `<div class="preview">
          ${thumb}
          <div class="preview-meta"><strong>${esc(file.name)}</strong><span>${formatSize(file.size)}</span></div>
          <button type="button" class="preview-remove" data-index="${index}" aria-label="削除">✕</button>
        </div>`;
      })
      .join('');
  }

  function add(files) {
    for (const file of files) {
      if (picked.length >= state.config.maxFiles) {
        toast(`添付は${state.config.maxFiles}件までです`, 'warn');
        break;
      }
      const limit = API.pickLimitFor(file, state.config.maxFileSize);
      if (limit && file.size > limit) {
        toast(
          `${file.name} は大きすぎます（${formatSize(limit)}まで）。` +
            (API.isDrive() ? 'Driveに置いてURLで添付してください。' : ''),
          'warn',
        );
        continue;
      }
      picked.push(file);
    }
    render();
  }

  input.addEventListener('change', () => {
    add(input.files);
    input.value = '';
  });
  preview.addEventListener('click', (event) => {
    const btn = event.target.closest('.preview-remove');
    if (!btn) return;
    picked.splice(Number(btn.dataset.index), 1);
    render();
  });
  ['dragenter', 'dragover'].forEach((type) =>
    drop.addEventListener(type, (e) => {
      e.preventDefault();
      drop.classList.add('is-over');
    }),
  );
  ['dragleave', 'drop'].forEach((type) =>
    drop.addEventListener(type, (e) => {
      e.preventDefault();
      drop.classList.remove('is-over');
    }),
  );
  drop.addEventListener('drop', (e) => add(e.dataTransfer.files));

  const driveAttacher = driveScopeId ? createDriveAttacher(driveScopeId) : null;

  return {
    files: () => picked,
    names: () => picked.map((f) => f.name),
    driveIds: () => (driveAttacher && API.isDrive() ? driveAttacher.ids() : []),
    clear: () => {
      picked.length = 0;
      render();
      driveAttacher?.clear();
    },
  };
}

/* ---------- Driveのファイルをアップロードせずに添付する ---------- */
function driveFileId(input) {
  const text = String(input || '').trim();
  const match = text.match(/\/d\/([-\w]{15,})/) || text.match(/[?&]id=([-\w]{15,})/);
  if (match) return match[1];
  return /^[-\w]{15,}$/.test(text) ? text : '';
}

function createDriveAttacher(scopeId) {
  const scope = $(`#${scopeId}-drive`);
  const list = scope.querySelector('.drive-list');
  const input = scope.querySelector('.drive-url');
  const picked = [];

  function render() {
    list.innerHTML = picked
      .map(
        (id, index) => `<div class="preview">
          <span class="file-icon">🔗</span>
          <div class="preview-meta"><strong>Driveのファイル</strong><span>${esc(id)}</span></div>
          <button type="button" class="preview-remove" data-index="${index}" aria-label="削除">✕</button>
        </div>`,
      )
      .join('');
  }

  function add() {
    const id = driveFileId(input.value);
    if (!id) return toast('DriveのファイルURLを貼ってください（共有リンクでも可）', 'warn');
    if (picked.includes(id)) return toast('すでに追加されています', 'warn');
    picked.push(id);
    input.value = '';
    render();
  }

  scope.querySelector('.drive-add').addEventListener('click', add);
  input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      add();
    }
  });
  list.addEventListener('click', (event) => {
    const btn = event.target.closest('.preview-remove');
    if (!btn) return;
    picked.splice(Number(btn.dataset.index), 1);
    render();
  });

  return {
    ids: () => picked,
    clear: () => {
      picked.length = 0;
      input.value = '';
      render();
    },
  };
}

/* ---------- 資料箱 ---------- */
function renderChips() {
  const chips = [
    `<button class="chip ${state.filters.category === '' ? 'is-active' : ''}" data-category="">すべて <b>${state.total}</b></button>`,
    ...state.config.categories.map((c) => {
      const count = state.counts[c.id] || 0;
      const active = state.filters.category === c.id ? 'is-active' : '';
      return `<button class="chip ${active}" data-category="${c.id}" style="--chip:${c.color}">
        ${c.emoji} ${esc(c.label)} <b>${count}</b>
      </button>`;
    }),
  ];
  $('#chips').innerHTML = chips.join('');
}

function cardHtml(doc) {
  const cat = categoryOf(doc.category);
  const attachments = doc.attachments || [];
  const thumb = attachments.find((a) => a.isImage);
  const confidence = Math.round((doc.confidence ?? 0) * 100);
  return `<article class="card" data-id="${doc.id}" style="--cat:${cat.color}">
    ${thumb ? `<div class="card-thumb"><img src="${thumb.thumbUrl || thumb.url}" alt="" loading="lazy" onerror="this.parentElement.remove()" /></div>` : ''}
    <div class="card-main">
      <div class="card-top">
        <span class="cat-badge" style="--cat:${cat.color}">${cat.emoji} ${esc(cat.label)}</span>
        ${doc.pinned ? '<span class="pin">📌</span>' : ''}
      </div>
      <h3>${esc(doc.title)}</h3>
      <p class="card-excerpt">${esc(doc.excerpt || '')}</p>
      <div class="tag-row">${(doc.tags || []).map((t) => `<span class="tag">#${esc(t)}</span>`).join('')}</div>
      <div class="card-meta">
        <span>${formatDate(doc.createdAt)}</span>
        ${doc.author ? `<span>${esc(doc.author)}</span>` : ''}
        <span>${SOURCE_LABEL[doc.source] || doc.source}</span>
        ${attachments.length ? `<span>📎 ${attachments.length}</span>` : ''}
        ${doc.failureCount ? `<span title="失敗談">💥 ${doc.failureCount}</span>` : ''}
        ${doc.quiz ? `<span class="quiz-badge" title="クイズがあります">🧠 ${doc.quiz.count}問</span>` : ''}
        <span class="conf" title="分類の確信度">${CLASSIFIER_LABEL[doc.classifiedBy] || ''}${confidence ? ` ${confidence}%` : ''}</span>
      </div>
    </div>
  </article>`;
}

async function loadDocuments() {
  const data = await API.listDocuments(state.filters);
  state.counts = data.counts;
  state.total = data.total;
  state.documents = data.documents;
  renderQuizView();
  renderChips();
  $('#doc-list').innerHTML = data.documents.map(cardHtml).join('');
  const nothing = data.documents.length === 0;
  $('#empty-box').hidden = !nothing;
  $('#empty-box').textContent =
    state.total === 0
      ? 'まだ資料がありません。「✍️ 資料をつくる」からメモを投げ込むか、「📎 そのままアップロード」で手元のファイルを置いてください。'
      : '条件に合う資料が見つかりませんでした。';
}

/* ---------- 詳細 ---------- */
function attachmentHtml(att) {
  if (att.isImage) {
    return `<a class="att att-image" href="${att.url}" target="_blank" rel="noopener">
      <img src="${att.thumbUrl || att.url}" alt="${esc(att.name)}" loading="lazy" onerror="this.remove()" />
      <span>${esc(att.name)}</span>
    </a>`;
  }
  return `<a class="att att-file" href="${att.url}" target="_blank" rel="noopener">
    <span class="file-icon">📄</span>
    <span>${esc(att.name)}<em>${formatSize(att.size)}</em></span>
  </a>`;
}

function renderDetail(doc) {
  state.current = doc;
  const cat = categoryOf(doc.category);
  $('#detail-meta').innerHTML = `
    <span class="cat-badge" style="--cat:${cat.color}">${cat.emoji} ${esc(cat.label)}</span>
    <h2>${esc(doc.title)}</h2>
    <div class="card-meta">
      <span>${formatDate(doc.createdAt)}${doc.updatedAt !== doc.createdAt ? `（更新 ${formatDate(doc.updatedAt)}）` : ''}</span>
      ${doc.author ? `<span>${esc(doc.author)}</span>` : ''}
      <span>${SOURCE_LABEL[doc.source] || doc.source}</span>
      <span>${CLASSIFIER_LABEL[doc.classifiedBy] || ''} ${Math.round((doc.confidence ?? 0) * 100)}%</span>
    </div>
    <div class="tag-row">${(doc.tags || []).map((t) => `<span class="tag">#${esc(t)}</span>`).join('')}</div>`;
  $('#detail-body').innerHTML = window.markdown.render(doc.body || '');
  $('#detail-attachments').innerHTML = (doc.attachments || []).map(attachmentHtml).join('');
  renderFailures(doc);
  renderQuizSection(doc);
  $('#btn-pin').textContent = doc.pinned ? '📌 ピン留めを外す' : '📌 ピン留め';
  $('#btn-edit').textContent = '✏️ 編集';
  state.editing = false;
  $('#detail-edit').hidden = true;
  $('#detail-body').hidden = false;
  $('#detail-failures').hidden = false;
  $('#detail-quiz').hidden = false;
  $('#detail').hidden = false;
  document.body.classList.add('is-locked');
}

function openEditor() {
  const doc = state.current;
  const options = state.config.categories
    .map((c) => `<option value="${c.id}" ${c.id === doc.category ? 'selected' : ''}>${c.emoji} ${esc(c.label)}</option>`)
    .join('');
  $('#detail-edit').innerHTML = `
    <label class="field"><span>タイトル</span><input id="edit-title" type="text" value="${esc(doc.title)}" /></label>
    <div class="grid-2">
      <label class="field"><span>カテゴリ</span><select id="edit-category">${options}</select></label>
      <label class="field"><span>タグ（カンマ区切り）</span><input id="edit-tags" type="text" value="${esc((doc.tags || []).join(', '))}" /></label>
    </div>
    <label class="field"><span>本文（Markdown）</span><textarea id="edit-body" rows="18">${esc(doc.body || '')}</textarea></label>
    <div class="actions">
      <button type="button" class="btn btn-primary" id="edit-save">💾 保存</button>
      <button type="button" class="btn" id="edit-cancel">キャンセル</button>
    </div>`;
  $('#detail-edit').hidden = false;
  $('#detail-body').hidden = true;
  $('#detail-failures').hidden = true;
  $('#detail-quiz').hidden = true;
  state.editing = true;
  $('#btn-edit').textContent = '👁 プレビュー';

  $('#edit-cancel').onclick = () => renderDetail(state.current);
  $('#edit-save').onclick = async () => {
    try {
      loading(true, '保存中…');
      const updated = await API.updateDocument(doc.id, {
        title: $('#edit-title').value,
        body: $('#edit-body').value,
        tags: $('#edit-tags').value,
        category: $('#edit-category').value,
      });
      renderDetail(updated);
      await loadDocuments();
      toast('保存しました');
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      loading(false);
    }
  };
}

function closeDetail() {
  $('#detail').hidden = true;
  document.body.classList.remove('is-locked');
  state.current = null;
}

/* ==================== 失敗談とクイズ ====================
 * 引継ぎで失われるのは手順ではなく、手順の理由。
 * 失敗談＝理由がいちばん濃く残っている場所を集め、それをクイズにして渡す。
 */

const KIND_LABEL = {
  why: { emoji: '🤔', label: 'なぜそうするのか' },
  judge: { emoji: '⚖️', label: '現場での判断' },
  trouble: { emoji: '🛠️', label: 'トラブル対応' },
  step: { emoji: '📋', label: '手順の勘どころ' },
};

const kindOf = (id) => KIND_LABEL[id] || KIND_LABEL.why;
const CHOICE_MARKS = ['A', 'B', 'C', 'D', 'E'];

/* ---------- 成績（この端末にだけ残す） ---------- */
const PROGRESS_KEY = 'hikitsugi.quizProgress';

function readProgress() {
  try {
    return JSON.parse(localStorage.getItem(PROGRESS_KEY) || '{}') || {};
  } catch {
    return {};
  }
}

function progressOf(docId) {
  return readProgress()[docId] || null;
}

function writeProgress(docId, entry) {
  const all = readProgress();
  all[docId] = entry;
  try {
    localStorage.setItem(PROGRESS_KEY, JSON.stringify(all));
  } catch {
    // 容量オーバーなどで保存できなくても、クイズ自体は解ける
  }
  return entry;
}

/**
 * 成績を記録する。
 * 「間違えた問題だけもう一度」は復習なので、その回だけの点数（1/1 など）で上書きせず、
 * クイズ全体のうち何問が未消化かを更新する。
 */
function saveProgress(docId, round) {
  const before = progressOf(docId);
  const times = (before?.times || 0) + 1;

  if (!round.review) {
    return writeProgress(docId, {
      correct: round.correct,
      total: round.total,
      wrongIds: round.wrongIds,
      at: new Date().toISOString(),
      times,
    });
  }

  const total = before?.total || round.total;
  const wrong = new Set(before?.wrongIds || []);
  for (const id of round.clearedIds) wrong.delete(id);
  for (const id of round.wrongIds) wrong.add(id);
  return writeProgress(docId, {
    correct: Math.max(total - wrong.size, 0),
    total,
    wrongIds: [...wrong],
    at: new Date().toISOString(),
    times,
  });
}

/* ---------- 失敗談 ---------- */
/*
 * 空欄は消さずに「記録なし」と出す。
 * 埋め忘れではなく、その場に居なかった人にはもう復元できない情報がどこで失われたかを示すため。
 */
function fieldLine(label, value, className = '') {
  const filled = String(value || '').trim();
  return `<p class="failure-line ${className}"><b>${label}</b>${
    filled ? esc(filled) : '<span class="record-none">記録なし</span>'
  }</p>`;
}

function failureHtml(failure) {
  const next = failure.next || failure.prevention;
  const parts = [];
  if (failure.purpose) parts.push(fieldLine('目的', failure.purpose));
  parts.push(`<p class="failure-what">${esc(failure.what)}</p>`);
  // 判断と理由だけは、空でも必ず行を出す。ここが失われた場所そのものだから。
  parts.push(fieldLine('判断と理由', failure.why, 'is-reason'));
  if (next || failure.purpose) parts.push(fieldLine('次の手', next));

  return `<li class="failure ${failure.why ? '' : 'is-unreasoned'}" data-failure-id="${esc(failure.id)}">
    <div class="failure-body">${parts.join('')}</div>
    <div class="failure-foot">
      <span>${[
        failure.source ? esc(failure.source) : '',
        failure.author ? esc(failure.author) : '',
        formatDate(failure.createdAt),
      ]
        .filter(Boolean)
        .join(' · ')}</span>
      <button type="button" class="link-btn failure-remove" data-failure-id="${esc(failure.id)}">削除</button>
    </div>
  </li>`;
}

function renderFailures(doc) {
  const failures = doc.failures || [];
  const unreasoned = failures.filter((f) => !String(f.why || '').trim()).length;

  $('#detail-failures').innerHTML = `
    <div class="section-head">
      <h3>💥 失敗談 <span class="count">${failures.length}</span></h3>
      <button type="button" class="link-btn" id="failure-toggle">＋ 書く</button>
    </div>
    ${
      unreasoned
        ? `<p class="notice">判断と理由が記録に残っていないものが${unreasoned}件あります。
             ここはクイズにできません——覚えている人が居るうちに聞いておく場所です。</p>`
        : ''
    }
    ${
      failures.length
        ? `<ul class="failure-list">${failures.map(failureHtml).join('')}</ul>`
        : '<p class="hint">まだありません。うまくいかなかったことを1件書くと、それが後輩へのクイズになります。</p>'
    }
    <div class="failure-form" id="failure-form" hidden>
      <p class="hint">思い出せない欄は空のままで構いません。「記録なし」として残ります。</p>
      <label class="field">
        <span>目的<em>（何をしようとしていた？）</em></span>
        <textarea id="failure-purpose" rows="2" placeholder="例: NEBuilder用の断片をPCRで増やす"></textarea>
      </label>
      <label class="field">
        <span>起きたこと<em class="req">必須</em></span>
        <textarea id="failure-what" rows="2" placeholder="例: 増幅がうまくいかなかった"></textarea>
      </label>
      <label class="field">
        <span>判断と理由<em>（どう考えて、なぜそう判断した？）</em></span>
        <textarea id="failure-why" rows="3" placeholder="例: 結合部分だけのTmを見るべきところ、プライマー全長のTmをそのまま使っていた"></textarea>
        <em class="field-note">あとから誰にも復元できないのは、この欄だけです。</em>
      </label>
      <label class="field">
        <span>次の手<em>（このあとどうした／どうする？）</em></span>
        <textarea id="failure-next" rows="2" placeholder="例: 結合部分のTmで再設定"></textarea>
      </label>
      <div class="actions">
        <button type="button" class="btn btn-primary" id="failure-save">💾 記録を残す</button>
        <button type="button" class="btn" id="failure-import-toggle">📊 表から取り込む</button>
      </div>
      <label class="field" id="failure-import" hidden>
        <span>スプレッドシートの表を貼り付け<em>（見出し行ごと貼って大丈夫です）</em></span>
        <textarea id="failure-rows" rows="4" placeholder="目的	起きたこと	判断と理由	次の手	出典"></textarea>
        <div class="actions">
          <button type="button" class="btn" id="failure-import-run">📥 まとめて取り込む</button>
        </div>
      </label>
    </div>`;
}

/* ---------- 詳細画面のクイズ欄 ---------- */
function quizIsStale(doc) {
  // 失敗談が増えたあとのクイズは、その失敗を知らないまま出題している。
  if (!doc.quiz || !doc.quiz.createdAt) return false;
  return (doc.failures || []).some((f) => String(f.createdAt || '') > String(doc.quiz.createdAt));
}

function renderQuizSection(doc) {
  const quiz = doc.quiz;
  const aiOff = !state.config.aiEnabled;
  const progress = progressOf(doc.id);

  const head = `<div class="section-head">
      <h3>🧠 クイズ ${quiz ? `<span class="count">${quiz.questions.length}問</span>` : ''}</h3>
      ${quiz ? '<button type="button" class="link-btn" id="quiz-remove">削除</button>' : ''}
    </div>`;

  // 作る／作り直すのどちらでも、AI経路とプロンプト出力経路の両方を残す
  // （APIキーが無い研究室でも、作り直しまで到達できるように）。
  const makeLabel = quiz ? '🔄 AIで作り直す' : '✨ AIでクイズを作る';
  const makeButtons = `<button type="button" class="btn ${quiz ? '' : 'btn-primary'}" id="quiz-make" ${aiOff ? 'disabled' : ''}>${makeLabel}</button>
      <button type="button" class="btn" id="quiz-prompt">📝 ${quiz ? '作り直す用の' : ''}プロンプトを出力</button>`;

  const body = quiz
    ? `<div class="quiz-cta">
        <button type="button" class="btn btn-primary" id="quiz-start">▶ クイズを解く（${quiz.questions.length}問）</button>
        ${makeButtons}
      </div>
      ${progress ? `<p class="hint">前回 ${progress.correct}/${progress.total}（${formatDate(progress.at)}・${progress.times}回目）</p>` : ''}
      ${quizIsStale(doc) ? '<p class="notice">この後に失敗談が増えています。作り直すと新しい失敗も問題に入ります。</p>' : ''}`
    : `<p class="hint">
        本文${(doc.failures || []).length ? `と失敗談${doc.failures.length}件` : ''}から、「なぜそうするのか」を問う4択クイズを作ります。
       </p>
       <div class="quiz-cta">${makeButtons}</div>
       ${aiOff ? '<p class="hint">APIキーが未設定のため、プロンプトを出して手持ちのAIに貼る経路をお使いください。</p>' : ''}`;

  $('#detail-quiz').innerHTML = `${head}${body}
    <div class="quiz-paste" id="quiz-paste" hidden>
      <pre id="quiz-prompt-text" class="prompt-box"></pre>
      <div class="actions">
        <button type="button" class="btn" id="quiz-prompt-copy">📋 プロンプトをコピー</button>
      </div>
      <label class="field">
        <span>AIが出力したJSONを貼り付け</span>
        <textarea id="quiz-json" rows="6" placeholder='{"questions": [...]}'></textarea>
      </label>
      <div class="actions">
        <button type="button" class="btn btn-primary" id="quiz-json-save">📥 クイズを保存する</button>
      </div>
    </div>`;
}

/* ---------- クイズを解く ---------- */
function openQuizPlayer(doc, questions) {
  const review = Boolean(questions && questions.length);
  state.player = {
    doc,
    questions: review ? questions : doc.quiz.questions,
    review,
    index: 0,
    answers: [],
  };
  $('#quiz-doc-title').textContent = doc.title;
  $('#quiz-player').hidden = false;
  document.body.classList.add('is-locked');
  renderQuizStage();
}

function closeQuizPlayer() {
  $('#quiz-player').hidden = true;
  if ($('#detail').hidden) document.body.classList.remove('is-locked');
  state.player = null;
}

function renderQuizProgressBar(done, total) {
  $('#quiz-bar-fill').style.width = `${Math.round((done / total) * 100)}%`;
  $('#quiz-step').textContent = done >= total ? '結果' : `${done + 1} / ${total}`;
}

function renderQuizStage() {
  const player = state.player;
  const total = player.questions.length;
  renderQuizProgressBar(player.index, total);

  if (player.index >= total) return renderQuizResult();

  const question = player.questions[player.index];
  const kind = kindOf(question.kind);
  const answered = player.answers[player.index];

  const choices = question.choices
    .map((choice, index) => {
      let cls = 'choice';
      if (answered !== undefined) {
        if (index === question.answer) cls += ' is-correct';
        else if (index === answered) cls += ' is-wrong';
        else cls += ' is-dim';
      }
      return `<button type="button" class="${cls}" data-choice="${index}" ${answered !== undefined ? 'disabled' : ''}>
        <span class="choice-mark">${CHOICE_MARKS[index] || index + 1}</span>
        <span>${esc(choice)}</span>
      </button>`;
    })
    .join('');

  const feedback =
    answered === undefined
      ? ''
      : `<div class="feedback ${answered === question.answer ? 'is-correct' : 'is-wrong'}">
          <p class="feedback-head">${answered === question.answer ? '⭕️ 正解' : '❌ 不正解'}</p>
          ${question.why ? `<p><b>なぜ</b>${esc(question.why)}</p>` : ''}
          ${question.consequence ? `<p><b>やらないと</b>${esc(question.consequence)}</p>` : ''}
          ${question.failure ? `<p class="feedback-failure"><b>実際にあった失敗</b>${esc(question.failure)}</p>` : ''}
          ${question.source ? `<p class="feedback-source">出典: ${esc(question.source)}</p>` : ''}
        </div>
        <div class="actions">
          <button type="button" class="btn btn-primary" id="quiz-next">
            ${player.index + 1 >= total ? '結果を見る →' : '次の問題 →'}
          </button>
        </div>`;

  $('#quiz-stage').innerHTML = `
    <span class="kind-badge">${kind.emoji} ${esc(kind.label)}</span>
    <h3 class="quiz-question">${esc(question.question)}</h3>
    <div class="choices">${choices}</div>
    ${feedback}`;
}

/*
 * 理由が記録に残っていない失敗を、クイズの最後に見せる。
 * ここは出題できない代わりに、「先輩が居るうちに聞くべきこと」の一覧になる。
 */
function unreasonedBlock(doc) {
  const unreasoned = (doc.failures || []).filter((f) => !String(f.why || '').trim());
  if (!unreasoned.length) return '';
  return `<div class="unreasoned">
    <p class="unreasoned-head">まだ誰も答えを書いていない失敗が${unreasoned.length}件あります</p>
    <p class="hint">出題できたのは理由が残っているものだけです。下は、先輩が居るうちに聞いておく候補です。</p>
    <ul>${unreasoned
      .slice(0, 5)
      .map((f) => `<li>${esc(f.what)}${f.purpose ? `<em>（${esc(f.purpose)}）</em>` : ''}</li>`)
      .join('')}</ul>
    ${unreasoned.length > 5 ? `<p class="hint">ほか${unreasoned.length - 5}件</p>` : ''}
  </div>`;
}

function renderQuizResult() {
  const player = state.player;
  const questions = player.questions;
  const wrong = questions.filter((q, i) => player.answers[i] !== q.answer);
  const correct = questions.length - wrong.length;
  const overall = saveProgress(player.doc.id, {
    review: player.review,
    correct,
    total: questions.length,
    wrongIds: wrong.map((q) => q.id),
    clearedIds: questions.filter((q, i) => player.answers[i] === q.answer).map((q) => q.id),
  });

  const message =
    wrong.length === 0
      ? 'この手順の「なぜ」は、もう自分のものです。'
      : `間違えた${wrong.length}問が、いま資料で読むべきところです。`;

  $('#quiz-stage').innerHTML = `
    <div class="quiz-result">
      <p class="score"><b>${correct}</b> / ${questions.length}</p>
      <p class="hint">${message}</p>
      ${player.review ? `<p class="hint">この資料の通算: ${overall.correct} / ${overall.total}</p>` : ''}
    </div>
    ${
      wrong.length
        ? `<ul class="review-list">${wrong
            .map(
              (q) => `<li>
                <p class="review-q">${esc(q.question)}</p>
                <p class="review-a">→ ${esc(q.choices[q.answer])}</p>
                ${q.why ? `<p class="review-why">${esc(q.why)}</p>` : ''}
              </li>`,
            )
            .join('')}</ul>`
        : ''
    }
    ${unreasonedBlock(player.doc)}
    <div class="actions">
      ${wrong.length ? '<button type="button" class="btn btn-primary" id="quiz-retry">間違えた問題だけもう一度</button>' : ''}
      <button type="button" class="btn" id="quiz-read">📖 資料を読む</button>
      <button type="button" class="btn" id="quiz-finish">閉じる</button>
    </div>`;
}

/* ---------- クイズ一覧 ---------- */
function quizCardHtml(doc) {
  const cat = categoryOf(doc.category);
  const progress = progressOf(doc.id);
  const rate = progress ? Math.round((progress.correct / progress.total) * 100) : null;
  return `<article class="card quiz-card" data-quiz-id="${doc.id}" style="--cat:${cat.color}">
    <div class="card-main">
      <div class="card-top">
        <span class="cat-badge" style="--cat:${cat.color}">${cat.emoji} ${esc(cat.label)}</span>
        <span class="q-count">${doc.quiz.count}問</span>
      </div>
      <h3>${esc(doc.title)}</h3>
      <p class="card-excerpt">${esc(doc.excerpt || '')}</p>
      <div class="card-meta">
        ${doc.failureCount ? `<span>💥 失敗談 ${doc.failureCount}</span>` : ''}
        ${progress ? `<span class="score-badge ${rate === 100 ? 'is-full' : ''}">前回 ${progress.correct}/${progress.total}</span>` : '<span class="score-badge is-new">未挑戦</span>'}
      </div>
      <button type="button" class="btn btn-primary quiz-open">▶ 解く</button>
    </div>
  </article>`;
}

function renderQuizView() {
  const docs = state.documents || [];
  const withQuiz = docs.filter((d) => d.quiz);
  const without = docs.filter((d) => !d.quiz);

  $('#quiz-list').innerHTML = withQuiz.map(quizCardHtml).join('');
  $('#quiz-empty').hidden = withQuiz.length > 0;
  $('#quiz-empty').textContent = docs.length
    ? 'まだクイズがありません。資料箱から資料を開いて「🧠 クイズを作る」を押してください。'
    : 'まず資料を1つ作ってください。そこからクイズが作れます。';

  const done = withQuiz.filter((d) => progressOf(d.id)).length;
  $('#quiz-progress-summary').textContent = withQuiz.length
    ? `${withQuiz.length}件中 ${done}件に挑戦ずみ`
    : '';

  $('#quiz-todo').hidden = without.length === 0;
  $('#quiz-todo-count').textContent = `（${without.length}）`;
  $('#quiz-todo-list').innerHTML = without
    .map(
      (d) => `<button type="button" class="todo-item" data-open-id="${d.id}">
        <span>${esc(d.title)}</span>
        ${d.failureCount ? `<em>💥 ${d.failureCount}</em>` : ''}
      </button>`,
    )
    .join('');
}

/* ---------- 失敗談フォームの案内 ---------- */
function renderFormPanel() {
  const { formUrl, sheetUrl, backend } = state.config;
  const body = $('#form-panel-body');

  if (formUrl) {
    body.innerHTML = `<p class="hint">
        このURLを研究室のSlackやLINEに貼っておけば、失敗した本人がその場で1分で書けます。
        回答はスプレッドシートに溜まり、選んだ資料の失敗談として取り込まれてクイズになります。
      </p>
      <div class="actions">
        <a class="btn btn-primary" href="${esc(formUrl)}" target="_blank" rel="noopener">📝 失敗談フォームを開く</a>
        ${sheetUrl ? `<a class="btn" href="${esc(sheetUrl)}" target="_blank" rel="noopener">📊 回答スプレッドシート</a>` : ''}
        <button type="button" class="btn" id="form-sync">⬇️ 回答を取り込む</button>
        <button type="button" class="btn" id="form-copy">🔗 URLをコピー</button>
      </div>
      <p class="hint" id="form-sync-status"></p>`;
    return;
  }

  body.innerHTML =
    backend === 'drive'
      ? `<p class="hint">
          失敗談フォームがまだありません。Apps Script のエディタで関数 <code>setupForm</code> を1回実行すると、
          Googleフォームと回答スプレッドシートが資料箱のフォルダに作られ、ここにURLが出ます。
        </p>`
      : `<p class="hint">
          Googleフォームでの収集は、保存先を Google Drive にしているときに使えます（右上の⚙）。
          このサーバー版では、資料を開いて「💥 失敗談」から直接書くか、
          スプレッドシートの表をコピーして「📊 表から取り込む」で貼り付けてください。
        </p>`;
}

async function copyText(text, message) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    // クリップボードAPIが使えない環境向けの保険
    const area = document.createElement('textarea');
    area.value = text;
    document.body.appendChild(area);
    area.select();
    document.execCommand('copy');
    area.remove();
  }
  toast(message);
}

/* ---------- 作成フロー ---------- */
function formValues(form) {
  const data = new FormData(form);
  return {
    title: (data.get('title') || '').trim(),
    memo: (data.get('memo') || '').trim(),
    failure: (data.get('failure') || '').trim(),
    tags: (data.get('tags') || '').trim(),
    category: data.get('category') || '',
  };
}

function buildPayload(form, picker, extra = {}) {
  return Object.assign(
    formValues(form),
    { author: $('#author').value.trim(), files: picker.files(), driveFiles: picker.driveIds() },
    extra,
  );
}

const createOptions = () => ({ maxFileSize: state.config.maxFileSize });

function switchView(view) {
  $$('.tab').forEach((tab) => tab.classList.toggle('is-active', tab.dataset.view === view));
  $$('.view').forEach((section) => section.classList.toggle('is-active', section.id === `view-${view}`));
  // 成績はこの端末にしか無いので、タブに戻るたびに描き直す。
  if (view === 'quiz') renderQuizView();
}

/* ---------- 保存先の設定 ---------- */
function renderStoreBadge() {
  const badge = $('#store-badge');
  const drive = API.isDrive();
  badge.textContent = drive ? '🗂 Google Drive' : '💾 このサーバー';
  badge.className = `badge ${drive ? 'badge-on' : ''}`;
  badge.title = drive
    ? `保存先: ${API.endpoint()}`
    : 'この画面を配信しているサーバーに保存しています（⚙でGoogle Driveに切り替えられます）';
}

function openSettings(message = '') {
  $('#settings-url').value = API.isDrive() ? API.endpoint() : '';
  $('#settings-token').value = localStorage.getItem('hikitsugi.gasToken') || '';
  $('#settings-status').textContent = message;
  $('#settings').hidden = false;
  document.body.classList.add('is-locked');
}

function closeSettings() {
  $('#settings').hidden = true;
  document.body.classList.remove('is-locked');
}

function wireSettings() {
  $('#btn-settings').addEventListener('click', () => openSettings());
  $('#settings-close').addEventListener('click', closeSettings);
  $('#settings').addEventListener('click', (event) => {
    if (event.target.id === 'settings') closeSettings();
  });
  $('#settings-save').addEventListener('click', async () => {
    const url = $('#settings-url').value.trim();
    const pass = $('#settings-token').value.trim();
    if (!url) return toast('Apps Script のURLを入力してください', 'warn');
    $('#settings-status').textContent = '接続を確認しています…';
    try {
      // 保存する前に必ず疎通を確認する（URLの貼り間違いをそのまま保存しない）。
      const config = await API.test(url, pass);
      API.setEndpoint(url, pass);
      $('#settings-status').textContent = `接続できました（資料の保存先: ${config.folderUrl || 'Google Drive'}）`;
      closeSettings();
      await boot();
      toast('Google Drive に接続しました');
    } catch (err) {
      $('#settings-status').textContent = `接続できませんでした: ${err.message}`;
    }
  });
  $('#settings-clear').addEventListener('click', async () => {
    API.setEndpoint('', '');
    closeSettings();
    await boot();
    toast('このサーバーの保存先に戻しました');
  });
}

/** 保存先から受け取った設定を画面に反映する（保存先を切り替えるたびに呼ぶ）。 */
function applyConfig() {
  renderStoreBadge();
  renderFormPanel();
  if (state.config.folderUrl) $('#store-badge').title = `保存先フォルダ: ${state.config.folderUrl}`;

  for (const id of ['#create-drive', '#upload-drive']) {
    // アップロードせずに添付できるのは Google Drive 保存先のときだけ。
    $(id).hidden = state.config.backend !== 'drive';
  }

  const options = state.config.categories
    .map((c) => `<option value="${c.id}">${c.emoji} ${c.label}</option>`)
    .join('');
  for (const id of ['#create-category', '#upload-category']) {
    $(id).innerHTML = `<option value="">🤖 自動で分類する</option>${options}`;
  }

  const badge = $('#ai-badge');
  if (state.config.aiEnabled) {
    badge.textContent = '🤖 AI 有効';
    badge.className = 'badge badge-on';
    badge.title = `モデル: ${state.config.model}`;
    $('#btn-ai').disabled = false;
    $('#ai-hint').textContent = '「AIで資料を作成」は写真も読み取って資料をまとめます。分類もAIが行います。';
  } else {
    badge.textContent = '🔌 AI 未接続';
    badge.className = 'badge badge-off';
    badge.title = state.config.backend === 'drive'
      ? 'Apps Script のスクリプトプロパティに ANTHROPIC_API_KEY を設定すると資料の自動生成が使えます'
      : 'ANTHROPIC_API_KEY を設定すると資料の自動生成が使えます';
    $('#btn-ai').disabled = true;
    $('#ai-hint').textContent =
      'APIキーが未設定のため「AIで資料を作成」は使えません。「資料作成プロンプトを出力」を使って、お手持ちのAIに貼り付けてください（自動分類はキーワードで動きます）。';
  }
}


/* ---------- 失敗談・クイズの操作 ---------- */
function wireQuizUi() {
  // 資料を更新して詳細と一覧を描き直す（失敗談・クイズはどちらも資料の一部）。
  const refresh = async (doc, message) => {
    renderDetail(doc);
    await loadDocuments();
    if (message) toast(message);
  };

  $('#detail-failures').addEventListener('click', async (event) => {
    const target = event.target;
    if (target.id === 'failure-toggle') {
      const form = $('#failure-form');
      form.hidden = !form.hidden;
      if (!form.hidden) $('#failure-what').focus();
      return;
    }
    if (target.id === 'failure-import-toggle') {
      $('#failure-import').hidden = !$('#failure-import').hidden;
      return;
    }
    if (target.id === 'failure-save') {
      const what = $('#failure-what').value.trim();
      if (!what) return toast('起きたことを入力してください', 'warn');
      const why = $('#failure-why').value.trim();
      try {
        loading(true, '失敗談を保存しています…');
        const doc = await API.addFailure(state.current.id, {
          purpose: $('#failure-purpose').value.trim(),
          what,
          why,
          next: $('#failure-next').value.trim(),
          author: $('#author').value.trim(),
        });
        await refresh(
          doc,
          why
            ? 'ありがとうございます。この判断はクイズになります。'
            : '記録しました。判断と理由は「記録なし」として残ります。',
        );
      } catch (err) {
        toast(err.message, 'error');
      } finally {
        loading(false);
      }
      return;
    }
    if (target.id === 'failure-import-run') {
      const text = $('#failure-rows').value.trim();
      if (!text) return toast('スプレッドシートの表を貼り付けてください', 'warn');
      try {
        loading(true, '取り込んでいます…');
        const doc = await API.importFailures(state.current.id, text);
        await refresh(doc, '取り込みました');
      } catch (err) {
        toast(err.message, 'error');
      } finally {
        loading(false);
      }
      return;
    }
    const remove = target.closest('.failure-remove');
    if (remove) {
      if (!confirm('この失敗談を削除します。よろしいですか？')) return;
      try {
        await refresh(await API.deleteFailure(state.current.id, remove.dataset.failureId), '削除しました');
      } catch (err) {
        toast(err.message, 'error');
      }
    }
  });

  $('#detail-quiz').addEventListener('click', async (event) => {
    const id = event.target.id;
    if (id === 'quiz-start') return openQuizPlayer(state.current);

    if (id === 'quiz-make') {
      const failures = (state.current.failures || []).length;
      try {
        loading(true, `AIがクイズを作っています…（${failures ? `失敗談${failures}件を含む` : '本文から'}）`);
        const doc = await API.saveQuiz(state.current.id, { count: state.config.quizDefaultCount || 5 });
        renderDetail(doc);
        await loadDocuments();
        openQuizPlayer(doc);
      } catch (err) {
        toast(err.message, 'error');
      } finally {
        loading(false);
      }
      return;
    }

    if (id === 'quiz-remove') {
      if (!confirm('このクイズを削除します。よろしいですか？')) return;
      try {
        await refresh(await API.deleteQuiz(state.current.id), 'クイズを削除しました');
      } catch (err) {
        toast(err.message, 'error');
      }
      return;
    }

    if (id === 'quiz-prompt') {
      try {
        const prompt = await API.quizPrompt(state.current.id, { count: state.config.quizDefaultCount || 5 });
        $('#quiz-prompt-text').textContent = prompt;
        $('#quiz-paste').hidden = false;
        $('#quiz-paste').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      } catch (err) {
        toast(err.message, 'error');
      }
      return;
    }

    if (id === 'quiz-prompt-copy') {
      return copyText($('#quiz-prompt-text').textContent, 'プロンプトをコピーしました');
    }

    if (id === 'quiz-json-save') {
      const json = $('#quiz-json').value.trim();
      if (!json) return toast('AIが出力したJSONを貼り付けてください', 'warn');
      try {
        loading(true, 'クイズを保存しています…');
        const doc = await API.saveQuiz(state.current.id, { json });
        renderDetail(doc);
        await loadDocuments();
        openQuizPlayer(doc);
      } catch (err) {
        toast(err.message, 'error');
      } finally {
        loading(false);
      }
    }
  });

  // クイズを解く
  $('#quiz-close').addEventListener('click', closeQuizPlayer);
  $('#quiz-player').addEventListener('click', (event) => {
    if (event.target.id === 'quiz-player') closeQuizPlayer();
  });
  $('#quiz-stage').addEventListener('click', async (event) => {
    const player = state.player;
    if (!player) return;

    const choice = event.target.closest('.choice');
    if (choice && !choice.disabled) {
      player.answers[player.index] = Number(choice.dataset.choice);
      renderQuizStage();
      return;
    }

    const id = event.target.id;
    if (id === 'quiz-next') {
      player.index += 1;
      renderQuizStage();
      return;
    }
    if (id === 'quiz-retry') {
      const wrong = player.questions.filter((q, i) => player.answers[i] !== q.answer);
      openQuizPlayer(player.doc, wrong);
      return;
    }
    if (id === 'quiz-read') {
      const doc = player.doc;
      closeQuizPlayer();
      try {
        renderDetail(await API.getDocument(doc.id));
      } catch (err) {
        toast(err.message, 'error');
      }
      return;
    }
    if (id === 'quiz-finish') {
      closeQuizPlayer();
      await loadDocuments();
    }
  });

  // クイズ一覧から直接解く
  $('#quiz-list').addEventListener('click', async (event) => {
    const card = event.target.closest('.quiz-card');
    if (!card) return;
    try {
      loading(true, 'クイズを読み込んでいます…');
      const doc = await API.getDocument(card.dataset.quizId);
      if (!doc.quiz) return toast('この資料にはまだクイズがありません', 'warn');
      openQuizPlayer(doc);
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      loading(false);
    }
  });

  $('#quiz-todo-list').addEventListener('click', async (event) => {
    const item = event.target.closest('[data-open-id]');
    if (!item) return;
    try {
      renderDetail(await API.getDocument(item.dataset.openId));
    } catch (err) {
      toast(err.message, 'error');
    }
  });

  // 失敗談フォーム
  $('#form-panel-body').addEventListener('click', async (event) => {
    if (event.target.id === 'form-copy') {
      return copyText(state.config.formUrl, 'フォームのURLをコピーしました');
    }
    if (event.target.id !== 'form-sync') return;
    try {
      loading(true, 'フォームの回答を取り込んでいます…');
      const result = await API.syncForm();
      $('#form-sync-status').textContent = result.imported
        ? `${result.imported}件を取り込みました${result.unmatched ? `（${result.unmatched}件は資料が選ばれておらず未仕分け）` : ''}`
        : '新しい回答はありませんでした';
      await loadDocuments();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      loading(false);
    }
  });
}

async function init() {
  applyConfig();

  $('#author').value = localStorage.getItem('hikitsugi.author') || '';
  $('#author').addEventListener('change', (e) => localStorage.setItem('hikitsugi.author', e.target.value.trim()));

  const createPicker = createFilePicker('create-drop', 'create-files', 'create-previews', 'create');
  const uploadPicker = createFilePicker('upload-drop', 'upload-files', 'upload-previews', 'upload');

  $$('.tab').forEach((tab) => tab.addEventListener('click', () => switchView(tab.dataset.view)));

  // 検索・絞り込み
  let searchTimer = null;
  $('#search').addEventListener('input', (e) => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      state.filters.q = e.target.value.trim();
      loadDocuments().catch((err) => toast(err.message, 'error'));
    }, 220);
  });
  $('#sort').addEventListener('change', (e) => {
    state.filters.sort = e.target.value;
    loadDocuments().catch((err) => toast(err.message, 'error'));
  });
  $('#chips').addEventListener('click', (event) => {
    const chip = event.target.closest('.chip');
    if (!chip) return;
    state.filters.category = chip.dataset.category;
    state.filters.tag = '';
    loadDocuments().catch((err) => toast(err.message, 'error'));
  });
  $('#doc-list').addEventListener('click', async (event) => {
    // タグをクリックしたら、そのタグでの絞り込みに切り替える。
    const tagEl = event.target.closest('.tag');
    if (tagEl) {
      state.filters.tag = tagEl.textContent.replace(/^#/, '');
      state.filters.category = '';
      $('#search').value = '';
      state.filters.q = '';
      loadDocuments().catch((err) => toast(err.message, 'error'));
      toast(`タグ「${state.filters.tag}」で絞り込みました（「すべて」で解除）`);
      return;
    }
    const card = event.target.closest('.card');
    if (!card) return;
    try {
      renderDetail(await API.getDocument(card.dataset.id));
    } catch (err) {
      toast(err.message, 'error');
    }
  });

  // AIで資料を作成
  $('#btn-ai').addEventListener('click', async () => {
    const form = $('#create-form');
    if (!formValues(form).memo) return toast('引継ぎメモを入力してください', 'warn');
    try {
      loading(true, 'AIが資料を作成しています…（30秒ほどかかることがあります）');
      const doc = await API.createDocument(buildPayload(form, createPicker, { mode: 'ai' }), createOptions());
      form.reset();
      createPicker.clear();
      $('#prompt-panel').hidden = true;
      await loadDocuments();
      switchView('box');
      renderDetail(doc);
      toast('資料を作成して資料箱に入れました');
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      loading(false);
    }
  });

  // 資料作成プロンプトを出力
  $('#btn-prompt').addEventListener('click', async () => {
    const form = $('#create-form');
    const values = formValues(form);
    if (!values.memo && !values.title) return toast('タイトルかメモを入力してください', 'warn');
    try {
      const prompt = await API.buildPrompt({
        title: values.title,
        memo: values.memo,
        tags: values.tags,
        author: $('#author').value.trim(),
        photoNames: createPicker.names(),
      });
      $('#prompt-text').textContent = prompt;
      $('#prompt-panel').hidden = false;
      $('#prompt-panel').scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch (err) {
      toast(err.message, 'error');
    }
  });

  $('#btn-copy').addEventListener('click', () => copyText($('#prompt-text').textContent, 'プロンプトをコピーしました'));

  // AIの出力を貼り付けて保存
  $('#btn-save-pasted').addEventListener('click', async () => {
    const form = $('#create-form');
    const pasted = $('#paste-body').value.trim();
    if (!pasted) return toast('AIが出力したMarkdownを貼り付けてください', 'warn');
    try {
      loading(true, '保存して分類しています…');
      const doc = await API.createDocument(buildPayload(form, createPicker, { mode: 'manual', body: pasted }), createOptions());
      form.reset();
      createPicker.clear();
      $('#paste-body').value = '';
      $('#prompt-panel').hidden = true;
      await loadDocuments();
      switchView('box');
      renderDetail(doc);
      toast('資料箱に保存しました');
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      loading(false);
    }
  });

  // そのままアップロード
  $('#upload-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.target;
    if (uploadPicker.files().length === 0 && uploadPicker.driveIds().length === 0) {
      return toast('ファイルを選択するか、DriveのURLを添付してください', 'warn');
    }
    try {
      loading(true, 'アップロードして分類しています…');
      const doc = await API.createDocument(buildPayload(form, uploadPicker, { mode: 'manual' }), createOptions());
      form.reset();
      uploadPicker.clear();
      await loadDocuments();
      switchView('box');
      renderDetail(doc);
      toast(`「${categoryOf(doc.category).label}」に分類しました`);
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      loading(false);
    }
  });

  // 詳細画面の操作
  $('#detail-close').addEventListener('click', closeDetail);
  $('#detail').addEventListener('click', (event) => {
    if (event.target.id === 'detail') closeDetail();
  });
  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    if (!$('#quiz-player').hidden) return closeQuizPlayer();
    if (!$('#detail').hidden) closeDetail();
  });
  $('#btn-download').addEventListener('click', () => API.downloadMarkdown(state.current));
  $('#btn-edit').addEventListener('click', () => (state.editing ? renderDetail(state.current) : openEditor()));
  $('#btn-pin').addEventListener('click', async () => {
    try {
      const updated = await API.updateDocument(state.current.id, { pinned: !state.current.pinned });
      renderDetail(updated);
      await loadDocuments();
    } catch (err) {
      toast(err.message, 'error');
    }
  });
  $('#btn-reclassify').addEventListener('click', async () => {
    try {
      loading(true, '分類しなおしています…');
      const updated = await API.reclassify(state.current.id);
      renderDetail(updated);
      await loadDocuments();
      toast(`「${categoryOf(updated.category).label}」に分類しました`);
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      loading(false);
    }
  });
  $('#btn-delete').addEventListener('click', async () => {
    if (!confirm(`「${state.current.title}」を削除します。よろしいですか？`)) return;
    try {
      await API.deleteDocument(state.current.id);
      closeDetail();
      await loadDocuments();
      toast('削除しました');
    } catch (err) {
      toast(err.message, 'error');
    }
  });

  wireQuizUi();

  await loadDocuments();
}

let booted = false;
async function boot() {
  try {
    state.config = await API.getConfig();
    if (state.config.requiresToken && !API.hasToken()) {
      // 合言葉で保護された資料箱。初回だけ⚙で入力してもらう。
      renderStoreBadge();
      openSettings('この資料箱は合言葉で保護されています。研究室で共有されている合言葉を入力してください。');
      return;
    }
    if (booted) {
      // 保存先を切り替えたときは設定と一覧を読み直す。
      applyConfig();
      state.filters = { q: '', category: '', tag: '', sort: state.filters.sort };
      $('#search').value = '';
      await loadDocuments();
      return;
    }
    await init();
    booted = true;
  } catch (err) {
    renderStoreBadge();
    $('#ai-badge').textContent = '⚠️ 保存先未接続';
    $('#ai-badge').className = 'badge badge-off';
    openSettings(`保存先に接続できませんでした: ${err.message}`);
  }
}

wireSettings();
boot();
