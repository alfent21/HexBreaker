/**
 * UIController.js - UI Event Handling
 * Based on specification.md Section 3
 * 
 * Handles UI panel interactions and updates.
 */

import { TOOLS, BRUSH_SIZES, LINE_TYPES, DURABILITY_COLORS, MESSAGE_TYPES } from '../core/Config.js';
import { dialogService } from './DialogService.js';
import { RENDER_CONFIG } from '../../shared/Renderer.js';
import { MessageController } from './controllers/MessageController.js';
import { BlockRenderSettingsController } from './controllers/BlockRenderSettingsController.js';
import { BlockifyController } from './controllers/BlockifyController.js';
import { ContextMenuController } from './controllers/ContextMenuController.js';

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
            () => this._updateLayerList()
        );
        this.contextMenuController = new ContextMenuController(
            editor,
            (type, text) => this._addMessage(type, text),
            () => this._updateLayerList(),
            (layerId) => this.showBlockifyDialog(layerId)
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

        this._bindUIEvents();
        this._bindEditorEvents();
        this._initToolbar();
        this._initToolPalette();
        this._initLayerPanel();

        // Initialize stage selector and list with current stages
        this._updateStageSelector();
        this._updateStageList();

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
            // Fill settings
            fillUseBlockColor: document.getElementById('fill-use-block-color'),
            fillColor: document.getElementById('fill-color'),
            fillColorGroup: document.getElementById('fill-color-group'),
            fillOpacity: document.getElementById('fill-opacity'),
            fillOpacityValue: document.getElementById('fill-opacity-value'),
            // Border settings
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
     * Bind UI event listeners
     * @private
     */
    _bindUIEvents() {
        // Toolbar buttons
        this.elements.newBtn?.addEventListener('click', () => this.editor.newProject());
        this.elements.openBtn?.addEventListener('click', () => this._openProject());
        this.elements.saveBtn?.addEventListener('click', () => this._saveProject());

        // Dropdown menu items
        document.getElementById('menu-new')?.addEventListener('click', () => this.editor.newProject());
        document.getElementById('menu-open')?.addEventListener('click', () => this._openProject());
        document.getElementById('menu-save')?.addEventListener('click', () => this._saveProject());
        document.getElementById('menu-save-as')?.addEventListener('click', () => this._saveProjectAs());
        document.getElementById('menu-export')?.addEventListener('click', () => this._exportStage());
        document.getElementById('menu-undo')?.addEventListener('click', () => this.editor.undo?.());
        document.getElementById('menu-redo')?.addEventListener('click', () => this.editor.redo?.());
        document.getElementById('menu-toggle-grid')?.addEventListener('click', () => this.editor.toggleGrid());
        document.getElementById('menu-toggle-lines')?.addEventListener('click', () => this.editor.toggleLines());
        document.getElementById('menu-reset-view')?.addEventListener('click', () => this.editor.resetView());

        this.elements.gridToggle?.addEventListener('change', (e) => {
            this.editor.renderSystem.showGrid = e.target.checked;
            this.editor.render();
        });

        this.elements.lineToggle?.addEventListener('change', (e) => {
            this.editor.renderSystem.showLines = e.target.checked;
            this.editor.render();
        });

        // Stage selector
        this.elements.stageSelect?.addEventListener('change', (e) => {
            this.editor.switchStage(e.target.value);
        });

        // Add stage button (toolbar)
        this.elements.addStageBtn?.addEventListener('click', () => {
            this._showNewStageDialog();
        });

        // Create stage button (panel)
        this.elements.createStageBtn?.addEventListener('click', () => {
            this._showNewStageDialog();
        });

        // Preview button
        this.elements.previewBtn?.addEventListener('click', () => {
            this.editor.previewStage();
        });

        // New stage dialog
        this.elements.newStageCloseBtn?.addEventListener('click', () => this._hideNewStageDialog());
        this.elements.newStageCancelBtn?.addEventListener('click', () => this._hideNewStageDialog());
        this.elements.newStageCreateBtn?.addEventListener('click', () => this._createNewStage());

        // Auto-fill size from image
        this.elements.newStageImage?.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                const img = new Image();
                img.onload = () => {
                    this.elements.newStageWidth.value = img.width;
                    this.elements.newStageHeight.value = img.height;
                };
                img.src = URL.createObjectURL(file);
            }
        });

        // Tool buttons
        for (const [tool, btn] of Object.entries(this.elements.toolButtons)) {
            btn?.addEventListener('click', () => this.editor.setTool(tool));
        }

        // Brush size buttons
        for (const [size, btn] of Object.entries(this.elements.brushSizeButtons)) {
            btn?.addEventListener('click', () => {
                this.editor.blockManager.setBrushSize(size);
                this._updateBrushSizeUI();
            });
        }

        // Durability buttons
        this.elements.durabilityButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                const durability = parseInt(btn.dataset.durability);
                this.editor.blockManager.setDurability(durability);
                this._updateDurabilityUI();
            });
        });

        // Color picker
        this.elements.colorPicker?.addEventListener('input', (e) => {
            this.editor.blockManager.setColor(e.target.value);
        });

        // Line type buttons (exclusive, switches to line tool)
        this.elements.lineTypeButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                const type = btn.dataset.type;

                // Update active state
                this.elements.lineTypeButtons.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');

                // Switch to line tool
                this.editor.setTool(TOOLS.LINE);

                // Set line type for new lines
                this.editor.lineManager.currentLineType = type;

                // Update selected line if any
                const selectedLine = this.editor.lineManager.getSelectedLine();
                if (selectedLine) {
                    this.editor.lineManager.updateLine(selectedLine.id, { type });
                }
            });
        });

        // Line properties
        this.elements.lineColorPicker?.addEventListener('input', (e) => {
            const selectedLine = this.editor.lineManager.getSelectedLine();
            if (selectedLine) {
                this.editor.lineManager.updateLine(selectedLine.id, { color: e.target.value });
            }
        });

        this.elements.lineThickness?.addEventListener('input', (e) => {
            const thickness = parseInt(e.target.value);
            // 新規ライン用の設定を更新
            this.editor.lineManager.currentThickness = thickness;
            // 選択中のラインも更新
            const selectedLine = this.editor.lineManager.getSelectedLine();
            if (selectedLine) {
                this.editor.lineManager.updateLine(selectedLine.id, { thickness });
            }
        });

        this.elements.lineOpacity?.addEventListener('input', (e) => {
            const opacity = parseFloat(e.target.value);
            // 新規ライン用の設定を更新
            this.editor.lineManager.currentOpacity = opacity;
            // 選択中のラインも更新
            const selectedLine = this.editor.lineManager.getSelectedLine();
            if (selectedLine) {
                this.editor.lineManager.updateLine(selectedLine.id, { opacity });
            }
        });

        // Grid snap toggle
        this.elements.gridSnap?.addEventListener('change', (e) => {
            this.editor.gridSnapEnabled = e.target.checked;
        });

        // Layer buttons
        this.elements.addImageBtn?.addEventListener('click', () => this.editor.importImages());
        this.elements.addBlockLayerBtn?.addEventListener('click', () => {
            const name = prompt('ブロックレイヤー名:', 'New Block Layer');
            if (name) {
                this.editor.addBlockLayer(name);
            }
        });

        // Note: Message panel events are handled by MessageController
        // Note: Block render settings events are handled by BlockRenderSettingsController
        // Note: Blockify dialog events are handled by BlockifyController
        // Note: Context menu events are handled by ContextMenuController
    }

    /**
     * Bind editor event handlers
     * @private
     */
    _bindEditorEvents() {
        this.editor.on('toolChanged', (tool) => this._updateToolUI(tool));
        this.editor.on('zoomChanged', (zoom) => this._updateZoomUI(zoom));
        this.editor.on('layersChanged', () => this._updateLayerList());
        this.editor.on('activeLayerChanged', () => this._updateLayerList());
        this.editor.on('lineSelected', (line) => this._updateLinePropertiesUI(line));
        this.editor.on('durabilityChanged', () => this._updateDurabilityUI());
        this.editor.on('brushSizeChanged', () => this._updateBrushSizeUI());
        // Note: 'message' event is handled by MessageController

        // Stage events
        this.editor.on('stagesChanged', () => {
            this._updateStageSelector();
            this._updateStageList();
        });
        this.editor.on('currentStageChanged', (stage) => this._onStageChanged(stage));

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

        // Set initial grid size
        if (this.elements.gridSizeSelect) {
            this.elements.gridSizeSelect.value = this.editor.currentGridSize;
        }
    }

    /**
     * Initialize tool palette
     * @private
     */
    _initToolPalette() {
        this._updateToolUI(this.editor.currentTool);
        this._updateBrushSizeUI();
        this._updateDurabilityUI();
    }

    /**
     * Initialize layer panel
     * @private
     */
    _initLayerPanel() {
        this._updateLayerList();
    }

    /**
     * Update tool button states
     * @private
     */
    _updateToolUI(activeTool) {
        for (const [tool, btn] of Object.entries(this.elements.toolButtons)) {
            if (btn) {
                btn.classList.toggle('active', tool === activeTool);
            }
        }
    }

    /**
     * Update brush size button states
     * @private
     */
    _updateBrushSizeUI() {
        const currentSize = this.editor.blockManager.brushSize;
        for (const [size, btn] of Object.entries(this.elements.brushSizeButtons)) {
            if (btn) {
                btn.classList.toggle('active', size === currentSize);
            }
        }
    }

    /**
     * Update durability button states
     * @private
     */
    _updateDurabilityUI() {
        const currentDurability = this.editor.blockManager.currentDurability;
        this.elements.durabilityButtons.forEach(btn => {
            const durability = parseInt(btn.dataset.durability);
            btn.classList.toggle('active', durability === currentDurability);
            btn.style.backgroundColor = DURABILITY_COLORS[durability];
        });
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
     * Update layer list
     * @private
     */
    _updateLayerList() {
        const list = this.elements.layerList;
        if (!list) return;

        list.innerHTML = '';

        const layers = this.editor.layerManager.getAllLayers().slice().reverse();
        const baseLayer = this.editor.layerManager.getBaseLayer();
        const activeId = this.editor.layerManager.activeLayerId;

        // Render regular layers first (in reverse order for top-to-bottom display)
        for (const layer of layers) {
            const item = this._createLayerItem(layer, activeId, false);
            list.appendChild(item);
        }

        // Render base layer at the bottom (it's the foundation)
        if (baseLayer) {
            const item = this._createLayerItem(baseLayer, activeId, true);
            list.appendChild(item);
        }
    }

    /**
     * Create a layer item element
     * @private
     * @param {Object} layer - Layer data
     * @param {number} activeId - Currently active layer ID
     * @param {boolean} isBaseLayer - Whether this is the base layer
     * @returns {HTMLElement}
     */
    _createLayerItem(layer, activeId, isBaseLayer) {
        const item = document.createElement('div');
        item.className = `layer-item ${layer.id === activeId ? 'active' : ''} ${isBaseLayer ? 'base-layer' : ''}`;
        item.dataset.layerId = layer.id;

        const layerType = layer.type || 'image';
        const isImageType = layerType === 'image' || layerType === 'base';
        const typeIcon = isImageType ? '<i class="fas fa-image"></i>' : '<i class="fas fa-cubes"></i>';
        const typeClass = isImageType ? 'layer-type-image' : 'layer-type-block';
        const isVisible = layer.visible !== false;

        // ブロックレイヤーのソース画像リンク状態を取得
        const hasSourceLink = layerType === 'block' && layer.sourceLayerId !== null && layer.sourceLayerId !== undefined;
        const linkIndicator = hasSourceLink ? '<span class="layer-link-indicator" title="画像にリンク中"><i class="fas fa-link"></i></span>' : '';

        item.innerHTML = `
            <input type="checkbox" class="layer-checkbox"
                ${this.editor.layerManager.checkedLayerIds.has(layer.id) ? 'checked' : ''}>
            <span class="layer-visibility ${isVisible ? '' : 'is-hidden'}"
                data-action="toggle-visibility">
                <i class="fas ${isVisible ? 'fa-eye' : 'fa-eye-slash'}"></i>
            </span>
            <span class="layer-icon ${typeClass}">
                ${typeIcon}
            </span>
            <span class="layer-name">${layer.name}${linkIndicator}${isBaseLayer ? ' <span class="layer-badge">ベース</span>' : ''}</span>
            <div class="layer-actions">
                ${isBaseLayer ? '' : '<button class="layer-action-btn" data-action="delete" title="削除"><i class="fas fa-trash"></i></button>'}
            </div>
        `;

        // Click to select (base layer is not selectable as active)
        if (!isBaseLayer) {
            item.addEventListener('click', (e) => {
                if (e.target.closest('[data-action]') || e.target.type === 'checkbox') return;
                this.editor.layerManager.setActiveLayer(layer.id);
            });
        }

        // Checkbox for multi-select
        item.querySelector('.layer-checkbox').addEventListener('change', (e) => {
            this.editor.layerManager.toggleLayerCheck(layer.id);
        });

        // Visibility toggle
        item.querySelector('[data-action="toggle-visibility"]').addEventListener('click', () => {
            if (isBaseLayer) {
                // Toggle base layer visibility
                layer.visible = layer.visible === false ? true : false;
                this.editor.render();
                this._updateLayerList();
            } else {
                this.editor.layerManager.toggleLayerVisibility(layer.id);
            }
        });

        // Delete button (only for non-base layers)
        const deleteBtn = item.querySelector('[data-action="delete"]');
        if (deleteBtn) {
            deleteBtn.addEventListener('click', async (e) => {
                e.stopPropagation();
                if (await dialogService.confirm(`レイヤー "${layer.name}" を削除しますか？`, { type: 'danger' })) {
                    this.editor.layerManager.removeLayer(layer.id);
                }
            });
        }

        return item;
    }

    /**
     * Update line properties panel
     * @private
     */
    _updateLinePropertiesUI(line) {
        if (!line) {
            // Clear/disable line properties
            return;
        }

        // Update type buttons
        this.elements.lineTypeButtons.forEach(btn => {
            btn.classList.toggle('active', btn.dataset.type === line.type);
        });

        // Update color
        if (this.elements.lineColorPicker) {
            this.elements.lineColorPicker.value = line.color;
        }

        // Update thickness
        if (this.elements.lineThickness) {
            this.elements.lineThickness.value = line.thickness;
        }

        // Update opacity
        if (this.elements.lineOpacity) {
            this.elements.lineOpacity.value = line.opacity;
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
    // Stage Management Methods
    // =========================================

    /**
     * Show new stage dialog
     * @private
     */
    _showNewStageDialog() {
        const dialog = this.elements.newStageDialog;
        if (!dialog) return;

        // Reset form
        this.elements.newStageName.value = '';
        this.elements.newStageImage.value = '';
        this.elements.newStageWidth.value = '1280';
        this.elements.newStageHeight.value = '720';
        document.querySelector('input[name="grid-size"][value="medium"]')?.click();

        dialog.classList.remove('hidden');
    }

    /**
     * Hide new stage dialog
     * @private
     */
    _hideNewStageDialog() {
        this.elements.newStageDialog?.classList.add('hidden');
    }

    /**
     * Create new stage from dialog
     * @private
     */
    async _createNewStage() {
        const name = this.elements.newStageName.value || `Stage ${this.editor.getAllStages().length + 1}`;
        let width = parseInt(this.elements.newStageWidth.value) || 1280;
        let height = parseInt(this.elements.newStageHeight.value) || 720;
        const gridSize = document.querySelector('input[name="grid-size"]:checked')?.value || 'medium';
        const imageFile = this.elements.newStageImage.files?.[0];

        // If image provided, ensure we get actual image dimensions
        if (imageFile) {
            try {
                const dimensions = await this._getImageDimensions(imageFile);
                width = dimensions.width;
                height = dimensions.height;
                this._addMessage('info', `[DEBUG] 画像サイズ取得: ${width}x${height}`);
            } catch (error) {
                this._addMessage('warning', `画像サイズ取得失敗: ${error.message}`);
            }
        }

        // Create stage with correct dimensions
        const stage = this.editor.createStage({
            name,
            width,
            height,
            gridSize
        });

        this._addMessage('info', `[DEBUG] ステージ作成: キャンバスサイズ ${width}x${height}`);

        // If base image provided, add it as first layer
        if (imageFile && stage) {
            try {
                await this.editor.addImageLayer(imageFile);
                this._addMessage('info', `[DEBUG] 画像レイヤー追加完了`);
            } catch (error) {
                this._addMessage('error', `画像の追加に失敗: ${error.message}`);
            }
        }

        this._hideNewStageDialog();
        this._updateStageSelector();
    }

    /**
     * Get image dimensions from file
     * @private
     * @param {File} file
     * @returns {Promise<{width: number, height: number}>}
     */
    _getImageDimensions(file) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => {
                console.log(`[DEBUG] Image loaded: ${img.width}x${img.height} (natural: ${img.naturalWidth}x${img.naturalHeight})`);
                URL.revokeObjectURL(img.src);
                resolve({ width: img.naturalWidth, height: img.naturalHeight });
            };
            img.onerror = () => {
                URL.revokeObjectURL(img.src);
                reject(new Error('Failed to load image'));
            };
            img.src = URL.createObjectURL(file);
        });
    }

    /**
     * Update stage selector dropdown
     * @private
     */
    _updateStageSelector() {
        const select = this.elements.stageSelect;
        if (!select) return;

        const stages = this.editor.getAllStages();
        const currentStage = this.editor.getCurrentStage();

        select.innerHTML = stages.map(stage =>
            `<option value="${stage.id}" ${stage.id === currentStage?.id ? 'selected' : ''}>
                ${stage.name}
            </option>`
        ).join('');
    }

    /**
     * Update stage list in panel
     * @private
     */
    _updateStageList() {
        const list = this.elements.stageList;
        if (!list) return;

        const stages = this.editor.getAllStages();
        const currentStage = this.editor.getCurrentStage();

        if (stages.length === 0) {
            list.innerHTML = '<div class="empty-message">ステージがありません</div>';
            return;
        }

        list.innerHTML = stages.map((stage, index) => {
            const isBaseStage = index === 0;
            const canDelete = !isBaseStage && stages.length > 1;

            return `
                <div class="stage-item ${stage.id === currentStage?.id ? 'active' : ''} ${isBaseStage ? 'base-stage' : ''}" data-stage-id="${stage.id}">
                    <span class="stage-name">${stage.name}${isBaseStage ? ' <span class="stage-badge">ベース</span>' : ''}</span>
                    <span class="stage-info">${stage.canvas.width}×${stage.canvas.height}</span>
                    <div class="stage-actions">
                        <button class="btn btn--icon btn--small stage-duplicate-btn" data-stage-id="${stage.id}" title="複製">
                            <i class="fas fa-copy"></i>
                        </button>
                        <button class="btn btn--icon btn--small stage-delete-btn" data-stage-id="${stage.id}" title="削除" ${canDelete ? '' : 'disabled'}>
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
            `;
        }).join('');

        // Bind click events for stage selection
        list.querySelectorAll('.stage-item').forEach(item => {
            item.addEventListener('click', (e) => {
                if (e.target.closest('.stage-actions')) return;
                const stageId = item.dataset.stageId;
                this.editor.switchStage(stageId);
            });
        });

        // Bind duplicate buttons
        list.querySelectorAll('.stage-duplicate-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const stageId = btn.dataset.stageId;
                this.editor.duplicateStage(stageId);
            });
        });

        // Bind delete buttons
        list.querySelectorAll('.stage-delete-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const stageId = btn.dataset.stageId;
                if (confirm('このステージを削除しますか？')) {
                    this.editor.deleteStage(stageId);
                }
            });
        });
    }

    /**
     * Handle stage change
     * @private
     */
    _onStageChanged(stage) {
        this._updateStageSelector();
        this._updateStageList();
        this._updateLayerList();

        if (stage) {
            this._addMessage('info', `ステージ「${stage.name}」を選択しました`);
        }
    }

    // =========================================
    // Block Render Settings Methods (delegated to BlockRenderSettingsController)
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

    // =========================================
    // Blockify Dialog Methods (delegated to BlockifyController)
    // =========================================

    /**
     * Show blockify dialog
     * @param {number} [imageLayerId] - Pre-selected image layer
     */
    showBlockifyDialog(imageLayerId = null) {
        this.blockifyController.show(imageLayerId);
    }

    // Note: Context menu methods are delegated to ContextMenuController
}

