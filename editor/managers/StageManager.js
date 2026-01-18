/**
 * StageManager.js - Stage Management
 * Based on specification.md Section 3.5, 4.2 (v5.0)
 * 
 * Manages multiple stages within a project.
 * Each stage has its own canvas size, grid size, layers, and lines.
 */

import { GRID_SIZES } from '../../shared/HexMath.js';
import { CANVAS_CONFIG, STAGE_DEFAULTS } from '../core/Config.js';

/**
 * @typedef {Object} StageData
 * @property {string} id - Unique stage ID
 * @property {string} name - Stage name
 * @property {{width: number, height: number}} canvas - Canvas size
 * @property {string} gridSize - Grid size key ('small', 'medium', 'large')
 * @property {Array} layers - Layer data array
 * @property {Array} lines - Line data array
 * @property {Object} meta - Stage metadata
 */

export class StageManager {
    constructor() {
        /** @type {StageData[]} */
        this.stages = [];

        /** @type {string|null} */
        this.currentStageId = null;

        // Event callbacks
        this.onStageChange = null;
        this.onCurrentStageChange = null;
    }

    /**
     * Create a new stage
     * @param {Object} options
     * @param {string} options.name - Stage name
     * @param {number} options.width - Canvas width
     * @param {number} options.height - Canvas height
     * @param {string} options.gridSize - Grid size key
     * @returns {StageData}
     */
    createStage({ name, width, height, gridSize = 'medium' }) {
        const id = `stage_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;

        const stage = {
            id,
            name: name || `Stage ${this.stages.length + 1}`,
            canvas: {
                width: width || CANVAS_CONFIG.defaultWidth,
                height: height || CANVAS_CONFIG.defaultHeight
            },
            gridSize: gridSize,
            layers: [],
            lines: [],
            meta: {
                initialLives: STAGE_DEFAULTS?.initialLives || 3,
                clearBonus: STAGE_DEFAULTS?.clearBonus || 1000,
                powerGemChance: STAGE_DEFAULTS?.powerGemChance || 0.15,
                resetGemsOnClear: false,
                blockGuide: {
                    enabled: true,
                    probability: 0.5,
                    angleLimit: 30
                },
                boss: null
            }
        };

        this.stages.push(stage);
        this._emitChange();

        // Auto-select if first stage
        if (this.stages.length === 1) {
            this.setCurrentStage(id);
        }

        return stage;
    }

    /**
     * Get stage by ID
     * @param {string} id
     * @returns {StageData|null}
     */
    getStage(id) {
        return this.stages.find(s => s.id === id) || null;
    }

    /**
     * Get current stage
     * @returns {StageData|null}
     */
    getCurrentStage() {
        if (!this.currentStageId) return null;
        return this.getStage(this.currentStageId);
    }

    /**
     * Set current stage
     * @param {string} id
     * @returns {boolean}
     */
    setCurrentStage(id) {
        const stage = this.getStage(id);
        if (!stage) return false;

        this.currentStageId = id;

        if (this.onCurrentStageChange) {
            this.onCurrentStageChange(stage);
        }

        return true;
    }

    /**
     * Get all stages
     * @returns {StageData[]}
     */
    getAllStages() {
        return [...this.stages];
    }

    /**
     * Delete stage
     * @param {string} id
     * @returns {boolean}
     */
    deleteStage(id) {
        const index = this.stages.findIndex(s => s.id === id);
        if (index === -1) return false;

        this.stages.splice(index, 1);

        // If deleted current stage, select another
        if (this.currentStageId === id) {
            this.currentStageId = this.stages.length > 0 ? this.stages[0].id : null;
            if (this.onCurrentStageChange) {
                this.onCurrentStageChange(this.getCurrentStage());
            }
        }

        this._emitChange();
        return true;
    }

    /**
     * Duplicate stage
     * @param {string} id
     * @returns {StageData|null}
     */
    duplicateStage(id) {
        const original = this.getStage(id);
        if (!original) return null;

        const newStage = JSON.parse(JSON.stringify(original));
        newStage.id = `stage_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
        newStage.name = `${original.name} (コピー)`;

        // Regenerate layer IDs
        let nextLayerId = 1;
        for (const layer of newStage.layers) {
            layer.id = nextLayerId++;
        }

        // Regenerate line IDs
        for (const line of newStage.lines) {
            line.id = `line_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
        }

        this.stages.push(newStage);
        this._emitChange();
        return newStage;
    }

    /**
     * Rename stage
     * @param {string} id
     * @param {string} newName
     * @returns {boolean}
     */
    renameStage(id, newName) {
        const stage = this.getStage(id);
        if (!stage) return false;

        stage.name = newName;
        this._emitChange();
        return true;
    }

    /**
     * Reorder stages
     * @param {number} fromIndex
     * @param {number} toIndex
     */
    reorderStages(fromIndex, toIndex) {
        if (fromIndex < 0 || fromIndex >= this.stages.length) return;
        if (toIndex < 0 || toIndex >= this.stages.length) return;

        const [stage] = this.stages.splice(fromIndex, 1);
        this.stages.splice(toIndex, 0, stage);
        this._emitChange();
    }

    /**
     * Update stage metadata
     * @param {string} id
     * @param {Object} meta
     * @returns {boolean}
     */
    updateStageMeta(id, meta) {
        const stage = this.getStage(id);
        if (!stage) return false;

        Object.assign(stage.meta, meta);
        this._emitChange();
        return true;
    }

    /**
     * Get grid size config for current stage
     * @returns {Object|null}
     */
    getCurrentGridSize() {
        const stage = this.getCurrentStage();
        if (!stage) return GRID_SIZES.medium;
        return GRID_SIZES[stage.gridSize] || GRID_SIZES.medium;
    }

    /**
     * Clear all stages
     */
    clear() {
        this.stages = [];
        this.currentStageId = null;
        this._emitChange();
        if (this.onCurrentStageChange) {
            this.onCurrentStageChange(null);
        }
    }

    /**
     * Serialize for saving
     * @returns {StageData[]}
     */
    serialize() {
        return this.stages.map(stage => ({
            ...stage,
            layers: stage.layers.map(layer => {
                if (layer.type === 'block' && layer.blocks instanceof Map) {
                    return {
                        ...layer,
                        blocks: Array.from(layer.blocks.entries())
                    };
                }
                return layer;
            })
        }));
    }

    /**
     * Serialize single stage for preview
     * @returns {Object|null}
     */
    serializeStage() {
        const stage = this.getCurrentStage();
        if (!stage) return null;

        // Use same format as export
        const gridSize = GRID_SIZES[stage.gridSize] || GRID_SIZES.medium;

        // Filter valid background images
        const backgrounds = [];
        for (const layer of stage.layers) {
            if (layer.type === 'image' && layer.visible && layer.imageData) {
                backgrounds.push({
                    imageData: layer.imageData, // base64 string
                    zIndex: layer.zIndex
                });
            }
        }

        // Collect all blocks from visible block layers
        const blocks = [];
        for (const layer of stage.layers) {
            if (layer.type === 'block' && layer.visible) {
                const blockData = layer.blocks instanceof Map
                    ? Array.from(layer.blocks.values())
                    : layer.blocks.map(([key, val]) => val);
                blocks.push(...blockData);
            }
        }

        return {
            version: '5.0',
            stageName: stage.name,
            canvas: stage.canvas,
            gridSize: {
                radius: gridSize.radius,
                width: gridSize.width,
                height: gridSize.height,
                verticalSpacing: gridSize.verticalSpacing
            },
            backgrounds,
            blocks,
            lines: stage.lines,
            meta: stage.meta
        };
    }

    /**
     * Deserialize from saved data
     * @param {StageData[]} data
     */
    async deserialize(data) {
        this.stages = [];

        for (const stageData of data) {
            const stage = {
                ...stageData,
                layers: stageData.layers.map(layer => {
                    if (layer.type === 'block' && Array.isArray(layer.blocks)) {
                        return {
                            ...layer,
                            blocks: new Map(layer.blocks)
                        };
                    }
                    // Image layers need to restore HTMLImageElement
                    if (layer.type === 'image' && layer.imageData) {
                        return {
                            ...layer,
                            image: null // Will be restored when needed
                        };
                    }
                    return layer;
                })
            };
            this.stages.push(stage);
        }

        // Select first stage
        if (this.stages.length > 0) {
            this.setCurrentStage(this.stages[0].id);
        }

        this._emitChange();
    }

    /**
     * Emit change event
     * @private
     */
    _emitChange() {
        if (this.onStageChange) {
            this.onStageChange(this.stages);
        }
    }
}
