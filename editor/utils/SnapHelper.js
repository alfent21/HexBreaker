/**
 * SnapHelper - スナップ処理ユーティリティ
 *
 * 線分描画時の頂点スナップ、画面端スナップなどを提供
 * Hexposedから移植
 */

import { pixelToHex, hexToPixel, getHexVertices } from '../../shared/HexMath.js';

export const SnapHelper = {
    /**
     * 指定座標に対するスナップポイントを取得
     * @param {number} x - X座標
     * @param {number} y - Y座標
     * @param {Object} editor - エディタインスタンス
     * @returns {{x: number, y: number, snapped: boolean, snapType?: string}} スナップ結果
     */
    getSnapPoint(x, y, editor) {
        const SNAP_DISTANCE = 15;
        const stage = editor.stageManager?.currentStage;
        if (!stage) return { x, y, snapped: false };

        const canvasWidth = stage.width;
        const canvasHeight = stage.height;
        const gridSize = editor.renderSystem?.gridSize;

        // 1. 画面端スナップ（優先）
        const edgeSnap = this.getEdgeSnapPoint(x, y, canvasWidth, canvasHeight);
        if (edgeSnap) return edgeSnap;

        // 2. 線分端点スナップ
        const lines = editor.lineManager?.getAllLines() || [];
        const lineSnap = this.getLinePointSnapPoint(x, y, lines, SNAP_DISTANCE);
        if (lineSnap) return lineSnap;

        // 3. ヘックス頂点スナップ
        if (gridSize) {
            const hexSnap = this.getHexVertexSnapPoint(x, y, gridSize, SNAP_DISTANCE);
            if (hexSnap) return hexSnap;
        }

        // スナップなし
        return { x, y, snapped: false };
    },

    /**
     * 画面端へのスナップ
     * @param {number} x - X座標
     * @param {number} y - Y座標
     * @param {number} canvasWidth - キャンバス幅
     * @param {number} canvasHeight - キャンバス高さ
     * @param {number} threshold - スナップ閾値
     * @returns {{x: number, y: number, snapped: boolean, snapType: string, edge: string}|null}
     */
    getEdgeSnapPoint(x, y, canvasWidth, canvasHeight, threshold = 10) {
        if (x < threshold) {
            return { x: 0, y, snapped: true, snapType: 'edge', edge: 'left' };
        }
        if (x > canvasWidth - threshold) {
            return { x: canvasWidth, y, snapped: true, snapType: 'edge', edge: 'right' };
        }
        if (y < threshold) {
            return { x, y: 0, snapped: true, snapType: 'edge', edge: 'top' };
        }
        if (y > canvasHeight - threshold) {
            return { x, y: canvasHeight, snapped: true, snapType: 'edge', edge: 'bottom' };
        }
        return null;
    },

    /**
     * ヘックス頂点へのスナップ
     * @param {number} x - X座標
     * @param {number} y - Y座標
     * @param {Object} gridSize - グリッドサイズ設定
     * @param {number} snapDistance - スナップ閾値
     * @returns {{x: number, y: number, snapped: boolean, snapType: string, vertex: Object}|null}
     */
    getHexVertexSnapPoint(x, y, gridSize, snapDistance = 15) {
        const hex = pixelToHex(x, y, gridSize);

        // 近傍のヘックスも含めて検索
        let minDist = Infinity;
        let snapPoint = null;

        for (let dr = -1; dr <= 1; dr++) {
            for (let dc = -1; dc <= 1; dc++) {
                const row = hex.row + dr;
                const col = hex.col + dc;
                if (row < 0 || col < 0) continue;

                const pos = hexToPixel(row, col, gridSize);
                const vertices = getHexVertices(pos.x, pos.y, gridSize.radius);

                for (let i = 0; i < 6; i++) {
                    const v = vertices[i];
                    const dist = Math.hypot(v.x - x, v.y - y);

                    if (dist < snapDistance && dist < minDist) {
                        minDist = dist;
                        snapPoint = {
                            x: v.x,
                            y: v.y,
                            snapped: true,
                            snapType: 'hexVertex',
                            vertex: { row, col, vertexIndex: i }
                        };
                    }
                }
            }
        }

        return snapPoint;
    },

    /**
     * 既存の線分端点へのスナップ
     * @param {number} x - X座標
     * @param {number} y - Y座標
     * @param {Array} lines - 線分配列
     * @param {number} snapDistance - スナップ閾値
     * @returns {{x: number, y: number, snapped: boolean, snapType: string, lineId: string, pointIndex: number}|null}
     */
    getLinePointSnapPoint(x, y, lines, snapDistance = 15) {
        let minDist = Infinity;
        let snapPoint = null;

        for (const line of lines) {
            if (!line.points) continue;

            for (let pointIndex = 0; pointIndex < line.points.length; pointIndex++) {
                const p = line.points[pointIndex];
                const dist = Math.hypot(p.x - x, p.y - y);

                if (dist < snapDistance && dist < minDist) {
                    minDist = dist;
                    snapPoint = {
                        x: p.x,
                        y: p.y,
                        snapped: true,
                        snapType: 'linePoint',
                        lineId: line.id,
                        pointIndex
                    };
                }
            }
        }

        return snapPoint;
    }
};

export default SnapHelper;