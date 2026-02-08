/**
 * LayerManager.js - Unified Layer System
 * Based on specification.md Section 2.2
 *
 * Manages both image layers and block layers in a unified structure.
 * Layers are rendered in array order (later = front).
 */

import { fileManager } from '../systems/FileManager.js';
import { LayerSerializer } from '../services/LayerSerializer.js';
import { BlockifyService } from '../services/BlockifyService.js';

/**
 * @typedef {Object} ImageLayer
 * @property {number} id - Auto-generated unique ID
 * @property {string} name - Layer name
 * @property {'image'} type - Layer type
 * @property {HTMLImageElement} image - Image element for rendering
 * @property {string} imageData - Base64 dataURL for saving
 * @property {boolean} visible - Visibility flag
 * @property {number} zIndex - Render order (array index)
 */

/**
 * @typedef {Object} BlockData
 * @property {number} row - Grid row
 * @property {number} col - Grid column
 * @property {number} durability - Hit points (1-9)
 * @property {string} color - Block color (#RRGGBB)
 * @property {string} [gemDrop] - 'guaranteed' | 'infinite' | undefined
 * @property {string} [blockType] - 'key' | 'lock' | undefined
 * @property {string} [keyId] - Key identifier (for key blocks)
 * @property {string} [linkedKeyId] - Linked key ID (for lock blocks)
 */

/**
 * @typedef {Object} BlockLayer
 * @property {number} id - Auto-generated unique ID
 * @property {string} name - Layer name
 * @property {'block'} type - Layer type
 * @property {boolean} visible - Visibility flag
 * @property {number} zIndex - Render order (array index)
 * @property {Map<string, BlockData>} blocks - Block data (key = "row,col")
 * @property {number|null} sourceLayerId - Linked image layer ID for clipping
 */

/**
 * @typedef {Object} BaseLayer
 * @property {number} id - Always 0 (reserved)
 * @property {string} name - Layer name (editable)
 * @property {'base'} type - Layer type
 * @property {boolean} visible - Always true
 * @property {number} zIndex - Always 0 (bottom)
 * @property {number} width - Canvas width
 * @property {number} height - Canvas height
 * @property {HTMLImageElement|null} image - Image element (null for solid color)
 * @property {string|null} imageData - Base64 dataURL (null for solid color)
 * @property {string|null} backgroundColor - Solid color (#RRGGBB) or null for image
 */

/**
 * Background color presets for base layer
 */
export const BG_COLOR_PRESETS = [
    { name: '白', color: '#FFFFFF' },
    { name: '黒', color: '#000000' },
    { name: 'グレー', color: '#808080' },
    { name: 'ダークグレー', color: '#333333' }
];

export class LayerManager {
    constructor() {
        /** @type {(ImageLayer|BlockLayer)[]} */
        this.layers = [];

        /** @type {BaseLayer|null} */
        this.baseLayer = null;

        /** @type {number} */
        this.nextId = 1;

        /** @type {number|null} */
        this.activeLayerId = null;

        /** @type {{width: number, height: number}|null} */
        this.gameAreaSize = null;

        /** @type {Set<number>} */
        this.checkedLayerIds = new Set();

        // Event callbacks
        this.onLayerChange = null;
        this.onActiveLayerChange = null;
    }

    /**
     * Generate next unique ID
     */
    getNextId() {
        return this.nextId++;
    }

    // ========================================
    // Layer CRUD Operations
    // ========================================

    /**
     * Add an image layer
     * @param {string} name - Layer name
     * @param {HTMLImageElement} image - Image element
     * @param {string} imageData - Base64 data URL
     * @returns {ImageLayer} The created layer
     */
    addLayer(name, image, imageData) {
        const layer = {
            id: this.getNextId(),
            name,
            type: 'image',
            image,
            imageData,
            visible: true,
            zIndex: this.layers.length
        };

        this.layers.push(layer);
        this._updateZIndices();
        this._emitChange();

        return layer;
    }

