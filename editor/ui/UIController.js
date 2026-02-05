/**
 * UIController.js - UI Event Handling
 * Based on specification.md Section 3
 *
 * Main UI coordinator that delegates to specialized sub-controllers.
 */

import { TOOLS, BRUSH_SIZES } from '../core/Config.js';
import { MessageController } from './controllers/MessageController.js';
import { BlockRenderSettingsController } from './controllers/BlockRenderSettingsController.js';
import { BlockifyController } from './controllers/BlockifyController.js';
import { ContextMenuController } from './controllers/ContextMenuController.js';
import { LayerPanelController } from './controllers/LayerPanelController.js';
import { StagePanelController } from './controllers/StagePanelController.js';
import { ToolPaletteController } from './controllers/ToolPaletteController.js';

export class UIController {
    /**
     * @param {import('../core/Editor.js').Editor} editor
     */
    constructor(editor) {
        this.editor = editor;
        this.editor.uiController = this;

        // UI element references
        this.elements = {};

        // Sub-controllers
        this.messageController = new MessageController(editor);
        this.blockRenderSettingsController = new BlockRenderSettingsController(
            editor,
            (type, text) => this._addMessage(type, text)
        );
        this.blockifyController = new BlockifyController(
            editor,
            (type, text) => this._addMessage(type, text),
            () => this.layerPanelController.updateLayerList()
        );
        this.contextMenuController = new ContextMenuController(
            editor,
            (type, text) => this._addMessage(type, text),
            () => this.layerPanelController.updateLayerList(),
            (layerId) => this.showBlockifyDialog(layerId)
        );
        this.layerPanelController = new LayerPanelController(
            editor,
            (type, text) => this._addMessage(type, text)
        );
        this.stagePanelController = new StagePanelController(
            editor,
            (type, text) => this._addMessage(type, text)
        );
        this.toolPaletteController = new ToolPaletteController(
            editor,
            (type, text) => this._addMessage(type, text)
        );
    }

    /**
     * Initialize UI
     */
    init() {
        this._cacheElements();

        // Initialize sub-controllers
        this.messageController.init({
            messageList: this.elements.messageList,
            copyMessagesBtn: this.elements.copyMessagesBtn,
            clearMessagesBtn: this.elements.clearMessagesBtn
        });

        this.blockRenderSettingsController.init({
            blockRenderToggle: this.elements.blockRenderToggle,
            blockRenderContent: this.elements.blockRenderContent,
            fillUseBlockColor: this.elements.fillUseBlockColor,
            fillColor: this.elements.fillColor,
            fillColorGroup: this.elements.fillColorGroup,
            fillOpacity: this.elements.fillOpacity,
            fillOpacityValue: this.elements.fillOpacityValue,
            borderColor: this.elements.borderColor,
            borderWidth: this.elements.borderWidth,
            borderWidthValue: this.elements.borderWidthValue,
            embossHighlightColor: this.elements.embossHighlightColor,
            embossHighlightOpacity: this.elements.embossHighlightOpacity,
            embossHighlightOpacityValue: this.elements.embossHighlightOpacityValue,
            embossShadowColor: this.elements.embossShadowColor,
            embossShadowOpacity: this.elements.embossShadowOpacity,
            embossShadowOpacityValue: this.elements.embossShadowOpacityValue,
            embossWidth: this.elements.embossWidth,
            embossWidthValue: this.elements.embossWidthValue,
            embossInset: this.elements.embossInset,
            embossInsetValue: this.elements.embossInsetValue
        });

        this.blockifyController.init({
            blockifyDialog: this.elements.blockifyDialog,
            blockifySourceSelect: this.elements.blockifySourceSelect,
            blockifyGridSize: this.elements.blockifyGridSize,
            blockifyAlphaThreshold: this.elements.blockifyAlphaThreshold,
            blockifyAlphaValue: this.elements.blockifyAlphaValue,
            blockifyCoverageThreshold: this.elements.blockifyCoverageThreshold,
            blockifyCoverageValue: this.elements.blockifyCoverageValue,
            blockifyDurability: this.elements.blockifyDurability,
            blockifyUseImageColor: this.elements.blockifyUseImageColor,
            blockifyDefaultColor: this.elements.blockifyDefaultColor,
            blockifyTargetSelect: this.elements.blockifyTargetSelect,
            blockifyMergeBlocks: this.elements.blockifyMergeBlocks,
            blockifyPreviewCount: this.elements.blockifyPreviewCount,
            blockifyCancelBtn: this.elements.blockifyCancelBtn,
            blockifyCreateBtn: this.elements.blockifyCreateBtn,
            blockifyCloseBtn: this.elements.blockifyCloseBtn
        });

        this.contextMenuController.init({
            contextMenu: this.elements.contextMenu,
            layerList: this.elements.layerList
        });

        this.layerPanelController.init({
            layerList: this.elements.layerList,
            addImageBtn: this.elements.addImageBtn,
            addBlockLayerBtn: this.elements.addBlockLayerBtn
        });

        this.stagePanelController.init({
            stageSelect: this.elements.stageSelect,
            addStageBtn: this.elements.addStageBtn,
            stageList: this.elements.stageList,
            createStageBtn: this.elements.createStageBtn,
            newStageDialog: this.elements.newStageDialog,
            newStageName: this.elements.newStageName,
            newStageImage: this.elements.newStageImage,
            newStageWidth: this.elements.newStageWidth,
            newStageHeight: this.elements.newStageHeight,
            newStageCancelBtn: this.elements.newStageCancelBtn,
            newStageCreateBtn: this.elements.newStageCreateBtn,
            newStageCloseBtn: this.elements.newStageCloseBtn
        });

        this.toolPaletteController.init({
            toolPalette: this.elements.toolPalette,
            toolButtons: this.elements.toolButtons,
            brushSizeButtons: this.elements.brushSizeButtons,
            durabilityButtons: this.elements.durabilityButtons,
            colorPicker: this.elements.colorPicker,
            lineTypeButtons: this.elements.lineTypeButtons,
            lineColorPicker: this.elements.lineColorPicker,
            lineThickness: this.elements.lineThickness,
            lineOpacity: this.elements.lineOpacity,
            gridSnap: this.elements.gridSnap,
            paddleControl: this.elements.paddleControl,
            paddleSettings: this.elements.paddleSettings,
            tapSettings: this.elements.tapSettings,
            tapRange: this.elements.tapRange,
            pathSettings: this.elements.pathSettings,
            pathLineSelect: this.elements.pathLineSelect,
            pathSpeedSettings: this.elements.pathSpeedSettings,
            pathSpeed: this.elements.pathSpeed
        });

        this._bindToolbarEvents();
        this._bindMenuEvents();
        this._bindEditorEvents();
        this._initToolbar();

        this._addMessage('info', 'UI Controller initialized');
    }

