# CLAUDE.md

このファイルはClaude Code (claude.ai/code) がこのリポジトリで作業する際のガイダンスを提供します。

**重要: このプロジェクトではすべてのコミュニケーションを日本語で行ってください。**

## プロジェクト概要

HexBreakerはヘックスグリッドシステムを採用したブラウザベースのブロック崩しゲーム。2つのアプリケーションで構成:
- **エディター** (`index.html`) - ヘックスグリッドブロック配置用ステージ設計ツール
- **ゲーム** (`game_index.html`) - 物理演算、ウエポン、ボス戦を備えたゲームエンジン

## 開発環境

ビルドシステム不要 - 純粋なバニラJavaScript ES2022+モジュール。任意のローカルHTTPサーバーで起動。

```bash
# Python
python -m http.server 8080

# Node
npx serve
```

エントリーポイント:
- エディター: `index.html` → `editor/core/Editor.js`
- ゲーム: `game_index.html` → `game/Game.js`

## アーキテクチャ

### ヘックスグリッドシステム（フラットトップ六角形）

3つのグリッドサイズ（半径）: small (10px), medium (30px), large (50px)

主要な計算式:
- `width = √3 × radius`
- `verticalSpacing = radius × 1.5`
- 奇数行は水平方向に `width/2` オフセット

隣接セルオフセットは行の偶奇で異なる:
```javascript
// 偶数行: [[-1,-1], [-1,0], [0,-1], [0,1], [1,-1], [1,0]]
// 奇数行: [[-1,0], [-1,1], [0,-1], [0,1], [1,0], [1,1]]
```

### ステージベースアーキテクチャ

各ステージは独立して以下を持つ:
- 固定キャンバスサイズ（作成後変更不可）
- 固定グリッドサイズ（変更不可 - ブロック座標が無効になるため）
- LayerManager（画像＋ブロックレイヤー）
- LineManager（collision/paddle/missline/decorationライン）

### 2キャンバスレンダリング

- `mainCanvas`: 背景、レイヤー、ブロック、線分（低リフレッシュ）
- `overlayCanvas`: ホバー、選択、ツールプレビュー（高リフレッシュ）

ビュー変換: `scale`, `offsetX`, `offsetY` と `screenToCanvas()`/`canvasToScreen()` 座標変換。

### レイヤーシステム

- **ImageLayer**: HTMLImageElement + Base64 dataURL（永続化用）
- **BlockLayer**: `Map<string, BlockData>` キーは `"row,col"`

ブロックデータ: `{ row, col, durability (1-10), color, gemDrop?, blockType?, keyId? }`

### ラインタイプ

- `collision`: ボール反射用の壁
- `paddle`: パドル移動軸
- `missline`: ライフ減少トリガー（広い判定閾値）
- `decoration`: 装飾用（判定なし）

ラインは`blockGuide`設定（確率＋角度制限）でAI補助によるボール誘導が可能。

### ウエポンシステム（7種類）

| キー | ウエポン | コスト | 効果 |
|-----|--------|------|--------|
| 1 | SLOW | 1 | ボール速度×0.6、20秒 |
| 2 | EXPAND | 2 | パドル幅Lv3まで拡大、30秒 |
| 3 | DOUBLE | 2 | ボール追加（最大32個）、永続 |
| 4 | LASER | 3 | 垂直レーザー、ストック制 |
| 5 | SHIELD | 4 | ミスライン防御、最大3枚 |
| 6 | MAGNET | 4 | 左クリックでボール吸着、20秒 |
| 7 | GHOST | 4 | 左クリックでブロック貫通、15秒 |

LASER/MAGNET/GHOSTは相互排他（同じ入力バインド）。

### ゲーム物理演算

- 反射: 壁は反射の法則、パドルは±60°変化を付与
- 頂点衝突: 無限ループ防止のためランダム角度分散
- ブロック誘導: 50%確率、±30°角度制限（プライマリボールのみ）
- コンボ: 破壊間2秒タイムアウト

## 主要ファイル

| ファイル | 役割 |
|------|---------|
| `editor/core/Editor.js` | エディターメインコントローラー |
| `editor/core/Config.js` | 定数（グリッドサイズ、ツール、色） |
| `editor/managers/LayerManager.js` | 画像/ブロックレイヤー操作 |
| `editor/managers/LineManager.js` | 物理ライン管理 |
| `editor/managers/StageManager.js` | ステージCRUD・切り替え |
| `editor/managers/StartupManager.js` | 起動フロー・ウィザード管理 |
| `editor/systems/RenderSystem.js` | キャンバス描画ロジック |
| `editor/systems/FileManager.js` | ファイル読み書きの一元化 |
| `editor/systems/SerializationService.js` | シリアライズ処理の統一 |
| `editor/systems/ProjectFileSystem.js` | プロジェクトファイル操作の統合API |
| `editor/ui/DialogService.js` | ダイアログ・Toast通知の統一管理 |
| `editor/ui/UIController.js` | UI統合コントローラー |
| `game/Game.js` | ゲームループ・コーディネーター |
| `game/GameState.js` | スコア、ライフ、ジェム、コンボ管理 |
| `game/physics/CollisionSystem.js` | 衝突判定 |
| `shared/HexMath.js` | ヘックス座標ユーティリティ |

