/*
 * 保存先の違いを吸収する層。
 *   - サーバー版  : 同じオリジンの Express (/api/...) に FormData で送る
 *   - Drive版     : Google Apps Script のURLに JSON で送る（GitHub Pages 等から利用）
 * app.js はこのファイルの関数だけを使う。
 */
(function () {
  const LS_URL = 'hikitsugi.gasUrl';
  const LS_TOKEN = 'hikitsugi.gasToken';
  const DEFAULTS = window.HIKITSUGI_CONFIG || {};

  // ?api=<Apps ScriptのURL> で渡された場合は保存して以後そのまま使う。
  const fromQuery = new URLSearchParams(location.search).get('api');
  if (fromQuery) localStorage.setItem(LS_URL, fromQuery.trim());

  // 手元で `npm start` したときは config.js の既定値より同じオリジンのサーバーを優先する
  // （公開ページでは既定値＝研究室の資料箱がそのまま使われる）。
  const isDevHost = ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname);
  const endpoint = () => localStorage.getItem(LS_URL) || (isDevHost ? '' : DEFAULTS.gasUrl || '');
  const token = () => localStorage.getItem(LS_TOKEN) || DEFAULTS.token || '';
  const isDrive = () => Boolean(endpoint());
  // file:// や GitHub Pages では同一オリジンのAPIが存在しない。
  const hasLocalServer = () => location.protocol === 'http:' || location.protocol === 'https:';

  function setEndpoint(url, pass) {
    if (url) localStorage.setItem(LS_URL, url.trim());
    else localStorage.removeItem(LS_URL);
    if (pass) localStorage.setItem(LS_TOKEN, pass.trim());
    else localStorage.removeItem(LS_TOKEN);
  }

  async function local(path, options = {}) {
    const res = await fetch(path, options);
    const isJson = (res.headers.get('content-type') || '').includes('application/json');
    const payload = isJson ? await res.json() : null;
    if (!res.ok) throw new Error(payload?.error || `通信に失敗しました (${res.status})`);
    return payload;
  }

  async function drive(action, payload = {}, url = null) {
    let res;
    try {
      res = await fetch(url || endpoint(), {
        method: 'POST',
        // Content-Type を付けると事前リクエスト(preflight)が飛び、Apps Script が応答できない。
        body: JSON.stringify(Object.assign({ action, token: token() }, payload)),
        redirect: 'follow',
      });
    } catch (err) {
      throw new Error('Google Apps Script に接続できません。URLと公開設定（アクセスできるユーザー: 全員）を確認してください。');
    }
    const text = await res.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch (err) {
      throw new Error('Apps Script から想定外の応答が返りました。ウェブアプリとして再デプロイしてください。');
    }
    if (data.error) throw new Error(data.error);
    return data;
  }

  /* ---- 添付ファイル: 写真は送信前に縮小する（元のサイズで弾かないこと） ---- */
  const MAX_DIM = 1600;
  const RESIZE_OVER = 900 * 1024;
  // 縮小されるので、写真は元ファイルが大きくても受け付ける。
  const IMAGE_PICK_LIMIT = 80 * 1024 * 1024;
  const SHRINKABLE = /^image\/(jpeg|png|webp)$/;

  function readAsBase64(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error('ファイルを読み込めませんでした'));
      reader.onload = () => resolve(String(reader.result).split(',')[1] || '');
      reader.readAsDataURL(blob);
    });
  }

  async function shrinkImage(file) {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_DIM / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.85));
    bitmap.close?.();
    return blob;
  }

  /** 送信用に整えたファイルを返す。縮小できる写真は縮小し、それ以外はそのまま。 */
  async function prepareFile(file) {
    const mime = file.type || 'application/octet-stream';
    if (!SHRINKABLE.test(mime) || file.size <= RESIZE_OVER) return file;
    try {
      const blob = await shrinkImage(file);
      const name = `${file.name.replace(/\.[^.]+$/, '')}.jpg`;
      return new File([blob], name, { type: 'image/jpeg' });
    } catch (err) {
      return file; // 縮小できなければ元のまま送る
    }
  }

  async function prepareFiles(files = []) {
    const out = [];
    for (const file of files) out.push(await prepareFile(file));
    return out;
  }

  function tooLarge(file, limit) {
    return limit && file.size > limit;
  }

  async function toPayloadFiles(files, limit) {
    const out = [];
    for (const file of await prepareFiles(files)) {
      if (tooLarge(file, limit)) {
        throw new Error(
          `${file.name} は縮小してもまだ大きすぎます（1件あたり${Math.round(limit / 1024 / 1024)}MBまで）。` +
            'Driveに直接置いて「Driveのファイルを添付」からURLで追加してください。',
        );
      }
      out.push({ name: file.name, mime: file.type || 'application/octet-stream', data: await readAsBase64(file) });
    }
    return out;
  }

  async function toFormData(input) {
    const form = new FormData();
    for (const key of ['mode', 'title', 'memo', 'tags', 'category', 'author', 'body']) {
      if (input[key] !== undefined) form.set(key, input[key]);
    }
    for (const file of await prepareFiles(input.files)) form.append('files', file);
    return form;
  }

  /** ファイル選択時に受け付けてよいサイズか（写真は縮小前提でゆるく判定する） */
  function pickLimitFor(file, maxFileSize) {
    return SHRINKABLE.test(file.type || '') ? IMAGE_PICK_LIMIT : maxFileSize;
  }

  const api = {
    isDrive,
    pickLimitFor,
    endpoint,
    setEndpoint,
    hasToken: () => Boolean(token()),

    /** 設定用: 指定URLに直接つないで確認する（保存前のテスト） */
    async test(url, pass) {
      const config = await drive('config', { token: pass || '' }, url);
      // config は合言葉なしでも通るので、保護されている資料箱では
      // トークンを検査するアクションまで試して、合言葉の誤りをここで弾く。
      if (config.requiresToken) await drive('list', { token: pass || '' }, url);
      return config;
    },

    async getConfig() {
      if (isDrive()) return Object.assign(await drive('config'), { backend: 'drive' });
      if (!hasLocalServer()) {
        throw new Error('保存先が未設定です。右上の⚙から Google Apps Script のURLを設定してください。');
      }
      return Object.assign(await local('/api/config'), { backend: 'server' });
    },

    async listDocuments(filters) {
      if (isDrive()) return drive('list', filters);
      const params = new URLSearchParams();
      for (const [key, value] of Object.entries(filters)) if (value) params.set(key, value);
      return local(`/api/documents?${params}`);
    },

    async getDocument(id) {
      if (isDrive()) return (await drive('get', { id })).document;
      return local(`/api/documents/${id}`);
    },

    async createDocument(input, limits = {}) {
      if (isDrive()) {
        const payload = Object.assign({}, input, {
          files: await toPayloadFiles(input.files, limits.maxFileSize),
          driveFiles: input.driveFiles || [],
        });
        return (await drive('create', payload)).document;
      }
      return local('/api/documents', { method: 'POST', body: await toFormData(input) });
    },

    async updateDocument(id, patch) {
      if (isDrive()) return (await drive('update', { id, patch })).document;
      return local(`/api/documents/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      });
    },

    async reclassify(id) {
      if (isDrive()) return (await drive('reclassify', { id })).document;
      return local(`/api/documents/${id}/reclassify`, { method: 'POST' });
    },

    async deleteDocument(id) {
      if (isDrive()) return drive('delete', { id });
      return local(`/api/documents/${id}`, { method: 'DELETE' });
    },

    async buildPrompt(input) {
      if (isDrive()) return (await drive('prompt', input)).prompt;
      return (
        await local('/api/prompt', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(input),
        })
      ).prompt;
    },

    /** 資料をMarkdownファイルとして保存する（どちらの保存先でも同じ動き） */
    downloadMarkdown(doc) {
      const blob = new Blob([doc.body || ''], { type: 'text/markdown;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${(doc.title || 'document').replace(/[\\/:*?"<>|]/g, '_')}.md`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    },
  };

  window.hikitsugiApi = api;
})();
