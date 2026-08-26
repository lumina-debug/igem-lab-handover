/*
 * GitHub Pages などにフロントエンドを置く場合の既定の保存先。
 * Apps Script をデプロイして得たURLをここに書いておくと、
 * 利用者は⚙から設定しなくてもすぐ使えます（画面から上書きも可能）。
 */
window.HIKITSUGI_CONFIG = {
  // 研究室の資料箱（Google Apps Script ウェブアプリ）
  gasUrl:
    'https://script.google.com/macros/s/AKfycbxP5ScPc1bsZXX37FwhYYk5Ek9FAH-NoNzd87VJQ-UuLUHHtqXv0AKnTmFA5jKPFMsq/exec',
  // 合言葉(ACCESS_TOKEN)はここに書かないこと。このファイルは公開されるため、
  // 各自が画面右上の⚙から入力し、ブラウザにだけ保存する。
  token: '',
};