    /**
     * Cache DOM element references
     * @private
     */
    _cacheElements() {
        this.elements = {
            // Toolbar
            toolbar: document.getElementById('toolbar'),
            newBtn: document.getElementById('btn-new'),
            openBtn: document.getElementById('btn-open'),
            saveBtn: document.getElementById('btn-save'),
            undoBtn: document.getElementById('btn-undo'),
            redoBtn: document.getElementById('btn-redo'),
            zoomLevel: document.getElementById('zoom-level'),
            gridToggle: document.getElementById('grid-toggle'),
            lineToggle: document.getElementById('line-toggle'),
            stageSelect: document.getElementById('stage-select'),
            addStageBtn: document.getElementById('btn-add-stage'),
            previewBtn: document.getElementById('btn-preview'),

            // New stage dialog
            newStageDialog: document.getElementById('new-stage-dialog'),
            newStageName: document.getElementById('new-stage-name'),
            newStageImage: document.getElementById('new-stage-image'),
            newStageWidth: document.getElementById('new-stage-width'),
            newStageHeight: document.getElementById('new-stage-height'),
            newStageCancelBtn: document.getElementById('new-stage-cancel-btn'),
            newStageCreateBtn: document.getElementById('new-stage-create-btn'),
            newStageCloseBtn: document.getElementById('new-stage-cancel'),

            // Tool palette
            toolPalette: document.getElementById('tool-palette'),
            toolButtons: {},
            brushSizeButtons: {},

            // Block settings
            durabilityButtons: document.querySelectorAll('.durability-btn'),
            colorPicker: document.getElementById('block-color'),

            // Line properties
            lineTypeButtons: document.querySelectorAll('.line-type-btn'),
            lineColorPicker: document.getElementById('line-color'),
            lineThickness: document.getElementById('line-thickness'),
            lineOpacity: document.getElementById('line-opacity'),
            paddleControl: document.getElementById('paddle-control'),
            gridSnap: document.getElementById('grid-snap'),
            paddleSettings: document.getElementById('paddle-settings'),
            tapSettings: document.getElementById('tap-settings'),
            tapRange: document.getElementById('tap-range'),
            pathSettings: document.getElementById('path-settings'),
            pathLineSelect: document.getElementById('path-line-select'),
            pathSpeedSettings: document.getElementById('path-speed-settings'),
            pathSpeed: document.getElementById('path-speed'),

            // Layer panel
            layerList: document.getElementById('layer-list'),
            addImageBtn: document.getElementById('btn-add-image'),
            addBlockLayerBtn: document.getElementById('btn-add-block-layer'),

            // Stage panel
            stageList: document.getElementById('stage-list'),
            createStageBtn: document.getElementById('btn-create-stage'),

            // Blockify dialog
            blockifyDialog: document.getElementById('blockify-dialog'),
            blockifySourceSelect: document.getElementById('blockify-source'),
            blockifyGridSize: document.getElementById('blockify-grid-size'),
            blockifyAlphaThreshold: document.getElementById('blockify-alpha-threshold'),
            blockifyAlphaValue: document.getElementById('blockify-alpha-value'),
            blockifyCoverageThreshold: document.getElementById('blockify-coverage-threshold'),
            blockifyCoverageValue: document.getElementById('blockify-coverage-value'),
            blockifyDurability: document.getElementById('blockify-durability'),
            blockifyUseImageColor: document.getElementById('blockify-use-image-color'),
            blockifyDefaultColor: document.getElementById('blockify-default-color'),
            blockifyTargetSelect: document.getElementById('blockify-target'),
            blockifyMergeBlocks: document.getElementById('blockify-merge-blocks'),
            blockifyPreviewCount: document.getElementById('blockify-preview-count'),
            blockifyCancelBtn: document.getElementById('blockify-cancel-btn'),
            blockifyCreateBtn: document.getElementById('blockify-create-btn'),
            blockifyCloseBtn: document.getElementById('blockify-close-btn'),

            // Context menu
            contextMenu: document.getElementById('layer-context-menu'),

            // Message panel
            messageList: document.getElementById('message-list'),
            copyMessagesBtn: document.getElementById('btn-copy-messages'),
            clearMessagesBtn: document.getElementById('btn-clear-messages'),

            // Block render settings
            blockRenderToggle: document.getElementById('block-render-toggle'),
            blockRenderContent: document.getElementById('block-render-content'),
            fillUseBlockColor: document.getElementById('fill-use-block-color'),
            fillColor: document.getElementById('fill-color'),
            fillColorGroup: document.getElementById('fill-color-group'),
            fillOpacity: document.getElementById('fill-opacity'),
            fillOpacityValue: document.getElementById('fill-opacity-value'),
            borderColor: document.getElementById('border-color'),
            borderWidth: document.getElementById('border-width'),
            borderWidthValue: document.getElementById('border-width-value'),
            embossHighlightColor: document.getElementById('emboss-highlight-color'),
            embossHighlightOpacity: document.getElementById('emboss-highlight-opacity'),
            embossHighlightOpacityValue: document.getElementById('emboss-highlight-opacity-value'),
            embossShadowColor: document.getElementById('emboss-shadow-color'),
            embossShadowOpacity: document.getElementById('emboss-shadow-opacity'),
            embossShadowOpacityValue: document.getElementById('emboss-shadow-opacity-value'),
            embossWidth: document.getElementById('emboss-width'),
            embossWidthValue: document.getElementById('emboss-width-value'),
            embossInset: document.getElementById('emboss-inset'),
            embossInsetValue: document.getElementById('emboss-inset-value')
        };

        // Cache tool buttons
        const tools = [TOOLS.SELECT, TOOLS.BRUSH, TOOLS.ERASER, TOOLS.FILL, TOOLS.LINE, TOOLS.EYEDROPPER];
        for (const tool of tools) {
            this.elements.toolButtons[tool] = document.getElementById(`tool-${tool}`);
        }

        // Cache brush size buttons
        for (const size of Object.keys(BRUSH_SIZES)) {
            this.elements.brushSizeButtons[size] = document.getElementById(`brush-${size.toLowerCase()}`);
        }
    }

