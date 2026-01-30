# 線分ツール機能移植 引継ぎ書

## 概要

HexposedからHexBreakerへ、線分の描画・消去機能の優れた仕様を移植する。

## 移植対象ファイル

### ソース（Hexposed）
| ファイル | 役割 |
|---------|------|
| `E:\サイドビジネス\自作ツール類\Hexposed\editor\managers\LineManager.js` | 線分CRUD、描画状態管理、頂点編集 |
| `E:\サイドビジネス\自作ツール類\Hexposed\editor\ui\CanvasEvents.js` | マウス操作ハンドリング |
| `E:\サイドビジネス\自作ツール類\Hexposed\editor\utils\SnapHelper.js` | スナップ処理ユーティリティ |

### ターゲット（HexBreaker）
| ファイル | 役割 |
|---------|------|
| `editor\managers\LineManager.js` | 線分管理（既存・改修対象） |
| `editor\core\Events.js` | イベント処理（既存・改修対象） |
| `editor\utils\SnapHelper.js` | **新規作成** |

---

## Hexposedの優れた機能（移植対象）

### 1. スナップシステム（SnapHelper.js）

HexBreakerには存在しない機能。新規実装が必要。

```javascript
// 優先順位付きスナップ
getSnapPoint(x, y, editor) {
    // 1. 画面端スナップ（最優先）
    // 2. ヘックス頂点スナップ
    // 3. スナップなし → 入力座標をそのまま返す
}
```

**スナップ種類:**
- **画面端スナップ** (`getEdgeSnapPoint`): 閾値10px以内で画面端(left/right/top/bottom)にスナップ
- **ヘックス頂点スナップ** (`getHexVertexSnapPoint`): 閾値15px以内で最寄りのHEX頂点にスナップ
- **線分端点スナップ** (`getLinePointSnapPoint`): 既存線分の端点にスナップ

### 2. 線分描画の確定条件

**Hexposedの仕様（移植対象）:**
```javascript
addPoint(x, y) {
    // 始点クリック → ループ確定（2点以上ある場合）
    if (this.currentPoints.length >= 2 && this.isSamePoint(point, first)) {
        this.finishDrawing(true);  // closed = true
        return true;
    }

    // 同じ点を再クリック → オープン確定
    if (this.isSamePoint(point, last)) {
        this.finishDrawing(false);  // closed = false
        return true;
    }

    // 通常 → 点追加
    this.currentPoints.push(point);
    return false;
}
```

**HexBreakerの現状:**
- ほぼ同等の実装あり
- ただしスナップ処理なし

### 3. 右クリック操作

**Hexposed CanvasEvents.js 268-294行:**
```javascript
if (e.button === 2) {  // 右クリック
    if (editor.currentTool === 'line') {
        // 描画中 → 最後のポイントを削除（1点のみならキャンセル）
        if (lineManager.isDrawing && lineManager.currentPoints) {
            if (lineManager.currentPoints.length > 1) {
                lineManager.currentPoints.pop();
            } else {
                lineManager.cancelDrawing();
            }
            return;
        }

        // 選択中かつ頂点上 → 頂点削除
        if (lineManager.selectedIndex !== null) {
            const pointIndex = lineManager.findPointAt(pos.x, pos.y);
            if (pointIndex >= 0) {
                lineManager.removePoint(pointIndex);
                return;
            }
        }
    }

    // それ以外 → ツール切り替え
    const toolCycle = ['brush', 'eraser', 'line'];
    ...
}
```

**HexBreakerの現状:**
- `undoLastPoint()`メソッドあり
- 右クリック時の処理あり（Events.js 448-462行）
- ただし頂点削除は選択中の線分からのみ（Hexposedと同等）

### 4. ダブルクリック操作

**Hexposed CanvasEvents.js 566-587行:**
```javascript
// 描画中ならダブルクリックで確定
if (lineManager.isDrawing) {
    lineManager.finishDrawing(false);
    return;
}

// 選択中の線分があれば、セグメント上に頂点追加
if (lineManager.selectedIndex !== null) {
    const segmentIndex = lineManager.findSegmentAt(pos.x, pos.y);
    if (segmentIndex >= 0) {
        lineManager.addPointToSegment(segmentIndex, pos.x, pos.y);
    }
}
```

**HexBreakerの現状:**
- 同等の実装あり（Events.js 392-407行）
- `insertVertex()`で実装済み

### 5. 頂点ドラッグ時のHistory記録

