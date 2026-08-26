/*
 * 引継ぎ資料箱 — Google Apps Script バックエンド
 *
 * 役割: サーバーを1台も持たずに「共有できる資料箱」を成立させる。
 *   - 資料の実体（Markdown・写真）は Google Drive のフォルダに保存する
 *   - ANTHROPIC_API_KEY はスクリプトプロパティに置き、ブラウザには渡さない
 *   - GitHub Pages 等に置いたフロントエンドから JSON で呼ばれる
 *
 * 使い方は README.md の「Google Drive で共有する」を参照。
 * shared.gs（npm run build:gas で生成）と一緒に貼り付けること。
 */

const DOC_FILE = '資料.md';
const META_FILE = 'meta.json';
const INDEX_FILE = 'index.json';
// 失敗談とクイズは資料フォルダの中に別ファイルで置く。
// index.json に混ぜると全資料分を毎回読むことになり、Driveから直接読むときも邪魔になるため。
const FAILURES_FILE = '失敗談.json';
const QUIZ_FILE = 'クイズ.json';

/*
 * 失敗談を集めるGoogleフォーム。
 * 回答はスプレッドシートに溜まり、そこから各資料の 失敗談.json に取り込まれ、クイズの出題源になる。
 * 質問文は「取り込みのときに列を見つける鍵」でもあるので、Apps Script側で勝手に変えないこと
 * （フォームの文言を変えたい場合はここを直してから setupForm を実行しなおす）。
 */
const FORM_TITLE = '失敗談ボックス';
const Q_TARGET = 'どの作業・プロトコルの失敗ですか？';
const Q_WHAT = '何が起きましたか？';
const Q_WHY = 'なぜ起きたと思いますか？';
const Q_PREVENT = 'どうすれば防げますか？';
const Q_AUTHOR = 'お名前（任意）';
const SYNC_COLUMN = '取り込み';
const TARGET_NONE = '（まだ決まっていない・あとで仕分ける）';
const MAX_FILES_GAS = 12;
const MAX_FILE_SIZE_GAS = 25 * 1024 * 1024; // base64で送る都合上の上限。超えるものはDriveに置いてURLで添付する
const VISION_TYPES_GAS = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

function props_() {
  return PropertiesService.getScriptProperties();
}

function prop_(key, fallback) {
  const value = props_().getProperty(key);
  return value === null || value === '' ? fallback : value;
}

/* ========== 入口 ========== */

function doGet(e) {
  return handle_((e && e.parameter) || {});
}

function doPost(e) {
  let request = {};
  try {
    request = JSON.parse((e && e.postData && e.postData.contents) || '{}');
  } catch (err) {
    return json_({ error: 'リクエストの形式が不正です' });
  }
  return handle_(request);
}

function handle_(request) {
  try {
    const action = String(request.action || 'config');
    const required = prop_('ACCESS_TOKEN', '');
    if (required && action !== 'config' && String(request.token || '') !== required) {
      return json_({ error: '合言葉（アクセストークン）が違います' });
    }

    switch (action) {
      case 'config':
        return json_(configPayload_());
      case 'list':
        return json_(listDocuments_(request));
      case 'get':
        return json_({ document: mustGetDocument_(request.id) });
      case 'prompt':
        return json_({
          prompt: buildDocumentPrompt({
            title: request.title || '',
            memo: request.memo || '',
            author: request.author || '',
            tags: parseTags_(request.tags),
            photoNames: request.photoNames || [],
            failure: request.failure || '',
          }),
        });
      case 'quizPrompt':
        return json_({ prompt: quizPrompt_(request) });
      case 'addFailure':
        return json_({ document: withLock_(() => addFailure_(request)) });
      case 'deleteFailure':
        return json_({ document: withLock_(() => deleteFailure_(request)) });
      case 'saveQuiz':
        return json_({ document: withLock_(() => saveQuiz_(request)) });
      case 'deleteQuiz':
        return json_({ document: withLock_(() => deleteQuiz_(request)) });
      case 'importFailures':
        return json_({ document: withLock_(() => importFailures_(request)) });
      case 'syncForm':
        return json_(withLock_(() => syncFormResponses_()));
      case 'create':
        return json_({ document: withLock_(() => createDocument_(request)) });
      case 'update':
        return json_({ document: withLock_(() => updateDocument_(request)) });
      case 'reclassify':
        return json_({ document: withLock_(() => reclassifyDocument_(request)) });
      case 'delete':
        return json_(withLock_(() => deleteDocument_(request)));
      case 'rebuildIndex':
        return json_(withLock_(() => ({ total: rebuildIndex_(rootFolder_()).documents.length })));
      default:
        return json_({ error: `未知のアクション: ${action}` });
    }
  } catch (err) {
    return json_({ error: String((err && err.message) || err) });
  }
}

function json_(payload) {
  return ContentService.createTextOutput(JSON.stringify(payload)).setMimeType(ContentService.MimeType.JSON);
}

function withLock_(fn) {
  const lock = LockService.getScriptLock();
  // 同時投稿で index.json が壊れないように直列化する。
  lock.waitLock(25000);
  try {
    return fn();
  } finally {
    lock.releaseLock();
  }
}

