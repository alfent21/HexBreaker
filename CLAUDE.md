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
| `editor/systems/RenderSystem.js` | キャンバス描画ロジック |
| `game/Game.js` | ゲームループ・コーディネーター |
| `game/GameState.js` | スコア、ライフ、ジェム、コンボ管理 |
| `game/physics/CollisionSystem.js` | 衝突判定 |
| `shared/HexMath.js` | ヘックス座標ユーティリティ |

## データ永続化

- プロジェクト: `.hbp`（Base64画像を含むJSON）
- ステージエクスポート: `.json`（ゲーム配布用）
- プレビュー: `localStorage`でエディター→ゲームへデータ転送

## 仕様書

詳細な仕様書（日本語）:
- `specification.md` - エディター仕様（約1400行）
- `game_specification.md` - ゲームエンジン仕様（約235行）
