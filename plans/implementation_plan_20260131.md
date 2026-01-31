# 起動フロー・ベースレイヤーシステム実装計画

## 概要

HexBreakerエディタの起動時に新規プロジェクト作成ダイアログを表示し、ベースレイヤー（削除不可の最下層レイヤー）を必須とするシステムを実装する。

---

## ベースレイヤー仕様

### データ構造

```javascript
// BaseLayer (特殊な ImageLayer)
{
    id: 0,                    // 常に0（予約ID）
    name: string,             // 変更可能
    type: 'base',             // 新タイプ
    visible: true,            // 常にtrue
    zIndex: 0,                // 常に最下層
    
    // 画像モード
    image: HTMLImageElement | null,
    imageData: string | null,  // Base64
    
    // 単色モード
    backgroundColor: string | null,  // '#RRGGBB'
    
    // サイズ（必須）
    width: number,
    height: number
}
```

### 制約

| 操作 | 可否 | 備考 |
|------|:----:|------|
| 削除 | ✕ | 削除ボタン非表示 |
| 順序変更 | ✕ | 常にzIndex=0 |
| 名前変更 | ○ | |
| 表示/非表示 | ✕ | 常に表示 |
| 画像交換 | ○ | **同サイズのみ** |
| 単色⇔画像 | ○ | **同サイズのみ** |

### 背景色プリセット

```javascript
const BG_COLOR_PRESETS = [
    { name: '白', color: '#FFFFFF' },
    { name: '黒', color: '#000000' },
    { name: 'グレー', color: '#808080' },
    { name: 'ダークグレー', color: '#333333' }
];
```

---

## 起動フロー

```
起動
  │
  ├─ localStorage に lastProject あり？
  │     │
  │     ├─ YES → 自動復元 → エディタ開始
  │     │
  │     └─ NO  ↓
  │
  └─ 新規プロジェクト作成ダイアログ表示
              │
              ├─ [新規作成] → ウィザード → エディタ開始
              │
              └─ [プロジェクトを開く] → ファイル選択 → エディタ開始
```

---

## Proposed Changes

### Core / Managers

---

#### [MODIFY] [LayerManager.js](file:///e:/サイドビジネス/自作ツール類/HexBreaker/editor/managers/LayerManager.js)

- **ベースレイヤー対応**
  - `createBaseLayer(width, height, options)` 追加
  - `setBaseLayerImage(image, imageData)` 追加
  - `setBaseLayerColor(color)` 追加
  - `getBaseLayer()` 追加
  - `removeLayer()` でベースレイヤー削除を禁止
  - `reorderLayer()` でベースレイヤー移動を禁止

---

#### [MODIFY] [Editor.js](file:///e:/サイドビジネス/自作ツール類/HexBreaker/editor/core/Editor.js)

- **起動時にダイアログ表示**
  - `init()` で起動ダイアログ OR 自動復元を呼び出し
- **プロジェクト自動保存**
  - `saveToLocalStorage()` 追加
  - 変更時に自動保存（または定期保存）

---

#### [NEW] [StartupManager.js](file:///e:/サイドビジネス/自作ツール類/HexBreaker/editor/managers/StartupManager.js)

- **起動フロー管理**
  - `checkLastProject()` - localStorage確認
  - `restoreLastProject()` - 自動復元
  - `showStartupDialog()` - 起動ダイアログ表示
  - `showNewProjectWizard()` - ウィザード表示

---

### UI

---

#### [NEW] [startup-dialog.html](file:///e:/サイドビジネス/自作ツール類/HexBreaker/editor/ui/templates/startup-dialog.html)

起動ダイアログのHTMLテンプレート:
- 「新規プロジェクト作成」ボタン
- 「プロジェクトを開く」ボタン
- 最近のプロジェクト一覧（将来対応）

---

#### [NEW] [new-project-wizard.html](file:///e:/サイドビジネス/自作ツール類/HexBreaker/editor/ui/templates/new-project-wizard.html)

ウィザードHTMLテンプレート（3ステップ）:

**Step 1: サイズ・ベース設定**
- 画像選択 OR サイズ手動入力
- 背景色プリセット（サイズ指定時）

**Step 2: パドル領域設定**
- 追加領域 あり/なし
- 位置（上/下/左/右）、サイズ
- パドル軸自動生成 ON/OFF
- ミスライン自動生成 ON/OFF

**Step 3: グリッドサイズ・確認**
- グリッドサイズ選択
- サマリー表示
- 作成ボタン

---

#### [MODIFY] [index.html](file:///e:/サイドビジネス/自作ツール類/HexBreaker/index.html)

- 起動ダイアログ・ウィザードのHTMLを追加
- 初期状態でダイアログを表示

---

### Rendering

---

#### [MODIFY] [RenderSystem.js](file:///e:/サイドビジネス/自作ツール類/HexBreaker/editor/systems/RenderSystem.js)

- **ベースレイヤー描画対応**
  - `_drawBaseLayer()` 追加
  - 単色背景の描画対応

---

### Styles

---

#### [MODIFY] [css/editor.css](file:///e:/サイドビジネス/自作ツール類/HexBreaker/css/editor.css)

- 起動ダイアログのスタイル
- ウィザードのスタイル
- 背景色プリセットカードのスタイル

---

## Verification Plan

### 手動テスト

1. **新規起動テスト**
   - ブラウザのlocalStorageをクリア
   - `python -m http.server 8080` でサーバー起動
   - `http://localhost:8080/index.html` にアクセス
   - 起動ダイアログが表示されることを確認

2. **新規プロジェクト作成テスト**
   - 「新規作成」からウィザードを開始
   - 画像選択 → パドル領域設定 → グリッド選択 → 作成
   - ベースレイヤーが存在し、削除不可であることを確認

3. **単色ベースレイヤーテスト**
   - サイズ手動指定 + 背景色プリセット選択
   - 作成後、レイヤーパネルでベースレイヤーを確認
   - 同サイズ画像と交換できることを確認

4. **2回目起動テスト**
   - プロジェクト編集後、ブラウザをリロード
   - 自動で最後のプロジェクトが復元されることを確認

---

## User Review Required

> [!IMPORTANT]
> **確認事項**: 最終プロジェクトの保存方法について
> - A) プロジェクト全体をlocalStorageに保存（サイズ制限あり）
> - B) 定期的にIndexedDBに保存（大容量対応）
> 
> 推奨: **A)** で開始し、問題があれば**B)**に切り替え

> [!NOTE]
> Hexposedからウィザード関連のHTML/CSSを流用可能。必要に応じて参照します。