function configPayload_() {
  return {
    aiEnabled: Boolean(prop_('ANTHROPIC_API_KEY', '')),
    model: prop_('ANTHROPIC_API_KEY', '') ? prop_('CLAUDE_MODEL', 'claude-opus-5') : null,
    categories: CATEGORIES,
    quizKinds: QUIZ_KINDS,
    quizDefaultCount: QUIZ_DEFAULT_COUNT,
    maxFiles: MAX_FILES_GAS,
    maxFileSize: MAX_FILE_SIZE_GAS,
    requiresToken: Boolean(prop_('ACCESS_TOKEN', '')),
    backend: 'gas',
    folderUrl: rootFolder_().getUrl(),
    formUrl: prop_('FORM_URL', ''),
    sheetUrl: prop_('SHEET_URL', ''),
  };
}

/* ========== Drive 上の保管場所 ========== */

function rootFolder_() {
  const id = prop_('ROOT_FOLDER_ID', '');
  if (id) return DriveApp.getFolderById(id);
  // 未設定なら作って記録する（次回以降はこのフォルダを使う）。
  const folder = DriveApp.createFolder('引継ぎ資料箱');
  props_().setProperty('ROOT_FOLDER_ID', folder.getId());
  return folder;
}

function fileByName_(folder, name) {
  const it = folder.getFilesByName(name);
  return it.hasNext() ? it.next() : null;
}

function writeTextFile_(folder, name, text, mime) {
  const existing = fileByName_(folder, name);
  if (existing) {
    existing.setContent(text);
    return existing;
  }
  return folder.createFile(Utilities.newBlob(text, mime || 'text/plain', name));
}

function readIndex_(root) {
  const file = fileByName_(root, INDEX_FILE);
  if (!file) return rebuildIndex_(root);
  try {
    const parsed = JSON.parse(file.getBlob().getDataAsString('UTF-8'));
    if (!parsed || !Array.isArray(parsed.documents)) return rebuildIndex_(root);
    return parsed;
  } catch (err) {
    // 壊れていたらフォルダを走査して作り直す（資料そのものはDriveに残っている）。
    return rebuildIndex_(root);
  }
}

function writeIndex_(root, index) {
  writeTextFile_(root, INDEX_FILE, JSON.stringify(index, null, 2), 'application/json');
  return index;
}

/** 各資料フォルダの meta.json を読み直して index.json を作り直す。 */
function rebuildIndex_(root) {
  const documents = [];
  const folders = root.getFolders();
  while (folders.hasNext()) {
    const folder = folders.next();
    const metaFile = fileByName_(folder, META_FILE);
    if (!metaFile) continue;
    try {
      documents.push(JSON.parse(metaFile.getBlob().getDataAsString('UTF-8')));
    } catch (err) {
      // 壊れた meta.json は飛ばす
    }
  }
  documents.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  return writeIndex_(root, { documents });
}