    /**
     * Add a block layer
     * @param {string} name - Layer name
     * @returns {BlockLayer} The created layer
     */
    addBlockLayer(name) {
        const layer = {
            id: this.getNextId(),
            name,
            type: 'block',
            visible: true,
            zIndex: this.layers.length,
            blocks: new Map(),
            sourceLayerId: null
        };

        this.layers.push(layer);
        this._updateZIndices();
        this._emitChange();

        return layer;
    }

    /**
     * Add layer from file (async)
     * @param {File} file - Image file
     * @returns {Promise<ImageLayer>} The created layer
     */
    async addLayerFromFile(file) {
        const { image, dataURL, width, height } = await fileManager.loadImageFile(file);

        // サイズ検証
        if (this.gameAreaSize) {
            if (width !== this.gameAreaSize.width || height !== this.gameAreaSize.height) {
                throw new Error(
                    `画像サイズが一致しません。` +
                    `期待: ${this.gameAreaSize.width}x${this.gameAreaSize.height}, ` +
                    `実際: ${width}x${height}`
                );
            }
        } else {
            this.gameAreaSize = { width, height };
        }

        const name = file.name.replace(/\.[^/.]+$/, '');
        return this.addLayer(name, image, dataURL);
    }

    /**
     * Get layer by ID
     * @param {number} id - Layer ID
     * @returns {ImageLayer|BlockLayer|BaseLayer|null}
     */
    getLayer(id) {
        if (id === 0 && this.baseLayer) {
            return this.baseLayer;
        }
        return this.layers.find(l => l.id === id) || null;
    }

    /**
     * Get active layer
     * @returns {ImageLayer|BlockLayer|null}
     */
    getActiveLayer() {
        if (this.activeLayerId === null) return null;
        return this.getLayer(this.activeLayerId);
    }

    /**
     * Set active layer
     * @param {number|null} id - Layer ID or null
     */
    setActiveLayer(id) {
        if (id !== null && !this.getLayer(id)) {
            console.warn(`Layer ${id} not found`);
            return;
        }

        this.activeLayerId = id;

        if (this.onActiveLayerChange) {
            this.onActiveLayerChange(this.getActiveLayer());
        }
    }

    /**
     * Get all layers (in render order)
     * @returns {(ImageLayer|BlockLayer)[]}
     */
    getAllLayers() {
        return [...this.layers];
    }

    /**
     * Get all visible layers
     * @returns {(ImageLayer|BlockLayer)[]}
     */
    getVisibleLayers() {
        return this.layers.filter(l => l.visible);
    }

    /**
     * Remove layer by ID
     * @param {number} id - Layer ID
     * @returns {boolean}
     */
    removeLayer(id) {
        if (id === 0) {
            console.warn('ベースレイヤーは削除できません');
            return false;
        }

        const index = this.layers.findIndex(l => l.id === id);
        if (index === -1) return false;

        this.layers.splice(index, 1);
        this._updateZIndices();

        if (this.activeLayerId === id) {
            this.activeLayerId = this.layers.length > 0 ? this.layers[0].id : null;
        }

        this.checkedLayerIds.delete(id);
        this._emitChange();
        return true;
    }

    /**
     * Reorder layer
     * @param {number} fromIndex - Current index
     * @param {number} toIndex - Target index
     */
    reorderLayer(fromIndex, toIndex) {
        if (fromIndex < 0 || fromIndex >= this.layers.length) return;
        if (toIndex < 0 || toIndex >= this.layers.length) return;
        if (fromIndex === toIndex) return;

        const [layer] = this.layers.splice(fromIndex, 1);
        this.layers.splice(toIndex, 0, layer);

        this._updateZIndices();
        this._emitChange();
    }

    /**
     * Move layer up (towards front)
     * @param {number} id - Layer ID
     */
    moveUp(id) {
        const index = this.layers.findIndex(l => l.id === id);
        if (index === -1 || index === this.layers.length - 1) return;
        this.reorderLayer(index, index + 1);
    }

    /**
     * Move layer down (towards back)
     * @param {number} id - Layer ID
     */
    moveDown(id) {
        const index = this.layers.findIndex(l => l.id === id);
        if (index <= 0) return;
        this.reorderLayer(index, index - 1);
    }

