/**
 * SerializationService - シリアライズ処理の統一
 *
 * 責務:
 * - プロジェクト全体のシリアライズ/デシリアライズ
 * - ステージ単体のシリアライズ（ゲームエクスポート用）
 * - Map ↔ Array 変換の共通化
 * - バージョン管理
 */
import { GRID_SIZES } from '../../shared/HexMath.js';
import { fileManager } from './FileManager.js';

export class SerializationService {
    constructor() {
        /** @type {string} 現在のフォーマットバージョン */
        this.VERSION = '5.0';
    }

    // =========================================================================
    // プロジェクト
    // =========================================================================

    /**
     * プロジェクト全体をシリアライズ
     * @param {Object} params
     * @param {Array} params.stages - ステージ配列
     * @param {string} params.projectName - プロジェクト名
     * @param {Object} params.blockRenderSettings - ブロック描画設定
     * @returns {Object}
     */
    serializeProject({ stages, projectName, blockRenderSettings }) {
        return {
            version: this.VERSION,
            projectName: projectName || 'Untitled Project',
            stages: this.serializeStages(stages),
            blockRenderSettings: blockRenderSettings || null
        };
    }

    /**
     * ステージ配列をシリアライズ
     * @param {Array} stages
     * @returns {Array}
     */
    serializeStages(stages) {
        return stages.map(stage => this.serializeStageData(stage));
    }

    /**
     * 単一ステージのデータをシリアライズ
     * @param {Object} stage
     * @returns {Object}
     */
    serializeStageData(stage) {
        const layersArray = Array.isArray(stage.layers) ? stage.layers : [];

        return {
            ...stage,
            baseLayer: stage.baseLayer || null,
            layers: layersArray.map(layer => this.serializeLayer(layer))
        };
    }

    /**
     * レイヤーをシリアライズ
     * @param {Object} layer
     * @returns {Object}
     */
    serializeLayer(layer) {
        if (layer.type === 'block' && layer.blocks instanceof Map) {
            return {
                ...layer,
                blocks: this.mapToArray(layer.blocks)
            };
        }
        return { ...layer };
    }

    /**
     * プロジェクトをデシリアライズ
     * @param {Object} data
     * @returns {Promise<Object>}
     */
    async deserializeProject(data) {
        if (!data.version) {
            throw new Error('無効なプロジェクトファイルです');
        }

        // バージョンマイグレーション（将来の拡張用）
        const migratedData = await this._migrateIfNeeded(data);

        return {
            version: migratedData.version,
            projectName: migratedData.projectName || 'Untitled Project',
            stages: await this.deserializeStages(migratedData.stages || []),
            blockRenderSettings: migratedData.blockRenderSettings || null
        };
    }

    /**
     * ステージ配列をデシリアライズ
     * @param {Array} stagesData
     * @returns {Promise<Array>}
     */
    async deserializeStages(stagesData) {
        const stages = [];
        for (const stageData of stagesData) {
            stages.push(await this.deserializeStageData(stageData));
        }
        return stages;
    }

    /**
     * 単一ステージのデータをデシリアライズ
     * @param {Object} stageData
     * @returns {Promise<Object>}
     */
    async deserializeStageData(stageData) {
        const layersData = Array.isArray(stageData.layers) ? stageData.layers : [];

        return {
            ...stageData,
            baseLayer: stageData.baseLayer || null,
            layers: await Promise.all(layersData.map(layer => this.deserializeLayer(layer)))
        };
    }

    /**
     * レイヤーをデシリアライズ
     * @param {Object} layer
     * @returns {Promise<Object>}
     */
    async deserializeLayer(layer) {
        if (layer.type === 'block' && Array.isArray(layer.blocks)) {
            return {
                ...layer,
                blocks: this.arrayToMap(layer.blocks)
            };
        }
        if (layer.type === 'image' && layer.imageData) {
            // 画像レイヤーの場合、HTMLImageElementを復元
            try {
                const image = await fileManager.loadImageFromDataURL(layer.imageData);
                return {
                    ...layer,
                    image
                };
            } catch (e) {
                console.warn(`画像の復元に失敗: ${layer.name}`, e);
                return {
                    ...layer,
                    image: null
                };
            }
        }
        return { ...layer };
    }

    // =========================================================================
    // ステージ（ゲームエクスポート用）
    // =========================================================================