function folderName_(title, id) {
  const safe = String(title || '無題の資料')
    .replace(/[\\/:*?"<>|]/g, '_')
    .slice(0, 60)
    .trim();
  return `${safe}__${id}`;
}

/* ========== 資料の読み書き ========== */

function metaOf_(id) {
  const root = rootFolder_();
  const index = readIndex_(root);
  const meta = index.documents.find((d) => d.id === id);
  if (!meta) throw new Error('資料が見つかりません');
  return { root, index, meta };
}

function readJson_(folder, name, fallback) {
  const file = fileByName_(folder, name);
  if (!file) return fallback;
  try {
    return JSON.parse(file.getBlob().getDataAsString('UTF-8'));
  } catch (err) {
    return fallback; // 壊れていても資料本体は開けるようにする
  }
}

function readFailures_(folder) {
  const parsed = readJson_(folder, FAILURES_FILE, null);
  if (!parsed) return [];
  return Array.isArray(parsed) ? parsed : Array.isArray(parsed.failures) ? parsed.failures : [];
}

function readQuiz_(folder) {
  const parsed = readJson_(folder, QUIZ_FILE, null);
  return parsed && Array.isArray(parsed.questions) && parsed.questions.length ? parsed : null;
}

function writeFailures_(folder, failures) {
  writeTextFile_(folder, FAILURES_FILE, JSON.stringify({ failures: failures }, null, 2), 'application/json');
}

function mustGetDocument_(id) {
  const { meta } = metaOf_(String(id || ''));
  const folder = DriveApp.getFolderById(meta.folderId);
  const docFile = fileByName_(folder, DOC_FILE);
  return Object.assign({}, meta, {
    body: docFile ? docFile.getBlob().getDataAsString('UTF-8') : '',
    failures: readFailures_(folder),
    quiz: readQuiz_(folder),
  });
}

function listDocuments_(request) {
  const root = rootFolder_();
  const all = readIndex_(root).documents;
  const needle = String(request.q || '').trim().toLowerCase();
  const category = String(request.category || '');
  const tag = String(request.tag || '').toLowerCase();
  const sort = String(request.sort || 'new');

  let documents = all.slice();
  if (category) documents = documents.filter((d) => d.category === category);
  if (tag) documents = documents.filter((d) => (d.tags || []).some((t) => String(t).toLowerCase() === tag));
  if (needle) {
    documents = documents.filter((d) =>
      [d.title, d.summary, d.memo, d.author, (d.tags || []).join(' '), (d.attachments || []).map((a) => a.name).join(' ')]
        .join('\n')
        .toLowerCase()
        .includes(needle),
    );
  }

  documents.sort((a, b) => {
    if (sort === 'old') return String(a.createdAt).localeCompare(String(b.createdAt));
    if (sort === 'title') return String(a.title).localeCompare(String(b.title), 'ja');
    return String(b.createdAt).localeCompare(String(a.createdAt));
  });
  documents = documents.filter((d) => d.pinned).concat(documents.filter((d) => !d.pinned));

  const counts = {};
  CATEGORIES.forEach((c) => {
    counts[c.id] = 0;
  });
  all.forEach((d) => {
    counts[d.category] = (counts[d.category] || 0) + 1;
  });

  return {
    documents: documents.map((d) =>
      Object.assign({}, d, {
        excerpt: d.summary || '',
        // サーバー版の quizSummaryOf() と同じ形にそろえる（app.js が両方を区別せずに扱えるように）。
        quiz: d.quizCount
          ? { count: d.quizCount, generatedBy: d.quizBy || 'manual', createdAt: d.quizAt || '' }
          : null,
        failureCount: d.failureCount || 0,
      }),
    ),
    counts,
    total: all.length,
  };
}

function parseTags_(raw) {
  if (Array.isArray(raw)) return raw.map((t) => String(t).trim()).filter(Boolean);
  return String(raw || '')
    .split(/[,、\s]+/)
    .map((t) => t.trim())
    .filter(Boolean);
}

function saveAttachments_(folder, files) {
  const attachments = [];
  (files || []).slice(0, MAX_FILES_GAS).forEach((file) => {
    const bytes = Utilities.base64Decode(String(file.data || ''));
    if (bytes.length > MAX_FILE_SIZE_GAS) {
      throw new Error(
        `${file.name} が大きすぎます（1件あたり${Math.round(MAX_FILE_SIZE_GAS / 1024 / 1024)}MBまで）。` +
          'Driveに置いて「Driveのファイルを添付」からURLで追加してください。',
      );
    }
    const mime = String(file.mime || 'application/octet-stream');
    const blob = Utilities.newBlob(bytes, mime, String(file.name || 'file'));
    const created = folder.createFile(blob);
    if (String(prop_('PUBLIC_FILES', 'false')) === 'true') {
      // サムネイルを誰にでも表示したい場合のみ。既定はフォルダの共有設定を継承する。
      created.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    }
    const id = created.getId();
    const isImage = mime.indexOf('image/') === 0;
    attachments.push({
      id: id,
      name: created.getName(),
      url: `https://drive.google.com/file/d/${id}/view`,
      thumbUrl: isImage ? `https://drive.google.com/thumbnail?id=${id}&sz=w800` : '',
      mime: mime,
      size: bytes.length,
      isImage: isImage,
    });
  });
  return attachments;
}

/**
 * すでにDrive上にあるファイルを、アップロードせずに添付する。
 * base64で送れないサイズ（大きなPDF・スライド・動画）はこちらを使う。
 */
function resolveDriveFiles_(ids) {
  const resolved = [];
  (ids || []).slice(0, MAX_FILES_GAS).forEach((rawId) => {
    const id = String(rawId || '').trim();
    if (!id) return;
    let file;
    try {
      file = DriveApp.getFileById(id);
    } catch (err) {
      throw new Error('Driveのファイルを開けませんでした。IDと共有設定を確認してください: ' + id);
    }
    const mime = file.getMimeType();
    resolved.push({
      id: id,
      name: file.getName(),
      url: 'https://drive.google.com/file/d/' + id + '/view',
      thumbUrl: 'https://drive.google.com/thumbnail?id=' + id + '&sz=w800',
      mime: mime,
      size: file.getSize(),
      isImage: mime.indexOf('image/') === 0,
      linked: true, // 実体はこの資料フォルダの外にある
    });
  });
  return resolved;
}

/** 資料フォルダにショートカットを置いてDriveから辿れるようにする（失敗してもリンクは残る）。 */
function linkDriveFiles_(folder, resolved) {
  resolved.forEach((meta) => {
    try {
      DriveApp.createShortcut(meta.id).moveTo(folder);
    } catch (err) {
      console.warn('ショートカットを作成できませんでした: ' + meta.id + ' / ' + err);
    }
  });
}

function createDocument_(request) {
  const root = rootFolder_();
  const mode = request.mode === 'ai' ? 'ai' : 'manual';
  const title = String(request.title || '').trim();
  const memo = String(request.memo || '').trim();
  const author = String(request.author || '').trim();
  const inputTags = parseTags_(request.tags);
  const requested = String(request.category || '').trim();
  const files = request.files || [];
  const linkedFiles = resolveDriveFiles_(request.driveFiles);
  const writtenBody = String(request.body || '').trim();
  const failureNote = String(request.failure || '').trim();

  if (mode === 'ai' && !memo) throw new Error('引継ぎメモを入力してください');
  if (mode === 'manual' && !writtenBody && !memo && files.length === 0 && linkedFiles.length === 0) {
    throw new Error('本文かファイルのどちらかは必要です');
  }

  const body =
    mode === 'ai' ? generateDocumentGas_(title, memo, author, inputTags, files, failureNote) : writtenBody || memo;
  const fileNames = files.map((f) => String(f.name || '')).concat(linkedFiles.map((f) => f.name));
  const known = CATEGORIES.some((c) => c.id === requested);
  const classification = known
    ? { category: requested, tags: [], summary: excerptOf(body), confidence: 1, classifiedBy: 'manual' }
    : autoClassifyGas_({ title: title, body: body, extra: memo, fileNames: fileNames, tags: inputTags, files: files });

  const id = Utilities.getUuid().replace(/-/g, '').slice(0, 12);
  const hasWrittenBody = Boolean(writtenBody) || mode === 'ai';
  const fallbackTitle = hasWrittenBody ? deriveTitle(body) : fileNames[0] || deriveTitle(body);
  const finalTitle = title || fallbackTitle || '無題の資料';

  const folder = root.createFolder(folderName_(finalTitle, id));
  linkDriveFiles_(folder, linkedFiles);
  const attachments = saveAttachments_(folder, files).concat(linkedFiles);
  writeTextFile_(folder, DOC_FILE, body, 'text/markdown');

  const now = new Date().toISOString();
  const tags = [];
  inputTags.concat(classification.tags || []).forEach((t) => {
    if (t && tags.indexOf(t) === -1) tags.push(t);
  });

  const meta = {
    id: id,
    title: finalTitle,
    memo: memo,
    summary: classification.summary || excerptOf(body),
    category: classification.category || 'other',
    confidence: classification.confidence,
    classifiedBy: classification.classifiedBy,
    tags: tags.slice(0, 10),
    attachments: attachments,
    source: mode === 'ai' ? 'ai' : (files.length || linkedFiles.length) && !hasWrittenBody ? 'upload' : 'manual',
    author: author,
    pinned: false,
    createdAt: now,
    updatedAt: now,
    folderId: folder.getId(),
    folderUrl: folder.getUrl(),
    failureCount: 0,
    quizCount: 0,
  };

  // 作成時に書かれた失敗談は、そのまま1件目としてぶら下げる（あとでクイズの出題源になる）。
  const failures = failureNote
    ? [normalizeFailure({ what: failureNote, author: author }, Utilities.getUuid().slice(0, 8), now)]
    : [];
  if (failures.length) {
    writeFailures_(folder, failures);
    meta.failureCount = failures.length;
  }
  writeTextFile_(folder, META_FILE, JSON.stringify(meta, null, 2), 'application/json');

  const index = readIndex_(root);
  // index.json が無い状態で作られた場合、再構築で同じ資料が既に入っていることがある。
  index.documents = [meta].concat(index.documents.filter((d) => d.id !== meta.id));
  writeIndex_(root, index);
  syncFormChoicesQuietly_();

  return Object.assign({}, meta, { body: body, failures: failures, quiz: null });
}

function persistMeta_(root, index, meta, folder, body) {
  writeTextFile_(folder, META_FILE, JSON.stringify(meta, null, 2), 'application/json');
  if (typeof body === 'string') writeTextFile_(folder, DOC_FILE, body, 'text/markdown');
  const position = index.documents.findIndex((d) => d.id === meta.id);
  if (position === -1) index.documents.unshift(meta);
  else index.documents[position] = meta;
  writeIndex_(root, index);
}

function updateDocument_(request) {
  const { root, index, meta } = metaOf_(String(request.id || ''));
  const folder = DriveApp.getFolderById(meta.folderId);
  const patch = request.patch || {};
  let body;

  if (typeof patch.title === 'string' && patch.title.trim()) {
    meta.title = patch.title.trim();
    folder.setName(folderName_(meta.title, meta.id));
  }
  if (typeof patch.body === 'string') body = patch.body;
  if (typeof patch.summary === 'string') meta.summary = patch.summary.trim();
  if (typeof patch.pinned === 'boolean') meta.pinned = patch.pinned;
  if (patch.tags !== undefined) meta.tags = parseTags_(patch.tags).slice(0, 10);
  if (typeof patch.category === 'string' && CATEGORIES.some((c) => c.id === patch.category)) {
    meta.category = patch.category;
    meta.classifiedBy = 'manual';
    meta.confidence = 1;
  }
  meta.updatedAt = new Date().toISOString();
  persistMeta_(root, index, meta, folder, body);

  const docFile = fileByName_(folder, DOC_FILE);
  return Object.assign({}, meta, {
    body: typeof body === 'string' ? body : docFile ? docFile.getBlob().getDataAsString('UTF-8') : '',
    failures: readFailures_(folder),
    quiz: readQuiz_(folder),
  });
}

function reclassifyDocument_(request) {
  const { root, index, meta } = metaOf_(String(request.id || ''));
  const folder = DriveApp.getFolderById(meta.folderId);
  const docFile = fileByName_(folder, DOC_FILE);
  const body = docFile ? docFile.getBlob().getDataAsString('UTF-8') : '';

  const result = autoClassifyGas_({
    title: meta.title,
    body: body,
    extra: meta.memo || '',
    fileNames: (meta.attachments || []).map((a) => a.name),
    tags: meta.tags || [],
    files: [],
  });

  meta.category = result.category;
  meta.confidence = result.confidence;
  meta.classifiedBy = result.classifiedBy;
  meta.summary = result.summary || meta.summary;
  const tags = (meta.tags || []).slice();
  (result.tags || []).forEach((t) => {
    if (t && tags.indexOf(t) === -1) tags.push(t);
  });
  meta.tags = tags.slice(0, 10);
  meta.updatedAt = new Date().toISOString();

  persistMeta_(root, index, meta, folder);
  return Object.assign({}, meta, { body: body, failures: readFailures_(folder), quiz: readQuiz_(folder) });
}

function deleteDocument_(request) {
  const { root, index, meta } = metaOf_(String(request.id || ''));
  DriveApp.getFolderById(meta.folderId).setTrashed(true);
  index.documents = index.documents.filter((d) => d.id !== meta.id);
  writeIndex_(root, index);
  syncFormChoicesQuietly_();
  return { ok: true };
}

/* ========== 失敗談とクイズ ==========
 * 「なぜそうするのか」は、たいてい誰かが失敗した記憶として残っている。
 * 失敗談を資料の隣に短く積み、それを出題源にしてクイズを作る。
 */

function touchMeta_(root, index, meta, folder) {
  meta.updatedAt = new Date().toISOString();
  persistMeta_(root, index, meta, folder);
}

function documentPayload_(meta, folder) {
  const docFile = fileByName_(folder, DOC_FILE);
  return Object.assign({}, meta, {
    body: docFile ? docFile.getBlob().getDataAsString('UTF-8') : '',
    failures: readFailures_(folder),
    quiz: readQuiz_(folder),
  });
}

function addFailure_(request) {
  const { root, index, meta } = metaOf_(String(request.id || ''));
  const folder = DriveApp.getFolderById(meta.folderId);
  const what = String((request.failure && request.failure.what) || '').trim();
  if (!what) throw new Error('何が起きたかを入力してください');

  const failures = readFailures_(folder);
  if (failures.length >= MAX_FAILURES) {
    throw new Error('失敗談は1つの資料につき' + MAX_FAILURES + '件までです');
  }
  failures.push(
    normalizeFailure(
      Object.assign({}, request.failure, { what: what }),
      Utilities.getUuid().slice(0, 8),
      new Date().toISOString(),
    ),
  );
  writeFailures_(folder, failures);
  meta.failureCount = failures.length;
  touchMeta_(root, index, meta, folder);
  return documentPayload_(meta, folder);
}

function deleteFailure_(request) {
  const { root, index, meta } = metaOf_(String(request.id || ''));
  const folder = DriveApp.getFolderById(meta.folderId);
  const failureId = String(request.failureId || '');
  const failures = readFailures_(folder).filter((f) => f.id !== failureId);
  writeFailures_(folder, failures);
  meta.failureCount = failures.length;
  touchMeta_(root, index, meta, folder);
  return documentPayload_(meta, folder);
}

function quizPrompt_(request) {
  const doc = mustGetDocument_(String(request.id || ''));
  return buildQuizPrompt({
    title: doc.title,
    body: doc.body || '',
    failures: doc.failures || [],
    count: clampQuestionCount(request.count),
    focus: String(request.focus || '').trim(),
  });
}

/**
 * クイズの保存。
 *  - request.quiz / request.json があれば、それを取り込む（手持ちのAIの出力を貼り付けた場合）
 *  - 無ければ Claude に作らせる
 */
function saveQuiz_(request) {
  const { root, index, meta } = metaOf_(String(request.id || ''));
  const folder = DriveApp.getFolderById(meta.folderId);
  const docFile = fileByName_(folder, DOC_FILE);
  const body = docFile ? docFile.getBlob().getDataAsString('UTF-8') : '';
  const pasted = request.quiz || (String(request.json || '').trim() ? parseQuizJson(request.json) : null);

  let quiz;
  if (pasted) {
    quiz = normalizeQuiz(pasted, { generatedBy: 'manual' });
  } else {
    if (!body.trim()) throw new Error('本文が空の資料からはクイズを作れません');
    quiz = generateQuizGas_({
      title: meta.title,
      body: body,
      failures: readFailures_(folder),
      count: clampQuestionCount(request.count),
      focus: String(request.focus || '').trim(),
    });
  }

  writeTextFile_(folder, QUIZ_FILE, JSON.stringify(quiz, null, 2), 'application/json');
  meta.quizCount = quiz.questions.length;
  meta.quizBy = quiz.generatedBy;
  meta.quizAt = quiz.createdAt;
  touchMeta_(root, index, meta, folder);
  return documentPayload_(meta, folder);
}

function deleteQuiz_(request) {
  const { root, index, meta } = metaOf_(String(request.id || ''));
  const folder = DriveApp.getFolderById(meta.folderId);
  const file = fileByName_(folder, QUIZ_FILE);
  if (file) file.setTrashed(true);
  meta.quizCount = 0;
  meta.quizBy = '';
  meta.quizAt = '';
  touchMeta_(root, index, meta, folder);
  return documentPayload_(meta, folder);
}

/* ========== 失敗談を集めるGoogleフォーム ==========
 * 「教える時間が無い」ことが根っこなので、書き手の負担を1分以下にする。
 * フォーム → スプレッドシート → 各資料の失敗談 → クイズ、という一方向の流れだけを作る。
 */

function formTargetLabel_(meta) {
  // 資料名が変わっても対応づけが切れないよう、選択肢に資料IDを埋め込む。
  return String(meta.title || '無題の資料') + ' #' + meta.id;
}

function targetIdFrom_(answer) {
  const match = String(answer || '').match(/#([0-9a-zA-Z]+)\s*$/);
  return match ? match[1] : '';
}

function formTargetChoices_(root) {
  const documents = readIndex_(root).documents;
  const choices = documents.map(formTargetLabel_);
  choices.push(TARGET_NONE);
  return choices;
}

function findFormItem_(form, title) {
  const items = form.getItems();
  for (let i = 0; i < items.length; i += 1) {
    if (items[i].getTitle() === title) return items[i];
  }
  return null;
}

/** フォームの「どの作業か」の選択肢を、いまの資料一覧に合わせて作り直す。 */
function refreshFormTargets_(form) {
  const item = findFormItem_(form, Q_TARGET);
  if (!item) return 0;
  const choices = formTargetChoices_(rootFolder_());
  item.asListItem().setChoiceValues(choices);
  return choices.length;
}

function openForm_() {
  const id = prop_('FORM_ID', '');
  if (!id) throw new Error('失敗談フォームがまだありません。Apps Scriptのエディタで setupForm を1回実行してください。');
  return FormApp.openById(id);
}

/**
 * 失敗談フォームと回答スプレッドシートを作る（最初に1回だけエディタから実行する）。
 * すでにある場合は選択肢の作り直しだけを行う。
 */
function setupForm() {
  const root = rootFolder_();
  let form;
  if (prop_('FORM_ID', '')) {
    form = openForm_();
  } else {
    form = FormApp.create(FORM_TITLE);
    form.setDescription(
      'うまくいかなかったことを、覚えているうちに1つだけ書いてください。\n' +
        '書いた失敗は、後輩が解くクイズになります。犯人探しには使いません。',
    );
    form.addListItem().setTitle(Q_TARGET).setRequired(true);
    form.addParagraphTextItem().setTitle(Q_WHAT).setHelpText('起きたことだけを短く。例: 形質転換のコロニーが1つも生えなかった').setRequired(true);
    form.addParagraphTextItem().setTitle(Q_WHY).setHelpText('分かる範囲で。例: コンピテントセルを氷から出したまま置いてしまった');
    form.addParagraphTextItem().setTitle(Q_PREVENT).setHelpText('次の人が同じ失敗をしないために');
    form.addTextItem().setTitle(Q_AUTHOR);

    const sheet = SpreadsheetApp.create(FORM_TITLE + 'の回答');
    form.setDestination(FormApp.DestinationType.SPREADSHEET, sheet.getId());
    DriveApp.getFileById(sheet.getId()).moveTo(root);
    DriveApp.getFileById(form.getId()).moveTo(root);

    props_().setProperty('FORM_ID', form.getId());
    props_().setProperty('FORM_URL', form.getPublishedUrl());
    props_().setProperty('SHEET_ID', sheet.getId());
    props_().setProperty('SHEET_URL', sheet.getUrl());
    installFormTrigger_(form);
  }

  const count = refreshFormTargets_(form);
  console.log('フォーム（回答用）: ' + prop_('FORM_URL', ''));
  console.log('回答スプレッドシート: ' + prop_('SHEET_URL', ''));
  console.log('選択肢に載せた資料: ' + Math.max(count - 1, 0) + '件');
  return { formUrl: prop_('FORM_URL', ''), sheetUrl: prop_('SHEET_URL', '') };
}

/** 回答が入るたびに取り込むトリガー（同じものを二重に付けない）。 */
function installFormTrigger_(form) {
  const existing = ScriptApp.getProjectTriggers();
  for (let i = 0; i < existing.length; i += 1) {
    if (existing[i].getHandlerFunction() === 'onFailureFormSubmit') return;
  }
  ScriptApp.newTrigger('onFailureFormSubmit').forForm(form).onFormSubmit().create();
}

/** フォーム送信時に呼ばれる（トリガー）。失敗しても回答はシートに残る。 */
function onFailureFormSubmit() {
  try {
    withLock_(syncFormResponses_);
  } catch (err) {
    console.warn('失敗談の取り込みに失敗しました: ' + err);
  }
}

function responseSheet_() {
  const id = prop_('SHEET_ID', '');
  if (!id) throw new Error('回答スプレッドシートがまだありません。setupForm を実行してください。');
  return SpreadsheetApp.openById(id).getSheets()[0];
}

function columnIndexOf_(header, title) {
  for (let i = 0; i < header.length; i += 1) {
    if (String(header[i]).indexOf(title) === 0) return i;
  }
  return -1;
}

/**
 * スプレッドシートの未取り込みの回答を、各資料の失敗談に流し込む。
 * 取り込んだ行にはシート上で印を付けるので、何度実行しても二重に入らない。
 */
function syncFormResponses_() {
  const sheet = responseSheet_();
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return { imported: 0, unmatched: 0, total: 0 };

  const width = Math.max(sheet.getLastColumn(), 1);
  const header = sheet.getRange(1, 1, 1, width).getValues()[0];
  let statusCol = columnIndexOf_(header, SYNC_COLUMN);
  if (statusCol === -1) {
    statusCol = width;
    sheet.getRange(1, statusCol + 1).setValue(SYNC_COLUMN);
  }

  const cols = {
    target: columnIndexOf_(header, Q_TARGET),
    what: columnIndexOf_(header, Q_WHAT),
    why: columnIndexOf_(header, Q_WHY),
    prevention: columnIndexOf_(header, Q_PREVENT),
    author: columnIndexOf_(header, Q_AUTHOR),
  };
  if (cols.what === -1) throw new Error('回答シートに「' + Q_WHAT + '」の列が見つかりません');

  const rows = sheet.getRange(2, 1, lastRow - 1, Math.max(width, statusCol + 1)).getValues();
  const root = rootFolder_();
  const index = readIndex_(root);
  const touched = {};
  const stamp = new Date().toISOString().slice(0, 10);
  let imported = 0;
  let unmatched = 0;

  const cell = (row, col) => (col === -1 ? '' : String(row[col] === undefined ? '' : row[col]).trim());

  for (let i = 0; i < rows.length; i += 1) {
    const row = rows[i];
    if (String(row[statusCol] || '').trim()) continue; // 取り込み済み
    const what = cell(row, cols.what);
    if (!what) continue;

    const docId = targetIdFrom_(cell(row, cols.target));
    const meta = docId ? index.documents.find((d) => d.id === docId) : null;
    if (!meta) {
      sheet.getRange(i + 2, statusCol + 1).setValue('未仕分け');
      unmatched += 1;
      continue;
    }

    const folder = DriveApp.getFolderById(meta.folderId);
    const failures = readFailures_(folder);
    failures.push(
      normalizeFailure(
        {
          what: what,
          why: cell(row, cols.why),
          prevention: cell(row, cols.prevention),
          author: cell(row, cols.author),
        },
        'form' + Utilities.getUuid().slice(0, 6),
        new Date().toISOString(),
      ),
    );
    writeFailures_(folder, failures);
    meta.failureCount = failures.length;
    meta.updatedAt = new Date().toISOString();
    writeTextFile_(folder, META_FILE, JSON.stringify(meta, null, 2), 'application/json');
    touched[meta.id] = true;
    sheet.getRange(i + 2, statusCol + 1).setValue('取り込み済み ' + stamp);
    imported += 1;
  }

  if (imported) writeIndex_(root, index);
  return { imported: imported, unmatched: unmatched, total: lastRow - 1 };
}

/** 資料が増減したらフォームの選択肢も合わせる（作成・削除のたびに呼ぶ）。 */
function syncFormChoicesQuietly_() {
  if (!prop_('FORM_ID', '')) return;
  try {
    refreshFormTargets_(openForm_());
  } catch (err) {
    console.warn('フォームの選択肢を更新できませんでした: ' + err);
  }
}

/** 表（スプレッドシートからのコピー）を1つの資料の失敗談として取り込む。 */
function importFailures_(request) {
  const { root, index, meta } = metaOf_(String(request.id || ''));
  const folder = DriveApp.getFolderById(meta.folderId);
  const rows = Array.isArray(request.rows) ? request.rows : parseFailureRows(request.text || '');
  if (!rows.length) throw new Error('取り込める行がありませんでした（1列目に「何が起きたか」が必要です）');

  const failures = readFailures_(folder);
  const room = MAX_FAILURES - failures.length;
  if (room <= 0) throw new Error('失敗談は1つの資料につき' + MAX_FAILURES + '件までです');

  const now = new Date().toISOString();
  rows.slice(0, room).forEach((row) => {
    if (!String(row.what || '').trim()) return;
    failures.push(normalizeFailure(row, 'imp' + Utilities.getUuid().slice(0, 6), now));
  });
  writeFailures_(folder, failures);
  meta.failureCount = failures.length;
  touchMeta_(root, index, meta, folder);
  return documentPayload_(meta, folder);
}

/* ========== Claude API（キーはスクリプトプロパティに置く） ========== */

function callClaude_(payload) {
  const key = prop_('ANTHROPIC_API_KEY', '');
  if (!key) throw new Error('ANTHROPIC_API_KEY が未設定です（プロンプト出力モードのみ利用できます）');

  const request = function (withFallback) {
    const headers = { 'x-api-key': key, 'anthropic-version': '2023-06-01' };
    const body = Object.assign({}, payload);
    if (withFallback) {
      headers['anthropic-beta'] = 'server-side-fallback-2026-07-01';
      body.fallbacks = 'default';
    }
    return UrlFetchApp.fetch('https://api.anthropic.com/v1/messages', {
      method: 'post',
      contentType: 'application/json',
      headers: headers,
      payload: JSON.stringify(body),
      muteHttpExceptions: true,
    });
  };

  let response = request(true);
  if (response.getResponseCode() === 400 && /fallback|beta/i.test(response.getContentText())) {
    response = request(false); // フォールバック指定を解釈しない場合は素のリクエストで再試行
  }

  const code = response.getResponseCode();
  const parsed = JSON.parse(response.getContentText());
  if (code >= 400) {
    throw new Error(`Claude API エラー (${code}): ${(parsed.error && parsed.error.message) || ''}`);
  }
  if (parsed.stop_reason === 'refusal') {
    throw new Error('AIが生成を拒否しました。メモの内容を見直してください。');
  }
  return (parsed.content || [])
    .filter((block) => block.type === 'text')
    .map((block) => block.text)
    .join('\n')
    .trim();
}

/** 添付画像をVision入力に変換する（ブラウザから届いたbase64をそのまま使う）。 */
function imageBlocksGas_(files) {
  const blocks = [];
  const names = [];
  (files || []).forEach((file) => {
    if (names.length >= 6) return;
    const mime = String(file.mime || '');
    if (VISION_TYPES_GAS.indexOf(mime) === -1) return;
    const data = String(file.data || '');
    if (data.length > 5.4 * 1024 * 1024) return; // base64で約4MB超はスキップ
    names.push(String(file.name || ''));
    blocks.push({ type: 'text', text: `写真${names.length}: ${file.name}` });
    blocks.push({ type: 'image', source: { type: 'base64', media_type: mime, data: data } });
  });
  return { blocks: blocks, names: names };
}

function generateDocumentGas_(title, memo, author, tags, files, failure) {
  const images = imageBlocksGas_(files);
  const prompt = buildDocumentPrompt({
    title: title,
    memo: memo,
    author: author,
    tags: tags,
    photoNames: images.names,
    failure: failure || '',
  });
  // Apps Script の外部リクエストには時間制限があるため、既定は effort=low。
  const text = callClaude_({
    model: prop_('CLAUDE_MODEL', 'claude-opus-5'),
    max_tokens: 8000,
    system: DOC_SYSTEM_PROMPT,
    thinking: { type: 'adaptive' },
    output_config: { effort: prop_('CLAUDE_EFFORT', 'low') },
    messages: [{ role: 'user', content: images.blocks.concat([{ type: 'text', text: prompt }]) }],
  });
  const fence = text.match(/^```(?:markdown|md)?\s*\n([\s\S]*?)\n```$/);
  return fence ? fence[1].trim() : text;
}

/** プロトコル資料（＋失敗談）から4択クイズを作る。 */
function generateQuizGas_(input) {
  const prompt = buildQuizPrompt({
    title: input.title,
    body: input.body,
    failures: input.failures,
    count: input.count,
    focus: input.focus,
  });
  const text = callClaude_({
    model: prop_('CLAUDE_MODEL', 'claude-opus-5'),
    max_tokens: 8000,
    system: QUIZ_SYSTEM_PROMPT,
    // Apps Script の外部リクエストには時間制限があるため、既定は effort=low。
    output_config: { effort: prop_('CLAUDE_EFFORT', 'low'), format: { type: 'json_schema', schema: QUIZ_SCHEMA } },
    messages: [{ role: 'user', content: [{ type: 'text', text: prompt }] }],
  });
  return normalizeQuiz(parseQuizJson(text), {
    generatedBy: 'ai',
    model: prop_('CLAUDE_MODEL', 'claude-opus-5'),
  });
}

function classifyWithClaude_(input) {
  const useImages = String(input.body || '').concat(input.extra || '').trim().length < 200;
  const images = useImages ? imageBlocksGas_(input.files).blocks : [];
  const prompt = buildClassifyPrompt({
    title: input.title,
    body: input.body,
    extra: input.extra,
    fileNames: input.fileNames,
    tags: input.tags,
  });
  const text = callClaude_({
    model: prop_('CLAUDE_MODEL', 'claude-opus-5'),
    max_tokens: 2000,
    system: CLASSIFY_SYSTEM_PROMPT,
    output_config: { effort: 'low', format: { type: 'json_schema', schema: CLASSIFY_SCHEMA } },
    messages: [{ role: 'user', content: images.concat([{ type: 'text', text: prompt }]) }],
  });
  const parsed = JSON.parse(text);
  return {
    category: parsed.category,
    tags: parsed.tags || [],
    summary: String(parsed.summary || ''),
    confidence: Number(parsed.confidence),
  };
}

/** AIが使えればAIで、使えない・失敗したらキーワードで分類する。 */
function autoClassifyGas_(input) {
  if (prop_('ANTHROPIC_API_KEY', '')) {
    try {
      const result = classifyWithClaude_(input);
      if (CATEGORIES.some((c) => c.id === result.category)) {
        return Object.assign(result, { classifiedBy: 'ai' });
      }
    } catch (err) {
      console.warn('AI分類に失敗したためキーワード分類に切り替えます: ' + err);
    }
  }
  return Object.assign(classifyByRules(input), { classifiedBy: 'rule' });
}

/* ========== 動作確認用（Apps Scriptのエディタから実行する） ========== */

function setup() {
  const folder = rootFolder_();
  const index = rebuildIndex_(folder);
  console.log('保管フォルダ: ' + folder.getUrl());
  console.log('登録済みの資料: ' + index.documents.length + '件');
  console.log('AI: ' + (prop_('ANTHROPIC_API_KEY', '') ? '有効 (' + prop_('CLAUDE_MODEL', 'claude-opus-5') + ')' : '未設定'));
  console.log(
    prop_('FORM_URL', '')
      ? '失敗談フォーム: ' + prop_('FORM_URL', '')
      : '失敗談フォーム: 未作成（setupForm を実行すると作られます）',
  );
}
