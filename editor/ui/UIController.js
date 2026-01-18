/**
 * UIController.js - UI Event Handling
 * Based on specification.md Section 3
 * 
 * Handles UI panel interactions and updates.
 */

import { TOOLS, BRUSH_SIZES, LINE_TYPES, DURABILITY_COLORS, MESSAGE_TYPES } from '../core/Config.js';

export class UIController {
    /**
     * @param {import('../core/Editor.js').Editor} editor
     */
    constructor(editor) {
        this.editor = editor;

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

        // Initialize stage selector with default stage
        this._updateStageSelector();

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

            // Layer panel
            layerList: document.getElementById('layer-list'),
            addImageBtn: document.getElementById('btn-add-image'),
            addBlockLayerBtn: document.getElementById('btn-add-block-layer'),

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
            clearMessagesBtn: document.getElementById('btn-clear-messages')
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

        // Add stage button
        this.elements.addStageBtn?.addEventListener('click', () => {
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
            const selectedLine = this.editor.lineManager.getSelectedLine();
            if (selectedLine) {
                this.editor.lineManager.updateLine(selectedLine.id, { thickness: parseInt(e.target.value) });
            }
        });

        this.elements.lineOpacity?.addEventListener('input', (e) => {
            const selectedLine = this.editor.lineManager.getSelectedLine();
            if (selectedLine) {
                this.editor.lineManager.updateLine(selectedLine.id, { opacity: parseFloat(e.target.value) });
            }
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
        this.elements.clearMessagesBtn?.addEventListener('click', () => this._clearMessages());

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
        this.editor.on('stagesChanged', () => this._updateStageSelector());
        this.editor.on('currentStageChanged', (stage) => this._onStageChanged(stage));

        this.editor.on('save', () => this._saveProject());
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
        const activeId = this.editor.layerManager.activeLayerId;

        for (const layer of layers) {
            const item = document.createElement('div');
            item.className = `layer-item ${layer.id === activeId ? 'active' : ''}`;
            item.dataset.layerId = layer.id;

            item.innerHTML = `
                <input type="checkbox" class="layer-checkbox" 
                    ${this.editor.layerManager.checkedLayerIds.has(layer.id) ? 'checked' : ''}>
                <span class="layer-visibility ${layer.visible ? '' : 'hidden'}" 
                    data-action="toggle-visibility">👁</span>
                <span class="layer-icon ${layer.type === 'image' ? 'layer-type-image' : 'layer-type-block'}">
                    ${layer.type === 'image' ? '🖼️' : '🧱'}
                </span>
                <span class="layer-name">${layer.name}</span>
                <div class="layer-actions">
                    <button class="layer-action-btn" data-action="delete" title="削除">🗑️</button>
                </div>
            `;

            // Click to select
            item.addEventListener('click', (e) => {
                if (e.target.closest('[data-action]') || e.target.type === 'checkbox') return;
                this.editor.layerManager.setActiveLayer(layer.id);
            });

            // Checkbox for multi-select
            item.querySelector('.layer-checkbox').addEventListener('change', (e) => {
                this.editor.layerManager.toggleLayerCheck(layer.id);
            });

            // Visibility toggle
            item.querySelector('[data-action="toggle-visibility"]').addEventListener('click', () => {
                this.editor.layerManager.toggleLayerVisibility(layer.id);
            });

            // Delete button
            item.querySelector('[data-action="delete"]').addEventListener('click', (e) => {
                e.stopPropagation();
                if (confirm(`レイヤー "${layer.name}" を削除しますか？`)) {
                    this.editor.layerManager.removeLayer(layer.id);
                }
            });

            list.appendChild(item);
        }
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
    _openProject() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.hbp,.json';

        input.onchange = async (e) => {
            const file = e.target.files[0];
            if (!file) return;

            try {
                const text = await file.text();
                const data = JSON.parse(text);
                await this.editor.loadProjectData(data);
            } catch (error) {
                this._addMessage('error', `プロジェクトの読み込みに失敗しました: ${error.message}`);
            }
        };

        input.click();
    }

    /**
     * Save project file
     * @private
     */
    _saveProject() {
        const data = this.editor.getProjectData();
        const json = JSON.stringify(data, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = url;
        a.download = `${this.editor.projectName || 'project'}.hbp`;
        a.click();

        URL.revokeObjectURL(url);
        this.editor.isDirty = false;

        this._addMessage('info', 'プロジェクトを保存しました');
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
            div.innerHTML = `
                <span class="message-icon">${typeConfig.icon}</span>
                <span class="message-text">${msg.text}</span>
                <span class="message-time">${msg.time}</span>
            `;
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
        const width = parseInt(this.elements.newStageWidth.value) || 1280;
        const height = parseInt(this.elements.newStageHeight.value) || 720;
        const gridSize = document.querySelector('input[name="grid-size"]:checked')?.value || 'medium';
        const imageFile = this.elements.newStageImage.files?.[0];

        // Create stage
        const stage = this.editor.createStage({
            name,
            width,
            height,
            gridSize
        });

        // If base image provided, add it as first layer
        if (imageFile && stage) {
            try {
                await this.editor.addImageLayer(imageFile);
            } catch (error) {
                this._addMessage('error', `画像の追加に失敗: ${error.message}`);
            }
        }

        this._hideNewStageDialog();
        this._updateStageSelector();
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
     * Handle stage change
     * @private
     */
    _onStageChanged(stage) {
        this._updateStageSelector();
        this._updateLayerList();

        if (stage) {
            this._addMessage('info', `ステージ「${stage.name}」を選択しました`);
        }
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

        const layer = this.editor.layerManager.getLayer(layerId);
        if (!layer) return;

        this._currentContextLayerId = layerId;

        // Build menu items based on layer type
        const items = [];

        // Common items
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
            items.push({ label: 'ブロックをクリア', action: 'clear-blocks', icon: '🗑️' });
            items.push({ type: 'separator' });
        }

        items.push({ label: '上へ移動', action: 'move-up', icon: '⬆️' });
        items.push({ label: '下へ移動', action: 'move-down', icon: '⬇️' });
        items.push({ type: 'separator' });
        items.push({ label: '削除', action: 'delete', icon: '🗑️', danger: true });

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
    _executeContextMenuAction(action) {
        const layerId = this._currentContextLayerId;
        if (!layerId) return;

        const layer = this.editor.layerManager.getLayer(layerId);
        if (!layer) return;

        switch (action) {
            case 'rename': {
                const newName = prompt('新しい名前:', layer.name);
                if (newName && newName !== layer.name) {
                    this.editor.layerManager.renameLayer(layerId, newName);
                }
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
                if (layer.type === 'block' && confirm('すべてのブロックを削除しますか？')) {
                    layer.blocks.clear();
                    this.editor.render();
                    this._addMessage('info', 'ブロックをクリアしました');
                }
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
                if (confirm(`レイヤー「${layer.name}」を削除しますか？`)) {
                    this.editor.layerManager.removeLayer(layerId);
                }
                break;
            }
        }
    }
}

