/**
 * Editor.js - Main Editor Controller
 * Based on specification.md Section 5 (v5.0)
 * 
 * Central controller that coordinates all editor subsystems.
 * Now supports stage-based architecture where each stage has its own
 * canvas size, grid size, layers, and lines.
 */

import { GRID_SIZES, pixelToHex } from '../../shared/HexMath.js';
import { TOOLS, CANVAS_CONFIG } from './Config.js';
import { Events } from './Events.js';
import { LayerManager } from '../managers/LayerManager.js';
import { BlockManager } from '../managers/BlockManager.js';
import { LineManager } from '../managers/LineManager.js';
import { StageManager } from '../managers/StageManager.js';
import { RenderSystem } from '../systems/RenderSystem.js';

export class Editor {
    constructor() {
        // Canvas elements
        this.mainCanvas = null;
        this.overlayCanvas = null;

        // Stage Manager (new in v5.0)
        this.stageManager = new StageManager();

        // Subsystems (work with current stage data)
        this.layerManager = new LayerManager();
        this.blockManager = new BlockManager(this.layerManager);
        this.lineManager = new LineManager();
        this.renderSystem = null;
        this.events = null;

        // State
        this.currentTool = TOOLS.BRUSH;
        this.projectName = 'Untitled Project';
        this.isDirty = false;

        // Event emitter
        this._eventHandlers = {};

        // Bind manager callbacks
        this._setupCallbacks();
    }

    /**
     * Initialize the editor with canvas elements
     * @param {HTMLCanvasElement} mainCanvas
     * @param {HTMLCanvasElement} overlayCanvas
     */
    init(mainCanvas, overlayCanvas) {
        this.mainCanvas = mainCanvas;
        this.overlayCanvas = overlayCanvas;

        // Initialize render system
        this.renderSystem = new RenderSystem(mainCanvas, overlayCanvas);
        this.renderSystem.layerManager = this.layerManager;
        this.renderSystem.lineManager = this.lineManager;
        this.renderSystem.blockManager = this.blockManager;

        // Initialize events
        this.events = new Events(this);

        // Create default stage
        this.createStage({
            name: 'Stage 1',
            width: CANVAS_CONFIG.defaultWidth,
            height: CANVAS_CONFIG.defaultHeight,
            gridSize: 'medium'
        });

        // Initial render
        this.render();

        console.log('HexBreaker Editor initialized (v5.0 Stage-based)');
    }

    /**
     * Setup manager callbacks
     * @private
     */
    _setupCallbacks() {
        this.layerManager.onLayerChange = () => {
            this.isDirty = true;
            this._syncLayersToStage();
            this.render();
            this.emit('layersChanged', this.layerManager.getAllLayers());
        };

        this.layerManager.onActiveLayerChange = (layer) => {
            this.emit('activeLayerChanged', layer);
        };

        this.blockManager.onBlockChange = () => {
            this.isDirty = true;
            this._syncLayersToStage();
            this.render();
            this.emit('blocksChanged');
        };

        this.lineManager.onLineChange = () => {
            this.isDirty = true;
            this._syncLinesToStage();
            this.render();
            this.emit('linesChanged', this.lineManager.getAllLines());
        };

        this.lineManager.onSelectionChange = (line) => {
            this.emit('lineSelected', line);
        };

        this.stageManager.onStageChange = (stages) => {
            this.emit('stagesChanged', stages);
        };

        this.stageManager.onCurrentStageChange = (stage) => {
            this._loadStageData(stage);
            this.emit('currentStageChanged', stage);
        };
    }

    /**
     * Create a new stage
     * @param {Object} options
     * @returns {Object} Created stage
     */
    createStage(options) {
        const stage = this.stageManager.createStage(options);

        // Create default block layer for new stage
        const blockLayer = {
            id: 1,
            name: 'Block Layer 1',
            type: 'block',
            visible: true,
            zIndex: 0,
            blocks: new Map(),
            sourceLayerId: null
        };
        stage.layers.push(blockLayer);

        // Load the new stage
        this._loadStageData(stage);

        this.emit('message', { type: 'info', text: `ステージ「${stage.name}」を作成しました` });
        return stage;
    }

    /**
     * Switch to a different stage
     * @param {string} stageId
     */
    switchStage(stageId) {
        this.stageManager.setCurrentStage(stageId);
    }

    /**
     * Get current stage
     * @returns {Object|null}
     */
    getCurrentStage() {
        return this.stageManager.getCurrentStage();
    }

