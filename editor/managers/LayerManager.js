/**
 * LayerManager.js - Unified Layer System
 * Based on specification.md Section 2.2
 * 
 * Manages both image layers and block layers in a unified structure.
 * Layers are rendered in array order (later = front).
 */

import { getHexKey, parseHexKey } from '../../shared/HexMath.js';

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

export class LayerManager {
    constructor() {
        /** @type {(ImageLayer|BlockLayer)[]} */
        this.layers = [];

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
    addLayerFromFile(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();

            reader.onload = (e) => {
                const imageData = e.target.result;
                const img = new Image();

                img.onload = () => {
                    // Validate size against gameArea
                    if (this.gameAreaSize) {
                        if (img.width !== this.gameAreaSize.width ||
                            img.height !== this.gameAreaSize.height) {
                            reject(new Error(
                                `画像サイズが一致しません。` +
                                `期待: ${this.gameAreaSize.width}x${this.gameAreaSize.height}, ` +
                                `実際: ${img.width}x${img.height}`
                            ));
                            return;
                        }
                    } else {
                        // First layer sets the game area size
                        this.gameAreaSize = { width: img.width, height: img.height };
                    }

                    const name = file.name.replace(/\.[^/.]+$/, '');
                    const layer = this.addLayer(name, img, imageData);
                    resolve(layer);
                };

                img.onerror = () => {
                    reject(new Error('画像の読み込みに失敗しました'));
                };

                img.src = imageData;
            };

            reader.onerror = () => {
                reject(new Error('ファイルの読み込みに失敗しました'));
            };

            reader.readAsDataURL(file);
        });
    }

    /**
     * Get layer by ID
     * @param {number} id - Layer ID
     * @returns {ImageLayer|BlockLayer|null} Layer or null
     */
    getLayer(id) {
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
     */
    removeLayer(id) {
        const index = this.layers.findIndex(l => l.id === id);
        if (index === -1) return;

        this.layers.splice(index, 1);
        this._updateZIndices();

        // Clear active if removed
        if (this.activeLayerId === id) {
            this.activeLayerId = this.layers.length > 0 ? this.layers[0].id : null;
        }

        this.checkedLayerIds.delete(id);
        this._emitChange();
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
     * Serialize layers for saving
     * @returns {Object[]}
     */
    serialize() {
        return this.layers.map(layer => {
            if (layer.type === 'image') {
                return {
                    id: layer.id,
                    name: layer.name,
                    type: 'image',
                    visible: layer.visible,
                    zIndex: layer.zIndex,
                    imageData: layer.imageData
                };
            } else {
                return {
                    id: layer.id,
                    name: layer.name,
                    type: 'block',
                    visible: layer.visible,
                    zIndex: layer.zIndex,
                    sourceLayerId: layer.sourceLayerId,
                    blocks: Array.from(layer.blocks.entries())
                };
            }
        });
    }

    /**
     * Deserialize layers from saved data
     * @param {Object[]} data - Serialized layer data
     * @returns {Promise<void>}
     */
    async deserialize(data) {
        this.layers = [];
        this.nextId = 1;
        this.activeLayerId = null;
        this.gameAreaSize = null;
        this.checkedLayerIds.clear();

        for (const layerData of data) {
            if (layerData.type === 'image') {
                // Load image from base64
                const img = new Image();
                await new Promise((resolve, reject) => {
                    img.onload = resolve;
                    img.onerror = reject;
                    img.src = layerData.imageData;
                });

                // Set game area from first image
                if (!this.gameAreaSize) {
                    this.gameAreaSize = { width: img.width, height: img.height };
                }

                this.layers.push({
                    id: layerData.id,
                    name: layerData.name,
                    type: 'image',
                    image: img,
                    imageData: layerData.imageData,
                    visible: layerData.visible,
                    zIndex: layerData.zIndex
                });
            } else {
                this.layers.push({
                    id: layerData.id,
                    name: layerData.name,
                    type: 'block',
                    visible: layerData.visible,
                    zIndex: layerData.zIndex,
                    sourceLayerId: layerData.sourceLayerId,
                    blocks: new Map(layerData.blocks)
                });
            }

            if (layerData.id >= this.nextId) {
                this.nextId = layerData.id + 1;
            }
        }

        this._updateZIndices();

        if (this.layers.length > 0) {
            this.activeLayerId = this.layers[0].id;
        }

        this._emitChange();
    }

    /**
     * Clear all layers
     */
    clear() {
        this.layers = [];
        this.nextId = 1;
        this.activeLayerId = null;
        this.gameAreaSize = null;
        this.checkedLayerIds.clear();
        this._emitChange();
    }

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

    /**
     * Load layers from stage data
     * @param {Object[]} stageLayers - Layer data from stage
     */
    loadFromStage(stageLayers) {
        this.layers = [];
        this.nextId = 1;
        this.activeLayerId = null;
        this.checkedLayerIds.clear();

        for (const layerData of stageLayers) {
            if (layerData.type === 'image') {
                // If image element doesn't exist, create placeholder
                let img = layerData.image;
                if (!img && layerData.imageData) {
                    img = new Image();
                    img.src = layerData.imageData;
                }

                this.layers.push({
                    id: layerData.id,
                    name: layerData.name,
                    type: 'image',
                    image: img,
                    imageData: layerData.imageData,
                    visible: layerData.visible !== false,
                    zIndex: layerData.zIndex || 0
                });
            } else if (layerData.type === 'block') {
                // Convert array blocks to Map if necessary
                let blocks = layerData.blocks;
                if (Array.isArray(blocks)) {
                    blocks = new Map(blocks);
                } else if (!(blocks instanceof Map)) {
                    blocks = new Map();
                }

                this.layers.push({
                    id: layerData.id,
                    name: layerData.name,
                    type: 'block',
                    visible: layerData.visible !== false,
                    zIndex: layerData.zIndex || 0,
                    blocks: blocks,
                    sourceLayerId: layerData.sourceLayerId || null
                });
            }

            if (layerData.id >= this.nextId) {
                this.nextId = layerData.id + 1;
            }
        }

        this._updateZIndices();

        // Set first block layer as active, or first layer
        const blockLayer = this.layers.find(l => l.type === 'block');
        if (blockLayer) {
            this.activeLayerId = blockLayer.id;
        } else if (this.layers.length > 0) {
            this.activeLayerId = this.layers[0].id;
        }

        // Note: don't emit change here to avoid infinite loop with editor sync
    }

    /**
     * Serialize layers for stage storage
     * @returns {Object[]}
     */
    serializeForStage() {
        return this.layers.map(layer => {
            if (layer.type === 'image') {
                return {
                    id: layer.id,
                    name: layer.name,
                    type: 'image',
                    visible: layer.visible,
                    zIndex: layer.zIndex,
                    imageData: layer.imageData
                };
            } else {
                return {
                    id: layer.id,
                    name: layer.name,
                    type: 'block',
                    visible: layer.visible,
                    zIndex: layer.zIndex,
                    sourceLayerId: layer.sourceLayerId,
                    blocks: layer.blocks instanceof Map
                        ? Array.from(layer.blocks.entries())
                        : layer.blocks
                };
            }
        });
    }

    /**
     * Get active block layer (for block operations)
     * @returns {BlockLayer|null}
     */
    getActiveBlockLayer() {
        const activeLayer = this.getActiveLayer();
        if (activeLayer && activeLayer.type === 'block') {
            return activeLayer;
        }
        // If active layer is not a block layer, return first visible block layer
        return this.layers.find(l => l.type === 'block' && l.visible) || null;
    }
}
