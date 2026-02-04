# Handover - 2026-02-04

プロジェクト「HexBreaker」の現状と次回作業の引継ぎ情報です。

## 今回のセッション完了作業

### Undo/Redo機能の実装（HistorySystem移植）

Hexposedの`HistorySystem.js`をHexBreakerに移植・適応。

#### 新規作成ファイル
| ファイル | 役割 |
|---------|------|
| `editor/systems/HistorySystem.js` | Undo/Redoの中核システム（~250行） |

#### 変更ファイル
| ファイル | 変更内容 |
|---------|---------|
| `editor/core/Editor.js` | HistorySystem統合、ラッパーメソッド(beginAction/endAction/undo/redo)、イベント登録 |
| `editor/managers/BlockManager.js` | 全操作メソッドに`_recordHistory()`追加、`_suppressNotify`フラグ |
| `editor/managers/LineManager.js` | editor参照追加、全操作メソッドに`_recordHistory()`追加、`_suppressNotify`フラグ |
| `editor/core/Events.js` | `beginAction()`/`endAction()`の呼び出し（ブラシ/消しゴム/フィル/ライン/Delete/Enter） |
| `editor/ui/UIController.js` | Undo/Redoツールバーボタンのイベント登録、optional chaining除去 |
| `editor/ui/controllers/ContextMenuController.js` | 「ブロックをクリア」にundo対応 |

#### 設計ポイント
- **マルチレイヤー対応**: 変更記録に`layerId`を含め、Undo時に正しいレイヤーのblocksを操作
- **ラインID基準**: Hexposedのindex基準からID基準に変更（`lines.findIndex(l => l.id === ...)`）
- **通知制御**: `_suppressNotify`フラグでUndo/Redo中の多重通知を抑制、完了後にまとめてsync/render
- **頂点ドラッグ**: `moveVertex()`内では記録せず、Events.jsでdrag開始時のライン状態を保存し、drag終了時にbefore/after差分を記録
- **アクション単位**: 1回のドラッグ操作（複数セルのブラシ配置等）は1つのUndoステップにまとまる

#### 対象外（未実装）
- **Blockify操作のUndo**: LayerManager経由で直接blocks Mapにセットするため、BlockManagerを通らない
- **レイヤー追加/削除のUndo**: レイヤー構造変更のUndoは複雑すぎるため除外

---

## 既知の問題

### `addLine` メソッド不在
- `Editor.js` L549, L600 で `this.lineManager.addLine(...)` を呼んでいるが、LineManagerには`addLine`メソッドが存在しない
- `createLine()`が対応するメソッド
- `_generatePresetLines()` 内でのみ使用されており、ウィザードからのプロジェクト作成時にエラーになる可能性あり
- 修正案: `addLine` を `createLine` のエイリアスとして追加、または呼び出し側を修正

---

## 検証チェックリスト

- [ ] ブラシ配置 → Ctrl+Z で消える → Ctrl+Y で戻る
- [ ] 消しゴム → Ctrl+Z で復元
- [ ] フラッドフィル → Ctrl+Z で元の耐久度に戻る
- [ ] 範囲選択 → Delete → Ctrl+Z で復元
- [ ] 範囲選択 → Enter → Ctrl+Z で消える
- [ ] ライン描画 → Ctrl+Z でライン消去
- [ ] ライン削除 → Ctrl+Z で復元
- [ ] 頂点ドラッグ → Ctrl+Z で元位置に戻る
- [ ] 頂点挿入/削除 → Ctrl+Z で元に戻る
- [ ] ステージ切り替え → 履歴がクリアされること
- [ ] Undo/Redoボタンの有効/無効が正しく連動
- [ ] コンテキストメニュー「ブロックをクリア」→ Ctrl+Z で復元
- [ ] Undo/Redoツールバーボタンが機能すること

---
更新日時: 2026-02-04