    /**
     * Rename layer
     * @param {number} id - Layer ID
     * @param {string} newName - New name
     */
    renameLayer(id, newName) {
        const layer = this.getLayer(id);
        if (layer) {
            layer.name = newName;
            this._emitChange();
        }
    }

    /**
     * Set layer visibility
     * @param {number} id - Layer ID
     * @param {boolean} visible - Visibility
     */
    setLayerVisibility(id, visible) {
        const layer = this.getLayer(id);
        if (layer) {
            layer.visible = visible;
            this._emitChange();
        }
    }

    /**
     * Toggle layer visibility
     * @param {number} id - Layer ID
     */
    toggleLayerVisibility(id) {
        const layer = this.getLayer(id);
        if (layer) {
            layer.visible = !layer.visible;
            this._emitChange();
        }
    }

    /**
     * Set source image layer for a block layer
     * @param {number} blockLayerId - Block layer ID
     * @param {number|null} imageLayerId - Image layer ID or null
     */
    setBlockLayerSource(blockLayerId, imageLayerId) {
        const layer = this.getLayer(blockLayerId);
        if (layer && layer.type === 'block') {
            layer.sourceLayerId = imageLayerId;
            this._emitChange();
        }
    }

    /**
     * Get image layers only
     * @returns {ImageLayer[]}
     */
    getImageLayers() {
        return this.layers.filter(l => l.type === 'image');
    }

    /**
     * Get block layers only
     * @returns {BlockLayer[]}
     */
    getBlockLayers() {
        return this.layers.filter(l => l.type === 'block');
    }

    /**
     * Toggle layer check (for multi-select operations)
     * @param {number} id - Layer ID
     */
    toggleLayerCheck(id) {
        if (this.checkedLayerIds.has(id)) {
            this.checkedLayerIds.delete(id);
        } else {
            this.checkedLayerIds.add(id);
        }
        this._emitChange();
    }

    /**
     * Get checked layers
     * @returns {(ImageLayer|BlockLayer)[]}
     */
    getCheckedLayers() {
        return this.layers.filter(l => this.checkedLayerIds.has(l.id));
    }

    /**
     * Clear all layer checks
     */
    clearChecks() {
        this.checkedLayerIds.clear();
        this._emitChange();
    }

    /**
     * Duplicate a layer
     * @param {number} layerId - Layer ID to duplicate
     * @returns {ImageLayer|BlockLayer}
     */
    duplicateLayer(layerId) {
        const layer = this.getLayer(layerId);
        if (!layer) {
            throw new Error('レイヤーが見つかりません');
        }

        if (layer.type === 'image') {
            const newImage = new Image();
            newImage.src = layer.imageData;

            const newLayer = this.addLayer(
                `${layer.name}_copy`,
                newImage,
                layer.imageData
            );
            newLayer.visible = layer.visible;
            return newLayer;
        } else {
            const newLayer = this.addBlockLayer(`${layer.name}_copy`);
            newLayer.visible = layer.visible;
            newLayer.sourceLayerId = layer.sourceLayerId;

            // Deep copy blocks
            for (const [key, block] of layer.blocks) {
                newLayer.blocks.set(key, { ...block });
            }

            this._emitChange();
            return newLayer;
        }
    }

    // ========================================
    // Base Layer Methods
    // ========================================

    /**
     * Create a base layer
     * @param {number} width - Canvas width
     * @param {number} height - Canvas height
     * @param {Object} [options] - Creation options
     * @returns {BaseLayer}
     */
    createBaseLayer(width, height, options = {}) {
        if (this.baseLayer) {
            throw new Error('ベースレイヤーは既に存在します');
        }

        const {
            name = 'ベース',
            backgroundColor = null,
            image = null,
            imageData = null
        } = options;

        if (!backgroundColor && !image) {
            throw new Error('背景色または画像を指定してください');
        }

        this.baseLayer = {
            id: 0,
            name,
            type: 'base',
            visible: true,
            zIndex: 0,
            width,
            height,
            image: image || null,
            imageData: imageData || null,
            backgroundColor: backgroundColor || null
        };

        this.gameAreaSize = { width, height };
        this._emitChange();
        return this.baseLayer;
    }

