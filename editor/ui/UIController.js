/**
 * UIController.js - UI Event Handling
 * Based on specification.md Section 3
 * 
 * Handles UI panel interactions and updates.
 */

import { TOOLS, BRUSH_SIZES, LINE_TYPES, DURABILITY_COLORS, MESSAGE_TYPES } from '../core/Config.js';
import { dialogService } from './DialogService.js';
import { RENDER_CONFIG } from '../../shared/Renderer.js';

export class UIController {
    /**
     * @param {import('../core/Editor.js').Editor} editor
     */
    constructor(editor) {
        this.editor = editor;
        this.editor.uiController = this;

        // UI element references
        this.elements = {};

        // Message queue
        this.messages = [];
        this.maxMessages = 50;
    }

    /**
     * Initialize UI
     */
    init() {
        this._cacheElements();
        this._bindUIEvents();
        this._bindEditorEvents();
        this._initToolbar();
        this._initToolPalette();
        this._initLayerPanel();

        // Initialize stage selector and list with current stages
        this._updateStageSelector();
        this._updateStageList();

        console.log('UI Controller initialized');
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

        // Message panel
        this.elements.copyMessagesBtn?.addEventListener('click', () => this._copyAllMessages());
        this.elements.clearMessagesBtn?.addEventListener('click', () => this._clearMessages());

        // Block render settings
        this._bindBlockRenderSettingsEvents();

        // Blockify dialog
        this._bindBlockifyDialogEvents();

        // Context menu
        this._bindContextMenuEvents();
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
        this.editor.on('message', (msg) => this._addMessage(msg.type, msg.text));

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
     * Add message to message panel
     * @private
     */
    _addMessage(type, text) {
        const typeConfig = MESSAGE_TYPES[type.toUpperCase()] || MESSAGE_TYPES.INFO;

        const message = {
            type,
            text,
            time: new Date().toLocaleTimeString()
        };

        this.messages.push(message);
        if (this.messages.length > this.maxMessages) {
            this.messages.shift();
        }

        this._renderMessages();
    }

    /**
     * Render messages
     * @private
     */
    _renderMessages() {
        const list = this.elements.messageList;
        if (!list) return;

        list.innerHTML = '';

        for (const msg of this.messages.slice(-10)) {
            const typeConfig = MESSAGE_TYPES[msg.type.toUpperCase()] || MESSAGE_TYPES.INFO;
            const div = document.createElement('div');
            div.className = `message ${typeConfig.className}`;
            div.innerHTML = `<span class="message-icon">${typeConfig.icon}</span><span class="message-text">${msg.text}</span><span class="message-time">${msg.time}</span><button class="message-copy-btn" title="コピー">📋</button>`;

            // Add copy button click handler
            const copyBtn = div.querySelector('.message-copy-btn');
            copyBtn.addEventListener('click', () => {
                navigator.clipboard.writeText(msg.text).then(() => {
                    copyBtn.textContent = '✓';
                    setTimeout(() => { copyBtn.textContent = '📋'; }, 1000);
                });
            });

            list.appendChild(div);
        }

        // Scroll to bottom
        list.scrollTop = list.scrollHeight;
    }

    /**
     * Clear all messages
     * @private
     */
    _clearMessages() {
        this.messages = [];
        this._renderMessages();
    }

    /**
     * Copy all messages to clipboard
     * @private
     */
    _copyAllMessages() {
        const text = this.messages.map(msg => `[${msg.time}] ${msg.text}`).join('\n');
        navigator.clipboard.writeText(text).then(() => {
            const btn = this.elements.copyMessagesBtn;
            if (btn) {
                const original = btn.textContent;
                btn.textContent = '✓';
                setTimeout(() => { btn.textContent = original; }, 1000);
            }
        });
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
    // Block Render Settings Methods
    // =========================================

    /**
     * Bind block render settings events
     * @private
     */
    _bindBlockRenderSettingsEvents() {
        // 必須要素の検証（存在しなければエラーを出力）
        const requiredElements = [
            'blockRenderToggle',
            'fillUseBlockColor', 'fillColor', 'fillOpacity', 'fillOpacityValue',
            'borderColor', 'borderWidth', 'borderWidthValue',
            'embossHighlightColor', 'embossHighlightOpacity', 'embossHighlightOpacityValue',
            'embossShadowColor', 'embossShadowOpacity', 'embossShadowOpacityValue',
            'embossWidth', 'embossWidthValue', 'embossInset', 'embossInsetValue'
        ];

        for (const name of requiredElements) {
            if (!this.elements[name]) {
                this._addMessage('error', `[UIController] 要素が見つかりません: ${name}`);
            }
        }

        // Collapsible toggle
        if (this.elements.blockRenderToggle) {
            this.elements.blockRenderToggle.addEventListener('click', () => {
                const section = this.elements.blockRenderToggle.closest('.collapsible');
                if (section) section.classList.toggle('collapsed');
            });
        }

        // Fill: Use block color checkbox
        if (this.elements.fillUseBlockColor) {
            this.elements.fillUseBlockColor.addEventListener('change', (e) => {
                const useBlockColor = e.target.checked;
                RENDER_CONFIG.block.fill.color = useBlockColor ? null : this.elements.fillColor.value;
                if (this.elements.fillColor) {
                    this.elements.fillColor.disabled = useBlockColor;
                }
                this.editor.render();
            });
        }

        // Fill color
        if (this.elements.fillColor) {
            this.elements.fillColor.addEventListener('input', (e) => {
                if (this.elements.fillUseBlockColor && !this.elements.fillUseBlockColor.checked) {
                    RENDER_CONFIG.block.fill.color = e.target.value;
                    this.editor.render();
                }
            });
        }

        // Fill opacity
        if (this.elements.fillOpacity) {
            this.elements.fillOpacity.addEventListener('input', (e) => {
                const value = parseInt(e.target.value);
                RENDER_CONFIG.block.fill.opacity = value / 100;
                if (this.elements.fillOpacityValue) {
                    this.elements.fillOpacityValue.textContent = value;
                }
                this.editor.render();
            });
        }

        // Border color
        if (this.elements.borderColor) {
            this.elements.borderColor.addEventListener('input', (e) => {
                RENDER_CONFIG.block.border.color = e.target.value;
                this.editor.render();
            });
        }

        // Border width
        if (this.elements.borderWidth) {
            this.elements.borderWidth.addEventListener('input', (e) => {
                const value = parseFloat(e.target.value);
                RENDER_CONFIG.block.border.widthRatio = value / 100;
                if (this.elements.borderWidthValue) {
                    this.elements.borderWidthValue.textContent = value;
                }
                this.editor.render();
            });
        }

        // Emboss highlight color
        if (this.elements.embossHighlightColor) {
            this.elements.embossHighlightColor.addEventListener('input', (e) => {
                RENDER_CONFIG.block.emboss.highlightColor = e.target.value;
                this.editor.render();
            });
        }

        // Emboss highlight opacity
        if (this.elements.embossHighlightOpacity) {
            this.elements.embossHighlightOpacity.addEventListener('input', (e) => {
                const value = parseInt(e.target.value);
                RENDER_CONFIG.block.emboss.highlightOpacity = value / 100;
                if (this.elements.embossHighlightOpacityValue) {
                    this.elements.embossHighlightOpacityValue.textContent = value;
                }
                this.editor.render();
            });
        }

        // Emboss shadow color
        if (this.elements.embossShadowColor) {
            this.elements.embossShadowColor.addEventListener('input', (e) => {
                RENDER_CONFIG.block.emboss.shadowColor = e.target.value;
                this.editor.render();
            });
        }

        // Emboss shadow opacity
        if (this.elements.embossShadowOpacity) {
            this.elements.embossShadowOpacity.addEventListener('input', (e) => {
                const value = parseInt(e.target.value);
                RENDER_CONFIG.block.emboss.shadowOpacity = value / 100;
                if (this.elements.embossShadowOpacityValue) {
                    this.elements.embossShadowOpacityValue.textContent = value;
                }
                this.editor.render();
            });
        }

        // Emboss width
        if (this.elements.embossWidth) {
            this.elements.embossWidth.addEventListener('input', (e) => {
                const value = parseInt(e.target.value);
                RENDER_CONFIG.block.emboss.lineWidthRatio = value / 100;
                if (this.elements.embossWidthValue) {
                    this.elements.embossWidthValue.textContent = value;
                }
                this.editor.render();
            });
        }

        // Emboss inset
        if (this.elements.embossInset) {
            this.elements.embossInset.addEventListener('input', (e) => {
                const value = parseInt(e.target.value);
                RENDER_CONFIG.block.emboss.insetRatio = value / 100;
                if (this.elements.embossInsetValue) {
                    this.elements.embossInsetValue.textContent = value;
                }
                this.editor.render();
            });
        }
    }

    /**
     * Update block render settings UI from current RENDER_CONFIG
     * @private
     */
    _updateBlockRenderSettingsUI() {
        const fill = RENDER_CONFIG.block.fill;
        const border = RENDER_CONFIG.block.border;
        const emboss = RENDER_CONFIG.block.emboss;

        // Fill settings
        if (this.elements.fillUseBlockColor) {
            this.elements.fillUseBlockColor.checked = fill.color === null;
        }
        if (this.elements.fillColor) {
            this.elements.fillColor.value = fill.color || '#888888';
            this.elements.fillColor.disabled = fill.color === null;
        }
        if (this.elements.fillOpacity) {
            const value = Math.round(fill.opacity * 100);
            this.elements.fillOpacity.value = value;
            if (this.elements.fillOpacityValue) {
                this.elements.fillOpacityValue.textContent = value;
            }
        }

        // Border settings
        if (this.elements.borderColor) {
            this.elements.borderColor.value = border.color;
        }
        if (this.elements.borderWidth) {
            const value = Math.round(border.widthRatio * 100);
            this.elements.borderWidth.value = value;
            if (this.elements.borderWidthValue) {
                this.elements.borderWidthValue.textContent = value;
            }
        }
        if (this.elements.embossHighlightColor) {
            this.elements.embossHighlightColor.value = emboss.highlightColor;
        }
        if (this.elements.embossHighlightOpacity) {
            const value = Math.round(emboss.highlightOpacity * 100);
            this.elements.embossHighlightOpacity.value = value;
            if (this.elements.embossHighlightOpacityValue) {
                this.elements.embossHighlightOpacityValue.textContent = value;
            }
        }
        if (this.elements.embossShadowColor) {
            this.elements.embossShadowColor.value = emboss.shadowColor;
        }
        if (this.elements.embossShadowOpacity) {
            const value = Math.round(emboss.shadowOpacity * 100);
            this.elements.embossShadowOpacity.value = value;
            if (this.elements.embossShadowOpacityValue) {
                this.elements.embossShadowOpacityValue.textContent = value;
            }
        }
        if (this.elements.embossWidth) {
            const value = Math.round(emboss.lineWidthRatio * 100);
            this.elements.embossWidth.value = value;
            if (this.elements.embossWidthValue) {
                this.elements.embossWidthValue.textContent = value;
            }
        }
        if (this.elements.embossInset) {
            const value = Math.round(emboss.insetRatio * 100);
            this.elements.embossInset.value = value;
            if (this.elements.embossInsetValue) {
                this.elements.embossInsetValue.textContent = value;
            }
        }
    }

    /**
     * Get current block render settings
     * @returns {Object}
     */
    getBlockRenderSettings() {
        return {
            fill: { ...RENDER_CONFIG.block.fill },
            border: { ...RENDER_CONFIG.block.border },
            emboss: { ...RENDER_CONFIG.block.emboss }
        };
    }

    /**
     * Apply block render settings
     * @param {Object} settings
     */
    applyBlockRenderSettings(settings) {
        if (settings?.fill) {
            Object.assign(RENDER_CONFIG.block.fill, settings.fill);
        }
        if (settings?.border) {
            Object.assign(RENDER_CONFIG.block.border, settings.border);
        }
        if (settings?.emboss) {
            Object.assign(RENDER_CONFIG.block.emboss, settings.emboss);
        }
        this._updateBlockRenderSettingsUI();
        this.editor.render();
    }

    // =========================================
    // Blockify Dialog Methods
    // =========================================

    /**
     * Bind blockify dialog events
     * @private
     */
    _bindBlockifyDialogEvents() {
        // Close buttons
        this.elements.blockifyCloseBtn?.addEventListener('click', () => this._hideBlockifyDialog());
        this.elements.blockifyCancelBtn?.addEventListener('click', () => this._hideBlockifyDialog());

        // Create button
        this.elements.blockifyCreateBtn?.addEventListener('click', () => this._executeBlockify());

        // Alpha threshold slider
        this.elements.blockifyAlphaThreshold?.addEventListener('input', (e) => {
            if (this.elements.blockifyAlphaValue) {
                this.elements.blockifyAlphaValue.textContent = e.target.value;
            }
            this._updateBlockifyPreview();
        });

        // Coverage threshold slider
        this.elements.blockifyCoverageThreshold?.addEventListener('input', (e) => {
            if (this.elements.blockifyCoverageValue) {
                this.elements.blockifyCoverageValue.textContent = `${Math.round(e.target.value * 100)}%`;
            }
            this._updateBlockifyPreview();
        });

        // Other options that affect preview
        this.elements.blockifySourceSelect?.addEventListener('change', () => this._updateBlockifyPreview());
        this.elements.blockifyGridSize?.addEventListener('change', () => this._updateBlockifyPreview());

        // Toggle default color picker visibility
        this.elements.blockifyUseImageColor?.addEventListener('change', (e) => {
            const colorPicker = this.elements.blockifyDefaultColor?.parentElement;
            if (colorPicker) {
                colorPicker.style.display = e.target.checked ? 'none' : 'block';
            }
        });
    }

    /**
     * Show blockify dialog
     * @param {number} [imageLayerId] - Pre-selected image layer
     */
    showBlockifyDialog(imageLayerId = null) {
        const dialog = this.elements.blockifyDialog;
        if (!dialog) return;

        // Populate source image selector
        this._populateBlockifySourceSelect(imageLayerId);

        // Populate target layer selector
        this._populateBlockifyTargetSelect();

        // Reset form values
        if (this.elements.blockifyGridSize) {
            this.elements.blockifyGridSize.value = 'medium';
        }
        if (this.elements.blockifyAlphaThreshold) {
            this.elements.blockifyAlphaThreshold.value = 128;
            this.elements.blockifyAlphaValue.textContent = '128';
        }
        if (this.elements.blockifyCoverageThreshold) {
            this.elements.blockifyCoverageThreshold.value = 0.3;
            this.elements.blockifyCoverageValue.textContent = '30%';
        }
        if (this.elements.blockifyDurability) {
            this.elements.blockifyDurability.value = 1;
        }
        if (this.elements.blockifyUseImageColor) {
            this.elements.blockifyUseImageColor.checked = true;
        }
        if (this.elements.blockifyMergeBlocks) {
            this.elements.blockifyMergeBlocks.checked = false;
        }

        // Update preview
        this._updateBlockifyPreview();

        dialog.classList.remove('hidden');
    }

    /**
     * Hide blockify dialog
     * @private
     */
    _hideBlockifyDialog() {
        this.elements.blockifyDialog?.classList.add('hidden');
    }

    /**
     * Populate source image selector
     * @private
     */
    _populateBlockifySourceSelect(preselectedId = null) {
        const select = this.elements.blockifySourceSelect;
        if (!select) return;

        const imageLayers = this.editor.layerManager.getImageLayers();

        select.innerHTML = imageLayers.map(layer =>
            `<option value="${layer.id}" ${layer.id === preselectedId ? 'selected' : ''}>
                ${layer.name}
            </option>`
        ).join('');

        // If no preselection, select first
        if (!preselectedId && imageLayers.length > 0) {
            select.value = imageLayers[0].id;
        }
    }

    /**
     * Populate target layer selector
     * @private
     */
    _populateBlockifyTargetSelect() {
        const select = this.elements.blockifyTargetSelect;
        if (!select) return;

        const blockLayers = this.editor.layerManager.getBlockLayers();

        select.innerHTML = '<option value="">新規ブロックレイヤー</option>' +
            blockLayers.map(layer =>
                `<option value="${layer.id}">${layer.name}</option>`
            ).join('');
    }

    /**
     * Update blockify preview count
     * @private
     */
    _updateBlockifyPreview() {
        const countEl = this.elements.blockifyPreviewCount;
        if (!countEl) return;

        const sourceId = parseInt(this.elements.blockifySourceSelect?.value);
        if (!sourceId) {
            countEl.textContent = '0';
            return;
        }

        const options = this._getBlockifyOptions();
        const preview = this.editor.layerManager.getBlockifyPreview(sourceId, options);

        countEl.textContent = preview.filledHexes.toString();
    }

    /**
     * Get blockify options from form
     * @private
     * @returns {Object}
     */
    _getBlockifyOptions() {
        return {
            gridSize: this.elements.blockifyGridSize?.value || 'medium',
            alphaThreshold: parseInt(this.elements.blockifyAlphaThreshold?.value) || 128,
            coverageThreshold: parseFloat(this.elements.blockifyCoverageThreshold?.value) || 0.3,
            defaultDurability: parseInt(this.elements.blockifyDurability?.value) || 1,
            defaultColor: this.elements.blockifyDefaultColor?.value || '#64B5F6',
            useImageColor: this.elements.blockifyUseImageColor?.checked ?? true
        };
    }

    /**
     * Execute blockify operation
     * @private
     */
    _executeBlockify() {
        const sourceId = parseInt(this.elements.blockifySourceSelect?.value);
        if (!sourceId) {
            this._addMessage('error', 'ソース画像を選択してください');
            return;
        }

        const options = this._getBlockifyOptions();

        // Add target layer options
        const targetId = this.elements.blockifyTargetSelect?.value;
        if (targetId) {
            options.targetLayerId = parseInt(targetId);
            options.mergeBlocks = this.elements.blockifyMergeBlocks?.checked ?? false;
        }

        try {
            const blockLayer = this.editor.layerManager.blockifyLayer(sourceId, options);
            this._addMessage('info', `ブロック化完了: ${blockLayer.blocks.size} ブロック生成`);
            this._hideBlockifyDialog();
            this._updateLayerList();
            this.editor.render();
        } catch (error) {
            this._addMessage('error', `ブロック化に失敗しました: ${error.message}`);
        }
    }

    // =========================================
    // Context Menu Methods
    // =========================================

    /**
     * Bind context menu events
     * @private
     */
    _bindContextMenuEvents() {
        const contextMenu = this.elements.contextMenu;
        if (!contextMenu) return;

        // Close on click outside
        document.addEventListener('click', (e) => {
            if (!contextMenu.contains(e.target)) {
                this._hideContextMenu();
            }
        });

        // Close on escape
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this._hideContextMenu();
            }
        });

