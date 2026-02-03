/**
 * LayerPanelController.js - Layer Panel Controller
 *
 * Handles layer list display, selection, visibility, drag-drop linking, and actions.
 * Supports parent-child display for linked block layers.
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

        // Drag state
        this._draggedLayerId = null;
        this._draggedLayerType = null;
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
        if (this.elements.addImageBtn) {
            this.elements.addImageBtn.addEventListener('click', () => {
                this.editor.importImages();
            });
        }

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
        this.editor.on('currentStageChanged', () => this.updateLayerList());
    }

    /**
     * Update layer list display with hierarchical structure
     */
    updateLayerList() {
        const list = this.elements.layerList;
        if (!list) return;

        list.innerHTML = '';

        const layers = this.editor.layerManager.getAllLayers().slice().reverse();
        const baseLayer = this.editor.layerManager.getBaseLayer();
        const activeId = this.editor.layerManager.activeLayerId;

        // Build parent-child structure
        const { parentLayers, childrenByParent, orphanBlocks } = this._buildHierarchy(layers);

        // Render image layers with their linked block children
        for (const layer of parentLayers) {
            const item = this._createLayerItem(layer, activeId, false, false);
            list.appendChild(item);

            // Render linked block children
            const children = childrenByParent.get(layer.id) || [];
            for (const child of children) {
                const childItem = this._createLayerItem(child, activeId, false, true);
                list.appendChild(childItem);
            }
        }

        // Render orphan block layers (not linked to any image)
        for (const layer of orphanBlocks) {
            const item = this._createLayerItem(layer, activeId, false, false);
            list.appendChild(item);
        }

        // Render base layer at the bottom
        if (baseLayer) {
            const item = this._createLayerItem(baseLayer, activeId, true, false);
            list.appendChild(item);
        }
    }

    /**
     * Build hierarchical structure of layers
     * @private
     * @returns {{ parentLayers: Array, childrenByParent: Map, orphanBlocks: Array }}
     */
    _buildHierarchy(layers) {
        const imageLayers = [];
        const blockLayers = [];

        for (const layer of layers) {
            if (layer.type === 'block') {
                blockLayers.push(layer);
            } else {
                imageLayers.push(layer);
            }
        }

        // Map: imageLayerId -> [linked block layers]
        const childrenByParent = new Map();
        const orphanBlocks = [];

        for (const block of blockLayers) {
            const parentId = block.sourceLayerId;
            if (parentId !== null && parentId !== undefined) {
                // Check if parent actually exists
                const parentExists = imageLayers.some(l => l.id === parentId);
                if (parentExists) {
                    if (!childrenByParent.has(parentId)) {
                        childrenByParent.set(parentId, []);
                    }
                    childrenByParent.get(parentId).push(block);
                } else {
                    orphanBlocks.push(block);
                }
            } else {
                orphanBlocks.push(block);
            }
        }

        return { parentLayers: imageLayers, childrenByParent, orphanBlocks };
    }

    /**
     * Create a layer item element
     * @private
     */
    _createLayerItem(layer, activeId, isBaseLayer, isChild) {
        const item = document.createElement('div');
        const childClass = isChild ? 'layer-child' : '';
        item.className = `layer-item ${layer.id === activeId ? 'active' : ''} ${isBaseLayer ? 'base-layer' : ''} ${childClass}`;
        item.dataset.layerId = layer.id;
        item.dataset.layerType = layer.type || 'image';

        // Enable drag for non-base layers
        if (!isBaseLayer) {
            item.draggable = true;
            this._bindDragEvents(item, layer);
        }

        const layerType = layer.type || 'image';
        const isImageType = layerType === 'image' || layerType === 'base';
        const typeIcon = isImageType ? '<i class="fas fa-image"></i>' : '<i class="fas fa-cubes"></i>';
        const typeClass = isImageType ? 'layer-type-image' : 'layer-type-block';
        const isVisible = layer.visible !== false;

        // Child indicator
        const childPrefix = isChild ? '<span class="layer-child-indicator">└</span>' : '';

        // Link indicator for block layers
        const hasSourceLink = layerType === 'block' && layer.sourceLayerId !== null && layer.sourceLayerId !== undefined;
        const linkIndicator = hasSourceLink ? '<span class="layer-link-indicator" title="画像にリンク中"><i class="fas fa-link"></i></span>' : '';

        item.innerHTML = `
            <input type="checkbox" class="layer-checkbox"
                ${this.editor.layerManager.checkedLayerIds.has(layer.id) ? 'checked' : ''}>
            ${childPrefix}
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

        // Click to select
        if (!isBaseLayer) {
            item.addEventListener('click', (e) => {
                if (e.target.closest('[data-action]') || e.target.type === 'checkbox') return;
                this.editor.layerManager.setActiveLayer(layer.id);
            });
        }

        // Checkbox
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
                    layer.visible = layer.visible === false ? true : false;
                    this.editor.render();
                    this.updateLayerList();
                } else {
                    this.editor.layerManager.toggleLayerVisibility(layer.id);
                }
            });
        }

        // Delete button
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
     * Bind drag and drop events to a layer item
     * @private
     */
    _bindDragEvents(item, layer) {
        item.addEventListener('dragstart', (e) => {
            this._draggedLayerId = layer.id;
            this._draggedLayerType = layer.type || 'image';
            item.classList.add('dragging');
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/plain', layer.id.toString());
        });

        item.addEventListener('dragend', () => {
            item.classList.remove('dragging');
            this._draggedLayerId = null;
            this._draggedLayerType = null;
            // Clear all drop targets
            this.elements.layerList.querySelectorAll('.drop-target').forEach(el => {
                el.classList.remove('drop-target');
            });
        });

        item.addEventListener('dragover', (e) => {
            e.preventDefault();
            // Only allow drop if dragging a block layer onto an image layer
            if (this._canDropOn(layer)) {
                e.dataTransfer.dropEffect = 'move';
                item.classList.add('drop-target');
            } else {
                e.dataTransfer.dropEffect = 'none';
            }
        });

        item.addEventListener('dragleave', () => {
            item.classList.remove('drop-target');
        });

        item.addEventListener('drop', (e) => {
            e.preventDefault();
            item.classList.remove('drop-target');

            if (!this._canDropOn(layer)) return;

            const blockLayerId = this._draggedLayerId;
            const imageLayerId = layer.id;

            // Create link
            this.editor.layerManager.setBlockLayerSource(blockLayerId, imageLayerId);
            this._addMessage('info', `ブロックレイヤーを「${layer.name}」にリンクしました`);
            this.editor.render();
        });
    }

    /**
     * Check if a layer can be dropped onto
     * @private
     */
    _canDropOn(targetLayer) {
        // Can only drop if:
        // 1. We're dragging a block layer
        // 2. Target is an image layer
        // 3. They're different layers
        const isBlockBeingDragged = this._draggedLayerType === 'block';
        const targetIsImage = (targetLayer.type || 'image') === 'image';
        const isDifferent = this._draggedLayerId !== targetLayer.id;

        return isBlockBeingDragged && targetIsImage && isDifferent;
    }
}