    /**
     * Bind toolbar event listeners
     * @private
     */
    _bindToolbarEvents() {
        // Toolbar buttons
        this.elements.newBtn?.addEventListener('click', () => this.editor.newProject());
        this.elements.openBtn?.addEventListener('click', () => this._openProject());
        this.elements.saveBtn?.addEventListener('click', () => this._saveProject());

        // Undo/Redo buttons
        if (this.elements.undoBtn) {
            this.elements.undoBtn.addEventListener('click', () => this.editor.undo());
        }
        if (this.elements.redoBtn) {
            this.elements.redoBtn.addEventListener('click', () => this.editor.redo());
        }

        // Grid and line toggles
        this.elements.gridToggle?.addEventListener('change', (e) => {
            this.editor.renderSystem.showGrid = e.target.checked;
            this.editor.render();
        });

        this.elements.lineToggle?.addEventListener('change', (e) => {
            this.editor.renderSystem.showLines = e.target.checked;
            this.editor.render();
        });

        // Preview button
        this.elements.previewBtn?.addEventListener('click', () => {
            this.editor.previewStage();
        });
    }

    /**
     * Bind menu event listeners
     * @private
     */
    _bindMenuEvents() {
        document.getElementById('menu-new')?.addEventListener('click', () => this.editor.newProject());
        document.getElementById('menu-open')?.addEventListener('click', () => this._openProject());
        document.getElementById('menu-save')?.addEventListener('click', () => this._saveProject());
        document.getElementById('menu-save-as')?.addEventListener('click', () => this._saveProjectAs());
        document.getElementById('menu-export')?.addEventListener('click', () => this._exportStage());
        document.getElementById('menu-undo')?.addEventListener('click', () => this.editor.undo());
        document.getElementById('menu-redo')?.addEventListener('click', () => this.editor.redo());
        document.getElementById('menu-toggle-grid')?.addEventListener('click', () => this.editor.toggleGrid());
        document.getElementById('menu-toggle-lines')?.addEventListener('click', () => this.editor.toggleLines());
        document.getElementById('menu-reset-view')?.addEventListener('click', () => this.editor.resetView());
    }

