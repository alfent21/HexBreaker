# Handover - 2026-01-31

プロジェクト「HexBreaker」の現状と次回作業の引継ぎ情報です。

## 現在の状態
- **完了**: 起動フロー・ベースレイヤーシステムの設計、実装計画作成。
- **完了**: `.gitignore` の追加（`images/` フォルダ除外）。
- **進行中**: `LayerManager.js` へのベースレイヤー定義追加（TypeDefと定数は追加済み）。

## 次回の作業 (ToDo)
`plans/implementation_plan_20260131.md` に基づき実装を進めてください。

1. **[LayerManager.js]** 実装の続き
   - `createBaseLayer`, `setBaseLayerImage`, `setBaseLayerColor` 等のメソッド実装
   - `removeLayer`, `reorderLayer` でのベースレイヤー保護ガード処理

2. **[Rendering]**
   - `RenderSystem.js` でのベースレイヤー描画処理（単色対応）

3. **[UI/Dialog]**
   - `startup-dialog.html`, `new-project-wizard.html` のテンプレート作成
   - `StartupManager.js` の実装
   - `index.html` への統合

## 重要事項・コンテキスト
- **ベースレイヤー**: 
  - `id: 0` 固定。削除不可。最背面固定。
  - 画像モードと単色モード（プリセット: 白/黒/グレー/ダークグレー）を持つ。
  - サイズ変更は不可だが、同サイズであれば画像/色の差し替えは可能。
- **背景色の透明**は「それより下がない」ため不要（削除済み）。
- **起動フロー**:
  - `localStorage` に前回のプロジェクト情報を保存し、次回起動時に自動復元する。
  - 履歴がない場合は新規作成 or ファイル選択ダイアログを表示。
- **参考リソース**:
  - `Hexposed` の `DialogUI.js` やCSSがウィザードUIの参考になる。

## 確認済みの意思決定
- 最終プロジェクトの保存は一旦 `localStorage` で実装開始し、容量問題が出たら `IndexedDB` へ移行する。
- `images/` はリポジトリ管理外（.gitignore済み）。

---
作成日時: 2026-01-31 12:15