    /**
     * 単一ステージをゲーム用形式でシリアライズ
     * @param {Object} stage
     * @param {Object} blockRenderSettings - ブロック描画設定
     * @returns {Object}
     */
    serializeStageForGame(stage, blockRenderSettings = null) {
        const gridSize = GRID_SIZES[stage.gridSize] || GRID_SIZES.medium;
        const layersArray = Array.isArray(stage.layers) ? stage.layers : [];

        // ブロックレイヤーで使われているsourceLayerIdを収集
        const usedSourceLayerIds = new Set();
        for (const layer of layersArray) {
            if (layer.type === 'block' && layer.sourceLayerId != null) {
                usedSourceLayerIds.add(layer.sourceLayerId);
            }
        }

        // 背景画像を収集（ソースとして使われているものにフラグ付与）
        const backgrounds = this.collectBackgrounds(stage.baseLayer, layersArray, usedSourceLayerIds);

        // ブロックを収集
        const blocks = this.collectBlocksFromLayers(layersArray);

        return {
            version: this.VERSION,
            stageName: stage.name,
            canvas: stage.canvas,
            gridSize: {
                radius: gridSize.radius,
                width: gridSize.width,
                height: gridSize.height,
                verticalSpacing: gridSize.verticalSpacing
            },
            baseLayer: stage.baseLayer,
            backgrounds,
            blocks,
            lines: stage.lines || [],
            meta: stage.meta || {},
            blockRenderSettings: blockRenderSettings || null
        };
    }

    /**
     * 背景画像を収集
     * @param {Object|null} baseLayer
     * @param {Array} layers
     * @param {Set<number>} usedSourceLayerIds - ブロックソースとして使われている画像レイヤーID
     * @returns {Array}
     */
    collectBackgrounds(baseLayer, layers, usedSourceLayerIds = new Set()) {
        const backgrounds = [];

        // ベースレイヤーを最初に追加
        if (baseLayer) {
            backgrounds.push({
                imageData: baseLayer.imageData,
                backgroundColor: baseLayer.backgroundColor,
                width: baseLayer.width,
                height: baseLayer.height,
                zIndex: -1  // 常に最背面
            });
        }

        // 画像レイヤーを追加（不可視レイヤーは除外、ただしブロックソースは必要）
        for (const layer of layers) {
            if (layer.type === 'image' && layer.imageData) {
                const isBlockSource = usedSourceLayerIds.has(layer.id);
                // 不可視でもブロックソースなら含める、そうでなければ可視のみ
                if (layer.visible !== false || isBlockSource) {
                    backgrounds.push({
                        id: layer.id,  // ブロックのsourceLayerIdとマッチング用
                        imageData: layer.imageData,
                        zIndex: layer.zIndex,
                        isBlockSource  // ブロックソースの場合は背景として描画しない
                    });
                }
            }
        }

        return backgrounds;
    }

    /**
     * ブロックデータを収集
     * @param {Array} layers
     * @returns {Array}
     */
    collectBlocksFromLayers(layers) {
        const blocks = [];
        for (const layer of layers) {
            // visibleはエディター表示用なのでエクスポートには影響させない
            if (layer.type === 'block') {
                const blockData = this.extractBlockValues(layer.blocks);
                // sourceLayerIdを各ブロックに追加
                const sourceId = layer.sourceLayerId || null;
                for (const block of blockData) {
                    block.sourceLayerId = sourceId;
                }
                blocks.push(...blockData);
            }
        }
        return blocks;
    }

    /**
     * ブロックの値を抽出（Map/Array両対応）
     * @param {Map|Array} blocks
     * @returns {Array}
     */
    extractBlockValues(blocks) {
        if (blocks instanceof Map) {
            return Array.from(blocks.values());
        }
        if (Array.isArray(blocks)) {
            // [key, value] 形式の配列
            return blocks.map(([key, val]) => val);
        }
        return [];
    }

    // =========================================================================
    // ユーティリティ
    // =========================================================================

    /**
     * Map を Array に変換（シリアライズ用）
     * @param {Map} map
     * @returns {Array}
     */
    mapToArray(map) {
        return Array.from(map.entries());
    }

    /**
     * Array を Map に変換（デシリアライズ用）
     * @param {Array} array
     * @returns {Map}
     */
    arrayToMap(array) {
        return new Map(array);
    }

    /**
     * バージョンマイグレーション
     * @private
     */
    async _migrateIfNeeded(data) {
        // 現在は v5.0 のみサポート
        // 将来的に v4.0 → v5.0 などのマイグレーションをここに追加
        if (data.version !== this.VERSION) {
            console.warn(`バージョン ${data.version} から ${this.VERSION} へのマイグレーションは未実装です`);
        }
        return data;
    }

    /**
     * データの検証
     * @param {Object} data
     * @returns {{valid: boolean, errors: string[]}}
     */
    validateProjectData(data) {
        const errors = [];

        if (!data.version) {
            errors.push('バージョン情報がありません');
        }
        if (!data.stages || !Array.isArray(data.stages)) {
            errors.push('ステージデータがありません');
        }

        for (let i = 0; i < (data.stages || []).length; i++) {
            const stage = data.stages[i];
            if (!stage.id) {
                errors.push(`ステージ ${i + 1}: IDがありません`);
            }
            if (!stage.canvas) {
                errors.push(`ステージ ${i + 1}: キャンバス情報がありません`);
            }
        }

        return {
            valid: errors.length === 0,
            errors
        };
    }
}

// シングルトンインスタンス
export const serializationService = new SerializationService();