## ファイル操作アーキテクチャ

ファイル操作は以下の階層構造で責務を分離:

```
┌─────────────────────────────────────────────────────────┐
│                    ProjectFileSystem                     │
│  （高レベルAPI: 保存/読み込み/エクスポート/プレビュー）    │
└─────────────────────────────────────────────────────────┘
          ↓                ↓                ↓
┌─────────────────┐ ┌──────────────────┐ ┌─────────────────┐
│   FileManager   │ │SerializationService│ │  DialogService  │
│ ファイル読み書き │ │ シリアライズ統一   │ │ ダイアログ管理  │
└─────────────────┘ └──────────────────┘ └─────────────────┘
```

### 各サービスの責務

| サービス | 責務 |
|---------|------|
| `FileManager` | FileReader/Blob操作、Base64変換、サイズ検証 |
| `SerializationService` | Map↔Array変換、バージョン管理、ゲーム用エクスポート形式 |
| `DialogService` | 確認ダイアログ、ローディング表示、Toast通知 |
| `ProjectFileSystem` | 上記3つを統合した高レベルAPI |

### 使用例

```javascript
// ファイル読み込み（FileManager）
const { image, dataURL, width, height } = await fileManager.loadImageFile(file);

// プロジェクト保存（ProjectFileSystem）
await editor.projectFileSystem.saveProject();

// ローディング表示（DialogService）
const close = dialogService.showLoading('処理中...');
// 処理...
close();

// Toast通知（DialogService）
dialogService.toast('保存しました', 'success');
```

## データ永続化

- プロジェクト: `.hbp`（Base64画像を含むJSON）
- ステージエクスポート: `.json`（ゲーム配布用）
- プレビュー: `localStorage`でエディター→ゲームへデータ転送

## 実装ガイドライン

### 新機能追加時の原則

1. **責務の明確化**: 新しい機能を追加する際は、既存のサービス/マネージャーに適切に配置するか、必要に応じて新しいサービスを作成
2. **シングルトンパターン**: サービスクラスはシングルトンとしてエクスポート（例: `export const fileManager = new FileManager()`）
3. **非同期処理**: ファイル操作やDOM操作を伴う処理は`async/await`を使用
4. **エラーハンドリング**: try-catchでエラーを捕捉し、`DialogService.toast()`でユーザーに通知

### コード重複を避けるパターン

| 処理 | 使用するサービス |
|------|------------------|
| ファイル読み込み（FileReader） | `FileManager.loadImageFile()` |
| ファイルダウンロード | `FileManager.saveFile()` |
| Map↔Array変換 | `SerializationService.mapToArray()` / `arrayToMap()` |
| 確認ダイアログ | `DialogService.confirm()` |
| ローディング表示 | `DialogService.showLoading()` |
| 通知メッセージ | `DialogService.toast()` |

### UIController での処理簡素化

UIControllerはイベントハンドリングとUIの更新に専念し、ビジネスロジックは各サービスに委譲:

```javascript
// 良い例
async _saveProject() {
    await this.editor.projectFileSystem.saveProject();
}

// 避けるべき例（ロジックがUIControllerに混在）
async _saveProject() {
    const data = this.editor.serializeProject();
    const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
    // ... ダウンロード処理
}
```

### CSS管理

- `css/editor.css`: エディター全体のスタイル
- `css/dialogs.css`: ダイアログ・Toast関連のスタイル
- 新しいコンポーネントは既存CSSファイルに追加するか、必要に応じて新規ファイルを作成

## 仕様書

詳細な仕様書（日本語）:
- `specification.md` - エディター仕様（約1400行）
- `game_specification.md` - ゲームエンジン仕様（約235行）

## 前身プロジェクト

**Hexposed** (`E:\サイドビジネス\自作ツール類\Hexposed`)

HexBreakerの前身となるプロジェクト。機能の参考実装がある場合はこちらを確認すること。

主な違い:
- Hexposed: v3.0形式、BackgroundManager使用、BlockStockManager使用
- HexBreaker: v5.0形式、LayerManager統合、StageManager導入

Hexposedの主要ファイル:
| ファイル | 役割 |
|---------|------|
| `editor/core/Editor.js` | エディターコア |
| `editor/ui/CanvasEvents.js` | キャンバスイベント処理 |
| `editor/ui/UIController.js` | UI統合コントローラー |
| `editor/ui/ToolbarUI.js` | ツールバーUI |
| `editor/managers/LayerManager.js` | レイヤー管理 |
| `editor/managers/BlockManager.js` | ブロック管理 |
| `editor/managers/LineManager.js` | ライン管理 |
| `editor/systems/RenderSystem.js` | 描画システム |
| `editor/systems/DiffDetector.js` | 差分検出 |
| `game/game.js` | ゲームエンジン |
