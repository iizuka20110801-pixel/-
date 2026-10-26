# 同人ビューア

ddd-smart.net の作品を読むための非公式ビューア。検索・分類・ビューア・お気に入り・履歴。

## 構成

- `server.js` — 静的配信と `/p?url=` 中継（CORS不要、広告スクリプト除去、リンク書き換え）
- `public/index.html` — アプリ本体（ビルド不要）

## Render へのデプロイ

1. このディレクトリを GitHub リポジトリに push
2. Render ダッシュボード → New → Web Service → リポジトリを選択
3. `render.yaml` があるので Blueprint として自動構成される。手動なら:
   - Runtime: Node
   - Build Command: 空
   - Start Command: `node server.js`
   - Plan: Free
4. Deploy

## 注意

- Render 無料プランは15分アクセスが無いとスリープし、復帰に30〜60秒かかる
- 中継は `ddd-smart.net` / `cdn.ddd-smart.net` / `d-hentai.net` のみ許可
- 別館（d-hentai）の作品は外部タブで開く