    /**
     * Get the base layer
     * @returns {BaseLayer|null}
     */
    getBaseLayer() {
        return this.baseLayer;
    }

    /**
     * Check if base layer exists
     * @returns {boolean}
     */
    hasBaseLayer() {
        return this.baseLayer !== null;
    }

    /**
     * Set base layer image
     * @param {HTMLImageElement} image - Image element
     * @param {string} imageData - Base64 data URL
     */
    setBaseLayerImage(image, imageData) {
        if (!this.baseLayer) {
            throw new Error('ベースレイヤーが存在しません');
        }

        if (image.width !== this.baseLayer.width || image.height !== this.baseLayer.height) {
            throw new Error(
                `画像サイズが一致しません。` +
                `期待: ${this.baseLayer.width}x${this.baseLayer.height}, ` +
                `実際: ${image.width}x${image.height}`
            );
        }

        this.baseLayer.image = image;
        this.baseLayer.imageData = imageData;
        this.baseLayer.backgroundColor = null;
        this._emitChange();
    }

    /**
     * Set base layer solid color
     * @param {string} color - Color (#RRGGBB)
     */
    setBaseLayerColor(color) {
        if (!this.baseLayer) {
            throw new Error('ベースレイヤーが存在しません');
        }

        this.baseLayer.backgroundColor = color;
        this.baseLayer.image = null;
        this.baseLayer.imageData = null;
        this._emitChange();
    }

    /**
     * Update base layer from file
     * @param {File} file - Image file
     * @returns {Promise<void>}
     */
    async updateBaseLayerFromFile(file) {
        if (!this.baseLayer) {
            throw new Error('ベースレイヤーが存在しません');
        }

        const { image, dataURL } = await fileManager.loadImageFile(file);
        this.setBaseLayerImage(image, dataURL);
    }

    // ========================================
    // Utility Methods
    // ========================================

    /**
     * Get active block layer (for block operations)
     * @returns {BlockLayer|null}
     */
    getActiveBlockLayer() {
        const activeLayer = this.getActiveLayer();
        if (activeLayer && activeLayer.type === 'block') {
            return activeLayer;
        }
        return this.layers.find(l => l.type === 'block' && l.visible) || null;
    }

    /**
     * Find the nearest block layer above the given layer
     * @param {number} layerId - The layer ID to search from
     * @returns {BlockLayer|null}
     */
    findNearestBlockLayerAbove(layerId) {
        const layerIndex = this.layers.findIndex(l => l.id === layerId);
        if (layerIndex === -1) return null;

        for (let i = layerIndex + 1; i < this.layers.length; i++) {
            if (this.layers[i].type === 'block') {
                return this.layers[i];
            }
        }

        for (let i = layerIndex - 1; i >= 0; i--) {
            if (this.layers[i].type === 'block') {
                return this.layers[i];
            }
        }

        return null;
    }

    // ========================================
    // Serialization (delegated to LayerSerializer)
    // ========================================

    /**
     * Serialize layers for saving
     * @returns {Object}
     */
    serialize() {
        return LayerSerializer.serialize({
            baseLayer: this.baseLayer,
            layers: this.layers
        });
    }

    /**
     * Deserialize layers from saved data
     * @param {Object} data - Serialized layer data
     * @returns {Promise<void>}
     */
    async deserialize(data) {
        const result = await LayerSerializer.deserialize(data);

        this.layers = result.layers;
        this.baseLayer = result.baseLayer;
        this.nextId = result.nextId;
        this.gameAreaSize = result.gameAreaSize;
        this.activeLayerId = null;
        this.checkedLayerIds.clear();

        this._updateZIndices();

        if (this.layers.length > 0) {
            this.activeLayerId = this.layers[0].id;
        }

        this._emitChange();
    }