    /**
     * Get all stages
     * @returns {Array}
     */
    getAllStages() {
        return this.stageManager.getAllStages();
    }

    /**
     * Delete a stage
     * @param {string} stageId
     */
    deleteStage(stageId) {
        const stage = this.stageManager.getStage(stageId);
        if (stage) {
            this.stageManager.deleteStage(stageId);
            this.emit('message', { type: 'info', text: `ステージ「${stage.name}」を削除しました` });
        }
    }

    /**
     * Duplicate a stage
     * @param {string} stageId
     */
    duplicateStage(stageId) {
        const newStage = this.stageManager.duplicateStage(stageId);
        if (newStage) {
            this.emit('message', { type: 'info', text: `ステージを複製しました: ${newStage.name}` });
        }
    }

    /**
     * Load stage data into managers
     * @private
     */
    _loadStageData(stage) {
        if (!stage) {
            // No stage - clear everything
            this.layerManager.clear();
            this.lineManager.clear();
            if (this.renderSystem) {
                this.renderSystem.setSize(CANVAS_CONFIG.defaultWidth, CANVAS_CONFIG.defaultHeight);
                this.renderSystem.setGridSize('medium');
            }
            return;
        }

        // Set canvas size
        if (this.renderSystem) {
            this.renderSystem.setSize(stage.canvas.width, stage.canvas.height);
            this.renderSystem.setGridSize(stage.gridSize);
        }

        // Load layers
        this.layerManager.loadFromStage(stage.layers);

        // Load lines
        this.lineManager.loadFromArray(stage.lines);

        // Render
        this.render();

        this.emit('canvasSizeChanged', stage.canvas);
        this.emit('gridSizeChanged', stage.gridSize);
    }

    /**
     * Sync current layers to stage data
     * @private
     */
    _syncLayersToStage() {
        const stage = this.getCurrentStage();
        if (!stage) return;

        stage.layers = this.layerManager.serializeForStage();
    }

    /**
     * Sync current lines to stage data
     * @private
     */
    _syncLinesToStage() {
        const stage = this.getCurrentStage();
        if (!stage) return;

        stage.lines = this.lineManager.serialize();
    }

    /**
     * Get current grid size config
     * @returns {Object}
     */
    getGridSize() {
        return this.stageManager.getCurrentGridSize();
    }

    /**
     * Get current canvas size
     * @returns {{width: number, height: number}}
     */
    getCanvasSize() {
        const stage = this.getCurrentStage();
        if (!stage) {
            return { width: CANVAS_CONFIG.defaultWidth, height: CANVAS_CONFIG.defaultHeight };
        }
        return stage.canvas;
    }

    /**
     * Set current tool
     * @param {string} tool - Tool ID from TOOLS
     */
    setTool(tool) {
        if (!Object.values(TOOLS).includes(tool)) return;

        // Cancel any in-progress line drawing
        if (this.currentTool === TOOLS.LINE && tool !== TOOLS.LINE) {
            this.lineManager.cancelDrawing();
        }

        // Clear selection when switching away from select tool
        if (this.currentTool === TOOLS.SELECT && tool !== TOOLS.SELECT) {
            this.blockManager.clearSelection();
        }

        this.currentTool = tool;
        this.emit('toolChanged', tool);
        this.render();
    }

    /**
     * Get current tool
     * @returns {string}
     */
    getTool() {
        return this.currentTool;
    }

    /**
     * Render the editor
     */
    render() {
        if (this.renderSystem) {
            this.renderSystem.render();
        }
    }

    /**
     * Add image layer from file to current stage
     * @param {File} file
     * @returns {Promise<Object>}
     */
    async addImageLayer(file) {
        const stage = this.getCurrentStage();
        if (!stage) {
            throw new Error('ステージが選択されていません');
        }

        const layer = await this.layerManager.addLayerFromFile(file, stage.canvas);
        this._syncLayersToStage();
        return layer;
    }

    /**
     * Add a new block layer to current stage
     * @param {string} name
     * @returns {Object}
     */
    addBlockLayer(name = 'New Block Layer') {
        const layer = this.layerManager.addBlockLayer(name);
        this.layerManager.setActiveLayer(layer.id);
        this._syncLayersToStage();
        return layer;
    }

    /**
     * Get file input and import images
     */
    importImages() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/png,image/jpeg,image/gif';
        input.multiple = true;

