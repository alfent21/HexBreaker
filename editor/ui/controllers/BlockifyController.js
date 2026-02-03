/**
 * BlockifyController.js - Blockify Dialog Controller
 *
 * Handles the Blockify dialog for converting images to hex blocks.
 * Extracted from UIController.js for single responsibility.
 */

export class BlockifyController {
    /**
     * @param {import('../../core/Editor.js').Editor} editor
     * @param {Function} addMessage - Message callback function
     * @param {Function} updateLayerList - Layer list update callback
     */
    constructor(editor, addMessage, updateLayerList) {
        this.editor = editor;
        this._addMessage = addMessage;
        this._updateLayerList = updateLayerList;

        // DOM element references
        this.elements = {};
    }

    /**
     * Initialize the controller
     * @param {Object} elements - Cached DOM elements from UIController
     */
    init(elements) {
        this._cacheElements(elements);
        this._validateElements();
        this._bindEvents();
    }

    /**
     * Cache DOM element references
     * @private
     */
    _cacheElements(elements) {
        this.elements = {
            blockifyDialog: elements.blockifyDialog,
            blockifySourceSelect: elements.blockifySourceSelect,
            blockifyGridSize: elements.blockifyGridSize,
            blockifyAlphaThreshold: elements.blockifyAlphaThreshold,
            blockifyAlphaValue: elements.blockifyAlphaValue,
            blockifyCoverageThreshold: elements.blockifyCoverageThreshold,
            blockifyCoverageValue: elements.blockifyCoverageValue,
            blockifyDurability: elements.blockifyDurability,
            blockifyUseImageColor: elements.blockifyUseImageColor,
            blockifyDefaultColor: elements.blockifyDefaultColor,
            blockifyTargetSelect: elements.blockifyTargetSelect,
            blockifyMergeBlocks: elements.blockifyMergeBlocks,
            blockifyPreviewCount: elements.blockifyPreviewCount,
            blockifyCancelBtn: elements.blockifyCancelBtn,
            blockifyCreateBtn: elements.blockifyCreateBtn,
            blockifyCloseBtn: elements.blockifyCloseBtn
        };
    }

    /**
     * Validate required elements exist
     * @private
     */
    _validateElements() {
        if (!this.elements.blockifyDialog) {
            throw new Error('[BlockifyController] Required element "blockifyDialog" not found');
        }
        // Other elements are optional but log warning if key ones are missing
        const important = ['blockifySourceSelect', 'blockifyCreateBtn'];
        for (const name of important) {
            if (!this.elements[name]) {
                console.warn(`[BlockifyController] Important element "${name}" not found`);
            }
        }
    }

    /**
     * Bind element with validation
     * @private
     */
    _bindElement(elementName, eventType, handler) {
        const element = this.elements[elementName];
        if (!element) return;
        element.addEventListener(eventType, handler);
    }

    /**
     * Bind event listeners
     * @private
     */
    _bindEvents() {
        // Close buttons
        this._bindElement('blockifyCloseBtn', 'click', () => this.hide());
        this._bindElement('blockifyCancelBtn', 'click', () => this.hide());

        // Create button
        this._bindElement('blockifyCreateBtn', 'click', () => this._executeBlockify());

        // Alpha threshold slider
        this._bindElement('blockifyAlphaThreshold', 'input', (e) => {
            if (this.elements.blockifyAlphaValue) {
                this.elements.blockifyAlphaValue.textContent = e.target.value;
            }
            this._updatePreview();
        });

        // Coverage threshold slider
        this._bindElement('blockifyCoverageThreshold', 'input', (e) => {
            if (this.elements.blockifyCoverageValue) {
                this.elements.blockifyCoverageValue.textContent = `${Math.round(e.target.value * 100)}%`;
            }
            this._updatePreview();
        });

        // Other options that affect preview
        this._bindElement('blockifySourceSelect', 'change', () => this._updatePreview());
        this._bindElement('blockifyGridSize', 'change', () => this._updatePreview());

        // Toggle default color picker visibility
        this._bindElement('blockifyUseImageColor', 'change', (e) => {
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
    show(imageLayerId = null) {
        const dialog = this.elements.blockifyDialog;
        if (!dialog) {
            this._addMessage('error', '[BlockifyController] Dialog element not found');
            return;
        }

        // Populate source image selector
        this._populateSourceSelect(imageLayerId);

        // Populate target layer selector
        this._populateTargetSelect();

        // Reset form values
        if (this.elements.blockifyGridSize) {
            this.elements.blockifyGridSize.value = 'medium';
        }
        if (this.elements.blockifyAlphaThreshold) {
            this.elements.blockifyAlphaThreshold.value = 128;
            if (this.elements.blockifyAlphaValue) {
                this.elements.blockifyAlphaValue.textContent = '128';
            }
        }
        if (this.elements.blockifyCoverageThreshold) {
            this.elements.blockifyCoverageThreshold.value = 0.3;
            if (this.elements.blockifyCoverageValue) {
                this.elements.blockifyCoverageValue.textContent = '30%';
            }
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
        this._updatePreview();

        dialog.classList.remove('hidden');
    }

    /**
     * Hide blockify dialog
     */
    hide() {
        this.elements.blockifyDialog?.classList.add('hidden');
    }

    /**
     * Populate source image selector
     * @private
     */
    _populateSourceSelect(preselectedId = null) {
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
    _populateTargetSelect() {
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
    _updatePreview() {
        const countEl = this.elements.blockifyPreviewCount;
        if (!countEl) return;

        const sourceId = parseInt(this.elements.blockifySourceSelect?.value);
        if (!sourceId) {
            countEl.textContent = '0';
            return;
        }

        const options = this._getOptions();
        const preview = this.editor.layerManager.getBlockifyPreview(sourceId, options);

        countEl.textContent = preview.filledHexes.toString();
    }

    /**
     * Get blockify options from form
     * @private
     * @returns {Object}
     */
    _getOptions() {
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

        const options = this._getOptions();

        // Add target layer options
        const targetId = this.elements.blockifyTargetSelect?.value;
        if (targetId) {
            options.targetLayerId = parseInt(targetId);
            options.mergeBlocks = this.elements.blockifyMergeBlocks?.checked ?? false;
        }

        try {
            const blockLayer = this.editor.layerManager.blockifyLayer(sourceId, options);
            this._addMessage('info', `ブロック化完了: ${blockLayer.blocks.size} ブロック生成`);
            this.hide();
            this._updateLayerList();
            this.editor.render();
        } catch (error) {
            this._addMessage('error', `ブロック化に失敗しました: ${error.message}`);
        }
    }
}
