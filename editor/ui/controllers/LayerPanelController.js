/**
 * LayerPanelController.js - Layer Panel Controller
 *
 * Handles layer list display, selection, visibility, and actions.
 * Extracted from UIController.js for single responsibility.
 */

import { dialogService } from '../DialogService.js';

export class LayerPanelController {
    /**
     * @param {import('../../core/Editor.js').Editor} editor
     * @param {Function} addMessage - Message callback function
     */
    constructor(editor, addMessage) {
        this.editor = editor;
        this._addMessage = addMessage;

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
        this._bindEditorEvents();
        this.updateLayerList();
    }

    /**
     * Cache DOM element references
     * @private
     */
    _cacheElements(elements) {
        this.elements = {
            layerList: elements.layerList,
            addImageBtn: elements.addImageBtn,
            addBlockLayerBtn: elements.addBlockLayerBtn
        };
    }

    /**
     * Validate required elements exist
     * @private
     */
    _validateElements() {
        if (!this.elements.layerList) {
            throw new Error('[LayerPanelController] Required element "layerList" not found');
        }
        // Buttons are optional but log warning if missing
        if (!this.elements.addImageBtn) {
            console.warn('[LayerPanelController] addImageBtn element not found');
        }
        if (!this.elements.addBlockLayerBtn) {
            console.warn('[LayerPanelController] addBlockLayerBtn element not found');
        }
    }

    /**
     * Bind event listeners
     * @private
     */
    _bindEvents() {
        // Add image layer button
        if (this.elements.addImageBtn) {
            this.elements.addImageBtn.addEventListener('click', () => {
                this.editor.importImages();
            });
        }

        // Add block layer button
        if (this.elements.addBlockLayerBtn) {
            this.elements.addBlockLayerBtn.addEventListener('click', () => {
                const name = prompt('ブロックレイヤー名:', 'New Block Layer');
                if (name) {
                    this.editor.addBlockLayer(name);
                }
            });
        }
    }

    /**
     * Bind editor event handlers
     * @private
     */
    _bindEditorEvents() {
        this.editor.on('layersChanged', () => this.updateLayerList());
        this.editor.on('activeLayerChanged', () => this.updateLayerList());
        // ステージ切り替え時もレイヤーリストを更新（ステージごとにレイヤーが異なる）
        this.editor.on('currentStageChanged', () => this.updateLayerList());
    }

    /**
     * Update layer list display
     */
    updateLayerList() {
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
        const checkbox = item.querySelector('.layer-checkbox');
        if (checkbox) {
            checkbox.addEventListener('change', () => {
                this.editor.layerManager.toggleLayerCheck(layer.id);
            });
        }

        // Visibility toggle
        const visibilityBtn = item.querySelector('[data-action="toggle-visibility"]');
        if (visibilityBtn) {
            visibilityBtn.addEventListener('click', () => {
                if (isBaseLayer) {
                    // Toggle base layer visibility
                    layer.visible = layer.visible === false ? true : false;
                    this.editor.render();
                    this.updateLayerList();
                } else {
                    this.editor.layerManager.toggleLayerVisibility(layer.id);
                }
            });
        }

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
}