        input.onchange = async (e) => {
            const files = Array.from(e.target.files);
            for (const file of files) {
                try {
                    await this.addImageLayer(file);
                    this.emit('message', { type: 'info', text: `レイヤー追加: ${file.name}` });
                } catch (error) {
                    this.emit('message', { type: 'error', text: error.message });
                }
            }
        };

        input.click();
    }

    /**
     * Create a new project
     */
    newProject() {
        if (this.isDirty) {
            if (!confirm('未保存の変更があります。新規プロジェクトを作成しますか？')) {
                return;
            }
        }

        this.stageManager.clear();
        this.projectName = 'Untitled Project';
        this.isDirty = false;

        // Create default stage
        this.createStage({
            name: 'Stage 1',
            width: CANVAS_CONFIG.defaultWidth,
            height: CANVAS_CONFIG.defaultHeight,
            gridSize: 'medium'
        });

        this.emit('projectChanged', this.projectName);
        this.emit('message', { type: 'info', text: '新規プロジェクトを作成しました' });
    }

    /**
     * Get project data for saving (v5.0 format)
     * @returns {Object}
     */
    getProjectData() {
        return {
            version: '5.0',
            projectName: this.projectName,
            stages: this.stageManager.serialize()
        };
    }

    /**
     * Load project from data (v5.0 format)
     * @param {Object} data
     */
    async loadProjectData(data) {
        // Validate version
        if (!data.version) {
            throw new Error('無効なプロジェクトファイルです');
        }

        this.projectName = data.projectName || 'Untitled Project';

        // Load stages
        if (data.stages) {
            await this.stageManager.deserialize(data.stages);
        }

        this.isDirty = false;
        this.render();

        this.emit('projectChanged', this.projectName);
        this.emit('message', { type: 'info', text: `プロジェクトを読み込みました: ${this.projectName}` });
    }

    /**
     * Export current stage data for game
     * @returns {Object}
     */
    exportCurrentStageData() {
        const stage = this.getCurrentStage();
        if (!stage) {
            throw new Error('ステージが選択されていません');
        }

        const gridSize = GRID_SIZES[stage.gridSize];

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

        // Collect background images
        const backgrounds = [];
        for (const layer of stage.layers) {
            if (layer.type === 'image' && layer.visible) {
                backgrounds.push({
                    imageData: layer.imageData,
                    zIndex: layer.zIndex
                });
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
     * Toggle grid visibility
     */
    toggleGrid() {
        if (this.renderSystem) {
            this.renderSystem.showGrid = !this.renderSystem.showGrid;
            this.render();
            this.emit('gridToggled', this.renderSystem.showGrid);
        }
    }

    /**
     * Toggle line visibility
     */
    toggleLines() {
        if (this.renderSystem) {
            this.renderSystem.showLines = !this.renderSystem.showLines;
            this.render();
            this.emit('linesToggled', this.renderSystem.showLines);
        }
    }

    /**
     * Reset view to default zoom and position
     */
    resetView() {
        if (this.renderSystem) {
            this.renderSystem.scale = 1;
            this.renderSystem.offsetX = 0;
            this.renderSystem.offsetY = 0;
            this.render();
            this.emit('zoomChanged', 1);
        }
    }

    /**
     * Event emitter: register handler
     */
    on(event, handler) {
        if (!this._eventHandlers[event]) {
            this._eventHandlers[event] = [];
        }
        this._eventHandlers[event].push(handler);
    }

    /**
     * Event emitter: remove handler
     */
    off(event, handler) {
        if (!this._eventHandlers[event]) return;
        const index = this._eventHandlers[event].indexOf(handler);
        if (index >= 0) {
            this._eventHandlers[event].splice(index, 1);
        }
    }

    /**
     * Event emitter: emit event
     */
    emit(event, data) {
        if (!this._eventHandlers[event]) return;
        for (const handler of this._eventHandlers[event]) {
            handler(data);
        }
    }
    /**
     * Preview current stage in game runtime
     * Preview current stage
     */
    previewStage() {
        try {
            const stageData = this.stageManager.serializeStage();
            localStorage.setItem('hexbreaker_preview_stage', JSON.stringify(stageData));
            const win = window.open('game_index.html', '_blank');
            if (!win) {
                throw new Error('ポップアップがブロックされました。ブラウザの設定を確認してください。');
            }
        } catch (e) {
            console.error(e);
            this.emit('message', { type: 'error', text: `プレビュー失敗: ${e.message}` });
            alert(`プレビュー起動エラー:\n${e.message}\n\n詳細はコンソール(F12)を確認してください。`);
        }
    }
}

// Export singleton instance
export const editor = new Editor();