    /**
     * Bind editor event handlers
     * @private
     */
    _bindEditorEvents() {
        this.editor.on('zoomChanged', (zoom) => this._updateZoomUI(zoom));
        this.editor.on('save', () => this._saveProject());
        this.editor.on('saveAs', () => this._saveProjectAs());
    }

    /**
     * Initialize toolbar state
     * @private
     */
    _initToolbar() {
        // Set initial grid toggle state
        if (this.elements.gridToggle) {
            this.elements.gridToggle.checked = this.editor.renderSystem?.showGrid ?? true;
        }
        if (this.elements.lineToggle) {
            this.elements.lineToggle.checked = this.editor.renderSystem?.showLines ?? true;
        }
    }

    /**
     * Update zoom display
     * @private
     */
    _updateZoomUI(zoom) {
        if (this.elements.zoomLevel) {
            this.elements.zoomLevel.textContent = `${Math.round(zoom * 100)}%`;
        }
    }

    /**
     * Open project file
     * @private
     */
    async _openProject() {
        await this.editor.projectFileSystem.openProject();
    }

    /**
     * Save project file
     * @private
     */
    async _saveProject() {
        await this.editor.projectFileSystem.saveProject();
    }

    /**
     * Save project file as new file
     * @private
     */
    async _saveProjectAs() {
        await this.editor.projectFileSystem.saveProjectAs();
    }

    /**
     * Export current stage as JSON
     * @private
     */
    async _exportStage() {
        await this.editor.projectFileSystem.exportCurrentStage();
    }

    /**
     * Add message to message panel (delegates to MessageController)
     * @param {string} type - Message type
     * @param {string} text - Message text
     */
    _addMessage(type, text) {
        this.messageController.addMessage(type, text);
    }

    // =========================================
    // Delegation Methods
    // =========================================

    /**
     * Get current block render settings
     * @returns {Object}
     */
    getBlockRenderSettings() {
        return this.blockRenderSettingsController.getSettings();
    }

    /**
     * Apply block render settings
     * @param {Object} settings
     */
    applyBlockRenderSettings(settings) {
        this.blockRenderSettingsController.applySettings(settings);
    }

    /**
     * Show blockify dialog
     * @param {number} [imageLayerId] - Pre-selected image layer
     */
    showBlockifyDialog(imageLayerId = null) {
        this.blockifyController.show(imageLayerId);
    }

    /**
     * Update layer list (delegation)
     */
    _updateLayerList() {
        this.layerPanelController.updateLayerList();
    }
}