        // Right-click on layer list
        this.elements.layerList?.addEventListener('contextmenu', (e) => {
            const layerItem = e.target.closest('.layer-item');
            if (layerItem) {
                e.preventDefault();
                const layerId = parseInt(layerItem.dataset.layerId);
                this._showContextMenu(e.clientX, e.clientY, layerId);
            }
        });
    }

    /**
     * Show context menu for a layer
     * @private
     */
    _showContextMenu(x, y, layerId) {
        const menu = this.elements.contextMenu;
        if (!menu) return;

        // ベースレイヤーの場合は特別処理
        const isBaseLayer = layerId === 0;
        const layer = isBaseLayer
            ? this.editor.layerManager.getBaseLayer()
            : this.editor.layerManager.getLayer(layerId);
        if (!layer) return;

        this._currentContextLayerId = layerId;

        // Build menu items based on layer type
        const items = [];

        if (isBaseLayer) {
            // ベースレイヤー専用メニュー
            items.push({ label: '名前を変更', action: 'rename', icon: '✏️' });
            items.push({ label: '画像を差し替え', action: 'replace-image', icon: '🖼️' });
        } else {
            // 通常レイヤーメニュー
            items.push({ label: '名前を変更', action: 'rename', icon: '✏️' });
            items.push({ label: '複製', action: 'duplicate', icon: '📋' });
            items.push({ type: 'separator' });

            // Image layer specific
            if (layer.type === 'image') {
                items.push({ label: 'ブロック化...', action: 'blockify', icon: '🧱' });
                items.push({ type: 'separator' });
            }

            // Block layer specific
            if (layer.type === 'block') {
                items.push({ label: 'ソース画像を設定...', action: 'set-source-image', icon: '🔗' });
                items.push({ label: 'ブロックをクリア', action: 'clear-blocks', icon: '🗑️' });
                items.push({ type: 'separator' });
            }

            items.push({ label: '上へ移動', action: 'move-up', icon: '⬆️' });
            items.push({ label: '下へ移動', action: 'move-down', icon: '⬇️' });
            items.push({ type: 'separator' });
            items.push({ label: '削除', action: 'delete', icon: '🗑️', danger: true });
        }

        // Render menu
        menu.innerHTML = items.map(item => {
            if (item.type === 'separator') {
                return '<div class="context-menu-separator"></div>';
            }
            return `
                <div class="context-menu-item ${item.danger ? 'danger' : ''}" data-action="${item.action}">
                    <span class="context-menu-icon">${item.icon}</span>
                    <span class="context-menu-label">${item.label}</span>
                </div>
            `;
        }).join('');

        // Bind click handlers
        menu.querySelectorAll('.context-menu-item').forEach(item => {
            item.addEventListener('click', () => {
                this._executeContextMenuAction(item.dataset.action);
                this._hideContextMenu();
            });
        });

        // Position menu
        menu.style.left = `${x}px`;
        menu.style.top = `${y}px`;
        menu.classList.remove('hidden');

        // Adjust if off-screen
        const rect = menu.getBoundingClientRect();
        if (rect.right > window.innerWidth) {
            menu.style.left = `${window.innerWidth - rect.width - 10}px`;
        }
        if (rect.bottom > window.innerHeight) {
            menu.style.top = `${window.innerHeight - rect.height - 10}px`;
        }
    }

    /**
     * Hide context menu
     * @private
     */
    _hideContextMenu() {
        this.elements.contextMenu?.classList.add('hidden');
        this._currentContextLayerId = null;
    }

    /**
     * Execute context menu action
     * @private
     */
    async _executeContextMenuAction(action) {
        const layerId = this._currentContextLayerId;
        if (layerId === null || layerId === undefined) return;

        // ベースレイヤーの場合は特別処理
        const isBaseLayer = layerId === 0;
        const layer = isBaseLayer
            ? this.editor.layerManager.getBaseLayer()
            : this.editor.layerManager.getLayer(layerId);
        if (!layer) return;

        switch (action) {
            case 'rename': {
                const newName = prompt('新しい名前:', layer.name);
                if (newName && newName !== layer.name) {
                    if (isBaseLayer) {
                        layer.name = newName;
                        this._updateLayerList();
                    } else {
                        this.editor.layerManager.renameLayer(layerId, newName);
                    }
                }
                break;
            }

            case 'replace-image': {
                // ベースレイヤーの画像差し替え
                const input = document.createElement('input');
                input.type = 'file';
                input.accept = 'image/*';
                input.onchange = async (e) => {
                    const file = e.target.files[0];
                    if (file) {
                        try {
                            await this.editor.layerManager.updateBaseLayerFromFile(file);
                            this.editor.render();
                            this._addMessage('info', '画像を差し替えました');
                        } catch (error) {
                            this._addMessage('error', `画像の差し替えに失敗: ${error.message}`);
                        }
                    }
                };
                input.click();
                break;
            }

            case 'duplicate': {
                try {
                    const newLayer = this.editor.layerManager.duplicateLayer(layerId);
                    this._addMessage('info', `レイヤー「${newLayer.name}」を作成しました`);
                } catch (error) {
                    this._addMessage('error', `複製に失敗しました: ${error.message}`);
                }
                break;
            }

            case 'blockify': {
                this.showBlockifyDialog(layerId);
                break;
            }

            case 'clear-blocks': {
                if (layer.type === 'block' && await dialogService.confirm('すべてのブロックを削除しますか？', { type: 'danger' })) {
                    layer.blocks.clear();
                    this.editor.render();
                    this._addMessage('info', 'ブロックをクリアしました');
                }
                break;
            }

            case 'set-source-image': {
                if (layer.type !== 'block') break;

                // 利用可能な画像レイヤーを取得
                const imageLayers = this.editor.layerManager.getImageLayers();

                if (imageLayers.length === 0) {
                    this._addMessage('warning', '画像レイヤーがありません');
                    break;
                }

                // 選択肢を構築（現在リンク中のものにマーク、解除オプションも含む）
                const currentSourceId = layer.sourceLayerId;
                const options = imageLayers.map(imgLayer => {
                    const isCurrent = imgLayer.id === currentSourceId;
                    return `${imgLayer.id}: ${imgLayer.name}${isCurrent ? ' (現在)' : ''}`;
                });

                // 解除オプションを追加
                if (currentSourceId !== null) {
                    options.unshift('0: リンクを解除');
                }

                const choice = prompt(
                    `ソース画像を選択してください:\n\n${options.join('\n')}\n\n番号を入力:`,
                    currentSourceId !== null ? String(currentSourceId) : ''
                );

                if (choice === null) break; // キャンセル

                const selectedId = parseInt(choice);
                if (isNaN(selectedId)) {
                    this._addMessage('error', '無効な入力です');
                    break;
                }

                if (selectedId === 0) {
                    // リンク解除
                    this.editor.layerManager.setBlockLayerSource(layerId, null);
                    this._addMessage('info', 'ソース画像のリンクを解除しました');
                } else {
                    // 指定IDの画像レイヤーを検証
                    const targetLayer = imageLayers.find(l => l.id === selectedId);
                    if (!targetLayer) {
                        this._addMessage('error', '指定された画像レイヤーが見つかりません');
                        break;
                    }
                    this.editor.layerManager.setBlockLayerSource(layerId, selectedId);
                    this._addMessage('info', `ソース画像を「${targetLayer.name}」に設定しました`);
                }
                this.editor.render();
                break;
            }

            case 'move-up': {
                this.editor.layerManager.moveUp(layerId);
                break;
            }

            case 'move-down': {
                this.editor.layerManager.moveDown(layerId);
                break;
            }

            case 'delete': {
                if (await dialogService.confirm(`レイヤー「${layer.name}」を削除しますか？`, { type: 'danger' })) {
                    this.editor.layerManager.removeLayer(layerId);
                }
                break;
            }
        }
    }
}