**Hexposed CanvasEvents.js 486-505行:**
```javascript
// 線分頂点ドラッグ終了
if (lineManager.draggingPointIndex !== null && lineManager.selectedIndex !== null) {
    if (editor.history.currentAction && this.dragStartLine) {
        editor.history.recordChange({
            type: 'line',
            action: 'update',
            index: lineManager.selectedIndex,
            oldLine: this.dragStartLine,
            newLine: JSON.parse(JSON.stringify(lineManager.getSelected()))
        });
    }
    lineManager.draggingPointIndex = null;
    this.dragStartLine = null;
    editor.history.endAction();
}
```

**HexBreakerの現状:**
- 頂点ドラッグは実装済み
- Undo/Redoとの連携が不明確

### 6. 線分プロパティ

| プロパティ | Hexposed | HexBreaker |
|-----------|----------|------------|
| id | ✅ | ✅ |
| points | ✅ | ✅ |
| closed | ✅ | ✅ |
| type | ✅ | ✅ |
| color | ✅ | ✅ |
| thickness | ✅ | ✅ |
| opacity | ✅ | ✅ |
| paddleControl | ✅ | ✅ |
| blockGuide | ❌ | ✅ (HexBreaker独自) |

---

## 実装タスク

### Phase 1: SnapHelper新規作成

1. `editor/utils/SnapHelper.js` を新規作成
2. Hexposedの実装をベースに以下を実装:
   - `getSnapPoint(x, y, editor)` - 統合スナップポイント取得
   - `getEdgeSnapPoint()` - 画面端スナップ
   - `getHexVertexSnapPoint()` - HEX頂点スナップ
   - `getLinePointSnapPoint()` - 線分端点スナップ（オプション）

### Phase 2: LineManager改修

1. `startDrawing(x, y)` にスナップ処理追加
2. `addPoint(x, y)` にスナップ処理追加
3. `moveVertex()` にスナップ処理追加
4. `insertVertex()` にスナップ処理追加

### Phase 3: Events.js改修

1. **ホバースナップポイント表示**:
   - `hoverSnapPoint` をRenderSystemに追加
   - mousemove時にスナップポイントを計算・表示

2. **スナップビジュアルフィードバック**:
   - スナップ時に黄色いドットを表示
   - 画面端スナップ時は線も表示

### Phase 4: RenderSystem改修

1. `renderSnapPoints()` メソッド追加
   - HEX頂点候補の表示
   - スナップ位置のハイライト
   - 画面端スナップ時の線表示

---

## HexBreakerの独自機能（維持）

以下はHexBreaker独自の機能なので維持する:

1. **blockGuide設定**: collision線分のブロック誘導機能
2. **ID方式の管理**: Hexposedはindex、HexBreakerはID
3. **LINE_TYPES定数**: 色やデフォルト値の一元管理

---

## テスト項目

- [ ] 画面端にスナップして線分が描画できる
- [ ] HEX頂点にスナップして線分が描画できる
- [ ] 始点クリックでループが閉じる
- [ ] 同じ点ダブルクリックで確定
- [ ] 右クリックで最後の点を削除
- [ ] 右クリックで描画キャンセル（1点のみの場合）
- [ ] ダブルクリックで確定
- [ ] ダブルクリックで頂点追加（セグメント上）
- [ ] 頂点ドラッグがスナップする
- [ ] 頂点削除（右クリック）が動作する
- [ ] Undo/Redoが正しく動作する

---

## 参考: Hexposed LineManager 主要メソッド一覧

| メソッド | 説明 |
|---------|------|
| `startDrawing(x, y)` | 線分描画開始（スナップ適用） |
| `addPoint(x, y)` | 点追加（始点/終点クリックで確定） |
| `finishDrawing(closed)` | 描画確定 |
| `cancelDrawing()` | 描画キャンセル |
| `findPointAt(x, y)` | 選択中線分の頂点検索 |
| `findSegmentAt(x, y)` | 選択中線分のセグメント検索 |
| `findLineAt(x, y)` | 全線分から線分検索 |
| `movePoint(index, x, y)` | 頂点移動（スナップ適用） |
| `addPointToSegment(index, x, y)` | セグメント上に頂点追加 |
| `removePoint(index)` | 頂点削除（1点以下になったら線分削除） |
| `isSamePoint(p1, p2)` | 2点が同一かチェック（閾値5px） |

---

## ファイル読み込み推奨順

1. `Hexposed/editor/utils/SnapHelper.js` - 全文（137行）
2. `Hexposed/editor/managers/LineManager.js` - 全文（460行）
3. `Hexposed/editor/ui/CanvasEvents.js` - handleLineToolMove, handleLineToolDown, handleMouseUp, ダブルクリック部分
4. `HexBreaker/editor/managers/LineManager.js` - 現状確認
5. `HexBreaker/editor/core/Events.js` - 線分関連部分

---

作成日: 2026-01-28
