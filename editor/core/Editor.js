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
import { StartupManager } from '../managers/StartupManager.js';
import { RenderSystem } from '../systems/RenderSystem.js';
import { createProjectFileSystem } from '../systems/ProjectFileSystem.js';
import { HistorySystem } from '../systems/HistorySystem.js';
import { dialogService } from '../ui/DialogService.js';

export class Editor {
    constructor() {
        // Canvas elements
        this.mainCanvas = null;
        this.overlayCanvas = null;

        // Stage Manager (new in v5.0)
        this.stageManager = new StageManager();

        // Subsystems (work with current stage data)
        this.layerManager = new LayerManager();
        this.blockManager = new BlockManager(this.layerManager, this);
        this.lineManager = new LineManager();
        this.lineManager.editor = this; // HistorySystem アクセス用

        // History (Undo/Redo)
        this.historySystem = new HistorySystem(this);
        this.renderSystem = null;
        this.events = null;

        // Startup Manager
        this.startupManager = new StartupManager(this);

        // Project File System (new unified file operations)
        this.projectFileSystem = createProjectFileSystem(this);

        // State
        this.currentTool = TOOLS.BRUSH;
        this.projectName = 'Untitled Project';
        this.isDirty = false;
        this.isInitialized = false;
        this.gridSnapEnabled = true; // グリッド頂点への強制スナップ

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
    async init(mainCanvas, overlayCanvas) {
        this.mainCanvas = mainCanvas;
        this.overlayCanvas = overlayCanvas;

        // Initialize render system
        this.renderSystem = new RenderSystem(mainCanvas, overlayCanvas);
        this.renderSystem.layerManager = this.layerManager;
        this.renderSystem.lineManager = this.lineManager;
        this.renderSystem.blockManager = this.blockManager;

        // Initialize events
        this.events = new Events(this);

        // Setup startup manager
        this.startupManager.setup();

        // Check startup flow (restore last project or show dialog)
        const restored = await this.startupManager.checkStartup();

        if (!restored) {
            // No project restored - startup dialog is shown
            // Don't create default stage, wait for user action
        }

        this.isInitialized = true;

        // Register undo/redo event handlers
        this.on('undo', () => this.undo());
        this.on('redo', () => this.redo());

        // Set initial button states
        this.historySystem.updateButtons();

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
            this.historySystem.clear();
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
     * @returns {boolean} True if deleted
     */
    deleteStage(stageId) {
        const stages = this.stageManager.getAllStages();

        // Prevent deleting the last stage
        if (stages.length <= 1) {
            this.emit('message', { type: 'warning', text: '最後のステージは削除できません' });
            return false;
        }

        // Prevent deleting the first (base) stage
        if (stages[0]?.id === stageId) {
            this.emit('message', { type: 'warning', text: 'ベースステージは削除できません' });
            return false;
        }

        const stage = this.stageManager.getStage(stageId);
        if (stage) {
            this.stageManager.deleteStage(stageId);
            this.emit('message', { type: 'info', text: `ステージ「${stage.name}」を削除しました` });
            return true;
        }
        return false;
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

        // Load layers (pass object with baseLayer and layers)
        this.layerManager.loadFromStage({
            baseLayer: stage.baseLayer,
            layers: stage.layers
        });

        // Load lines
        this.lineManager.loadFromArray(stage.lines);

        // Ensure default paddle/missline exist (fixes old data without lines)
        this._ensureDefaultLines(stage.canvas.width, stage.canvas.height);

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

        const serialized = this.layerManager.serializeForStage();
        stage.baseLayer = serialized.baseLayer;
        stage.layers = serialized.layers;
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

    // --- History (Undo/Redo) ---

    /**
     * Begin recording an undoable action.
     * All changes until endAction() are grouped as one undo step.
     */
    beginAction() {
        this.historySystem.beginAction();
    }

    /**
     * End the current action and push to undo stack.
     */
    endAction() {
        this.historySystem.endAction();
    }

    /**
     * Undo the last action.
     */
    undo() {
        this.historySystem.undo();
    }

    /**
     * Redo the last undone action.
     */
    redo() {
        this.historySystem.redo();
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
     * Create a new project via wizard
     */
    async newProject() {
        if (this.isDirty) {
            const result = await dialogService.confirmSave(
                '未保存の変更があります。',
                {
                    saveText: '保存して新規作成',
                    discardText: '保存せずに新規作成',
                    cancelText: 'キャンセル'
                }
            );
            if (result === 'cancel') return;
            if (result === 'save') {
                await this.projectFileSystem.saveProject();
            }
        }

        this.startupManager.showWizard({ canCancel: true });
    }

    /**
     * Create a new project from wizard configuration
     * @param {Object} config - Project configuration from wizard
     */
    createNewProject(config) {
        this.stageManager.clear();
        this.projectName = 'Untitled Project';
        this.isDirty = false;

        // 新規プロジェクトなのでファイルハンドルをクリア
        this.projectFileSystem.clearFileHandle();

        // Create base layer configuration
        const baseLayerOptions = {
            name: 'ベース',
            backgroundColor: config.baseLayer.backgroundColor,
            image: null,
            imageData: config.baseLayer.imageData
        };

        // If image data provided, load image
        if (config.baseLayer.imageData) {
            const img = new Image();
            img.src = config.baseLayer.imageData;
            baseLayerOptions.image = img;
            baseLayerOptions.backgroundColor = null;
        }

        // Create stage with base layer
        const stage = this.stageManager.createStage({
            name: 'Stage 1',
            width: config.canvasWidth,
            height: config.canvasHeight,
            gridSize: config.gridSize,
            gameArea: {
                width: config.gameAreaWidth,
                height: config.gameAreaHeight,
                offset: config.gameAreaOffset
            }
        });

        // Create base layer
        this.layerManager.createBaseLayer(
            config.baseLayer.width,
            config.baseLayer.height,
            baseLayerOptions
        );

        // Create default block layer
        const blockLayer = this.layerManager.addBlockLayer('Block Layer 1');

        // Generate preset lines if configured
        if (config.presets) {
            this._generatePresetLines(config);
        }

        // Always ensure default paddle line and miss line exist
        this._ensureDefaultLines(config.canvasWidth, config.canvasHeight);

        // Sync layers and lines to stage FIRST (before loading stage data)
        this._syncLayersToStage();
        this._syncLinesToStage();

        // Now set up render system for the new stage
        if (this.renderSystem) {
            this.renderSystem.setSize(config.canvasWidth, config.canvasHeight);
            this.renderSystem.setGridSize(config.gridSize);
        }

        // Save to localStorage
        this.startupManager.saveToLocalStorage();

        this.emit('projectChanged', this.projectName);
        this.emit('canvasSizeChanged', { width: config.canvasWidth, height: config.canvasHeight });
        this.emit('message', { type: 'info', text: '新規プロジェクトを作成しました' });
    }

    /**
     * Ensure default paddle line and miss line exist
     * @private
     * @param {number} canvasWidth
     * @param {number} canvasHeight
     */
    _ensureDefaultLines(canvasWidth, canvasHeight) {
        const lines = this.lineManager.getAllLines();
        const hasPaddle = lines.some(l => l.type === 'paddle');
        const hasMissline = lines.some(l => l.type === 'missline');

        if (!hasPaddle) {
            this.lineManager.createLine(
                [{ x: 0, y: canvasHeight - 50 }, { x: canvasWidth, y: canvasHeight - 50 }],
                { type: 'paddle', color: '#00FF00', thickness: 3, opacity: 1 }
            );
        }

        if (!hasMissline) {
            this.lineManager.createLine(
                [{ x: 0, y: canvasHeight }, { x: canvasWidth, y: canvasHeight }],
                { type: 'missline', color: '#FF0000', thickness: 3, opacity: 1 }
            );
        }
    }

    /**
     * Generate preset lines based on configuration
     * @private
     * @param {Object} config
     */
    _generatePresetLines(config) {
        const { canvasWidth, canvasHeight, extraArea, presets } = config;

        // Paddle axis
        if (presets.paddleAxis === 'auto' && extraArea) {
            const pos = extraArea.position;
            const size = extraArea.size;
            let points = [];

            switch (pos) {
                case 'bottom':
                    points = [
                        { x: 0, y: canvasHeight - size / 2 },
                        { x: canvasWidth, y: canvasHeight - size / 2 }
                    ];
                    break;
                case 'top':
                    points = [
                        { x: 0, y: size / 2 },
                        { x: canvasWidth, y: size / 2 }
                    ];
                    break;
                case 'left':
                    points = [
                        { x: size / 2, y: 0 },
                        { x: size / 2, y: canvasHeight }
                    ];
                    break;
                case 'right':
                    points = [
                        { x: canvasWidth - size / 2, y: 0 },
                        { x: canvasWidth - size / 2, y: canvasHeight }
                    ];
                    break;
            }

            if (points.length > 0) {
                this.lineManager.createLine(
                    points,
                    { type: 'paddle', color: '#00FF00', thickness: 3, opacity: 1 }
                );
            }
        }

        // Miss line
        if (presets.missLine === 'auto') {
            let points = [];

            if (extraArea) {
                const pos = extraArea.position;
                switch (pos) {
                    case 'bottom':
                        points = [
                            { x: 0, y: canvasHeight },
                            { x: canvasWidth, y: canvasHeight }
                        ];
                        break;
                    case 'top':
                        points = [
                            { x: 0, y: 0 },
                            { x: canvasWidth, y: 0 }
                        ];
                        break;
                    case 'left':
                        points = [
                            { x: 0, y: 0 },
                            { x: 0, y: canvasHeight }
                        ];
                        break;
                    case 'right':
                        points = [
                            { x: canvasWidth, y: 0 },
                            { x: canvasWidth, y: canvasHeight }
                        ];
                        break;
                }
            } else {
                // Default: bottom edge
                points = [
                    { x: 0, y: canvasHeight },
                    { x: canvasWidth, y: canvasHeight }
                ];
            }

            if (points.length > 0) {
                this.lineManager.createLine(
                    points,
                    { type: 'missline', color: '#FF0000', thickness: 3, opacity: 1 }
                );
            }
        }
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
     */
    async previewStage() {
        await this.projectFileSystem.saveForPreview();
    }
}

// Export singleton instance
export const editor = new Editor();