    /**
     * Load layers from stage data
     * @param {Object} stageData - Stage data
     */
    loadFromStage(stageData) {
        const result = LayerSerializer.loadFromStage(stageData);

        this.layers = result.layers;
        this.baseLayer = result.baseLayer;
        this.nextId = result.nextId;
        this.gameAreaSize = result.gameAreaSize;
        this.checkedLayerIds.clear();

        this._updateZIndices();

        // Set first block layer as active, or first layer
        const blockLayer = this.layers.find(l => l.type === 'block');
        if (blockLayer) {
            this.activeLayerId = blockLayer.id;
        } else if (this.layers.length > 0) {
            this.activeLayerId = this.layers[0].id;
        } else {
            this.activeLayerId = null;
        }

        // Notify UI of active layer change
        if (this.onActiveLayerChange) {
            this.onActiveLayerChange(this.getActiveLayer());
        }
    }

    /**
     * Serialize layers for stage storage
     * @returns {Object}
     */
    serializeForStage() {
        return LayerSerializer.serializeForStage({
            baseLayer: this.baseLayer,
            layers: this.layers
        });
    }

    /**
     * Clear all layers
     */
    clear() {
        this.layers = [];
        this.baseLayer = null;
        this.nextId = 1;
        this.activeLayerId = null;
        this.gameAreaSize = null;
        this.checkedLayerIds.clear();
        this._emitChange();
    }

    // ========================================
    // Blockify (delegated to BlockifyService)
    // ========================================

    /**
     * Blockify - Generate blocks from an image layer
     * @param {number} imageLayerId - Source image layer ID
     * @param {Object} options - Blockify options
     * @returns {BlockLayer}
     */
    blockifyLayer(imageLayerId, options = {}) {
        const imageLayer = this.getLayer(imageLayerId);
        const result = BlockifyService.blockify(imageLayer, options);

        let blockLayer;

        if (options.targetLayerId) {
            blockLayer = this.getLayer(options.targetLayerId);
            if (!blockLayer || blockLayer.type !== 'block') {
                throw new Error('有効なブロックレイヤーを指定してください');
            }
            BlockifyService.applyToLayer(blockLayer, result.blocks, imageLayerId, options);
        } else {
            const layerName = `${imageLayer.name}_blocks`;
            blockLayer = this.addBlockLayer(layerName);
            blockLayer.blocks = result.blocks;
            blockLayer.sourceLayerId = imageLayerId;
        }

        this._emitChange();
        return blockLayer;
    }

    /**
     * Blockify using difference between two images
     * @param {number} beforeLayerId - "Before" image layer ID
     * @param {number} afterLayerId - "After" image layer ID
     * @param {Object} options - Blockify options
     * @returns {BlockLayer}
     */
    blockifyDiff(beforeLayerId, afterLayerId, options = {}) {
        const beforeLayer = this.getLayer(beforeLayerId);
        const afterLayer = this.getLayer(afterLayerId);
        const result = BlockifyService.blockifyDiff(beforeLayer, afterLayer, options);

        const layerName = `${afterLayer.name}_diff_blocks`;
        const blockLayer = this.addBlockLayer(layerName);
        blockLayer.blocks = result.blocks;
        blockLayer.sourceLayerId = afterLayerId;

        this._emitChange();
        return blockLayer;
    }

    /**
     * Get blockify preview without creating layer
     * @param {number} imageLayerId - Source image layer ID
     * @param {Object} options - Blockify options
     * @returns {{blocks: Map, totalHexes: number, filledHexes: number}}
     */
    getBlockifyPreview(imageLayerId, options = {}) {
        const imageLayer = this.getLayer(imageLayerId);
        return BlockifyService.getPreview(imageLayer, options);
    }

    // ========================================
    // Private Methods
    // ========================================

    /**
     * Update zIndex values based on array position
     * @private
     */
    _updateZIndices() {
        this.layers.forEach((layer, index) => {
            layer.zIndex = index;
        });
    }

    /**
     * Emit change event
     * @private
     */
    _emitChange() {
        if (this.onLayerChange) {
            this.onLayerChange(this.layers);
        }
    }
}
